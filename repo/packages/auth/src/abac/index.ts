/**
 * Barrel export ABAC -- Sprint 7 Tache 2.3.6+.
 */

export {
  ALL_ABAC_RESOURCE_TYPES,
  AbacContextSchema,
  AbacResourceTypeSchema,
  buildAbacContext,
  isAbacResourceType,
  type AbacContext,
  type AbacDecisionReason,
  type AbacPolicy,
  type AbacResourceType,
  type AbacResult,
} from './types.js';

// Sprint 7 Tache 2.3.7 -- AbacService + 4 policies
export { AbacService } from './abac.service.js';
export { OwnResourcesPolicy } from './policies/own-resources.policy.js';
export { TimeBasedPolicy } from './policies/time-based.policy.js';
export { StatusBasedPolicy } from './policies/status-based.policy.js';
export { WorkflowStatePolicy } from './policies/workflow-state.policy.js';
