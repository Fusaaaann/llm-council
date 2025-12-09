# Workflow DSL Quick Start

**5-minute guide to creating and testing your first workflow**

---

## Prerequisites

1. Backend running: `python -m backend.main`
2. Auth token obtained (via `/api/auth/login`)

---

## Step 1: Validate Example Workflow

```bash
export TOKEN="your-access-token-here"

curl -X POST http://localhost:8003/api/workflows/validate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "workflow": {
      "flow_id": "test",
      "variables": [{"name": "answer", "type": "string"}],
      "supersteps": [{
        "step_id": "s1",
        "map_phase": {
          "workers": [{
            "worker_id": "w1",
            "model_ref": "openai/gpt-4",
            "role_definition": "Answer helpfully."
          }]
        },
        "reduce_phase": {
          "strategy": "simple_summary",
          "model_ref": "openai/gpt-4",
          "output_write_to": "answer",
          "visibility": {}
        }
      }]
    }
  }'
```

**Expected**: `{"valid": true, "errors": null}`

---

## Step 2: Upload Workflow

```bash
curl -X POST http://localhost:8003/api/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Workflow",
    "description": "Simple test workflow",
    "workflow": {
      "flow_id": "test",
      "variables": [{"name": "answer", "type": "string"}],
      "supersteps": [{
        "step_id": "s1",
        "map_phase": {
          "workers": [{
            "worker_id": "w1",
            "model_ref": "openai/gpt-4",
            "role_definition": "You are a helpful assistant."
          }]
        },
        "reduce_phase": {
          "strategy": "simple_summary",
          "model_ref": "openai/gpt-4",
          "output_write_to": "answer",
          "visibility": {"include_original_input": true}
        }
      }]
    }
  }'
```

**Response**: Save the `id` field for next step.

---

## Step 3: Test Execution

```bash
export WORKFLOW_ID="paste-id-from-step2"

curl -X POST http://localhost:8003/api/workflows/$WORKFLOW_ID/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "What is 2+2?"}' \
  --no-buffer
```

**Expected Output** (SSE stream):
```
data: {"type":"stream_init","workflow_id":"test","superstep_count":1}

data: {"type":"superstep_s1_map_start","step_id":"s1","description":""}

data: {"type":"superstep_s1_map_complete","step_id":"s1","worker_count":1}

data: {"type":"superstep_s1_reduce_start","step_id":"s1"}

data: {"type":"superstep_s1_reduce_complete","step_id":"s1","output_variable":"answer","result":"2+2 equals 4."}

data: {"type":"complete","workflow_id":"test","final_variables":{"answer":"2+2 equals 4."}}
```

---

## Step 4: List Your Workflows

```bash
curl http://localhost:8003/api/workflows \
  -H "Authorization: Bearer $TOKEN"
```

---

## Step 5: Try Pre-Built Examples

### Simple Debate (2 perspectives)
```bash
curl -X POST http://localhost:8003/api/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @simple_debate.json
```

### With Middleware
```bash
curl -X POST http://localhost:8003/api/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @middleware_pipeline.json
```

### Multi-Stage
```bash
curl -X POST http://localhost:8003/api/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @classic_council.json
```

---

## Troubleshooting

### "Invalid model references"
- Check model IDs at https://openrouter.ai/models
- Common valid models:
  - `openai/gpt-4`
  - `anthropic/claude-3.5-sonnet`
  - `google/gemini-2.0-flash-exp`

### "Variable not defined"
- Ensure `output_write_to` matches a variable in `variables` array
- Variable names are case-sensitive

### "Too many workers"
- Max 10 workers per superstep
- Reduce worker count or split into multiple supersteps

### "Timeout exceeds maximum"
- Max global timeout: 600000ms (10 min)
- Max step timeout: 120000ms (2 min)

---

## Next Steps

1. **Customize**: Modify example workflows for your use case
2. **Experiment**: Try different reducer strategies and middleware
3. **Learn**: Read [README.md](README.md) for detailed guide
4. **Integrate**: See [WORKFLOW_IMPLEMENTATION_SUMMARY.md](../../WORKFLOW_IMPLEMENTATION_SUMMARY.md) for conversation integration

---

## Minimal Workflow Template

Copy this to start building your own:

```json
{
  "flow_id": "my_workflow",
  "variables": [
    {"name": "result", "type": "string"}
  ],
  "supersteps": [
    {
      "step_id": "step1",
      "description": "What this step does",
      "map_phase": {
        "workers": [
          {
            "worker_id": "worker1",
            "model_ref": "openai/gpt-4",
            "role_definition": "Your role prompt here"
          }
        ]
      },
      "reduce_phase": {
        "strategy": "simple_summary",
        "model_ref": "openai/gpt-4",
        "output_write_to": "result",
        "visibility": {
          "include_original_input": true
        }
      }
    }
  ]
}
```

**Happy workflow building! 🚀**
