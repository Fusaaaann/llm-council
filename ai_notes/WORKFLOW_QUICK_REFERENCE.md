# Workflow System - Quick Reference

**Last Updated:** 2025-12-09

Quick reference guide for developers working with the workflow execution system.

## Designing Reusable Workflow Patterns

**Philosophy:** Workflows are **reusable intelligence architectures**, not one-off tasks.

### ✅ Good Pattern Definition
```
Pattern: "Technology Migration Decision Framework"
Runtime Query: "Should we migrate from PostgreSQL to MongoDB?"
```

### ❌ Bad Pattern Definition
```
Pattern: "Should we migrate from PostgreSQL to MongoDB?"
Runtime Query: (no room for variation - not reusable!)
```

### Key Principles

1. **Define the TYPE of problem**, not a specific instance
   - ✅ "Strategic Planning & Recommendations"
   - ❌ "Q4 2025 Marketing Strategy"

2. **Context describes the pattern's scope**, not specific audience
   - ✅ "Technical stakeholders requiring deep analysis"
   - ❌ "Our engineering team discussing the database migration"

3. **User provides specific queries at runtime**
   - Workflow definition = reusable template
   - User input at execution = specific question

4. **Think in categories**
   - "What **category of problems** will this solve repeatedly?"
   - "Can this pattern handle 100 variations of similar queries?"

### Example Patterns

See [`examples/workflows/README_PATTERNS.md`](../examples/workflows/README_PATTERNS.md) for full examples:
- **Technology Migration Framework** - Evaluate any tech migration decision
- **Strategic Planning Engine** - Develop strategies for business decisions
- **Research Synthesis Pipeline** - Synthesize academic literature

### How Patterns Work at Runtime

**Workflow Definition (stored once):**
```json
{
  "flow_id": "tech_migration_framework",
  "map_phase": {
    "global_instruction_overlay": "Workflow Purpose: Technology Migration Decision Framework\n\nContext: Technical stakeholders requiring comprehensive analysis..."
  }
}
```

**Runtime Execution:**
```
User Query: "Should we migrate from PostgreSQL to MongoDB?"

Backend combines: global_instruction_overlay + user_query → LLM workers
```

---

## Model Request Pattern (TL;DR)

**All model requests use the centralized OpenRouter client:**

```python
# Import
from .openrouter import query_model, query_models_parallel

# Single model request
response = await query_model(model_ref, messages)
if response is not None:
    content = response.get('content', '')

# Parallel model requests
responses = await query_models_parallel(model_refs, messages)
for model, response in responses.items():
    if response is not None:
        content = response.get('content', '')
```

## Configuration Checklist

✅ **Required Environment Variables:**

```bash
# .env file must contain:
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx  # Get from https://openrouter.ai/keys
```

⚠️ **Common Mistakes:**

1. Missing `.env` file
2. Wrong key format (extra spaces, newlines)
3. Key in wrong file (`.env.example` instead of `.env`)
4. Key not loaded (forgot `load_dotenv()`)

## Message Format

```python
messages = [
    {"role": "system", "content": "Your instructions here"},
    {"role": "user", "content": "User question"},
    {"role": "assistant", "content": "Previous response"},
    {"role": "user", "content": "Follow-up question"}
]
```

## Workflow Map Phase Pattern

```python
# backend/workflow_engine.py:221-242
async def execute_worker(worker: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    # 1. Build instruction
    instruction = worker.get('instruction') or worker.get('role_definition', '')

    # 2. Build messages (instruction as system prompt)
    worker_messages = [{"role": "system", "content": instruction}] + messages

    # 3. Query model (SAME AS COUNCIL)
    response = await query_model(worker['model_ref'], worker_messages)

    # 4. Check for None and extract content
    if response is not None:
        return {
            'worker_id': worker['worker_id'],
            'model_ref': worker['model_ref'],
            'output': response.get('content', ''),
            'instruction': instruction
        }
    return None
```

## Workflow Reduce Phase Pattern

```python
# backend/workflow_reducers.py
from .openrouter import query_model

# Build synthesis prompt
synthesis_prompt = f"{chairman_instructions}\n\n{worker_outputs_text}"

# Build messages
chairman_messages = messages[:-1] + [
    {"role": "user", "content": synthesis_prompt}
]

# Query chairman model (SAME AS COUNCIL STAGE 3)
response = await query_model(config['model_ref'], chairman_messages)

if response is None:
    return "Error: Failed to generate synthesis."

return response.get('content', '')
```

## Error Handling

### 401 Unauthorized

**Cause:** Missing or invalid API key

**Fix:**
```bash
# Check if key exists
cat .env | grep OPENROUTER_API_KEY

# Verify key is loaded
python -c "from backend.config import OPENROUTER_API_KEY; print(OPENROUTER_API_KEY)"

# Test key manually
curl -H "Authorization: Bearer YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"openai/gpt-4o","messages":[{"role":"user","content":"test"}]}' \
     https://openrouter.ai/api/v1/chat/completions
```

### Model Not Found (404)

**Cause:** Invalid model identifier

**Fix:** Check available models at https://openrouter.ai/models

### Timeout

**Cause:** Model taking too long

**Fix:**
```python
response = await query_model(model, messages, timeout=300.0)  # 5 minutes
```

## Testing

### Quick Test Script

```python
# test_model_request.py
import asyncio
from backend.openrouter import query_model

async def test():
    messages = [{"role": "user", "content": "Say hello"}]
    response = await query_model("openai/gpt-4o", messages)
    if response:
        print(f"✅ Success: {response['content']}")
    else:
        print("❌ Failed")

asyncio.run(test())
```

Run: `python test_model_request.py`

## Comparison: Council vs Workflow

| Aspect | Council (Legacy) | Workflow (New) |
|--------|------------------|----------------|
| **Client** | `openrouter.py` | `openrouter.py` ✅ |
| **Pattern** | `query_model()` | `query_model()` ✅ |
| **Auth** | `OPENROUTER_API_KEY` | `OPENROUTER_API_KEY` ✅ |
| **Error Handling** | Check for `None` | Check for `None` ✅ |
| **Message Format** | OpenRouter standard | OpenRouter standard ✅ |
| **Concurrency** | `asyncio.gather()` | Semaphore + `gather()` ✅ |

**Conclusion:** Workflow system follows exact same pattern as council system. No code changes needed.

## File Locations

- **OpenRouter Client:** [`backend/openrouter.py`](../backend/openrouter.py)
- **Config:** [`backend/config.py`](../backend/config.py)
- **Workflow Engine:** [`backend/workflow_engine.py`](../backend/workflow_engine.py)
- **Workflow Reducers:** [`backend/workflow_reducers.py`](../backend/workflow_reducers.py)
- **Council Logic:** [`backend/council.py`](../backend/council.py)

## Additional Resources

- **Full Guide:** [WORKFLOW_MODEL_REQUESTS.md](WORKFLOW_MODEL_REQUESTS.md)
- **Backend Architecture:** [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md)
- **OpenRouter Docs:** https://openrouter.ai/docs

## Recent Issues

**2025-12-09:** Fixed 401 error with `google/gemini-2.5-flash`
- **Cause:** Misplaced API key value in `.env` file
- **Fix:** Corrected API key placement
- **Lesson:** Always verify `.env` format - no extra spaces or newlines

## Troubleshooting Checklist

When you get a model request error:

1. ✅ Check `.env` file exists: `ls -la .env`
2. ✅ Check API key is set: `cat .env | grep OPENROUTER_API_KEY`
3. ✅ Check key is loaded: `python -c "from backend.config import OPENROUTER_API_KEY; print(OPENROUTER_API_KEY)"`
4. ✅ Check model identifier is valid: Visit https://openrouter.ai/models
5. ✅ Test with curl (see above)
6. ✅ Check logs for specific error message

**If still failing:**
- Check OpenRouter dashboard for API usage/errors
- Verify account has credits
- Try a different model to isolate issue
- Check network connectivity to `openrouter.ai`

## Score & Rank Superstep (Peer Review)

The `score_and_rank` superstep enables anonymous peer review and ranking of worker outputs.

### Quick Start

```json
{
  "superstep_type": "score_and_rank",
  "step_id": "peer_review",
  "evaluator_models": [
    "openai/gpt-4o",
    "anthropic/claude-3.5-sonnet",
    "google/gemini-2.0-flash-exp"
  ],
  "output_write_to": "rankings"
}
```

### Key Features

- **Anonymous Evaluation**: Workers identified as "Response A", "Response B", etc.
- **Parallel Evaluation**: All evaluators judge simultaneously
- **Algorithmic Aggregation**: Voting algorithms (no LLM synthesis)
- **Multiple Algorithms**: average_position, borda_count, ranked_pairs, schulze

### Common Patterns

**Pattern 1: Single-Round Review**
```
Step 1 (map-reduce): Generate diverse analyses
Step 2 (score_and_rank): Rank analyses by quality
Step 3 (map-reduce): Synthesize top-ranked insights
```

**Pattern 2: Multi-Round Refinement**
```
Round 1: Proposals → Ranking
Round 2: Refinements (based on R1 feedback) → Ranking
Round 3: Final synthesis
```

### Configuration Options

```json
{
  "superstep_type": "score_and_rank",
  "step_id": "review",
  
  // Who evaluates
  "evaluator_models": ["model1", "model2", ...],
  
  // What criteria
  "ranking_instructions": "Evaluate based on:\n1. Accuracy\n2. Clarity\n3. Usefulness",
  
  // What evaluators see
  "visibility": {
    "include_original_input": true,
    "mask_worker_identities": true,
    "include_supersteps": ["all"]  // or ["latest"] or [0, 2, 4]
  },
  
  // How to aggregate
  "ranking_algorithm": "average_position",  // or borda_count, ranked_pairs, schulze
  
  // Output format
  "output_format": "leaderboard",  // or "full" or "rankings_only"
  
  // Where to write
  "output_write_to": "variable_name"
}
```

### Output Formats

**leaderboard** (default): Street ranking card with badges
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "worker_id": "gpt-4o_analyst",
      "model_ref": "openai/gpt-4o",
      "score": 1.33,
      "badge": "🥇",
      "evaluator_consensus": "strong"
    }
  ]
}
```

**full**: Complete evaluation data for analysis

**rankings_only**: Simple array of worker_ids in order

### Using Rankings in Later Steps

```json
{
  "reduce_phase": {
    "variable_interpolation": true,
    "chairman_instructions": "Synthesize the final answer using insights from the top-ranked analyses:\n\n${peer_rankings}"
  }
}
```

### Algorithm Comparison

| Algorithm | Best For | Speed |
|-----------|----------|-------|
| `average_position` | General use, simple | Fast |
| `borda_count` | Emphasizing top choices | Fast |
| `ranked_pairs` | Avoiding paradoxes | Moderate |
| `schulze` | Maximum fairness | Slow |

### Examples

See complete examples:
- `examples/workflows/peer_review_analysis.json` - Single-round review
- `examples/workflows/multi_round_review.json` - Multi-round refinement

### Full Documentation

For comprehensive guide, see [SCORE_AND_RANK_GUIDE.md](SCORE_AND_RANK_GUIDE.md)

---

**Last Updated:** 2025-12-15
