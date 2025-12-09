/**
 * Workflow DSL Generator
 * Builder pattern for creating workflow definitions that match dsl-schema.json
 */

/**
 * Create a new workflow
 * @param {string} flowId - Unique identifier for this workflow
 * @param {number} globalTimeout - Global timeout in milliseconds (default: 120000)
 * @returns {WorkflowBuilder}
 */
export function createWorkflow(flowId, globalTimeout = 120000) {
  return new WorkflowBuilder(flowId, globalTimeout);
}

class WorkflowBuilder {
  constructor(flowId, globalTimeout) {
    this.workflow = {
      flow_id: flowId,
      global_timeout_ms: globalTimeout,
      variables: [],
      supersteps: []
    };
  }

  /**
   * Add a variable to the workflow
   * @param {string} name - Variable name
   * @param {string} type - Variable type: 'string', 'json_object', or 'list'
   * @param {*} defaultValue - Optional default value
   */
  withVariable(name, type, defaultValue = undefined) {
    const variable = { name, type };
    if (defaultValue !== undefined) {
      variable.default_value = defaultValue;
    }
    this.workflow.variables.push(variable);
    return this;
  }

  /**
   * Add a superstep to the workflow
   * @param {SuperstepBuilder} superstep
   */
  withSuperstep(superstep) {
    this.workflow.supersteps.push(superstep.build());
    return this;
  }

  /**
   * Build the final workflow object
   */
  build() {
    return this.workflow;
  }
}

/**
 * Create a new superstep
 * @param {string} stepId - Unique step identifier
 * @param {string} description - Human-readable description
 * @returns {SuperstepBuilder}
 */
export function createSuperstep(stepId, description = '') {
  return new SuperstepBuilder(stepId, description);
}

class SuperstepBuilder {
  constructor(stepId, description) {
    this.superstep = {
      step_id: stepId,
      description,
      map_phase: {
        workers: []
      },
      reduce_phase: {
        strategy: 'simple_summary',
        model_ref: '',
        output_write_to: '',
        visibility: {}
      }
    };
    this.defaultRole = null;
  }

  /**
   * Set concurrency limit for map phase
   * @param {number} limit
   */
  withConcurrency(limit) {
    this.superstep.map_phase.concurrency_limit = limit;
    return this;
  }

  /**
   * Set global instruction overlay for map phase
   * @param {string} instruction
   */
  withGlobalInstruction(instruction) {
    this.superstep.map_phase.global_instruction_overlay = instruction;
    return this;
  }

  /**
   * Set default role definition for all workers in this phase
   * Individual workers can still override this
   * @param {string} roleDefinition
   */
  withDefaultRole(roleDefinition) {
    this.defaultRole = roleDefinition;
    return this;
  }

  /**
   * Add workers to the map phase
   * @param {Array<{worker_id: string, model_ref: string, role_definition?: string}>} workers
   */
  withWorkers(workers) {
    this.superstep.map_phase.workers = workers.map(w => ({
      worker_id: w.worker_id,
      model_ref: w.model_ref,
      role_definition: w.role_definition || this.defaultRole || ''
    }));
    return this;
  }

  /**
   * Add middleware to the superstep
   * @param {Array<{op: string, apply_to: string[], config: object}>} middlewares
   */
  withMiddleware(middlewares) {
    this.superstep.middleware_phase = middlewares;
    return this;
  }

  /**
   * Configure the reduce phase
   * @param {object} config
   * @param {string} config.strategy - Reduce strategy
   * @param {string} config.modelRef - Model reference
   * @param {string} config.outputWriteTo - Variable to write output to
   * @param {object} config.visibility - Visibility configuration
   * @param {string} [config.chairmanInstructions] - Instructions for chairman
   * @param {number} [config.timeout] - Timeout in milliseconds
   * @param {boolean} [config.variableInterpolation] - Enable variable interpolation
   */
  withReduce(config) {
    this.superstep.reduce_phase = {
      strategy: config.strategy,
      model_ref: config.modelRef,
      output_write_to: config.outputWriteTo,
      visibility: config.visibility
    };

    if (config.chairmanInstructions) {
      this.superstep.reduce_phase.chairman_instructions = config.chairmanInstructions;
    }

    if (config.timeout) {
      this.superstep.reduce_phase.timeout_ms = config.timeout;
    }

    if (config.variableInterpolation !== undefined) {
      this.superstep.reduce_phase.variable_interpolation = config.variableInterpolation;
    }

    return this;
  }

  /**
   * Build the superstep object
   */
  build() {
    return this.superstep;
  }
}

/**
 * Helper to create visibility configuration
 */
export const visibility = {
  /**
   * Full visibility - original input + worker outputs with identities
   */
  full() {
    return {
      include_original_input: true,
      mask_worker_identities: false
    };
  },

  /**
   * Blind review - anonymized worker outputs
   */
  blindReview() {
    return {
      include_original_input: true,
      mask_worker_identities: true
    };
  },

  /**
   * Clean subquery - only original input, no context or worker outputs
   */
  cleanSubquery() {
    return {
      include_original_input: true,
      include_conversation_history: false,
      include_worker_outputs: false,
      mask_worker_identities: true
    };
  },

  /**
   * Custom visibility configuration
   */
  custom(options) {
    return {
      include_original_input: options.includeOriginalInput ?? false,
      mask_worker_identities: options.maskWorkerIdentities ?? false,
      include_rejected_items: options.includeRejectedItems ?? false,
      include_conversation_history: options.includeConversationHistory ?? true,
      include_worker_outputs: options.includeWorkerOutputs ?? true
    };
  }
};

/**
 * Helper to create middleware configurations
 */
export const middleware = {
  /**
   * Filter by regex pattern
   * @param {string[]} applyTo - Worker IDs or ['*'] for all
   * @param {string} pattern - Regex pattern
   * @param {string} action - 'drop' or 'flag'
   */
  filterRegex(applyTo, pattern, action) {
    return {
      op: 'filter_regex',
      apply_to: applyTo,
      config: { pattern, action }
    };
  },

  /**
   * Truncate output
   * @param {string[]} applyTo - Worker IDs or ['*'] for all
   * @param {number} maxLength - Maximum length
   * @param {string} strategy - Truncation strategy (e.g., 'smart')
   */
  truncate(applyTo, maxLength, strategy = 'smart') {
    return {
      op: 'truncate',
      apply_to: applyTo,
      config: { max_length: maxLength, strategy }
    };
  },

  /**
   * LLM refine middleware
   * @param {string[]} applyTo - Worker IDs or ['*'] for all
   * @param {string} modelRef - Model to use for refinement
   * @param {string} instruction - Refinement instruction
   */
  llmRefine(applyTo, modelRef, instruction) {
    return {
      op: 'llm_refine',
      apply_to: applyTo,
      config: { model_ref: modelRef, instruction }
    };
  },

  /**
   * Anonymize PII
   * @param {string[]} applyTo - Worker IDs or ['*'] for all
   */
  anonymizePii(applyTo) {
    return {
      op: 'anonymize_pii',
      apply_to: applyTo,
      config: {}
    };
  }
};

/**
 * Reduce strategy constants
 */
export const strategies = {
  COUNCIL_CHAIRMAN: 'council_chairman',
  SIMPLE_SUMMARY: 'simple_summary',
  VOTE_MAJORITY: 'vote_majority',
  SUBQUERY_SINGLE_MODEL: 'subquery_single_model',
  CROSS_INTERROGATION: 'cross_interrogation'
};

/**
 * Common model references
 */
export const models = {
  GPT4: 'openai/gpt-4',
  GPT4_TURBO: 'openai/gpt-4-turbo',
  CLAUDE_SONNET: 'anthropic/claude-3.5-sonnet',
  GEMINI_FLASH: 'google/gemini-2.0-flash-exp'
};
