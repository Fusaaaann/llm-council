# CLAUDE.md - Technical Notes for LLM Council

This file contains technical details, architectural decisions, and important implementation notes for future development sessions.

## Project Overview

LLM Council is a 3-stage deliberation system where multiple LLMs collaboratively answer user questions. The key innovation is anonymized peer review in Stage 2, preventing models from playing favorites.

**Key Features:**
- **Streaming responses**: Progressive display of each stage as it completes via Server-Sent Events
- **Metadata persistence**: label_to_model and aggregate_rankings now saved with messages
- **Edit/Retry actions**: Users can edit or retry their last message
- **Multi-turn conversations**: Input field always visible for continued dialogue

## Architecture

### Backend Structure (`backend/`)

**`config.py`**
- Contains `COUNCIL_MODELS` (list of OpenRouter model identifiers)
- Contains `CHAIRMAN_MODEL` (model that synthesizes final answer)
- Uses environment variable `OPENROUTER_API_KEY` from `.env`
- Backend runs on **port 8001** (NOT 8000 - user had another app on 8000)

**`openrouter.py`**
- `query_model()`: Single async model query
- `query_models_parallel()`: Parallel queries using `asyncio.gather()`
- Returns dict with 'content' and optional 'reasoning_details'
- Graceful degradation: returns None on failure, continues with successful responses

**`council.py`** - The Core Logic
- `stage1_collect_responses()`: Parallel queries to all council models
- `stage2_collect_rankings()`:
  - Anonymizes responses as "Response A, B, C, etc."
  - Creates `label_to_model` mapping for de-anonymization
  - Prompts models to evaluate and rank (with strict format requirements)
  - Returns tuple: (rankings_list, label_to_model_dict)
  - Each ranking includes both raw text and `parsed_ranking` list
- `stage3_synthesize_final()`: Chairman synthesizes from all responses + rankings
- `parse_ranking_from_text()`: Extracts "FINAL RANKING:" section, handles both numbered lists and plain format
- `calculate_aggregate_rankings()`: Computes average rank position across all peer evaluations

**`storage.py`**
- JSON-based conversation storage in `data/conversations/`
- Each conversation: `{id, created_at, title, messages[]}`
- Assistant messages contain: `{role, stage1, stage2, stage3, metadata}`
- **UPDATED**: metadata (label_to_model, aggregate_rankings) is NOW persisted to storage for full conversation history

**`main.py`**
- FastAPI app with CORS enabled for localhost:5173 and localhost:3000
- **Endpoints:**
  - POST `/api/conversations/{id}/message` - Batch response with all stages + metadata
  - POST `/api/conversations/{id}/message/stream` - Server-Sent Events streaming (PREFERRED)
- Streaming endpoint sends events: stage1_start, stage1_complete, stage2_start, stage2_complete, stage3_start, stage3_complete, title_complete, complete, error
- Title generation runs in parallel with Stage 1 to minimize perceived latency
- Metadata includes: label_to_model mapping and aggregate_rankings

### Frontend Structure (`frontend/src/`)

**`App.jsx`**
- Main orchestration: manages conversations list and current conversation
- Handles message sending via streaming API (`sendMessageStream`)
- **New handlers:**
  - `handleEditMessage()`: Removes last user message + assistant response, populates input field
  - `handleRetryMessage()`: Removes last assistant response, resends user message
- Metadata now persisted in backend and reloaded from storage
- Progressive UI updates: each stage updates in real-time as events arrive

**`components/ChatInterface.jsx`**
- **UPDATED**: Input field always visible (not just for first message)
- Multiline textarea (3 rows, resizable) with ref for programmatic focus
- Enter to send, Shift+Enter for new line
- User messages wrapped in markdown-content class for padding
- **New features:**
  - Edit/Retry buttons on last user message (when not loading)
  - Edit button populates input field and focuses it
  - Progressive loading indicators for each stage during streaming

**`components/Stage1.jsx`**
- Tab view of individual model responses
- ReactMarkdown rendering with markdown-content wrapper

**`components/Stage2.jsx`**
- **Critical Feature**: Tab view showing RAW evaluation text from each model
- De-anonymization happens CLIENT-SIDE for display (models receive anonymous labels)
- Shows "Extracted Ranking" below each evaluation so users can validate parsing
- Aggregate rankings shown with average position and vote count
- Explanatory text clarifies that boldface model names are for readability only

**`components/Stage3.jsx`**
- Final synthesized answer from chairman
- Green-tinted background (#f0fff0) to highlight conclusion

**Styling (`*.css`)**
- Light mode theme (not dark mode)
- Primary color: #4a90e2 (blue)
- Global markdown styling in `index.css` with `.markdown-content` class
- 12px padding on all markdown content to prevent cluttered appearance

## Key Design Decisions

### Stage 2 Prompt Format
The Stage 2 prompt is very specific to ensure parseable output:
```
1. Evaluate each response individually first
2. Provide "FINAL RANKING:" header
3. Numbered list format: "1. Response C", "2. Response A", etc.
4. No additional text after ranking section
```

This strict format allows reliable parsing while still getting thoughtful evaluations.

### De-anonymization Strategy
- Models receive: "Response A", "Response B", etc.
- Backend creates mapping: `{"Response A": "openai/gpt-5.1", ...}`
- Frontend displays model names in **bold** for readability
- Users see explanation that original evaluation used anonymous labels
- This prevents bias while maintaining transparency

### Error Handling Philosophy
- Continue with successful responses if some models fail (graceful degradation)
- Never fail the entire request due to single model failure
- Log errors but don't expose to user unless all models fail

### UI/UX Transparency
- All raw outputs are inspectable via tabs
- Parsed rankings shown below raw text for validation
- Users can verify system's interpretation of model outputs
- This builds trust and allows debugging of edge cases

## Important Implementation Details

### Relative Imports
All backend modules use relative imports (e.g., `from .config import ...`) not absolute imports. This is critical for Python's module system to work correctly when running as `python -m backend.main`.

### Port Configuration
- Backend: 8001 (changed from 8000 to avoid conflict)
- Frontend: 5173 (Vite default)
- Update both `backend/main.py` and `frontend/src/api.js` if changing

### Markdown Rendering
All ReactMarkdown components must be wrapped in `<div className="markdown-content">` for proper spacing. This class is defined globally in `index.css`.

### Model Configuration
Models are hardcoded in `backend/config.py`. Chairman can be same or different from council members. The current default is Gemini as chairman per user preference.

## Common Gotchas

1. **Module Import Errors**: Always run backend as `python -m backend.main` from project root, not from backend directory
2. **CORS Issues**: Frontend must match allowed origins in `main.py` CORS middleware
3. **Ranking Parse Failures**: If models don't follow format, fallback regex extracts any "Response X" patterns in order
4. **Metadata Persistence**: ~~Metadata is ephemeral (not persisted)~~ **FIXED** - Metadata now persisted in storage.py
5. **Streaming Connection**: EventSource connections can timeout; frontend handles reconnection via error events

## Recent Updates (Latest Session)

### Streaming Implementation
- Added `/api/conversations/{id}/message/stream` endpoint with Server-Sent Events
- Frontend now uses streaming by default for real-time stage updates
- Title generation parallelized with Stage 1 to reduce perceived latency

### Metadata Persistence
- Modified `storage.py` to accept optional metadata parameter in `add_assistant_message()`
- Backend now saves label_to_model and aggregate_rankings with each message
- Metadata survives page reloads and conversation switching

### Edit/Retry UI
- Added Edit and Retry buttons to last user message
- Edit functionality: removes messages, populates input field, focuses textarea
- Retry functionality: removes assistant response, resends query
- Buttons only show when not loading and on the last user message

### Multi-turn Support
- Input field now always visible (not just for first message)
- Conversations can continue indefinitely with full context
- Each turn includes all previous messages for continuity

## Future Enhancement Ideas

- Configurable council/chairman via UI instead of config file
- ~~Streaming responses instead of batch loading~~ **DONE** ✓
- ~~Export conversations to markdown/PDF~~
- Model performance analytics over time
- Custom ranking criteria (not just accuracy/insight)
- Support for reasoning models (o1, etc.) with special handling
- ~~Manual rename, Delete conversation functionality~~
- ~~Stop/cancel ongoing council deliberation~~
- navigate between user messages

## Testing Notes

Use `test_openrouter.py` to verify API connectivity and test different model identifiers before adding to council. The script tests both streaming and non-streaming modes.

## Data Flow Summary

### Streaming Flow (Current Implementation)
```
User Query → POST /api/conversations/{id}/message/stream
    ↓
[Event: stage1_start] → UI shows "Stage 1 Loading..."
    ↓
Stage 1: Parallel queries → [individual responses]
    ↓
[Event: stage1_complete] → UI displays tabs with responses
    ↓
[Event: stage2_start] → UI shows "Stage 2 Loading..."
    ↓
Stage 2: Anonymize → Parallel ranking queries → [evaluations + rankings]
    ↓
Calculate aggregate rankings → metadata assembled
    ↓
[Event: stage2_complete + metadata] → UI displays rankings
    ↓
[Event: stage3_start] → UI shows "Stage 3 Loading..."
    ↓
Stage 3: Chairman synthesis with full context
    ↓
[Event: stage3_complete] → UI displays final answer
    ↓
[Event: title_complete] (first message only) → Sidebar updates
    ↓
[Event: complete] → Save to storage with metadata → Done
```

### Storage Flow
```
In-memory State (during stream)
    ↓
storage.add_assistant_message(stage1, stage2, stage3, metadata)
    ↓
JSON file: data/conversations/{id}.json
    ↓
{
  messages: [
    {role: "assistant", stage1: [...], stage2: [...], stage3: {...}, metadata: {...}}
  ]
}
```

The entire flow is async/parallel where possible to minimize latency. Title generation runs concurrently with Stage 1.
