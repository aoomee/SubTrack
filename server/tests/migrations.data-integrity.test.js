const Database = require('better-sqlite3');
const fs = require('fs');
const os = require('os');
const path = require('path');
const DatabaseMigrations = require('../db/migrations');

describe('database migration data integrity', () => {
    let tempDir;
    let dbPath;
    const originalPassword = process.env.ADMIN_PASSWORD;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'subtrack-migration-'));
        dbPath = path.join(tempDir, 'database.sqlite');
        process.env.ADMIN_PASSWORD = 'migration-test-password';
    });

    afterEach(() => {
        if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD;
        else process.env.ADMIN_PASSWORD = originalPassword;
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('preserves child history and indexes while upgrading through migration 4', () => {
        const initialMigrations = new DatabaseMigrations(dbPath);
        initialMigrations.migrations = initialMigrations.migrations.filter(migration => migration.version <= 3);
        initialMigrations.runMigrations();
        initialMigrations.close();

        const db = new Database(dbPath);
        const categoryId = db.prepare('SELECT id FROM categories LIMIT 1').get().id;
        const paymentMethodId = db.prepare('SELECT id FROM payment_methods LIMIT 1').get().id;
        const subscriptionId = db.prepare(`
            INSERT INTO subscriptions (
                name, plan, billing_cycle, amount, currency, payment_method_id,
                status, category_id, renewal_type
            ) VALUES ('Migration test', 'Standard', 'monthly', 10, 'CNY', ?, 'active', ?, 'manual')
        `).run(paymentMethodId, categoryId).lastInsertRowid;

        db.prepare(`
            INSERT INTO payment_history (
                subscription_id, payment_date, amount_paid, currency,
                billing_period_start, billing_period_end, status
            ) VALUES (?, '2026-08-01', 10, 'CNY', '2026-08-01', '2026-08-31', 'succeeded')
        `).run(subscriptionId);
        db.prepare(`
            INSERT INTO notification_history (
                subscription_id, notification_type, channel_type, status,
                recipient, message_content
            ) VALUES (?, 'renewal_reminder', 'telegram', 'sent', 'test', 'test')
        `).run(subscriptionId);
        db.close();

        const migrations = new DatabaseMigrations(dbPath);
        migrations.runMigrations();
        migrations.close();

        const verify = new Database(dbPath);
        verify.pragma('foreign_keys = ON');
        expect(verify.prepare('SELECT COUNT(*) AS count FROM payment_history').get().count).toBe(1);
        expect(verify.prepare('SELECT COUNT(*) AS count FROM notification_history').get().count).toBe(1);
        expect(verify.pragma('foreign_key_check')).toEqual([]);
        expect(verify.pragma('foreign_key_list(payment_history)')[0].table).toBe('subscriptions');
        expect(verify.pragma('foreign_key_list(notification_history)')[0].table).toBe('subscriptions');
        expect(verify.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_subscriptions_status'").get()).toBeTruthy();
        expect(() => verify.prepare(`
            INSERT INTO payment_history (
                subscription_id, payment_date, amount_paid, currency,
                billing_period_start, billing_period_end, status
            ) VALUES (?, '2026-09-01', 10, 'CNY', '2026-09-01', '2026-09-30', 'pending')
        `).run(subscriptionId)).not.toThrow();
        verify.close();
    });
});
