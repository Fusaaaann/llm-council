# Workflow Wizard Redesign - Quick Start Guide

**For developers continuing the implementation**

## TL;DR

We're transforming the Workflow Wizard from a linear 7-step flow into a **3-tier progressive framework** where:
- **Basic Tier** (4 steps): Simple multi-model evaluation with model-neutral perspectives
- **Advanced Tier** (7 steps): Full DSL control with middleware, variables, scope alignment

**Status:** Foundation complete (37.5%). Need to implement UI steps.

---

## Critical Concept: Model-Neutral Perspectives

### The Problem We're Solving

**Old Approach (deprecated):**
```json
"workers": [
  { "worker_id": "security_gpt4", "model_ref": "openai/gpt-4", "role_definition": "Assess security..." },
  { "worker_id": "security_claude", "model_ref": "anthropic/claude-3", "role_definition": "Assess security..." }
]
```
❌ **Problem:** Duplicates role definitions for each model. Hard to maintain.

**New Approach (default):**
```json
"models": ["openai/gpt-4", "anthropic/claude-3"],
"perspectives": [
  { "perspective_id": "security_analysis", "instruction": "Assess security..." }
  // No model_ref = all models analyze this perspective
]
```
✅ **Solution:** Perspectives are model-neutral instructions. Backend auto-generates N×M workers.

### User-Facing Question

**Q2.3: "Do you care which exact model each perspective uses?"**

- **NO (Recommended, Default)** → Model-neutral:
  ```javascript
  { id: 'security', name: 'Security', role: '...', modelBound: false, model: null }
  ```
  **DSL Output:** `{ perspective_id: 'security', instruction: '...' }` (no `model_ref`)

- **YES** → Model-bound:
  ```javascript
  { id: 'security', name: 'Security', role: '...', modelBound: true, model: 'openai/gpt-4' }
  ```
  **DSL Output:** `{ perspective_id: 'security', instruction: '...', model_ref: 'openai/gpt-4' }`

---

## What's Been Built (Phases 1-3)

### Phase 1: Tier Detection ✅

**File:** `frontend/src/components/workflow-editor/utils/tierDetection.js`

```javascript
import { detectTier, canDowngradeToBasic, getActiveAdvancedFeatures } from './utils/tierDetection.js';

// Auto-detect tier
const tier = detectTier(wizardState); // 'basic' | 'advanced'

// Check downgrade safety
const { canDowngrade, blockers } = canDowngradeToBasic(wizardState);
// { canDowngrade: false, blockers: ['Follow-up steps are configured', ...] }

// Get active features
const features = getActiveAdvancedFeatures(wizardState);
// ['Multi-step workflows', 'Variable interpolation', ...]
```

**Triggers for Advanced Tier:**
- `followUpSteps.length > 0` - Multi-superstep
- `middleware.length > 0` - Middleware pipeline
- `variableInterpolation === true` - Variable interpolation
- `scopeAlignment.enabled === true` - Scope alignment
- `concurrencyLimit !== null` - Concurrency limiting
- `useColumnWiseSummary === true` - Column-wise reduction
- `variables.length > 0` - Custom variables

### Phase 2: DSL Translation ✅

**File:** `frontend/src/components/workflow-editor/utils/workflowWizardMapper.js`

**Key Functions:**

```javascript
// Map perspectives (model-neutral by default)
function mapPerspectives(perspectives) {
  return perspectives.map(p => {
    const perspective = {
      perspective_id: p.id || sanitizeStepId(p.name),
      instruction: p.role
    };
    // ONLY add model_ref if user explicitly bound this perspective
    if (p.modelBound && p.model) {
      perspective.model_ref = p.model;
    }
    return perspective;
  });
}

// Extract models for models[] array
function extractReferencedModels(wizardState) {
  const modelRefs = new Set();

  // Model-bound perspectives
  wizardState.perspectives?.forEach(p => {
    if (p.modelBound && p.model) modelRefs.add(p.model);
  });

  // Global models (if any model-neutral perspectives)
  const hasModelNeutral = wizardState.perspectives?.some(p => !p.modelBound);
  if (hasModelNeutral) {
    wizardState.globalModels?.forEach(m => modelRefs.add(m.modelRef));
  }

  // Chairman, middleware, scope alignment models...
  return Array.from(modelRefs);
}
```

**Workflow Generator Updates:**

```javascript
import { createSuperstep } from '../../../workflowGenerator.js';

// NEW: Use perspectives instead of workers
let superstep = createSuperstep('gather', 'Gather perspectives')
  .withPerspectives(mapPerspectives(perspectives))  // Model-neutral by default
  .withConcurrencyLimit(state.concurrencyLimit)     // Optional
  .withReduce({
    strategy: state.useColumnWiseSummary ? 'column_wise_summary' : 'council_chairman',
    variableInterpolation: state.variableInterpolation || false
  });
```

### Phase 3: UI Components ✅

**Files:**
- `QuestionCard.jsx` - Reusable question component
- `TierBadge.jsx` - Tier indicator (Basic 🌱 / Advanced ⚡)
- `TierUpgradeModal.jsx` - Upgrade consent modal
- `TierDowngradeModal.jsx` - Downgrade warning modal
- `MiddlewareBuilder.jsx` - Middleware pipeline builder

**Usage:**

```jsx
import QuestionCard from '../components/QuestionCard.jsx';
import TierBadge from '../components/TierBadge.jsx';
import TierUpgradeModal from '../components/TierUpgradeModal.jsx';

<QuestionCard
  question="Do you care which exact model each perspective uses?"
  description="Model-neutral perspectives are analyzed by all models."
  required={true}
  error={errors.modelBinding}
>
  <div className="radio-group">
    <label>
      <input type="radio" value="no" checked={!modelBound} />
      No, all models analyze each perspective (Recommended)
    </label>
    <label>
      <input type="radio" value="yes" checked={modelBound} />
      Yes, bind specific models to perspectives
    </label>
  </div>
</QuestionCard>

<TierBadge tier={currentTier} onClick={() => setShowTierModal(true)} />

<TierUpgradeModal
  isOpen={showUpgradeModal}
  onUpgrade={handleTierUpgrade}
  onCancel={() => setShowUpgradeModal(false)}
  featureName="Follow-up Steps"
/>
```

---

## What Needs to Be Built (Phases 4-8)

### Phase 4: Basic Tier Steps (NEXT)

**Priority: HIGH - This is the user-facing control for model-neutral perspectives**

#### 1. Update Step3Perspectives.jsx → Step2Who.jsx

**Most Critical Change:**

```jsx
// Add Q2.3: Model binding toggle
const [modelBound, setModelBound] = useState(false); // Default: model-neutral

<QuestionCard
  question="Q2.3: Do you care which exact model each perspective uses?"
  description="Model-neutral perspectives are analyzed by all models (recommended for diverse viewpoints)."
>
  <div className="radio-group">
    <label>
      <input
        type="radio"
        checked={!modelBound}
        onChange={() => setModelBound(false)}
      />
      <div>
        <strong>No, all models analyze each perspective (Recommended)</strong>
        <p>Cartesian product: {globalModels.length} models × {perspectives.length} perspectives</p>
      </div>
    </label>
    <label>
      <input
        type="radio"
        checked={modelBound}
        onChange={() => setModelBound(true)}
      />
      <div>
        <strong>Yes, bind specific models to perspectives</strong>
        <p>Explicit control over which model analyzes which perspective</p>
      </div>
    </label>
  </div>
</QuestionCard>

{/* Perspective Builder */}
{perspectives.map((perspective, index) => (
  <div key={perspective.id}>
    <input
      type="text"
      placeholder="Perspective name (e.g., Security Analyst)"
      value={perspective.name}
      onChange={(e) => updatePerspective(index, 'name', e.target.value)}
    />
    <textarea
      placeholder="What should this perspective focus on?"
      value={perspective.role}
      onChange={(e) => updatePerspective(index, 'role', e.target.value)}
    />

    {/* Model selector - ONLY show if modelBound=true */}
    {modelBound ? (
      <ModelSelect
        value={perspective.model}
        onChange={(modelRef) => {
          updatePerspective(index, 'modelBound', true);
          updatePerspective(index, 'model', modelRef);
        }}
        globalModels={globalModels}
      />
    ) : (
      <div className="model-neutral-badge">
        All models ({globalModels.length})
      </div>
    )}
  </div>
))}
```

**State Update:**
```javascript
const updatePerspective = (index, field, value) => {
  const updated = [...perspectives];
  updated[index][field] = value;

  // If switching to model-neutral, clear model binding
  if (field === 'modelBound' && !value) {
    updated[index].model = null;
  }

  onChange({ perspectives: updated });
};
```

#### 2. Rename Step1ProblemDefinition.jsx → Step1WhatAndWhy.jsx

Minor changes, keep existing functionality.

#### 3. Simplify Step4DeliberationStrategy.jsx → Step3How.jsx

Remove advanced visibility controls (move to Advanced tier).

### Phase 6: Update WorkflowWizard.jsx

```jsx
import { TIERS, detectTier } from './utils/tierDetection.js';
import TierBadge from './components/TierBadge.jsx';
import TierUpgradeModal from './components/TierUpgradeModal.jsx';

const [currentTier, setCurrentTier] = useState(TIERS.BASIC);
const [showUpgradeModal, setShowUpgradeModal] = useState(false);

// Dynamic steps
const BASIC_STEPS = [
  { id: 1, title: 'What & Why', component: Step1WhatAndWhy },
  { id: 2, title: 'Who', component: Step2Who },
  { id: 3, title: 'How', component: Step3How },
  { id: 4, title: 'Review', component: Step6Review }
];

const ADVANCED_STEPS = [
  ...BASIC_STEPS.slice(0, 3),
  { id: 4, title: 'Advanced Features', component: Step4AdvancedFeatures },
  { id: 5, title: 'Variables', component: Step5VariablesAndInterpolation },
  { id: 6, title: 'Optimization', component: Step6Optimization },
  { id: 7, title: 'Review', component: Step6Review }
];

const STEPS = currentTier === TIERS.BASIC ? BASIC_STEPS : ADVANCED_STEPS;

// Tier transition
const handleTierUpgrade = () => {
  setCurrentTier(TIERS.ADVANCED);
  setShowUpgradeModal(false);
};

// Header
<div className="wizard-header">
  <TierBadge tier={currentTier} onClick={() => setShowTierModal(true)} />
  <h1>Workflow Wizard</h1>
</div>

<TierUpgradeModal
  isOpen={showUpgradeModal}
  onUpgrade={handleTierUpgrade}
  onCancel={() => setShowUpgradeModal(false)}
/>
```

---

## Testing Your Changes

### 1. Test Model-Neutral Translation

```javascript
// Wizard state
const wizardState = {
  globalModels: [
    { modelRef: 'openai/gpt-4' },
    { modelRef: 'anthropic/claude-3' }
  ],
  perspectives: [
    { id: 'security', name: 'Security', role: 'Assess risks', modelBound: false, model: null },
    { id: 'optimist', name: 'Optimist', role: 'Find opportunities', modelBound: false, model: null }
  ]
};

// Expected DSL
const expected = {
  models: ['openai/gpt-4', 'anthropic/claude-3'],
  supersteps: [{
    map_phase: {
      perspectives: [
        { perspective_id: 'security', instruction: 'Assess risks' },
        { perspective_id: 'optimist', instruction: 'Find opportunities' }
      ]
    }
  }]
};

// Backend generates: 2 models × 2 perspectives = 4 workers
// gpt-4_security, gpt-4_optimist, claude_security, claude_optimist
```

### 2. Test Model-Bound Translation

```javascript
// Wizard state
const wizardState = {
  perspectives: [
    { id: 'security', name: 'Security', role: 'Assess risks', modelBound: true, model: 'openai/gpt-4' },
    { id: 'optimist', name: 'Optimist', role: 'Find opportunities', modelBound: true, model: 'anthropic/claude-3' }
  ]
};

// Expected DSL
const expected = {
  models: ['openai/gpt-4', 'anthropic/claude-3'],
  supersteps: [{
    map_phase: {
      perspectives: [
        { perspective_id: 'security', instruction: 'Assess risks', model_ref: 'openai/gpt-4' },
        { perspective_id: 'optimist', instruction: 'Find opportunities', model_ref: 'anthropic/claude-3' }
      ]
    }
  }]
};

// Backend generates: 2 workers (explicit binding)
// gpt-4_security, claude_optimist
```

### 3. Test Tier Detection

```javascript
import { detectTier } from './utils/tierDetection.js';

// Basic tier
const basicState = {
  perspectives: [{ modelBound: false }],
  variableInterpolation: false
};
console.assert(detectTier(basicState) === 'basic');

// Advanced tier (has follow-up steps)
const advancedState = {
  ...basicState,
  followUpSteps: [{ taskDescription: 'Refine answer' }]
};
console.assert(detectTier(advancedState) === 'advanced');
```

---

## Common Gotchas

1. **Model-neutral perspectives require globalModels**
   - If `modelBound: false`, ensure `wizardState.globalModels` is populated
   - Otherwise, `extractReferencedModels()` won't add any models to DSL

2. **Perspective presets default to model-neutral**
   - All 60+ presets load with `modelBound: false`
   - User must explicitly bind if they want specific model

3. **DSL uses perspectives XOR workers**
   - Never have both `perspectives` and `workers` in same superstep
   - `withPerspectives()` deletes `workers` field

4. **Variable interpolation requires declaration**
   - If `variableInterpolation: true`, validate all `${var}` references exist
   - Use `validateVariableInterpolation(workflow)` before save

---

## Next Steps

1. **Implement Phase 4** - Basic tier steps (especially Step2Who.jsx with Q2.3)
2. **Test end-to-end** - Create workflow in Basic tier, validate DSL output
3. **Add Advanced steps** - Implement Phases 5-6
4. **Full testing** - Phases 7-8

---

## Questions?

See:
- `ai_notes/WORKFLOW_WIZARD_REDESIGN_STATUS.md` - Full implementation status
- `ai_notes/DSL_MIGRATION_GUIDE.md` - DSL perspective spec
- `dsl-schema.json` - DSL schema reference
- `frontend/src/components/workflow-editor/utils/workflowWizardMapper.js` - Translation logic
