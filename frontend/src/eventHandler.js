/**
 * Dynamic Event Handler for Stage-Based Streaming
 *
 * Generates event handlers based on stage configuration.
 * This eliminates the need for massive switch statements and makes
 * the system easily extensible.
 *
 * Supports both council execution (stage-based) and workflow execution (superstep-based).
 */

import { getStageForEvent, isSpecialEvent, getStageConfig, isWorkflowEvent, parseWorkflowEvent } from './stageConfig';

/**
 * Create a dynamic event handler for streaming events
 *
 * @param {Object} callbacks - Callback functions for state updates
 * @param {Function} callbacks.updateQueryState - Update query state (stage, status)
 * @param {Function} callbacks.setConversation - Update conversation state
 * @returns {Function} Event handler function (eventType, event) => void
 */
export function createStreamEventHandler(callbacks) {
  const { updateQueryState, setConversation } = callbacks;

  /**
   * Handle stage start event
   */
  function handleStageStart(stage, conversationId) {
    updateQueryState(conversationId, stage.name, 'loading');

    // For complex stages, we let the first sub-stage start event handle it
    // But we still mark the parent stage as loading
  }

  /**
   * Handle stage complete event
   */
  function handleStageComplete(stage, subStage, event, conversationId) {
    // Update query state
    updateQueryState(conversationId, stage.name, 'complete');

    // Update conversation message data
    setConversation((prev) => {
      const messages = [...prev.messages];
      const lastMsg = messages[messages.length - 1];

      // Ensure last message is assistant
      if (!lastMsg || lastMsg.role !== 'assistant') {
        console.warn('[EventHandler] No assistant message found for stage complete');
        return prev;
      }

      // Handle complex stage (sub-stages)
      if (stage.isComplex && subStage) {
        const currentData = lastMsg[stage.messageField];
        const updatedData = subStage.dataHandler
          ? subStage.dataHandler(event, currentData)
          : event.data;

        messages[messages.length - 1] = {
          ...lastMsg,
          [stage.messageField]: updatedData
        };
      } else {
        // Simple stage - just set the data
        const updates = {
          [stage.messageField]: event.data
        };

        // Handle metadata if stage has it
        if (stage.hasMetadata && event.metadata) {
          updates[stage.metadataField] = event.metadata;
        }

        messages[messages.length - 1] = {
          ...lastMsg,
          ...updates
        };
      }

      return { ...prev, messages };
    });
  }

  /**
   * Handle workflow events
   */
  function handleWorkflowEvent(eventType, event, conversationId) {
    const parsed = parseWorkflowEvent(eventType);

    if (!parsed) {
      // Must be stream_init or complete
      if (eventType === 'stream_init') {
        updateQueryState(conversationId, 'workflow', 'loading');
        return true;
      }
      if (eventType === 'complete') {
        // Workflow complete - save variables to message
        if (event.final_variables) {
          setConversation((prev) => {
            const messages = [...prev.messages];
            const lastMsg = messages[messages.length - 1];

            if (lastMsg && lastMsg.role === 'assistant') {
              messages[messages.length - 1] = {
                ...lastMsg,
                variables: event.final_variables,
                partial: false
              };
            }

            return { ...prev, messages };
          });
        }
        updateQueryState(conversationId, 'workflow', 'complete');
        return true;
      }
      return false;
    }

    // Handle superstep events
    const { type, stepId } = parsed;

    if (type === 'SUPERSTEP_MAP_COMPLETE') {
      // Save worker outputs for this step
      if (event.worker_outputs) {
        setConversation((prev) => {
          const messages = [...prev.messages];
          const lastMsg = messages[messages.length - 1];

          if (lastMsg && lastMsg.role === 'assistant') {
            const currentWorkerOutputs = lastMsg.worker_outputs || {};
            messages[messages.length - 1] = {
              ...lastMsg,
              worker_outputs: {
                ...currentWorkerOutputs,
                [stepId]: event.worker_outputs
              }
            };
          }

          return { ...prev, messages };
        });
      }
    }

    if (type === 'SUPERSTEP_REDUCE_COMPLETE') {
      // Save intermediate variable state
      setConversation((prev) => {
        const messages = [...prev.messages];
        const lastMsg = messages[messages.length - 1];

        if (lastMsg && lastMsg.role === 'assistant') {
          // Update or create variables field
          const currentVars = lastMsg.variables || {};
          const outputVar = event.output_variable;
          const result = event.result;

          messages[messages.length - 1] = {
            ...lastMsg,
            variables: {
              ...currentVars,
              [outputVar]: result
            },
            partial: true // Still in progress
          };
        }

        return { ...prev, messages };
      });
    }

    // Update loading state for map/reduce phases
    if (type === 'SUPERSTEP_MAP_START' || type === 'SUPERSTEP_REDUCE_START') {
      updateQueryState(conversationId, `workflow_step_${stepId}`, 'loading');
    } else if (type === 'SUPERSTEP_REDUCE_COMPLETE') {
      updateQueryState(conversationId, `workflow_step_${stepId}`, 'complete');
    }

    return true;
  }

  /**
   * Main event handler function
   */
  return function handleEvent(eventType, event, conversationId) {
    // Check if this is a special event (handled externally)
    if (isSpecialEvent(eventType)) {
      // Special events are not handled here - return false to indicate
      // that the caller should handle it
      return false;
    }

    // Check if this is a workflow event
    if (isWorkflowEvent(eventType)) {
      return handleWorkflowEvent(eventType, event, conversationId);
    }

    // Find which stage this event belongs to (council execution)
    const stageInfo = getStageForEvent(eventType);
    if (!stageInfo) {
      console.warn('[EventHandler] Unknown event type:', eventType);
      return false;
    }

    const { stage, subStage } = stageInfo;

    // Determine if this is a start or complete event
    const isStartEvent = subStage
      ? subStage.events.start === eventType
      : stage.events.start === eventType;

    const isCompleteEvent = subStage
      ? subStage.events.complete === eventType
      : stage.events.complete === eventType;

    if (isStartEvent) {
      handleStageStart(stage, conversationId);
    } else if (isCompleteEvent) {
      handleStageComplete(stage, subStage, event, conversationId);
    } else {
      console.warn('[EventHandler] Event is neither start nor complete:', eventType);
      return false;
    }

    return true; // Event was handled
  };
}

/**
 * Helper: Create or ensure assistant message exists
 * Used when resuming streams or handling retry scenarios
 *
 * @param {Function} setConversation - Conversation setter function
 * @param {string} executionMode - 'council' or 'workflow' (optional, auto-detected if not provided)
 */
export function ensureAssistantMessage(setConversation, executionMode = null) {
  setConversation((prev) => {
    const messages = [...prev.messages];
    const lastMsg = messages[messages.length - 1];

    // If last message is not assistant, create one
    if (!lastMsg || lastMsg.role !== 'assistant') {
      // Auto-detect execution mode from conversation if not specified
      const isWorkflow = executionMode === 'workflow' || prev.workflow_json;

      if (isWorkflow) {
        // Workflow execution message
        messages.push({
          role: 'assistant',
          variables: {},
          worker_outputs: {},
          metadata: null,
          partial: true
        });
      } else {
        // Council execution message (default)
        messages.push({
          role: 'assistant',
          stage1: null,
          stage1_5: null,
          stage2: null,
          stage3: null,
          metadata: null,
        });
      }
    }

    return { ...prev, messages };
  });
}

/**
 * Helper: Get loading message for current stage
 */
export function getLoadingMessage(stageName) {
  const stage = getStageConfig(stageName);
  return stage?.loadingMessage || `Processing ${stageName}...`;
}
