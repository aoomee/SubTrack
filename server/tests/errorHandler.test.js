const { errorHandler, ValidationError } = require('../middleware/errorHandler');

describe('errorHandler', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
    });

    const createResponse = () => {
        const res = {};
        res.status = jest.fn(() => res);
        res.json = jest.fn(() => res);
        return res;
    };

    const request = {
        method: 'GET', path: '/test', url: '/test', ip: '127.0.0.1',
        get: jest.fn(() => 'test-agent')
    };

    test('hides unexpected error details in production', () => {
        process.env.NODE_ENV = 'production';
        const res = createResponse();

        errorHandler(new Error('SQL SELECT secret_column failed'), request, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error', status: 500 });
    });

    test('preserves safe validation messages in production', () => {
        process.env.NODE_ENV = 'production';
        const res = createResponse();

        errorHandler(new ValidationError('amount is invalid'), request, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'amount is invalid', status: 400 });
    });
});
