/**
 * Strategy Templates - Pre-configured workflow patterns
 * Maps high-level deliberation strategies to DSL structures
 */

import { strategies, models, visibility } from '../../../workflowGenerator.js';

export const INTERACTION_MODES = {
  INDEPENDENT_SYNTHESIS: 'independent_synthesis',
  MAJORITY_VOTE: 'majority_vote',
  CROSS_EXAMINATION: 'cross_examination',
  SINGLE_HELPER: 'single_helper',
  DEBATE: 'debate',
  BLIND_REVIEW: 'blind_review',
  VOTING: 'voting',
  MULTI_STAGE: 'multi_stage'
};

export const DECISION_MAKER_TYPES = {
  CHAIRMAN: 'chairman',
  MAJORITY_VOTE: 'majority_vote',
  SPECIFIC_EXPERT: 'specific_expert'
};

export const VISIBILITY_MODES = {
  FULL: 'full',
  BLIND: 'blind',
  PARTIAL: 'partial'
};

/**
 * Get the appropriate DSL reduce strategy for an interaction mode
 */
export function getReduceStrategy(interactionMode) {
  const strategyMap = {
    [INTERACTION_MODES.INDEPENDENT_SYNTHESIS]: strategies.COUNCIL_CHAIRMAN,
    [INTERACTION_MODES.MAJORITY_VOTE]: strategies.VOTE_MAJORITY,
    [INTERACTION_MODES.CROSS_EXAMINATION]: strategies.CROSS_INTERROGATION,
    [INTERACTION_MODES.SINGLE_HELPER]: strategies.SUBQUERY_SINGLE_MODEL,
    [INTERACTION_MODES.DEBATE]: strategies.CROSS_INTERROGATION,
    [INTERACTION_MODES.BLIND_REVIEW]: strategies.COUNCIL_CHAIRMAN,
    [INTERACTION_MODES.VOTING]: strategies.VOTE_MAJORITY,
    [INTERACTION_MODES.MULTI_STAGE]: strategies.COUNCIL_CHAIRMAN
  };

  return strategyMap[interactionMode] || strategies.COUNCIL_CHAIRMAN;
}

/**
 * Get the appropriate visibility configuration
 * @param {string} visibilityMode - Basic visibility mode (full, blind, partial)
 * @param {Object} advancedVisibility - Optional advanced visibility overrides
 */
export function getVisibilityConfig(visibilityMode, advancedVisibility = null) {
  const visibilityMap = {
    [VISIBILITY_MODES.FULL]: visibility.full(),
    [VISIBILITY_MODES.BLIND]: visibility.blindReview(),
    [VISIBILITY_MODES.PARTIAL]: visibility.custom({
      includeOriginalInput: true,
      maskWorkerIdentities: false,
      includeRejectedItems: false,
      includeConversationHistory: false,
      includeWorkerOutputs: true
    })
  };

  // Get base visibility config
  let config = visibilityMap[visibilityMode] || visibility.full();

  // Apply advanced visibility overrides if provided (Advanced tier)
  if (advancedVisibility) {
    config = visibility.custom({
      ...config,
      ...advancedVisibility
    });
  }

  return config;
}

/**
 * Get default chairman model based on context
 */
export function getDefaultChairmanModel(perspectives) {
  // Use a stronger model than the workers for synthesis
  const workerModels = perspectives.map(p => p.model);

  // If all workers use GPT-4, use GPT-4 Turbo for chairman
  if (workerModels.every(m => m === models.GPT4)) {
    return models.GPT4_TURBO;
  }

  // Otherwise default to GPT-4
  return models.GPT4;
}

/**
 * Get the number of supersteps required for a strategy
 */
export function getSuperstepCount(interactionMode) {
  const stepCounts = {
    [INTERACTION_MODES.INDEPENDENT_SYNTHESIS]: 1,
    [INTERACTION_MODES.DEBATE]: 3, // responses → questions → answers
    [INTERACTION_MODES.BLIND_REVIEW]: 1,
    [INTERACTION_MODES.VOTING]: 1,
    [INTERACTION_MODES.MULTI_STAGE]: 3 // perspectives → review → synthesis
  };

  return stepCounts[interactionMode] || 1;
}

/**
 * Get strategy description for UI display
 */
export function getStrategyDescription(interactionMode) {
  const descriptions = {
    [INTERACTION_MODES.INDEPENDENT_SYNTHESIS]:
      'Delegates provide independent responses, then a collector synthesizes them into a final answer.',
    [INTERACTION_MODES.MAJORITY_VOTE]:
      'Delegates vote on options, and majority opinion becomes the final decision.',
    [INTERACTION_MODES.CROSS_EXAMINATION]:
      'Delegates respond, then cross-examine each other through Q&A to uncover deeper insights.',
    [INTERACTION_MODES.SINGLE_HELPER]:
      'A single AI delegate answers the question directly (simple subquery).',
    [INTERACTION_MODES.DEBATE]:
      'Delegates respond, then cross-examine each other through Q&A to uncover deeper insights.',
    [INTERACTION_MODES.BLIND_REVIEW]:
      'Delegates provide responses anonymously (Response A, B, C...) to prevent brand bias.',
    [INTERACTION_MODES.VOTING]:
      'Delegates vote on options, and majority opinion becomes the final decision.',
    [INTERACTION_MODES.MULTI_STAGE]:
      'Delegates respond, peer reviewers critique, then a collector synthesizes the final answer.'
  };

  return descriptions[interactionMode] || '';
}

/**
 * Check if a strategy supports specific features
 */
export function strategySupportsFeature(interactionMode, feature) {
  const featureSupport = {
    chairman_instructions: [
      INTERACTION_MODES.INDEPENDENT_SYNTHESIS,
      INTERACTION_MODES.DEBATE,
      INTERACTION_MODES.BLIND_REVIEW,
      INTERACTION_MODES.MULTI_STAGE
    ],
    visibility_controls: [
      INTERACTION_MODES.INDEPENDENT_SYNTHESIS,
      INTERACTION_MODES.BLIND_REVIEW,
      INTERACTION_MODES.MULTI_STAGE
    ],
    cross_interrogation: [
      INTERACTION_MODES.DEBATE
    ],
    anonymous_review: [
      INTERACTION_MODES.BLIND_REVIEW
    ]
  };

  return featureSupport[feature]?.includes(interactionMode) || false;
}
