# Backend Architecture

Complete implementation details for the backend structure in LLM Council.

## Overview

The backend uses a **modular route-based architecture** with FastAPI routers. All routes are organized into separate modules under `backend/routes/`, with `main.py` handling application startup and middleware registration.

## Main Application (`backend/main.py`)

### Responsibilities
- FastAPI app initialization with lifespan event handler
- Middleware registration (CORS, security headers, rate limiting)
- Router inclusion from all route modules
- Startup security validation
- Shutdown session revocation (all sessions cleared for security)
- Health check endpoint (`GET /`)

### Startup Lifecycle
1. Run security validation (`startup_validation.py`) - checks JWT key, encryption key, file permissions
2. Register SecurityHeadersMiddleware (adds security headers to all responses)
3. Register rate limiter (slowapi) for per-IP rate limiting
4. Include all route modules (auth, conversations, forum, profiles, model_config)
5. Start accepting requests

### Shutdown Lifecycle
1. Revoke all active sessions for security
2. Log shutdown event to audit log

## Route Modules (`backend/routes/`)

### `auth.py` - Authentication & Registration (7 routes)
- `POST /api/auth/register` - Create account (requires invite in production, rate limited: 3/hour)
- `POST /api/auth/login` - Authenticate user (rate limited: 5/15min, with account lockout)
- `POST /api/auth/refresh` - Refresh tokens with automatic rotation (rate limited: 20/min)
- `POST /api/auth/logout` - Revoke refresh token
- `GET /api/auth/me` - Get current user info
- `POST /api/waitlist` - Join waitlist (rate limited: 1/hour)
- `GET /api/invite/validate/{token}` - Validate invite token

### `conversations.py` - Conversation Management & Messaging (14 routes)

**Largest module at 863 lines**

**List & CRUD:**
- `GET /api/conversations` - List conversations with view filtering (private/public/all)
- `GET /api/conversations/stream` - **SSE stream for real-time conversation list updates**
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/{id}` - Get conversation
- `PATCH /api/conversations/{id}/rename` - Rename conversation
- `DELETE /api/conversations/{id}` - Delete conversation

**Messaging:**
- `POST /api/conversations/{id}/message` - Send message (batch mode)
- `POST /api/conversations/{id}/message/stream` - Send message (streaming mode, **PREFERRED**, rate limited: 10/min)
- `POST /api/conversations/{id}/message/stream/resume` - **Resume interrupted stream from checkpoint**

**Export & Encryption:**
- `GET /api/conversations/{id}/export/markdown` - Export conversation as markdown
- `GET /api/conversations/{id}/encryption-status` - Get encryption status
- `POST /api/conversations/{id}/encrypt` - Encrypt conversation messages
- `POST /api/conversations/{id}/decrypt` - Decrypt conversation (save as plaintext)

**Publishing:**
- `POST /api/conversations/{id}/publish` - Publish to forum
- `DELETE /api/conversations/{id}/unpublish` - Unpublish from forum

### `forum.py` - Public Conversations (2 routes)
- `GET /api/forum/conversations` - List all public conversations
- `GET /api/forum/conversations/{id}` - Get specific public conversation (no auth required)

### `profiles.py` - Profile Management (5 routes)
- `GET /api/profiles` - List all profiles
- `GET /api/profiles/{id}` - Get profile
- `POST /api/profiles` - Create profile
- `PATCH /api/profiles/{id}` - Update profile
- `DELETE /api/profiles/{id}` - Delete profile

### `model_config.py` - Runtime Model Configuration (2 routes)
- `GET /api/models` - Get current model configuration (council + chairman)
- `POST /api/models` - Update model configuration (session-scoped, not persisted)

## Core Backend Modules

### `config.py` - Configuration

**Model Configuration:**
- `COUNCIL_MODELS`: List of OpenRouter model identifiers
- `CHAIRMAN_MODEL`: Model that synthesizes final answer
- `OPENROUTER_API_KEY`: API key from `.env`

**Server Configuration:**
- Backend runs on **port 8003** (changed to avoid conflicts)
- `ENVIRONMENT`: "local" or "production" mode (default: "local")
- `DEFAULT_PROFILE_ID`: Default profile for local development (default: "default")
- `PROFILES_FILE`: Path to profiles metadata file

**Encryption Settings:**
- `ENCRYPTION_ENABLED`: Enable/disable encryption (default: "true")
- `ENCRYPTION_KEY`: Base64-encoded Fernet key from `.env`
- `ENCRYPTION_PROVIDER`: Provider type (currently only "fernet")

**Authentication Settings:**
- `JWT_SECRET_KEY`: Secret key for JWT signing (auto-generated if not set)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Access token expiration (default: 15)
- `REFRESH_TOKEN_EXPIRE_DAYS`: Refresh token expiration (default: 7)
- `AUTH_ENABLED`: Enable/disable authentication (default: false)

### `openrouter.py` - LLM API Client

**Functions:**
- `query_model()`: Single async model query
- `query_models_parallel()`: Parallel queries using `asyncio.gather()`
- Returns dict with 'content' and optional 'reasoning_details'
- Graceful degradation: returns None on failure, continues with successful responses

### `council.py` - Core Deliberation Logic

**Stage 1 - Initial Responses:**
- `stage1_collect_responses()`: Parallel queries to all council models

**Stage 1.5 - Cross-Interrogation:**
- `stage1_5_cross_interrogation()`: Models generate follow-up questions about other responses
  - Anonymizes responses as "Response A, B, C, etc."
  - Each model asks 1-2 targeted questions about OTHER responses
  - Questions probe assumptions, ambiguities, and unmentioned aspects
  - Returns tuple: (questions_list, label_to_model_dict)
- `stage1_5_collect_answers()`: Models answer questions directed at them
  - Parses questions by target response label
  - Each model receives questions about their Stage 1 response
  - Models defend reasoning or acknowledge overlooked aspects
  - Returns list with original_response, questions, and answers

**Stage 2 - Peer Review:**
- `stage2_collect_rankings()`:
  - Anonymizes responses as "Response A, B, C, etc."
  - Creates `label_to_model` mapping for de-anonymization
  - Prompts models to evaluate and rank (with strict format requirements)
  - Returns tuple: (rankings_list, label_to_model_dict)
  - Each ranking includes both raw text and `parsed_ranking` list

**Stage 3 - Final Synthesis:**
- `stage3_synthesize_final()`: Chairman synthesizes from all responses + rankings

**Utility Functions:**
- `parse_ranking_from_text()`: Extracts "FINAL RANKING:" section, handles both numbered lists and plain format
- `calculate_aggregate_rankings()`: Computes average rank position across all peer evaluations
- `generate_conversation_title()`: Async title generation using gemini-2.5-flash (fast)

### `encryption.py` - Conversation Encryption

**Core Classes:**
- `EncryptionProvider`: Abstract base class for provider abstraction
- `FernetProvider`: Current implementation (symmetric encryption)
- `RSAProvider`: Placeholder for future asymmetric support

**Functions:**
- `encrypt_data()` / `decrypt_data()`: JSON-safe encryption utilities
- `generate_fernet_key()`: Key generation helper
- `is_encrypted()`: Detects encrypted conversations

**Architecture:**
- Symmetric encryption using Fernet (AES-128-CBC) for messages at rest
- Supports future hybrid encryption (RSA + AES)

### `models.py` - Pydantic Request/Response Models

**Purpose:**
- All request/response schemas using Pydantic BaseModel
- Used for automatic validation and OpenAPI schema generation
- Includes: authentication models, conversation models, profile models, model config

**Key Models:**
- `CreateConversationRequest`
- `SendMessageRequest`
- `ResumeStreamRequest`
- `Conversation`
- `ConversationMetadata`

### `storage.py` - JSON-Based Storage with Encryption

**Storage Structure:**
- JSON-based conversation storage in `data/conversations/profile_<id>/`
- **Encryption support**: Messages encrypted at rest, metadata unencrypted
- Profile-based directory structure for multi-tenancy

**Conversation Schema:**
- `{id, profile_id, created_at, modified_at, title, messages[], is_public, published_at, sync_status, uses_byok}`
- Encrypted conversations add: `{_encryption: {version, provider}, messages_encrypted: <base64>}`
- Assistant messages contain: `{role, stage1, stage2, stage3, metadata, stage1_5}`
- Metadata (label_to_model, aggregate_rankings) persisted to storage

**Key Features:**
- **Modified timestamps**: Tracks `created_at` and `modified_at` for change detection
- **View filtering**: `list_conversations(view)` supports `private`, `public`, `all` views
- **Message count**: Metadata includes `message_count` (handles encrypted messages)
- **Stream metadata**: Stores checkpoint data for stream resumption
  - `set_stream_metadata()`, `get_stream_metadata()`, `clear_stream_metadata()`
  - Metadata includes: stream_id, connection_token, last_stage, updated_at
  - Cleared after stream completion or 2hr expiry
- **Progressive message building**: `save_partial_assistant_message()` for incremental saves
- **Encryption functions**: `get_encryption_provider()` - creates Fernet provider from config
- **Backward compatible**: Transparently reads legacy unencrypted files, re-encrypts on save

**Profile Management:**
- `list_profiles()`, `create_profile()`, `update_profile()`, `delete_profile()`

**Publish/Forum Functions:**
- `publish_conversation()`, `unpublish_conversation()`
- `list_public_conversations()` - returns only public conversations across all profiles
- `get_public_conversation()` - get specific public conversation without auth

### `stage_config.py` - Backend Stage Configuration

**Purpose:**
- Mirrors frontend config for consistency
- Prevents event name typos and mismatches
- Used in `routes/conversations.py` for event emission

**Classes:**
- `StageConfig`: Dataclass for stage configuration
- `SubStageConfig`: Dataclass for complex stages with sub-stages

**Functions:**
- `get_stage_config(name)`: Get stage configuration
- `validate_stage_sequence(last_stage)`: Get remaining stages (for resume)
- `get_all_event_types()`: All valid event types

**Benefits:**
- Single source of truth for stage/event names
- Backend-frontend contract explicit and enforced
- Easy to extend with new stages

### `rate_limiter.py` - Shared Rate Limiter

**Purpose:**
- Single slowapi Limiter instance used across all routes
- Prevents circular imports when multiple route modules need rate limiting

**Implementation:**
- Key function: `get_remote_address` (rate limits by IP address)

### `utils.py` - Utility Functions

**Functions:**
- `conversation_to_markdown(conversation)`: Export conversations to markdown format
  - Handles all stages (1, 1.5, 2, 3) and metadata (aggregate rankings)
  - Used by markdown export endpoint

## Important Implementation Details

### Relative Imports
All backend modules use relative imports (e.g., `from .config import ...`) not absolute imports. This is critical for Python's module system to work correctly when running as `python -m backend.main`.

### Port Configuration
- Backend: **8003** (changed from 8000, then 8001 to avoid conflicts)
- Frontend: 5173 (Vite default)

### Deployment

**Environment Variables:**

**Frontend:**
- `VITE_API_BASE_URL`: Backend API URL (default: `http://localhost:8003`)
  - Set in `.env` file or build environment
  - Example production: `VITE_API_BASE_URL=https://api.yourdomain.com`

**Backend:**
- `FRONTEND_URLS`: Comma-separated list of allowed frontend origins for CORS
  - Default: `http://localhost:5173,http://localhost:3000`
  - Example production: `FRONTEND_URLS=https://yourdomain.com,https://www.yourdomain.com`
  - Must include all frontend domains that will access the API

**Deployment Steps:**

1. **Frontend**:
   - Create `.env` file with `VITE_API_BASE_URL=<your-backend-url>`
   - Run `npm run build` - Vite will embed the variable in the build
   - Deploy `dist/` directory to your hosting service

2. **Backend**:
   - Set `FRONTEND_URLS` environment variable with your frontend domain(s)
   - Set `ENVIRONMENT=production` for production mode
   - Ensure all security variables are set (JWT_SECRET_KEY, ENCRYPTION_KEY, etc.)
   - Run with `python -m backend.main` or via process manager (systemd, pm2, etc.)

## Design Patterns

### Graceful Degradation
- Continue with successful responses if some models fail
- Never fail the entire request due to single model failure
- Log errors but don't expose to user unless all models fail

### Progressive Message Building
During streaming, assistant messages are built incrementally:

1. Create empty assistant message
2. Add stage1 data → save checkpoint
3. Add stage1_5 data → save checkpoint
4. Add stage2 data + metadata → save checkpoint
5. Add stage3 data → save checkpoint (mark complete)

**Function:** `save_partial_assistant_message()` handles all progressive updates

**Benefits:**
- Resilient to crashes (partial data preserved)
- Enables stream resumption from checkpoint
- User sees progress even if interrupted
- No lost work on network drops

### Idempotent Message Handling
Prevents duplicate user messages on retry:

```python
last_msg = conversation["messages"][-1] if conversation["messages"] else None
is_duplicate = (
    last_msg
    and last_msg.get("role") == "user"
    and last_msg.get("content") == req.content
)
if not is_duplicate:
    storage.add_user_message(conversation_id, req.content, pid)
```

**Why:** Network retries could send same message multiple times

**Implementation:** Check last message before adding new user message

## Related Documentation
- [Authentication](AUTHENTICATION.md) - Complete auth system details
- [Storage Architecture](STORAGE_ARCHITECTURE.md) - Storage and encryption details
- [Event Handling](EVENT_HANDLING.md) - Configuration-driven event system
- [SSE Network Resilience](SSE_NETWORK_RESILIENCE.md) - Stream resumption details
- [Stage 1.5 Implementation](STAGE_1_5_IMPLEMENTATION.md) - Cross-interrogation details
