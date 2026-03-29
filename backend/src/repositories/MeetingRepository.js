import { BaseRepository } from './base.js';

export class MeetingRepository extends BaseRepository {
  constructor() { super('meeting'); }

  async findByUser(userId, opts = {}) {
    const { status, from, to, limit = 100 } = opts;
    const where = { userId };
    if (status) where.status = status;
    if (from || to) {
      where.scheduledAt = {};
      if (from) where.scheduledAt.gte = new Date(from);
      if (to)   where.scheduledAt.lte = new Date(to);
    }
    return this.model.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      take: limit,
      include: {
        attendees:  true,
        prepPacket: true,
      },
    });
  }

  async findWithFull(id) {
    return this.model.findUnique({
      where: { id },
      include: { attendees: true, prepPacket: true },
    });
  }
}

export default new MeetingRepository();
