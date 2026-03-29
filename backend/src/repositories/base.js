/**
 * base.js — Base repository class.
 *
 * All Prisma-backed repositories extend this.
 * Provides consistent error handling and logging.
 */
import db from '../../prisma/client.js';

export class BaseRepository {
  /**
   * @param {string} modelName  Prisma model name e.g. 'company', 'deal'
   */
  constructor(modelName) {
    this.modelName = modelName;
    this.db = db;
  }

  get model() {
    return this.db[this.modelName];
  }

  /** Find a single record by ID. Returns null if not found. */
  async findById(id) {
    return this.model.findUnique({ where: { id } });
  }

  /** Find all records matching a where clause. */
  async findMany(where = {}, opts = {}) {
    return this.model.findMany({ where, ...opts });
  }

  /** Create a record. */
  async create(data) {
    return this.model.create({ data });
  }

  /** Update a record by ID. Returns null if not found. */
  async update(id, data) {
    try {
      return await this.model.update({ where: { id }, data });
    } catch (err) {
      if (err.code === 'P2025') return null; // Record not found
      throw err;
    }
  }

  /** Delete a record by ID. Returns null if not found. */
  async delete(id) {
    try {
      return await this.model.delete({ where: { id } });
    } catch (err) {
      if (err.code === 'P2025') return null;
      throw err;
    }
  }

  /** Count records matching a where clause. */
  async count(where = {}) {
    return this.model.count({ where });
  }
}
