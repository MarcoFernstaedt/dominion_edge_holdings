/**
 * CandidateDeduplicationService
 *
 * Compares normalized sourcing candidates against existing CRM companies
 * and against the existing sourcingRadarCandidates collection to prevent
 * duplicates entering the review queue.
 *
 * Matching strategy:
 *   1. Exact domain match (website)
 *   2. Exact phone match
 *   3. Fuzzy name + same state match
 *
 * normalizedHash — a stable fingerprint used as a fast lookup key.
 */

import crypto from 'crypto';

class CandidateDeduplicationServiceClass {
  /**
   * Compute a stable normalized hash for a candidate.
   * Hash is built from: normalized name + state + website domain + phone.
   */
  computeNormalizedHash(candidate) {
    const namePart  = (candidate.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
    const statePart = (candidate.state || '').toLowerCase().trim().slice(0, 5);
    const domainPart = this._extractDomain(candidate.website);
    const phonePart  = (candidate.phone || '').replace(/\D/g, '').slice(-10);

    const raw = `${namePart}|${statePart}|${domainPart}|${phonePart}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
  }

  _extractDomain(url) {
    if (!url) return '';
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      return u.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return '';
    }
  }

  _normalizeName(name) {
    return (name || '').toLowerCase()
      .replace(/\b(inc|llc|ltd|corp|co|company|group|holdings|services|solutions|enterprises)\b\.?/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Check if a candidate likely matches an existing company record.
   *
   * @param {object} candidate  Normalized candidate
   * @param {object[]} companies  Existing CRM companies
   * @returns {{ matched: boolean, matchedCompany: object|null, reason: string|null }}
   */
  matchAgainstExistingCompanies(candidate, companies) {
    const candidateDomain = this._extractDomain(candidate.website);
    const candidatePhone  = (candidate.phone || '').replace(/\D/g, '').slice(-10);
    const candidateName   = this._normalizeName(candidate.name);

    for (const company of companies) {
      // 1. Domain match
      if (candidateDomain && candidateDomain === this._extractDomain(company.website)) {
        return { matched: true, matchedCompany: company, reason: 'domain_match' };
      }

      // 2. Phone match
      const companyPhone = (company.phone || '').replace(/\D/g, '').slice(-10);
      if (candidatePhone && companyPhone && candidatePhone === companyPhone) {
        return { matched: true, matchedCompany: company, reason: 'phone_match' };
      }

      // 3. Fuzzy name + same state
      const companyName = this._normalizeName(company.name);
      if (candidateName.length >= 4 && companyName.length >= 4) {
        const sameState = candidate.state && company.state &&
          candidate.state.toLowerCase() === company.state.toLowerCase();
        if (sameState && this._isSimilarName(candidateName, companyName)) {
          return { matched: true, matchedCompany: company, reason: 'name_state_match' };
        }
      }
    }

    return { matched: false, matchedCompany: null, reason: null };
  }

  /**
   * Check if this candidate's hash already exists in the candidates collection.
   */
  isExistingCandidate(normalizedHash, existingCandidates) {
    return (existingCandidates || []).some((c) => c.normalizedHash === normalizedHash);
  }

  /**
   * Check if two normalized names are similar (Dice coefficient ≥ 0.75).
   */
  _isSimilarName(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 8) return false;

    // Check if one contains the other
    if (a.includes(b) || b.includes(a)) return true;

    // Dice coefficient on bigrams
    const bigrams = (str) => {
      const s = new Set();
      for (let i = 0; i < str.length - 1; i++) s.add(str.slice(i, i + 2));
      return s;
    };

    const aGrams = bigrams(a);
    const bGrams = bigrams(b);
    let intersection = 0;
    for (const g of aGrams) if (bGrams.has(g)) intersection++;

    const similarity = (2 * intersection) / (aGrams.size + bGrams.size);
    return similarity >= 0.75;
  }

  /**
   * Determine dedupeStatus for a candidate.
   * Returns: 'matched_existing' | 'possible_duplicate' | 'new_candidate'
   */
  determineDedupeStatus(candidate, companies, existingCandidates) {
    const hash = this.computeNormalizedHash(candidate);

    // Already in queue?
    if (this.isExistingCandidate(hash, existingCandidates)) {
      return { dedupeStatus: 'matched_existing', linkedCompanyId: null, normalizedHash: hash };
    }

    // Matches existing CRM company?
    const { matched, matchedCompany } = this.matchAgainstExistingCompanies(candidate, companies);
    if (matched) {
      return {
        dedupeStatus: 'matched_existing',
        linkedCompanyId: matchedCompany?.id || null,
        normalizedHash: hash,
      };
    }

    return { dedupeStatus: 'new_candidate', linkedCompanyId: null, normalizedHash: hash };
  }
}

export const CandidateDeduplicationService = new CandidateDeduplicationServiceClass();
export default CandidateDeduplicationService;
