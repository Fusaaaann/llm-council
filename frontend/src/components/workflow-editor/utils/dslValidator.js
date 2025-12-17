/**
 * DSL Validator
 * Client-side validation for DSL workflow definitions
 * Validates against dsl-schema.json structure
 */

/**
 * Validate workflow structure against DSL schema
 * This is a simplified client-side validator (full validation happens server-side)
 *
 * @param {Object} workflow - DSL workflow object
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validateWorkflowDSL(workflow) {
  const errors = [];

  // Required top-level fields
  if (!workflow.flow_id || typeof workflow.flow_id !== 'string') {
    errors.push('flow_id is required and must be a string');
  }

  if (!workflow.supersteps || !Array.isArray(workflow.supersteps)) {
    errors.push('supersteps is required and must be an array');
  } else if (workflow.supersteps.length === 0) {
    errors.push('At least one superstep is required');
  }

  // Validate models array if present
  if (workflow.models && !Array.isArray(workflow.models)) {
    errors.push('models must be an array');
  }

  // Validate variables array if present
  if (workflow.variables) {
    if (!Array.isArray(workflow.variables)) {
      errors.push('variables must be an array');
    } else {
      workflow.variables.forEach((variable, idx) => {
        if (!variable.name || typeof variable.name !== 'string') {
          errors.push(`variables[${idx}]: name is required and must be a string`);
        }
        if (!variable.type || !['string', 'json_object', 'list'].includes(variable.type)) {
          errors.push(`variables[${idx}]: type must be one of: string, json_object, list`);
        }
      });
    }
  }

  // Validate each superstep
  if (workflow.supersteps && Array.isArray(workflow.supersteps)) {
    workflow.supersteps.forEach((superstep, idx) => {
      validateSuperstep(superstep, idx, errors);
    });
  }

  // Validate scope_alignment if present
  if (workflow.scope_alignment) {
    validateScopeAlignment(workflow.scope_alignment, errors);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate a single superstep
 */
function validateSuperstep(superstep, index, errors) {
  const prefix = `supersteps[${index}]`;

  // Required fields
  if (!superstep.step_id || typeof superstep.step_id !== 'string') {
    errors.push(`${prefix}: step_id is required and must be a string`);
  }

  if (!superstep.map_phase) {
    errors.push(`${prefix}: map_phase is required`);
  } else {
    validateMapPhase(superstep.map_phase, `${prefix}.map_phase`, errors);
  }

  if (!superstep.reduce_phase) {
    errors.push(`${prefix}: reduce_phase is required`);
  } else {
    validateReducePhase(superstep.reduce_phase, `${prefix}.reduce_phase`, errors);
  }

  // Optional middleware_phase
  if (superstep.middleware_phase) {
    validateMiddlewarePhase(superstep.middleware_phase, `${prefix}.middleware_phase`, errors);
  }
}

/**
 * Validate map_phase
 */
function validateMapPhase(mapPhase, prefix, errors) {
  // Required: perspectives array
  if (!mapPhase.perspectives) {
    errors.push(`${prefix}: perspectives is required`);
  } else if (!Array.isArray(mapPhase.perspectives)) {
    errors.push(`${prefix}.perspectives must be an array`);
  } else {
    mapPhase.perspectives.forEach((perspective, idx) => {
      validatePerspective(perspective, `${prefix}.perspectives[${idx}]`, errors);
    });
  }

  // Optional: global_instruction_overlay
  if (mapPhase.global_instruction_overlay && typeof mapPhase.global_instruction_overlay !== 'string') {
    errors.push(`${prefix}.global_instruction_overlay must be a string`);
  }

  // Optional: concurrency_limit
  if (mapPhase.concurrency_limit && typeof mapPhase.concurrency_limit !== 'number') {
    errors.push(`${prefix}.concurrency_limit must be a number`);
  }
}

/**
 * Validate perspective (NEW - model-neutral by default)
 */
function validatePerspective(perspective, prefix, errors) {
  // Required fields
  if (!perspective.perspective_id || typeof perspective.perspective_id !== 'string') {
    errors.push(`${prefix}: perspective_id is required and must be a string`);
  }

  if (!perspective.instruction || typeof perspective.instruction !== 'string') {
    errors.push(`${prefix}: instruction is required and must be a string`);
  }

  // Optional: model_ref (only if user explicitly binds to specific model)
  if (perspective.model_ref && typeof perspective.model_ref !== 'string') {
    errors.push(`${prefix}.model_ref must be a string`);
  }
}

/**
 * Validate reduce_phase
 */
function validateReducePhase(reducePhase, prefix, errors) {
  // Required fields
  if (!reducePhase.strategy) {
    errors.push(`${prefix}: strategy is required`);
  } else {
    const validStrategies = [
      'council_chairman',
      'simple_summary',
      'vote_majority',
      'subquery_single_model',
      'cross_interrogation',
      'column_wise_summary'
    ];
    if (!validStrategies.includes(reducePhase.strategy)) {
      errors.push(`${prefix}.strategy must be one of: ${validStrategies.join(', ')}`);
    }
  }

  if (!reducePhase.model_ref || typeof reducePhase.model_ref !== 'string') {
    errors.push(`${prefix}: model_ref is required and must be a string`);
  }

  if (!reducePhase.output_write_to || typeof reducePhase.output_write_to !== 'string') {
    errors.push(`${prefix}: output_write_to is required and must be a string`);
  }

  if (!reducePhase.visibility) {
    errors.push(`${prefix}: visibility is required`);
  } else {
    validateVisibility(reducePhase.visibility, `${prefix}.visibility`, errors);
  }

  // Optional: variable_interpolation
  if (reducePhase.variable_interpolation && typeof reducePhase.variable_interpolation !== 'boolean') {
    errors.push(`${prefix}.variable_interpolation must be a boolean`);
  }

  // Optional: chairman_instructions
  if (reducePhase.chairman_instructions && typeof reducePhase.chairman_instructions !== 'string') {
    errors.push(`${prefix}.chairman_instructions must be a string`);
  }
}

/**
 * Validate visibility config
 */
function validateVisibility(visibility, prefix, errors) {
  const booleanFields = [
    'include_original_input',
    'mask_worker_identities',
    'include_rejected_items',
    'include_conversation_history',
    'include_worker_outputs'
  ];

  booleanFields.forEach(field => {
    if (visibility[field] !== undefined && typeof visibility[field] !== 'boolean') {
      errors.push(`${prefix}.${field} must be a boolean`);
    }
  });
}

/**
 * Validate middleware_phase
 */
function validateMiddlewarePhase(middlewarePhase, prefix, errors) {
  if (!Array.isArray(middlewarePhase)) {
    errors.push(`${prefix} must be an array`);
    return;
  }

  middlewarePhase.forEach((operation, idx) => {
    validateMiddlewareOperation(operation, `${prefix}[${idx}]`, errors);
  });
}

/**
 * Validate middleware operation
 */
function validateMiddlewareOperation(operation, prefix, errors) {
  if (!operation.op) {
    errors.push(`${prefix}: op is required`);
  } else {
    const validOps = ['filter_regex', 'anonymize_pii', 'llm_refine', 'truncate'];
    if (!validOps.includes(operation.op)) {
      errors.push(`${prefix}.op must be one of: ${validOps.join(', ')}`);
    }
  }

  if (!operation.apply_to || !Array.isArray(operation.apply_to)) {
    errors.push(`${prefix}: apply_to is required and must be an array`);
  }

  if (!operation.config || typeof operation.config !== 'object') {
    errors.push(`${prefix}: config is required and must be an object`);
  }
}

/**
 * Validate scope_alignment config
 */
function validateScopeAlignment(scopeAlignment, errors) {
  const prefix = 'scope_alignment';

  if (scopeAlignment.enabled !== undefined && typeof scopeAlignment.enabled !== 'boolean') {
    errors.push(`${prefix}.enabled must be a boolean`);
  }

  if (scopeAlignment.coordinator_model && typeof scopeAlignment.coordinator_model !== 'string') {
    errors.push(`${prefix}.coordinator_model must be a string`);
  }

  if (scopeAlignment.scope_construction_timeout_ms && typeof scopeAlignment.scope_construction_timeout_ms !== 'number') {
    errors.push(`${prefix}.scope_construction_timeout_ms must be a number`);
  }

  if (scopeAlignment.alignment_timeout_ms && typeof scopeAlignment.alignment_timeout_ms !== 'number') {
    errors.push(`${prefix}.alignment_timeout_ms must be a number`);
  }
}

/**
 * Validate variable interpolation usage
 * Checks that all referenced variables (${var_name}) exist in variables array
 *
 * @param {Object} workflow - DSL workflow object
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validateVariableInterpolation(workflow) {
  const errors = [];

  // Extract declared variables
  const declaredVars = new Set((workflow.variables || []).map(v => v.name));

  // Also add output variables from all supersteps
  (workflow.supersteps || []).forEach(step => {
    if (step.reduce_phase?.output_write_to) {
      declaredVars.add(step.reduce_phase.output_write_to);
    }
  });

  // Check each superstep for variable references
  (workflow.supersteps || []).forEach((step, idx) => {
    const stepPrefix = `supersteps[${idx}]`;

    // Check global_instruction_overlay
    if (step.map_phase?.global_instruction_overlay) {
      checkVariableReferences(
        step.map_phase.global_instruction_overlay,
        declaredVars,
        `${stepPrefix}.map_phase.global_instruction_overlay`,
        errors
      );
    }

    // Check chairman_instructions
    if (step.reduce_phase?.chairman_instructions) {
      checkVariableReferences(
        step.reduce_phase.chairman_instructions,
        declaredVars,
        `${stepPrefix}.reduce_phase.chairman_instructions`,
        errors
      );
    }

    // Check perspective instructions
    (step.map_phase?.perspectives || []).forEach((perspective, pIdx) => {
      if (perspective.instruction) {
        checkVariableReferences(
          perspective.instruction,
          declaredVars,
          `${stepPrefix}.map_phase.perspectives[${pIdx}].instruction`,
          errors
        );
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check for variable references in a string and validate they exist
 */
function checkVariableReferences(text, declaredVars, location, errors) {
  // Match ${variable_name} pattern
  const regex = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const varName = match[1];
    if (!declaredVars.has(varName)) {
      errors.push(`${location}: Variable '\${${varName}}' is referenced but not declared`);
    }
  }
}

/**
 * Validate model references
 * Checks that all model_ref values are included in the models array
 *
 * @param {Object} workflow - DSL workflow object
 * @returns {Object} - { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateModelReferences(workflow) {
  const errors = [];
  const warnings = [];

  const declaredModels = new Set(workflow.models || []);
  const referencedModels = new Set();

  // Collect all model references
  (workflow.supersteps || []).forEach((step, idx) => {
    // Reduce phase model
    if (step.reduce_phase?.model_ref) {
      referencedModels.add(step.reduce_phase.model_ref);
    }

    // Perspective model bindings (if explicit)
    (step.map_phase?.perspectives || []).forEach((perspective, pIdx) => {
      if (perspective.model_ref) {
        referencedModels.add(perspective.model_ref);
      }
    });

    // Middleware LLM refine operations
    (step.middleware_phase || []).forEach((op, opIdx) => {
      if (op.op === 'llm_refine' && op.config?.model_ref) {
        referencedModels.add(op.config.model_ref);
      }
    });
  });

  // Check that all referenced models are declared
  referencedModels.forEach(modelRef => {
    if (!declaredModels.has(modelRef)) {
      errors.push(`Model '${modelRef}' is referenced but not in models array`);
    }
  });

  // Warn about declared but unused models
  declaredModels.forEach(modelRef => {
    if (!referencedModels.has(modelRef)) {
      warnings.push(`Model '${modelRef}' is declared but not referenced anywhere`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Comprehensive validation combining all checks
 *
 * @param {Object} workflow - DSL workflow object
 * @returns {Object} - { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateWorkflowComprehensive(workflow) {
  const structureResult = validateWorkflowDSL(workflow);
  const variableResult = validateVariableInterpolation(workflow);
  const modelResult = validateModelReferences(workflow);

  return {
    valid: structureResult.valid && variableResult.valid && modelResult.valid,
    errors: [
      ...structureResult.errors,
      ...variableResult.errors,
      ...modelResult.errors
    ],
    warnings: modelResult.warnings || []
  };
}
