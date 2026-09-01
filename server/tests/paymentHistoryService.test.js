const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const PaymentHistoryService = require('../services/paymentHistoryService');

describe('PaymentHistoryService', () => {
    let db;
    let service;
    let subscriptionId;

    beforeEach(() => {
        db = new Database(':memory:');
        db.exec(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
        db.pragma('foreign_keys = ON');
        const categoryId = db.prepare('SELECT id FROM categories LIMIT 1').get().id;
        const paymentMethodId = db.prepare('SELECT id FROM payment_methods LIMIT 1').get().id;
        subscriptionId = Number(db.prepare(`
            INSERT INTO subscriptions (
                name, plan, billing_cycle, amount, currency, payment_method_id,
                status, category_id, renewal_type
            ) VALUES ('Service test', 'Standard', 'monthly', 20, 'CNY', ?, 'active', ?, 'manual')
        `).run(paymentMethodId, categoryId).lastInsertRowid);
        service = new PaymentHistoryService(db);
    });

    afterEach(() => {
        service.close();
        db.close();
    });

    const payment = (overrides = {}) => ({
        subscription_id: subscriptionId,
        payment_date: '2026-08-15',
        amount_paid: 20,
        currency: 'CNY',
        billing_period_start: '2026-08-01',
        billing_period_end: '2026-08-31',
        status: 'succeeded',
        ...overrides
    });

    test('bulk inserts return concrete results and update summaries atomically', async () => {
        const results = await service.bulkCreatePayments([
            payment(),
            payment({ payment_date: '2026-08-20', amount_paid: 30 })
        ]);

        expect(results).toHaveLength(2);
        expect(results.every(result => ['number', 'bigint'].includes(typeof result.lastInsertRowid))).toBe(true);
        expect(results.every(result => typeof result.then === 'undefined')).toBe(true);
        expect(db.prepare('SELECT COUNT(*) AS count FROM payment_history').get().count).toBe(2);
        expect(db.prepare(`
            SELECT total_amount_in_base_currency AS total, transactions_count AS count
            FROM monthly_category_summary WHERE year = 2026 AND month = 8
        `).get()).toMatchObject({ total: 50, count: 2 });
    });

    test('bulk insert rolls every row back when one payment is invalid', async () => {
        await expect(service.bulkCreatePayments([
            payment(),
            payment({ subscription_id: 999999 })
        ])).rejects.toThrow('Subscription not found');

        expect(db.prepare('SELECT COUNT(*) AS count FROM payment_history').get().count).toBe(0);
        expect(db.prepare('SELECT COUNT(*) AS count FROM monthly_category_summary').get().count).toBe(0);
    });

    test('rolls an update back when summary refresh fails', async () => {
        const id = Number((await service.createPayment(payment())).lastInsertRowid);
        jest.spyOn(service.monthlyCategorySummaryService, 'updateMonthlyCategorySummary').mockImplementation(() => {
            throw new Error('summary failed');
        });

        await expect(service.updatePayment(id, { amount_paid: 99 })).rejects.toThrow('summary failed');
        expect(db.prepare('SELECT amount_paid FROM payment_history WHERE id = ?').get(id).amount_paid).toBe(20);
    });

    test('rolls a deletion back when summary refresh fails', async () => {
        const id = Number((await service.createPayment(payment())).lastInsertRowid);
        jest.spyOn(service.monthlyCategorySummaryService, 'processPaymentDeletion').mockImplementation(() => {
            throw new Error('summary failed');
        });

        await expect(service.deletePayment(id)).rejects.toThrow('summary failed');
        expect(db.prepare('SELECT COUNT(*) AS count FROM payment_history WHERE id = ?').get(id).count).toBe(1);
    });

    test('subscription stats and category filtering use the category relation', async () => {
        const stats = await service.getPaymentById(
            Number((await service.createPayment(payment())).lastInsertRowid)
        );
        expect(stats.subscription_category).toBeTruthy();
    });
});
