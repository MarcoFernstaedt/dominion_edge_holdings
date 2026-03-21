/**
 * IntegrationRegistry.js — Canonical adapter registry.
 *
 * All adapters must be registered here. This registry is the single source of
 * truth for which integrations are configured, their health, and their
 * capabilities.
 *
 * This is the new-architecture version. The legacy services/IntegrationRegistry.js
 * continues to operate; this file extends it with the formal registry pattern.
 */
import { ADAPTER_STATUS } from '../contracts/AdapterContract.js';

class IntegrationRegistryClass {
  constructor() {
    /** @type {Map<string, import('../contracts/AdapterContract.js').BaseAdapter>} */
    this._adapters = new Map();
  }

  /**
   * Register an adapter instance.
   * @param {import('../contracts/AdapterContract.js').BaseAdapter} adapter
   */
  register(adapter) {
    if (this._adapters.has(adapter.name)) {
      console.warn(`[IntegrationRegistry] Overwriting existing adapter: ${adapter.name}`);
    }
    this._adapters.set(adapter.name, adapter);
  }

  /**
   * Get an adapter by name.
   * @param {string} name
   * @returns {import('../contracts/AdapterContract.js').BaseAdapter|null}
   */
  get(name) {
    return this._adapters.get(name) ?? null;
  }

  /**
   * Get all registered adapters.
   * @returns {import('../contracts/AdapterContract.js').BaseAdapter[]}
   */
  all() {
    return Array.from(this._adapters.values());
  }

  /**
   * Get adapters that have a specific capability.
   * @param {string} capability
   * @returns {import('../contracts/AdapterContract.js').BaseAdapter[]}
   */
  withCapability(capability) {
    return this.all().filter((a) => a.capabilities.includes(capability));
  }

  /**
   * Get adapters that are currently available (healthy or degraded).
   * @returns {import('../contracts/AdapterContract.js').BaseAdapter[]}
   */
  available() {
    return this.all().filter((a) => a.available);
  }

  /**
   * Run health checks on all registered adapters.
   * @returns {Promise<Record<string, object>>}
   */
  async healthCheckAll() {
    const results = {};
    for (const [name, adapter] of this._adapters) {
      try {
        results[name] = await adapter.healthCheck();
      } catch (err) {
        results[name] = { ok: false, error: err.message, status: ADAPTER_STATUS.UNAVAILABLE };
      }
    }
    return results;
  }

  /**
   * Normalized status summary for /api/integrations/status.
   * @returns {object[]}
   */
  statusSummary() {
    return this.all().map((a) => a.getStatusSummary());
  }

  /**
   * Validate config for all registered adapters.
   * Returns only adapters with validation issues.
   * @returns {{ name: string, issues: object }[]}
   */
  validateAll() {
    const issues = [];
    for (const adapter of this.all()) {
      if (typeof adapter.validateConfig === 'function') {
        const result = adapter.validateConfig();
        if (!result.valid || result.warnings.length > 0) {
          issues.push({ name: adapter.name, issues: result });
        }
      }
    }
    return issues;
  }
}

// Singleton
const IntegrationRegistry = new IntegrationRegistryClass();
export default IntegrationRegistry;
