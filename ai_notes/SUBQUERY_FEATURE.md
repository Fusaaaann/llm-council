# Clean Subquery Feature

## Overview

The `subquery_single_model` reducer strategy enables starting fresh, unbiased queries with a single anonymous model while maintaining complete control over what context is shared.

## Key Benefits

1. **Anonymous Execution**: Model identity remains hidden to prevent bias
2. **Context Control**: Precisely control what information the model sees
3. **Clean Queries**: Start fresh without prior discussion context
4. **Flexible Configuration**: Fine-grained visibility controls

## Use Cases

### 1. Unbiased Fresh Perspectives
Get an independent opinion without influence from prior debate:
```json
{
  "visibility": {
    "include_original_input": true,
    "include_conversation_history": false,
    "include_worker_outputs": false
  }
}
```

### 2. Synthetic Query Generation
Generate follow-up questions or subqueries based on context:
```json
{
  "visibility": {
    "include_original_input": true,
    "include_conversation_history": true,
    "include_worker_outputs": true
  },
  "chairman_instructions": "Based on the discussion, generate 3 follow-up questions that would clarify the topic."
}
```

### 3. Independent Verification
Verify conclusions without revealing the debate process:
```json
{
  "visibility": {
    "include_original_input": true,
    "include_conversation_history": false,
    "include_worker_outputs": false
  },
  "chairman_instructions": "Verify the factual accuracy of this claim independently."
}
```

## Configuration Reference

### Strategy
```json
{
  "strategy": "subquery_single_model"
}
```

### Visibility Controls

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `include_original_input` | boolean | true | Include the current user query |
| `include_conversation_history` | boolean | false | Include prior conversation messages |
| `include_worker_outputs` | boolean | false | Include outputs from map phase workers |
| `mask_worker_identities` | boolean | true | Keep model identity anonymous |

### Example Configuration

**Minimal Clean Subquery:**
```json
{
  "reduce_phase": {
    "strategy": "subquery_single_model",
    "model_ref": "anthropic/claude-3.5-sonnet",
    "output_write_to": "fresh_answer",
    "visibility": {
      "include_original_input": true,
      "include_conversation_history": false,
      "include_worker_outputs": false
    }
  }
}
```

**With Custom Instructions:**
```json
{
  "reduce_phase": {
    "strategy": "subquery_single_model",
    "model_ref": "openai/gpt-4",
    "output_write_to": "analysis",
    "visibility": {
      "include_original_input": true,
      "include_conversation_history": false,
      "include_worker_outputs": false
    },
    "chairman_instructions": "Provide a technical analysis focusing on security implications."
  }
}
```

## Example Workflows

### 1. Simple Clean Subquery
See: [clean_subquery.json](clean_subquery.json)

Single-step workflow that gets a fresh perspective without any context.

### 2. Debate with Fresh Judge
See: [debate_with_fresh_judge.json](debate_with_fresh_judge.json)

Three-step workflow:
1. **Initial Debate**: Multiple perspectives discuss the question
2. **Fresh Judgment**: Independent model answers without seeing the debate
3. **Final Synthesis**: Compare debate vs. fresh judgment

## Implementation Details

### Empty Map Phase
When using `subquery_single_model`, the map phase can be empty:
```json
{
  "map_phase": {
    "workers": []
  }
}
```

This is valid because the reducer doesn't rely on worker outputs when `include_worker_outputs: false`.

### Message Building
The reducer builds messages based on visibility settings:

1. **No History, No Workers**: Only current input
   ```
   [{"role": "user", "content": "What is quantum computing?"}]
   ```

2. **With History**: Full conversation context
   ```
   [
     {"role": "user", "content": "Tell me about AI"},
     {"role": "assistant", "content": "..."},
     {"role": "user", "content": "What is quantum computing?"}
   ]
   ```

3. **With Workers**: Includes previous perspectives
   ```
   [{"role": "user", "content": "Previous perspectives:\nPerspective 1: ...\n\nQuestion: What is quantum computing?"}]
   ```

### Anonymity
Model identity is never revealed in:
- Event streams
- Worker output labels
- Final responses

The model is selected via `model_ref` but remains anonymous to end users.

## Advanced Patterns

### Multi-Stage Verification
```json
{
  "supersteps": [
    {
      "step_id": "claim",
      "map_phase": { "workers": [...] },
      "reduce_phase": {
        "strategy": "council_chairman",
        "output_write_to": "initial_answer"
      }
    },
    {
      "step_id": "verify",
      "map_phase": { "workers": [] },
      "reduce_phase": {
        "strategy": "subquery_single_model",
        "output_write_to": "verification",
        "visibility": {
          "include_conversation_history": false
        },
        "chairman_instructions": "Independently verify the factual claims in the original question."
      }
    }
  ]
}
```

### Iterative Refinement
```json
{
  "supersteps": [
    {
      "step_id": "draft",
      "reduce_phase": {
        "strategy": "subquery_single_model",
        "output_write_to": "draft_v1"
      }
    },
    {
      "step_id": "refine",
      "reduce_phase": {
        "strategy": "subquery_single_model",
        "output_write_to": "draft_v2",
        "visibility": {
          "include_worker_outputs": true
        },
        "chairman_instructions": "Refine the previous draft by addressing any gaps or unclear points."
      }
    }
  ]
}
```

## Security Considerations

1. **Context Isolation**: `include_conversation_history: false` ensures prior sensitive discussion isn't leaked
2. **Model Anonymity**: `mask_worker_identities: true` prevents brand bias
3. **Minimal Exposure**: Only share what's necessary for the query

## Performance Notes

- **Fast Execution**: Single model query is faster than multi-worker map phase
- **Low Token Usage**: Clean queries use fewer tokens than full context
- **Parallel Execution**: Can run multiple clean subqueries in parallel across supersteps

## Limitations

1. Model cannot access conversation history when `include_conversation_history: false`
2. Cannot synthesize worker outputs when `include_worker_outputs: false`
3. Relies entirely on the single model's capabilities

## Future Enhancements

- [ ] Support for multiple anonymous subqueries in parallel
- [ ] Streaming token output for long subquery responses
- [ ] Variable interpolation in `chairman_instructions`
- [ ] Conditional subquery execution based on prior results
