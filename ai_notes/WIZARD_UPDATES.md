# Workflow Wizard Updates

## Summary of Changes

Updated the Workflow Wizard to use "delegate" and "collect" terminology instead of technical "map/reduce" terminology, making it more user-friendly while maintaining the same underlying functionality.

## Changes Made

### 1. Updated Step Titles (WorkflowWizard.jsx)

Changed from technical names to user-friendly descriptions:

- ❌ **Old**: Problem → Success → Perspectives → Strategy → Settings → Review
- ✅ **New**: Goal & Audience → Answer Format & Variables → Delegates (AI Helpers) → How to Collect & Decide → Runtime & Safety → Review & Export

### 2. Extended Wizard State

Added new fields to support better control and clarity:

**New fields:**
- `workflowId`: Internal workflow name (e.g., 'my_workflow')
- `finalOutputVar`: Name of the final answer variable (default: 'final_answer')
- `defaultDelegateRole`: Shared instructions for all delegates
- `collectTimeout`: Timeout for the collect & decide phase
- `concurrencyLimit`: How many delegates can run in parallel

**Updated comments:**
- All state field comments now use "delegate" terminology
- Clear mapping to what each step configures

### 3. New Interaction Modes (strategyTemplates.js)

Added modes from the manual to support the full DSL:

```javascript
INTERACTION_MODES = {
  INDEPENDENT_SYNTHESIS: 'independent_synthesis',
  MAJORITY_VOTE: 'majority_vote',        // NEW
  CROSS_EXAMINATION: 'cross_examination', // NEW
  SINGLE_HELPER: 'single_helper',         // NEW
  DEBATE: 'debate',
  BLIND_REVIEW: 'blind_review',
  VOTING: 'voting',
  MULTI_STAGE: 'multi_stage'
}
```

**Strategy mappings:**
- `MAJORITY_VOTE` → `strategies.VOTE_MAJORITY`
- `CROSS_EXAMINATION` → `strategies.CROSS_INTERROGATION`
- `SINGLE_HELPER` → `strategies.SUBQUERY_SINGLE_MODEL`

### 4. Updated Strategy Descriptions

Changed terminology from "perspectives" and "chairman" to "delegates" and "collector":

```javascript
// Before
'Perspectives provide independent responses, then a chairman synthesizes...'

// After
'Delegates provide independent responses, then a collector synthesizes...'
```

### 5. Created Translation Layer (wizardTranslator.js)

New utility file that handles bidirectional translation between wizard state and advanced editor config:

**Functions:**
- `wizardToAdvancedConfig(wizardState)`: Convert wizard → advanced editor
- `advancedConfigToWizard(config)`: Convert advanced editor → wizard
- Helper functions: `mapInteractionModeToStrategy()`, `mapVisibilityModeToPreset()`

**Translation process:**
1. Flow ID and timeout
2. Output variable (type based on outputFormat)
3. Global instruction (combines goal, audience, qualities, constraints, format)
4. Workers (delegates with IDs, roles, models)
5. Reduce config (strategy, model, visibility, chairman instructions, timeout)
6. Supersteps (currently single-step workflows only)

### 6. Integrated Translation

Updated `WorkflowWizard.jsx` to use the translator:

```javascript
const handleSwitchToAdvanced = () => {
  if (onSwitchToAdvanced) {
    const advancedConfig = wizardToAdvancedConfig(wizardState);
    onSwitchToAdvanced(advancedConfig);
  }
};
```

This ensures when users click "Switch to Advanced Editor", their wizard state is properly converted to the advanced editor's config format.

## Mapping Guide

### Step-by-step field mappings

#### Step 1: Goal & Audience
- `workflowId` → `flowId`
- `problemStatement` → `supersteps[0].description` + `globalInstruction`
- `audience` → `supersteps[0].globalInstruction`

#### Step 2: Answer Format & Variables
- `outputFormat` → `variables[0].type` (text_summary→string, list→list, json_object→json_object)
- `finalOutputVar` → `variables[0].name` + `reduce.outputWriteTo`
- `qualities` → `supersteps[0].globalInstruction`
- `constraints` → `supersteps[0].globalInstruction`
- `customFormat` → `supersteps[0].globalInstruction`

#### Step 3: Delegates (AI Helpers)
- `perspectives[i].id` → `workers[i].worker_id`
- `perspectives[i].role` → `workers[i].role_definition`
- `perspectives[i].modelRef` → `workers[i].model_ref`
- `defaultDelegateRole` → `supersteps[0].defaultRole`

#### Step 4: How to Collect & Decide
- `interactionMode` → `reduce.strategy` (via mapping function)
- `decisionMaker.model` → `reduce.modelRef`
- `decisionMaker.instructions` → `reduce.chairmanInstructions`
- `visibilityMode` → `reduce.visibilityPreset`
- `collectTimeout` → `reduce.timeout`

#### Step 5: Runtime & Safety
- `globalTimeout` → `globalTimeout`
- `concurrencyLimit` → `supersteps[0].concurrency`
- `filters` → `supersteps[0].middleware`
- `costControls` → (currently no direct mapping, used for model selection)

## Next Steps

To complete the integration, you should:

1. **Update Step Components**: Modify each step component (Step1ProblemDefinition.jsx through Step6Review.jsx) to:
   - Use the new field names
   - Update labels and help text to match the manual
   - Add new fields (workflowId, finalOutputVar, defaultDelegateRole, collectTimeout, concurrencyLimit)

2. **Update Step6Review.jsx**:
   - Display the translated config in a user-friendly format
   - Show the mapping between wizard state and advanced editor structure
   - Allow exporting the workflow

3. **Test Translation**:
   - Create workflows in wizard mode
   - Switch to advanced editor and verify correct translation
   - Switch back and verify round-trip conversion

4. **Update Advanced Editor** (optional):
   - Rename "Reduce Phase" to "Collect & Decide (Reduce Phase)"
   - Update section descriptions to use "delegate" terminology

## Benefits

- **User-friendly**: "Delegate" and "collect" are more intuitive than "map" and "reduce"
- **Mechanistic mapping**: Clear 1:1 translation between wizard and advanced editor
- **Extensible**: Easy to add new interaction modes and fields
- **Maintainable**: Centralized translation logic
- **Type-safe**: Clear field mappings prevent errors

## Files Modified

1. `/frontend/src/components/workflow-editor/WorkflowWizard.jsx`
   - Updated step titles
   - Extended wizard state
   - Added translation handler

2. `/frontend/src/components/workflow-editor/utils/strategyTemplates.js`
   - Added new interaction modes
   - Updated strategy descriptions to use "delegate" terminology
   - Updated strategy mappings

3. `/frontend/src/components/workflow-editor/utils/wizardTranslator.js` (NEW)
   - Translation functions
   - Bidirectional conversion
   - Strategy and visibility mapping helpers
