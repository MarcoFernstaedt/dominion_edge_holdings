/**
 * EmailAdapterContract.js
 *
 * Extended contract for email adapters (send, draft, thread sync).
 */
import { EmailAdapter, normalizedEmailRequest, normalizedEmailResult, CAPABILITIES } from './AdapterContract.js';

export class EmailAdapterBase extends EmailAdapter {
  constructor(name, extraCapabilities = []) {
    super(name);
    this.capabilities = [
      CAPABILITIES.SEND_EMAIL,
      CAPABILITIES.CREATE_DRAFT,
      CAPABILITIES.THREAD_SYNC,
      ...extraCapabilities,
    ];
  }

  /**
   * Validate the adapter config.
   * @returns {{ valid: boolean, missingFields: string[], warnings: string[] }}
   */
  validateConfig() {
    return { valid: true, missingFields: [], warnings: [] };
  }

  /**
   * Send an approved email message.
   * MUST be implemented by subclass.
   *
   * @param {ReturnType<normalizedEmailRequest>} request
   * @returns {Promise<ReturnType<normalizedEmailResult>>}
   */
  async send(request) {
    throw new Error(`${this.name}.send() not implemented`);
  }

  /**
   * Create an email draft (does not send).
   * Optional — subclass may leave unimplemented.
   *
   * @param {ReturnType<normalizedEmailRequest>} request
   * @returns {Promise<{ draftId: string|null, error: string|null }>}
   */
  async createDraft(request) {
    return { draftId: null, error: 'createDraft() not supported by this adapter' };
  }

  /**
   * Sync thread history for a contact/entity.
   * Optional.
   *
   * @param {{ contactEmail?: string, entityId?: string }} params
   * @returns {Promise<{ synced: number, error: string|null }>}
   */
  async syncThreads(params) {
    return { synced: 0, error: 'syncThreads() not supported by this adapter' };
  }
}

export { normalizedEmailRequest, normalizedEmailResult };
