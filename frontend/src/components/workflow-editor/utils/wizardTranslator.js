/**
 * Wizard to Advanced Editor Translator
 * Converts wizard state into Advanced Editor configuration
 */

import { strategies, models, visibility } from '../../../workflowGenerator.js';
import { INTERACTION_MODES } from './strategyTemplates.js';

/**
 * Map interaction mode to DSL reduce strategy
 */
function mapInteractionModeToStrategy(mode) {
  switch (mode) {
    case INTERACTION_MODES.INDEPENDENT_SYNTHESIS:
      return strategies.COUNCIL_CHAIRMAN;
    case INTERACTION_MODES.MAJORITY_VOTE:
      return strategies.VOTE_MAJORITY;
    case INTERACTION_MODES.CROSS_EXAMINATION:
      return strategies.CROSS_INTERROGATION;
    case INTERACTION_MODES.SINGLE_HELPER:
      return strategies.SUBQUERY_SINGLE_MODEL;
    case INTERACTION_MODES.VOTING:
      return strategies.VOTE_MAJORITY;
    case INTERACTION_MODES.DEBATE:
      return strategies.CROSS_INTERROGATION;
    case INTERACTION_MODES.BLIND_REVIEW:
      return strategies.COUNCIL_CHAIRMAN;
    case INTERACTION_MODES.MULTI_STAGE:
      return strategies.COUNCIL_CHAIRMAN;
    default:
      return strategies.COUNCIL_CHAIRMAN;
  }
}

/**
 * Map visibility mode to DSL visibility preset
 */
function mapVisibilityModeToPreset(mode) {
  switch (mode) {
    case 'full':
      return 'full';
    case 'blind_review':
    case 'blind':
      return 'blindReview';
    case 'clean_only':
    case 'partial':
      return 'cleanSubquery';
    default:
      return 'full';
  }
}

/**
 * Translate wizard state to Advanced Editor configuration
 */
export function wizardToAdvancedConfig(w) {
  // 1) Flow ID and timeout
  const flowId = w.workflowId || 'my_workflow';
  const globalTimeout = w.globalTimeout || 120000;

  // 2) Main output variable
  const varName = w.finalOutputVar || 'final_answer';

  let varType = 'string';
  if (w.outputFormat === 'list') varType = 'list';
  if (w.outputFormat === 'json_object' || w.outputFormat === 'custom') {
    varType = 'json_object';
  }

  const variables = [{
    name: varName,
    type: varType,
    defaultValue: ''
  }];

  // 3) Global instruction (workflow purpose + context + quality + constraints + format)
  const instructionParts = [
    w.problemStatement && `Workflow Purpose: ${w.problemStatement}`,
    w.audience && `Context: ${w.audience}`,
    w.qualities?.length && `Priorities: ${w.qualities.join(', ')}`,
    w.constraints?.length && `Hard constraints: ${w.constraints.join('; ')}`,
    w.customFormat && `Output format: ${w.customFormat}`
  ].filter(Boolean);

  const globalInstruction = instructionParts.join('\n');

  // 4) Workers (delegates)
  const workers = (w.perspectives || []).map((p, i) => ({
    worker_id: p.id || `worker${i + 1}`,
    model_ref: p.modelRef || models.GPT4,
    role_definition: p.role || undefined
  }));

  // 5) Collect & decide (reduce)
  const reduce = {
    strategy: mapInteractionModeToStrategy(w.interactionMode),
    modelRef: w.decisionMaker.model || models.GPT4,
    outputWriteTo: varName,
    visibilityPreset: mapVisibilityModeToPreset(w.visibilityMode),
    chairmanInstructions: w.decisionMaker.instructions || undefined,
    timeout: w.collectTimeout ? parseInt(w.collectTimeout, 10) : undefined,
    variableInterpolation: false
  };

  // 6) First superstep (single-step workflows)
  const supersteps = [{
    stepId: 'step1',
    description: w.problemStatement || 'Main workflow step',
    concurrency: w.concurrencyLimit ? parseInt(w.concurrencyLimit, 10) : null,
    globalInstruction,
    defaultRole: w.defaultDelegateRole || '',
    workers,
    middleware: w.filters || [],
    reduce
  }];

  return {
    flowId,
    globalTimeout,
    variables,
    supersteps
  };
}

/**
 * Convert Advanced Editor config back to wizard state
 * (For when switching from Advanced Editor to Wizard)
 */
export function advancedConfigToWizard(config) {
  if (!config || !config.supersteps || config.supersteps.length === 0) {
    return null;
  }

  const firstStep = config.supersteps[0];
  const outputVar = config.variables?.[0] || { name: 'final_answer', type: 'string' };

  // Parse global instruction back into components
  const instruction = firstStep.globalInstruction || '';
  const goalMatch = instruction.match(/(?:Goal|Workflow Purpose): ([^\n]+)/);
  const audienceMatch = instruction.match(/(?:Audience\/context|Context): ([^\n]+)/);
  const prioritiesMatch = instruction.match(/Priorities: ([^\n]+)/);
  const constraintsMatch = instruction.match(/Hard constraints: ([^\n]+)/);
  const formatMatch = instruction.match(/Output format: ([^\n]+)/);

  // Map variable type back to output format
  let outputFormat = 'text_summary';
  if (outputVar.type === 'list') outputFormat = 'list';
  if (outputVar.type === 'json_object') outputFormat = 'json_object';

  // Map reduce strategy back to interaction mode
  let interactionMode = INTERACTION_MODES.INDEPENDENT_SYNTHESIS;
  if (firstStep.reduce?.strategy === strategies.VOTE_MAJORITY) {
    interactionMode = INTERACTION_MODES.MAJORITY_VOTE;
  } else if (firstStep.reduce?.strategy === strategies.CROSS_INTERROGATION) {
    interactionMode = INTERACTION_MODES.CROSS_EXAMINATION;
  } else if (firstStep.reduce?.strategy === strategies.SUBQUERY_SINGLE_MODEL) {
    interactionMode = INTERACTION_MODES.SINGLE_HELPER;
  }

  // Map visibility back
  let visibilityMode = 'full';
  if (firstStep.reduce?.visibilityPreset === 'blindReview') {
    visibilityMode = 'blind_review';
  } else if (firstStep.reduce?.visibilityPreset === 'cleanSubquery') {
    visibilityMode = 'clean_only';
  }

  return {
    workflowId: config.flowId || 'my_workflow',
    problemStatement: goalMatch?.[1] || firstStep.description || '',
    audience: audienceMatch?.[1] || '',
    outputFormat,
    customFormat: formatMatch?.[1] || '',
    finalOutputVar: outputVar.name,
    qualities: prioritiesMatch?.[1]?.split(', ').map(q => q.trim()) || ['accurate', 'balanced'],
    constraints: constraintsMatch?.[1]?.split('; ').map(c => c.trim()).filter(Boolean) || [],
    perspectives: (firstStep.workers || []).map(w => ({
      id: w.worker_id,
      role: w.role_definition || '',
      modelRef: w.model_ref || models.GPT4
    })),
    defaultDelegateRole: firstStep.defaultRole || '',
    interactionMode,
    decisionMaker: {
      type: 'chairman',
      model: firstStep.reduce?.modelRef || models.GPT4,
      instructions: firstStep.reduce?.chairmanInstructions || ''
    },
    visibilityMode,
    collectTimeout: firstStep.reduce?.timeout || null,
    globalTimeout: config.globalTimeout || 120000,
    concurrencyLimit: firstStep.concurrency || null,
    filters: firstStep.middleware || [],
    costControls: {}
  };
}
