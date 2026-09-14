const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const request = require('supertest');
const Database = require('better-sqlite3');
const { createAdminUserManager } = require('../config/authCredentials');
const createAuthRoutes = require('../routes/auth');
const { createSubscriptionRoutes, createProtectedSubscriptionRoutes } = require('../routes/subscriptions');
const { errorHandler } = require('../middleware/errorHandler');
const NotificationService = require('../services/notificationService');

describe('subscription HTTP writes from deployed clients', () => {
    let db;
    let agent;
    let payload;

    beforeEach(async () => {
        db = new Database(':memory:');
        db.exec(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
        db.exec(`CREATE TABLE users (
            id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT,
            role TEXT, last_login_at TEXT, created_at TEXT, updated_at TEXT
        )`);
        // Seed directly so tests do not depend on deployment environment variables.
        const bcrypt = require('bcryptjs');
        db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
            .run(process.env.ADMIN_USERNAME || 'admin', bcrypt.hashSync('HttpTest123', 4), 'admin');
        createAdminUserManager(db).bootstrapDefaultAdmin();
        jest.spyOn(NotificationService.prototype, 'sendNotification').mockResolvedValue({ success: true });
        const app = express();
        app.use(express.json());
        app.use(session({ secret: 'subscription-http-test', resave: false, saveUninitialized: false }));
        app.use('/api/auth', createAuthRoutes(db));
        app.use('/api', (req, res, next) => {
            if (!req.session.user) return res.sendStatus(401);
            next();
        });
        app.use('/api/subscriptions', createSubscriptionRoutes(db));
        app.use('/api/protected/subscriptions', createProtectedSubscriptionRoutes(db));
        app.use(errorHandler);
        agent = request.agent(app);
        await agent.post('/api/auth/login').send({
            username: process.env.ADMIN_USERNAME || 'admin', password: 'HttpTest123'
        }).expect(200);
        payload = {
            name: 'HTTP subscription', plan: 'Standard', billing_cycle: 'monthly',
            next_billing_date: '2026-09-01', start_date: '2026-08-01',
            amount: 20, currency: 'CNY', status: 'active', renewal_type: 'manual',
            category_id: db.prepare('SELECT id FROM categories LIMIT 1').get().id,
            payment_method_id: db.prepare('SELECT id FROM payment_methods LIMIT 1').get().id,
            notes: '', website: ''
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
        db.close();
    });

    test.each([false, true])('creates and reads back a subscription (legacy payload: %s)', async legacy => {
        const response = await agent.post('/api/protected/subscriptions').send({
            ...payload, ...(legacy ? { last_billing_date: '1900-01-01' } : {})
        });
        expect(response.status).toBe(201);
        const id = response.body.data.id;
        const read = await agent.get(`/api/subscriptions/${id}`).expect(200);
        expect(read.body.data).toMatchObject({ id, name: payload.name, last_billing_date: '2026-08-01' });
        expect(db.prepare('SELECT COUNT(*) AS count FROM payment_history WHERE subscription_id = ?').get(id).count).toBe(1);
        expect(db.prepare('SELECT SUM(transactions_count) AS count FROM monthly_category_summary').get().count).toBe(1);
    });

    test('imports legacy payloads and ignores client-derived dates when editing', async () => {
        await agent.post('/api/protected/subscriptions/bulk').send([
            { ...payload, last_billing_date: '1900-01-01' },
            { ...payload, name: 'Second', last_billing_date: '1900-01-01' }
        ]).expect(201);
        const id = db.prepare('SELECT id FROM subscriptions LIMIT 1').get().id;
        await agent.put(`/api/protected/subscriptions/${id}`).send({
            next_billing_date: '2026-10-01', last_billing_date: '1900-01-01'
        }).expect(200);
        expect(db.prepare('SELECT last_billing_date FROM subscriptions WHERE id = ?').get(id).last_billing_date).toBe('2026-09-01');
    });

    test('still rejects writes to IDs and unknown fields', async () => {
        await agent.post('/api/protected/subscriptions').send({ ...payload, id: 123 }).expect(400);
        await agent.post('/api/protected/subscriptions').send({ ...payload, arbitrary_field: 'x' }).expect(400);
        expect(db.prepare('SELECT COUNT(*) AS count FROM subscriptions').get().count).toBe(0);
    });
});
