import { BaseRepository } from './base.js';

export class TaskRepository extends BaseRepository {
  constructor() { super('task'); }

  async findByUser(userId, opts = {}) {
    const { status, dealId, priority, limit = 200, offset = 0 } = opts;
    const where = { userId };
    if (status)  where.status  = status;
    if (dealId)  where.dealId  = dealId;
    if (priority) where.priority = priority;
    return this.model.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    });
  }

  async complete(id) {
    return this.update(id, { status: 'done', completedAt: new Date() });
  }
}

export default new TaskRepository();
