# Conversation Context Passing - Implementation Fix

**Date:** 2025-12-02
**Issue:** Models were not receiving conversation history in multi-turn conversations
**Status:** ✅ FIXED

## Problem

In multi-turn conversations, the LLM Council was **not passing conversation context** to models. Each stage function received only the current user query as a string, causing models to lose context from previous turns.

### Example of the Problem

**User Turn 1:** "What is the capital of France?"
**Assistant:** "Paris."

**User Turn 2:** "What is its population?"
**Models Received:** Only "What is its population?" (no context)
**Result:** Models confused - "population of what?"

## Solution

Refactored all council stages to accept and use **full conversation history** instead of just the current query.

### Changes Made

#### 1. **backend/council.py** - Updated All Stage Functions

**Before:**
```python
async def stage1_collect_responses(user_query: str, council_models: List[str])
    messages = [{"role": "user", "content": user_query}]
    responses = await query_models_parallel(council_models, messages)
```

**After:**
```python
async def stage1_collect_responses(messages: List[Dict[str, str]], council_models: List[str])
    # Query all models with full conversation history
    responses = await query_models_parallel(council_models, messages)
```

**Updated Functions:**
- `stage1_collect_responses()` - Stage 1: Initial responses
- `stage1_5_cross_interrogation()` - Stage 1.5: Questions
- `stage1_5_collect_answers()` - Stage 1.5: Answers
- `stage2_collect_rankings()` - Stage 2: Rankings
- `stage3_synthesize_final()` - Stage 3: Final synthesis

#### 2. **backend/routes/conversations.py** - Message History Builder

Added helper function to extract conversation history:

```python
def build_message_history(conversation: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Build OpenRouter-compatible message history from conversation.
    Extracts user messages and assistant stage3 responses (final synthesis).
    """
    messages = []
    for msg in conversation.get("messages", []):
        if msg["role"] == "user":
            messages.append({"role": "user", "content": msg["content"]})
        elif msg["role"] == "assistant":
            # Use stage3 response (final synthesis) as assistant response
            stage3 = msg.get("stage3", {})
            if stage3 and "response" in stage3:
                messages.append({"role": "assistant", "content": stage3["response"]})
    return messages
```

**Key Design Decision:** Use `stage3.response` (final synthesis) as the assistant's message in conversation history, since it represents the council's collective answer.

#### 3. **Updated Endpoints**

All endpoints now build and pass message history:

**Non-streaming endpoint** (`send_message`):
```python
message_history = build_message_history(conversation)
message_history.append({"role": "user", "content": req.content})
stage1_results = await stage1_collect_responses(message_history, council_models)
```

**Streaming endpoint** (`send_message_stream`):
```python
message_history = build_message_history(conversation)
message_history.append({"role": "user", "content": req.content})
stage1_results = await stage1_collect_responses(message_history, council_models)
```

**Resume endpoint** (`resume_message_stream`):
```python
message_history = build_message_history(conversation)
# Resume with full context
stage2_results = await stage2_collect_rankings(message_history, stage1_results, council_models)
```

## Message History Format

The message history sent to models follows OpenRouter API format:

```python
[
    {"role": "user", "content": "What is the capital of France?"},
    {"role": "assistant", "content": "The capital of France is Paris."},
    {"role": "user", "content": "What is its population?"},
    {"role": "assistant", "content": "Paris has a population of about 2.2 million..."},
    {"role": "user", "content": "What about the metro area?"}  # Current query
]
```

## Benefits

1. **Multi-turn Conversations Work Correctly**: Models can reference previous context
2. **Follow-up Questions Supported**: "What about X?" now makes sense
3. **Pronoun Resolution**: Models understand "it", "that", "them" references
4. **Consistent Context**: All stages (1, 1.5, 2, 3) see the same conversation history
5. **Backward Compatible**: Single-turn conversations work exactly as before

## Testing

Created comprehensive tests:

1. **tests/test_context_passing.py** - Unit tests for `build_message_history()`
   - Empty conversation
   - Single turn
   - Multi-turn
   - Incomplete assistant messages
   - Order preservation

2. **test_context_demo.py** - Demonstration script showing before/after comparison

3. **Existing tests still pass** - `tests/e2e/integration/test_edit_retry.py` validates multi-turn editing

## Example: Before vs After

### Before (No Context) ❌

```
User: "What is the capital of France?"
Models receive: ["What is the capital of France?"]
Response: "Paris."

User: "What is its population?"
Models receive: ["What is its population?"]  ❌ NO CONTEXT
Response: "I need more context. Population of what?"
```

### After (With Context) ✅

```
User: "What is the capital of France?"
Models receive: ["What is the capital of France?"]
Response: "Paris."

User: "What is its population?"
Models receive: [
    "What is the capital of France?",
    "Paris.",
    "What is its population?"
]  ✅ FULL CONTEXT
Response: "Paris has a population of about 2.2 million in the city proper."
```

## Files Modified

- `backend/council.py` (5 function signatures + implementations)
- `backend/routes/conversations.py` (3 endpoints + helper function)

## Files Created

- `tests/test_context_passing.py` (unit tests)
- `test_context_demo.py` (demonstration script)
- `CONTEXT_PASSING_FIX.md` (this document)

## Backward Compatibility

✅ **Fully backward compatible**:
- Single-turn conversations work identically
- Existing conversation storage format unchanged
- No migration required
- All existing tests pass

## Future Enhancements

Potential improvements:
- Add conversation pruning for very long histories (token limit management)
- Support system messages for custom instructions
- Add context window optimization (summarize old turns)
- Per-model context window handling

## Technical Notes

### Why Stage 3 Response?

The `build_message_history()` function uses `stage3.response` as the assistant's reply because:

1. Stage 3 is the **final synthesis** - the council's collective answer
2. It's what the user sees as the "official" response
3. Individual model responses (Stage 1) would be redundant and confusing
4. Rankings (Stage 2) are internal deliberation, not conversational content

### Context Substitution Pattern

For stages that generate special prompts (1.5, 2, 3), we use a pattern:

```python
# Get current user query from last message
user_query = messages[-1]['content']

# Build special prompt using current query
special_prompt = f"Review this question: {user_query}..."

# Replace last user message with special prompt
special_messages = messages[:-1] + [{"role": "user", "content": special_prompt}]

# Query models with modified history
responses = await query_models_parallel(council_models, special_messages)
```

This preserves conversation context while injecting stage-specific instructions.

## Verification

To verify the fix works:

1. Start backend server: `python -m backend.main`
2. Start frontend: `cd frontend && npm run dev`
3. Create a conversation and send multiple messages
4. Verify models understand context in follow-up questions

Or run the demo script:
```bash
python test_context_demo.py
```

## Related Documentation

- [Backend Architecture](ai_notes/BACKEND_ARCHITECTURE.md)
- [Frontend Architecture](ai_notes/FRONTEND_ARCHITECTURE.md)
- [Multi-turn Support](CLAUDE.md#multi-turn-support)

---

**Status:** ✅ Implementation complete and tested
**Impact:** Critical fix for multi-turn conversation functionality
**Breaking Changes:** None - fully backward compatible
