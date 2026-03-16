/**
 * RelationshipService
 *
 * Manages ongoing relationships with sellers, board members, and investors.
 * Guarantees no critical relationship goes cold by enforcing follow-up
 * schedules and surfacing overdue contacts.
 *
 * Integrates with:
 *  - CRM companies / contacts
 *  - Deal Momentum Engine (updates momentumScore when seller interaction logged)
 *  - Execution Tracker  (interaction counts feed into owners-contacted stats)
 *  - Playbook Engine    (board + investor relationship counts gate stage completion)
 *  - TaskService        (auto-generates follow-up tasks)
 *  - AuditLogService    (immutable change log)
 */

import crypto from 'crypto';
import AuditLogService from './AuditLogService.js';

// ─── Enumerations ─────────────────────────────────────────────────────────────

export const ENTITY_TYPES = ['seller', 'board_member', 'investor'];

export const RELATIONSHIP_STATUSES = [
  'new', 'warming', 'active', 'long_term', 'closed', 'not_interested',
];

export const INTEREST_LEVELS = ['low', 'medium', 'high', 'ready'];

export const INTERACTION_TYPES = ['call', 'email', 'meeting', 'note'];

// ─── Follow-up frequency matrix ───────────────────────────────────────────────
//
// Returns how many days until the next follow-up should occur,
// given an entityType + relationshipStatus combination.

const FOLLOW_UP_DAYS = {
  seller: {
    new:            7,
    warming:        14,
    active:         5,   // 3–7 day range → use 5 as midpoint
    long_term:      60,
    closed:         null,
    not_interested: null,
  },
  board_member: {
    new:            14,
    warming:        14,
    active:         30,
    long_term:      60,
    closed:         null,
    not_interested: null,
  },
  investor: {
    new:            14,
    warming:        30,
    active:         30,
    long_term:      60,
    closed:         null,
    not_interested: null,
  },
};

function defaultFollowUpDays(entityType, relationshipStatus) {
  return (FOLLOW_UP_DAYS[entityType] ?? {})[relationshipStatus] ?? 14;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // return date-only 'YYYY-MM-DD'
}

function isOverdue(nextFollowUpDate) {
  if (!nextFollowUpDate) return false;
  return nextFollowUpDate.slice(0, 10) <= todayIso();
}

function daysSince(isoDateOrIsoDateTime) {
  if (!isoDateOrIsoDateTime) return null;
  return Math.floor(
    (Date.now() - new Date(isoDateOrIsoDateTime).getTime()) / (1000 * 60 * 60 * 24)
  );
}

// ─── Sanitisation ─────────────────────────────────────────────────────────────

function sanitizeStr(val, maxLen = 500) {
  if (typeof val !== 'string') return '';
  return val.replace(/<[^>]*>/g, '').slice(0, maxLen).trim();
}

// ─── Service ──────────────────────────────────────────────────────────────────

class RelationshipService {
  init(store) {
    this._store = store;
    if (!Array.isArray(store.relationships))            store.relationships            = [];
    if (!Array.isArray(store.relationshipInteractions)) store.relationshipInteractions = [];
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Create a new relationship record.
   * nextFollowUpDate is auto-set to today + followUpFrequencyDays.
   */
  createRelationship(data, nowIso = new Date().toISOString()) {
    const entityType       = ENTITY_TYPES.includes(data.entityType) ? data.entityType : 'seller';
    const status           = RELATIONSHIP_STATUSES.includes(data.relationshipStatus) ? data.relationshipStatus : 'new';
    const freqDays         = typeof data.followUpFrequencyDays === 'number' && data.followUpFrequencyDays > 0
      ? data.followUpFrequencyDays
      : defaultFollowUpDays(entityType, status);
    const nextFollowUp     = data.nextFollowUpDate || addDays(nowIso.slice(0, 10), freqDays);

    const rel = {
      id:                    crypto.randomUUID(),
      entityType,
      entityId:              sanitizeStr(data.entityId, 36)  || '',
      name:                  sanitizeStr(data.name, 200),
      company:               sanitizeStr(data.company, 200),
      relationshipStatus:    status,
      interestLevel:         INTEREST_LEVELS.includes(data.interestLevel) ? data.interestLevel : 'medium',
      lastContactDate:       data.lastContactDate || null,
      nextFollowUpDate:      nextFollowUp,
      followUpFrequencyDays: freqDays,
      notes:                 sanitizeStr(data.notes, 2000),
      createdAt:             nowIso,
      updatedAt:             nowIso,
    };

    this._store.relationships = [rel, ...(this._store.relationships || [])];
    AuditLogService.log('relationship.created', 'relationship', rel.id, {
      name: rel.name, entityType, status,
    });
    return rel;
  }

  getRelationship(id) {
    return (this._store.relationships || []).find((r) => r.id === id) || null;
  }

  /**
   * Filtered + paginated list.
   */
  listRelationships({
    entityType,
    relationshipStatus,
    interestLevel,
    overdue,     // boolean — only return overdue follow-ups
    search,
    sortBy = 'nextFollowUpDate',
    sortDir = 'asc',
    page = 1,
    pageSize = 50,
  } = {}) {
    let items = [...(this._store.relationships || [])];

    if (entityType       && ENTITY_TYPES.includes(entityType))
      items = items.filter((r) => r.entityType === entityType);
    if (relationshipStatus && RELATIONSHIP_STATUSES.includes(relationshipStatus))
      items = items.filter((r) => r.relationshipStatus === relationshipStatus);
    if (interestLevel    && INTEREST_LEVELS.includes(interestLevel))
      items = items.filter((r) => r.interestLevel === interestLevel);
    if (overdue === true || overdue === 'true')
      items = items.filter((r) =>
        r.relationshipStatus !== 'closed' &&
        r.relationshipStatus !== 'not_interested' &&
        isOverdue(r.nextFollowUpDate)
      );
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((r) =>
        (r.name    || '').toLowerCase().includes(q) ||
        (r.company || '').toLowerCase().includes(q)
      );
    }

    // Sort
    const SORTABLE = ['nextFollowUpDate', 'lastContactDate', 'createdAt', 'name'];
    const col = SORTABLE.includes(sortBy) ? sortBy : 'nextFollowUpDate';
    items.sort((a, b) => {
      const av = a[col] || '';
      const bv = b[col] || '';
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    const total = items.length;
    const ps    = Math.min(Math.max(1, pageSize), 100);
    const pg    = Math.max(1, page);
    const start = (pg - 1) * ps;

    return {
      relationships: items.slice(start, start + ps),
      total,
      page: pg,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  updateRelationship(id, patch, nowIso = new Date().toISOString()) {
    const idx = (this._store.relationships || []).findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const existing = this._store.relationships[idx];

    const allowed = [
      'entityType', 'entityId', 'name', 'company', 'relationshipStatus',
      'interestLevel', 'lastContactDate', 'nextFollowUpDate',
      'followUpFrequencyDays', 'notes',
    ];
    const cleaned = { ...existing };
    for (const key of allowed) {
      if (patch[key] === undefined) continue;
      if (key === 'entityType'         && !ENTITY_TYPES.includes(patch[key]))          continue;
      if (key === 'relationshipStatus' && !RELATIONSHIP_STATUSES.includes(patch[key])) continue;
      if (key === 'interestLevel'      && !INTEREST_LEVELS.includes(patch[key]))        continue;
      cleaned[key] = patch[key];
    }

    // If status changed, recalculate default frequency unless explicitly provided
    if (patch.relationshipStatus && patch.followUpFrequencyDays === undefined) {
      const newFreq = defaultFollowUpDays(cleaned.entityType, cleaned.relationshipStatus);
      cleaned.followUpFrequencyDays = newFreq;
    }

    cleaned.updatedAt = nowIso;
    this._store.relationships[idx] = cleaned;

    AuditLogService.log('relationship.updated', 'relationship', id, {
      patch: Object.keys(patch),
    });
    return cleaned;
  }

  deleteRelationship(id) {
    const before = (this._store.relationships || []).length;
    this._store.relationships = (this._store.relationships || []).filter((r) => r.id !== id);
    // Also remove interactions
    this._store.relationshipInteractions = (this._store.relationshipInteractions || [])
      .filter((i) => i.relationshipId !== id);
    return this._store.relationships.length < before;
  }

  // ─── Interaction log ───────────────────────────────────────────────────────

  logInteraction(relationshipId, data, nowIso = new Date().toISOString()) {
    const rel = this.getRelationship(relationshipId);
    if (!rel) return null;

    const interaction = {
      id:                  crypto.randomUUID(),
      relationshipId,
      interactionType:     INTERACTION_TYPES.includes(data.interactionType) ? data.interactionType : 'note',
      interactionSummary:  sanitizeStr(data.interactionSummary, 2000),
      createdAt:           nowIso,
    };

    this._store.relationshipInteractions = [
      interaction,
      ...(this._store.relationshipInteractions || []),
    ];

    // Update relationship: set lastContactDate + schedule next follow-up
    const freqDays     = rel.followUpFrequencyDays || defaultFollowUpDays(rel.entityType, rel.relationshipStatus);
    const nextFollowUp = addDays(nowIso.slice(0, 10), freqDays);

    this.updateRelationship(
      relationshipId,
      { lastContactDate: nowIso, nextFollowUpDate: nextFollowUp },
      nowIso
    );

    AuditLogService.log('relationship.interaction_logged', 'relationship', relationshipId, {
      interactionType: interaction.interactionType,
    });

    return interaction;
  }

  getInteractions(relationshipId, { limit = 50, offset = 0 } = {}) {
    const items = (this._store.relationshipInteractions || [])
      .filter((i) => i.relationshipId === relationshipId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      interactions: items.slice(offset, offset + limit),
      total: items.length,
    };
  }

  // ─── Domain methods ────────────────────────────────────────────────────────

  updateInterestLevel(id, interestLevel, nowIso = new Date().toISOString()) {
    if (!INTEREST_LEVELS.includes(interestLevel)) return null;
    return this.updateRelationship(id, { interestLevel }, nowIso);
  }

  scheduleNextFollowUp(id, daysFromNow, nowIso = new Date().toISOString()) {
    const days = typeof daysFromNow === 'number' && daysFromNow > 0 ? daysFromNow : 7;
    const nextDate = addDays(nowIso.slice(0, 10), days);
    return this.updateRelationship(
      id,
      { nextFollowUpDate: nextDate, followUpFrequencyDays: days },
      nowIso
    );
  }

  /**
   * Auto-calculate relationship status based on interaction recency.
   * Called after interactions are logged.
   */
  calculateRelationshipStatus(id, nowIso = new Date().toISOString()) {
    const rel = this.getRelationship(id);
    if (!rel) return null;

    const interactions = (this._store.relationshipInteractions || [])
      .filter((i) => i.relationshipId === id);
    const interactionCount = interactions.length;
    const lastContact = rel.lastContactDate;
    const daysAgo = lastContact ? daysSince(lastContact) : null;

    let newStatus = rel.relationshipStatus;

    // Only auto-elevate: never demote via this method
    if (rel.relationshipStatus === 'not_interested' || rel.relationshipStatus === 'closed') {
      return rel;
    }

    if (interactionCount >= 10 && daysAgo != null && daysAgo <= 30) {
      newStatus = 'long_term';
    } else if (interactionCount >= 4 && daysAgo != null && daysAgo <= 14) {
      newStatus = 'active';
    } else if (interactionCount >= 1 && daysAgo != null && daysAgo <= 30) {
      newStatus = 'warming';
    }

    if (newStatus !== rel.relationshipStatus) {
      return this.updateRelationship(id, { relationshipStatus: newStatus }, nowIso);
    }
    return rel;
  }

  /**
   * Generate follow-up tasks for all relationships whose nextFollowUpDate
   * is on or before today. Returns count of tasks created.
   *
   * @param {object}   store     – full platform store (has tasks[])
   * @param {Function} uid       – () => uuid
   * @param {string}   nowIso
   */
  generateFollowUpTasks(store, uid, nowIso = new Date().toISOString()) {
    const today = nowIso.slice(0, 10);
    const due = (store.relationships || []).filter((r) =>
      r.relationshipStatus !== 'closed' &&
      r.relationshipStatus !== 'not_interested' &&
      r.nextFollowUpDate &&
      r.nextFollowUpDate.slice(0, 10) <= today
    );

    let created = 0;
    for (const rel of due) {
      // Avoid duplicate tasks: skip if open follow-up task already exists for this rel
      const existingTask = (store.tasks || []).find((t) =>
        t.status !== 'done' &&
        t.linkedEntityType === 'relationship' &&
        t.linkedEntityId === rel.id &&
        t.title?.startsWith('[Follow-up]')
      );
      if (existingTask) continue;

      const entityLabel = {
        seller:       'Seller',
        board_member: 'Board Member',
        investor:     'Investor',
      }[rel.entityType] || rel.entityType;

      const task = {
        id:               uid(),
        title:            `[Follow-up] ${entityLabel}: ${rel.name}${rel.company ? ` — ${rel.company}` : ''}`,
        description:      `Relationship follow-up due.\nLast contact: ${rel.lastContactDate ? rel.lastContactDate.slice(0, 10) : 'never'}.\nFrequency: every ${rel.followUpFrequencyDays} days.`,
        priority:         rel.interestLevel === 'ready' || rel.interestLevel === 'high' ? 'high' : 'medium',
        status:           'todo',
        dueDate:          rel.nextFollowUpDate,
        linkedEntityType: 'relationship',
        linkedEntityId:   rel.id,
        createdAt:        nowIso,
        updatedAt:        nowIso,
      };
      store.tasks = [task, ...(store.tasks || [])];
      created++;
    }
    return created;
  }

  // ─── Dashboard data ────────────────────────────────────────────────────────

  getDashboardData() {
    const rels = this._store.relationships || [];
    const today = todayIso();

    const overdue = rels.filter((r) =>
      r.relationshipStatus !== 'closed' &&
      r.relationshipStatus !== 'not_interested' &&
      r.nextFollowUpDate &&
      r.nextFollowUpDate.slice(0, 10) <= today
    );

    const byType = (type) => overdue.filter((r) => r.entityType === type)
      .sort((a, b) => (a.nextFollowUpDate || '').localeCompare(b.nextFollowUpDate || ''));

    const upcoming = rels
      .filter((r) =>
        r.relationshipStatus !== 'closed' &&
        r.relationshipStatus !== 'not_interested' &&
        r.nextFollowUpDate &&
        r.nextFollowUpDate.slice(0, 10) > today
      )
      .sort((a, b) => (a.nextFollowUpDate || '').localeCompare(b.nextFollowUpDate || ''))
      .slice(0, 5);

    return {
      overdueSellers:      byType('seller'),
      overdueBoardMembers: byType('board_member'),
      overdueInvestors:    byType('investor'),
      overdueTotal:        overdue.length,
      upcoming,
      summary: {
        total:     rels.length,
        sellers:       rels.filter((r) => r.entityType === 'seller').length,
        boardMembers:  rels.filter((r) => r.entityType === 'board_member').length,
        investors:     rels.filter((r) => r.entityType === 'investor').length,
        active:        rels.filter((r) => r.relationshipStatus === 'active').length,
        longTerm:      rels.filter((r) => r.relationshipStatus === 'long_term').length,
        new:           rels.filter((r) => r.relationshipStatus === 'new').length,
        highInterest:  rels.filter((r) => r.interestLevel === 'high' || r.interestLevel === 'ready').length,
      },
    };
  }

  // ─── Execution Tracker feed ────────────────────────────────────────────────

  /**
   * Returns counts for the Execution Tracker:
   *  - ownersContactedThisWeek
   *  - boardOutreachThisWeek
   *  - investorConversationsThisWeek
   */
  getExecutionCounts() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentInteractions = (this._store.relationshipInteractions || [])
      .filter((i) => i.createdAt >= weekAgo);

    // Map relId → entityType for quick lookup
    const typeMap = {};
    for (const r of (this._store.relationships || [])) typeMap[r.id] = r.entityType;

    let sellers = 0, board = 0, investors = 0;
    const seen = new Set();
    for (const i of recentInteractions) {
      const type = typeMap[i.relationshipId];
      const key  = `${type}:${i.relationshipId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (type === 'seller')       sellers++;
      if (type === 'board_member') board++;
      if (type === 'investor')     investors++;
    }
    return { ownersContactedThisWeek: sellers, boardOutreachThisWeek: board, investorConversationsThisWeek: investors };
  }

  // ─── Constants for external validation ────────────────────────────────────
  static get ENTITY_TYPES()          { return ENTITY_TYPES; }
  static get RELATIONSHIP_STATUSES() { return RELATIONSHIP_STATUSES; }
  static get INTEREST_LEVELS()       { return INTEREST_LEVELS; }
  static get INTERACTION_TYPES()     { return INTERACTION_TYPES; }
}

export default new RelationshipService();
