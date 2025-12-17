/**
 * ============================================================================
 * DEFAULT MODELS CONFIGURATION
 * ============================================================================
 *
 * This file defines the default model library for the LLM Council workflow wizard.
 *
 * DEVELOPERS: To modify the default model list:
 * 1. Edit the DEFAULT_MODELS array below
 * 2. Use model IDs from https://openrouter.ai/models
 * 3. Ensure modelRef matches OpenRouter's exact model identifier
 *
 * NOTE: These defaults are used ONLY in the wizard UI. The backend can support
 * any OpenRouter model - this list is just for convenience in the wizard.
 *
 * ============================================================================
 */

/**
 * Default model library
 * These models are always available in the workflow wizard and cannot be removed by users.
 * Users can add additional custom models on top of these defaults.
 */
const DEFAULT_MODELS = [
  {
    id: 'default_gpt4',
    label: 'GPT-4',
    modelRef: 'openai/gpt-4',
    isDefault: true,
    description: 'OpenAI GPT-4 - General purpose, highly capable'
  },
  {
    id: 'default_gpt4_turbo',
    label: 'GPT-4 Turbo',
    modelRef: 'openai/gpt-4-turbo',
    isDefault: true,
    description: 'Faster GPT-4 variant with 128k context'
  },
  {
    id: 'default_claude_sonnet',
    label: 'Claude Sonnet',
    modelRef: 'anthropic/claude-3.5-sonnet',
    isDefault: true,
    description: 'Anthropic Claude 3.5 Sonnet - Excellent reasoning'
  },
  {
    id: 'default_gemini_flash',
    label: 'Gemini Flash',
    modelRef: 'google/gemini-2.0-flash-exp',
    isDefault: true,
    description: 'Google Gemini 2.0 Flash - Fast and cost-effective'
  }
];

/**
 * Get default models for wizard initialization
 * @returns {Array} Copy of default models array
 */
export function getDefaultModels() {
  return [...DEFAULT_MODELS]; // Return copy to prevent mutation
}

/**
 * Get model references only (for backward compatibility)
 * Used by existing code that imports `models` from workflowGenerator.js
 */
export const models = {
  GPT4: 'openai/gpt-4',
  GPT4_TURBO: 'openai/gpt-4-turbo',
  CLAUDE_SONNET: 'anthropic/claude-3.5-sonnet',
  GEMINI_FLASH: 'google/gemini-2.0-flash-exp'
};

/**
 * Convert globalModels array to MODEL_OPTIONS format for dropdowns
 * @param {Array} globalModels - Array of model objects with id, label, modelRef, isDefault
 * @returns {Array} Array of dropdown options with value, label, isDefault
 */
export function modelsToOptions(globalModels) {
  if (!globalModels || globalModels.length === 0) {
    return getDefaultModels().map(model => ({
      value: model.modelRef,
      label: model.label,
      isDefault: model.isDefault
    }));
  }

  return globalModels.map(model => ({
    value: model.modelRef,
    label: model.label,
    isDefault: model.isDefault
  }));
}
