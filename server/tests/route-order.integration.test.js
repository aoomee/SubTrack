const express = require('express');
const request = require('supertest');

jest.mock('../controllers/subscriptionController', () => {
    return class SubscriptionController {
        getAllSubscriptions = (req, res) => res.json({ handler: 'all' });
        getSubscriptionById = (req, res) => res.json({ handler: 'by-id', id: req.params.id });
        getSubscriptionStats = (req, res) => res.json({ handler: 'stats' });
        getUpcomingRenewals = (req, res) => res.json({ handler: 'upcoming' });
        getExpiredSubscriptions = (req, res) => res.json({ handler: 'expired' });
        getSubscriptionsByCategory = (req, res) => res.json({ handler: 'category' });
        getSubscriptionsByStatus = (req, res) => res.json({ handler: 'status' });
        searchSubscriptions = (req, res) => res.json({ handler: 'search', query: req.query.q });
        getSubscriptionPaymentHistory = (req, res) => res.json({ handler: 'payments' });
    };
});

jest.mock('../controllers/exchangeRateController', () => {
    return class ExchangeRateController {
        getAllExchangeRates = (req, res) => res.json({ handler: 'all' });
        getExchangeRate = (req, res) => res.json({ handler: 'pair' });
        getRatesForCurrency = (req, res) => res.json({ handler: 'currency', currency: req.params.currency });
        convertCurrency = (req, res) => res.json({ handler: 'convert' });
        getExchangeRateStats = (req, res) => res.json({ handler: 'stats' });
    };
});

jest.mock('../controllers/paymentHistoryController', () => {
    return class PaymentHistoryController {
        getPaymentHistory = (req, res) => res.json({ handler: 'all' });
        getPaymentById = (req, res) => res.json({ handler: 'by-id', id: req.params.id });
        getMonthlyStats = (req, res) => res.json({ handler: 'monthly-stats' });
        getYearlyStats = (req, res) => res.json({ handler: 'yearly-stats' });
        getQuarterlyStats = (req, res) => res.json({ handler: 'quarterly-stats' });
    };
});

const { createSubscriptionRoutes } = require('../routes/subscriptions');
const { createExchangeRateRoutes } = require('../routes/exchangeRates');
const { createPaymentHistoryRoutes } = require('../routes/paymentHistory');

describe('API route ordering', () => {
    test('dispatches /subscriptions/search to the search handler', async () => {
        const app = express();
        app.use('/subscriptions', createSubscriptionRoutes({}));

        const response = await request(app).get('/subscriptions/search?q=netflix');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ handler: 'search', query: 'netflix' });
    });

    test('dispatches /exchange-rates/currency/:currency to the currency handler', async () => {
        const app = express();
        app.use('/exchange-rates', createExchangeRateRoutes({}));

        const response = await request(app).get('/exchange-rates/currency/USD');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ handler: 'currency', currency: 'USD' });
    });

    test('dispatches fixed payment statistics routes before /:id', async () => {
        const app = express();
        app.use('/payment-history', createPaymentHistoryRoutes({}));

        const response = await request(app).get('/payment-history/stats/monthly');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ handler: 'monthly-stats' });
    });
});
