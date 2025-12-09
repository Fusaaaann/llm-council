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

    // Step 3: Perspectives
    perspectives,

    // Step 4: Strategy
    interactionMode,
    decisionMaker,
    visibilityMode,

    // Step 5: Operational
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

  return workflow.build();
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
    outputFormat
  } = state;

  const outputVar = getOutputVariableName(outputFormat);
  const chairmanModel = decisionMaker.model || getDefaultChairmanModel(perspectives);
  const chairmanInstructions = buildChairmanInstructions(state);
  const globalInstruction = buildGlobalInstruction(state);

  let superstep = createSuperstep('gather_and_synthesize', problemStatement || 'Gather perspectives and synthesize final answer')
    .withGlobalInstruction(globalInstruction)
    .withWorkers(perspectives.map((p, idx) => ({
      worker_id: p.id || `worker_${idx}`,
      model_ref: p.model,
      role_definition: p.role
    })));

  // Add middleware if filters specified
  if (filters && filters.length > 0) {
    const middlewareOps = buildMiddlewareOperations(filters);
    if (middlewareOps.length > 0) {
      superstep = superstep.withMiddleware(middlewareOps);
    }
  }

  // Add reduce phase
  superstep = superstep.withReduce({
    strategy: getReduceStrategy(INTERACTION_MODES.INDEPENDENT_SYNTHESIS),
    modelRef: chairmanModel,
    outputWriteTo: outputVar,
    visibility: getVisibilityConfig(visibilityMode),
    chairmanInstructions: chairmanInstructions
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
    .withWorkers(perspectives.map((p, idx) => ({
      worker_id: p.id || `worker_${idx}`,
      model_ref: p.model,
      role_definition: p.role
    })))
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
    .withWorkers(perspectives.map((p, idx) => ({
      worker_id: p.id || `worker_${idx}`,
      model_ref: p.model
    })))
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
    .withWorkers(perspectives.map((p, idx) => ({
      worker_id: p.id || `worker_${idx}`,
      model_ref: p.model
    })))
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
    .withWorkers(perspectives.map((p, idx) => ({
      worker_id: p.id || `worker_${idx}`,
      model_ref: p.model,
      role_definition: p.role || undefined
    })));

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
    .withWorkers(perspectives.map((p, idx) => ({
      worker_id: p.id || `worker_${idx}`,
      model_ref: p.model,
      role_definition: p.role + '\n\nProvide your recommendation and vote clearly.'
    })))
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
    .withWorkers(perspectives.map((p, idx) => ({
      worker_id: p.id || `worker_${idx}`,
      model_ref: p.model,
      role_definition: p.role
    })))
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
    .withWorkers(perspectives.map((p, idx) => ({
      worker_id: `reviewer_${idx}`,
      model_ref: p.model
    })))
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

  return errors;
}
