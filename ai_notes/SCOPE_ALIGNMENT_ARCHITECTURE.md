# Scope Alignment Architecture

**Created:** 2025-12-10
**Status:** Active

## Overview

The **Scope Alignment System** is a 4-phase approach to preventing role drift, responsibility overlaps, and coverage gaps in multi-agent workflow execution. It runs as a **silent pre-execution phase** that refines worker role definitions before the workflow begins.

## Problem Statement

### Without Scope Alignment

When multiple LLM agents work on a task with role definitions like:

```
Worker 1: "Analyze from an optimistic perspective"
Worker 2: "Analyze from a skeptical perspective"
```

Common problems emerge:

1. **Role Drift**: Agents expand beyond their intended role during execution
2. **Overlaps**: Multiple agents attempt the same work
3. **Gaps**: Important aspects of the task are missed by all agents
4. **Responsibility Confusion**: Unclear boundaries lead to incomplete or redundant outputs

### With Scope Alignment

The system transforms vague role instructions into **precise operational contracts**:

```
OPERATIONAL SCOPE (DO NOT DEVIATE):
- Primary Responsibility: Identify benefits and opportunities only
- Boundaries: Do NOT analyze risks (handled by skeptic worker)
- Dependencies: None
- Definition of Done: Concrete list of 3-5 benefits with evidence

ORIGINAL TASK INSTRUCTION:
Analyze from an optimistic perspective
```

## Architecture

### 4-Phase System

```
User Task
   ↓
Phase 1 — Scope Construction (Parallel per-agent)
   ↓
Phase 2 — Scope Alignment (Meta-agent coordination)
   ↓
Phase 3 — Execution (Workflow engine with refined scopes)
   ↓
Phase 4 — Post-Execution Audit (Future enhancement)
```

#### Phase 1: Scope Construction

**Purpose:** Each agent independently defines its operational contract.

**Process:**
1. For each worker, send a model request asking it to define:
   - Primary responsibility
   - Non-responsibilities
   - Ownership boundaries
   - Dependency contracts
   - Definition of done

2. Execute **in parallel** (all workers simultaneously)

3. Collect agent scope definitions

**Model Request Template:**
```
You are defining your operational scope for a multi-agent task.

TASK SPECIFICATION (frozen requirements):
{user_task}

YOUR ROLE INSTRUCTION:
{original_instruction}

Your goal: Define your operational contract by answering these questions concisely:

1. Primary Responsibility: What is YOUR core job in this task?
2. Non-Responsibilities: What should you explicitly NOT do?
3. Ownership Boundaries: Where does your work start and end?
4. Dependency Contracts: What do you need from other agents (if anything)?
5. Definition of Done: How will you know your job is complete?

RULES:
- Do NOT perform the task work yet
- Do NOT propose solutions
- ONLY define your operational scope
- Be specific and concrete
- Focus on boundaries and responsibilities
```

**Output:** Map of `worker_id -> scope_definition`

#### Phase 2: Scope Alignment

**Purpose:** Meta-agent resolves conflicts, gaps, and overlaps.

**Process:**
1. Send all agent-defined scopes to a **coordinator model**
2. Coordinator analyzes:
   - Conflicts: Where responsibilities overlap
   - Gaps: What's missing from all scopes
   - Inconsistencies: Contradictory boundaries
3. Coordinator produces **final responsibility map**

**Model Request Template:**
```
You are a meta-coordinator analyzing agent scopes for conflicts and gaps.

TASK SPECIFICATION:
{user_task}

AGENT SCOPES (as defined by each agent):
{all_agent_scopes}

Your goal: Create a final responsibility map that:
1. Detects scope conflicts (overlapping responsibilities)
2. Detects missing ownership (gaps in coverage)
3. Assigns final clear responsibilities

RULES:
- Do NOT solve the task itself
- Do NOT redo the agents' work
- ONLY produce a responsibility map
- Resolve conflicts by clarifying boundaries
- Fill gaps by assigning to appropriate agents
- Keep each agent's core purpose intact

Output format (JSON):
{
  "conflicts_detected": [...],
  "gaps_detected": [...],
  "final_scope_map": {
    "worker_id": {
      "primary_responsibility": "...",
      "boundaries": "...",
      "dependencies": "...",
      "definition_of_done": "..."
    }
  }
}
```

**Output:** Refined scope map with clear boundaries

#### Phase 3: Execution

**Not handled by scope alignment module** - this is the normal workflow execution in `workflow_engine.py`.

The refined scopes are **injected as instruction prefixes** before each worker executes.

#### Phase 4: Post-Execution Audit (Future)

**Purpose:** Detect structural failures after execution.

**Not yet implemented.** Would verify:
- Scope adherence: Did agents stay within boundaries?
- Role drift: Did agents expand beyond their scope?
- Coverage: Were all responsibilities fulfilled?

## Implementation

### File Structure

```
backend/
├── scope_alignment.py          # Core alignment logic (NEW)
├── workflow_engine.py          # Integration point (MODIFIED)
└── ...

dsl-schema.json                 # Schema extension (MODIFIED)
```

### Core Module: `scope_alignment.py`

**Key Functions:**

```python
async def execute_scope_alignment(
    workflow_def: Dict[str, Any],
    task_spec: str,
    config: Dict[str, Any]
) -> Dict[str, str]:
    """
    Main entry point for scope alignment.

    Returns: Dict mapping worker_id to refined scope prefix
    """

async def _phase1_construct_scopes(...) -> Dict[str, str]:
    """
    Phase 1: Parallel scope construction per worker.

    Returns: Dict of worker_id -> agent-defined scope
    """

async def _phase2_align_scopes(...) -> Dict[str, str]:
    """
    Phase 2: Meta-agent coordination and conflict resolution.

    Returns: Dict of worker_id -> refined scope prefix
    """

def apply_scope_to_instruction(
    worker_id: str,
    original_instruction: str,
    scope_map: Dict[str, str]
) -> str:
    """
    Apply refined scope to worker instruction.

    Returns: Instruction with scope prepended
    """
```

### Integration: `workflow_engine.py`

**Modified Components:**

1. **WorkflowExecutor.__init__()**
   - Added `self.scope_map` to store refined scopes
   - Added `self.scope_alignment_enabled` flag

2. **execute_stream()**
   - Added pre-execution hook: `await self._run_scope_alignment_if_enabled(user_input)`
   - Runs **before** `stream_init` event (silent)

3. **_execute_map_phase() → execute_worker()**
   - Apply scope to instruction if alignment enabled:
     ```python
     if self.scope_alignment_enabled:
         instruction = apply_scope_to_instruction(
             worker['worker_id'],
             instruction,
             self.scope_map
         )
     ```

4. **New Method: _run_scope_alignment_if_enabled()**
   - Checks `workflow.scope_alignment.enabled`
   - Runs alignment if enabled
   - Silent failure fallback (doesn't break workflow)

## Configuration

### Schema Definition (`dsl-schema.json`)

```json
{
  "scope_alignment": {
    "enabled": false,
    "coordinator_model": "openai/gpt-4o",
    "scope_construction_timeout_ms": 30000,
    "alignment_timeout_ms": 30000
  }
}
```

**Fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable scope alignment |
| `coordinator_model` | string | `"openai/gpt-4o"` | Model for Phase 2 coordination |
| `scope_construction_timeout_ms` | integer | `30000` | Timeout for Phase 1 per worker |
| `alignment_timeout_ms` | integer | `30000` | Timeout for Phase 2 |

### Example Workflow with Scope Alignment

```json
{
  "flow_id": "debate_with_scope_alignment",
  "scope_alignment": {
    "enabled": true,
    "coordinator_model": "openai/gpt-4o"
  },
  "models": ["openai/gpt-4", "anthropic/claude-3.5-sonnet"],
  "variables": [
    {"name": "final_answer", "type": "string"}
  ],
  "supersteps": [
    {
      "step_id": "debate",
      "map_phase": {
        "workers": [
          {
            "worker_id": "optimist",
            "model_ref": "openai/gpt-4",
            "instruction": "Analyze from an optimistic perspective"
          },
          {
            "worker_id": "skeptic",
            "model_ref": "anthropic/claude-3.5-sonnet",
            "instruction": "Analyze from a skeptical perspective"
          }
        ]
      },
      "reduce_phase": {
        "strategy": "council_chairman",
        "model_ref": "openai/gpt-4o",
        "output_write_to": "final_answer",
        "visibility": {"include_original_input": true}
      }
    }
  ]
}
```

## Performance Characteristics

### Overhead

**Model Requests:**
- Phase 1: N parallel requests (N = number of workers)
- Phase 2: 1 request to coordinator model
- **Total: N + 1 requests**

**Time:**
- Phase 1: ~5-10s (parallel execution)
- Phase 2: ~5-10s (single coordination)
- **Total overhead: ~10-20s** (depends on model latency)

### Backward Compatibility

- **Default behavior:** Scope alignment is **disabled** by default
- Workflows without `scope_alignment` config work as before
- No breaking changes to existing workflows

### Error Handling

**Silent Failure:**
- If scope alignment fails, workflow continues with original instructions
- Errors logged but not exposed to user
- Ensures robustness

## Benefits

### 1. Prevents Role Drift

**Without Scope Alignment:**
```
Worker "optimist" output:
"Benefits: ... However, we should also consider the risks..."
[ROLE DRIFT: doing skeptic's job]
```

**With Scope Alignment:**
```
SCOPE: Do NOT analyze risks (handled by skeptic worker)
→ Worker stays focused on benefits only
```

### 2. Eliminates Overlaps

**Without Scope Alignment:**
```
Worker 1: "Analyze security implications"
Worker 2: "Analyze security and performance"
[OVERLAP: both doing security analysis]
```

**With Scope Alignment:**
```
Worker 1: Primary Responsibility: Security only
Worker 2: Primary Responsibility: Performance only
→ Clear division of labor
```

### 3. Fills Gaps

**Without Scope Alignment:**
```
Workers: [security, performance]
Task requires: security, performance, compliance
[GAP: compliance not covered]
```

**With Scope Alignment:**
```
Phase 2 detects gap → assigns compliance to one worker
→ Full coverage achieved
```

### 4. Improves Output Quality

- **Clearer boundaries** → Less redundancy
- **Better coordination** → More comprehensive coverage
- **Explicit contracts** → Easier to verify completeness

## Design Decisions

### Why Silent?

**Rationale:**
- Scope alignment is an **implementation detail**, not user-facing
- Avoids cluttering SSE stream with internal coordination
- Users see final refined results, not the alignment process

**Trade-off:**
- Less transparency (users don't see alignment happening)
- But cleaner UX and simpler event stream

### Why Before Execution?

**Rationale:**
- All role thinking happens **before** work starts
- Prevents mid-execution role confusion
- Follows principle: "Define roles during planning, not during execution"

**Alternative Considered:**
- Dynamic role adjustment during execution
- Rejected: Too complex, introduces race conditions

### Why Fallback to Original Instructions?

**Rationale:**
- Robustness: Workflow should not fail if alignment fails
- User expectations: They provided instructions that should work

**Trade-off:**
- Silent degradation (user doesn't know alignment failed)
- But ensures reliability

## Testing Strategy

### Unit Tests

```python
# Test Phase 1: Scope Construction
async def test_phase1_construct_scopes():
    workers = [
        {"worker_id": "w1", "model_ref": "openai/gpt-4", "instruction": "..."}
    ]
    scopes = await _phase1_construct_scopes(workers, "task", {})
    assert "w1" in scopes
    assert "PRIMARY RESPONSIBILITY" in scopes["w1"]

# Test Phase 2: Scope Alignment
async def test_phase2_align_scopes():
    agent_scopes = {"w1": "...", "w2": "..."}
    final_map = await _phase2_align_scopes(workers, "task", agent_scopes, "model", {})
    assert "w1" in final_map
    assert "OPERATIONAL SCOPE" in final_map["w1"]

# Test Scope Application
def test_apply_scope_to_instruction():
    scope_map = {"w1": "SCOPE: ..."}
    result = apply_scope_to_instruction("w1", "Original", scope_map)
    assert "SCOPE" in result
    assert "Original" in result
```

### Integration Tests

```python
# Test Full Workflow with Scope Alignment
async def test_workflow_with_scope_alignment():
    workflow_def = {
        "flow_id": "test",
        "scope_alignment": {"enabled": true},
        ...
    }
    executor = WorkflowExecutor(workflow_def)

    # Execute workflow
    events = []
    async for event in executor.execute_stream(conversation, "task"):
        events.append(event)

    # Verify scope alignment ran
    assert executor.scope_alignment_enabled
    assert len(executor.scope_map) > 0
```

### Performance Tests

```python
# Measure Alignment Overhead
async def test_alignment_overhead():
    start = time.time()
    scope_map = await execute_scope_alignment(workflow_def, "task", config)
    duration = time.time() - start

    # Should complete within reasonable time
    assert duration < 30.0  # 30 seconds max
```

## Future Enhancements

### Phase 4: Post-Execution Audit

**Implementation Ideas:**
```python
async def _phase4_audit(
    worker_outputs: List[Dict],
    scope_map: Dict[str, str],
    task_spec: str
) -> Dict[str, Any]:
    """
    Verify scope adherence after execution.

    Returns:
        {
            "scope_violations": [...],
            "coverage_gaps": [...],
            "quality_score": 0.0-1.0
        }
    """
```

**Use Cases:**
- Detect when workers deviated from scope
- Identify tasks that need scope refinement
- Quality metrics for workflow optimization

### Dynamic Scope Adjustment

**Idea:** Allow scopes to be refined between supersteps based on intermediate results.

**Challenges:**
- Complexity: When to trigger re-alignment?
- Cost: Additional model requests
- Stability: May introduce unpredictability

### Scope Templates

**Idea:** Pre-defined scope templates for common roles.

**Example:**
```json
{
  "scope_templates": {
    "security_analyst": {
      "primary_responsibility": "Identify security vulnerabilities",
      "boundaries": "Do not analyze performance or cost"
    }
  }
}
```

**Benefits:**
- Faster alignment (skip Phase 1)
- Consistent role definitions
- Easier workflow authoring

## Common Pitfalls

### 1. Over-Constraining Scopes

**Problem:**
```json
{
  "primary_responsibility": "List exactly 3 benefits, no more, no less"
}
```

**Issue:** Too rigid, prevents natural output variation

**Solution:** Use flexible criteria:
```json
{
  "primary_responsibility": "Identify key benefits (typically 3-5)"
}
```

### 2. Circular Dependencies

**Problem:**
```
Worker 1 depends on Worker 2
Worker 2 depends on Worker 1
```

**Detection:** Phase 2 should detect circular dependencies

**Solution:** Coordinator should break cycles by assigning priority

### 3. Scope Drift in Prompt

**Problem:** Global instruction overlay overrides scope

**Solution:** Apply scope **after** global overlay:
```python
instruction = original_instruction
if global_instruction:
    instruction += f"\n\n{global_instruction}"
# Apply scope last (takes precedence)
if scope_alignment_enabled:
    instruction = apply_scope_to_instruction(...)
```

**Actually implemented:** Scope applied **before** global overlay to allow global overrides when needed.

## Related Documentation

- [Workflow Quick Reference](WORKFLOW_QUICK_REFERENCE.md) - How to create workflows
- [Workflow Model Requests](WORKFLOW_MODEL_REQUESTS.md) - Model request patterns
- [Backend Architecture](BACKEND_ARCHITECTURE.md) - Overall system architecture

## Changelog

**2025-12-10:**
- Initial implementation
- Phase 1 (Scope Construction) implemented
- Phase 2 (Scope Alignment) implemented
- Integration with workflow_engine.py complete
- Schema extension added
- Documentation created

---

**Implementation Status:** ✅ Complete (Phase 1-3)
**Future Work:** Phase 4 (Post-Execution Audit)
