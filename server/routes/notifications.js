const express = require('express');
const NotificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');

function createNotificationRoutes(db) {
    const router = express.Router();
    const notificationController = new NotificationController();

    // Public routes
    router.get('/history', notificationController.getNotificationHistory);
    router.get('/stats', notificationController.getNotificationStats);
    
    return router;
}

function createProtectedNotificationRoutes(db) {
    const router = express.Router();
    const notificationController = new NotificationController();

    // 通知设置路由
    router.get('/settings', notificationController.getAllSettings);
    router.get('/settings/:type', notificationController.getSettings);
    router.put('/settings/:id', notificationController.updateSetting);

    // 渠道配置路由
    router.post('/channels', notificationController.configureChannel);
    router.get('/channels/:channelType', notificationController.getChannelConfig);

    // 通知操作路由
    router.post('/send', notificationController.sendNotification);
    router.post('/test', notificationController.testNotification);

    // 历史记录路由
    router.get('/history', notificationController.getNotificationHistory);
    router.post('/history/delete', notificationController.batchDeleteNotificationHistory);
    router.delete('/history/:id', notificationController.deleteNotificationHistoryItem);
    router.delete('/history', notificationController.clearNotificationHistory);

    // 统计路由
    router.get('/stats', notificationController.getNotificationStats);

    // Telegram相关路由
    router.post('/validate-chat-id', notificationController.validateChatId);
    router.get('/telegram/bot-info', notificationController.getBotInfo);
    router.get('/telegram/config-status', notificationController.getTelegramConfigStatus);

    return router;
}

module.exports = { createNotificationRoutes, createProtectedNotificationRoutes };