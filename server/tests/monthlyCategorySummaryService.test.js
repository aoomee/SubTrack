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
});
