const Database = require('better-sqlite3');
const NotificationService = require('../services/notificationService');
const NotificationController = require('../controllers/notificationController');

function createMockRes() {
    const res = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
    return res;
}

describe('Notification history cleanup (single, batch, clear all)', () => {
    let db;
    let controller;

    beforeEach(() => {
        db = new Database(':memory:');
        db.exec(`
            CREATE TABLE notification_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subscription_id INTEGER NOT NULL,
                notification_type TEXT NOT NULL,
                channel_type TEXT NOT NULL,
                status TEXT NOT NULL,
                recipient TEXT NOT NULL,
                message_content TEXT NOT NULL,
                error_message TEXT,
                retry_count INTEGER DEFAULT 0,
                max_retry INTEGER DEFAULT 3,
                scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                sent_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        const insert = db.prepare(`
            INSERT INTO notification_history (subscription_id, notification_type, channel_type, status, recipient, message_content)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        insert.run(1, 'renewal_reminder', 'telegram', 'sent', '1001', 'Msg 1');
        insert.run(2, 'expiration_warning', 'email', 'failed', 'a@b.com', 'Msg 2');
        insert.run(3, 'renewal_success', 'telegram', 'sent', '1001', 'Msg 3');
        insert.run(4, 'subscription_change', 'telegram', 'sent', '1001', 'Msg 4');

        controller = new NotificationController();
        controller.notificationService.close();
        controller.notificationService = new NotificationService(db);
    });

    afterEach(() => {
        db.close();
    });

    test('deletes a single history item and returns 404 for nonexistent id', () => {
        const res = createMockRes();
        controller.deleteNotificationHistoryItem({ params: { id: '2' } }, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.deletedCount).toBe(1);
        expect(db.prepare('SELECT COUNT(*) as c FROM notification_history').get().c).toBe(3);

        const missingRes = createMockRes();
        controller.deleteNotificationHistoryItem({ params: { id: '999' } }, missingRes);
        expect(missingRes.statusCode).toBe(404);
    });

    test('batch deletes selected ids and rejects invalid payloads', () => {
        const badRes = createMockRes();
        controller.batchDeleteNotificationHistory({ body: { ids: [] } }, badRes);
        expect(badRes.statusCode).toBe(400);

        const badIdRes = createMockRes();
        controller.batchDeleteNotificationHistory({ body: { ids: [1, -5] } }, badIdRes);
        expect(badIdRes.statusCode).toBe(400);

        const res = createMockRes();
        controller.batchDeleteNotificationHistory({ body: { ids: [1, 3] } }, res);
        expect(res.statusCode).toBe(200);
        expect(res.body.data.deletedCount).toBe(2);

        const remaining = db.prepare('SELECT id FROM notification_history ORDER BY id').all().map((r) => r.id);
        expect(remaining).toEqual([2, 4]);
    });

    test('clears all notification history in one call', () => {
        const res = createMockRes();
        controller.clearNotificationHistory({}, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.deletedCount).toBe(4);
        expect(db.prepare('SELECT COUNT(*) as c FROM notification_history').get().c).toBe(0);
    });
});
