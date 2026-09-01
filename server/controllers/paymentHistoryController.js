const PaymentHistoryService = require('../services/paymentHistoryService');
const { asyncHandler } = require('../middleware/errorHandler');
const { handleQueryResult, handleDbResult, validationError } = require('../utils/responseHelper');
const { createValidator } = require('../utils/validator');
const { isSupportedCurrency } = require('../config/currencies');

class PaymentHistoryController {
    constructor(db) {
        this.paymentHistoryService = new PaymentHistoryService(db);
    }

    /**
     * 获取支付历史记录列表
     */
    getPaymentHistory = asyncHandler(async (req, res) => {
        const {
            subscription_id,
            start_date,
            end_date,
            status,
            currency,
            limit = 50,
            offset = 0
        } = req.query;

        const filters = {};
        if (subscription_id) filters.subscription_id = subscription_id;
        if (start_date) filters.start_date = start_date;
        if (end_date) filters.end_date = end_date;
        if (status) filters.status = status;
        if (currency) filters.currency = currency;

        const options = {
            limit: parseInt(limit),
            offset: parseInt(offset)
        };

        const result = await this.paymentHistoryService.getPaymentHistory(filters, options);
        handleQueryResult(res, result, 'Payment history');
    });

    /**
     * 根据ID获取单条支付记录
     */
    getPaymentById = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const payment = await this.paymentHistoryService.getPaymentById(id);
        handleQueryResult(res, payment, 'Payment record');
    });

    /**
     * 获取月度支付统计
     */
    getMonthlyStats = asyncHandler(async (req, res) => {
        const { year, month } = req.query;
        
        const validator = createValidator();
        validator
            .required(year, 'year')
            .integer(year, 'year')
            .range(year, 'year', 2000, 3000)
            .required(month, 'month')
            .integer(month, 'month')
            .range(month, 'month', 1, 12);

        if (validator.hasErrors()) {
            return validationError(res, validator.getErrors());
        }

        const stats = await this.paymentHistoryService.getMonthlyStats(parseInt(year), parseInt(month));
        handleQueryResult(res, stats, 'Monthly payment statistics');
    });

    /**
     * 获取年度支付统计
     */
    getYearlyStats = asyncHandler(async (req, res) => {
        const { year } = req.query;
        
        const validator = createValidator();
        validator
            .required(year, 'year')
            .integer(year, 'year')
            .range(year, 'year', 2000, 3000);

        if (validator.hasErrors()) {
            return validationError(res, validator.getErrors());
        }

        const stats = await this.paymentHistoryService.getYearlyStats(parseInt(year));
        handleQueryResult(res, stats, 'Yearly payment statistics');
    });

    /**
     * 获取季度支付统计
     */
    getQuarterlyStats = asyncHandler(async (req, res) => {
        const { year, quarter } = req.query;
        
        const validator = createValidator();
        validator
            .required(year, 'year')
            .integer(year, 'year')
            .range(year, 'year', 2000, 3000)
            .required(quarter, 'quarter')
            .integer(quarter, 'quarter')
            .range(quarter, 'quarter', 1, 4);

        if (validator.hasErrors()) {
            return validationError(res, validator.getErrors());
        }

        const stats = await this.paymentHistoryService.getQuarterlyStats(parseInt(year), parseInt(quarter));
        handleQueryResult(res, stats, 'Quarterly payment statistics');
    });

    /**
     * 创建支付记录
     */
    createPayment = asyncHandler(async (req, res) => {
        const paymentData = req.body || {};

        const unknownFields = this.getUnknownPaymentFields(paymentData);
        if (unknownFields.length > 0) {
            return validationError(res, `Unknown payment field(s): ${unknownFields.join(', ')}`);
        }

        // 转换前端camelCase字段名为数据库snake_case字段名
        const transformedData = this.transformPaymentData(paymentData);

        // 验证数据
        const validator = this.validatePaymentData(transformedData);
        if (validator.hasErrors()) {
            return validationError(res, validator.getErrors());
        }

        const result = await this.paymentHistoryService.createPayment(transformedData);
        handleDbResult(res, result, 'create', 'Payment record');
    });

    /**
     * 更新支付记录
     */
    updatePayment = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updateData = req.body || {};

        if (Object.keys(updateData).length === 0) {
            return validationError(res, 'At least one payment field is required');
        }

        const unknownFields = this.getUnknownPaymentFields(updateData);
        if (unknownFields.length > 0) {
            return validationError(res, `Unknown payment field(s): ${unknownFields.join(', ')}`);
        }

        // 转换前端camelCase字段名为数据库snake_case字段名
        const transformedData = this.transformPaymentData(updateData);

        // 验证数据
        const validator = this.validatePaymentData(transformedData, false);
        if (validator.hasErrors()) {
            return validationError(res, validator.getErrors());
        }

        const result = await this.paymentHistoryService.updatePayment(id, transformedData);
        handleDbResult(res, result, 'update', 'Payment record');
    });

    /**
     * 删除支付记录
     */
    deletePayment = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const result = await this.paymentHistoryService.deletePayment(id);
        handleDbResult(res, result, 'delete', 'Payment record');
    });

    /**
     * 批量创建支付记录
     */
    bulkCreatePayments = asyncHandler(async (req, res) => {
        const paymentsData = req.body;

        if (!Array.isArray(paymentsData) || paymentsData.length === 0) {
            return validationError(res, 'Request body must be a non-empty array of payment records');
        }

        // 转换并验证每条记录
        const transformedPaymentsData = [];
        for (let i = 0; i < paymentsData.length; i++) {
            if (!paymentsData[i] || typeof paymentsData[i] !== 'object' || Array.isArray(paymentsData[i])) {
                return validationError(res, `Record ${i + 1}: payment record must be an object`);
            }
            const unknownFields = this.getUnknownPaymentFields(paymentsData[i]);
            if (unknownFields.length > 0) {
                return validationError(res, `Record ${i + 1}: unknown field(s): ${unknownFields.join(', ')}`);
            }
            const transformedData = this.transformPaymentData(paymentsData[i]);
            const validator = this.validatePaymentData(transformedData);
            if (validator.hasErrors()) {
                return validationError(res, `Record ${i + 1}: ${validator.getErrors().map(e => e.message).join(', ')}`);
            }
            transformedPaymentsData.push(transformedData);
        }

        const result = await this.paymentHistoryService.bulkCreatePayments(transformedPaymentsData);
        handleDbResult(res, result, 'create', 'Payment records');
    });

    /**
     * 重新计算月度费用
     */
    recalculateMonthlyExpenses = asyncHandler(async (req, res) => {
        await this.paymentHistoryService.recalculateMonthlyCategorySummaries();
        handleQueryResult(res, { message: 'Monthly expenses recalculated successfully' }, 'Recalculation result');
    });

    /**
     * 验证支付数据
     */
    validatePaymentData(data, isCreate = true) {
        const validator = createValidator();
        
        if (isCreate) {
            validator
                .required(data.subscription_id, 'subscription_id')
                .required(data.payment_date, 'payment_date')
                .required(data.amount_paid, 'amount_paid')
                .required(data.currency, 'currency')
                .required(data.billing_period_start, 'billing_period_start')
                .required(data.billing_period_end, 'billing_period_end');
        }

        validator
            .integer(data.subscription_id, 'subscription_id')
            .date(data.payment_date, 'payment_date')
            .number(data.amount_paid, 'amount_paid')
            .range(data.amount_paid, 'amount_paid', 0)
            .string(data.currency, 'currency')
            .length(data.currency, 'currency', 3, 3)
            .custom(data.currency, 'currency',
                (value) => isSupportedCurrency(value),
                'Currency is not supported'
            )
            .date(data.billing_period_start, 'billing_period_start')
            .date(data.billing_period_end, 'billing_period_end')
            .enum(data.status, 'status', ['succeeded', 'failed', 'pending', 'refunded'])
            .string(data.notes, 'notes');

        return validator;
    }

    /**
     * 转换前端camelCase字段名为数据库snake_case字段名
     */
    transformPaymentData(data) {
        const transformed = {};

        // 字段名映射表
        const fieldMapping = {
            subscriptionId: 'subscription_id',
            paymentDate: 'payment_date',
            amountPaid: 'amount_paid',
            billingPeriodStart: 'billing_period_start',
            billingPeriodEnd: 'billing_period_end'
        };

        // 转换字段名
        Object.keys(data).forEach(key => {
            const dbFieldName = fieldMapping[key] || key;
            transformed[dbFieldName] = data[key];
        });

        return transformed;
    }

    getUnknownPaymentFields(data) {
        const allowedFields = new Set([
            'subscriptionId', 'subscription_id', 'paymentDate', 'payment_date',
            'amountPaid', 'amount_paid', 'currency',
            'billingPeriodStart', 'billing_period_start',
            'billingPeriodEnd', 'billing_period_end', 'status', 'notes'
        ]);
        return Object.keys(data || {}).filter(key => !allowedFields.has(key));
    }
}

module.exports = PaymentHistoryController;
