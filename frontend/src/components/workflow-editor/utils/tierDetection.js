/**
 * Tier Detection Utilities
 * Automatically detects whether a wizard state requires Basic or Advanced tier
 * based on complexity signals and feature usage
 */

/**
 * Tier levels
 */
export const TIERS = {
  BASIC: 'basic',
  ADVANCED: 'advanced'
};

/**
 * Features that require Advanced tier
 */
const ADVANCED_FEATURES = {
  MULTI_SUPERSTEP: 'multiSuperstep',
  MIDDLEWARE: 'middleware',
  VARIABLE_INTERPOLATION: 'variableInterpolation',
  SCOPE_ALIGNMENT: 'scopeAlignment',
  CONCURRENCY_LIMIT: 'concurrencyLimit',
  ADVANCED_VISIBILITY: 'advancedVisibility',
  COLUMN_WISE_SUMMARY: 'columnWiseSummary',
  CUSTOM_VARIABLES: 'customVariables'
};

/**
 * Extract complexity signals from wizard state
 *
 * @param {Object} wizardState - Current wizard state
 * @returns {Object} - Object with boolean flags for each advanced feature
 */
export function extractComplexitySignals(wizardState) {
  return {
    // Multi-superstep: More than one superstep (follow-up steps)
    [ADVANCED_FEATURES.MULTI_SUPERSTEP]:
      (wizardState.followUpSteps && wizardState.followUpSteps.length > 0) || false,

    // Middleware: Any middleware operations configured
    [ADVANCED_FEATURES.MIDDLEWARE]:
      (wizardState.middleware && wizardState.middleware.length > 0) || false,

    // Variable interpolation: User enabled variable interpolation
    [ADVANCED_FEATURES.VARIABLE_INTERPOLATION]:
      wizardState.variableInterpolation === true,

    // Scope alignment: User enabled scope alignment
    [ADVANCED_FEATURES.SCOPE_ALIGNMENT]:
      wizardState.scopeAlignment?.enabled === true,

    // Concurrency limit: User set a concurrency limit
    [ADVANCED_FEATURES.CONCURRENCY_LIMIT]:
      wizardState.concurrencyLimit !== null && wizardState.concurrencyLimit !== undefined,

    // Advanced visibility: User configured advanced visibility options
    [ADVANCED_FEATURES.ADVANCED_VISIBILITY]:
      wizardState.advancedVisibility?.includeRejectedItems === true ||
      wizardState.advancedVisibility?.includeConversationHistory === false,

    // Column-wise summary: User enabled per-perspective summaries
    [ADVANCED_FEATURES.COLUMN_WISE_SUMMARY]:
      wizardState.useColumnWiseSummary === true,

    // Custom variables: User defined custom variables beyond defaults
    [ADVANCED_FEATURES.CUSTOM_VARIABLES]:
      (wizardState.variables && wizardState.variables.length > 0) || false
  };
}

/**
 * Detect the minimum required tier based on wizard state
 *
 * @param {Object} wizardState - Current wizard state
 * @returns {'basic' | 'advanced'} - Required tier level
 */
export function detectTier(wizardState) {
  const signals = extractComplexitySignals(wizardState);

  // If ANY advanced feature is in use, require Advanced tier
  const hasAdvancedFeatures = Object.values(signals).some(value => value === true);

  return hasAdvancedFeatures ? TIERS.ADVANCED : TIERS.BASIC;
}

/**
 * Check if it's safe to downgrade from Advanced to Basic tier
 *
 * @param {Object} wizardState - Current wizard state
 * @returns {Object} - { canDowngrade: boolean, blockers: string[] }
 */
export function canDowngradeToBasic(wizardState) {
  const signals = extractComplexitySignals(wizardState);
  const blockers = [];

  // Check each advanced feature
  if (signals[ADVANCED_FEATURES.MULTI_SUPERSTEP]) {
    blockers.push('Follow-up steps are configured');
  }
  if (signals[ADVANCED_FEATURES.MIDDLEWARE]) {
    blockers.push('Middleware operations are configured');
  }
  if (signals[ADVANCED_FEATURES.VARIABLE_INTERPOLATION]) {
    blockers.push('Variable interpolation is enabled');
  }
  if (signals[ADVANCED_FEATURES.SCOPE_ALIGNMENT]) {
    blockers.push('Scope alignment is enabled');
  }
  if (signals[ADVANCED_FEATURES.CONCURRENCY_LIMIT]) {
    blockers.push('Concurrency limit is set');
  }
  if (signals[ADVANCED_FEATURES.ADVANCED_VISIBILITY]) {
    blockers.push('Advanced visibility controls are configured');
  }
  if (signals[ADVANCED_FEATURES.COLUMN_WISE_SUMMARY]) {
    blockers.push('Column-wise summary is enabled');
  }
  if (signals[ADVANCED_FEATURES.CUSTOM_VARIABLES]) {
    blockers.push('Custom variables are defined');
  }

  return {
    canDowngrade: blockers.length === 0,
    blockers
  };
}

/**
 * Get feature count for Advanced tier
 *
 * @param {Object} wizardState - Current wizard state
 * @returns {number} - Number of advanced features in use
 */
export function getAdvancedFeatureCount(wizardState) {
  const signals = extractComplexitySignals(wizardState);
  return Object.values(signals).filter(value => value === true).length;
}

/**
 * Get human-readable feature names
 *
 * @param {Object} wizardState - Current wizard state
 * @returns {string[]} - Array of active advanced feature names
 */
export function getActiveAdvancedFeatures(wizardState) {
  const signals = extractComplexitySignals(wizardState);
  const featureNames = {
    [ADVANCED_FEATURES.MULTI_SUPERSTEP]: 'Multi-step workflows',
    [ADVANCED_FEATURES.MIDDLEWARE]: 'Middleware pipeline',
    [ADVANCED_FEATURES.VARIABLE_INTERPOLATION]: 'Variable interpolation',
    [ADVANCED_FEATURES.SCOPE_ALIGNMENT]: 'Scope alignment',
    [ADVANCED_FEATURES.CONCURRENCY_LIMIT]: 'Concurrency limiting',
    [ADVANCED_FEATURES.ADVANCED_VISIBILITY]: 'Advanced visibility controls',
    [ADVANCED_FEATURES.COLUMN_WISE_SUMMARY]: 'Per-perspective summaries',
    [ADVANCED_FEATURES.CUSTOM_VARIABLES]: 'Custom variables'
  };

  return Object.entries(signals)
    .filter(([_, value]) => value === true)
    .map(([feature, _]) => featureNames[feature]);
}

/**
 * Create initial complexity signals object (all false)
 *
 * @returns {Object} - Initial complexity signals
 */
export function createInitialComplexitySignals() {
  return {
    [ADVANCED_FEATURES.MULTI_SUPERSTEP]: false,
    [ADVANCED_FEATURES.MIDDLEWARE]: false,
    [ADVANCED_FEATURES.VARIABLE_INTERPOLATION]: false,
    [ADVANCED_FEATURES.SCOPE_ALIGNMENT]: false,
    [ADVANCED_FEATURES.CONCURRENCY_LIMIT]: false,
    [ADVANCED_FEATURES.ADVANCED_VISIBILITY]: false,
    [ADVANCED_FEATURES.COLUMN_WISE_SUMMARY]: false,
    [ADVANCED_FEATURES.CUSTOM_VARIABLES]: false
  };
}

/**
 * Validate tier transition
 *
 * @param {string} fromTier - Current tier
 * @param {string} toTier - Target tier
 * @param {Object} wizardState - Current wizard state
 * @returns {Object} - { valid: boolean, message: string }
 */
export function validateTierTransition(fromTier, toTier, wizardState) {
  // Upgrading is always allowed
  if (fromTier === TIERS.BASIC && toTier === TIERS.ADVANCED) {
    return {
      valid: true,
      message: 'Upgrading to Advanced tier will unlock additional configuration options.'
    };
  }

  // Downgrading requires checking for advanced features
  if (fromTier === TIERS.ADVANCED && toTier === TIERS.BASIC) {
    const { canDowngrade, blockers } = canDowngradeToBasic(wizardState);

    if (!canDowngrade) {
      return {
        valid: false,
        message: `Cannot downgrade to Basic tier. The following features must be removed first: ${blockers.join(', ')}`
      };
    }

    return {
      valid: true,
      message: 'Downgrading to Basic tier will simplify the interface.'
    };
  }

  // Same tier
  return {
    valid: true,
    message: 'Already at this tier level.'
  };
}
