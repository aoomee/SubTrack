const SubscriptionService = require('../services/subscriptionService');
const { asyncHandler } = require('../middleware/errorHandler');
const { handleQueryResult, handleDbResult, validationError } = require('../utils/responseHelper');
const { validateSubscription, validateSubscriptionWithForeignKeys } = require('../utils/validator');

class SubscriptionController {
    constructor(db) {
        this.db = db;
        this.subscriptionService = new SubscriptionService(db);
    }

    /**
     * 获取所有订阅
     */
    getAllSubscriptions = asyncHandler(async (req, res) => {
        const subscriptions = await this.subscriptionService.getAllSubscriptions();
        handleQueryResult(res, subscriptions, 'Subscriptions');
    });

    /**
     * 根据ID获取单个订阅
     */
    getSubscriptionById = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const subscription = await this.subscriptionService.getSubscriptionById(id);
        handleQueryResult(res, subscription, 'Subscription');
    });

    /**
     * 创建新订阅
     */
    createSubscription = asyncHandler(async (req, res) => {
        const subscriptionData = req.body || {};

        const unknownFields = this.getUnknownSubscriptionFields(subscriptionData);
        if (unknownFields.length > 0) {
            return validationError(res, `Unknown subscription field(s): ${unknownFields.join(', ')}`);
        }

        // 验证数据（包含外键验证）
        const validator = validateSubscriptionWithForeignKeys(subscriptionData, this.db);
        if (validator.hasErrors()) {
            return validationError(res, validator.getErrors());
        }

        const result = await this.subscriptionService.createSubscription(subscriptionData);
        handleDbResult(res, result, 'create', 'Subscription');
    });

    /**
     * 批量创建订阅
     */
    bulkCreateSubscriptions = asyncHandler(async (req, res) => {
        const subscriptionsData = req.body;
        
        if (!Array.isArray(subscriptionsData) || subscriptionsData.length === 0) {
            return validationError(res, 'Request body must be a non-empty array of subscriptions');
        }

        // 验证每个订阅
        for (let i = 0; i < subscriptionsData.length; i++) {
            if (!subscriptionsData[i] || typeof subscriptionsData[i] !== 'object' || Array.isArray(subscriptionsData[i])) {
                return validationError(res, `Subscription ${i + 1}: record must be an object`);
            }
            const unknownFields = this.getUnknownSubscriptionFields(subscriptionsData[i]);
            if (unknownFields.length > 0) {
                return validationError(res, `Subscription ${i + 1}: unknown field(s): ${unknownFields.join(', ')}`);
            }
            const validator = validateSubscriptionWithForeignKeys(subscriptionsData[i], this.db);
            if (validator.hasErrors()) {
                return validationError(res, `Subscription ${i + 1}: ${validator.getErrors().map(e => e.message).join(', ')}`);
            }
        }

        const result = await this.subscriptionService.bulkCreateSubscriptions(subscriptionsData);
        handleDbResult(res, result, 'create', 'Subscriptions');
    });

    /**
     * 更新订阅
     */
    updateSubscription = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updateData = req.body || {};

        if (Object.keys(updateData).length === 0) {
            return validationError(res, 'At least one subscription field is required');
        }

        const unknownFields = this.getUnknownSubscriptionFields(updateData);
        if (unknownFields.length > 0) {
            return validationError(res, `Unknown subscription field(s): ${unknownFields.join(', ')}`);
        }

        // 验证数据（更新时不需要所有字段都必填）
        const validator = validateSubscriptionWithForeignKeys(updateData, this.db);
        // 移除必填验证，因为更新时可能只更新部分字段
        validator.errors = validator.errors.filter(error => !error.message.includes('is required'));

        if (validator.hasErrors()) {
            return validationError(res, validator.getErrors());
        }

        const result = await this.subscriptionService.updateSubscription(id, updateData);
        handleDbResult(res, result, 'update', 'Subscription');
    });

    /**
     * 删除订阅
     */
    deleteSubscription = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const result = await this.subscriptionService.deleteSubscription(id);
        handleDbResult(res, result, 'delete', 'Subscription');
    });

    /**
     * 获取订阅统计信息
     */
    getSubscriptionStats = asyncHandler(async (req, res) => {
        const stats = await this.subscriptionService.getSubscriptionStats();
        handleQueryResult(res, stats, 'Subscription statistics');
    });

    /**
     * 获取即将到期的订阅
     */
    getUpcomingRenewals = asyncHandler(async (req, res) => {
        const { days = 7 } = req.query;
        const upcomingRenewals = await this.subscriptionService.getUpcomingRenewals(parseInt(days));
        handleQueryResult(res, upcomingRenewals, 'Upcoming renewals');
    });

    /**
     * 获取过期的订阅
     */
    getExpiredSubscriptions = asyncHandler(async (req, res) => {
        const expiredSubscriptions = await this.subscriptionService.getExpiredSubscriptions();
        handleQueryResult(res, expiredSubscriptions, 'Expired subscriptions');
    });

    /**
     * 按类别获取订阅
     */
    getSubscriptionsByCategory = asyncHandler(async (req, res) => {
        const { category } = req.params;
        const subscriptions = await this.subscriptionService.getSubscriptionsByCategory(category);
        handleQueryResult(res, subscriptions, 'Subscriptions by category');
    });

    /**
     * 按状态获取订阅
     */
    getSubscriptionsByStatus = asyncHandler(async (req, res) => {
        const { status } = req.params;
        const subscriptions = await this.subscriptionService.getSubscriptionsByStatus(status);
        handleQueryResult(res, subscriptions, 'Subscriptions by status');
    });

    /**
     * 搜索订阅
     */
    searchSubscriptions = asyncHandler(async (req, res) => {
        const { q: query } = req.query;
        if (!query) {
            return validationError(res, 'Search query is required');
        }

        const subscriptions = await this.subscriptionService.searchSubscriptions(query);
        handleQueryResult(res, subscriptions, 'Search results');
    });

    /**
     * 获取订阅的支付历史
     */
    getSubscriptionPaymentHistory = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const paymentHistory = await this.subscriptionService.getSubscriptionPaymentHistory(id);
        handleQueryResult(res, paymentHistory, 'Payment history');
    });

    /**
     * 重置所有订阅数据
     */
    resetAllSubscriptions = asyncHandler(async (req, res) => {
        const result = await this.subscriptionService.resetAllSubscriptions();
        handleQueryResult(res, result, 'Reset result');
    });

    getUnknownSubscriptionFields(data) {
        const allowedFields = new Set([
            'name', 'plan', 'billing_cycle', 'next_billing_date', 'amount',
            'currency', 'payment_method_id', 'start_date', 'status',
            'category_id', 'renewal_type', 'notes', 'website'
        ]);
        return Object.keys(data || {}).filter(key => !allowedFields.has(key));
    }
}

module.exports = SubscriptionController;
