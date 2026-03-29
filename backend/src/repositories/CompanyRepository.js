import { BaseRepository } from './base.js';

export class CompanyRepository extends BaseRepository {
  constructor() { super('company'); }

  async findByUser(userId, opts = {}) {
    const { status, search, limit = 100, offset = 0 } = opts;
    const where = { userId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { ownerName: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.model.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { contacts: { take: 3 }, deals: { take: 3, orderBy: { createdAt: 'desc' } } },
    });
  }

  async findWithDeals(id) {
    return this.model.findUnique({
      where: { id },
      include: {
        contacts: true,
        deals:    { orderBy: { createdAt: 'desc' } },
        interactions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
  }

  async touchLastInteraction(id, now) {
    return this.update(id, {
      lastInteractionAt:    now,
      pipelinePressureLevel: 'active',
      daysSinceLastContact: 0,
      updatedAt:            now,
    });
  }
}

export default new CompanyRepository();
