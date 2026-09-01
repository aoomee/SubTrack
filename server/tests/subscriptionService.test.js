const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const SubscriptionService = require('../services/subscriptionService');

describe('SubscriptionService', () => {
    let db;
    let service;
    let category;
    let paymentMethodId;

    beforeEach(() => {
        db = new Database(':memory:');
        db.exec(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
        db.pragma('foreign_keys = ON');
        category = db.prepare("SELECT id, value FROM categories WHERE value = 'software'").get();
        paymentMethodId = db.prepare('SELECT id FROM payment_methods LIMIT 1').get().id;
        service = new SubscriptionService(db);
    });

    afterEach(() => {
        service.close();
        db.close();
    });

    const subscription = (overrides = {}) => ({
        name: 'Subscription test',
        plan: 'Standard',
        billing_cycle: 'monthly',
        next_billing_date: '2026-09-01',
        amount: 18,
        currency: 'CNY',
        payment_method_id: paymentMethodId,
        start_date: '2026-08-01',
        status: 'active',
        category_id: category.id,
        renewal_type: 'manual',
        ...overrides
    });

    test('category statistics and filtering use category_id relation', async () => {
        await service.createSubscription(subscription());

        const stats = await service.getSubscriptionStats();
        const categoryStats = stats.byCategory.find(item => item.category === category.value);
        expect(categoryStats).toMatchObject({ category_id: category.id, count: 1, total_amount: 18 });

        const byValue = await service.getSubscriptionsByCategory(category.value);
        const byId = await service.getSubscriptionsByCategory(String(category.id));
        expect(byValue).toHaveLength(1);
        expect(byId).toHaveLength(1);
    });

    test('rolls subscription creation back if payment generation fails', async () => {
        jest.spyOn(service, 'generatePaymentHistory').mockImplementation(() => {
            throw new Error('payment generation failed');
        });

        await expect(service.createSubscription(subscription())).rejects.toThrow('payment generation failed');
        expect(db.prepare('SELECT COUNT(*) AS count FROM subscriptions').get().count).toBe(0);
    });

    test('rolls an update back if payment regeneration fails', async () => {
        const id = Number((await service.createSubscription(subscription())).lastInsertRowid);
        jest.spyOn(service, 'regeneratePaymentHistory').mockImplementation(() => {
            throw new Error('regeneration failed');
        });

        await expect(service.updateSubscription(id, { amount: 99 })).rejects.toThrow('regeneration failed');
        expect(db.prepare('SELECT amount FROM subscriptions WHERE id = ?').get(id).amount).toBe(18);
    });
});
