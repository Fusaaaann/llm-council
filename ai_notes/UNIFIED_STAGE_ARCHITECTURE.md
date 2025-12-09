# Unified Stage Architecture

**Last Updated:** 2025-12-09

This document describes the unified stage architecture that supports both **council execution** (legacy) and **workflow execution** (new) with a single adaptive UI component.

## Overview

The unified stage architecture replaces the previous council-only Stage*.jsx components with a single `UnifiedStage` component that automatically detects the execution mode and renders the appropriate UI.

## Execution Modes

### Council Mode (Legacy)
- **Message Structure:** `{role: "assistant", stage1: [...], stage2: [...], stage3: {...}, metadata: {...}}`
- **Events:** `stage1_start`, `stage1_complete`, `stage2_start`, etc.
- **UI:** Traditional tabbed display with Stage1/2/3 components

### Workflow Mode (New)
- **Message Structure:** `{role: "assistant", variables: {...}, metadata: {...}, partial: boolean}`
- **Events:** `stream_init`, `superstep_{id}_map_start`, `superstep_{id}_reduce_complete`, `complete`
- **UI:** Variable-based display with progress indicator

## Architecture Components

### 1. Message Type Detection (`utils/messageDetection.js`)

Provides utilities to detect execution mode and extract display data:

```javascript
import { detectExecutionMode, EXECUTION_MODE } from '../utils/messageDetection';

const mode = detectExecutionMode(message);
// Returns: 'council', 'workflow', or 'unknown'
```

**Key Functions:**
- `detectExecutionMode(message)` - Determine if message is council or workflow
- `getFinalOutput(message)` - Extract final output content
- `isMessageComplete(message)` - Check if execution is finished
- `getDisplayData(message)` - Get normalized data for rendering

**Detection Logic:**
```javascript
// Workflow: has 'variables' field
if (message.variables !== undefined) return 'workflow';

// Council: has 'stage3' field
if (message.stage3 !== undefined) return 'council';

// Partial council: has stage1/stage2
if (message.stage1 !== undefined) return 'council';

return 'unknown';
```

### 2. UnifiedStage Component (`components/UnifiedStage.jsx`)

Single adaptive component that renders both execution modes:

```javascript
<UnifiedStage
  message={assistantMessage}
  queryState={queryState}
  isLoading={isStreamActive}
/>
```

**Mode Detection:**
1. Automatically detects mode using `detectExecutionMode()`
2. Returns null for unknown modes
3. Renders appropriate UI based on mode

**Council Mode Rendering:**
- Reuses existing Stage1, Stage1_5, Stage2, Stage3 components
- Maintains tab-based navigation
- Shows "LLM Council" badge

**Workflow Mode Rendering:**
- Shows workflow ID and progress bar
- Displays final output prominently (highlighted)
- Collapsible "View All Variables" section
- Shows "⚙️ Workflow Execution" badge

### 3. Event Handling (`eventHandler.js`)

Extended to handle both council and workflow events:

```javascript
// Council events: stage1_start, stage2_complete, etc.
// Workflow events: superstep_*_map_start, superstep_*_reduce_complete, complete
```

**Workflow Event Handling:**
- `stream_init` → Set loading state, create assistant message
- `superstep_{id}_reduce_complete` → Save variable update
- `complete` with `final_variables` → Mark complete, save final state

**Event Router:**
1. Check if special event (heartbeat, auth, etc.) → return false
2. Check if workflow event (`isWorkflowEvent()`) → handle workflow
3. Check if council event (`getStageForEvent()`) → handle council
4. Unknown → warn and return false

### 4. Configuration (`stageConfig.js`)

Extended with workflow event patterns:

```javascript
export const WORKFLOW_EVENTS = {
  STREAM_INIT: 'stream_init',
  SUPERSTEP_MAP_START: /^superstep_(\w+)_map_start$/,
  SUPERSTEP_REDUCE_COMPLETE: /^superstep_(\w+)_reduce_complete$/,
  COMPLETE: 'complete'
};

export function isWorkflowEvent(eventType) { ... }
export function parseWorkflowEvent(eventType) { ... }
```

## Data Flow

### Council Execution Flow
```
User Query → /api/conversations/{id}/message/stream
    ↓
stage1_start → ensureAssistantMessage('council')
    ↓
stage1_complete → Save to message.stage1
    ↓
stage1_5_questions/answers_complete → Save to message.stage1_5
    ↓
stage2_complete → Save to message.stage2 + metadata
    ↓
stage3_complete → Save to message.stage3, mark complete
    ↓
complete → Finish stream
```

### Workflow Execution Flow
```
User Query → /api/conversations/{id}/message/stream
    ↓
stream_init → ensureAssistantMessage('workflow')
    ↓
superstep_{id}_map_start → Update loading state
    ↓
superstep_{id}_reduce_complete → Save to message.variables[output_var]
    ↓
[Repeat for each superstep]
    ↓
complete with final_variables → Save final state, mark complete
    ↓
Finish stream
```

## Message Structures

### Council Assistant Message
```json
{
  "role": "assistant",
  "stage1": [
    {"model": "openai/gpt-4o", "response": "..."},
    {"model": "anthropic/claude-sonnet-4.5", "response": "..."}
  ],
  "stage1_5": {
    "questions": [...],
    "answers": [...],
    "label_to_model": {...}
  },
  "stage2": [
    {"model": "openai/gpt-4o", "ranking": "...", "parsed_ranking": [...]}
  ],
  "stage3": {
    "model": "google/gemini-3-pro",
    "response": "Final synthesis..."
  },
  "metadata": {
    "label_to_model": {...},
    "aggregate_rankings": [...]
  }
}
```

### Workflow Assistant Message
```json
{
  "role": "assistant",
  "variables": {
    "user_question": "What is quantum computing?",
    "analysis": "Quantum computing uses...",
    "final_answer": "Comprehensive explanation..."
  },
  "metadata": {
    "workflow_id": "quantum_explainer_v1",
    "current_step": "synthesis",
    "completed_steps": 3,
    "total_steps": 3,
    "execution_mode": "workflow"
  },
  "partial": false
}
```

## Rendering Decision Tree

```
Is message.role === 'assistant'?
  ↓ NO → Don't render
  ↓ YES
    ↓
Does message.variables exist?
  ↓ YES → WORKFLOW MODE
  |        ↓
  |      Show workflow UI:
  |        - Workflow badge & name
  |        - Progress bar (if metadata)
  |        - Final output (highlighted)
  |        - Collapsible variables list
  ↓ NO
    ↓
Does message.stage3 or stage1 exist?
  ↓ YES → COUNCIL MODE
  |        ↓
  |      Show council UI:
  |        - LLM Council badge
  |        - Stage1 tabs
  |        - Stage1_5 cross-interrogation
  |        - Stage2 rankings
  |        - Stage3 final synthesis
  ↓ NO
    ↓
UNKNOWN MODE → Don't render
```

## Component Integration

### ChatInterface.jsx (Simplified)

**Before (Council-only):**
```jsx
{STAGES.map((stageConfig) => {
  const StageComponent = STAGE_COMPONENTS[stageConfig.name];
  const hasData = msg[stageConfig.messageField];
  // ... render each stage separately
})}
```

**After (Unified):**
```jsx
<UnifiedStage
  message={msg}
  queryState={queryState}
  isLoading={isLoading && index === lastMessageIndex}
/>
```

**Benefits:**
- 75% less code in ChatInterface
- Automatic mode detection
- No prop mapping required
- Single component to maintain

### App.jsx Integration

**ensureAssistantMessage() with Mode Detection:**
```javascript
// Council execution
ensureAssistantMessage(setCurrentConversation, 'council');
// Creates: {role: 'assistant', stage1: null, stage2: null, ...}

// Workflow execution
ensureAssistantMessage(setCurrentConversation, 'workflow');
// Creates: {role: 'assistant', variables: {}, partial: true}

// Auto-detect from conversation
ensureAssistantMessage(setCurrentConversation);
// Uses conversation.workflow_json to determine mode
```

## Styling

### UnifiedStage.css Structure

**Shared Styles:**
- `.unified-stage` - Base container
- `.execution-mode-label` - Badge display
- `.stage-loading` - Loading spinner

**Council Mode:**
- `.unified-stage.council-mode` - Uses existing Stage*.css
- Green color scheme (#e8f5e9, #2e7d32)

**Workflow Mode:**
- `.unified-stage.workflow-mode` - New workflow-specific styles
- Blue/purple color scheme (#e3f2fd, #1565c0)
- `.workflow-progress` - Progress bar
- `.workflow-final-output` - Highlighted output
- `.workflow-variables` - Collapsible section

## Backend Integration

### Workflow Engine (`backend/workflow_engine.py`)

**Partial State Saving:**
```python
async def _save_partial_state(conversation, step_id):
    storage.save_partial_assistant_message(
        conversation_id=conversation['id'],
        stage_name="variables",
        stage_data=self.memory.to_dict(),
        metadata={
            'workflow_id': self.workflow['flow_id'],
            'current_step': step_id,
            'completed_steps': completed,
            'total_steps': total,
            'execution_mode': 'workflow'
        },
        profile_id=profile_id
    )
```

**Called After Each Superstep:**
- Saves current variable state
- Enables stream resumption
- Provides progress tracking

## Migration Notes

### Backward Compatibility

**Council Execution:**
- All existing council conversations render correctly
- Stage*.jsx components still used internally
- No changes to backend council execution
- Event names unchanged

**Workflow Execution:**
- New workflow conversations use new format
- Automatic detection prevents conflicts
- No migration needed for existing data

### Deprecation

**Deprecated (but kept as sub-components):**
- Direct usage of Stage1/2/3 components in ChatInterface
- STAGE_COMPONENTS and STAGE_PROPS_MAPPER objects
- Manual stage data prop mapping

**Maintained:**
- Stage*.jsx files (used by UnifiedStage internally)
- Stage*.css files (styling still used)
- All existing event handlers

## Testing Checklist

### Council Execution
- [ ] Create new council conversation
- [ ] Verify stage1 tabs render correctly
- [ ] Verify stage1_5 cross-interrogation displays
- [ ] Verify stage2 rankings show properly
- [ ] Verify stage3 final synthesis appears
- [ ] Verify "LLM Council" badge shows
- [ ] Test edit/retry functionality
- [ ] Test stream resumption

### Workflow Execution
- [ ] Create new workflow conversation
- [ ] Verify workflow badge displays
- [ ] Verify progress bar updates
- [ ] Verify final output highlights
- [ ] Verify variable expansion works
- [ ] Verify JSON variables format correctly
- [ ] Verify partial state updates
- [ ] Test stream resumption

### Mixed Conversations
- [ ] Load old council conversation
- [ ] Verify renders correctly
- [ ] Create new workflow conversation
- [ ] Switch between conversations
- [ ] Verify no rendering conflicts

## Future Enhancements

### Potential Improvements
1. **Workflow Visualization**
   - DAG diagram of supersteps
   - Real-time progress updates
   - Worker output inspection

2. **Variable Inspector**
   - Type indicators
   - Edit capabilities
   - Version history

3. **Performance Metrics**
   - Execution time per step
   - Model usage statistics
   - Cost estimation

4. **Export Formats**
   - Workflow-specific markdown export
   - Variable dump as JSON
   - Execution trace logs

## Related Documentation

- [Workflow Model Requests](WORKFLOW_MODEL_REQUESTS.md) - How workflows request LLMs
- [Event Handling Architecture](EVENT_HANDLING.md) - Council event system
- [Backend Architecture](BACKEND_ARCHITECTURE.md) - Overall backend structure
- [Frontend Architecture](FRONTEND_ARCHITECTURE.md) - Frontend component design

## Troubleshooting

### Issue: Workflow doesn't render

**Check:**
1. Does `message.variables` exist?
2. Is `detectExecutionMode()` returning 'workflow'?
3. Are workflow events being handled?
4. Check browser console for warnings

### Issue: Loading state stuck

**Check:**
1. Did `complete` event fire?
2. Is `event.final_variables` populated?
3. Check network tab for stream completion
4. Verify `setIsLoading(false)` called

### Issue: Variables not updating

**Check:**
1. Are `superstep_*_reduce_complete` events firing?
2. Is `event.output_variable` and `event.result` present?
3. Check `handleWorkflowEvent()` in eventHandler.js
4. Verify conversation state updates

## Summary

The unified stage architecture provides:
✅ Single component for all execution modes
✅ Automatic mode detection
✅ Backward compatibility with council execution
✅ Flexible workflow variable display
✅ Cleaner, more maintainable code
✅ Future-proof for new execution modes
