/**
 * DealFeedScoringService
 *
 * Deterministic 0–100 acquisition attractiveness score.
 * Higher = more attractive to a search-fund / ETA buyer.
 *
 * Scoring factors
 * ─────────────────────────────────────────────────────
 * 1. Years in business         (0–25 pts)
 * 2. Service industry          (0–20 pts)
 * 3. Revenue stability proxy   (0–20 pts)  — uses revenue/EBITDA ratio
 * 4. Fragmented industry       (0–15 pts)
 * 5. Owner retirement signal   (0–15 pts)
 * 6. Valuation attractiveness  (0–5  pts)  — price / revenue multiple
 */

// ─── Service-industry keywords ────────────────────────────────────────────────
// These industries command premium QLA scores because they are scalable,
// asset-light, and have recurring revenue characteristics.
const HIGH_VALUE_INDUSTRIES = new Set([
  'hvac', 'plumbing', 'electrical', 'pest control', 'landscaping',
  'janitorial', 'cleaning', 'facility', 'restoration', 'roofing',
  'painting', 'flooring', 'concrete', 'fencing', 'irrigation',
  'fire protection', 'security', 'alarm',
  'home services', 'field service',
  'staffing', 'professional services', 'it services', 'managed services',
  'healthcare', 'medical', 'dental', 'therapy', 'veterinary',
  'childcare', 'education', 'tutoring',
  'distribution', 'logistics', 'supply chain',
  'industrial services', 'manufacturing services',
  'environmental', 'waste',
  'software', 'saas', 'technology services',
  'insurance', 'financial services',
]);

const FRAGMENTED_INDUSTRIES = new Set([
  'hvac', 'plumbing', 'electrical', 'pest control', 'landscaping',
  'janitorial', 'cleaning', 'roofing', 'painting',
  'home services', 'field service', 'restoration',
  'staffing', 'managed services', 'it services',
  'childcare', 'tutoring',
  'environmental', 'waste',
  'insurance',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(value, min, max) {
  if (value <= min) return 0;
  if (value >= max) return 1;
  return (value - min) / (max - min);
}

function matchesIndustrySet(industry, set) {
  if (!industry) return false;
  const lower = industry.toLowerCase();
  for (const kw of set) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Score a single listing object. Returns a number 0–100 (integer).
 * @param {object} listing
 * @returns {number}
 */
function scoreListings(listing) {
  let score = 0;

  /* 1. Years in business — 0 to 25 pts
   *    0 yrs = 0, 10+ yrs = 25
   */
  const years = typeof listing.yearsInBusiness === 'number' ? listing.yearsInBusiness : 0;
  score += Math.round(normalize(years, 0, 10) * 25);

  /* 2. Service industry classification — 0 to 20 pts */
  if (matchesIndustrySet(listing.industry, HIGH_VALUE_INDUSTRIES)) {
    score += 20;
  } else if (listing.industry) {
    // Any defined industry still gets partial credit over "unknown"
    score += 5;
  }

  /* 3. Revenue stability proxy — 0 to 20 pts
   *    Proxy: EBITDA margin = ebitda / revenue
   *    ≥ 20% margin = full points; use revenue alone if no EBITDA.
   */
  const rev    = listing.revenueEstimate  || 0;
  const ebitda = listing.ebitdaEstimate   || 0;
  if (rev > 0 && ebitda > 0) {
    const margin = ebitda / rev;
    score += Math.round(normalize(margin, 0, 0.25) * 20);
  } else if (rev > 0) {
    // Revenue exists but no EBITDA — give partial credit based on size
    // $500K–$5M revenue range is the QLA sweet spot
    score += Math.round(normalize(rev, 250_000, 5_000_000) * 10);
  }

  /* 4. Fragmented industry — 0 to 15 pts */
  if (matchesIndustrySet(listing.industry, FRAGMENTED_INDUSTRIES)) {
    score += 15;
  }

  /* 5. Owner retirement signal — 0 to 15 pts
   *    Proxied by: ownerRetirementSignal boolean, or years >= 10 plus
   *    no website / low digital presence (noWebsite signal).
   */
  if (listing.ownerRetirementSignal === true) {
    score += 15;
  } else if (years >= 10 && listing.noWebsiteSignal === true) {
    score += 10;
  } else if (years >= 15) {
    score += 5;
  }

  /* 6. Valuation attractiveness — 0 to 5 pts
   *    price / revenue ≤ 2× = attractive; ≥ 5× = unattractive.
   */
  const price = listing.listingPrice || 0;
  if (price > 0 && rev > 0) {
    const multiple = price / rev;
    if (multiple <= 2) score += 5;
    else if (multiple <= 3) score += 3;
    else if (multiple <= 4) score += 1;
  }

  return Math.max(0, Math.min(100, score));
}

// ─── Exported service ─────────────────────────────────────────────────────────

class DealFeedScoringService {
  /**
   * Score a single listing and return the integer score.
   * @param {object} listing
   * @returns {number}
   */
  score(listing) {
    return scoreListings(listing);
  }

  /**
   * Mutate the listing in place: set acquisitionScore and return the score.
   * @param {object} listing
   * @returns {number}
   */
  applyScore(listing) {
    const s = scoreListings(listing);
    listing.acquisitionScore = s;
    return s;
  }

  /**
   * Re-score every listing in the store and persist scores.
   * @param {Array} listings
   */
  rescoreAll(listings) {
    for (const listing of listings) {
      listing.acquisitionScore = scoreListings(listing);
    }
  }

  /**
   * Score breakdown for the detail view (for display purposes).
   * Returns labelled component scores that sum to acquisitionScore.
   * @param {object} listing
   * @returns {object[]}
   */
  breakdown(listing) {
    const years   = typeof listing.yearsInBusiness === 'number' ? listing.yearsInBusiness : 0;
    const rev     = listing.revenueEstimate  || 0;
    const ebitda  = listing.ebitdaEstimate   || 0;
    const price   = listing.listingPrice     || 0;

    const longevity = Math.round(normalize(years, 0, 10) * 25);
    const industry  = matchesIndustrySet(listing.industry, HIGH_VALUE_INDUSTRIES) ? 20 : (listing.industry ? 5 : 0);
    let stability = 0;
    if (rev > 0 && ebitda > 0) {
      stability = Math.round(normalize(ebitda / rev, 0, 0.25) * 20);
    } else if (rev > 0) {
      stability = Math.round(normalize(rev, 250_000, 5_000_000) * 10);
    }
    const fragmented = matchesIndustrySet(listing.industry, FRAGMENTED_INDUSTRIES) ? 15 : 0;
    let retirement = 0;
    if (listing.ownerRetirementSignal) retirement = 15;
    else if (years >= 10 && listing.noWebsiteSignal) retirement = 10;
    else if (years >= 15) retirement = 5;
    let valuation = 0;
    if (price > 0 && rev > 0) {
      const m = price / rev;
      if (m <= 2) valuation = 5;
      else if (m <= 3) valuation = 3;
      else if (m <= 4) valuation = 1;
    }

    return [
      { factor: 'Business Longevity',    maxPts: 25, pts: longevity  },
      { factor: 'Industry Quality',       maxPts: 20, pts: industry   },
      { factor: 'Revenue Stability',      maxPts: 20, pts: stability  },
      { factor: 'Fragmented Industry',    maxPts: 15, pts: fragmented },
      { factor: 'Owner Retirement Signal',maxPts: 15, pts: retirement },
      { factor: 'Valuation',              maxPts: 5,  pts: valuation  },
    ];
  }
}

export default new DealFeedScoringService();
