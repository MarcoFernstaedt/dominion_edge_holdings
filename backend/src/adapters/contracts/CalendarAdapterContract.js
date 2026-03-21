/**
 * CalendarAdapterContract.js
 *
 * Extended contract for calendar adapters (meeting creation/update/cancel).
 */
import { CalendarAdapter, normalizedMeetingRequest, normalizedCalendarResult, CAPABILITIES } from './AdapterContract.js';

export class CalendarAdapterBase extends CalendarAdapter {
  constructor(name, extraCapabilities = []) {
    super(name);
    this.capabilities = [
      CAPABILITIES.CREATE_MEETING,
      CAPABILITIES.UPDATE_MEETING,
      CAPABILITIES.CANCEL_MEETING,
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
   * Create a meeting on the calendar.
   * MUST be implemented by subclass.
   *
   * @param {ReturnType<normalizedMeetingRequest>} request
   * @returns {Promise<ReturnType<normalizedCalendarResult>>}
   */
  async createMeeting(request) {
    throw new Error(`${this.name}.createMeeting() not implemented`);
  }

  /**
   * Update an existing meeting.
   * Optional.
   *
   * @param {string} calendarEventId
   * @param {Partial<ReturnType<normalizedMeetingRequest>>} updates
   * @returns {Promise<ReturnType<normalizedCalendarResult>>}
   */
  async updateMeeting(calendarEventId, updates) {
    return normalizedCalendarResult({
      success: false,
      error:   'updateMeeting() not supported by this adapter',
    });
  }

  /**
   * Cancel a meeting.
   * Optional.
   *
   * @param {string} calendarEventId
   * @returns {Promise<ReturnType<normalizedCalendarResult>>}
   */
  async cancelMeeting(calendarEventId) {
    return normalizedCalendarResult({
      success: false,
      error:   'cancelMeeting() not supported by this adapter',
    });
  }
}

export { normalizedMeetingRequest, normalizedCalendarResult };
