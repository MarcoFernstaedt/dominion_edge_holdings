import { z }         from 'zod';
import TimingEngine  from '../../services/TimingEngine.js';
import RecoveryEngine from '../../services/RecoveryEngine.js';
import ALL_THRESHOLDS from '../../services/CadenceThresholds.js';
import { validate }  from '../middleware/validate.js';
import { errorResponse } from '../middleware/errorResponse.js';

export function timingSummary(req, res) {
  try {
    const entitySets = req.body ?? {};
    res.json(TimingEngine.generateTimingSummary(entitySets));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export function timingAlerts(req, res) {
  try {
    const entitySets = req.body ?? {};
    const alerts = TimingEngine.generateSlaAlerts(entitySets);
    res.json({ total: alerts.length, alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export function getThresholds(_req, res) {
  res.json(ALL_THRESHOLDS);
}

export function timingEntity(req, res) {
  const { entityType } = req.params;
  const entity = { id: req.params.id, ...(req.body ?? {}) };

  try {
    let result;
    switch (entityType) {
      case 'task':            result = TimingEngine.calcTaskSlaState(entity);        break;
      case 'deal':            result = TimingEngine.calcDealVelocityState(entity);   break;
      case 'deal_heat':       result = TimingEngine.calcDealHeat(entity);            break;
      case 'relationship':    result = TimingEngine.calcRelationshipState(entity);   break;
      case 'board_candidate': result = TimingEngine.calcBoardCandidateState(entity); break;
      case 'board_seat':      result = TimingEngine.calcBoardSeatTiming(entity);     break;
      case 'diligence_issue': result = TimingEngine.calcDiligenceIssueSla(entity);   break;
      case 'meeting':         result = TimingEngine.calcMeetingState(entity);        break;
      case 'investor':        result = TimingEngine.calcInvestorState(entity);       break;
      case 'approval':        result = TimingEngine.calcApprovalState(entity);       break;
      case 'artifact':        result = TimingEngine.calcArtifactStaleness(entity);   break;
      default:
        return res.status(400).json({ error: `Unknown entity type: ${entityType}` });
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export function generateRecovery(req, res) {
  try {
    const { entity_sets = {}, entity_maps = {} } = req.body ?? {};
    const slaAlerts       = TimingEngine.generateSlaAlerts(entity_sets);
    const recoveryActions = RecoveryEngine.generateRecoveryActions(slaAlerts, entity_maps);
    res.json({
      sla_alert_count:       slaAlerts.length,
      recovery_action_count: recoveryActions.length,
      critical_count:        recoveryActions.filter((a) => a.severity === 'critical_intervention').length,
      urgent_count:          recoveryActions.filter((a) => a.severity === 'urgent_recovery').length,
      actions:               recoveryActions,
      generated_at:          new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export const applyRecoveryTaskPackValidate = validate(z.object({
  recovery_action: z.object({
    recovery_id: z.string(),
    action_type: z.string(),
    severity:    z.string(),
    title:       z.string(),
    reason:      z.string(),
    entity_type: z.string(),
    entity_id:   z.string().nullable().optional(),
    due_at:      z.string().optional(),
    priority:    z.string().optional(),
  }),
}));
export function applyRecoveryTaskPack(req, res) {
  try {
    const pack = RecoveryEngine.buildRecoveryTaskPack(req.validated.recovery_action);
    res.status(201).json(pack);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
