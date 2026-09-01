const Database = require('better-sqlite3');
const logger = require('../utils/logger');
const { getBaseCurrency } = require('../config/currencies');
const { getMonthDateRange } = require('../utils/dateUtils');

/**
 * 月度分类汇总服务
 * 处理基于payment_history的月度分类汇总计算和存储
 */
class MonthlyCategorySummaryService {
    constructor(dbOrPath, options = {}) {
        this.ownsConnection = typeof dbOrPath === 'string';
        this.db = this.ownsConnection ? new Database(dbOrPath) : dbOrPath;
        this.baseCurrency = options.baseCurrency || getBaseCurrency();
    }

    /**
     * 获取汇率
     */
    getExchangeRate(fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) {
            return 1.0;
        }

        // 首先尝试直接查找汇率
        const stmt = this.db.prepare(`
            SELECT rate FROM exchange_rates
            WHERE from_currency = ? AND to_currency = ?
        `);
        const result = stmt.get(fromCurrency, toCurrency);

        if (result) {
            return parseFloat(result.rate);
        }

        // 如果没有直接汇率，尝试反向汇率
        const reverseStmt = this.db.prepare(`
            SELECT rate FROM exchange_rates
            WHERE from_currency = ? AND to_currency = ?
        `);
        const reverseResult = reverseStmt.get(toCurrency, fromCurrency);

        if (reverseResult) {
            const reverseRate = parseFloat(reverseResult.rate);
            if (reverseRate !== 0) {
                return 1 / reverseRate;
            }
        }

        // 如果没有直接汇率和反向汇率，尝试通过基础货币转换
        const baseCurrency = getBaseCurrency();
        if (fromCurrency !== baseCurrency && toCurrency !== baseCurrency) {
            const toBaseRate = this.getExchangeRate(fromCurrency, baseCurrency);
            const fromBaseRate = this.getExchangeRate(baseCurrency, toCurrency);
            if (toBaseRate !== 1.0 && fromBaseRate !== 1.0) {
                return toBaseRate * fromBaseRate;
            }
        }

        logger.warn(`Exchange rate not found: ${fromCurrency} -> ${toCurrency}, using 1.0`);
        return 1.0;
    }

    /**
     * 计算并更新指定月份的分类汇总数据
     */
    updateMonthlyCategorySummary(year, month) {
        try {
            logger.info(`Updating monthly category summary for ${year}-${month.toString().padStart(2, '0')}`);

            // 获取该月份的所有成功支付记录，包含分类信息
            const { startDate, endDate } = getMonthDateRange(year, month);

            const paymentsStmt = this.db.prepare(`
                SELECT 
                    ph.id,
                    ph.amount_paid,
                    ph.currency,
                    ph.payment_date,
                    s.category_id,
                    COALESCE(c.id, (SELECT id FROM categories WHERE value = 'other')) as resolved_category_id
                FROM payment_history ph
                JOIN subscriptions s ON ph.subscription_id = s.id
                LEFT JOIN categories c ON s.category_id = c.id
                WHERE ph.payment_date >= ? AND ph.payment_date <= ?
                AND ph.status = 'succeeded'
                ORDER BY s.category_id
            `);

            const payments = paymentsStmt.all(startDate, endDate);
            
            if (payments.length === 0) {
                // A payment may have been deleted or moved to another month.
                // Clear any previously cached aggregate so reports cannot show stale data.
                this.db.prepare(`
                    DELETE FROM monthly_category_summary
                    WHERE year = ? AND month = ?
                `).run(year, month);
                logger.info(`No payments found for ${year}-${month.toString().padStart(2, '0')}`);
                return;
            }

            // 按分类分组计算汇总数据
            const categoryData = {};

            payments.forEach(payment => {
                const categoryId = payment.resolved_category_id;
                
                if (!categoryData[categoryId]) {
                    categoryData[categoryId] = {
                        totalAmount: 0,
                        transactionCount: 0
                    };
                }

                // 转换为基础货币
                const rate = this.getExchangeRate(payment.currency, this.baseCurrency);
                const amountInBaseCurrency = parseFloat(payment.amount_paid) * rate;

                categoryData[categoryId].totalAmount += amountInBaseCurrency;
                categoryData[categoryId].transactionCount += 1;
            });

            // 使用事务更新数据库
            const transaction = this.db.transaction(() => {
                // 先删除该月份的现有数据
                const deleteStmt = this.db.prepare(`
                    DELETE FROM monthly_category_summary 
                    WHERE year = ? AND month = ?
                `);
                deleteStmt.run(year, month);

                // 插入新的汇总数据
                const insertStmt = this.db.prepare(`
                    INSERT INTO monthly_category_summary (
                        year, month, category_id, 
                        total_amount_in_base_currency, base_currency, transactions_count
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `);

                Object.entries(categoryData).forEach(([categoryId, data]) => {
                    insertStmt.run(
                        year,
                        month,
                        parseInt(categoryId),
                        Math.round(data.totalAmount * 100) / 100, // 保留两位小数
                        this.baseCurrency,
                        data.transactionCount
                    );
                });
            });

            transaction();

            logger.info(`Updated monthly category summary for ${year}-${month.toString().padStart(2, '0')}: ${Object.keys(categoryData).length} categories`);

        } catch (error) {
            logger.error(`Failed to update monthly category summary for ${year}-${month}:`, error.message);
            throw error;
        }
    }

    /**
     * 重新计算所有月份的分类汇总数据
     */
    recalculateAllMonthlyCategorySummaries() {
        try {
            logger.info('Starting recalculation of all monthly category summaries...');

            // 获取所有有支付记录的月份
            const monthsStmt = this.db.prepare(`
                SELECT DISTINCT 
                    strftime('%Y', payment_date) as year,
                    strftime('%m', payment_date) as month
                FROM payment_history 
                WHERE status = 'succeeded'
                ORDER BY year, month
            `);

            const months = monthsStmt.all();
            
            if (months.length === 0) {
                logger.info('No payment records found for recalculation');
                return;
            }

            // 清空现有的汇总数据
            this.db.prepare('DELETE FROM monthly_category_summary').run();

            // 重新计算每个月份
            months.forEach(monthData => {
                const year = parseInt(monthData.year);
                const month = parseInt(monthData.month);
                this.updateMonthlyCategorySummary(year, month);
            });

            logger.info(`Recalculated monthly category summaries for ${months.length} months`);

        } catch (error) {
            logger.error('Failed to recalculate all monthly category summaries:', error.message);
            throw error;
        }
    }

    /**
     * 处理新的支付记录
     */
    processNewPayment(paymentId) {
        try {
            // 获取支付记录信息
            const paymentStmt = this.db.prepare(`
                SELECT 
                    strftime('%Y', payment_date) as year,
                    strftime('%m', payment_date) as month
                FROM payment_history 
                WHERE id = ? AND status = 'succeeded'
            `);
            
            const payment = paymentStmt.get(paymentId);
            
            if (!payment) {
                logger.warn(`Payment ${paymentId} not found or not succeeded`);
                return;
            }

            const year = parseInt(payment.year);
            const month = parseInt(payment.month);

            // 更新该月份的汇总数据
            this.updateMonthlyCategorySummary(year, month);

            logger.info(`Processed payment ${paymentId} for monthly category summary`);

        } catch (error) {
            logger.error(`Failed to process payment ${paymentId}:`, error.message);
            throw error;
        }
    }

    /**
     * 处理支付记录删除
     */
    processPaymentDeletion(year, month) {
        try {
            // 重新计算该月份的汇总数据
            this.updateMonthlyCategorySummary(year, month);
            logger.info(`Processed payment deletion for ${year}-${month.toString().padStart(2, '0')}`);

        } catch (error) {
            logger.error(`Failed to process payment deletion for ${year}-${month}:`, error.message);
            throw error;
        }
    }

    /**
     * 获取月度分类汇总数据
     */
    getMonthlyCategorySummary(startYear, startMonth, endYear, endMonth) {
        const stmt = this.db.prepare(`
            SELECT 
                mcs.*,
                c.value as category_value,
                c.label as category_label
            FROM monthly_category_summary mcs
            JOIN categories c ON mcs.category_id = c.id
            WHERE (mcs.year > ? OR (mcs.year = ? AND mcs.month >= ?))
            AND (mcs.year < ? OR (mcs.year = ? AND mcs.month <= ?))
            ORDER BY mcs.year, mcs.month, c.label
        `);

        return stmt.all(startYear, startYear, startMonth, endYear, endYear, endMonth);
    }

    /**
     * 获取指定月份的分类汇总
     */
    getMonthCategorySummary(year, month) {
        const stmt = this.db.prepare(`
            SELECT 
                mcs.*,
                c.value as category_value,
                c.label as category_label
            FROM monthly_category_summary mcs
            JOIN categories c ON mcs.category_id = c.id
            WHERE mcs.year = ? AND mcs.month = ?
            ORDER BY mcs.total_amount_in_base_currency DESC
        `);

        return stmt.all(year, month);
    }

    /**
     * 获取总计数据
     */
    getTotalSummary(startYear, startMonth, endYear, endMonth) {
        const stmt = this.db.prepare(`
            SELECT 
                SUM(total_amount_in_base_currency) as total_amount,
                SUM(transactions_count) as total_transactions,
                base_currency
            FROM monthly_category_summary
            WHERE (year > ? OR (year = ? AND month >= ?))
            AND (year < ? OR (year = ? AND month <= ?))
            GROUP BY base_currency
        `);

        return stmt.get(startYear, startYear, startMonth, endYear, endYear, endMonth);
    }

    close() {
        if (this.ownsConnection) {
            this.db.close();
        }
    }
}

module.exports = MonthlyCategorySummaryService;
