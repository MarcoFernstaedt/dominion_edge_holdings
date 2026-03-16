/**
 * SourcingRadarService
 *
 * Orchestrates sourcing radar scans:
 *   1. Iterates enabled adapters
 *   2. Fetches candidates
 *   3. Normalizes + deduplicates
 *   4. Scores relevance
 *   5. Inserts new candidates into review queue
 *   6. Creates notifications for high-priority targets
 *
 * Failure contract:
 *   - If any adapter fails: skip it, log error, continue
 *   - Never throw from runScheduledScan; always return a run record
 */

import crypto from 'crypto';
import SourceAdapterRegistryService from './SourceAdapterRegistryService.js';
import CandidateDeduplicationService from './CandidateDeduplicationService.js';
import NotificationService from './NotificationService.js';

const DEFAULT_RELEVANCE_THRESHOLD = 50;

class SourcingRadarServiceClass {
  init(store) {
    this._store = store;
    if (!store.sourcingRadarRuns)       store.sourcingRadarRuns = [];
    if (!store.sourcingRadarCandidates) store.sourcingRadarCandidates = [];
  }

  // ─── Scoring ────────────────────────────────────────────────────────────────

  /**
   * Score a candidate 0-100 based on deterministic rules.
   * Weights:
   *   industry match   = 30
   *   location match   = 20
   *   years in biz     = 15
   *   employee est     = 10
   *   source conf      = 10
   *   seller signals   = 15
   */
  scoreCandidateRelevance(candidate, settings = {}) {
    let score = 0;

    // Industry match (30)
    const targetIndustries = (settings.sourcingTargetIndustries || []).map((i) => i.toLowerCase());
    if (targetIndustries.length === 0) {
      score += 15; // no filter = partial credit
    } else {
      const candIndustry = (candidate.industry || '').toLowerCase();
      if (targetIndustries.some((ti) => candIndustry.includes(ti) || ti.includes(candIndustry))) {
        score += 30;
      }
    }

    // Location match (20)
    const targetStates = (settings.sourcingTargetStates || []).map((s) => s.toLowerCase());
    if (targetStates.length === 0) {
      score += 10; // no filter = partial credit
    } else {
      const candState = (candidate.state || '').toLowerCase();
      if (targetStates.some((ts) => candState === ts || candState.includes(ts))) {
        score += 20;
      }
    }

    // Years in business (15) — prefer established businesses (5-30 years)
    const yib = candidate.yearsInBusiness || 0;
    if (yib >= 10) score += 15;
    else if (yib >= 5) score += 10;
    else if (yib >= 2) score += 5;

    // Employee estimate (10) — prefer 5-100 employees (Main Street)
    const emp = candidate.employeeEstimate || 0;
    if (emp >= 5 && emp <= 100) score += 10;
    else if (emp > 100 && emp <= 250) score += 5;

    // Source confidence (10) — manual imports and apollo score higher
    const sourceConf = {
      manual_import:    10,
      apollo:           8,
      public_directory: 5,
      listing_site:     7,
      custom_api:       6,
    };
    score += sourceConf[candidate.sourceType] || 5;

    // Seller signals (15)
    // No website = owner may not care about digital presence = possibly more traditional/retiring
    if (!candidate.website) score += 5;
    if (candidate.ownerName) score += 5; // we have owner info
    // If explicitly tagged with retirement signal
    if (candidate.retirementSignal) score += 5;

    return Math.min(100, Math.round(score));
  }

  // ─── Main scan ──────────────────────────────────────────────────────────────

  /**
   * Run a full sourcing radar scan across all enabled adapters.
   * Safe: catches all per-adapter errors.
   */
  async runScheduledScan({ manual = false, sourceIds = [], triggeredBy = 'scheduler', settings = {} } = {}) {
    const now = new Date().toISOString();
    const runId = crypto.randomUUID();

    const runRecord = {
      id:                   runId,
      startedAt:            now,
      completedAt:          null,
      status:               'running',
      sourcesAttempted:     0,
      sourcesSucceeded:     0,
      sourcesFailed:        0,
      totalCandidatesFound: 0,
      newCandidatesInserted: 0,
      duplicatesDetected:   0,
      warnings:             [],
      errors:               [],
      triggeredBy,
      createdAt:            now,
      updatedAt:            now,
    };

    this._store.sourcingRadarRuns.unshift(runRecord);
    // Keep only last 50 runs
    this._store.sourcingRadarRuns = this._store.sourcingRadarRuns.slice(0, 50);

    try {
      let adapters = SourceAdapterRegistryService.getEnabledAdapters();

      // Filter by sourceIds if specified
      if (sourceIds.length > 0) {
        adapters = adapters.filter((e) => sourceIds.includes(e.meta.id));
      }

      for (const entry of adapters) {
        await this.runSourceScan(entry, runRecord, settings);
      }

      runRecord.status = runRecord.errors.length > 0 ? 'completed_with_warnings' : 'completed';
    } catch (err) {
      runRecord.status = 'completed_with_warnings';
      runRecord.errors.push(`Scan error: ${err.message}`);
    } finally {
      runRecord.completedAt = new Date().toISOString();
      runRecord.updatedAt   = new Date().toISOString();
    }

    // Update lastRunAt on each attempted adapter
    const adaptedNow = new Date().toISOString();
    for (const adapter of (this._store.sourceAdapters || [])) {
      adapter.lastRunAt = adaptedNow;
    }

    // Notify on high-priority new candidates
    await this.notifyOnHighPriorityCandidates(runRecord, settings);

    return runRecord;
  }

  /**
   * Run scan for a single adapter entry.
   * Errors are caught and recorded in runRecord — never rethrown.
   */
  async runSourceScan(entry, runRecord, settings = {}) {
    runRecord.sourcesAttempted++;
    const { meta, instance } = entry;

    try {
      const { candidates, warnings, errors } = await instance.fetchCandidates({
        industry: settings.sourcingTargetIndustries?.[0],
        location: settings.sourcingTargetStates?.[0],
        limit: 50,
      });

      runRecord.warnings.push(...(warnings || []).map((w) => `[${meta.adapterName}] ${w}`));
      if (errors && errors.length > 0) {
        runRecord.errors.push(...errors.map((e) => `[${meta.adapterName}] ${e}`));
        runRecord.sourcesFailed++;
        this._updateAdapterStatus(meta.id, 'unreachable', errors[0]);
        return;
      }

      runRecord.sourcesSucceeded++;
      runRecord.totalCandidatesFound += candidates.length;
      this._updateAdapterStatus(meta.id, 'healthy', null);

      // Process each candidate
      for (const raw of candidates) {
        await this._processCandidate(raw, meta, runRecord, settings);
      }
    } catch (err) {
      runRecord.sourcesFailed++;
      runRecord.errors.push(`[${meta.adapterName}] Exception: ${err.message}`);
      this._updateAdapterStatus(meta.id, 'unreachable', err.message);
    }
  }

  async _processCandidate(normalized, adapterMeta, runRecord, settings) {
    const companies  = this._store.companies || [];
    const candidates = this._store.sourcingRadarCandidates || [];

    const { dedupeStatus, linkedCompanyId, normalizedHash } =
      CandidateDeduplicationService.determineDedupeStatus(normalized, companies, candidates);

    if (dedupeStatus === 'matched_existing') {
      runRecord.duplicatesDetected++;
      return; // Skip — already in CRM or queue
    }

    const relevanceScore = this.scoreCandidateRelevance(normalized, settings);
    const now = new Date().toISOString();

    const candidate = {
      id:                 crypto.randomUUID(),
      sourceAdapterId:    adapterMeta.id,
      externalSourceId:   normalized.externalSourceId || null,
      name:               normalized.name,
      industry:           normalized.industry,
      subIndustry:        normalized.subIndustry,
      website:            normalized.website,
      phone:              normalized.phone,
      email:              normalized.email,
      address:            normalized.address,
      city:               normalized.city,
      state:              normalized.state,
      zip:                normalized.zip,
      country:            normalized.country || 'US',
      sourceUrl:          normalized.sourceUrl,
      sourceType:         adapterMeta.adapterType,
      yearsInBusiness:    normalized.yearsInBusiness,
      employeeEstimate:   normalized.employeeEstimate,
      ownerName:          normalized.ownerName,
      notes:              normalized.notes || null,
      normalizedHash,
      dedupeStatus,
      qualificationStatus: 'unreviewed',
      relevanceScore,
      reviewStatus:       'pending_review',
      linkedCompanyId:    linkedCompanyId || null,
      rawPayload:         normalized.rawPayload || null,
      createdAt:          now,
      updatedAt:          now,
    };

    this._store.sourcingRadarCandidates.unshift(candidate);
    // Keep collection bounded
    this._store.sourcingRadarCandidates = this._store.sourcingRadarCandidates.slice(0, 1000);

    runRecord.newCandidatesInserted++;
  }

  async notifyOnHighPriorityCandidates(runRecord, settings = {}) {
    const threshold = settings.sourcingMinRelevanceThreshold || DEFAULT_RELEVANCE_THRESHOLD;
    const notifyOn  = settings.sourcingNotifyHighPriority !== false;
    if (!notifyOn || !runRecord.newCandidatesInserted) return;

    // Count high-priority new insertions this run (approximate — check recent)
    const recent = (this._store.sourcingRadarCandidates || []).filter(
      (c) => c.relevanceScore >= threshold && c.reviewStatus === 'pending_review'
    );

    if (recent.length > 0) {
      const n = NotificationService.createNotification({
        type:     'system',
        title:    `${recent.length} high-priority sourcing target${recent.length > 1 ? 's' : ''} found`,
        message:  `Sourcing radar found ${recent.length} new candidate${recent.length > 1 ? 's' : ''} scoring ${threshold}+. Review in the Sourcing Radar.`,
        priority: 'high',
        entityType: 'sourcing_radar',
        entityId:   runRecord.id,
      });
      this._store.notifications = [n, ...(this._store.notifications || [])].slice(0, 50);
    }
  }

  _updateAdapterStatus(adapterId, status, errorMessage) {
    const record = (this._store.sourceAdapters || []).find((a) => a.id === adapterId);
    if (!record) return;
    const now = new Date().toISOString();
    record.status    = status;
    record.updatedAt = now;
    if (status === 'healthy') {
      record.lastSuccessAt = now;
    } else {
      record.lastErrorAt      = now;
      record.lastErrorMessage = errorMessage;
    }
  }

  // ─── Review queue ops ───────────────────────────────────────────────────────

  getReviewQueue({ reviewStatus, minScore, industry, state } = {}) {
    let list = (this._store?.sourcingRadarCandidates || []);
    if (reviewStatus) list = list.filter((c) => c.reviewStatus === reviewStatus);
    if (minScore !== undefined) list = list.filter((c) => c.relevanceScore >= minScore);
    if (industry) list = list.filter((c) => (c.industry || '').toLowerCase().includes(industry.toLowerCase()));
    if (state) list = list.filter((c) => (c.state || '').toLowerCase() === state.toLowerCase());
    return list;
  }

  updateCandidateReview(candidateId, { reviewStatus, qualificationStatus, notes }) {
    const candidate = (this._store?.sourcingRadarCandidates || []).find((c) => c.id === candidateId);
    if (!candidate) return null;
    if (reviewStatus)       candidate.reviewStatus       = reviewStatus;
    if (qualificationStatus) candidate.qualificationStatus = qualificationStatus;
    if (notes !== undefined) candidate.notes              = notes;
    candidate.updatedAt = new Date().toISOString();
    return candidate;
  }

  /** Accept a candidate into the CRM — creates a new company record. */
  acceptCandidateToCRM(candidateId, uid, nowIso) {
    const candidate = (this._store?.sourcingRadarCandidates || []).find((c) => c.id === candidateId);
    if (!candidate) return null;

    const company = {
      id:          uid(),
      name:        candidate.name,
      industry:    candidate.industry || '',
      subIndustry: candidate.subIndustry || undefined,
      website:     candidate.website || undefined,
      phone:       candidate.phone || undefined,
      email:       candidate.email || undefined,
      city:        candidate.city || undefined,
      state:       candidate.state || undefined,
      zip:         candidate.zip || undefined,
      country:     candidate.country || 'US',
      ownerName:   candidate.ownerName || undefined,
      yearsInBusiness: candidate.yearsInBusiness || undefined,
      status:      'target',
      source:      `sourcing_radar:${candidate.sourceType}`,
      notes:       candidate.notes || undefined,
      acquisitionScore: candidate.relevanceScore,
      createdAt:   nowIso(),
      updatedAt:   nowIso(),
    };

    this._store.companies.push(company);

    // Update candidate record
    candidate.reviewStatus  = 'accepted_to_crm';
    candidate.linkedCompanyId = company.id;
    candidate.updatedAt     = nowIso();

    return { company, candidate };
  }

  getLastRun() {
    return (this._store?.sourcingRadarRuns || [])[0] || null;
  }

  getRunHistory(limit = 10) {
    return (this._store?.sourcingRadarRuns || []).slice(0, limit);
  }
}

export const SourcingRadarService = new SourcingRadarServiceClass();
export default SourcingRadarService;
