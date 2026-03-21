import { BaseRepository } from './base.js';

export class ContactRepository extends BaseRepository {
  constructor() { super('contact'); }

  async findByUser(userId, opts = {}) {
    const { contactType, companyId, search, limit = 200, offset = 0 } = opts;
    const where = { userId };
    if (contactType) where.contactType = contactType;
    if (companyId)   where.companyId   = companyId;
    if (search) {
      where.OR = [
        { fullName:  { contains: search, mode: 'insensitive' } },
        { email:     { contains: search, mode: 'insensitive' } },
        { title:     { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.model.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { company: { select: { id: true, name: true } } },
    });
  }

  async touchLastInteraction(id, now) {
    return this.update(id, { lastInteractionAt: now, updatedAt: now });
  }
}

export default new ContactRepository();
