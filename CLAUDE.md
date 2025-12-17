# CLAUDE.md - Technical Notes for LLM Council

This file contains essential overview and architectural decisions for the LLM Council project. Detailed implementation documentation is in [ai_notes/](ai_notes/).

## Project Overview

LLM Council is a **3.5-stage deliberation system** where multiple LLMs collaboratively answer user questions through initial responses, cross-interrogation, peer review, and final synthesis.

### Key Innovations
- **Stage 1.5 Cross-Interrogation**: Models question each other's responses to uncover deeper insights
- **Anonymized Peer Review**: Stage 2 uses anonymous labels (Response A, B, C) to prevent bias
- **Configuration-Driven Architecture**: Dynamic event handling eliminates hardcoded logic
- **Scope Alignment System**: 4-phase pre-execution process prevents role drift in workflow execution

### Core Features
- **Streaming responses**: Progressive display via Server-Sent Events (SSE)
- **Network resilience**: Automatic reconnection with stream resumption
- **Real-time updates**: SSE streaming for sidebar with automatic updates
- **Authentication**: JWT-based with refresh token rotation and account lockout
- **Encryption at rest**: Messages encrypted with Fernet (AES-128-CBC)
- **Multi-tenancy**: Profile-based conversation organization
- **Public/Private**: Publish conversations to forum or keep private

## Architecture Overview

### Backend (FastAPI)
**Route-based modular architecture** with FastAPI routers. See [Backend Architecture](ai_notes/BACKEND_ARCHITECTURE.md).

**Key Modules:**
- `routes/` - Organized by feature (auth, conversations, forum, profiles)
- `council.py` - Core deliberation logic (4 stages)
- `storage/` - Modular storage (SQLite + JSON, encryption, profiles, publishing)
- `encryption.py` - Fernet provider for message encryption
- `auth.py` - JWT tokens, refresh rotation, session management

**API Structure:**
- **Authentication**: 7 routes (register, login, refresh, logout, etc.)
- **Conversations**: 14 routes (CRUD, streaming, export, encryption, publish)
- **Forum**: 2 routes (list public, get public)
- **Profiles**: 5 routes (CRUD)
- **Models**: 2 routes (get/update runtime config)

### Frontend (React)
**Configuration-driven event handling** eliminates hardcoded switch statements. See [Frontend Architecture](ai_notes/FRONTEND_ARCHITECTURE.md).

**Key Components:**
- `App.jsx` - Main orchestration, SSE subscriptions
- `stageConfig.js` - Centralized stage definitions
- `eventHandler.js` - Dynamic event handler factory
- `ChatInterface.jsx` - Input, stages, actions (edit/retry/cancel)
- `Sidebar.jsx` - Conversation list with real-time updates

**Rendering System:**
- `UnifiedStage.jsx` - Adaptive component for council and workflow execution
- Auto-detects execution mode (council vs workflow) from message structure
- Council mode: Uses Stage1/2/3 components internally
- Workflow mode: Variable-based display with progress tracking

## Detailed Documentation

### Core Systems
- [Backend Architecture](ai_notes/BACKEND_ARCHITECTURE.md) - Route modules, core logic, deployment
- [Frontend Architecture](ai_notes/FRONTEND_ARCHITECTURE.md) - Components, state management, UI
- [Storage Architecture](ai_notes/STORAGE_ARCHITECTURE.md) - JSON storage, encryption, multi-tenancy
- [Authentication](ai_notes/AUTHENTICATION.md) - JWT, refresh rotation, security features
- [Event Handling](ai_notes/EVENT_HANDLING.md) - Configuration-driven system

### Features
- [Stage 1.5 Implementation](ai_notes/STAGE_1_5_IMPLEMENTATION.md) - Cross-interrogation details
- [SSE Network Resilience](ai_notes/SSE_NETWORK_RESILIENCE.md) - Stream resumption, reconnection
- [Streaming Token Fix](ai_notes/STREAMING_TOKEN_FIX.md) - Mid-stream token expiry solution
- [Session Revocation on Shutdown](ai_notes/SESSION_REVOCATION_ON_SHUTDOWN.md) - Auto cleanup

### Workflow System
- [Workflow Model Requests](ai_notes/WORKFLOW_MODEL_REQUESTS.md) - How workflows request LLM models
- [Workflow Quick Reference](ai_notes/WORKFLOW_QUICK_REFERENCE.md) - Quick guide for workflow developers
- [Score & Rank Guide](ai_notes/SCORE_AND_RANK_GUIDE.md) - Anonymous peer review and ranking
- [Unified Stage Architecture](ai_notes/UNIFIED_STAGE_ARCHITECTURE.md) - Dual-mode rendering system
- [Scope Alignment Architecture](ai_notes/SCOPE_ALIGNMENT_ARCHITECTURE.md) - Role drift prevention system

### Security
- [Security Implementation](ai_notes/SECURITY_IMPLEMENTATION.md) - Full security hardening
- [Security Migration Guide](ai_notes/SECURITY_MIGRATION_GUIDE.md) - Upgrade instructions
- [Encryption Guide](ai_notes/ENCRYPTION_GUIDE.md) - Encryption system details
- [Encryption API](ai_notes/ENCRYPTION_API.md) - API documentation

### Other
- [Session Management](ai_notes/SESSION_MANAGEMENT.md) - Session handling details
- [Quick Start Auth](ai_notes/QUICK_START_AUTH.md) - Quick auth setup guide

## Data Flow Summary

### Streaming Flow
```
User Query → POST /api/conversations/{id}/message/stream
    ↓
[Proactive token refresh if < 5 min until expiry]
    ↓
[Event: stream_init] → Connection token generated
    ↓
[Event: stage1_start] → Stage 1: Parallel queries → [Event: stage1_complete]
    ↓
[Event: stage1_5_questions_start] → Models ask questions → [Event: stage1_5_questions_complete]
    ↓
[Event: stage1_5_answers_start] → Models answer → [Event: stage1_5_answers_complete]
    ↓
[Heartbeat: validate session]
    ↓
[Event: stage2_start] → Anonymized rankings → [Event: stage2_complete + metadata]
    ↓
[Heartbeat: validate session]
    ↓
[Event: stage3_start] → Chairman synthesis → [Event: stage3_complete]
    ↓
[Event: title_complete] (parallel, first message only)
    ↓
[Event: complete] → Done
```

**Notes:**
- Title generation runs in parallel with Stage 1
- Partial state saved after each stage (resilience)
- Heartbeats every 60s with session validation
- Connection tokens validate stream ownership (2hr expiry)

### Storage Structure
```
In-memory State (during stream)
    ↓
storage.conversations.save_partial_assistant_message() after each stage
    ↓
SQLite database: data/conversations.db
```

**Unencrypted:**
```json
{
  "id": "...",
  "profile_id": "...",
  "title": "...",
  "messages": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "stage1": [...], "stage1_5": {...}, "stage2": [...], "stage3": {...}, "metadata": {...}}
  ]
}
```

**Encrypted:**
```json
{
  "_encryption": {"version": "1.0", "provider": "fernet"},
  "messages_encrypted": "<base64-ciphertext>",
  "id": "...",
  "title": "...",
  ... (all other metadata unencrypted)
}
```

## Key Design Decisions

### Configuration-Driven Event Handling
**Problem:** 200-line switch statement with hardcoded stage names in `App.jsx`.

**Solution:**
- Centralized stage config ([stageConfig.js](frontend/src/stageConfig.js), [stage_config.py](backend/stage_config.py))
- Dynamic event handler factory ([eventHandler.js](frontend/src/eventHandler.js))
- 75% code reduction (200 → 50 lines)

**Benefits:** Easy to add stages (3 lines config), type-safe, maintainable.

See [Event Handling Architecture](ai_notes/EVENT_HANDLING.md) for details.

### Unified Stage Rendering
**Problem:** Separate UI components for council execution, no workflow support.

**Solution:**
- Single `UnifiedStage` component auto-detects execution mode
- Council mode: Message has `stage1/2/3` fields → renders traditional tabs
- Workflow mode: Message has `variables` field → renders variable display
- Message detection utility ([messageDetection.js](frontend/src/utils/messageDetection.js))

**Benefits:** Supports both execution modes, backward compatible, extensible.

See [Unified Stage Architecture](ai_notes/UNIFIED_STAGE_ARCHITECTURE.md) for details.

### Backend-First Storage
**Current:** All conversations stored in SQLite database (`data/conversations.db`), REST API.

**Alternative:** Local-first storage modules available but not integrated (`frontend/src/storage/`).

See [Storage Architecture](ai_notes/STORAGE_ARCHITECTURE.md) for details.

### Encrypted Storage
**What's encrypted:** Only `messages[]` array (user/assistant content)

**What's NOT encrypted:** All metadata (id, title, timestamps, is_public, etc.)

**Rationale:** Metadata must be searchable/indexable without decryption.

**Provider:** Fernet (AES-128-CBC) symmetric encryption, future-proof for RSA/hybrid.

See [Storage Architecture](ai_notes/STORAGE_ARCHITECTURE.md#encryption-encryptionpy) for details.

### Stage 2 Anonymization
**Why:** Prevents models from playing favorites based on brand recognition.

**How:**
- Models receive "Response A, B, C, etc." (anonymous)
- Backend creates mapping: `{"Response A": "openai/gpt-5.1", ...}`
- Frontend displays model names in **bold** for readability

**Transparency:** Users see explanation that original evaluation used anonymous labels.

### Progressive Message Building
**Pattern:** Assistant messages built incrementally during streaming.

**Benefits:**
- Resilient to crashes (partial data preserved)
- Enables stream resumption from checkpoint
- No lost work on network drops

See [Backend Architecture](ai_notes/BACKEND_ARCHITECTURE.md#progressive-message-building) for details.

### Scope Alignment (Workflow System)
**Problem:** Multi-agent workflows suffer from role drift, responsibility overlaps, and coverage gaps.

**Solution:** 4-phase pre-execution system:
- **Phase 1**: Each agent defines its operational contract
- **Phase 2**: Meta-agent resolves conflicts and creates final responsibility map
- **Phase 3**: Execution with refined scopes
- **Phase 4**: Post-execution audit (future)

**How It Works:**
- Runs **silently** before workflow execution
- Injects refined scope into worker instructions
- Falls back gracefully if alignment fails

**Configuration:**
```json
{
  "scope_alignment": {
    "enabled": true,
    "coordinator_model": "openai/gpt-4o"
  }
}
```

**Benefits:**
- Prevents role drift during execution
- Eliminates responsibility overlaps
- Fills coverage gaps
- Improves output quality

See [Scope Alignment Architecture](ai_notes/SCOPE_ALIGNMENT_ARCHITECTURE.md) for details.

## Important Implementation Details

### Module Imports
All backend modules use absolute imports (`from backend.config import ...`) not relative. Critical for `python -m backend.main` to work.

### Port Configuration
- Backend: **8003** (changed to avoid conflicts)
- Frontend: 5173 (Vite default)

### Deployment
See [Backend Architecture](ai_notes/BACKEND_ARCHITECTURE.md#deployment) for environment variables and steps.

### Markdown Rendering
All ReactMarkdown components must be wrapped in `<div className="markdown-content">` for proper spacing.

## Common Gotchas

1. **Module Import Errors**: Run backend as `python -m backend.main` from project root
2. **CORS Issues**: Configure `FRONTEND_URLS` environment variable
3. **API URL Configuration**: Set `VITE_API_BASE_URL` before frontend build
4. **Encryption Key Loss**: Lost `ENCRYPTION_KEY` = permanently lost conversations. ALWAYS back up `.env`
5. **Missing cryptography Package**: Install via `pip install cryptography`
6. **Model Identifiers**: Verify model IDs exist in OpenRouter before deployment

## Recent Updates

See [Changelog](ai_notes/CHANGELOG.md) for detailed update history.

**Latest (2025-12-15):**
- 🏆 **Score & Rank Superstep** - Anonymous peer review and ranking as special superstep type
- 📊 **Multiple Ranking Algorithms** - Average position, Borda count, ranked pairs, Schulze method
- 🎨 **Leaderboard Display** - Frontend shows rankings with badges, consensus indicators
- 🛠️ **Shared Ranking Utilities** - Council.py refactored to use common ranking functions

**2025-12-11:**
- 🔀 **DSL Unification** - Unified workers/perspective_matrix into single `perspectives` concept
- 🎯 **Model-Neutral by Default** - Perspectives apply to all models unless explicitly bound to specific model
- 📊 **Column-Wise Reduction** - New reducer strategy compares models per-perspective instead of global synthesis
- 🔧 **Migration Tool** - Automated migration script for existing workflows

**2025-12-10:**
- 🎯 **Scope Alignment System** - 4-phase pre-execution process prevents role drift in workflows
- 📋 **Operational Contracts** - Workers receive clear responsibility boundaries before execution
- 🔍 **Meta-Coordination** - Automated conflict detection and gap filling

**2025-12-09:**
- 🎨 **Unified Stage Architecture** - Single adaptive component for council and workflow execution
- 🔄 **Workflow UI Support** - Variable-based display with progress tracking
- 🛠️ **Workflow Partial State Saving** - Backend now saves workflow variables incrementally

**2025-12-08:**
- 🗄️ **SQLite Migration** - Migrated core storage from JSON to SQLite
- 📊 **Ranking Algorithms** - Advanced ranking algorithms

**2025-12-02:**
- 🔄 **Token Refresh Race Condition Fix** - Module-level lock prevents duplicate refresh attempts
- ⚡ **Configuration-Driven Event Handling** - 75% code reduction (200 → 50 lines)

**2025-11-29:**
- 🔐 **Session Revocation on Shutdown** - Auto-revoke all sessions for security
- 🌐 **SSE Network Resilience** - Automatic reconnection with stream resumption
- 🔀 **Backend Route Refactoring** - Modular route-based architecture
- 🔧 **Streaming Token Expiry Fix** - Proactive token refresh

**2025-11-26:**
- 🔒 **Security Hardening** - Encrypted data, rate limiting, audit logging
- **Waitlist & Invite System** - Production-ready registration
- **Encrypted Storage** - Fernet encryption for messages at rest

**2025-11-24:**
- 🔄 **Stage 1.5 Cross-Interrogation** - Models question each other's responses

**Earlier:**
- Streaming Implementation, Metadata Persistence, Edit/Retry UI, Multi-turn Support

## Future Enhancement Ideas

- Configurable council/chairman via UI (currently session-scoped via API)
- ~~Streaming responses~~ **DONE** ✓
- ~~Export to markdown~~ **DONE** ✓
- ~~Real-time updates~~ **DONE** ✓
- ~~Network resilience~~ **DONE** ✓
- Model performance analytics
- Custom ranking criteria
- Reasoning model support (o1, etc.)
- ~~Rename/Delete~~ **DONE** ✓
- ~~Stop/cancel~~ **DONE** ✓
- PDF export
- Integration tests
- Email notifications

## Testing Notes

Use `test_openrouter.py` to verify API connectivity and model identifiers before deployment.

## Documentation Maintenance

This CLAUDE.md file provides **essential overview** of the LLM Council project. Detailed implementation documentation is in [ai_notes/](ai_notes/).

**When to Update:**
- After major architectural changes
- When adding/removing API endpoints
- After implementing features from "Future Enhancement Ideas"
- When changing data structures

**What to Document Here:**
- High-level architecture overview
- Key design decisions and rationale
- Links to detailed documentation
- Recent updates with session dates

**Detailed Documentation:**
Store implementation details in [ai_notes/](ai_notes/) with descriptive filenames.

**Related Documentation:**
- [ai_notes/](ai_notes/) - Detailed technical documentation
- [frontend/src/storage/README.md](frontend/src/storage/README.md) - Local-first storage guide
- `.env.example` - Configuration documentation

**Last Major Update:** 2025-12-10 (Scope Alignment System - Role drift prevention)
