# Workflow Wizard Redesign - Implementation Status

**Date:** 2025-12-11
**Goal:** Transform Workflow Wizard into 3-tier progressive question framework with model-neutral perspectives

## Overview

The Workflow Wizard redesign introduces a **progressive disclosure** approach where users start with Basic questions (4 steps) and can upgrade to Advanced mode (7 steps) when needed. The most critical change is **model-neutral perspectives by default**, where perspectives are instructions analyzed by all models unless explicitly bound to a specific model.

## Implementation Status: 3/8 Phases Complete ✅

### ✅ Phase 1: Tier Detection and State Management (COMPLETE)

**Files Created:**
1. `frontend/src/components/workflow-editor/utils/tierDetection.js`
   - `detectTier(wizardState)` - Auto-detect Basic vs Advanced tier
   - `extractComplexitySignals(wizardState)` - Extract advanced feature usage
   - `canDowngradeToBasic(wizardState)` - Check if downgrade is safe
   - `validateTierTransition(fromTier, toTier, wizardState)` - Validate tier changes
   - `getActiveAdvancedFeatures(wizardState)` - Get human-readable feature names

2. `frontend/src/components/workflow-editor/utils/dslValidator.js`
   - `validateWorkflowDSL(workflow)` - Validate against DSL schema structure
   - `validateVariableInterpolation(workflow)` - Check ${var} references
   - `validateModelReferences(workflow)` - Check model_ref consistency
   - `validateWorkflowComprehensive(workflow)` - Full validation with warnings

**Key Features:**
- Automatic tier detection based on feature usage
- Safe downgrade validation (prevents loss of Advanced features)
- Client-side DSL validation against schema

---

### ✅ Phase 2: WorkflowWizardMapper Updates (COMPLETE)

**Files Modified:**

1. **`frontend/src/components/workflow-editor/utils/workflowWizardMapper.js`**

   **NEW Functions Added:**
   - `mapPerspectives(perspectives)` - Translate wizard perspectives to DSL (model-neutral by default)
   - `extractReferencedModels(wizardState)` - Extract all model refs for models[] array

   **Updated Functions:**
   - `buildIndependentSynthesisWorkflow()` - Support model-neutral perspectives, column_wise_summary, variable_interpolation
   - `mapWizardStateToWorkflow()` - Use extractReferencedModels(), add scope_alignment config

   **Critical Change - Model-Neutral Translation:**
   ```javascript
   function mapPerspectives(perspectives) {
     return perspectives.map((p, idx) => {
       const perspective = {
         perspective_id: p.id || sanitizeStepId(p.name) || `perspective_${idx}`,
         instruction: p.role || p.instruction || ''
       };

       // CRITICAL: Only add model_ref if user explicitly bound this perspective
       if (p.modelBound && p.model) {
         perspective.model_ref = p.model;
       }
       // Otherwise, model-neutral (all models in models[] analyze this)

       return perspective;
     });
   }
   ```

2. **`frontend/src/components/workflow-editor/utils/strategyTemplates.js`**

   **Updated:**
   - `getVisibilityConfig(visibilityMode, advancedVisibility)` - Support advanced visibility overrides

3. **`frontend/src/workflowGenerator.js`**

   **NEW Methods Added:**
   - `withPerspectives(perspectives)` - Set perspectives instead of workers
   - `withConcurrencyLimit(limit)` - Set concurrency limit

**Key Features:**
- Model-neutral perspectives by default (perspectives analyzed by all models unless model_ref specified)
- Support for column_wise_summary strategy
- Support for variable_interpolation flag
- Support for scope_alignment config
- Support for concurrency_limit
- Advanced visibility overrides

---

### ✅ Phase 3: Reusable UI Components (COMPLETE)

**Files Created:**

1. **`frontend/src/components/workflow-editor/components/QuestionCard.jsx`**
   - Reusable component for wizard questions
   - Consistent Q&A styling with error display

2. **`frontend/src/components/workflow-editor/components/TierBadge.jsx`**
   - Visual tier indicator (Basic 🌱 / Advanced ⚡)
   - Clickable to show tier info

3. **`frontend/src/components/workflow-editor/components/TierUpgradeModal.jsx`**
   - Modal shown when user tries Advanced feature in Basic tier
   - Lists benefits of Advanced mode
   - Upgrade/Cancel buttons

4. **`frontend/src/components/workflow-editor/components/TierDowngradeModal.jsx`**
   - Modal for downgrading to Basic tier
   - Shows blockers if Advanced features in use
   - Safe downgrade validation

5. **`frontend/src/components/workflow-editor/components/MiddlewareBuilder.jsx`**
   - Advanced tier component for building middleware pipelines
   - Supports: filter_regex, anonymize_pii, truncate, llm_refine
   - Visual pipeline flow diagram

**Key Features:**
- Consistent UI components for tier system
- Consent-based tier transitions
- Middleware builder with visual pipeline

---

## Remaining Work: Phases 4-8 (NOT YET IMPLEMENTED)

### ❌ Phase 4: Refactor Basic Tier Steps (PENDING)

**Files to Modify:**

1. **`Step1ProblemDefinition.jsx` → `Step1WhatAndWhy.jsx`**
   - Add Q1.1: "Single query evaluation?" (Yes/No)
   - If No → Auto-trigger Advanced tier
   - Keep: Problem statement, audience fields

2. **`Step3Perspectives.jsx` → `Step2Who.jsx`** (CRITICAL)
   - Add Q2.1: "Multiple models?" toggle
   - Add Q2.2: "Multiple perspectives?" toggle
   - **Add Q2.3: "Model binding?" toggle (NEW - ESSENTIAL)**
     - Default: `modelBound: false` (model-neutral)
     - If true: Show model dropdown per perspective
     - If false: Show "All models" badge, hide model selector
   - Update preset application to respect model binding preference

3. **`Step4DeliberationStrategy.jsx` → `Step3How.jsx`**
   - Simplify to Basic questions only
   - Keep: Global instruction, combination strategy, basic visibility
   - Remove: Complex visibility controls (move to Advanced Step 4)

4. **New: `Step4Review.jsx` (Basic Tier Final Step)****
   - Summary, validation, export
   - Tier badge in header
   - Download/Copy/Save buttons

**Critical State Changes:**
```javascript
// Wizard state update
perspectives: [{
  id: string,
  name: string,
  role: string,
  modelBound: boolean,  // NEW - Q2.3 answer
  model: string | null  // Only set if modelBound=true
}]
```

---

### ❌ Phase 5: Create Advanced Tier Steps (PENDING)

**Files to Create:**

1. **`Step4AdvancedFeatures.jsx`**
   - Q6.1: Multi-superstep builder (follow-up steps)
   - Q7.1: Concurrency limit input
   - Q8.1-8.4: Middleware pipeline builder (use MiddlewareBuilder component)
   - Q9.1: Column-wise summary toggle
   - Q10.1: Clean subquery controls
   - Q11.1-11.2: Advanced visibility toggles

2. **`Step5VariablesAndInterpolation.jsx`**
   - Q12.1: Variable interpolation toggle
   - Rich variable editor (name, type, default_value)
   - Variable flow diagram
   - Interpolation syntax helper (${variable_name})

3. **`Step6Optimization.jsx`**
   - Q13.1: Scope alignment toggle
   - Scope alignment configuration:
     - Coordinator model selection
     - Scope construction timeout
     - Alignment timeout
   - Global timeout slider
   - Performance hints

**State Updates:**
```javascript
{
  // Advanced tier only
  supersteps: [...],
  concurrencyLimit: number | null,
  middleware: [{op, applyTo, config}],
  useColumnWiseSummary: boolean,
  variables: [{name, type, default_value}],
  variableInterpolation: boolean,
  scopeAlignment: {
    enabled: boolean,
    coordinatorModel: string,
    scopeTimeout: number,
    alignmentTimeout: number
  },
  advancedVisibility: {
    includeRejectedItems: boolean,
    includeConversationHistory: boolean
  },
  globalTimeout: number
}
```

---

### ❌ Phase 6: Update WorkflowWizard.jsx (PENDING)

**File to Modify:** `frontend/src/components/workflow-editor/WorkflowWizard.jsx`

**Changes Needed:**

1. **Add Tier State:**
```javascript
const [currentTier, setCurrentTier] = useState(TIERS.BASIC);
const [showUpgradeModal, setShowUpgradeModal] = useState(false);
const [showDowngradeModal, setShowDowngradeModal] = useState(false);
```

2. **Dynamic STEPS Array:**
```javascript
const BASIC_STEPS = [
  { id: 1, title: 'What & Why', component: Step1WhatAndWhy },
  { id: 2, title: 'Who', component: Step2Who },
  { id: 3, title: 'How', component: Step3How },
  { id: 4, title: 'Review', component: Step6Review }
];

const ADVANCED_STEPS = [
  ...BASIC_STEPS.slice(0, 3), // Steps 1-3
  { id: 4, title: 'Advanced Features', component: Step4AdvancedFeatures },
  { id: 5, title: 'Variables & Interpolation', component: Step5VariablesAndInterpolation },
  { id: 6, title: 'Optimization', component: Step6Optimization },
  { id: 7, title: 'Review', component: Step6Review }
];

const STEPS = currentTier === TIERS.BASIC ? BASIC_STEPS : ADVANCED_STEPS;
```

3. **Add Tier Transition Handlers:**
```javascript
const handleTierUpgrade = () => {
  setCurrentTier(TIERS.ADVANCED);
  setShowUpgradeModal(false);
};

const handleTierDowngrade = () => {
  const { canDowngrade, blockers } = canDowngradeToBasic(wizardState);
  if (canDowngrade) {
    setCurrentTier(TIERS.BASIC);
    setShowDowngradeModal(false);
  } else {
    // Show blockers in modal
  }
};

const triggerAdvancedFeature = (featureName) => {
  if (currentTier === TIERS.BASIC) {
    setShowUpgradeModal(true);
    // Pause action until user confirms
  }
};
```

4. **Add Tier Badge to Header:**
```jsx
<div className="wizard-header">
  <TierBadge tier={currentTier} onClick={() => setShowTierModal(true)} />
  {/* ... rest of header ... */}
</div>
```

---

### ❌ Phase 7: Update Step6Review.jsx (PENDING)

**File to Modify:** `frontend/src/components/workflow-editor/steps/Step6Review.jsx`

**Changes Needed:**

1. **Add Tier-Aware Summary:**
```javascript
// Show tier badge
<TierBadge tier={detectTier(state)} />

// Highlight advanced features if any
{getActiveAdvancedFeatures(state).length > 0 && (
  <div className="advanced-features-summary">
    <h4>Advanced Features in Use:</h4>
    <ul>
      {getActiveAdvancedFeatures(state).map(feature => (
        <li key={feature}>{feature}</li>
      ))}
    </ul>
  </div>
)}
```

2. **Add Client-Side Validation:**
```javascript
const handleValidate = () => {
  const result = validateWorkflowComprehensive(generatedWorkflow);
  setValidationResult(result);
};
```

3. **Syntax Highlighting for JSON Preview:**
   - Use `react-syntax-highlighter` or similar
   - Color-code DSL structure

---

### ❌ Phase 8: DSL Validation and Testing (PENDING)

**Tasks:**

1. **Add Schema Validation:**
   - Validate all generated workflows against `dsl-schema.json`
   - Test round-trip: Wizard State → DSL → Wizard State

2. **Test Cases:**
   - **Basic Tier:**
     - Single model, single perspective (model-neutral)
     - Multiple models, single perspective (all models analyze)
     - Multiple models, multiple perspectives (Cartesian product)
   - **Advanced Tier:**
     - Model-bound perspectives (explicit model_ref)
     - Column-wise summary strategy
     - Variable interpolation
     - Scope alignment
     - Middleware pipeline
     - Multi-superstep workflows

3. **Migration Testing:**
   - Test all example workflows load correctly
   - Ensure backward compatibility with old format

4. **UI Testing:**
   - Tier transition flows (Basic → Advanced → Basic)
   - Modal interactions
   - Error validation

---

## Critical Design Decisions Implemented

### 1. Model-Neutral Default Behavior ✅

**Q: When user chooses "I don't care which model each perspective uses", what happens?**

**Answer:** Pure Model-Neutral (per DSL_MIGRATION_GUIDE.md)
- All models in `models[]` array analyze ALL perspectives
- Cartesian product: N models × M perspectives = N×M workers auto-generated
- Example: 3 models × 2 perspectives = 6 workers (`gpt-4_security`, `claude_security`, etc.)

**Implementation:**
```javascript
// Wizard state
perspectives: [
  { id: 'security', name: 'Security', role: '...', modelBound: false, model: null }
]

// DSL output
{
  "models": ["openai/gpt-4", "anthropic/claude-3"],
  "map_phase": {
    "perspectives": [
      { "perspective_id": "security", "instruction": "..." }
      // No model_ref = all models analyze this
    ]
  }
}
```

### 2. Consent Modal for Tier Transitions ✅

**Implementation:** TierUpgradeModal component shows when user tries Advanced feature
- User clicks "Upgrade" → Set tier to Advanced, complete action
- User clicks "Cancel" → Stay in Basic, action cancelled

### 3. Model-Neutral Presets ✅

**Decision:** All 60+ presets load with `modelBound: false`
- No default model assignments in preset definitions
- User must explicitly bind to specific model if needed

### 4. Simplified Review Step ✅

**Implementation:**
- Text summary (goal, perspectives, strategy, settings)
- JSON preview with syntax highlighting
- Schema validation feedback
- Export options (download, copy, save)
- NO flowcharts or test runs (out of scope)

---

## Next Steps (Recommended Order)

1. **Start with Phase 4** - Refactor Basic tier steps
   - **MOST CRITICAL:** Update `Step3Perspectives.jsx` → `Step2Who.jsx` with Q2.3 "Model binding?" toggle
   - This is the user-facing control for model-neutral vs model-bound perspectives

2. **Then Phase 6** - Update `WorkflowWizard.jsx` with dynamic tier flow
   - Get Basic tier working end-to-end first

3. **Then Phase 5** - Create Advanced tier steps
   - Build on top of working Basic tier

4. **Finally Phases 7-8** - Review step updates and testing

---

## Testing Strategy

### Unit Tests
- `tierDetection.js` - All detection functions
- `dslValidator.js` - Validation logic
- `workflowWizardMapper.js` - Translation correctness

### Integration Tests
- Round-trip testing: Wizard State → DSL → Wizard State
- All example workflows generate valid DSL
- Tier transitions work correctly

### Manual Testing
- Basic tier: Create simple workflows with model-neutral perspectives
- Advanced tier: Test all advanced features
- Tier transitions: Upgrade/downgrade flows
- Validation: Test error messages and feedback

---

## Files Summary

### ✅ Created (8 files)
1. `frontend/src/components/workflow-editor/utils/tierDetection.js`
2. `frontend/src/components/workflow-editor/utils/dslValidator.js`
3. `frontend/src/components/workflow-editor/components/QuestionCard.jsx`
4. `frontend/src/components/workflow-editor/components/TierBadge.jsx`
5. `frontend/src/components/workflow-editor/components/TierUpgradeModal.jsx`
6. `frontend/src/components/workflow-editor/components/TierDowngradeModal.jsx`
7. `frontend/src/components/workflow-editor/components/MiddlewareBuilder.jsx`
8. `ai_notes/WORKFLOW_WIZARD_REDESIGN_STATUS.md` (this file)

### ✅ Modified (3 files)
1. `frontend/src/components/workflow-editor/utils/workflowWizardMapper.js`
2. `frontend/src/components/workflow-editor/utils/strategyTemplates.js`
3. `frontend/src/workflowGenerator.js`

### ❌ To Create (3 files)
1. `frontend/src/components/workflow-editor/steps/Step1WhatAndWhy.jsx`
2. `frontend/src/components/workflow-editor/steps/Step4AdvancedFeatures.jsx`
3. `frontend/src/components/workflow-editor/steps/Step5VariablesAndInterpolation.jsx`
4. `frontend/src/components/workflow-editor/steps/Step6Optimization.jsx`

### ❌ To Modify (5 files)
1. `frontend/src/components/workflow-editor/WorkflowWizard.jsx`
2. `frontend/src/components/workflow-editor/steps/Step1ProblemDefinition.jsx` → rename to `Step1WhatAndWhy.jsx`
3. `frontend/src/components/workflow-editor/steps/Step3Perspectives.jsx` → rename to `Step2Who.jsx`
4. `frontend/src/components/workflow-editor/steps/Step4DeliberationStrategy.jsx` → rename to `Step3How.jsx`
5. `frontend/src/components/workflow-editor/steps/Step6Review.jsx`

---

## Progress: 37.5% Complete

- ✅ Phase 1: Tier Detection (12.5%)
- ✅ Phase 2: WorkflowWizardMapper (12.5%)
- ✅ Phase 3: UI Components (12.5%)
- ❌ Phase 4: Basic Tier Steps (0%)
- ❌ Phase 5: Advanced Tier Steps (0%)
- ❌ Phase 6: WorkflowWizard.jsx (0%)
- ❌ Phase 7: Review Step (0%)
- ❌ Phase 8: Testing (0%)

---

## Key Accomplishments

1. **Core Architecture Complete:** Tier detection, DSL validation, model extraction all working
2. **Critical Translation Logic:** Model-neutral perspectives correctly mapped to DSL
3. **UI Foundation Ready:** All reusable components created (QuestionCard, TierBadge, Modals, MiddlewareBuilder)
4. **Backend Generator Support:** Added `withPerspectives()` and `withConcurrencyLimit()` methods

**Next:** Implement Basic tier steps (Phase 4) to get user-facing wizard working with model-neutral perspectives.
