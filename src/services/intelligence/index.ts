/**
 * Unified intelligence service module.
 *
 * Re-exports from the threat-classifier (now intent-classifier) service.
 */

// Intent classification (keyword + AI)
export {
  classifyByKeyword,
  classifyWithAI,
  aggregateIntents,
  INTENT_PRIORITY,
} from '../threat-classifier';
export type { IntentClassification, IntentLevel, SignalCategory } from '../threat-classifier';
