# Perspective Matrix Feature

## Overview

The **Perspective Matrix** feature enables every model in your workflow to analyze a question from every defined perspective in a single step. This creates a comprehensive multi-dimensional analysis where different LLMs explore the same perspectives, revealing both consensus and model-specific insights.

## Key Concepts

### Instruction-First Architecture

**Philosophy Shift:** Instead of asking models to "be" a role (role-playing), we ask them to **predict** what someone in that role would say (simulation/meta-reasoning).

```diff
- "You are a security expert"  (role-playing)
+ "Predict what a security expert would identify as the top 3 security concerns"  (simulation)
```

**Benefits:**
- Models stay neutral and objective
- Instructions are first-class citizens
- Clearer semantic separation between what to analyze vs. who to be

### Perspective Matrix

Generate the cartesian product of **models × perspectives** automatically:

```
3 models × 4 perspectives = 12 workers
```

Each worker gets a unique `worker_id` like `gpt-4_security` or `claude_ux`.

## Usage

### Basic Example

```json
{
  "flow_id": "multi_perspective_analysis",
  "models": [
    "openai/gpt-4",
    "anthropic/claude-3.5-sonnet",
    "google/gemini-2.0-flash-exp"
  ],
  "supersteps": [
    {
      "step_id": "analyze",
      "map_phase": {
        "perspective_matrix": {
          "perspectives": [
            {
              "perspective_id": "security",
              "instruction": "Analyze security implications. Predict what a security expert would identify as: (1) attack vectors, (2) data exposure risks, (3) compliance concerns."
            },
            {
              "perspective_id": "ux",
              "instruction": "Analyze UX implications. Predict what a UX designer would identify as: (1) usability issues, (2) accessibility concerns, (3) friction points."
            }
          ]
        }
      },
      "reduce_phase": { ... }
    }
  ]
}
```

This generates 6 workers:
- `gpt-4_security`
- `gpt-4_ux`
- `claude-3.5-sonnet_security`
- `claude-3.5-sonnet_ux`
- `gemini-2.0-flash-exp_security`
- `gemini-2.0-flash-exp_ux`

### Model Filtering

Control which models participate in a specific step:

#### Use All Models (default)

```json
"perspective_matrix": {
  "perspectives": [...]
}
```

Uses all models from `workflow.models`.

#### Whitelist Specific Models

```json
"perspective_matrix": {
  "use_models": "whitelist",
  "models_filter": ["openai/gpt-4", "anthropic/claude-3.5-sonnet"],
  "perspectives": [...]
}
```

Only uses GPT-4 and Claude for this step.

#### Blacklist Specific Models

```json
"perspective_matrix": {
  "use_models": "blacklist",
  "models_filter": ["google/gemini-2.0-flash-exp"],
  "perspectives": [...]
}
```

Uses all models except Gemini for this step.

### Legacy: Inline Models (Deprecated)

For backwards compatibility, you can still specify models inline:

```json
"perspective_matrix": {
  "models": ["openai/gpt-4", "anthropic/claude-3.5-sonnet"],
  "perspectives": [...]
}
```

**Recommendation:** Use global `workflow.models` instead.

## Instruction Field

### New Field: `instruction`

Replaces `role_definition` with clearer semantics:

```json
{
  "worker_id": "analyzer",
  "model_ref": "openai/gpt-4",
  "instruction": "Analyze the security implications and identify the top 3 risks."
}
```

### Backwards Compatibility

The old `role_definition` field is still supported:

```json
{
  "worker_id": "analyzer",
  "model_ref": "openai/gpt-4",
  "role_definition": "You are a security expert..."  // Still works
}
```

**Recommendation:** Migrate to `instruction` for clarity.

## Complete Example

See [`examples/workflows/perspective_matrix.json`](examples/workflows/perspective_matrix.json) for a full working example.

### What It Demonstrates

- 3 models × 4 perspectives = 12 workers
- Global model list at workflow level
- Instruction-first perspective definitions
- Multi-step workflow (analysis → synthesis)

### Perspectives Included

1. **Security**: Attack vectors, data exposure, compliance
2. **UX**: Usability, accessibility, friction points
3. **Performance**: Scalability, latency, resource utilization
4. **Maintainability**: Code complexity, technical debt, maintenance challenges

## Design Decisions

### Why Instruction-First?

**Problem:** "You are a security expert" conflates identity with task.

**Solution:** "Predict what a security expert would identify" keeps models neutral while still exploring the perspective.

**Benefits:**
- Clearer task specification
- Models don't "pretend" to be someone else
- Better for meta-reasoning and simulation tasks

### Why Global Model List?

**Problem:** Repeating model references across steps is verbose and error-prone.

**Solution:** Define models once at workflow level, filter per-step as needed.

**Benefits:**
- DRY (Don't Repeat Yourself)
- Easy to swap model lineup globally
- Clear separation: what models vs. which models for this step

### Why Perspective Matrix?

**Problem:** Manually defining N models × M perspectives = N*M worker blocks.

**Solution:** Automatically generate cartesian product.

**Benefits:**
- 3 models × 5 perspectives: **5 definitions instead of 15**
- Ensures every model tries every perspective (no accidental omissions)
- Easy to add/remove perspectives

## Resource Limits

- `MAX_WORKERS_PER_STEP`: 20 (supports up to 5 models × 4 perspectives)
- `MAX_CONCURRENCY`: 5 (parallel execution limit)

Adjust these in [`backend/workflow_schema.py`](backend/workflow_schema.py) if needed.

## Migration Guide

### Updating Existing Workflows

#### 1. Change `role_definition` to `instruction`

```diff
{
  "worker_id": "worker_a",
  "model_ref": "openai/gpt-4",
- "role_definition": "You are a helpful assistant."
+ "instruction": "Answer the question clearly and concisely."
}
```

#### 2. Use Simulation Framing

```diff
- "instruction": "You are a security expert. Analyze the risks."
+ "instruction": "Predict what a security expert would identify as the top 3 security risks."
```

#### 3. Extract Global Models (Optional)

```diff
{
  "flow_id": "my_workflow",
+ "models": ["openai/gpt-4", "anthropic/claude-3.5-sonnet"],
  "supersteps": [
    {
      "map_phase": {
        "perspective_matrix": {
-         "models": ["openai/gpt-4", "anthropic/claude-3.5-sonnet"],
          "perspectives": [...]
        }
      }
    }
  ]
}
```

## Testing

Run the test suite:

```bash
python test_perspective_matrix.py
```

Tests verify:
- Schema validation
- Worker expansion logic
- Backwards compatibility
- All example workflows

## Implementation Details

### Files Modified

1. **[dsl-schema.json](dsl-schema.json)**: Schema updates
   - Added `models` at workflow level
   - Added `perspective_matrix` with filtering
   - Added `instruction` field (deprecated `role_definition`)

2. **[backend/workflow_engine.py](backend/workflow_engine.py)**: Engine updates
   - `_expand_map_phase_workers()`: Expands perspective_matrix
   - `_select_models()`: Applies whitelist/blacklist filtering
   - Support for both `instruction` and legacy `role_definition`

3. **[backend/workflow_schema.py](backend/workflow_schema.py)**: Validation updates
   - Increased `MAX_WORKERS_PER_STEP` to 20
   - Worker count calculation for perspective_matrix
   - Global model validation

4. **[examples/workflows/](examples/workflows/)**: All examples refactored
   - Simulation framing instead of role-playing
   - New example: [`perspective_matrix.json`](examples/workflows/perspective_matrix.json)

## Future Enhancements

- **Dynamic perspectives**: Generate perspectives based on query analysis
- **Perspective dependencies**: Some perspectives only run if others identify issues
- **Perspective weighting**: Prioritize certain perspectives in synthesis
- **Model selection by capability**: Auto-select models based on task requirements

## Questions?

See [ai_notes/DSL_QUESTIONS.md](ai_notes/DSL_QUESTIONS.md) for the design questions that guided this feature.
