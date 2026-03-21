/**
 * repo.js — Prisma-backed data repository
 *
 * This is the single source of truth layer between routes and the database.
 * All writes go to PostgreSQL. The in-memory `store` is used as a write-through
 * cache only (for reads that don't yet have a DB route wired up).
 *
 * When DATABASE_URL is not set, all operations transparently fall back to the
 * in-memory store so the app runs in development without a database.
 */

import db from './client.js';

const HAS_DB = !!process.env.DATABASE_URL;

// ─── System user resolution ───────────────────────────────────────────────────

let _systemUserId = null;

export async function getSystemUserId() {
  if (_systemUserId) return _systemUserId;
  if (!HAS_DB) return 'system';

  const userId = process.env.SYSTEM_USER_ID;
  if (userId) {
    _systemUserId = userId;
    return userId;
  }

  // Auto-bootstrap: create or fetch the default system user
  const existing = await db.user.findFirst({ where: { email: 'marco@dominionedgeholdings.com' } });
  if (existing) {
    _systemUserId = existing.id;
    process.env.SYSTEM_USER_ID = existing.id;
    return existing.id;
  }

  const created = await db.user.create({
    data: {
      email:    'marco@dominionedgeholdings.com',
      name:     'Marco Fernstaedt',
      role:     'owner',
    },
  });
  _systemUserId = created.id;
  process.env.SYSTEM_USER_ID = created.id;
  console.log(`[repo] System user created: ${created.id}`);
  return created.id;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIso(v) {
  if (!v) return undefined;
  if (v instanceof Date) return v.toISOString();
  return v;
}

function dbCompanyToStore(c) {
  if (!c) return null;
  return {
    id:                    c.id,
    name:                  c.name,
    industry:              c.industry ?? '',
    status:                _mapCompanyStatusFromDb(c.status),
    website:               c.website ?? '',
    phone:                 c.phone ?? '',
    email:                 c.email ?? '',
    address:               c.address ?? '',
    city:                  c.city ?? '',
    state:                 c.state ?? '',
    zip:                   c.zip ?? '',
    estimatedRevenue:      c.estimatedRevenue ?? undefined,
    estimatedEBITDA:       c.estimatedEBITDA ?? undefined,
    estimatedSDE:          c.estimatedSDE ?? undefined,
    employeeCount:         c.employeeCount ?? undefined,
    foundedYear:           c.foundedYear ?? undefined,
    description:           c.description ?? '',
    notes:                 c.notes ?? '',
    sellerSignalScore:     c.sellerSignalScore ?? 0,
    retirementSignal:      c.retirementSignal ?? false,
    noWebsiteSignal:       c.noWebsiteSignal ?? false,
    reviewDeclineSignal:   c.reviewDeclineSignal ?? false,
    websiteOutdatedSignal: c.websiteOutdatedSignal ?? false,
    hiringSlowdownSignal:  c.hiringSlowdownSignal ?? false,
    linkedinInactiveSignal:c.linkedinInactiveSignal ?? false,
    pipelinePressureLevel: c.pipelinePressureLevel ?? 'none',
    lastInteractionAt:     toIso(c.lastInteractionAt),
    daysSinceLastInteraction: c.daysSinceLastInteraction ?? undefined,
    createdAt:             toIso(c.createdAt),
    updatedAt:             toIso(c.updatedAt),
    tags:                  c.tags ?? [],
    source:                c.source ?? '',
    ownerId:               c.ownerId ?? '',
    ownerName:             c.ownerName ?? '',
    ownerEmail:            c.ownerEmail ?? '',
    ownerPhone:            c.ownerPhone ?? '',
  };
}

// Map Prisma CompanyStatus enum values ↔ frontend types.ts values
const STATUS_TO_DB = {
  target:          'prospect',
  contacted:       'active',
  conversation:    'active',
  interested:      'active',
  diligence:       'diligence',
  under_loi:       'under_loi',
  under_contract:  'under_loi',
  closed:          'closed_won',
  lost:            'closed_lost',
  archived:        'on_hold',
  // pass-through DB values
  prospect:        'prospect',
  active:          'active',
  loi_sent:        'loi_sent',
  closed_won:      'closed_won',
  closed_lost:     'closed_lost',
  on_hold:         'on_hold',
};

const STATUS_FROM_DB = {
  prospect:    'target',
  active:      'contacted',
  diligence:   'diligence',
  loi_sent:    'under_loi',
  under_loi:   'under_loi',
  closed_won:  'closed',
  closed_lost: 'lost',
  on_hold:     'archived',
};

function _mapCompanyStatusToDB(status) {
  return STATUS_TO_DB[status] ?? 'prospect';
}

function _mapCompanyStatusFromDb(status) {
  return STATUS_FROM_DB[status] ?? status;
}

function dbDealToStore(d) {
  if (!d) return null;
  return {
    id:                 d.id,
    companyId:          d.companyId ?? '',
    companyName:        d.companyName ?? '',
    stage:              d.stage ?? 'identified',
    status:             d.status ?? 'active',
    dealType:           d.dealType ?? 'platform',
    estimatedRevenue:   d.estimatedRevenue ?? undefined,
    estimatedEBITDA:    d.estimatedEBITDA ?? undefined,
    estimatedSDE:       d.estimatedSDE ?? undefined,
    askingPrice:        d.askingPrice ?? undefined,
    offerPrice:         d.offerPrice ?? undefined,
    closedPrice:        d.closedPrice ?? undefined,
    name:               d.name ?? d.companyName ?? '',
    notes:              d.notes ?? '',
    nextAction:         d.nextAction ?? '',
    nextActionDue:      toIso(d.nextActionDue),
    priority:           d.priority ?? 'medium',
    probability:        d.probability ?? undefined,
    lostReason:         d.lostReason ?? '',
    createdAt:          toIso(d.createdAt),
    updatedAt:          toIso(d.updatedAt),
  };
}

function dbContactToStore(c) {
  if (!c) return null;
  return {
    id:                c.id,
    firstName:         c.firstName ?? '',
    lastName:          c.lastName ?? '',
    name:              `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
    email:             c.email ?? '',
    phone:             c.phone ?? '',
    title:             c.title ?? '',
    company:           c.company ?? '',
    companyId:         c.companyId ?? undefined,
    contactType:       c.contactType ?? 'networking_contact',
    status:            c.status ?? 'active',
    relationshipStage: c.relationshipStage ?? 'cold',
    warmth:            c.warmth ?? 'cold',
    notes:             c.notes ?? '',
    linkedInUrl:       c.linkedInUrl ?? '',
    lastInteractionAt: toIso(c.lastInteractionAt),
    pipelinePressureLevel: c.pipelinePressureLevel ?? 'none',
    daysSinceLastInteraction: c.daysSinceLastInteraction ?? undefined,
    createdAt:         toIso(c.createdAt),
    updatedAt:         toIso(c.updatedAt),
    tags:              c.tags ?? [],
  };
}

function dbTaskToStore(t) {
  if (!t) return null;
  return {
    id:          t.id,
    title:       t.title ?? '',
    description: t.description ?? '',
    status:      t.status ?? 'todo',
    priority:    t.priority ?? 'medium',
    dueDate:     toIso(t.dueDate),
    completedAt: toIso(t.completedAt),
    companyId:   t.companyId ?? undefined,
    dealId:      t.dealId ?? undefined,
    contactId:   t.contactId ?? undefined,
    category:    t.category ?? '',
    tags:        t.tags ?? [],
    createdAt:   toIso(t.createdAt),
    updatedAt:   toIso(t.updatedAt),
  };
}

function dbInteractionToStore(i) {
  if (!i) return null;
  return {
    id:              i.id,
    companyId:       i.companyId ?? undefined,
    contactId:       i.contactId ?? undefined,
    dealId:          i.dealId ?? undefined,
    interactionType: i.interactionType ?? 'note',
    direction:       i.direction ?? 'outbound',
    subject:         i.subject ?? '',
    body:            i.body ?? '',
    summary:         i.summary ?? '',
    outcome:         i.outcome ?? '',
    sentiment:       i.sentiment ?? '',
    nextSteps:       i.nextSteps ?? '',
    isAiGenerated:   i.isAiGenerated ?? false,
    createdAt:       toIso(i.createdAt),
    updatedAt:       toIso(i.updatedAt),
  };
}

// ─── Companies ────────────────────────────────────────────────────────────────

export const companies = {
  async list({ search, status, industry, limit = 200, offset = 0 } = {}, store) {
    if (!HAS_DB) return _filterStore(store.companies, { search, status, industry }, limit, offset);

    const userId = await getSystemUserId();
    const where = { userId };
    if (status) where.status = _mapCompanyStatusToDB(status);
    if (industry) where.industry = { contains: industry, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { name:       { contains: search, mode: 'insensitive' } },
        { industry:   { contains: search, mode: 'insensitive' } },
        { ownerName:  { contains: search, mode: 'insensitive' } },
        { city:       { contains: search, mode: 'insensitive' } },
      ];
    }

    const rows = await db.company.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit,
    });
    return rows.map(dbCompanyToStore);
  },

  async get(id, store) {
    if (!HAS_DB) return store.companies.find((c) => c.id === id) ?? null;
    const row = await db.company.findUnique({ where: { id } });
    return dbCompanyToStore(row);
  },

  async create(data, store) {
    if (!HAS_DB) {
      store.companies.push(data);
      return data;
    }
    const userId = await getSystemUserId();
    const row = await db.company.create({
      data: {
        id:                    data.id,
        userId,
        name:                  data.name,
        industry:              data.industry ?? '',
        status:                _mapCompanyStatusToDB(data.status ?? 'target'),
        website:               data.website ?? '',
        phone:                 data.phone ?? '',
        email:                 data.email ?? '',
        address:               data.address ?? '',
        city:                  data.city ?? '',
        state:                 data.state ?? '',
        zip:                   data.zip ?? '',
        estimatedRevenue:      data.estimatedRevenue ?? null,
        estimatedEBITDA:       data.estimatedEBITDA ?? null,
        estimatedSDE:          data.estimatedSDE ?? null,
        employeeCount:         data.employeeCount ?? null,
        foundedYear:           data.foundedYear ?? null,
        description:           data.description ?? '',
        notes:                 data.notes ?? '',
        sellerSignalScore:     data.sellerSignalScore ?? 0,
        retirementSignal:      data.retirementSignal ?? false,
        noWebsiteSignal:       data.noWebsiteSignal ?? false,
        reviewDeclineSignal:   data.reviewDeclineSignal ?? false,
        websiteOutdatedSignal: data.websiteOutdatedSignal ?? false,
        hiringSlowdownSignal:  data.hiringSlowdownSignal ?? false,
        linkedinInactiveSignal:data.linkedinInactiveSignal ?? false,
        source:                data.source ?? '',
        ownerId:               data.ownerId ?? '',
        ownerName:             data.ownerName ?? '',
        ownerEmail:            data.ownerEmail ?? '',
        ownerPhone:            data.ownerPhone ?? '',
        tags:                  data.tags ?? [],
      },
    });
    const mapped = dbCompanyToStore(row);
    // Keep in-memory store in sync
    store.companies.push(mapped);
    return mapped;
  },

  async update(id, updates, store) {
    if (!HAS_DB) {
      const idx = store.companies.findIndex((c) => c.id === id);
      if (idx !== -1) {
        store.companies[idx] = { ...store.companies[idx], ...updates, updatedAt: new Date().toISOString() };
        return store.companies[idx];
      }
      return null;
    }
    const dbUpdates = { ...updates };
    if (updates.status) dbUpdates.status = _mapCompanyStatusToDB(updates.status);

    const row = await db.company.update({
      where: { id },
      data: { ...dbUpdates, updatedAt: new Date() },
    });
    const mapped = dbCompanyToStore(row);
    // Sync store
    const idx = store.companies.findIndex((c) => c.id === id);
    if (idx !== -1) store.companies[idx] = mapped;
    return mapped;
  },

  async delete(id, store) {
    if (!HAS_DB) {
      store.companies = store.companies.filter((c) => c.id !== id);
      return;
    }
    await db.company.delete({ where: { id } });
    store.companies = store.companies.filter((c) => c.id !== id);
  },
};

// ─── Contacts ─────────────────────────────────────────────────────────────────

export const contacts = {
  async list({ search, companyId, contactType, limit = 200, offset = 0 } = {}, store) {
    if (!HAS_DB) return _filterContacts(store.contacts, { search, companyId, contactType }, limit, offset);

    const userId = await getSystemUserId();
    const where = { userId };
    if (companyId) where.companyId = companyId;
    if (contactType) where.contactType = contactType;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
        { email:     { contains: search, mode: 'insensitive' } },
        { company:   { contains: search, mode: 'insensitive' } },
      ];
    }

    const rows = await db.contact.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: offset, take: limit });
    return rows.map(dbContactToStore);
  },

  async get(id, store) {
    if (!HAS_DB) return store.contacts.find((c) => c.id === id) ?? null;
    const row = await db.contact.findUnique({ where: { id } });
    return dbContactToStore(row);
  },

  async create(data, store) {
    if (!HAS_DB) {
      store.contacts.push(data);
      return data;
    }
    const userId = await getSystemUserId();
    const [firstName, ...rest] = (data.name ?? '').split(' ');
    const lastName = data.lastName ?? rest.join(' ') ?? '';

    const row = await db.contact.create({
      data: {
        id:                userId !== data.id ? data.id : undefined,
        userId,
        firstName:         data.firstName ?? firstName ?? '',
        lastName:          data.lastName ?? lastName ?? '',
        email:             data.email ?? '',
        phone:             data.phone ?? '',
        title:             data.title ?? '',
        company:           data.company ?? '',
        companyId:         data.companyId ?? null,
        contactType:       data.contactType ?? 'networking_contact',
        status:            data.status ?? 'active',
        relationshipStage: data.relationshipStage ?? 'cold',
        warmth:            data.warmth ?? 'cold',
        notes:             data.notes ?? '',
        linkedInUrl:       data.linkedInUrl ?? '',
        tags:              data.tags ?? [],
      },
    });
    const mapped = dbContactToStore(row);
    store.contacts.push(mapped);
    return mapped;
  },

  async update(id, updates, store) {
    if (!HAS_DB) {
      const idx = store.contacts.findIndex((c) => c.id === id);
      if (idx !== -1) {
        store.contacts[idx] = { ...store.contacts[idx], ...updates, updatedAt: new Date().toISOString() };
        return store.contacts[idx];
      }
      return null;
    }
    const row = await db.contact.update({
      where: { id },
      data: { ...updates, updatedAt: new Date() },
    });
    const mapped = dbContactToStore(row);
    const idx = store.contacts.findIndex((c) => c.id === id);
    if (idx !== -1) store.contacts[idx] = mapped;
    return mapped;
  },

  async delete(id, store) {
    if (!HAS_DB) {
      store.contacts = store.contacts.filter((c) => c.id !== id);
      return;
    }
    await db.contact.delete({ where: { id } });
    store.contacts = store.contacts.filter((c) => c.id !== id);
  },
};

// ─── Deals ────────────────────────────────────────────────────────────────────

export const deals = {
  async list({ status, stage, companyId, limit = 200, offset = 0 } = {}, store) {
    if (!HAS_DB) return _filterDeals(store.deals, { status, stage, companyId }, limit, offset);

    const userId = await getSystemUserId();
    const where = { userId };
    if (status) where.status = status;
    if (stage)  where.stage  = stage;
    if (companyId) where.companyId = companyId;

    const rows = await db.deal.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: offset, take: limit });
    return rows.map(dbDealToStore);
  },

  async get(id, store) {
    if (!HAS_DB) return store.deals.find((d) => d.id === id) ?? null;
    const row = await db.deal.findUnique({ where: { id } });
    return dbDealToStore(row);
  },

  async create(data, store) {
    if (!HAS_DB) {
      store.deals.push(data);
      return data;
    }
    const userId = await getSystemUserId();
    const row = await db.deal.create({
      data: {
        id:               data.id,
        userId,
        companyId:        data.companyId ?? null,
        companyName:      data.companyName ?? '',
        name:             data.name ?? data.companyName ?? '',
        stage:            data.stage ?? 'identified',
        status:           data.status ?? 'active',
        dealType:         data.dealType ?? 'platform',
        estimatedRevenue: data.estimatedRevenue ?? null,
        estimatedEBITDA:  data.estimatedEBITDA ?? null,
        estimatedSDE:     data.estimatedSDE ?? null,
        askingPrice:      data.askingPrice ?? null,
        offerPrice:       data.offerPrice ?? null,
        notes:            data.notes ?? '',
        nextAction:       data.nextAction ?? '',
        priority:         data.priority ?? 'medium',
        probability:      data.probability ?? null,
      },
    });
    const mapped = dbDealToStore(row);
    store.deals.push(mapped);
    return mapped;
  },

  async update(id, updates, store) {
    if (!HAS_DB) {
      const idx = store.deals.findIndex((d) => d.id === id);
      if (idx !== -1) {
        store.deals[idx] = { ...store.deals[idx], ...updates, updatedAt: new Date().toISOString() };
        return store.deals[idx];
      }
      return null;
    }
    const row = await db.deal.update({
      where: { id },
      data: { ...updates, updatedAt: new Date() },
    });
    const mapped = dbDealToStore(row);
    const idx = store.deals.findIndex((d) => d.id === id);
    if (idx !== -1) store.deals[idx] = mapped;
    return mapped;
  },

  async delete(id, store) {
    if (!HAS_DB) {
      store.deals = store.deals.filter((d) => d.id !== id);
      return;
    }
    await db.deal.delete({ where: { id } });
    store.deals = store.deals.filter((d) => d.id !== id);
  },
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasks = {
  async list({ status, priority, companyId, dealId, limit = 200, offset = 0 } = {}, store) {
    if (!HAS_DB) return _filterTasks(store.tasks, { status, priority, companyId, dealId }, limit, offset);

    const userId = await getSystemUserId();
    const where = { userId };
    if (status)    where.status    = status;
    if (priority)  where.priority  = priority;
    if (companyId) where.companyId = companyId;
    if (dealId)    where.dealId    = dealId;

    const rows = await db.task.findMany({ where, orderBy: { createdAt: 'desc' }, skip: offset, take: limit });
    return rows.map(dbTaskToStore);
  },

  async get(id, store) {
    if (!HAS_DB) return store.tasks.find((t) => t.id === id) ?? null;
    const row = await db.task.findUnique({ where: { id } });
    return dbTaskToStore(row);
  },

  async create(data, store) {
    if (!HAS_DB) {
      store.tasks.push(data);
      return data;
    }
    const userId = await getSystemUserId();
    const row = await db.task.create({
      data: {
        id:          data.id,
        userId,
        title:       data.title,
        description: data.description ?? '',
        status:      data.status ?? 'todo',
        priority:    data.priority ?? 'medium',
        dueDate:     data.dueDate ? new Date(data.dueDate) : null,
        companyId:   data.companyId ?? null,
        dealId:      data.dealId ?? null,
        contactId:   data.contactId ?? null,
        category:    data.category ?? '',
        tags:        data.tags ?? [],
      },
    });
    const mapped = dbTaskToStore(row);
    store.tasks.push(mapped);
    return mapped;
  },

  async update(id, updates, store) {
    if (!HAS_DB) {
      const idx = store.tasks.findIndex((t) => t.id === id);
      if (idx !== -1) {
        store.tasks[idx] = { ...store.tasks[idx], ...updates, updatedAt: new Date().toISOString() };
        return store.tasks[idx];
      }
      return null;
    }
    const dbUpdates = { ...updates, updatedAt: new Date() };
    if (updates.dueDate) dbUpdates.dueDate = new Date(updates.dueDate);
    if (updates.completedAt) dbUpdates.completedAt = new Date(updates.completedAt);

    const row = await db.task.update({ where: { id }, data: dbUpdates });
    const mapped = dbTaskToStore(row);
    const idx = store.tasks.findIndex((t) => t.id === id);
    if (idx !== -1) store.tasks[idx] = mapped;
    return mapped;
  },

  async delete(id, store) {
    if (!HAS_DB) {
      store.tasks = store.tasks.filter((t) => t.id !== id);
      return;
    }
    await db.task.delete({ where: { id } });
    store.tasks = store.tasks.filter((t) => t.id !== id);
  },
};

// ─── Interactions ─────────────────────────────────────────────────────────────

export const interactions = {
  async list({ companyId, contactId, dealId, interactionType, limit = 200, offset = 0 } = {}, store) {
    if (!HAS_DB) return _filterInteractions(store.interactions, { companyId, contactId, dealId, interactionType }, limit, offset);

    const userId = await getSystemUserId();
    const where = { userId };
    if (companyId)       where.companyId       = companyId;
    if (contactId)       where.contactId       = contactId;
    if (dealId)          where.dealId          = dealId;
    if (interactionType) where.interactionType = interactionType;

    const rows = await db.interaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip: offset, take: limit });
    return rows.map(dbInteractionToStore);
  },

  async create(data, store) {
    if (!HAS_DB) {
      store.interactions.push(data);
      return data;
    }
    const userId = await getSystemUserId();
    const row = await db.interaction.create({
      data: {
        id:              data.id,
        userId,
        companyId:       data.companyId ?? null,
        contactId:       data.contactId ?? null,
        dealId:          data.dealId ?? null,
        interactionType: data.interactionType ?? 'note',
        direction:       data.direction ?? 'outbound',
        subject:         data.subject ?? '',
        body:            data.body ?? '',
        summary:         data.summary ?? '',
        outcome:         data.outcome ?? '',
        sentiment:       data.sentiment ?? '',
        nextSteps:       data.nextSteps ?? '',
        isAiGenerated:   data.isAiGenerated ?? false,
      },
    });
    const mapped = dbInteractionToStore(row);
    store.interactions.push(mapped);
    return mapped;
  },
};

// ─── In-memory fallback filter helpers ───────────────────────────────────────

function _filterStore(arr, { search, status, industry }, limit, offset) {
  let result = arr;
  if (status)   result = result.filter((c) => c.status === status);
  if (industry) result = result.filter((c) => (c.industry ?? '').toLowerCase().includes(industry.toLowerCase()));
  if (search) {
    const q = search.toLowerCase();
    result = result.filter((c) =>
      (c.name ?? '').toLowerCase().includes(q) ||
      (c.industry ?? '').toLowerCase().includes(q) ||
      (c.ownerName ?? '').toLowerCase().includes(q) ||
      (c.city ?? '').toLowerCase().includes(q)
    );
  }
  return result.slice(offset, offset + limit);
}

function _filterContacts(arr, { search, companyId, contactType }, limit, offset) {
  let result = arr;
  if (companyId)   result = result.filter((c) => c.companyId === companyId);
  if (contactType) result = result.filter((c) => c.contactType === contactType);
  if (search) {
    const q = search.toLowerCase();
    result = result.filter((c) =>
      (c.name ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.company ?? '').toLowerCase().includes(q)
    );
  }
  return result.slice(offset, offset + limit);
}

function _filterDeals(arr, { status, stage, companyId }, limit, offset) {
  let result = arr;
  if (status)    result = result.filter((d) => d.status === status);
  if (stage)     result = result.filter((d) => d.stage === stage);
  if (companyId) result = result.filter((d) => d.companyId === companyId);
  return result.slice(offset, offset + limit);
}

function _filterTasks(arr, { status, priority, companyId, dealId }, limit, offset) {
  let result = arr;
  if (status)    result = result.filter((t) => t.status === status);
  if (priority)  result = result.filter((t) => t.priority === priority);
  if (companyId) result = result.filter((t) => t.companyId === companyId);
  if (dealId)    result = result.filter((t) => t.dealId === dealId);
  return result.slice(offset, offset + limit);
}

function _filterInteractions(arr, { companyId, contactId, dealId, interactionType }, limit, offset) {
  let result = arr;
  if (companyId)       result = result.filter((i) => i.companyId === companyId);
  if (contactId)       result = result.filter((i) => i.contactId === contactId);
  if (dealId)          result = result.filter((i) => i.dealId === dealId);
  if (interactionType) result = result.filter((i) => i.interactionType === interactionType);
  return result.slice(offset, offset + limit);
}

export default { companies, contacts, deals, tasks, interactions, getSystemUserId };
