const BaseRepository = require('../utils/BaseRepository');

describe('BaseRepository SQL identifier validation', () => {
    const db = { prepare: jest.fn() };

    test('rejects unsafe table, field and order identifiers before preparing SQL', () => {
        expect(() => new BaseRepository(db, 'users; DROP TABLE users')).toThrow('Invalid SQL identifier');

        const repository = new BaseRepository(db, 'users');
        expect(() => repository.update(1, { 'name = NULL; DROP TABLE users': 'x' })).toThrow('Invalid SQL identifier');
        expect(() => repository.findAll({ orderBy: 'name; DROP TABLE users' })).toThrow('Invalid ORDER BY clause');
        expect(db.prepare).not.toHaveBeenCalled();
    });
});
