/**
 * Agent registry for Dominion Edge Holdings AOS
 *
 * All agents use AIService.run() — never call model APIs directly.
 * All agents return the standard output shape:
 *   { agentName, analysisSummary, actionsProposed, confidenceScore, ...agentSpecificFields }
 *
 * Platform services (not agents) decide whether proposed actions are executed.
 */

export { ResponseAnalysisAgent }  from './responseAnalysis.js';
export { CalendarSchedulingAgent } from './calendarScheduling.js';
export { DailyOperationsAgent }   from './dailyOperations.js';
export { BoardBuilderAgent }      from './boardBuilder.js';
export { OutreachGenerationAgent } from './outreachGeneration.js';
export { OutreachExecutionAgent } from './outreachExecution.js';
export { DealAnalysisAgent }      from './dealAnalysis.js';
export { CRMStewardAgent }        from './crmSteward.js';
export { LeadDiscoveryAgent }     from './leadDiscovery.js';
export { TargetQualificationAgent } from './targetQualification.js';
export { StrategyAdvisorAgent }   from './strategyAdvisor.js';
export { ConversationPreparationAgent } from './conversationPreparation.js';
export { DealProbabilityCommentaryAgent } from './dealProbabilityCommentary.js';
