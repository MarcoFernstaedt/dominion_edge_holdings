/**
 * SourceAdapterRegistryService
 *
 * Maintains the registry of all enabled lead-source adapters.
 * Runs health checks and persists status into the store's sourceAdapters collection.
 */

import { ManualImportAdapter }    from '../adapters/ManualImportAdapter.js';
import { ApolloLeadAdapter }      from '../adapters/ApolloLeadAdapter.js';
import { PublicDirectoryAdapter } from '../adapters/PublicDirectoryAdapter.js';
import { CustomSourceAdapter }    from '../adapters/CustomSourceAdapter.js';
import crypto from 'crypto';

class SourceAdapterRegistryClass {
  constructor() {
    this._adapters = new Map(); // adapterId → { meta, instance }
  }

  /**
   * Initialize the registry from store + settings.
   * Call once at server startup after store is available.
   */
  init(store, settings = {}) {
    this._store = store;

    // Ensure store has the collection
    if (!store.sourceAdapters) store.sourceAdapters = [];

    // Bootstrap default adapters if none exist
    if (store.sourceAdapters.length === 0) {
      this._bootstrapDefaults(settings);
    }

    // Instantiate adapter instances from persisted records
    this._rebuildInstances(settings);
  }

  _bootstrapDefaults(settings) {
    const now = new Date().toISOString();
    const defaults = [
      {
        id: crypto.randomUUID(),
        adapterName: 'Manual Import',
        adapterType: 'manual_import',
        isEnabled: true,
        config: {},
        status: 'healthy',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        adapterName: 'Apollo.io',
        adapterType: 'apollo',
        isEnabled: !!(settings.apolloApiKey),
        config: { apiKey: settings.apolloApiKey || '' },
        status: settings.apolloApiKey ? 'connected' : 'misconfigured',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        adapterName: 'Public Directory',
        adapterType: 'public_directory',
        isEnabled: false,
        config: { enabled: false },
        status: 'disabled',
        createdAt: now,
        updatedAt: now,
      },
    ];
    this._store.sourceAdapters = defaults;
  }

  _rebuildInstances(settings = {}) {
    this._adapters.clear();
    for (const record of (this._store?.sourceAdapters || [])) {
      const instance = this._createInstance(record, settings);
      if (instance) {
        this._adapters.set(record.id, { meta: record, instance });
      }
    }
  }

  _createInstance(record, settings = {}) {
    const cfg = { ...record.config };
    // Inject live settings into apollo adapter
    if (record.adapterType === 'apollo' && settings.apolloApiKey) {
      cfg.apiKey = settings.apolloApiKey;
    }
    switch (record.adapterType) {
      case 'manual_import':   return new ManualImportAdapter(cfg);
      case 'apollo':          return new ApolloLeadAdapter(cfg);
      case 'public_directory': return new PublicDirectoryAdapter(cfg);
      case 'custom_api':      return new CustomSourceAdapter(cfg);
      default:                return null;
    }
  }

  /** Return all enabled adapter entries with instances. */
  getEnabledAdapters() {
    return [...this._adapters.values()].filter((e) => e.meta.isEnabled);
  }

  /** Return all adapter metadata (for UI). */
  getAllAdapters() {
    return (this._store?.sourceAdapters || []).map((a) => ({
      ...a,
      config: { ...a.config, apiKey: a.config.apiKey ? '***' : undefined },
    }));
  }

  /** Get a specific adapter entry by id. */
  getAdapter(id) {
    return this._adapters.get(id) || null;
  }

  /** Run a health check on a single adapter and update its status in the store. */
  async runHealthCheck(adapterId) {
    const entry = this._adapters.get(adapterId);
    if (!entry) return { success: false, status: 'not_found', message: 'Adapter not found' };

    const now = new Date().toISOString();
    let result;
    try {
      result = await entry.instance.healthCheck();
    } catch (err) {
      result = { success: false, status: 'unreachable', message: err.message };
    }

    // Persist status
    const record = this._store.sourceAdapters.find((a) => a.id === adapterId);
    if (record) {
      record.status = result.status;
      record.updatedAt = now;
      if (result.success) {
        record.lastSuccessAt = now;
      } else {
        record.lastErrorAt  = now;
        record.lastErrorMessage = result.message;
      }
    }

    return result;
  }

  /** Run health checks on all adapters in parallel (errors caught per-adapter). */
  async runAllHealthChecks() {
    const results = {};
    await Promise.all(
      [...this._adapters.keys()].map(async (id) => {
        results[id] = await this.runHealthCheck(id);
      })
    );
    return results;
  }

  /** Add a new adapter record to the store. */
  addAdapter({ adapterName, adapterType, config = {} }) {
    const now = new Date().toISOString();
    const record = {
      id:          crypto.randomUUID(),
      adapterName,
      adapterType,
      isEnabled:   false,
      config,
      status:      'disabled',
      createdAt:   now,
      updatedAt:   now,
    };
    this._store.sourceAdapters.push(record);
    const instance = this._createInstance(record);
    if (instance) this._adapters.set(record.id, { meta: record, instance });
    return record;
  }

  /** Update an existing adapter's config / enabled state. */
  updateAdapter(adapterId, patch) {
    const record = (this._store?.sourceAdapters || []).find((a) => a.id === adapterId);
    if (!record) return null;
    Object.assign(record, patch, { updatedAt: new Date().toISOString() });
    // Rebuild instance with new config
    const instance = this._createInstance(record);
    if (instance) this._adapters.set(record.id, { meta: record, instance });
    return record;
  }
}

export const SourceAdapterRegistryService = new SourceAdapterRegistryClass();
export default SourceAdapterRegistryService;
