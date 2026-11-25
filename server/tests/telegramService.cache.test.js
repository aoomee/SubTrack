const TelegramService = require('../services/telegramService');

describe('TelegramService.getBotInfo caching', () => {
    const originalToken = process.env.TELEGRAM_BOT_TOKEN;

    beforeEach(() => {
        process.env.TELEGRAM_BOT_TOKEN = '123456:test-token';
        TelegramService.clearBotInfoCache();
    });

    afterAll(() => {
        TelegramService.clearBotInfoCache();
        if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
        else process.env.TELEGRAM_BOT_TOKEN = originalToken;
    });

    test('reuses cached bot info across repeated calls and separate instances', async () => {
        const svc1 = new TelegramService();
        const svc2 = new TelegramService();
        const get1 = jest.spyOn(svc1.client, 'get').mockResolvedValue({
            data: { result: { id: 1, first_name: 'Soro Bot', username: 'Soro233Bot' } }
        });
        const get2 = jest.spyOn(svc2.client, 'get');

        const first = await svc1.getBotInfo();
        const second = await svc2.getBotInfo();

        expect(first).toEqual({
            success: true,
            botInfo: { id: 1, first_name: 'Soro Bot', username: 'Soro233Bot' }
        });
        expect(second).toEqual(first);
        expect(get1).toHaveBeenCalledTimes(1);
        expect(get2).not.toHaveBeenCalled();
    });

    test('deduplicates concurrent in-flight bot info requests', async () => {
        const svc = new TelegramService();
        let resolveRequest;
        const getSpy = jest.spyOn(svc.client, 'get').mockReturnValue(
            new Promise((resolve) => {
                resolveRequest = resolve;
            })
        );

        const p1 = svc.getBotInfo();
        const p2 = svc.getBotInfo();
        resolveRequest({ data: { result: { id: 2, first_name: 'Demo', username: 'DemoBot' } } });

        const [r1, r2] = await Promise.all([p1, p2]);
        expect(r1).toEqual(r2);
        expect(getSpy).toHaveBeenCalledTimes(1);
    });

    test('does not cache failed bot lookups so retries can recover', async () => {
        const svc = new TelegramService();
        const getSpy = jest.spyOn(svc.client, 'get')
            .mockRejectedValueOnce(new Error('network timeout'))
            .mockResolvedValueOnce({
                data: { result: { id: 3, first_name: 'Recovered', username: 'RecoveredBot' } }
            });

        const failed = await svc.getBotInfo();
        expect(failed.success).toBe(false);

        const recovered = await svc.getBotInfo();
        expect(recovered.success).toBe(true);
        expect(recovered.botInfo.username).toBe('RecoveredBot');
        expect(getSpy).toHaveBeenCalledTimes(2);
    });
});
