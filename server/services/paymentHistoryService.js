const BaseRepository = require('../utils/BaseRepository');
const MonthlyCategorySummaryService = require('./monthlyCategorySummaryService');
const logger = require('../utils/logger');
const { NotFoundError } = require('../middleware/errorHandler');
const { getMonthDateRange } = require('../utils/dateUtils');

class PaymentHistoryService extends BaseRepository {
    constructor(db) {
        super(db, 'payment_history');
        this.monthlyCategorySummaryService = new MonthlyCategorySummaryService(db);
    }

    /**
     * 获取支付历史记录（带过滤和分页）
     */
    async getPaymentHistory(filters = {}, options = {}) {
        let query = `
            SELECT
                ph.*,
                s.name as subscription_name,
                s.plan as subscription_plan
            FROM payment_history ph
            LEFT JOIN subscriptions s ON ph.subscription_id = s.id
            WHERE 1=1
        `;

        const params = [];

        // 添加过滤条件
        if (filters.subscription_id) {
            query += ' AND ph.subscription_id = ?';
            params.push(filters.subscription_id);
        }

        if (filters.start_date) {
            query += ' AND ph.payment_date >= ?';
            params.push(filters.start_date);
        }

        if (filters.end_date) {
            query += ' AND ph.payment_date <= ?';
            params.push(filters.end_date);
        }

        if (filters.status) {
            query += ' AND ph.status = ?';
            params.push(filters.status);
        }

        if (filters.currency) {
            query += ' AND ph.currency = ?';
            params.push(filters.currency);
        }

        // 添加排序
        query += ' ORDER BY ph.payment_date DESC, ph.id DESC';

        // 添加分页
        if (options.limit) {
            query += ' LIMIT ?';
            params.push(options.limit);

            if (options.offset) {
                query += ' OFFSET ?';
                params.push(options.offset);
            }
        }

        const stmt = this.db.prepare(query);
        return stmt.all(...params);
    }

    /**
     * 根据ID获取支付记录
     */
    async getPaymentById(id) {
        const query = `
            SELECT
                ph.*,
                s.name as subscription_name,
                s.plan as subscription_plan,
                c.value as subscription_category,
                c.label as subscription_category_label
            FROM payment_history ph
            LEFT JOIN subscriptions s ON ph.subscription_id = s.id
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE ph.id = ?
        `;

        const stmt = this.db.prepare(query);
        return stmt.get(id);
    }

    /**
     * 获取月度支付统计
     */
    async getMonthlyStats(year, month) {
        const { startDate, endDate } = getMonthDateRange(year, month);

        const query = `
            SELECT
                COUNT(*) as total_payments,
                SUM(CASE WHEN status = 'succeeded' THEN amount_paid ELSE 0 END) as total_amount,
                COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as successful_payments,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
                currency,
                AVG(CASE WHEN status = 'succeeded' THEN amount_paid ELSE NULL END) as avg_payment_amount
            FROM payment_history
            WHERE payment_date >= ? AND payment_date <= ?
            GROUP BY currency
            ORDER BY total_amount DESC
        `;

        const stmt = this.db.prepare(query);
        return stmt.all(startDate, endDate);
    }

    /**
     * 获取年度支付统计
     */
    async getYearlyStats(year) {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        const query = `
            SELECT
                strftime('%m', payment_date) as month,
                COUNT(*) as total_payments,
                SUM(CASE WHEN status = 'succeeded' THEN amount_paid ELSE 0 END) as total_amount,
                COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as successful_payments,
                currency
            FROM payment_history
            WHERE payment_date >= ? AND payment_date <= ?
            GROUP BY strftime('%m', payment_date), currency
            ORDER BY month, currency
        `;

        const stmt = this.db.prepare(query);
        return stmt.all(startDate, endDate);
    }

    /**
     * 获取季度支付统计
     */
    async getQuarterlyStats(year, quarter) {
        const quarterMonths = {
            1: { start: '01', end: '03' },
            2: { start: '04', end: '06' },
            3: { start: '07', end: '09' },
            4: { start: '10', end: '12' }
        };

        const { start, end } = quarterMonths[quarter];
        const startDate = `${year}-${start}-01`;
        const endDate = getMonthDateRange(year, Number(end)).endDate;

        const query = `
            SELECT
                strftime('%m', payment_date) as month,
                COUNT(*) as total_payments,
                SUM(CASE WHEN status = 'succeeded' THEN amount_paid ELSE 0 END) as total_amount,
                COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as successful_payments,
                currency
            FROM payment_history
            WHERE payment_date >= ? AND payment_date <= ?
            GROUP BY strftime('%m', payment_date), currency
            ORDER BY month, currency
        `;

        const stmt = this.db.prepare(query);
        return stmt.all(startDate, endDate);
    }

    /**
     * 创建支付记录
     */
    _createPaymentRecord(paymentData) {
        const {
            subscription_id,
            payment_date,
            amount_paid,
            currency,
            billing_period_start,
            billing_period_end,
            status = 'succeeded',
            notes
        } = paymentData;

        // 验证订阅是否存在
        const subscriptionExists = this.db.prepare('SELECT id FROM subscriptions WHERE id = ?').get(subscription_id);
        if (!subscriptionExists) {
            throw new NotFoundError('Subscription');
        }

        return this.create({
            subscription_id,
            payment_date,
            amount_paid,
            currency,
            billing_period_start,
            billing_period_end,
            status,
            notes
        });
    }

    async createPayment(paymentData) {
        return this.db.transaction((data) => {
            const result = this._createPaymentRecord(data);

            if ((data.status || 'succeeded') === 'succeeded') {
                this.monthlyCategorySummaryService.processNewPayment(result.lastInsertRowid);
                logger.info(`Monthly category summary updated for new payment ${result.lastInsertRowid}`);
            }

            return result;
        })(paymentData);
    }

    /**
     * 更新支付记录
     */
    async updatePayment(id, updateData) {
        // 检查记录是否存在
        const existingPayment = this.findById(id);
        if (!existingPayment) {
            throw new NotFoundError('Payment record');
        }

        // 检查是否有影响月度汇总的字段发生变化（除了notes字段）
        const fieldsAffectingSummary = [
            'payment_date', 'amount_paid', 'currency', 'status',
            'billing_period_start', 'billing_period_end'
        ];

        const hasSignificantChanges = fieldsAffectingSummary.some(field => {
            return updateData[field] !== undefined && updateData[field] !== existingPayment[field];
        });

        return this.db.transaction(() => {
            const result = this.update(id, updateData);

            if (hasSignificantChanges) {
                // 需要更新的月份集合
                const monthsToUpdate = new Set();

                // 如果支付日期发生变化，需要更新原日期和新日期所在的月份
                if (updateData.payment_date && updateData.payment_date !== existingPayment.payment_date) {
                    // 原日期所在月份
                    const [oldYear, oldMonth] = existingPayment.payment_date.slice(0, 7).split('-').map(Number);
                    monthsToUpdate.add(`${oldYear}-${oldMonth}`);

                    // 新日期所在月份
                    const [newYear, newMonth] = updateData.payment_date.slice(0, 7).split('-').map(Number);
                    monthsToUpdate.add(`${newYear}-${newMonth}`);
                } else {
                    // 如果支付日期没有变化，只需要更新当前月份
                    const [year, month] = existingPayment.payment_date.slice(0, 7).split('-').map(Number);
                    monthsToUpdate.add(`${year}-${month}`);
                }

                // 更新所有涉及的月份
                monthsToUpdate.forEach(monthKey => {
                    const [year, month] = monthKey.split('-').map(Number);
                    this.monthlyCategorySummaryService.updateMonthlyCategorySummary(year, month);
                });

                logger.info(`Monthly category summary updated for payment ${id} field changes. Updated months: ${Array.from(monthsToUpdate).join(', ')}`);
            }

            return result;
        })();
    }

    /**
     * 删除支付记录
     */
    async deletePayment(id) {
        // 检查记录是否存在
        const existingPayment = this.findById(id);
        if (!existingPayment) {
            throw new NotFoundError('Payment record');
        }

        return this.db.transaction(() => {
            const result = this.delete(id);

            if (existingPayment.status === 'succeeded') {
                // 获取支付记录的年月信息
                const [year, month] = existingPayment.payment_date.slice(0, 7).split('-').map(Number);

                // 重新计算该月份的汇总数据
                this.monthlyCategorySummaryService.processPaymentDeletion(year, month);
                logger.info(`Monthly category summary updated for deleted payment ${id}`);
            }

            return result;
        })();
    }

    /**
     * 批量创建支付记录
     */
    async bulkCreatePayments(paymentsData) {
        return this.db.transaction((items) => {
            const results = [];
            const monthsToUpdate = new Set();

            for (const paymentData of items) {
                const result = this._createPaymentRecord(paymentData);
                results.push(result);

                if ((paymentData.status || 'succeeded') === 'succeeded') {
                    monthsToUpdate.add(paymentData.payment_date.slice(0, 7));
                }
            }

            for (const monthKey of monthsToUpdate) {
                const [year, month] = monthKey.split('-').map(Number);
                this.monthlyCategorySummaryService.updateMonthlyCategorySummary(year, month);
            }

            return results;
        })(paymentsData);
    }

    /**
     * 重新计算月度分类汇总
     */
    async recalculateMonthlyCategorySummaries() {
        try {
            this.monthlyCategorySummaryService.recalculateAllMonthlyCategorySummaries();
            logger.info('Monthly category summaries recalculated successfully');
        } catch (error) {
            logger.error('Failed to recalculate monthly category summaries:', error.message);
            throw error;
        }
    }

    /**
     * 关闭资源
     */
    close() {
        if (this.monthlyCategorySummaryService) {
            this.monthlyCategorySummaryService.close();
        }
    }
}

module.exports = PaymentHistoryService;
