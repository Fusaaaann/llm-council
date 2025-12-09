# Example Workflows

This directory contains example workflow definitions for the LLM Council DSL system.

## Available Examples

### 1. `simple_debate.json` - Minimal Example
**Purpose**: Demonstrates the simplest possible workflow with two perspectives.

**Features**:
- 2 workers (optimist vs skeptic)
- 1 superstep
- Council chairman synthesis
- No middleware

**Use Case**: Quick debates on topics requiring balanced perspective.

### 2. `blind_review.json` - Anonymized Evaluation
**Purpose**: Demonstrates blind peer review with anonymized worker identities.

**Features**:
- 3 workers with identical roles
- Anonymous evaluation (`mask_worker_identities: true`)
- Prevents model bias in synthesis

**Use Case**: Objective evaluation without brand loyalty effects.

### 3. `middleware_pipeline.json` - Advanced Filtering
**Purpose**: Demonstrates middleware operations for post-processing.

**Features**:
- 3 workers
- Regex filtering (flags unhelpful responses)
- Smart truncation (sentence-boundary)
- Simple summary synthesis

**Use Case**: Quality control and output standardization.

### 4. `classic_council.json` - Multi-Stage Deliberation
**Purpose**: Replicates the classic 3-stage council pattern.

**Features**:
- 2 supersteps (initial + synthesis)
- 3 council members + 1 reviewer
- Concurrency control (max 3 parallel)
- Chairman synthesis with instructions

**Use Case**: Complex questions requiring multiple rounds of deliberation.

### 5. `cross_interrogation.json` - Cross-Interrogation Flow
**Purpose**: Demonstrates Stage 1.5 cross-interrogation with variable interpolation.

**Features**:
- 4 supersteps (initial → questions → answers → synthesis)
- Variable interpolation (`${variable_name}`)
- Cross-interrogation reducer strategy
- Models question and answer each other

**Use Case**: Deep dive analysis where models probe each other's responses to uncover insights.

## Testing Workflows

### Using curl

1. **Validate workflow**:
```bash
curl -X POST http://localhost:8003/api/workflows/validate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @simple_debate.json
```

2. **Upload workflow**:
```bash
curl -X POST http://localhost:8003/api/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Simple Debate",
    "description": "Two-perspective debate workflow",
    "workflow": '$(cat simple_debate.json)'
  }'
```

3. **Test workflow**:
```bash
# Get workflow ID from upload response, then:
curl -X POST http://localhost:8003/api/workflows/{workflow_id}/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "What is artificial intelligence?"}' \
  --no-buffer
```

## Customizing Workflows

### Model References
All `model_ref` fields must be valid OpenRouter model identifiers. Common models:
- `openai/gpt-4`
- `openai/gpt-4-turbo`
- `anthropic/claude-3.5-sonnet`
- `google/gemini-2.0-flash-exp`

Check available models: https://openrouter.ai/models

### Resource Limits
- Max supersteps: 20
- Max workers per step: 10
- Max concurrency: 5
- Max global timeout: 600000ms (10 min)
- Max step timeout: 120000ms (2 min)

### Middleware Operations

**filter_regex**:
```json
{
  "op": "filter_regex",
  "apply_to": ["*"],
  "config": {
    "pattern": "(?i)error",
    "action": "drop"  // or "flag"
  }
}
```

**anonymize_pii**:
```json
{
  "op": "anonymize_pii",
  "apply_to": ["worker1", "worker2"],
  "config": {}
}
```

**llm_refine**:
```json
{
  "op": "llm_refine",
  "apply_to": ["*"],
  "config": {
    "model_ref": "openai/gpt-4",
    "instruction": "Make the tone more formal"
  }
}
```

**truncate**:
```json
{
  "op": "truncate",
  "apply_to": ["*"],
  "config": {
    "max_length": 500,
    "strategy": "smart"  // or "hard"
  }
}
```

### Reducer Strategies

**council_chairman**: Comprehensive synthesis
- Best for: Complex questions requiring nuanced integration
- Uses: Chairman model to synthesize all perspectives

**simple_summary**: Quick concatenation
- Best for: Straightforward aggregation
- Uses: Simple prompt to summarize all outputs

**vote_majority**: Democratic voting
- Best for: Binary decisions or multiple choice
- Expects: Worker outputs formatted as "VOTE: <option>"

**cross_interrogation**: Q&A routing and parsing
- Best for: Stage 1.5 cross-interrogation workflows
- Parses: "QUESTIONS FOR Response X:" format
- Returns: JSON with questions and routing metadata

### Variable Interpolation

Enable variable interpolation to reference previous superstep outputs in prompts:

```json
{
  "reduce_phase": {
    "variable_interpolation": true,
    "chairman_instructions": "Previous responses:\n${stage1_responses}\n\nSynthesize these..."
  }
}
```

**Interpolation syntax**: `${variable_name}`

**Supports**:
- `chairman_instructions` in reduce phase
- `global_instruction_overlay` in map phase
- `role_definition` in workers

**Formatting**:
- String variables: Inserted as-is
- JSON objects/arrays: Pretty-printed JSON
- Undefined variables: Left as `${var_name}` placeholder

## Creating New Workflows

1. Start with `simple_debate.json` as a template
2. Modify worker roles and models
3. Add middleware if needed
4. Choose appropriate reducer strategy
5. Validate before deployment
6. Test with sample inputs

## See Also

- [Workflow DSL Documentation](../../TODO/WORKFLOW_DSL_IMPLEMENTATION_PLAN.md)
- [API Documentation](../../CLAUDE.md)
- Schema: `../../dsl-schema.json`
