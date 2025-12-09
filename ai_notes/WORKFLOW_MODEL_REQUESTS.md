# Workflow Model Request Guide

**Last Updated:** 2025-12-09

This guide documents how the workflow execution system should request LLM models, matching the pattern used by the council system.

## Overview

Both **council execution** (legacy) and **workflow execution** (new) use the same underlying OpenRouter API client. This ensures consistent authentication, error handling, and request patterns.

## Model Request Architecture

### 1. OpenRouter Client (`backend/openrouter.py`)

All LLM requests go through the centralized OpenRouter client:

```python
from .openrouter import query_model, query_models_parallel
```

#### Single Model Request

```python
async def query_model(
    model: str,
    messages: List[Dict[str, str]],
    timeout: float = 120.0
) -> Optional[Dict[str, Any]]:
    """
    Query a single model via OpenRouter API.

    Args:
        model: OpenRouter model identifier (e.g., "openai/gpt-4o")
        messages: List of message dicts with 'role' and 'content'
        timeout: Request timeout in seconds

    Returns:
        Response dict with 'content' and optional 'reasoning_details', or None if failed
    """
```

**Request Format:**
```python
headers = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
}

payload = {
    "model": model,
    "messages": messages,
}

# POST to: https://openrouter.ai/api/v1/chat/completions
```

**Response Format:**
```python
{
    'content': message.get('content'),
    'reasoning_details': message.get('reasoning_details')
}
```

#### Parallel Model Requests

```python
async def query_models_parallel(
    models: List[str],
    messages: List[Dict[str, str]]
) -> Dict[str, Optional[Dict[str, Any]]]:
    """
    Query multiple models in parallel.

    Returns:
        Dict mapping model identifier to response dict (or None if failed)
    """
```

### 2. Configuration (`backend/config.py`)

**Required Environment Variables:**

```bash
# OpenRouter API key (REQUIRED)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# OpenRouter API endpoint (optional, has default)
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1/chat/completions

# Default council models (for legacy council execution)
COUNCIL_MODELS=[
    "openai/gpt-5.1",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
    "x-ai/grok-4",
]

# Default chairman model (for legacy council execution)
CHAIRMAN_MODEL=google/gemini-3-pro-preview
```

**Important Notes:**
- `OPENROUTER_API_KEY` must be set in `.env` file
- Missing or invalid API key causes **401 Unauthorized** errors
- Model identifiers must be valid OpenRouter model names

### 3. Message Format

All model requests use OpenRouter's chat completions format:

```python
messages = [
    {"role": "system", "content": "System instruction here"},
    {"role": "user", "content": "User message 1"},
    {"role": "assistant", "content": "Assistant response 1"},
    {"role": "user", "content": "User message 2"},
]
```

**Roles:**
- `system`: Instructions, context, role definitions
- `user`: User messages
- `assistant`: Model responses

## How Council System Requests Models

### Stage 1: Initial Responses

**File:** `backend/council.py:7-30`

```python
async def stage1_collect_responses(messages: List[Dict[str, str]], council_models: List[str]):
    # Query all models in parallel with full conversation history
    responses = await query_models_parallel(council_models, messages)

    # Format results
    stage1_results = []
    for model, response in responses.items():
        if response is not None:  # Only include successful responses
            stage1_results.append({
                "model": model,
                "response": response.get('content', '')
            })

    return stage1_results
```

**Key Pattern:**
1. Use `query_models_parallel()` for efficiency
2. Check `response is not None` before using
3. Extract `response.get('content', '')` for text

### Stage 1.5: Cross-Interrogation

**File:** `backend/council.py:93-107`

```python
# Get questions from all council models in parallel
interrogation_messages = messages[:-1] + [{"role": "user", "content": interrogation_prompt}]
responses = await query_models_parallel(council_models, interrogation_messages)

# Format results
questions_results = []
for model, response in responses.items():
    if response is not None:
        questions_results.append({
            "model": model,
            "questions": response.get('content', '')
        })
```

**Key Pattern:**
1. Build specialized prompt
2. Append to existing message history
3. Query all models in parallel

### Stage 2: Rankings

**File:** `backend/council.py:290-303`

```python
# Build messages for ranking (conversation history + ranking prompt)
ranking_messages = messages[:-1] + [{"role": "user", "content": ranking_prompt}]

# Get rankings from all council models in parallel
responses = await query_models_parallel(council_models, ranking_messages)

# Format results with parsed rankings
stage2_results = []
for model, response in responses.items():
    if response is not None:
        full_text = response.get('content', '')
        parsed = parse_ranking_from_text(full_text)
        stage2_results.append({
            "model": model,
            "ranking": full_text,
            "parsed_ranking": parsed
        })
```

### Stage 3: Final Synthesis

**File:** `backend/council.py:382-396`

```python
# Build messages for chairman (conversation history + chairman prompt)
chairman_messages = messages[:-1] + [{"role": "user", "content": chairman_prompt}]

# Query the chairman model (single model)
response = await query_model(chairman_model, chairman_messages)

if response is None:
    # Fallback if chairman fails
    return {
        "model": chairman_model,
        "response": "Error: Unable to generate final synthesis."
    }

return {
    "model": chairman_model,
    "response": response.get('content', '')
}
```

**Key Pattern:**
1. Use `query_model()` for single model
2. Always check for `None` response
3. Provide error fallback

## How Workflow System Requests Models

### Map Phase Worker Execution

**File:** `backend/workflow_engine.py:210-257`

```python
async def _execute_map_phase(
    self,
    map_config: Dict[str, Any],
    messages: List[Dict[str, str]]
) -> List[Dict[str, Any]]:
    from .openrouter import query_model
    import asyncio

    # Expand workers from config
    workers = self._expand_map_phase_workers(map_config)
    concurrency_limit = map_config.get('concurrency_limit', len(workers))
    global_instruction = map_config.get('global_instruction_overlay', '')

    # Semaphore for concurrency control
    semaphore = asyncio.Semaphore(concurrency_limit)

    async def execute_worker(worker: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        async with semaphore:
            # Build worker prompt
            instruction = worker.get('instruction') or worker.get('role_definition', '')
            if global_instruction:
                instruction += f"\n\n{global_instruction}"

            # Build messages with instruction as system prompt
            worker_messages = [{"role": "system", "content": instruction}] + messages

            # Query model (SAME AS COUNCIL)
            response = await query_model(worker['model_ref'], worker_messages)

            if response is not None:
                return {
                    'worker_id': worker['worker_id'],
                    'model_ref': worker['model_ref'],
                    'output': response.get('content', ''),
                    'instruction': instruction
                }
            return None

    # Execute all workers in parallel (with concurrency limit)
    tasks = [execute_worker(worker) for worker in workers]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Filter out None and exceptions
    worker_outputs = []
    for result in results:
        if isinstance(result, dict):
            worker_outputs.append(result)
        elif isinstance(result, Exception):
            print(f"Worker execution error: {result}")

    return worker_outputs
```

**Key Patterns:**
1. ✅ Uses `query_model()` from `openrouter.py` (CORRECT)
2. ✅ Checks `response is not None` (CORRECT)
3. ✅ Extracts `response.get('content', '')` (CORRECT)
4. ✅ Handles exceptions gracefully (CORRECT)
5. ✅ Uses semaphore for concurrency control (GOOD PRACTICE)

### Reduce Phase Execution

**File:** `backend/workflow_reducers.py`

The reduce phase also uses `query_model()` for chairman synthesis:

```python
from .openrouter import query_model

async def execute_reducer(
    strategy: str,
    worker_outputs: List[Dict[str, Any]],
    memory: 'WorkflowMemory',
    config: Dict[str, Any]
) -> str:
    if strategy == 'chairman_synthesis':
        # Build synthesis prompt
        chairman_instructions = config['chairman_instructions']
        messages = config['messages']

        # Build chairman messages
        chairman_messages = messages[:-1] + [
            {"role": "user", "content": synthesis_prompt}
        ]

        # Query chairman model (SAME AS COUNCIL STAGE 3)
        response = await query_model(config['model_ref'], chairman_messages)

        if response is None:
            return "Error: Failed to generate synthesis."

        return response.get('content', '')
```

## Common Error Patterns

### 401 Unauthorized Error

**Symptom:**
```
Error querying model google/gemini-2.5-flash: Client error '401 Unauthorized' for url 'https://openrouter.ai/api/v1/chat/completions'
```

**Causes:**
1. Missing `OPENROUTER_API_KEY` in `.env`
2. Invalid API key
3. API key not loaded properly (check `dotenv` loading)
4. API key revoked or expired

**Fix:**
```bash
# 1. Check .env file exists
cat .env | grep OPENROUTER_API_KEY

# 2. Verify key is loaded
python -c "from backend.config import OPENROUTER_API_KEY; print(OPENROUTER_API_KEY)"

# 3. Test key with curl
curl -H "Authorization: Bearer YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"google/gemini-2.5-flash","messages":[{"role":"user","content":"test"}]}' \
     https://openrouter.ai/api/v1/chat/completions
```

### 404 Model Not Found

**Symptom:**
```
Error querying model: 404 Not Found
```

**Causes:**
1. Invalid model identifier (typo)
2. Model not available on OpenRouter
3. Model name changed/deprecated

**Fix:**
Check available models at: https://openrouter.ai/models

### Timeout Errors

**Symptom:**
```
Error querying model: httpx.ReadTimeout
```

**Causes:**
1. Model taking too long to respond
2. Network issues
3. Timeout too short for complex prompts

**Fix:**
```python
# Increase timeout for specific models
response = await query_model(model, messages, timeout=300.0)  # 5 minutes
```

## Best Practices for Workflow System

### 1. Always Use Centralized Client

❌ **WRONG - Don't create separate HTTP client:**
```python
import httpx
# DON'T DO THIS - bypasses centralized auth/error handling
async with httpx.AsyncClient() as client:
    response = await client.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"},
        json=payload
    )
```

✅ **CORRECT - Use centralized client:**
```python
from .openrouter import query_model
response = await query_model(model, messages)
```

### 2. Always Check for None

❌ **WRONG:**
```python
response = await query_model(model, messages)
content = response['content']  # Will crash if response is None!
```

✅ **CORRECT:**
```python
response = await query_model(model, messages)
if response is not None:
    content = response.get('content', '')
else:
    # Handle failure gracefully
    content = "Error: Model failed to respond."
```

### 3. Use Parallel Requests When Possible

❌ **SLOW - Sequential requests:**
```python
results = []
for model in models:
    response = await query_model(model, messages)
    results.append(response)
```

✅ **FAST - Parallel requests:**
```python
# Option 1: Use built-in parallel function
responses = await query_models_parallel(models, messages)

# Option 2: Manual async gather
tasks = [query_model(model, messages) for model in models]
results = await asyncio.gather(*tasks)
```

### 4. Validate Model Identifiers

✅ **CORRECT:**
```python
# Validate before making request
def validate_model_ref(model_ref: str) -> bool:
    """Check if model_ref is valid OpenRouter format."""
    # Format: provider/model-name
    if '/' not in model_ref:
        return False
    provider, model = model_ref.split('/', 1)
    if not provider or not model:
        return False
    return True

# Use validation
if not validate_model_ref(worker['model_ref']):
    raise ValueError(f"Invalid model_ref: {worker['model_ref']}")
```

### 5. Log Errors Properly

✅ **CORRECT:**
```python
import logging
logger = logging.getLogger(__name__)

response = await query_model(model, messages)
if response is None:
    logger.error(f"Model {model} failed to respond for worker {worker_id}")
    # Continue with fallback behavior
```

## Testing Model Requests

### Unit Test Example

```python
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_map_phase_execution():
    """Test map phase worker execution with mocked OpenRouter."""

    # Mock the query_model function
    mock_response = {
        'content': 'Test response',
        'reasoning_details': None
    }

    with patch('backend.workflow_engine.query_model', new=AsyncMock(return_value=mock_response)):
        executor = WorkflowExecutor(test_workflow)

        worker_outputs = await executor._execute_map_phase(
            map_config={'workers': [
                {'worker_id': 'w1', 'model_ref': 'openai/gpt-4o', 'instruction': 'Test'}
            ]},
            messages=[{'role': 'user', 'content': 'Test message'}]
        )

        assert len(worker_outputs) == 1
        assert worker_outputs[0]['output'] == 'Test response'

@pytest.mark.asyncio
async def test_model_failure_handling():
    """Test graceful handling of model failures."""

    # Mock failure (returns None)
    with patch('backend.workflow_engine.query_model', new=AsyncMock(return_value=None)):
        executor = WorkflowExecutor(test_workflow)

        worker_outputs = await executor._execute_map_phase(
            map_config={'workers': [
                {'worker_id': 'w1', 'model_ref': 'invalid/model', 'instruction': 'Test'}
            ]},
            messages=[{'role': 'user', 'content': 'Test'}]
        )

        # Should return empty list (no successful outputs)
        assert len(worker_outputs) == 0
```

### Integration Test Example

```python
@pytest.mark.asyncio
async def test_real_openrouter_request():
    """Test real OpenRouter API request (requires valid API key)."""
    from backend.openrouter import query_model
    from backend.config import OPENROUTER_API_KEY

    if not OPENROUTER_API_KEY:
        pytest.skip("OPENROUTER_API_KEY not configured")

    messages = [
        {"role": "user", "content": "Say 'test successful' if you can read this."}
    ]

    response = await query_model("google/gemini-2.5-flash", messages, timeout=30.0)

    assert response is not None
    assert 'content' in response
    assert len(response['content']) > 0
```

## Summary

**Key Takeaways:**

1. ✅ **Workflow system already uses correct pattern** - imports from `openrouter.py`
2. ✅ **Authentication is centralized** - uses `OPENROUTER_API_KEY` from config
3. ✅ **Error handling is consistent** - checks for `None` responses
4. ⚠️ **401 errors indicate missing/invalid API key** - check `.env` configuration

**Action Items for Workflow Team:**

1. Verify `OPENROUTER_API_KEY` is set in `.env` file
2. Validate all model identifiers in workflow definitions
3. Add logging for model request failures
4. Consider adding retry logic for transient failures
5. Test with known-good models first (e.g., `openai/gpt-4o`)

**No Code Changes Needed:**
The workflow system already follows the same model request pattern as the council system. The 401 error is a configuration issue, not a code issue.
