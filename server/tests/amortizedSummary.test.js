const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const Database = require('better-sqlite3');
const MonthlyCategorySummaryService = require('../services/monthlyCategorySummaryService');
const { createMonthlyCategorySummaryRoutes } = require('../routes/monthlyCategorySummary');
const { errorHandler } = require('../middleware/errorHandler');

describe('monthly allocated costs', () => {
    let db, service, app;
    function addPayment({ start = '2025-11-15', end = '2026-11-15', amount = 1200, cycle = 'yearly', status = 'succeeded', currency = 'CNY' } = {}) {
        const subscriptionId = db.prepare(`
            INSERT INTO subscriptions (name, plan, billing_cycle, amount, currency, payment_method_id, status, category_id, renewal_type)
            VALUES ('Test', 'Standard', ?, ?, ?, (SELECT id FROM payment_methods LIMIT 1), 'active',
                (SELECT id FROM categories WHERE value = 'other'), 'manual')
        `).run(cycle, amount, currency).lastInsertRowid;
        db.prepare(`INSERT INTO payment_history (subscription_id, payment_date, amount_paid, currency, billing_period_start, billing_period_end, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)`).run(subscriptionId, start, amount, currency, start, end, status);
        return Number(subscriptionId);
    }
    beforeEach(() => {
        db = new Database(':memory:');
        db.exec(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
        service = new MonthlyCategorySummaryService(db, { baseCurrency: 'CNY' });
        app = express();
        app.use('/summary', createMonthlyCategorySummaryRoutes(db));
        app.use(errorHandler);
    });
    afterEach(() => db.close());

    test('allocates a cross-year annual payment over exactly 12 months, including months after the payment query range', () => {
        const id = addPayment();
        const rows = service.getAmortizedCategorySummary(2025, 1, 2026, 12);
        expect(rows).toHaveLength(12);
        expect(rows[0]).toMatchObject({ year: 2025, month: 11 });
        expect(rows[11]).toMatchObject({ year: 2026, month: 10 });
        expect(rows.every(row => row.total_amount_in_base_currency === 100)).toBe(true);
        expect(service.getAmortizedCategorySummary(2026, 9, 2026, 9)[0]).toMatchObject({
            total_amount_in_base_currency: 100, subscription_ids: [id], transactions_count: 1
        });
        // Read-only: no new payment records or modifications to cash summaries.
        expect(db.prepare('SELECT count(*) AS n FROM payment_history').get().n).toBe(1);
        expect(db.prepare('SELECT count(*) AS n FROM monthly_category_summary').get().n).toBe(0);
    });
    test.each([
        ['monthly', '2026-02-28', '2026-03-28', 1],
        ['quarterly', '2026-01-15', '2026-04-15', 3],
        ['semiannual', '2026-01-15', '2026-07-15', 6],
        ['yearly', '2024-02-29', '2025-02-28', 12],
        ['yearly', '2026-01-01', '2026-12-31', 12],
        ['monthly', '2026-01-31', '2026-03-03', 1],
    ])('%s preserves cents and supports recorded billing periods %s – %s', (cycle, start, end, months) => {
        addPayment({ start, end, cycle, amount: 100 });
        const rows = service.getAmortizedCategorySummary(2024, 1, 2026, 12);
        expect(rows).toHaveLength(months);
        expect(rows.reduce((sum, row) => sum + Math.round(row.total_amount_in_base_currency * 100), 0)).toBe(10000);
        expect(Math.max(...rows.map(row => row.total_amount_in_base_currency)) - Math.min(...rows.map(row => row.total_amount_in_base_currency))).toBeLessThanOrEqual(0.010001);
    });
    test('excludes pending, failed and refunded payments', () => {
        ['pending', 'failed', 'refunded'].forEach(status => addPayment({ status }));
        expect(service.getAmortizedCategorySummary(2025, 1, 2026, 12)).toEqual([]);
    });
    test('uses historical periods even if the subscription cycle changed', () => {
        addPayment({ cycle: 'monthly' });
        expect(service.getAmortizedCategorySummary(2025, 1, 2026, 12)).toHaveLength(12);
    });
    test('converts currency before allocation', () => {
        addPayment({ currency: 'USD' });
        const rate = service.getExchangeRate('USD', 'CNY');
        const rows = service.getAmortizedCategorySummary(2025, 11, 2026, 10);
        expect(rows.reduce((sum, row) => sum + Math.round(row.total_amount_in_base_currency * 100), 0)).toBe(Math.round(1200 * rate * 100));
        expect(rows.every(row => Math.abs(row.total_amount_in_base_currency - 100 * rate) < 0.01)).toBe(true);
    });
    test('HTTP opt-in returns allocations while legacy cash requests still return payment totals', async () => {
        addPayment();
        service.updateMonthlyCategorySummary(2025, 11);
        const query = '?start_year=2025&start_month=11&end_year=2026&end_month=10';
        const allocated = await request(app).get(`/summary${query}&basis=amortized`).expect(200);
        expect(allocated.body.data.summaries).toHaveLength(12);
        expect(allocated.body.data.summaries[0]).toMatchObject({ monthKey: '2025-11', totalAmount: 100, subscriptionIds: [1], paymentIds: [1] });
        const cash = await request(app).get(`/summary${query}`).expect(200);
        expect(cash.body.data.summaries).toHaveLength(1);
        expect(cash.body.data.summaries[0].totalAmount).toBe(1200);
        await request(app).get(`/summary${query}&basis=invalid`).expect(400);
        await request(app).get('/summary?start_year=2026&start_month=9&end_year=2026&end_month=1').expect(400);
    });
});
