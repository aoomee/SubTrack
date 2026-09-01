const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const MonthlyCategorySummaryService = require('../services/monthlyCategorySummaryService');

describe('MonthlyCategorySummaryService', () => {
    let tempDir;
    let dbPath;
    let service;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'subtrack-summary-'));
        dbPath = path.join(tempDir, 'test.sqlite');

        const db = new Database(dbPath);
        const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
        db.exec(schema);
        db.prepare(`
            INSERT INTO monthly_category_summary (
                year, month, category_id,
                total_amount_in_base_currency, base_currency, transactions_count
            ) VALUES (?, ?, (SELECT id FROM categories WHERE value = 'other'), ?, ?, ?)
        `).run(2026, 8, 99.99, 'CNY', 1);
        db.close();

        service = new MonthlyCategorySummaryService(dbPath);
    });

    afterEach(() => {
        service?.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('clears a stale monthly summary when the month has no successful payments', () => {
        service.updateMonthlyCategorySummary(2026, 8);

        expect(service.getMonthCategorySummary(2026, 8)).toEqual([]);
    });

    test('stores summaries in the configured base currency', () => {
        service.close();
        const db = new Database(dbPath);
        const categoryId = db.prepare("SELECT id FROM categories WHERE value = 'other'").get().id;
        const paymentMethodId = db.prepare('SELECT id FROM payment_methods LIMIT 1').get().id;
        const subscriptionId = db.prepare(`
            INSERT INTO subscriptions (
                name, plan, billing_cycle, amount, currency, payment_method_id,
                status, category_id, renewal_type
            ) VALUES ('Currency test', 'Standard', 'monthly', 65, 'CNY', ?, 'active', ?, 'manual')
        `).run(paymentMethodId, categoryId).lastInsertRowid;
        db.prepare(`
            INSERT INTO payment_history (
                subscription_id, payment_date, amount_paid, currency,
                billing_period_start, billing_period_end, status
            ) VALUES (?, '2026-09-10', 65, 'CNY', '2026-09-01', '2026-09-30', 'succeeded')
        `).run(subscriptionId);
        db.close();

        service = new MonthlyCategorySummaryService(dbPath, { baseCurrency: 'USD' });
        service.updateMonthlyCategorySummary(2026, 9);

        expect(service.getMonthCategorySummary(2026, 9)[0]).toMatchObject({
            base_currency: 'USD',
            total_amount_in_base_currency: 10
        });
    });
});
