import { BaseRepository } from './base.js';

export class DealRepository extends BaseRepository {
  constructor() { super('deal'); }

  async findByUser(userId, opts = {}) {
    const { stage, search, limit = 100, offset = 0 } = opts;
    const where = { userId };
    if (stage)  where.stage = stage;
    if (search) {
      where.OR = [
        { name:     { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.model.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        company:             { select: { id: true, name: true } },
        underwritingScenarios: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async findWithFull(id) {
    return this.model.findUnique({
      where: { id },
      include: {
        company:              true,
        interactions:         { orderBy: { createdAt: 'desc' }, take: 20 },
        underwritingScenarios: true,
        capitalStack:         true,
        documents:            { orderBy: { createdAt: 'desc' } },
        tasks:                { where: { status: { not: 'archived' } } },
        diligenceItems:       true,
      },
    });
  }

  async updateStage(id, stage, userId) {
    return this.update(id, {
      stage,
      stageChangedAt:   new Date(),
      lastActivityAt:   new Date(),
      daysSinceLastActivity: 0,
    });
  }
}

export default new DealRepository();
