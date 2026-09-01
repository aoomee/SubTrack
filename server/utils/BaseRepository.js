const logger = require('./logger');

/**
 * 通用数据库操作基类
 * 提供标准的 CRUD 操作和错误处理
 */
class BaseRepository {
    constructor(db, tableName) {
        this.db = db;
        this.tableName = this._identifier(tableName);
    }

    _identifier(value) {
        if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
            throw new Error(`Invalid SQL identifier: ${String(value)}`);
        }
        return value;
    }

    _identifiers(values) {
        return values.map(value => this._identifier(value));
    }

    _orderBy(value) {
        return value.split(',').map(part => {
            const match = part.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s+(ASC|DESC))?$/i);
            if (!match) throw new Error(`Invalid ORDER BY clause: ${value}`);
            return `${this._identifier(match[1])}${match[2] ? ` ${match[2].toUpperCase()}` : ''}`;
        }).join(', ');
    }

    /**
     * 查询所有记录
     * @param {Object} options - 查询选项
     * @param {Object} options.filters - 过滤条件
     * @param {string} options.orderBy - 排序字段
     * @param {number} options.limit - 限制数量
     * @param {number} options.offset - 偏移量
     * @returns {Array} 查询结果
     */
    findAll(options = {}) {
        const { filters = {}, orderBy, limit, offset } = options;
        
        let query = `SELECT * FROM ${this.tableName}`;
        const params = [];
        
        // 构建 WHERE 条件
        const whereConditions = [];
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                whereConditions.push(`${this._identifier(key)} = ?`);
                params.push(value);
            }
        });
        
        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        
        // 添加排序
        if (orderBy) {
            query += ` ORDER BY ${this._orderBy(orderBy)}`;
        }
        
        // 添加分页
        if (limit) {
            query += ` LIMIT ?`;
            params.push(limit);
            
            if (offset) {
                query += ` OFFSET ?`;
                params.push(offset);
            }
        }
        
        const stmt = this.db.prepare(query);
        return stmt.all(...params);
    }

    /**
     * 根据ID查询单条记录
     * @param {number|string} id - 记录ID
     * @param {string} idField - ID字段名，默认为 'id'
     * @returns {Object|null} 查询结果
     */
    findById(id, idField = 'id') {
        const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${this._identifier(idField)} = ?`);
        return stmt.get(id);
    }

    /**
     * 根据条件查询单条记录
     * @param {Object} filters - 过滤条件
     * @returns {Object|null} 查询结果
     */
    findOne(filters = {}) {
        let query = `SELECT * FROM ${this.tableName}`;
        const params = [];
        
        const whereConditions = [];
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                whereConditions.push(`${this._identifier(key)} = ?`);
                params.push(value);
            }
        });
        
        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        
        query += ' LIMIT 1';
        
        const stmt = this.db.prepare(query);
        return stmt.get(...params);
    }

    /**
     * 创建新记录
     * @param {Object} data - 要插入的数据
     * @returns {Object} 插入结果，包含 lastInsertRowid
     */
    create(data) {
        const fields = this._identifiers(Object.keys(data));
        if (fields.length === 0) throw new Error('Create data cannot be empty');
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const query = `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
        const stmt = this.db.prepare(query);
        
        return stmt.run(...values);
    }

    /**
     * 批量创建记录
     * @param {Array} dataArray - 要插入的数据数组
     * @returns {Array} 插入结果数组
     */
    createMany(dataArray) {
        if (!Array.isArray(dataArray) || dataArray.length === 0) {
            return [];
        }
        
        const fields = this._identifiers(Object.keys(dataArray[0]));
        const placeholders = fields.map(() => '?').join(', ');
        const query = `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
        
        const stmt = this.db.prepare(query);
        const transaction = this.db.transaction((items) => {
            const results = [];
            for (const item of items) {
                const values = fields.map(field => item[field]);
                results.push(stmt.run(...values));
            }
            return results;
        });
        
        return transaction(dataArray);
    }

    /**
     * 更新记录
     * @param {number|string} id - 记录ID
     * @param {Object} data - 要更新的数据
     * @param {string} idField - ID字段名，默认为 'id'
     * @returns {Object} 更新结果
     */
    update(id, data, idField = 'id') {
        const fields = this._identifiers(Object.keys(data));
        if (fields.length === 0) throw new Error('Update data cannot be empty');
        const values = Object.values(data);
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        
        const query = `UPDATE ${this.tableName} SET ${setClause} WHERE ${this._identifier(idField)} = ?`;
        const stmt = this.db.prepare(query);
        
        return stmt.run(...values, id);
    }

    /**
     * 根据条件更新记录
     * @param {Object} filters - 过滤条件
     * @param {Object} data - 要更新的数据
     * @returns {Object} 更新结果
     */
    updateWhere(filters, data) {
        const updateFields = this._identifiers(Object.keys(data));
        if (updateFields.length === 0) throw new Error('Update data cannot be empty');
        const updateValues = Object.values(data);
        const setClause = updateFields.map(field => `${field} = ?`).join(', ');
        
        const whereConditions = [];
        const whereValues = [];
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                whereConditions.push(`${this._identifier(key)} = ?`);
                whereValues.push(value);
            }
        });
        
        if (whereConditions.length === 0) {
            throw new Error('Update without WHERE conditions is not allowed');
        }
        
        const query = `UPDATE ${this.tableName} SET ${setClause} WHERE ${whereConditions.join(' AND ')}`;
        const stmt = this.db.prepare(query);
        
        return stmt.run(...updateValues, ...whereValues);
    }

    /**
     * 删除记录
     * @param {number|string} id - 记录ID
     * @param {string} idField - ID字段名，默认为 'id'
     * @returns {Object} 删除结果
     */
    delete(id, idField = 'id') {
        const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE ${this._identifier(idField)} = ?`);
        return stmt.run(id);
    }

    /**
     * 根据条件删除记录
     * @param {Object} filters - 过滤条件
     * @returns {Object} 删除结果
     */
    deleteWhere(filters) {
        const whereConditions = [];
        const whereValues = [];
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                whereConditions.push(`${this._identifier(key)} = ?`);
                whereValues.push(value);
            }
        });
        
        if (whereConditions.length === 0) {
            throw new Error('Delete without WHERE conditions is not allowed');
        }
        
        const query = `DELETE FROM ${this.tableName} WHERE ${whereConditions.join(' AND ')}`;
        const stmt = this.db.prepare(query);
        
        return stmt.run(...whereValues);
    }

    /**
     * 统计记录数量
     * @param {Object} filters - 过滤条件
     * @returns {number} 记录数量
     */
    count(filters = {}) {
        let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
        const params = [];
        
        const whereConditions = [];
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                whereConditions.push(`${this._identifier(key)} = ?`);
                params.push(value);
            }
        });
        
        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        
        const stmt = this.db.prepare(query);
        const result = stmt.get(...params);
        return result.count;
    }

    /**
     * 检查记录是否存在
     * @param {Object} filters - 过滤条件
     * @returns {boolean} 是否存在
     */
    exists(filters) {
        return this.count(filters) > 0;
    }

    /**
     * 执行事务
     * @param {Function} callback - 事务回调函数
     * @returns {*} 事务结果
     */
    transaction(callback) {
        const transaction = this.db.transaction(callback);
        return transaction();
    }
}

module.exports = BaseRepository;
