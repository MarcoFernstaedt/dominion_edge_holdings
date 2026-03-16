/**
 * AgentOrchestrator
 *
 * Central coordinator for agent execution.
 * - Agents return structured outputs; they never modify the database.
 * - The orchestrator decides whether proposed actions are applied.
 * - Records every agent run in the AuditLog.
 *
 * Standard output shape enforced:
 *   { agentName, analysisSummary, actionsProposed, confidenceScore, ...agentSpecificFields }
 */

import * as Agents from '../agents/index.js';
import AuditLogService from './AuditLogService.js';

const AGENT_MAP = {
  ResponseAnalysisAgent:    Agents.ResponseAnalysisAgent,
  CalendarSchedulingAgent:  Agents.CalendarSchedulingAgent,
  DailyOperationsAgent:     Agents.DailyOperationsAgent,
  BoardBuilderAgent:        Agents.BoardBuilderAgent,
  OutreachGenerationAgent:  Agents.OutreachGenerationAgent,
  OutreachExecutionAgent:   Agents.OutreachExecutionAgent,  // deterministic
  DealAnalysisAgent:        Agents.DealAnalysisAgent,
  CRMStewardAgent:          Agents.CRMStewardAgent,
  LeadDiscoveryAgent:       Agents.LeadDiscoveryAgent,
  TargetQualificationAgent: Agents.TargetQualificationAgent,
  StrategyAdvisorAgent:     Agents.StrategyAdvisorAgent,
};

/**
 * Run a named agent and return its structured output.
 *
 * @param {string} agentName  One of the 11 registered agents
 * @param {object} input      Agent-specific input
 * @returns {Promise<object>} Standard output shape
 */
export async function run(agentName, input) {
  const agent = AGENT_MAP[agentName];
  if (!agent) {
    throw new Error(`Unknown agent: ${agentName}`);
  }

  const startMs = Date.now();
  let output;
  let success = true;
  let errorMsg = null;

  try {
    output = await agent(input);
  } catch (err) {
    success = false;
    errorMsg = err.message;
    throw err;
  } finally {
    // Audit every agent run regardless of outcome
    AuditLogService.log(
      AuditLogService.AUDIT_EVENTS.AGENT_RUN,
      'agent',
      agentName,
      {
        agentName,
        durationMs: Date.now() - startMs,
        success,
        error: errorMsg,
        entityId: input.entityId,
        confidenceScore: output?.confidenceScore ?? null,
      }
    );
  }

  // Enforce standard output shape — add missing fields with safe defaults
  return normalizeOutput(agentName, output);
}

/**
 * Validate/normalize output into the standard shape.
 * Agents SHOULD return the full shape; this is a safety net.
 */
function normalizeOutput(agentName, raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      agentName,
      analysisSummary: 'Agent returned no output',
      actionsProposed: [],
      confidenceScore: 0,
    };
  }
  return {
    agentName:       raw.agentName       ?? agentName,
    analysisSummary: raw.analysisSummary ?? '',
    actionsProposed: Array.isArray(raw.actionsProposed) ? raw.actionsProposed : [],
    confidenceScore: typeof raw.confidenceScore === 'number' ? raw.confidenceScore : 0,
    ...raw,
  };
}

/** List all registered agents with their names. */
export function listAgents() {
  return Object.keys(AGENT_MAP).map((name) => ({
    name,
    isDeterministic: name === 'OutreachExecutionAgent',
  }));
}

export const AgentOrchestrator = { run, listAgents };
export default AgentOrchestrator;
