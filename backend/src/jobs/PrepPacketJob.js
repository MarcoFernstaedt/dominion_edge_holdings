/**
 * PrepPacketJob
 *
 * Finds meetings starting within the next 24 hours that do not yet have a
 * preparation packet generated and queues AI-assisted prep generation.
 * Runs every 30 minutes.
 */
import AuditLogService from '../../services/AuditLogService.js';

const PrepPacketJob = {
  id:         'prepPacket',
  name:       'Meeting Prep Packet Generator',
  intervalMs: 30 * 60 * 1000, // every 30 minutes

  /** @param {{ store: object, orchestrator: object }} ctx */
  async run({ store, orchestrator }) {
    const meetings = store.meetings || [];
    const now      = Date.now();
    const in24h    = now + 24 * 60 * 60 * 1000;

    const upcoming = meetings.filter((m) => {
      if (m.status === 'cancelled' || m.status === 'completed') return false;
      if (m.prepPacketGeneratedAt) return false; // already done
      const t = new Date(m.startsAt).getTime();
      return t > now && t <= in24h;
    });

    let generated = 0;
    for (const meeting of upcoming) {
      try {
        if (orchestrator && typeof orchestrator.run === 'function') {
          await orchestrator.run('MeetingPrepAgent', {
            meetingId: meeting.id,
            title:     meeting.title,
            attendees: meeting.attendees || [],
            startsAt:  meeting.startsAt,
          });
        }
        meeting.prepPacketGeneratedAt = new Date().toISOString();
        generated++;
      } catch {
        // Individual meeting failures should not abort the whole job
      }
    }

    AuditLogService.log('prep_packet_job_ran', 'system', 'PrepPacketJob', { upcoming: upcoming.length, generated });
    return { upcoming: upcoming.length, generated };
  },
};

export default PrepPacketJob;
