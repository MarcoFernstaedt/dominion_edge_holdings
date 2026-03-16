/**
 * DealProbabilityService
 *
 * Deterministic deal close-probability scoring (0-100).
 * AI commentary is optional and handled separately.
 *
 * Factor weights (max points):
 *   sellerMotivationStrength  = 20
 *   sellerTimelineStrength    = 15
 *   relationshipStrength      = 15
 *   financialTransparency     = 15
 *   responsiveness            = 10
 *   processMomentum           = 10
 *   structureFit              = 10
 *   dealEconomics             = 10
 *   riskPenalty               = up to -20
 */

class DealProbabilityServiceClass {
  // ─── Band assignment ─────────────────────────────────────────────────────────

  assignProbabilityBand(score) {
    if (score >= 80) return 'very_high';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'very_low';
  }

  // ─── Factor calculation ──────────────────────────────────────────────────────

  /**
   * Calculate all factor scores from deal + related data.
   *
   * @param {object} deal            Deal record
   * @param {object[]} interactions  All interactions linked to deal/company
   * @param {object[]} scenarios     Underwriting scenarios
   * @param {object} company         Linked company record
   * @returns {object} Factor scores + penalty
   */
  calculateProbabilityFactors(deal, interactions = [], scenarios = [], company = null) {
    const factors = {};

    // 1. Seller motivation strength (0, 5, 10, 15, 20)
    factors.sellerMotivationStrength = this._scoreSellerMotivation(deal, interactions, company);

    // 2. Seller timeline strength (0, 5, 10, 15)
    factors.sellerTimelineStrength = this._scoreSellerTimeline(deal, interactions, company);

    // 3. Relationship strength (0, 5, 10, 15)
    factors.relationshipStrength = this._scoreRelationshipStrength(interactions, company);

    // 4. Financial transparency (0, 5, 10, 15)
    factors.financialTransparency = this._scoreFinancialTransparency(deal, interactions, scenarios);

    // 5. Responsiveness (0, 5, 10)
    factors.responsiveness = this._scoreResponsiveness(interactions);

    // 6. Process momentum (0, 5, 10)
    factors.processMomentum = this._scoreProcessMomentum(deal, interactions);

    // 7. Structure fit (0, 5, 10)
    factors.structureFit = this._scoreStructureFit(deal, scenarios);

    // 8. Deal economics (0, 5, 10)
    factors.dealEconomics = this._scoreDealEconomics(deal, scenarios);

    // 9. Risk penalty (0, -5, -10, -20)
    factors.riskPenalty = this._scoreRiskPenalty(deal, company);

    return factors;
  }

  _scoreSellerMotivation(deal, interactions, company) {
    // Look for explicit motivation signals
    const hasRetirementSignal = company?.retirementSignal === true;
    const motivationTypes = interactions
      .map((i) => i.sellerMotivation)
      .filter(Boolean);

    if (motivationTypes.includes('retirement') || motivationTypes.includes('family_transition')) return 20;
    if (motivationTypes.includes('burnout')) return 20;
    if (motivationTypes.includes('expansion_capital')) return 15;
    if (hasRetirementSignal) return 15;
    if (motivationTypes.length > 0 && !motivationTypes.every((m) => m === 'unknown')) return 10;
    if (deal.stage && !['identified', 'contacted'].includes(deal.stage)) return 5;
    return 0;
  }

  _scoreSellerTimeline(deal, interactions, company) {
    const timelines = interactions
      .map((i) => i.sellerTimeline)
      .filter(Boolean);

    if (timelines.includes('immediate')) return 15;
    if (timelines.includes('6_months')) return 10;
    if (timelines.includes('1_year')) return 5;
    // Stage-based proxy if no explicit timeline
    if (['loi_signed', 'due_diligence', 'financing', 'closing'].includes(deal.stage)) return 15;
    if (['loi_discussion', 'financial_review'].includes(deal.stage)) return 10;
    return 0;
  }

  _scoreRelationshipStrength(interactions, company) {
    const qualityInteractions = interactions.filter(
      (i) => i.type === 'call' || i.type === 'meeting' || i.type === 'note'
    );

    if (qualityInteractions.length >= 5) return 15;
    if (qualityInteractions.length >= 3) return 10;
    if (qualityInteractions.length >= 1) return 5;

    // Fall back to pipeline pressure level as proxy
    if (company?.pipelinePressureLevel === 'active') return 5;
    return 0;
  }

  _scoreFinancialTransparency(deal, interactions, scenarios) {
    // Underwriting scenarios = seller shared real numbers
    if (scenarios.length >= 2) return 15;
    if (scenarios.length === 1) return 10;

    // Deal has financial data entered
    const hasRevenue = !!(deal.estimatedRevenue || deal.estimatedSDE);
    if (hasRevenue && deal.askingPrice) return 10;
    if (hasRevenue) return 5;

    // Interactions mentioning documents
    const docInteractions = interactions.filter(
      (i) => i.type === 'document_sent' || i.type === 'loi'
    );
    if (docInteractions.length > 0) return 10;

    return 0;
  }

  _scoreResponsiveness(interactions) {
    if (interactions.length === 0) return 0;

    const recent = interactions
      .filter((i) => i.createdAt)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (recent.length === 0) return 0;

    const latestMs = new Date(recent[0].createdAt).getTime();
    const daysSince = (Date.now() - latestMs) / 86400000;

    // Check inbound responses
    const hasInbound = interactions.some((i) => i.direction === 'inbound');
    if (hasInbound && daysSince <= 7) return 10;
    if (hasInbound && daysSince <= 14) return 7;
    if (daysSince <= 7) return 5;
    return 0;
  }

  _scoreProcessMomentum(deal, interactions) {
    const concreteStages = ['financial_review', 'loi_discussion', 'loi_signed', 'due_diligence', 'financing', 'closing'];
    if (concreteStages.includes(deal.stage)) return 10;

    const hasMeetings  = interactions.some((i) => i.type === 'meeting');
    const hasDocsSent  = interactions.some((i) => i.type === 'document_sent' || i.type === 'loi');
    const hasProposal  = interactions.some((i) => i.type === 'proposal');

    if (hasMeetings && (hasDocsSent || hasProposal)) return 10;
    if (hasMeetings) return 5;
    if (interactions.length > 2) return 5;
    return 0;
  }

  _scoreStructureFit(deal, scenarios) {
    if (scenarios.some((s) => s.dscr >= 1.25)) return 10;
    if (scenarios.length > 0) return 5;

    // If deal has data that looks feasible
    if (deal.estimatedSDE && deal.askingPrice) {
      const multiple = deal.askingPrice / deal.estimatedSDE;
      if (multiple >= 2.5 && multiple <= 5.5) return 7;
      if (multiple < 7) return 5;
    }

    if (deal.estimatedRevenue || deal.estimatedSDE) return 5;
    return 0;
  }

  _scoreDealEconomics(deal, scenarios) {
    // Best DSCR check
    if (scenarios.length > 0) {
      const maxDSCR = Math.max(...scenarios.map((s) => s.dscr || 0));
      if (maxDSCR >= 1.5)  return 10;
      if (maxDSCR >= 1.25) return 7;
      if (maxDSCR > 0)     return 3;
    }

    // Revenue in target range?
    const rev = deal.estimatedRevenue || 0;
    const sde = deal.estimatedSDE || 0;
    if (rev >= 2_000_000 && rev <= 20_000_000 && sde >= 400_000) return 7;
    if (rev > 0 || sde > 0) return 5;

    return 0;
  }

  _scoreRiskPenalty(deal, company) {
    let penalty = 0;

    if (deal.riskLevel === 'critical') penalty -= 20;
    else if (deal.riskLevel === 'high') penalty -= 10;
    else if (deal.riskLevel === 'medium') penalty -= 5;

    if (deal.status === 'stalled') penalty -= 5;

    // Company has many negative signals
    const negativeSignals = [
      company?.reviewDeclineSignal,
      company?.linkedinInactiveSignal,
      company?.hiringSlowdownSignal,
    ].filter(Boolean).length;

    if (negativeSignals >= 2) penalty -= 5;

    return Math.max(-20, penalty); // cap penalty at -20
  }

  // ─── Main calculation ────────────────────────────────────────────────────────

  /**
   * Calculate probability score + band + factors.
   *
   * @param {object} deal
   * @param {object[]} interactions
   * @param {object[]} scenarios
   * @param {object|null} company
   * @returns {{ probabilityScore, probabilityBand, probabilityFactors, probabilityNotes }}
   */
  calculateProbabilityScore(deal, interactions = [], scenarios = [], company = null) {
    if (!deal) return null;

    const factors = this.calculateProbabilityFactors(deal, interactions, scenarios, company);

    const rawScore =
      factors.sellerMotivationStrength +
      factors.sellerTimelineStrength +
      factors.relationshipStrength +
      factors.financialTransparency +
      factors.responsiveness +
      factors.processMomentum +
      factors.structureFit +
      factors.dealEconomics +
      factors.riskPenalty;

    const probabilityScore = Math.max(0, Math.min(100, Math.round(rawScore)));
    const probabilityBand  = this.assignProbabilityBand(probabilityScore);

    const missingNotes = [];
    if (factors.sellerMotivationStrength === 0) missingNotes.push('seller motivation unknown');
    if (factors.sellerTimelineStrength === 0)   missingNotes.push('seller timeline unknown');
    if (factors.financialTransparency === 0)     missingNotes.push('no financial data shared');
    if (factors.relationshipStrength === 0)      missingNotes.push('no quality interactions logged');

    return {
      probabilityScore,
      probabilityBand,
      probabilityFactors: factors,
      probabilityNotes: missingNotes.length > 0
        ? `Score conservative due to: ${missingNotes.join(', ')}.`
        : null,
    };
  }

  /**
   * Compute and persist probability score directly on a deal record.
   */
  refreshDealProbability(deal, store) {
    if (!deal || deal.status === 'closed' || deal.status === 'lost') return deal;

    const company = deal.companyId
      ? (store.companies || []).find((c) => c.id === deal.companyId)
      : null;

    const interactions = (store.interactions || []).filter(
      (i) => i.companyId === deal.companyId || i.dealId === deal.id
    );

    const scenarios = (store.underwritingScenarios || []).filter((s) => s.dealId === deal.id);

    const result = this.calculateProbabilityScore(deal, interactions, scenarios, company);
    if (!result) return deal;

    deal.probabilityScore      = result.probabilityScore;
    deal.probabilityBand       = result.probabilityBand;
    deal.probabilityFactors    = result.probabilityFactors;
    deal.probabilityNotes      = result.probabilityNotes;
    deal.probabilityUpdatedAt  = new Date().toISOString();
    deal.updatedAt             = new Date().toISOString();

    return deal;
  }

  /**
   * Refresh probability for all active deals in the store.
   */
  refreshAllActiveDealProbabilities(store) {
    const activeDeals = (store.deals || []).filter((d) => d.status === 'active');
    for (const deal of activeDeals) {
      this.refreshDealProbability(deal, store);
    }
    return activeDeals.length;
  }

  /**
   * Explain what would raise or lower the score.
   * Deterministic — no AI required.
   */
  explainProbabilityScore(deal) {
    if (!deal?.probabilityFactors) return null;
    const f = deal.probabilityFactors;

    const topDrivers = [];
    const mainRisks  = [];
    const toImprove  = [];

    if (f.sellerMotivationStrength >= 15) topDrivers.push('Strong seller motivation signals');
    else toImprove.push('Clarify seller motivation and urgency');

    if (f.sellerTimelineStrength >= 10) topDrivers.push('Clear seller timeline established');
    else toImprove.push('Pin down seller timeline — immediate vs. 6-12 months');

    if (f.relationshipStrength >= 10) topDrivers.push('Strong relationship with multiple quality conversations');
    else toImprove.push('Schedule more quality conversations to build trust');

    if (f.financialTransparency >= 10) topDrivers.push('Financial data or documents shared');
    else toImprove.push('Request financial documents or at least high-level P&L');

    if (f.responsiveness >= 7) topDrivers.push('Seller is responsive');
    else mainRisks.push('Slow or inconsistent seller responsiveness');

    if (f.processMomentum >= 7) topDrivers.push('Concrete deal steps taken');
    else toImprove.push('Move to a concrete next step — meeting, NDA, or financial review');

    if (f.structureFit < 5) mainRisks.push('Structure viability not confirmed yet');
    if (f.dealEconomics < 5) mainRisks.push('Deal economics not validated');
    if (f.riskPenalty < -5)  mainRisks.push('Risk flags present — review deal risk level');

    return { topDrivers, mainRisks, actionsToImproveProbability: toImprove };
  }
}

export const DealProbabilityService = new DealProbabilityServiceClass();
export default DealProbabilityService;
