# DSL Migration Guide: Workers/Perspective Matrix → Unified Perspectives

**Date:** 2025-12-11
**Migration:** Old DSL (workers + perspective_matrix) → New DSL (unified perspectives)

## Overview

The workflow DSL has been unified to use a single `perspectives` concept that is **model-neutral by default**. This eliminates the confusing distinction between `workers` (model-specific) and `perspective_matrix` (cartesian product), replacing both with a cleaner, more intuitive design.

## Key Changes

### 1. Terminology

| Old Term | New Term | Meaning |
|----------|----------|---------|
| `workers` | `perspectives` (with `model_ref`) | Model-specific perspective (opt-out) |
| `perspective_matrix` | `perspectives` (without `model_ref`) | Model-neutral perspective (default) |
| `perspective_id` | `perspective_id` | Unchanged |
| `instruction` | `instruction` | Unchanged |

### 2. Design Philosophy

**OLD:** Model-specific bindings were primary, cartesian product was alternative
**NEW:** Model-neutral analysis is default, model-specific is special case opt-out

### 3. Schema Changes

**Map Phase:**
```json
// OLD (mutually exclusive)
"map_phase": {
  "workers": [...] OR "perspective_matrix": {...}
}

// NEW (unified)
"map_phase": {
  "perspectives": [...]  // Required
}
```

**Reduce Phase:**
```json
// NEW strategy added
"reduce_phase": {
  "strategy": "column_wise_summary",  // New option
  "output_write_to": "perspective_summaries"
}
```

## Migration Patterns

### Pattern 1: Explicit Workers → Model-Specific Perspectives

**Before (Old DSL):**
```json
{
  "map_phase": {
    "workers": [
      {
        "worker_id": "optimist",
        "model_ref": "openai/gpt-4",
        "instruction": "Analyze from optimistic perspective..."
      },
      {
        "worker_id": "skeptic",
        "model_ref": "anthropic/claude-3.5-sonnet",
        "instruction": "Analyze from skeptical perspective..."
      }
    ]
  }
}
```

**After (New DSL):**
```json
{
  "map_phase": {
    "perspectives": [
      {
        "perspective_id": "optimist",
        "model_ref": "openai/gpt-4",
        "instruction": "Analyze from optimistic perspective..."
      },
      {
        "perspective_id": "skeptic",
        "model_ref": "anthropic/claude-3.5-sonnet",
        "instruction": "Analyze from skeptical perspective..."
      }
    ]
  }
}
```

**Changes:**
- `workers` → `perspectives`
- `worker_id` → `perspective_id`
- `model_ref` kept inline (model-specific opt-out)

### Pattern 2: Perspective Matrix → Model-Neutral Perspectives

**Before (Old DSL):**
```json
{
  "models": ["openai/gpt-4", "anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash-exp"],
  "supersteps": [
    {
      "map_phase": {
        "perspective_matrix": {
          "perspectives": [
            {
              "perspective_id": "security",
              "instruction": "Analyze security implications..."
            },
            {
              "perspective_id": "ux",
              "instruction": "Analyze UX implications..."
            }
          ]
        }
      }
    }
  ]
}
```

**After (New DSL):**
```json
{
  "models": ["openai/gpt-4", "anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash-exp"],
  "supersteps": [
    {
      "map_phase": {
        "perspectives": [
          {
            "perspective_id": "security",
            "instruction": "Analyze security implications..."
          },
          {
            "perspective_id": "ux",
            "instruction": "Analyze UX implications..."
          }
        ]
      }
    }
  ]
}
```

**Changes:**
- `perspective_matrix` removed
- `perspectives` moved to top level of `map_phase`
- No `model_ref` → model-neutral (default)

**Behavior:**
- 3 models × 2 perspectives = 6 workers auto-generated
- Worker IDs: `gpt-4_security`, `gpt-4_ux`, `claude-3.5-sonnet_security`, etc.

### Pattern 3: Mixed Model-Neutral + Model-Specific

**New capability (impossible in old DSL):**
```json
{
  "models": ["openai/gpt-4", "anthropic/claude-3.5-sonnet"],
  "supersteps": [
    {
      "map_phase": {
        "perspectives": [
          {
            "perspective_id": "security",
            "instruction": "Analyze security..."
          },
          {
            "perspective_id": "ux",
            "instruction": "Analyze UX..."
          },
          {
            "perspective_id": "final_synthesis",
            "model_ref": "openai/gpt-4-turbo",
            "instruction": "Synthesize all perspectives..."
          }
        ]
      }
    }
  ]
}
```

**Workers generated:**
- `gpt-4_security`
- `gpt-4_ux`
- `claude-3.5-sonnet_security`
- `claude-3.5-sonnet_ux`
- `gpt-4-turbo_final_synthesis` (model-specific)

## Column-Wise Reduction (New)

### Overview

The new `column_wise_summary` reducer strategy groups outputs by perspective and compares how different models analyzed each perspective.

**Concept:**
```
         Security     UX          Performance
GPT-4    [response]   [response]  [response]
Claude   [response]   [response]  [response]
Gemini   [response]   [response]  [response]
         ↓            ↓           ↓
Reduce:  Security     UX          Performance
         Summary      Summary     Summary
```

### Usage

```json
{
  "reduce_phase": {
    "strategy": "column_wise_summary",
    "model_ref": "openai/gpt-4",
    "output_write_to": "perspective_summaries",
    "chairman_instructions": "For each perspective, compare how different models analyzed it."
  }
}
```

### Output Format

JSON object mapping perspective IDs to summaries:

```json
{
  "security": "GPT-4 emphasized authentication risks, Claude highlighted API vulnerabilities, Gemini noted data exposure concerns...",
  "ux": "All models agreed on navigation complexity. GPT-4 uniquely identified accessibility issues...",
  "performance": "Consensus on database bottleneck. Claude and Gemini suggested caching strategies..."
}
```

### When to Use

- **Column-wise:** When you want to compare models on each perspective separately
- **Traditional (council_chairman):** When you want one global synthesis of all outputs

## Automated Migration

### Using the Migration Script

```bash
# Preview changes (dry run)
python scripts/migrate_workflows.py --dry-run

# Migrate all workflows in examples/workflows/
python scripts/migrate_workflows.py

# Migrate specific directory
python scripts/migrate_workflows.py path/to/workflows

# Migrate single file
python scripts/migrate_workflows.py examples/workflows/my_workflow.json
```

### What the Script Does

1. **Detects** old DSL patterns (`workers` or `perspective_matrix`)
2. **Transforms** to new unified `perspectives` format
3. **Backs up** original files as `.json.backup`
4. **Writes** migrated workflows

### Manual Migration

If you prefer to migrate manually:

1. **For `workers`:** Rename to `perspectives`, change `worker_id` to `perspective_id`, keep `model_ref` inline
2. **For `perspective_matrix`:** Unwrap `perspectives` array to top level of `map_phase`, remove `perspective_matrix` wrapper

## Breaking Changes

### Schema Validation

Old workflows will **fail schema validation** with new dsl-schema.json:
- `workers` is no longer a valid field
- `perspective_matrix` is no longer a valid field
- `perspectives` is now required

### Backend Processing

- `_expand_map_phase_workers()` in `backend/workflow_engine.py` only recognizes `perspectives`
- Old format will result in empty worker list

## Backwards Compatibility

**None.** This is a breaking change requiring migration.

**Rationale:**
- Feature not yet deployed to production
- Example workflows migrated
- Clean break prevents technical debt

## Testing After Migration

### 1. Schema Validation

```bash
# Validate migrated workflow against schema
python -c "
import json
import jsonschema

with open('dsl-schema.json') as f:
    schema = json.load(f)

with open('examples/workflows/my_workflow.json') as f:
    workflow = json.load(f)

jsonschema.validate(workflow, schema)
print('✓ Valid')
"
```

### 2. Worker Expansion

Verify workers are correctly expanded:
```python
# In backend/workflow_engine.py
workers = self._expand_map_phase_workers(map_config)
print(f"Generated {len(workers)} workers:")
for w in workers:
    print(f"  - {w['worker_id']} → {w['model_ref']}")
```

### 3. End-to-End Test

Run migrated workflow and verify:
- Correct number of workers execute
- Outputs are captured correctly
- Reducer produces expected format

## FAQ

### Q: Why unify workers and perspective_matrix?

**A:** The distinction was implementation detail, not conceptual. Both define "what to analyze." The real distinction is:
- **Model-neutral** (default): All models analyze this perspective
- **Model-specific** (opt-out): Specific model analyzes this perspective

### Q: What about the workflow editor UI?

**A:** The workflow editor will be redesigned to:
- Show model-neutral as default
- Display incremental model workload when adding perspectives
- Allow opt-out to model-specific for special cases

### Q: Can I still do cartesian product (all models × all perspectives)?

**A:** Yes! That's now the **default behavior**. Just define perspectives without `model_ref`:

```json
{
  "models": ["model1", "model2", "model3"],
  "map_phase": {
    "perspectives": [
      {"perspective_id": "p1", "instruction": "..."},
      {"perspective_id": "p2", "instruction": "..."}
    ]
  }
}
```

This generates 6 workers: model1_p1, model1_p2, model2_p1, model2_p2, model3_p1, model3_p2

### Q: What if I need different models for different perspectives?

**A:** Use inline `model_ref` for each perspective that needs a specific model:

```json
{
  "perspectives": [
    {"perspective_id": "analysis", "instruction": "..."},  // All models
    {"perspective_id": "synthesis", "model_ref": "openai/gpt-4-turbo", "instruction": "..."}  // Only GPT-4 Turbo
  ]
}
```

## Related Documentation

- [Plan File](/home/user/.claude/plans/proud-jingling-ripple.md) - Complete design rationale
- [dsl-schema.json](../dsl-schema.json) - Updated schema
- [backend/workflow_engine.py](../backend/workflow_engine.py) - Implementation
- [backend/workflow_reducers.py](../backend/workflow_reducers.py) - Column-wise reducer
- [scripts/migrate_workflows.py](../scripts/migrate_workflows.py) - Migration tool

## Support

For migration issues:
1. Check this guide
2. Review plan file for detailed design decisions
3. Test with `--dry-run` first
4. Report issues at https://github.com/anthropics/llm-council/issues
