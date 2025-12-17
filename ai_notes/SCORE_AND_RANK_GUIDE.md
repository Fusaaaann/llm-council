# Score & Rank Guide

Complete guide to using the `score_and_rank` superstep type for anonymous peer review and ranking in workflows.

## Table of Contents

- [Overview](#overview)
- [When to Use Score & Rank](#when-to-use-score--rank)
- [How It Works](#how-it-works)
- [Schema Reference](#schema-reference)
- [Configuration Options](#configuration-options)
- [Ranking Algorithms](#ranking-algorithms)
- [Output Formats](#output-formats)
- [Example Workflows](#example-workflows)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The `score_and_rank` superstep is a **special superstep type** that enables workflows to perform anonymous peer review and ranking, mirroring the LLM Council's Stage 2 functionality.

### Key Features

- **Anonymous Evaluation**: Worker identities replaced with "Response A", "Response B", etc.
- **Parallel Evaluation**: Multiple evaluator models judge simultaneously (not sequential)
- **Algorithmic Aggregation**: Rankings combined via voting algorithms (not LLM synthesis)
- **Multiple Algorithms**: Average position, Borda count, ranked pairs, Schulze method
- **Flexible Output**: Leaderboard, full data, or rankings-only formats

### Architecture

Unlike regular **map-reduce supersteps**, `score_and_rank` is an **isolated evaluation phase**:

```
Map-Reduce Superstep:
Map Phase → [Middleware] → Reduce Phase

Score-and-Rank Superstep:
Previous Outputs → Anonymize → Parallel Evaluation → Algorithmic Aggregation
```

## When to Use Score & Rank

### ✅ Use Score & Rank When:

1. **Quality Assessment**: You need to evaluate and rank multiple outputs
2. **Iterative Refinement**: You want multi-round improvement based on peer feedback
3. **Consensus Building**: You need to identify the best solution from multiple candidates
4. **Bias Prevention**: You want to avoid favoritism based on model names
5. **Algorithmic Fairness**: You want deterministic, transparent ranking

### ❌ Don't Use Score & Rank When:

1. **No Comparison Needed**: Single output or outputs don't need ranking
2. **Synthesis Required**: You need an LLM to combine insights (use `council_chairman` reducer instead)
3. **Sequential Processing**: You need outputs to build on each other
4. **Real-time Interaction**: Ranking adds latency

## How It Works

### Execution Flow

```
1. COLLECT HISTORY
   └─ Gather worker outputs from previous supersteps
   └─ Determine which supersteps to include (visibility settings)

2. ANONYMIZE
   └─ Create labels: Response A, B, C, ... (or 1, 2, 3 for >26 responses)
   └─ Build mapping: label → worker_id
   └─ Format anonymized conversation history

3. BUILD PROMPTS
   └─ Create evaluation prompt with ranking instructions
   └─ Include original question (if visibility allows)
   └─ Present anonymized responses

4. PARALLEL EVALUATION
   └─ Query all evaluator models simultaneously
   └─ Each model provides:
       • Individual evaluation of each response
       • Final ranking from best to worst

5. PARSE RANKINGS
   └─ Extract "FINAL RANKING:" section
   └─ Validate completeness (if required)
   └─ Filter out failed/incomplete evaluations

6. AGGREGATE
   └─ Apply ranking algorithm (average_position, borda_count, etc.)
   └─ Calculate consensus indicators
   └─ Generate aggregate scores/ranks

7. FORMAT OUTPUT
   └─ leaderboard: Street ranking card with badges
   └─ full: Complete evaluation data
   └─ rankings_only: Sorted worker IDs

8. WRITE VARIABLE
   └─ Store result in workflow variable
   └─ Continue to next superstep
```

### Anonymization Example

**Before Anonymization:**
```json
[
  {"worker_id": "gpt-4o_analyst", "response": "..."},
  {"worker_id": "claude_analyst", "response": "..."},
  {"worker_id": "gemini_analyst", "response": "..."}
]
```

**After Anonymization:**
```
Response A: ...
Response B: ...
Response C: ...

Mapping (hidden from evaluators):
{
  "Response A": "gpt-4o_analyst",
  "Response B": "claude_analyst",
  "Response C": "gemini_analyst"
}
```

## Schema Reference

### Minimal Example

```json
{
  "superstep_type": "score_and_rank",
  "step_id": "peer_review",
  "evaluator_models": [
    "openai/gpt-4o",
    "anthropic/claude-3.5-sonnet"
  ],
  "output_write_to": "rankings"
}
```

### Complete Example

```json
{
  "superstep_type": "score_and_rank",
  "step_id": "peer_review",
  "description": "Anonymous peer review of initial analyses",

  "evaluator_models": [
    "openai/gpt-4o",
    "anthropic/claude-3.5-sonnet",
    "google/gemini-2.0-flash-exp",
    "x-ai/grok-2-1212"
  ],

  "ranking_instructions": "Evaluate based on:\n1. Technical accuracy\n2. Clarity of explanation\n3. Practical usefulness\n\nRank from best to worst.",

  "visibility": {
    "include_original_input": true,
    "include_conversation_history": false,
    "mask_worker_identities": true,
    "include_supersteps": ["all"]
  },

  "ranking_algorithm": "average_position",
  "output_format": "leaderboard",
  "output_write_to": "peer_rankings",
  "require_complete_rankings": false
}
```

## Configuration Options

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `superstep_type` | string | Must be `"score_and_rank"` |
| `step_id` | string | Unique identifier for this superstep |
| `evaluator_models` | array | Models that will judge (1+ required) |
| `output_write_to` | string | Variable name to write results |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | string | `""` | Human-readable intent |
| `ranking_instructions` | string | Default criteria | Custom evaluation criteria |
| `ranking_algorithm` | string | `"average_position"` | Algorithm choice (see below) |
| `output_format` | string | `"leaderboard"` | Output format (see below) |
| `require_complete_rankings` | boolean | `false` | Reject incomplete rankings |
| `visibility` | object | See below | Control what evaluators see |

### Visibility Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `include_original_input` | boolean | `true` | Include user's original question |
| `include_conversation_history` | boolean | `true` | Include full conversation context |
| `mask_worker_identities` | boolean | `true` | Anonymize worker IDs |
| `include_supersteps` | array | `["all"]` | Which supersteps to include |

**`include_supersteps` Options:**
- `["all"]` - Include all previous supersteps
- `["latest"]` - Only the immediately previous superstep
- `[0, 2, 4]` - Specific superstep indices

## Ranking Algorithms

### 1. Average Position (Default)

**How it works:** Average rank position across all evaluators

**Best for:** General use, easy to understand

**Example:**
```
Evaluator 1: A > B > C  (A=1, B=2, C=3)
Evaluator 2: B > A > C  (B=1, A=2, C=3)
Evaluator 3: A > C > B  (A=1, C=2, B=3)

Average ranks:
A: (1+2+1)/3 = 1.33
B: (2+1+3)/3 = 2.00
C: (3+3+2)/3 = 2.67

Final: A > B > C
```

**Pros:** Simple, intuitive
**Cons:** Sensitive to outliers

### 2. Borda Count

**How it works:** Points based on position (1st place = N points, 2nd = N-1, etc.)

**Best for:** Emphasizing top preferences

**Example:**
```
3 candidates (3 points for 1st, 2 for 2nd, 1 for 3rd):

Evaluator 1: A > B > C  (A=3, B=2, C=1)
Evaluator 2: B > A > C  (B=3, A=2, C=1)
Evaluator 3: A > C > B  (A=3, C=2, B=1)

Total points:
A: 3+2+3 = 8
B: 2+3+1 = 6
C: 1+1+2 = 4

Final: A > B > C
```

**Pros:** Rewards consensus
**Cons:** Can be manipulated by strategic voting

### 3. Ranked Pairs (Tideman)

**How it works:** Pairwise comparison with cycle resolution

**Best for:** Avoiding paradoxes, strict fairness

**Example:**
```
Head-to-head comparisons:
A vs B: A wins 2-1
A vs C: A wins 2-1
B vs C: B wins 2-1

Lock pairs by strength:
A > B (strength 2)
A > C (strength 2)
B > C (strength 2)

Final: A > B > C
```

**Pros:** Condorcet-compliant, fair
**Cons:** More complex, can be slow

### 4. Schulze Method

**How it works:** Beatpath strength comparison

**Best for:** Maximum fairness, handling complex cycles

**Example:**
```
Pairwise preferences:
A beats B: 2-1
B beats C: 2-1
C beats A: 2-1 (paradox!)

Resolve via beatpath:
Strongest path A→B: direct (2)
Strongest path A→C: A→B→C (min=2)
Strongest path B→C: direct (2)

Final: A > B > C (by beatpath strength)
```

**Pros:** Handles cycles well, Condorcet-compliant
**Cons:** Most complex

## Output Formats

### 1. Leaderboard (Default)

**Best for:** Human-readable ranking card with badges

**Structure:**
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "worker_id": "gpt-4o_analyst",
      "model_ref": "openai/gpt-4o",
      "score": 1.33,
      "badge": "🥇",
      "evaluator_consensus": "strong",
      "individual_positions": [1, 2, 1]
    },
    {
      "rank": 2,
      "worker_id": "claude_analyst",
      "model_ref": "anthropic/claude-3.5-sonnet",
      "score": 2.00,
      "badge": "🥈",
      "evaluator_consensus": "moderate",
      "individual_positions": [2, 1, 3]
    }
  ],
  "metadata": {
    "total_evaluated": 3,
    "algorithm": "average_position",
    "timestamp": "2025-12-15T10:30:00Z",
    "label_to_worker": {...}
  }
}
```

**Consensus Indicators:**
- `unanimous`: Variance < 0.5 (all evaluators very close)
- `strong`: Variance < 1.0 (good agreement)
- `moderate`: Variance < 2.0 (some disagreement)
- `weak`: Variance >= 2.0 (significant disagreement)

### 2. Full

**Best for:** Detailed analysis, debugging, research

**Structure:**
```json
{
  "aggregate_rankings": [...],
  "evaluator_rankings": [
    {
      "evaluator_model": "openai/gpt-4o",
      "ranking_text": "...",
      "parsed_ranking": ["Response A", "Response B", "Response C"]
    }
  ],
  "label_mapping": {"Response A": "gpt-4o_analyst"},
  "worker_to_model": {"gpt-4o_analyst": "openai/gpt-4o"},
  "algorithm": "average_position"
}
```

### 3. Rankings Only

**Best for:** Programmatic use, simple sorting

**Structure:**
```json
[
  "gpt-4o_analyst",
  "claude_analyst",
  "gemini_analyst"
]
```

## Example Workflows

See complete examples in `examples/workflows/`:

1. **[peer_review_analysis.json](../examples/workflows/peer_review_analysis.json)**
   - Single-round peer review
   - 3 perspectives × 3 models = 9 workers
   - Anonymous ranking by 4 evaluators
   - Final synthesis incorporating top-ranked insights

2. **[multi_round_review.json](../examples/workflows/multi_round_review.json)**
   - Multi-round iterative refinement
   - Round 1: Initial proposals + review
   - Round 2: Refinements based on feedback + review
   - Uses different algorithms per round (Borda → Schulze)

## Best Practices

### Choosing Evaluators

✅ **Good:**
- Use diverse models for broad perspective
- Include 3+ evaluators for robust consensus
- Mix model families (OpenAI, Anthropic, Google, etc.)

❌ **Bad:**
- Single evaluator (no consensus)
- All from same model family (potential bias)
- Too many evaluators (diminishing returns, high cost)

### Writing Ranking Instructions

✅ **Good:**
```
"Evaluate based on:
1. Technical accuracy and correctness
2. Clarity and ease of understanding
3. Completeness of coverage
4. Practical actionability

Rank from best to worst."
```

❌ **Bad:**
```
"Rank these."  // Too vague
```

### Visibility Configuration

**For pure quality assessment:**
```json
{
  "include_original_input": true,
  "include_conversation_history": false,
  "mask_worker_identities": true,
  "include_supersteps": ["latest"]
}
```

**For context-aware review:**
```json
{
  "include_original_input": true,
  "include_conversation_history": true,
  "mask_worker_identities": true,
  "include_supersteps": ["all"]
}
```

### Algorithm Selection

| Use Case | Recommended Algorithm |
|----------|----------------------|
| General ranking | `average_position` |
| Emphasize top choices | `borda_count` |
| Avoid voting paradoxes | `ranked_pairs` |
| Maximum fairness | `schulze` |
| Performance critical | `average_position` |

## Troubleshooting

### Issue: All evaluators fail

**Symptoms:** `"error": "All evaluators failed"`

**Causes:**
- Network/API errors
- Invalid model identifiers
- Rate limiting

**Solutions:**
- Check model IDs in OpenRouter
- Reduce evaluator count
- Add retry logic

### Issue: Incomplete rankings

**Symptoms:** Warning logs about incomplete rankings

**Causes:**
- Evaluator didn't rank all responses
- Parsing failed

**Solutions:**
- Set `require_complete_rankings: true` to reject incomplete
- Review `ranking_instructions` for clarity
- Check evaluator response format

### Issue: Unexpected ranking order

**Symptoms:** Rankings don't match expectations

**Causes:**
- Different evaluation criteria
- Algorithm choice
- Model biases

**Solutions:**
- Review evaluator reasoning (use `output_format: "full"`)
- Try different algorithm
- Adjust `ranking_instructions`

### Issue: High evaluator disagreement

**Symptoms:** `evaluator_consensus: "weak"`, high variance

**Causes:**
- Genuinely close quality
- Ambiguous criteria
- Model diversity

**Solutions:**
- Add more specific ranking criteria
- Use more evaluators
- Consider if disagreement is valid (not a bug!)

## Advanced Usage

### Variable Interpolation

Use previous rankings in subsequent supersteps:

```json
{
  "map_phase": {
    "global_instruction_overlay": "Improve based on:\n${previous_rankings}"
  },
  "reduce_phase": {
    "variable_interpolation": true,
    "chairman_instructions": "Synthesize using top performers:\n${leaderboard}"
  }
}
```

### Conditional Execution

Combine with middleware to filter low-ranked outputs:

```json
{
  "middleware_phase": [
    {
      "type": "threshold_filter",
      "criteria": {
        "field": "score",
        "operator": "<=",
        "value": 2.0
      }
    }
  ]
}
```

### Multi-Criteria Ranking

Run multiple score_and_rank supersteps with different criteria:

```json
[
  {"step_id": "rank_technical", "ranking_instructions": "Technical accuracy only"},
  {"step_id": "rank_clarity", "ranking_instructions": "Clarity and readability only"},
  {"step_id": "rank_practical", "ranking_instructions": "Practical usefulness only"}
]
```

## Related Documentation

- [Workflow Quick Reference](WORKFLOW_QUICK_REFERENCE.md) - General workflow guide
- [DSL Schema](../dsl-schema.json) - Complete schema reference
- [Backend Architecture](BACKEND_ARCHITECTURE.md) - Implementation details
- [Ranking Algorithms](../backend/ranking_algorithms.py) - Algorithm implementations

## Support

For issues or questions:
- Check [examples/workflows/](../examples/workflows/) for working examples
- Review [Troubleshooting](#troubleshooting) section
- Examine evaluator responses with `output_format: "full"`

**Last Updated:** 2025-12-15
