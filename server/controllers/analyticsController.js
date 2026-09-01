const AnalyticsService = require('../services/analyticsService');
const { asyncHandler } = require('../middleware/errorHandler');
const { handleQueryResult, validationError } = require('../utils/responseHelper');
const { createValidator } = require('../utils/validator');
const { getBaseCurrency } = require('../config/currencies');
const { getMonthDateRange } = require('../utils/dateUtils');

/**
 * 分析控制器
 * 处理分析相关的HTTP请求
 */
class AnalyticsController {
    constructor(db) {
        this.analyticsService = new AnalyticsService(db);
    }

    /**
     * 获取月度收入统计
     */
    getMonthlyRevenue = asyncHandler(async (req, res) => {
        const { start_date, end_date, currency } = req.query;

        // 验证日期格式
        const validator = createValidator();
        
        if (start_date) {
            validator.date(start_date, 'start_date');
        }
        
        if (end_date) {
            validator.date(end_date, 'end_date');
        }

        if (currency) {
            validator
                .string(currency, 'currency')
                .length(currency, 'currency', 3, 3);
        }

        if (validator.hasErrors()) {
            return validationError(res, validator.getErrors());
        }

        // 验证日期逻辑
        if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
            return validationError(res, 'start_date must be before end_date');
        }

        const filters = { start_date, end_date, currency };
        const result = await this.analyticsService.getMonthlyRevenue(filters);
        
        handleQueryResult(res, result, 'Monthly revenue statistics');
    });

    /**
     * 获取月度活跃订阅统计
     */
    getMonthlyActiveSubscriptions = asyncHandler(async (req, res) => {
        const { month, year } = req.query;

        // 验证必需参数
        const validator = createValidator();
        validator
            .required(month, 'month')
            .integer(month, 'month')
            .range(month, 'month', 1, 12)
            .required(year, 'year')
            .integer(year, 'year')
            .range(year, 'year', 2000, 3000);

        if (validator.hasErrors()) {
            return validationError(res, validator.getErrors());
        }

        const result = await this.analyticsService.getMonthlyActiveSubscriptions(
            parseInt(year), 
            parseInt(month)
        );
        
        handleQueryResult(res, result, 'Monthly active subscriptions');
    });

    /**
     * 获取收入趋势分析
     */
    getRevenueTrends = asyncHandler(async (req, res) => {
        const {
            start_date,
            end_date,
            currency = getBaseCurrency(),
            period = 'monthly' // monthly, quarterly, yearly
        } = req.query;

        // 验证参数
        const validator = createValidator();
        
        if (start_date) {
            validator.date(start_date, 'start_date');
        }
        
        if (end_date) {
            validator.date(end_date, 'end_date');
        }

        validator
            .string(currency, 'currency')
            .length(currency, 'currency', 3, 3)
            .enum(period, 'period', ['monthly', 'quarterly', 'yearly']);

        if (validator.hasErrors()) {
            return validationError(res, validator.getErrors());
        }

        // 获取基础数据
        const filters = { start_date, end_date, currency };
        const revenueData = await this.analyticsService.getMonthlyRevenue(filters);

        // 根据周期聚合数据
        const trendsData = this._aggregateRevenueTrends(revenueData.monthlyStats, period);

        const result = {
            period,
            currency,
            trends: trendsData,
            summary: revenueData.summary,
            filters: revenueData.filters
        };

        handleQueryResult(res, result, 'Revenue trends');
    });

    /**
     * 获取订阅分析概览
     */
    getSubscriptionOverview = asyncHandler(async (req, res) => {
        const { year, month } = req.query;

        // 如果没有指定年月，使用当前年月
        const now = new Date();
        const targetYear = year ? parseInt(year) : now.getFullYear();
        const targetMonth = month ? parseInt(month) : now.getMonth() + 1;

        // 验证参数
        const validator = createValidator();
        validator
            .integer(targetYear, 'year')
            .range(targetYear, 'year', 2000, 3000)
            .integer(targetMonth, 'month')
            .range(targetMonth, 'month', 1, 12);

        if (validator.hasErrors()) {
            return validationError(res, validator.getErrors());
        }

        // 获取活跃订阅数据
        const activeSubscriptions = await this.analyticsService.getMonthlyActiveSubscriptions(
            targetYear, 
            targetMonth
        );

        // 获取收入数据
        const { startDate, endDate } = getMonthDateRange(targetYear, targetMonth);
        
        const revenueData = await this.analyticsService.getMonthlyRevenue({
            start_date: startDate,
            end_date: endDate
        });

        const result = {
            period: {
                year: targetYear,
                month: targetMonth,
                monthName: new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' })
            },
            subscriptions: activeSubscriptions,
            revenue: revenueData,
            overview: {
                totalActiveSubscriptions: activeSubscriptions.summary.totalActiveSubscriptions,
                totalRevenue: activeSubscriptions.summary.totalRevenue,
                averageRevenuePerSubscription: activeSubscriptions.summary.totalActiveSubscriptions > 0 
                    ? Math.round((activeSubscriptions.summary.totalRevenue / activeSubscriptions.summary.totalActiveSubscriptions) * 100) / 100 
                    : 0,
                topCategories: this._getTopCategories(activeSubscriptions.summary.byCategory),
                currencyDistribution: activeSubscriptions.summary.byCurrency
            }
        };

        handleQueryResult(res, result, 'Subscription overview');
    });

    /**
     * 聚合收入趋势数据
     * @private
     */
    _aggregateRevenueTrends(monthlyStats, period) {
        if (period === 'monthly') {
            return monthlyStats;
        }

        const aggregated = {};

        monthlyStats.forEach(stat => {
            let key;
            const [year, month] = stat.month.split('-');
            
            if (period === 'quarterly') {
                const quarter = Math.ceil(parseInt(month) / 3);
                key = `${year}-Q${quarter}`;
            } else if (period === 'yearly') {
                key = year;
            }

            if (!aggregated[key]) {
                aggregated[key] = {
                    period: key,
                    currency: stat.currency,
                    totalRevenue: 0,
                    paymentCount: 0,
                    averagePayment: 0
                };
            }

            aggregated[key].totalRevenue += stat.totalRevenue;
            aggregated[key].paymentCount += stat.paymentCount;
        });

        // 计算平均支付金额
        Object.values(aggregated).forEach(item => {
            item.averagePayment = item.paymentCount > 0 
                ? Math.round((item.totalRevenue / item.paymentCount) * 100) / 100 
                : 0;
        });

        return Object.values(aggregated).sort((a, b) => b.period.localeCompare(a.period));
    }

    /**
     * 获取热门分类
     * @private
     */
    _getTopCategories(categoryData, limit = 5) {
        return Object.entries(categoryData)
            .map(([category, data]) => ({
                category,
                count: data.count,
                revenue: data.revenue
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, limit);
    }
}

module.exports = AnalyticsController;
