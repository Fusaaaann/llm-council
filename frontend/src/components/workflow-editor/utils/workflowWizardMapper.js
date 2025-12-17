/**
 * Workflow Wizard Mapper
 * Translates high-level wizard state into DSL workflow definitions
 */

import {
  createWorkflow,
  createSuperstep,
  middleware
} from '../../../workflowGenerator.js';
import {
  INTERACTION_MODES,
  DECISION_MAKER_TYPES,
  getReduceStrategy,
  getVisibilityConfig,
  getDefaultChairmanModel
} from './strategyTemplates.js';

/**
 * Main mapper function: converts wizard state to DSL workflow
 *
 * @param {Object} wizardState - High-level workflow configuration from wizard
 * @returns {Object} - DSL-compliant workflow definition
 */
export function mapWizardStateToWorkflow(wizardState) {
  const {
    // Step 1: Problem
    problemStatement,
    audience,

    // Step 2: Success
    outputFormat,
    qualities,
    constraints,
    globalModels,

    // Step 3: Perspectives
    perspectives,

    // Step 4: Strategy
    interactionMode,
    decisionMaker,
    visibilityMode,

    // Step 5: Follow-up steps
    followUpSteps,

    // Step 6: Operational
    globalTimeout,
    filters,
    costControls
  } = wizardState;

  // Generate flow ID from problem statement
  const flowId = generateFlowId(problemStatement);

  // Create base workflow
  let workflow = createWorkflow(flowId, globalTimeout || 120000);

  // Add main output variable
  const outputVar = getOutputVariableName(outputFormat);
  workflow = workflow.withVariable(outputVar, getOutputVariableType(outputFormat));

  // Build supersteps based on interaction mode
  switch (interactionMode) {
    case INTERACTION_MODES.INDEPENDENT_SYNTHESIS:
      workflow = buildIndependentSynthesisWorkflow(workflow, wizardState);
      break;

    case INTERACTION_MODES.DEBATE:
      workflow = buildDebateWorkflow(workflow, wizardState);
      break;

    case INTERACTION_MODES.BLIND_REVIEW:
      workflow = buildBlindReviewWorkflow(workflow, wizardState);
      break;

    case INTERACTION_MODES.VOTING:
      workflow = buildVotingWorkflow(workflow, wizardState);
      break;

    case INTERACTION_MODES.MULTI_STAGE:
      workflow = buildMultiStageWorkflow(workflow, wizardState);
      break;

    default:
      workflow = buildIndependentSynthesisWorkflow(workflow, wizardState);
  }

  // Add follow-up steps if configured
  if (followUpSteps && followUpSteps.length > 0) {
    workflow = buildFollowUpSteps(workflow, wizardState);
  }

  // Build the workflow
  const workflowDef = workflow.build();

  // Add global models array (extract all referenced models)
  const referencedModels = extractReferencedModels(wizardState);
  if (referencedModels.length > 0) {
    workflowDef.models = referencedModels;
  }

  // Add scope alignment if enabled
  if (wizardState.scopeAlignment?.enabled) {
    workflowDef.scope_alignment = {
      enabled: true,
      coordinator_model: wizardState.scopeAlignment.coordinatorModel || 'openai/gpt-4o',
      scope_construction_timeout_ms: wizardState.scopeAlignment.scopeTimeout || 30000,
      alignment_timeout_ms: wizardState.scopeAlignment.alignmentTimeout || 30000
    };
  }

  return workflowDef;
}

/**
 * Build workflow for independent responses → chairman synthesis
 */
function buildIndependentSynthesisWorkflow(workflow, state) {
  const {
    problemStatement,
    audience,
    perspectives,
    decisionMaker,
    visibilityMode,
    filters,
    outputFormat,
    useColumnWiseSummary,
    variableInterpolation
  } = state;

  const outputVar = getOutputVariableName(outputFormat);
  const chairmanModel = decisionMaker.model || getDefaultChairmanModel(perspectives);
  const chairmanInstructions = buildChairmanInstructions(state);
  const globalInstruction = buildGlobalInstruction(state);

  let superstep = createSuperstep('gather_and_synthesize', problemStatement || 'Gather perspectives and synthesize final answer')
    .withGlobalInstruction(globalInstruction)
    .withPerspectives(mapPerspectives(perspectives)); // UPDATED: Use perspectives instead of workers

  // Add concurrency limit if specified
  if (state.concurrencyLimit) {
    superstep = superstep.withConcurrencyLimit(state.concurrencyLimit);
  }

  // Add middleware if filters specified
  if (filters && filters.length > 0) {
    const middlewareOps = buildMiddlewareOperations(filters);
    if (middlewareOps.length > 0) {
      superstep = superstep.withMiddleware(middlewareOps);
    }
  }

  // Add custom middleware if specified (Advanced tier)
  if (state.middleware && state.middleware.length > 0) {
    superstep = superstep.withMiddleware(state.middleware);
  }

  // Determine reduce strategy
  const reduceStrategy = useColumnWiseSummary
    ? 'column_wise_summary'
    : getReduceStrategy(INTERACTION_MODES.INDEPENDENT_SYNTHESIS);

  // Add reduce phase
  superstep = superstep.withReduce({
    strategy: reduceStrategy,
    modelRef: chairmanModel,
    outputWriteTo: outputVar,
    visibility: getVisibilityConfig(visibilityMode, state.advancedVisibility),
    chairmanInstructions: chairmanInstructions,
    variableInterpolation: variableInterpolation || false
  });

  return workflow.withSuperstep(superstep);
}

/**
 * Build workflow for cross-interrogation debate
 */
function buildDebateWorkflow(workflow, state) {
  const { problemStatement, perspectives, decisionMaker, outputFormat } = state;

  const outputVar = getOutputVariableName(outputFormat);
  const chairmanModel = decisionMaker.model || getDefaultChairmanModel(perspectives);
  const globalInstruction = buildGlobalInstruction(state);

  // Variables for each stage
  workflow = workflow
    .withVariable('stage1_responses', 'string')
    .withVariable('stage1_5_questions', 'string')
    .withVariable('stage1_5_answers', 'string');

  // Stage 1: Initial responses
  let step1 = createSuperstep('stage1', problemStatement || 'Gather initial perspectives')
    .withGlobalInstruction(globalInstruction)
    .withWorkers(perspectives.map((p, idx) => {
      const worker = {
        worker_id: p.id || `worker_${idx}`,
        role_definition: p.role
      };

      // Only add model_ref if user explicitly bound this perspective
      if (p.modelBound && p.model) {
        worker.model_ref = p.model;
      }

      return worker;
    }))
    .withReduce({
      strategy: getReduceStrategy(INTERACTION_MODES.INDEPENDENT_SYNTHESIS),
      modelRef: chairmanModel,
      outputWriteTo: 'stage1_responses',
      visibility: getVisibilityConfig('full')
    });

  // Stage 1.5 Questions: Generate cross-examination questions
  let step15q = createSuperstep('stage1_5_questions', 'Generate cross-examination questions')
    .withGlobalInstruction('Review the responses and generate clarifying questions:\n\n${stage1_responses}')
    .withDefaultRole('Review other perspectives and generate 2-3 critical questions to uncover deeper insights.')
    .withWorkers(perspectives.map((p, idx) => {
      const worker = {
        worker_id: p.id || `worker_${idx}`
      };

      // Only add model_ref if user explicitly bound this perspective
      if (p.modelBound && p.model) {
        worker.model_ref = p.model;
      }

      return worker;
    }))
    .withReduce({
      strategy: getReduceStrategy(INTERACTION_MODES.DEBATE),
      modelRef: chairmanModel,
      outputWriteTo: 'stage1_5_questions',
      visibility: getVisibilityConfig('full'),
      variableInterpolation: true
    });

  // Stage 1.5 Answers: Answer cross-examination questions
  let step15a = createSuperstep('stage1_5_answers', 'Answer cross-examination questions')
    .withGlobalInstruction('Answer the questions directed at your perspective:\n\n${stage1_5_questions}')
    .withDefaultRole('Answer questions about your perspective clearly and directly.')
    .withWorkers(perspectives.map((p, idx) => {
      const worker = {
        worker_id: p.id || `worker_${idx}`
      };

      // Only add model_ref if user explicitly bound this perspective
      if (p.modelBound && p.model) {
        worker.model_ref = p.model;
      }

      return worker;
    }))
    .withReduce({
      strategy: getReduceStrategy(INTERACTION_MODES.INDEPENDENT_SYNTHESIS),
      modelRef: chairmanModel,
      outputWriteTo: outputVar,
      visibility: getVisibilityConfig('full'),
      chairmanInstructions: buildChairmanInstructions(state, 'Consider both initial responses and Q&A insights.'),
      variableInterpolation: true
    });

  return workflow
    .withSuperstep(step1)
    .withSuperstep(step15q)
    .withSuperstep(step15a);
}

/**
 * Build workflow for blind review (anonymized evaluation)
 */
function buildBlindReviewWorkflow(workflow, state) {
  const { problemStatement, perspectives, decisionMaker, filters, outputFormat } = state;

  const outputVar = getOutputVariableName(outputFormat);
  const chairmanModel = decisionMaker.model || getDefaultChairmanModel(perspectives);
  const globalInstruction = buildGlobalInstruction(state);

  let superstep = createSuperstep('blind_review', problemStatement || 'Gather and evaluate responses anonymously')
    .withGlobalInstruction(globalInstruction)
    .withDefaultRole('You are a helpful AI assistant.')
    .withWorkers(perspectives.map((p, idx) => {
      const worker = {
        worker_id: p.id || `worker_${idx}`,
        role_definition: p.role || undefined
      };

      // Only add model_ref if user explicitly bound this perspective
      if (p.modelBound && p.model) {
        worker.model_ref = p.model;
      }

      return worker;
    }));

  // Add middleware if specified
  if (filters && filters.length > 0) {
    const middlewareOps = buildMiddlewareOperations(filters);
    if (middlewareOps.length > 0) {
      superstep = superstep.withMiddleware(middlewareOps);
    }
  }

  // Force blind visibility
  superstep = superstep.withReduce({
    strategy: getReduceStrategy(INTERACTION_MODES.BLIND_REVIEW),
    modelRef: chairmanModel,
    outputWriteTo: outputVar,
    visibility: getVisibilityConfig('blind'), // Always blind
    chairmanInstructions: 'Evaluate responses objectively without knowing which model produced them. ' +
      buildChairmanInstructions(state)
  });

  return workflow.withSuperstep(superstep);
}

/**
 * Build workflow for voting/majority decision
 */
function buildVotingWorkflow(workflow, state) {
  const { problemStatement, perspectives, outputFormat } = state;

  const outputVar = getOutputVariableName(outputFormat);
  const globalInstruction = buildGlobalInstruction(state);

  let superstep = createSuperstep('vote', problemStatement || 'Gather votes from all perspectives')
    .withGlobalInstruction(globalInstruction)
    .withWorkers(perspectives.map((p, idx) => {
      const worker = {
        worker_id: p.id || `worker_${idx}`,
        role_definition: p.role + '\n\nProvide your recommendation and vote clearly.'
      };

      // Only add model_ref if user explicitly bound this perspective
      if (p.modelBound && p.model) {
        worker.model_ref = p.model;
      }

      return worker;
    }))
    .withReduce({
      strategy: getReduceStrategy(INTERACTION_MODES.VOTING),
      modelRef: perspectives[0]?.model || 'openai/gpt-4', // Use first worker's model for counting
      outputWriteTo: outputVar,
      visibility: getVisibilityConfig('full')
    });

  return workflow.withSuperstep(superstep);
}

/**
 * Build workflow for multi-stage deliberation (perspectives → review → synthesis)
 */
function buildMultiStageWorkflow(workflow, state) {
  const { problemStatement, perspectives, decisionMaker, outputFormat } = state;

  const outputVar = getOutputVariableName(outputFormat);
  const chairmanModel = decisionMaker.model || getDefaultChairmanModel(perspectives);
  const globalInstruction = buildGlobalInstruction(state);

  workflow = workflow
    .withVariable('stage1_responses', 'string')
    .withVariable('stage2_reviews', 'string');

  // Stage 1: Initial perspectives
  let step1 = createSuperstep('gather_perspectives', problemStatement || 'Gather initial perspectives')
    .withGlobalInstruction(globalInstruction)
    .withWorkers(perspectives.map((p, idx) => {
      const worker = {
        worker_id: p.id || `worker_${idx}`,
        role_definition: p.role
      };

      // Only add model_ref if user explicitly bound this perspective
      if (p.modelBound && p.model) {
        worker.model_ref = p.model;
      }

      return worker;
    }))
    .withReduce({
      strategy: getReduceStrategy(INTERACTION_MODES.INDEPENDENT_SYNTHESIS),
      modelRef: chairmanModel,
      outputWriteTo: 'stage1_responses',
      visibility: getVisibilityConfig('full')
    });

  // Stage 2: Peer review (anonymized)
  let step2 = createSuperstep('peer_review', 'Peer review of responses')
    .withGlobalInstruction('Review and critique the responses below:\n\n${stage1_responses}')
    .withDefaultRole('Evaluate the responses critically. Identify strengths, weaknesses, and gaps.')
    .withWorkers(perspectives.map((p, idx) => {
      const worker = {
        worker_id: `reviewer_${idx}`
      };

      // Only add model_ref if user explicitly bound this perspective
      if (p.modelBound && p.model) {
        worker.model_ref = p.model;
      }

      return worker;
    }))
    .withReduce({
      strategy: getReduceStrategy(INTERACTION_MODES.INDEPENDENT_SYNTHESIS),
      modelRef: chairmanModel,
      outputWriteTo: 'stage2_reviews',
      visibility: getVisibilityConfig('blind'),
      variableInterpolation: true
    });

  // Stage 3: Final synthesis
  let step3 = createSuperstep('final_synthesis', 'Synthesize final answer')
    .withWorkers([]) // No workers, chairman only
    .withReduce({
      strategy: getReduceStrategy(INTERACTION_MODES.INDEPENDENT_SYNTHESIS),
      modelRef: chairmanModel,
      outputWriteTo: outputVar,
      visibility: getVisibilityConfig('full'),
      chairmanInstructions: buildChairmanInstructions(state, 'Consider both original perspectives and peer reviews.'),
      variableInterpolation: true
    });

  return workflow
    .withSuperstep(step1)
    .withSuperstep(step2)
    .withSuperstep(step3);
}

/**
 * Build global instruction overlay from wizard state
 * This is shared with ALL workers in the map phase
 */
function buildGlobalInstruction(state) {
  const { problemStatement, audience, qualities, constraints, outputFormat, customFormat } = state;

  const parts = [];

  // Workflow pattern/purpose
  if (problemStatement) {
    parts.push(`Workflow Purpose: ${problemStatement}`);
  }

  // Context/scope
  if (audience) {
    parts.push(`Context: ${audience}`);
  }

  // Output format
  if (customFormat) {
    parts.push(`Output Format: ${customFormat}`);
  } else if (outputFormat === 'json') {
    parts.push('Output Format: Structured JSON');
  } else if (outputFormat === 'ranked') {
    parts.push('Output Format: Ranked list with justifications');
  }

  // Quality priorities
  if (qualities && qualities.length > 0) {
    parts.push(`Priorities: ${qualities.join(', ')}`);
  }

  // Hard constraints
  if (constraints && constraints.length > 0) {
    parts.push(`Constraints: ${constraints.join('; ')}`);
  }

  return parts.join('\n\n');
}

/**
 * Build chairman instructions from wizard state
 */
function buildChairmanInstructions(state, additionalContext = '') {
  const { qualities, constraints, decisionMaker, outputFormat } = state;

  let instructions = [];

  // Add custom instructions if provided
  if (decisionMaker.instructions) {
    instructions.push(decisionMaker.instructions);
  }

  // Add output format guidance
  if (outputFormat === 'json') {
    instructions.push('Provide output as valid JSON.');
  } else if (outputFormat === 'ranked') {
    instructions.push('Provide a ranked list of options with justifications.');
  }

  // Add qualities
  if (qualities && qualities.length > 0) {
    const qualityStr = qualities.join(', ');
    instructions.push(`Ensure the answer is ${qualityStr}.`);
  }

  // Add constraints
  if (constraints && constraints.length > 0) {
    constraints.forEach(c => {
      instructions.push(`Constraint: ${c}`);
    });
  }

  // Add additional context
  if (additionalContext) {
    instructions.push(additionalContext);
  }

  return instructions.join('\n\n');
}

/**
 * Build middleware operations from filter selections
 */
function buildMiddlewareOperations(filters) {
  const ops = [];

  if (filters.includes('remove_pii')) {
    ops.push(middleware.anonymizePii(['*']));
  }

  if (filters.includes('filter_refusals')) {
    ops.push(middleware.filterRegex(['*'], '(?i)(sorry|cannot|unable|not able)', 'flag'));
  }

  if (filters.includes('truncate')) {
    ops.push(middleware.truncate(['*'], 1000, 'smart'));
  }

  return ops;
}

/**
 * Map wizard perspectives to DSL perspectives (CRITICAL - model-neutral by default)
 *
 * @param {Array} perspectives - Wizard perspective array
 * @returns {Array} - DSL perspective array
 */
function mapPerspectives(perspectives) {
  return perspectives.map((p, idx) => {
    const perspective = {
      perspective_id: p.id || sanitizeStepId(p.name) || `perspective_${idx}`,
      instruction: p.role || p.instruction || ''
    };

    // CRITICAL: Only add model_ref if user explicitly bound this perspective to a specific model
    if (p.modelBound && p.model) {
      perspective.model_ref = p.model;
    }
    // Otherwise, model-neutral (all models in models[] array analyze this perspective)

    return perspective;
  });
}

/**
 * Extract all referenced models from wizard state
 * Returns array of unique model refs that should go in the models[] array
 *
 * @param {Object} wizardState - Wizard state
 * @returns {Array<string>} - Array of unique model refs
 */
function extractReferencedModels(wizardState) {
  const modelRefs = new Set();

  // Add models from model-bound perspectives
  if (wizardState.perspectives) {
    wizardState.perspectives.forEach(p => {
      if (p.modelBound && p.model) {
        modelRefs.add(p.model);
      }
    });
  }

  // Add models from global list (if any model-neutral perspectives exist)
  const hasModelNeutralPerspectives = wizardState.perspectives?.some(p => !p.modelBound);
  if (hasModelNeutralPerspectives && wizardState.globalModels) {
    wizardState.globalModels.forEach(m => {
      if (m.modelRef) {
        modelRefs.add(m.modelRef);
      }
    });
  }

  // Add chairman/reducer models
  if (wizardState.decisionMaker?.model) {
    modelRefs.add(wizardState.decisionMaker.model);
  }

  // Add models from follow-up steps
  if (wizardState.followUpSteps) {
    wizardState.followUpSteps.forEach(step => {
      if (step.workerModel) {
        modelRefs.add(step.workerModel);
      }
      if (step.workers) {
        step.workers.forEach(w => {
          if (w.model_ref) {
            modelRefs.add(w.model_ref);
          }
        });
      }
    });
  }

  // Add models from middleware operations (llm_refine)
  if (wizardState.middleware) {
    wizardState.middleware.forEach(op => {
      if (op.op === 'llm_refine' && op.config?.model_ref) {
        modelRefs.add(op.config.model_ref);
      }
    });
  }

  // Add scope alignment coordinator model
  if (wizardState.scopeAlignment?.enabled && wizardState.scopeAlignment.coordinatorModel) {
    modelRefs.add(wizardState.scopeAlignment.coordinatorModel);
  }

  return Array.from(modelRefs);
}

/**
 * Generate a valid flow_id from problem statement
 */
function generateFlowId(problemStatement) {
  if (!problemStatement) return 'custom_workflow';

  // Take first few words, lowercase, replace spaces/special chars with underscores
  const cleaned = problemStatement
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join('_');

  return cleaned || 'custom_workflow';
}

/**
 * Get output variable name based on format
 */
function getOutputVariableName(outputFormat) {
  const varNames = {
    text_summary: 'final_answer',
    json: 'final_output',
    ranked: 'ranked_options',
    custom: 'result'
  };

  return varNames[outputFormat] || 'final_answer';
}

/**
 * Get output variable type based on format
 */
function getOutputVariableType(outputFormat) {
  const varTypes = {
    text_summary: 'string',
    json: 'json_object',
    ranked: 'list',
    custom: 'string'
  };

  return varTypes[outputFormat] || 'string';
}

/**
 * Build follow-up supersteps from wizard configuration
 */
function buildFollowUpSteps(workflow, state) {
  const { followUpSteps, outputFormat } = state;

  followUpSteps.forEach((step, index) => {
    const stepId = `followup_${index + 1}_${sanitizeStepId(step.taskDescription)}`;

    // Build global instruction with variable interpolation
    const inputVarsText = (step.inputVariables || [])
      .map(v => `\${${v}}`)
      .join('\n\n');
    const globalInstruction = step.taskDescription + (inputVarsText ? `\n\nInput:\n${inputVarsText}` : '');

    let superstep = createSuperstep(stepId, step.taskDescription)
      .withGlobalInstruction(globalInstruction);

    // Add workers based on mode
    if (step.mode === 'single_worker') {
      superstep = superstep.withWorkers([{
        worker_id: `followup_worker_${index + 1}`,
        model_ref: step.workerModel,
        role_definition: step.taskDescription
      }]);
    } else if (step.mode === 'multiple_workers') {
      // Advanced mode - use configured workers (future)
      superstep = superstep.withWorkers(step.workers || []);
    }
    // chairman_only mode has no workers

    // Add reduce phase
    const reduceModel = step.workerModel || getDefaultChairmanModel(state.perspectives);

    superstep = superstep.withReduce({
      strategy: step.reduceStrategy || 'simple_summary',
      modelRef: reduceModel,
      outputWriteTo: step.outputVar,
      visibility: getVisibilityConfig(step.visibility || 'full'),
      variableInterpolation: true // Enable variable interpolation
    });

    // Add variable declaration to workflow
    workflow = workflow.withVariable(step.outputVar, 'string');

    workflow = workflow.withSuperstep(superstep);
  });

  return workflow;
}

/**
 * Sanitize step ID from task description
 */
function sanitizeStepId(description) {
  if (!description) return 'untitled';

  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join('_') || 'untitled';
}

/**
 * Validate wizard state before mapping
 */
export function validateWizardState(wizardState) {
  const errors = [];

  if (!wizardState.problemStatement || wizardState.problemStatement.trim() === '') {
    errors.push('Problem statement is required');
  }

  if (!wizardState.perspectives || wizardState.perspectives.length === 0) {
    errors.push('At least one perspective is required');
  }

  if (wizardState.perspectives && wizardState.perspectives.some(p => !p.role || !p.model)) {
    errors.push('All perspectives must have a role and model');
  }

  if (!wizardState.interactionMode) {
    errors.push('Interaction mode is required');
  }

  // Validate follow-up steps if any
  if (wizardState.followUpSteps && wizardState.followUpSteps.length > 0) {
    wizardState.followUpSteps.forEach((step, index) => {
      if (!step.taskDescription || step.taskDescription.trim() === '') {
        errors.push(`Follow-up step ${index + 1}: Task description is required`);
      }
      if ((step.mode === 'single_worker' || step.mode === 'chairman_only') && !step.workerModel) {
        errors.push(`Follow-up step ${index + 1}: Model selection is required`);
      }
      if (!step.outputVar || step.outputVar.trim() === '') {
        errors.push(`Follow-up step ${index + 1}: Output variable name is required`);
      }
    });

    // Check for duplicate output variables
    const outputVars = wizardState.followUpSteps.map(s => s.outputVar).filter(v => v);
    const duplicates = outputVars.filter((v, i) => outputVars.indexOf(v) !== i);
    if (duplicates.length > 0) {
      errors.push(`Duplicate output variable names: ${duplicates.join(', ')}`);
    }
  }

  return errors;
}
