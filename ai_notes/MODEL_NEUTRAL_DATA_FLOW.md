# Model-Neutral Perspective Data Flow

**Complete end-to-end data flow for model-neutral vs model-bound perspectives**

---

## 🔄 Model-Neutral Flow (Default, Recommended)

### Step 1: User Selection in UI

**File:** `Step3Perspectives.jsx:134-147`

User selects:
```
● No, all models analyze each perspective (Recommended)
  Cartesian product: 2 models × 3 perspectives = 6 analyses
  ✓ Maximum diversity
```

### Step 2: Wizard State

**State Structure:**
```javascript
{
  modelBound: false,  // ← Q2.3 toggle value

  globalModels: [
    { modelRef: 'openai/gpt-4', label: 'GPT-4' },
    { modelRef: 'anthropic/claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' }
  ],

  perspectives: [
    {
      id: 'security',
      name: 'Security Analyst',
      role: 'Assess security risks and vulnerabilities',
      modelBound: false,  // ← Inherited from Q2.3 toggle
      model: null         // ← No model assigned
    },
    {
      id: 'ux',
      name: 'UX Expert',
      role: 'Evaluate user experience impact',
      modelBound: false,
      model: null
    },
    {
      id: 'finance',
      name: 'Finance Expert',
      role: 'Analyze cost implications',
      modelBound: false,
      model: null
    }
  ]
}
```

### Step 3: UI Display

**File:** `Step3Perspectives.jsx:196-207`

Each perspective shows:
```
┌─────────────────────────────────────────────────┐
│ Perspective 1                                   │
│                                                 │
│ Delegate Name: Security Analyst                │
│                                                 │
│ Model                                          │
│ ┌──────────────────────────────────────────┐  │
│ │ 🌐 All models (2)                        │  │
│ │ This perspective will be analyzed by:    │  │
│ │ GPT-4, Claude 3.5 Sonnet                │  │
│ └──────────────────────────────────────────┘  │
│                                                 │
│ Delegate Instructions: Assess security risks...│
└─────────────────────────────────────────────────┘
```

### Step 4: DSL Translation

**File:** `workflowWizardMapper.js:486-501`

```javascript
function mapPerspectives(perspectives) {
  return perspectives.map(p => {
    const perspective = {
      perspective_id: p.id,
      instruction: p.role
    };

    // CRITICAL: p.modelBound = false, so this is skipped
    if (p.modelBound && p.model) {
      perspective.model_ref = p.model;
    }

    return perspective;
  });
}
```

**Output:**
```javascript
[
  { perspective_id: 'security', instruction: 'Assess security risks and vulnerabilities' },
  { perspective_id: 'ux', instruction: 'Evaluate user experience impact' },
  { perspective_id: 'finance', instruction: 'Analyze cost implications' }
]
// ✅ No model_ref fields → model-neutral
```

### Step 5: Model Array Extraction

**File:** `workflowWizardMapper.js:510-530`

```javascript
function extractReferencedModels(wizardState) {
  const modelRefs = new Set();

  // Check for model-neutral perspectives
  const hasModelNeutral = wizardState.perspectives?.some(p => !p.modelBound);

  // ✅ hasModelNeutral = true, so include globalModels
  if (hasModelNeutral && wizardState.globalModels) {
    wizardState.globalModels.forEach(m => {
      modelRefs.add(m.modelRef);
    });
  }

  return Array.from(modelRefs);
}
```

**Output:**
```javascript
['openai/gpt-4', 'anthropic/claude-3-5-sonnet']
```

### Step 6: Final DSL

**File:** `workflowWizardMapper.js:90-102`

```json
{
  "workflow_id": "should_we_implement_dark_mode",
  "description": "Should we implement dark mode?",

  "models": [
    "openai/gpt-4",
    "anthropic/claude-3-5-sonnet"
  ],

  "supersteps": [
    {
      "superstep_id": "gather",
      "superstep_description": "Gather perspectives",

      "map_phase": {
        "perspectives": [
          {
            "perspective_id": "security",
            "instruction": "Assess security risks and vulnerabilities"
          },
          {
            "perspective_id": "ux",
            "instruction": "Evaluate user experience impact"
          },
          {
            "perspective_id": "finance",
            "instruction": "Analyze cost implications"
          }
        ]
      },

      "reduce_phase": {
        "strategy": "council_chairman"
      }
    }
  ]
}
```

### Step 7: Backend Execution

**File:** `backend/workflow_engine.py` (existing code)

Backend generates Cartesian product:
```python
# For each perspective without model_ref:
#   For each model in models[]:
#     Create worker: {model}_{perspective_id}

workers = [
  "gpt-4_security",          # GPT-4 analyzes security perspective
  "gpt-4_ux",                # GPT-4 analyzes UX perspective
  "gpt-4_finance",           # GPT-4 analyzes finance perspective
  "claude-3-5-sonnet_security",  # Claude analyzes security perspective
  "claude-3-5-sonnet_ux",        # Claude analyzes UX perspective
  "claude-3-5-sonnet_finance"    # Claude analyzes finance perspective
]

# Result: 2 models × 3 perspectives = 6 workers
```

---

## 🎯 Model-Bound Flow (Explicit Control)

### Step 1: User Selection in UI

**File:** `Step3Perspectives.jsx:150-164`

User selects:
```
○ No, all models analyze each perspective (Recommended)

● Yes, bind specific models to perspectives
  Explicit control over which model analyzes which perspective
  ✓ Precise control
```

### Step 2: Wizard State

```javascript
{
  modelBound: true,  // ← Q2.3 toggle value

  globalModels: [
    { modelRef: 'openai/gpt-4', label: 'GPT-4' },
    { modelRef: 'anthropic/claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' }
  ],

  perspectives: [
    {
      id: 'security',
      name: 'Security Analyst',
      role: 'Assess security risks',
      modelBound: true,           // ← Inherited from Q2.3 toggle
      model: 'openai/gpt-4'       // ← Explicitly assigned
    },
    {
      id: 'ux',
      name: 'UX Expert',
      role: 'Evaluate user experience',
      modelBound: true,
      model: 'anthropic/claude-3-5-sonnet'  // ← Different model
    },
    {
      id: 'finance',
      name: 'Finance Expert',
      role: 'Analyze costs',
      modelBound: true,
      model: 'openai/gpt-4'       // ← Same model as security
    }
  ]
}
```

### Step 3: UI Display

**File:** `Step3Perspectives.jsx:185-194`

Each perspective shows model dropdown:
```
┌─────────────────────────────────────────────────┐
│ Perspective 1                                   │
│                                                 │
│ Delegate Name: Security Analyst                │
│                                                 │
│ Model *                                        │
│ [OpenAI GPT-4                        ▼]       │
│                                                 │
│ Delegate Instructions: Assess security risks...│
└─────────────────────────────────────────────────┘
```

### Step 4: DSL Translation

**File:** `workflowWizardMapper.js:486-501`

```javascript
function mapPerspectives(perspectives) {
  return perspectives.map(p => {
    const perspective = {
      perspective_id: p.id,
      instruction: p.role
    };

    // ✅ p.modelBound = true AND p.model exists
    if (p.modelBound && p.model) {
      perspective.model_ref = p.model;
    }

    return perspective;
  });
}
```

**Output:**
```javascript
[
  {
    perspective_id: 'security',
    instruction: 'Assess security risks',
    model_ref: 'openai/gpt-4'  // ✅ model_ref added
  },
  {
    perspective_id: 'ux',
    instruction: 'Evaluate user experience',
    model_ref: 'anthropic/claude-3-5-sonnet'  // ✅ model_ref added
  },
  {
    perspective_id: 'finance',
    instruction: 'Analyze costs',
    model_ref: 'openai/gpt-4'  // ✅ model_ref added
  }
]
```

### Step 5: Model Array Extraction

**File:** `workflowWizardMapper.js:510-530`

```javascript
function extractReferencedModels(wizardState) {
  const modelRefs = new Set();

  // Add models from model-bound perspectives
  wizardState.perspectives?.forEach(p => {
    if (p.modelBound && p.model) {
      modelRefs.add(p.model);  // ✅ Adds each bound model
    }
  });

  // Check for model-neutral perspectives
  const hasModelNeutral = wizardState.perspectives?.some(p => !p.modelBound);
  // ✅ hasModelNeutral = false, globalModels NOT included

  return Array.from(modelRefs);
}
```

**Output:**
```javascript
['openai/gpt-4', 'anthropic/claude-3-5-sonnet']
// Only models actually used by perspectives
```

### Step 6: Final DSL

```json
{
  "workflow_id": "should_we_implement_dark_mode",
  "description": "Should we implement dark mode?",

  "models": [
    "openai/gpt-4",
    "anthropic/claude-3-5-sonnet"
  ],

  "supersteps": [
    {
      "superstep_id": "gather",
      "superstep_description": "Gather perspectives",

      "map_phase": {
        "perspectives": [
          {
            "perspective_id": "security",
            "instruction": "Assess security risks",
            "model_ref": "openai/gpt-4"
          },
          {
            "perspective_id": "ux",
            "instruction": "Evaluate user experience",
            "model_ref": "anthropic/claude-3-5-sonnet"
          },
          {
            "perspective_id": "finance",
            "instruction": "Analyze costs",
            "model_ref": "openai/gpt-4"
          }
        ]
      },

      "reduce_phase": {
        "strategy": "council_chairman"
      }
    }
  ]
}
```

### Step 7: Backend Execution

**File:** `backend/workflow_engine.py` (existing code)

Backend uses explicit model_ref:
```python
# For each perspective with model_ref:
#   Create worker: {model}_{perspective_id}

workers = [
  "gpt-4_security",          # Only GPT-4 for security (as specified)
  "claude-3-5-sonnet_ux",    # Only Claude for UX (as specified)
  "gpt-4_finance"            # Only GPT-4 for finance (as specified)
]

# Result: 3 workers (exact 1:1 mapping)
```

---

## 📊 Comparison Table

| Aspect | Model-Neutral (Default) | Model-Bound |
|--------|------------------------|-------------|
| **Q2.3 Toggle** | "No, all models..." | "Yes, bind specific..." |
| **`modelBound` Flag** | `false` | `true` |
| **Perspective `model`** | `null` | `'openai/gpt-4'` (example) |
| **DSL `model_ref`** | ❌ Not present | ✅ Present |
| **UI Display** | Gradient badge "All models (N)" | Model dropdown selector |
| **Worker Count** | N × M (Cartesian product) | M (1:1 mapping) |
| **Example** | 2 models × 3 perspectives = 6 workers | 3 perspectives = 3 workers |
| **Best For** | Maximum diversity, broad analysis | Specific expertise, cost control |

---

## 🎯 Key Implementation Details

### 1. State Synchronization

When user toggles Q2.3, all existing perspectives update:

```javascript
// File: Step3Perspectives.jsx:83-97
const handleModelBoundChange = (value) => {
  setModelBound(value);

  const updated = perspectives.map(p => ({
    ...p,
    modelBound: value,
    model: value ? (p.model || models.GPT4) : null  // Assign default or clear
  }));

  onChange({ modelBound: value, perspectives: updated });
};
```

### 2. DSL Translation Guard

Only adds `model_ref` if BOTH conditions true:

```javascript
// File: workflowWizardMapper.js:494-496
if (p.modelBound && p.model) {
  perspective.model_ref = p.model;
}
```

This prevents:
- ❌ `model_ref: null` (invalid)
- ❌ `model_ref: undefined` (invalid)
- ✅ No field (model-neutral)
- ✅ `model_ref: 'openai/gpt-4'` (model-bound)

### 3. Model Array Optimization

Only includes models that will be used:

```javascript
// File: workflowWizardMapper.js:523-530
const hasModelNeutral = wizardState.perspectives?.some(p => !p.modelBound);

if (hasModelNeutral && wizardState.globalModels) {
  // Include all global models (needed for Cartesian product)
  wizardState.globalModels.forEach(m => modelRefs.add(m.modelRef));
} else {
  // Only include models explicitly referenced by perspectives
  // (already added in earlier loop)
}
```

---

## ✅ Validation Checklist

- [x] Model-neutral perspectives have no `model_ref` in DSL
- [x] Model-bound perspectives have `model_ref` in DSL
- [x] `globalModels` included only when needed
- [x] UI correctly shows badge vs dropdown
- [x] Toggle updates all perspectives atomically
- [x] Backend receives correct DSL structure
- [x] Worker count calculation is accurate
- [x] No orphaned model references

---

**Last Updated:** 2025-12-11
**Status:** ✅ Verified Complete
