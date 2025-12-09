/**
 * Stage Configuration
 *
 * Centralized configuration for all deliberation stages.
 * This defines the contract between backend events and frontend rendering.
 *
 * Adding a new stage:
 * 1. Add entry to STAGES array with configuration
 * 2. Backend should emit events matching the pattern defined here
 * 3. Frontend will automatically handle the events and update UI
 */

export const STAGES = [
  {
    name: 'stage1',
    label: 'Stage 1: Individual Responses',
    messageField: 'stage1', // Which field in assistant message to update
    loadingMessage: 'Collecting individual responses...',
    events: {
      start: 'stage1_start',
      complete: 'stage1_complete'
    }
  },
  {
    name: 'stage1_5',
    label: 'Stage 1.5: Cross-Interrogation',
    messageField: 'stage1_5',
    loadingMessage: 'Running cross-interrogation...',
    // Complex stage with sub-events
    isComplex: true,
    subStages: [
      {
        name: 'questions',
        label: 'Generating Questions',
        events: {
          start: 'stage1_5_questions_start',
          complete: 'stage1_5_questions_complete'
        },
        // Custom data handler for sub-stage
        dataHandler: (event, currentData) => ({
          ...(currentData || {}),
          questions: event.data
        })
      },
      {
        name: 'answers',
        label: 'Collecting Answers',
        events: {
          start: 'stage1_5_answers_start',
          complete: 'stage1_5_answers_complete'
        },
        // Custom data handler that also captures label_to_model
        dataHandler: (event, currentData) => ({
          ...(currentData || {}),
          answers: event.data,
          label_to_model: event.label_to_model
        })
      }
    ]
  },
  {
    name: 'stage2',
    label: 'Stage 2: Peer Rankings',
    messageField: 'stage2',
    loadingMessage: 'Collecting peer rankings...',
    events: {
      start: 'stage2_start',
      complete: 'stage2_complete'
    },
    // Stage 2 includes metadata
    hasMetadata: true,
    metadataField: 'metadata'
  },
  {
    name: 'stage3',
    label: 'Stage 3: Final Synthesis',
    messageField: 'stage3',
    loadingMessage: 'Synthesizing final answer...',
    events: {
      start: 'stage3_start',
      complete: 'stage3_complete'
    }
  }
];

// Special non-stage events
export const SPECIAL_EVENTS = {
  STREAM_INIT: 'stream_init',
  RESUME_INIT: 'resume_init',
  COMPLETE: 'complete',
  ERROR: 'error',
  HEARTBEAT: 'heartbeat',
  RECONNECTED: 'reconnected',
  AUTH_EXPIRED: 'auth_expired',
  TITLE_COMPLETE: 'title_complete'
};

// Workflow event patterns and configuration
export const WORKFLOW_EVENTS = {
  STREAM_INIT: 'stream_init',
  SUPERSTEP_MAP_START: /^superstep_(\w+)_map_start$/,
  SUPERSTEP_MAP_COMPLETE: /^superstep_(\w+)_map_complete$/,
  SUPERSTEP_MIDDLEWARE_COMPLETE: /^superstep_(\w+)_middleware_complete$/,
  SUPERSTEP_REDUCE_START: /^superstep_(\w+)_reduce_start$/,
  SUPERSTEP_REDUCE_COMPLETE: /^superstep_(\w+)_reduce_complete$/,
  COMPLETE: 'complete'
};

/**
 * Check if event type is a workflow event
 */
export function isWorkflowEvent(eventType) {
  // Check exact matches
  if (eventType === WORKFLOW_EVENTS.STREAM_INIT || eventType === WORKFLOW_EVENTS.COMPLETE) {
    return true;
  }

  // Check pattern matches
  return Object.values(WORKFLOW_EVENTS).some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(eventType);
    }
    return false;
  });
}

/**
 * Parse workflow event to extract step_id and phase
 */
export function parseWorkflowEvent(eventType) {
  for (const [key, pattern] of Object.entries(WORKFLOW_EVENTS)) {
    if (pattern instanceof RegExp) {
      const match = eventType.match(pattern);
      if (match) {
        return {
          type: key,
          stepId: match[1],
          eventType
        };
      }
    }
  }

  return null;
}

/**
 * Get stage configuration by name
 */
export function getStageConfig(stageName) {
  return STAGES.find(stage => stage.name === stageName);
}

/**
 * Get all event types (for validation/debugging)
 */
export function getAllEventTypes() {
  const stageEvents = STAGES.flatMap(stage => {
    if (stage.isComplex) {
      return stage.subStages.flatMap(sub =>
        Object.values(sub.events)
      );
    }
    return Object.values(stage.events);
  });

  const specialEvents = Object.values(SPECIAL_EVENTS);

  return [...stageEvents, ...specialEvents];
}

/**
 * Find which stage handles a given event type
 */
export function getStageForEvent(eventType) {
  for (const stage of STAGES) {
    if (stage.isComplex) {
      // Check sub-stages
      for (const subStage of stage.subStages) {
        if (Object.values(subStage.events).includes(eventType)) {
          return { stage, subStage };
        }
      }
    } else {
      // Check main stage events
      if (Object.values(stage.events).includes(eventType)) {
        return { stage };
      }
    }
  }
  return null;
}

/**
 * Check if event type is a special (non-stage) event
 */
export function isSpecialEvent(eventType) {
  return Object.values(SPECIAL_EVENTS).includes(eventType);
}

/**
 * Get ordered list of stage names (for stage sequence)
 */
export function getStageNames() {
  return STAGES.map(s => s.name);
}
