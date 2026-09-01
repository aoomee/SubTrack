const BaseRepository = require('../utils/BaseRepository');
const logger = require('../utils/logger');
const { getMonthDateRange } = require('../utils/dateUtils');

/**
 * 分析服务类
 * 处理收入分析、订阅统计等业务逻辑
 */
class AnalyticsService extends BaseRepository {
    constructor(db) {
        super(db, 'payment_history');
    }

    /**
     * 获取月度收入统计
     * @param {Object} filters - 过滤条件
     * @param {string} filters.start_date - 开始日期
     * @param {string} filters.end_date - 结束日期
     * @param {string} filters.currency - 货币类型
     * @returns {Object} 月度收入统计数据
     */
    async getMonthlyRevenue(filters = {}) {
        const { start_date, end_date, currency } = filters;

        let query = `
            SELECT
                strftime('%Y-%m', payment_date) as month,
                currency,
                SUM(amount_paid) as total_revenue,
                COUNT(id) as payment_count,
                AVG(amount_paid) as average_payment
            FROM payment_history
            WHERE status = 'succeeded'
        `;

        const params = [];

        // 添加日期过滤条件
        if (start_date) {
            query += ' AND payment_date >= ?';
            params.push(start_date);
        }

        if (end_date) {
            query += ' AND payment_date <= ?';
            params.push(end_date);
        }

        // 添加货币过滤条件
        if (currency) {
            query += ' AND currency = ?';
            params.push(currency);
        }

        query += ' GROUP BY strftime(\'%Y-%m\', payment_date), currency ORDER BY month DESC, currency';

        try {
            const stmt = this.db.prepare(query);
            const results = stmt.all(...params);

            // 转换结果格式
            const monthlyStats = this._formatMonthlyStats(results);
            const summary = this._calculateRevenueSummary(results);

            return {
                monthlyStats,
                summary,
                filters: {
                    startDate: start_date || null,
                    endDate: end_date || null,
                    currency: currency || null
                }
            };
        } catch (error) {
            logger.error('Failed to get monthly revenue:', error.message);
            throw error;
        }
    }

    /**
     * 获取月度活跃订阅统计
     * @param {number} year - 年份
     * @param {number} month - 月份
     * @returns {Object} 月度活跃订阅统计数据
     */
    async getMonthlyActiveSubscriptions(year, month) {
        // 验证参数
        this._validateMonthYear(month, year);

        // 格式化月份
        const monthStr = month.toString().padStart(2, '0');
        const targetMonth = `${year}-${monthStr}`;

        // 计算月份的第一天和最后一天
        const { startDate: firstDay, endDate: lastDay } = getMonthDateRange(year, month);

        const query = `
            SELECT DISTINCT
                s.id,
                s.name,
                s.plan,
                s.amount,
                s.currency,
                s.billing_cycle,
                s.status,
                c.value as category,
                COUNT(ph.id) as payment_count_in_month,
                SUM(ph.amount_paid) as total_paid_in_month,
                MIN(ph.billing_period_start) as earliest_period_start,
                MAX(ph.billing_period_end) as latest_period_end
            FROM subscriptions s
            INNER JOIN payment_history ph ON s.id = ph.subscription_id
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE ph.status = 'succeeded'
                AND (
                    -- 支付周期与目标月份重叠
                    (ph.billing_period_start <= ? AND ph.billing_period_end >= ?) OR
                    (ph.billing_period_start <= ? AND ph.billing_period_end >= ?) OR
                    (ph.billing_period_start >= ? AND ph.billing_period_start <= ?)
                )
            GROUP BY s.id, s.name, s.plan, s.amount, s.currency, s.billing_cycle, s.status, c.value
            ORDER BY s.name
        `;

        try {
            const stmt = this.db.prepare(query);
            const activeSubscriptions = stmt.all(
                lastDay, firstDay,  // 周期结束在月初之后且开始在月末之前
                firstDay, lastDay,  // 周期开始在月末之前且结束在月初之后
                firstDay, lastDay   // 周期开始和结束都在月份内
            );

            // 格式化订阅数据
            const formattedSubscriptions = this._formatActiveSubscriptions(activeSubscriptions);
            const summary = this._calculateActiveSubscriptionsSummary(activeSubscriptions);

            return {
                targetMonth,
                period: {
                    start: firstDay,
                    end: lastDay
                },
                activeSubscriptions: formattedSubscriptions,
                summary
            };
        } catch (error) {
            logger.error('Failed to get monthly active subscriptions:', error.message);
            throw error;
        }
    }

    /**
     * 格式化月度统计数据
     * @private
     */
    _formatMonthlyStats(results) {
        return results.map(row => ({
            month: row.month,
            currency: row.currency,
            totalRevenue: parseFloat(row.total_revenue),
            paymentCount: row.payment_count,
            averagePayment: parseFloat(row.average_payment)
        }));
    }

    /**
     * 计算收入汇总统计
     * @private
     */
    _calculateRevenueSummary(results) {
        return {
            totalMonths: new Set(results.map(r => r.month)).size,
            totalRevenue: results.reduce((sum, r) => sum + parseFloat(r.total_revenue), 0),
            totalPayments: results.reduce((sum, r) => sum + r.payment_count, 0),
            currencies: [...new Set(results.map(r => r.currency))]
        };
    }

    /**
     * 格式化活跃订阅数据
     * @private
     */
    _formatActiveSubscriptions(subscriptions) {
        return subscriptions.map(sub => ({
            id: sub.id,
            name: sub.name,
            plan: sub.plan,
            amount: parseFloat(sub.amount),
            currency: sub.currency,
            billingCycle: sub.billing_cycle,
            status: sub.status,
            category: sub.category,
            paymentCountInMonth: sub.payment_count_in_month,
            totalPaidInMonth: parseFloat(sub.total_paid_in_month || 0),
            activePeriod: {
                start: sub.earliest_period_start,
                end: sub.latest_period_end
            }
        }));
    }

    /**
     * 计算活跃订阅汇总统计
     * @private
     */
    _calculateActiveSubscriptionsSummary(subscriptions) {
        const summary = {
            totalActiveSubscriptions: subscriptions.length,
            totalRevenue: 0,
            totalPayments: 0,
            byCategory: {},
            byCurrency: {},
            byBillingCycle: {}
        };

        subscriptions.forEach(sub => {
            const revenue = parseFloat(sub.total_paid_in_month || 0);
            const paymentCount = sub.payment_count_in_month || 0;

            summary.totalRevenue += revenue;
            summary.totalPayments += paymentCount;

            // 按分类统计
            if (!summary.byCategory[sub.category]) {
                summary.byCategory[sub.category] = { count: 0, revenue: 0 };
            }
            summary.byCategory[sub.category].count++;
            summary.byCategory[sub.category].revenue += revenue;

            // 按货币统计
            if (!summary.byCurrency[sub.currency]) {
                summary.byCurrency[sub.currency] = { count: 0, revenue: 0 };
            }
            summary.byCurrency[sub.currency].count++;
            summary.byCurrency[sub.currency].revenue += revenue;

            // 按计费周期统计
            if (!summary.byBillingCycle[sub.billing_cycle]) {
                summary.byBillingCycle[sub.billing_cycle] = { count: 0, revenue: 0 };
            }
            summary.byBillingCycle[sub.billing_cycle].count++;
            summary.byBillingCycle[sub.billing_cycle].revenue += revenue;
        });

        return summary;
    }

    /**
     * 验证月份和年份参数
     * @private
     */
    _validateMonthYear(month, year) {
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);

        if (monthNum < 1 || monthNum > 12) {
            throw new Error('Month must be between 1 and 12');
        }

        if (yearNum < 2000 || yearNum > 3000) {
            throw new Error('Year must be between 2000 and 3000');
        }
    }
}

module.exports = AnalyticsService;
