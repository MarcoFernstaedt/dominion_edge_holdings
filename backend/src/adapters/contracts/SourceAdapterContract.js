/**
 * SourceAdapterContract.js
 *
 * Extended contract for source adapters (lead/company discovery & enrichment).
 * All source adapter implementations must satisfy this interface.
 */
import { SourceAdapter, normalizedSourceRecord, CAPABILITIES } from './AdapterContract.js';

export class SourceAdapterBase extends SourceAdapter {
  /**
   * @param {string} name  Unique adapter name e.g. 'apollo', 'manual_import'
   * @param {string[]} extraCapabilities  Additional capabilities beyond the base source set
   */
  constructor(name, extraCapabilities = []) {
    super(name);
    this.capabilities = [
      CAPABILITIES.LEAD_DISCOVERY,
      CAPABILITIES.CONTACT_ENRICHMENT,
      CAPABILITIES.COMPANY_LOOKUP,
      ...extraCapabilities,
    ];
  }

  /**
   * Validate the adapter config before use.
   * Override in subclass.
   * @returns {{ valid: boolean, missingFields: string[], warnings: string[] }}
   */
  validateConfig() {
    return { valid: true, missingFields: [], warnings: [] };
  }

  /**
   * Run a discovery/enrichment query.
   * MUST be implemented by subclass.
   *
   * @param {{ industry?: string, state?: string, keywords?: string[], limit?: number }} query
   * @returns {Promise<ReturnType<normalizedSourceRecord>[]>}
   */
  async run(query) {
    throw new Error(`${this.name}.run() not implemented`);
  }

  /**
   * Enrich a single company by domain or name.
   * Optional — subclass may leave unimplemented.
   *
   * @param {{ name?: string, domain?: string }} target
   * @returns {Promise<ReturnType<normalizedSourceRecord>|null>}
   */
  async enrich(target) {
    return null;
  }
}

export { normalizedSourceRecord };
