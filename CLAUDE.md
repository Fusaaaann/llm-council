# CLAUDE.md - Technical Notes for LLM Council

This file contains technical details, architectural decisions, and important implementation notes for future development sessions.

## Project Overview

LLM Council is a 3-stage deliberation system where multiple LLMs collaboratively answer user questions. The key innovation is anonymized peer review in Stage 2, preventing models from playing favorites.

**Key Features:**
- **Streaming responses**: Progressive display of each stage as it completes via Server-Sent Events
- **Metadata persistence**: label_to_model and aggregate_rankings now saved with messages
- **Edit/Retry actions**: Users can edit or retry their last message
- **Multi-turn conversations**: Input field always visible for continued dialogue
- **Local-first storage**: Frontend can use localStorage with optional backend sync
- **Profile-based multi-tenancy**: Conversations organized by profiles
- **Public/Private conversations**: Publish to forum or keep private
- **BYOK support**: Bring-Your-Own-Key conversations stay private by default

## Architecture

### Authentication & Session Management

**JWT-Based Authentication:**
- Access tokens: Short-lived (15 min), JWT-signed, contains user_id and profile_id
- Refresh tokens: Long-lived (7 days), **single-use with automatic rotation**
- Secure password hashing with bcrypt
- Automatic token refresh on frontend (401 → refresh → retry)
- **Security features:**
  - Refresh token rotation (one-time use, prevents replay attacks)
  - Account lockout after 10 failed attempts (30 min duration)
  - Rate limiting on all auth endpoints
  - Comprehensive audit logging to `data/audit.log`

**Waitlist & Invite System:**
- **Local mode**: Registration open without invite token
- **Production mode**: Invite token required for registration
- **Waitlist flow**: Users submit email → admin generates invite → user registers
- **Invite tokens**: Secure, time-limited (7 days default), single-use
- Admin CLI tool: `scripts/generate_invite.py` for invite management

**Backend Implementation (`backend/`):**

**`auth.py`** - Core Authentication Logic
- `create_user()`: User registration with automatic profile creation (accepts optional invite_token)
- `authenticate_user()`: Email/password authentication **with account lockout protection**
- `create_access_token()`: Generate JWT access token
- `create_refresh_token_record()`: Generate and store refresh token
- `verify_access_token()`: Validate JWT token
- `verify_refresh_token()`: Validate refresh token from session store
- `revoke_refresh_token()`: Single token revocation (logout)
- `revoke_all_user_sessions()`: All sessions revocation
- **NEW security functions:**
  - `is_account_locked()`: Check if account is locked
  - `lock_account()`: Lock account for specified duration
  - `record_failed_login()`: Track failed attempts, auto-lock at threshold
  - `reset_failed_login_attempts()`: Clear counter on successful login
  - `load_users()` / `save_users()`: **Now encrypt/decrypt data at rest**
  - `load_sessions()` / `save_sessions()`: **Now encrypt/decrypt data at rest**
- User storage in `data/users.json` **(encrypted)**
- Session storage in `data/sessions.json` **(encrypted)**
- Each user gets a default profile automatically

**`auth_middleware.py`** - Request Authentication
- `get_current_user_optional()`: Dependency for optional auth (local mode)
- `get_current_user_required()`: Dependency for required auth
- `get_profile_id_for_request()`: Determine profile based on auth status **with access control**
- **NEW security functions:**
  - `user_has_profile_access()`: Validates profile ownership, prevents horizontal privilege escalation
- Production mode: Always requires authentication
- Local mode: Authentication optional, falls back to "default" profile
- **Profile access control:** Users can only access their own profiles (based on profile_id ownership)

**Security Infrastructure (`backend/`):**

**`startup_validation.py`** - Fail-Fast Security Checks
- Runs on server startup before accepting requests
- Validates:
  - JWT_SECRET_KEY set in production mode (fails if missing)
  - ENCRYPTION_KEY set if encrypted files exist
  - File permissions on sensitive data files (warns if world-readable)
- Clear error messages with remediation instructions
- Prevents misconfigured production deployments

**`security_middleware.py`** - Security Headers
- Adds comprehensive security headers to all responses:
  - `X-Frame-Options: DENY` - Prevents clickjacking
  - `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
  - `Content-Security-Policy` - Restricts resource loading
  - `Strict-Transport-Security` - Forces HTTPS (production only)
  - `Referrer-Policy`, `Permissions-Policy`, etc.

**`audit.py`** - Security Event Logging
- Logs all security-relevant events to `data/audit.log`
- JSON format (one event per line) for easy parsing
- Events logged:
  - Login/logout (success/failure with reason)
  - Registration attempts
  - Token refresh attempts
  - Invite validation/usage
  - Account lockouts
  - Profile access violations
  - Rate limit violations
- Captures: timestamp, event type, user ID/email, IP, user agent, details

**Rate Limiting (`main.py` via slowapi):**
- Login: 5 attempts per 15 minutes per IP
- Register: 3 per hour per IP
- Refresh: 20 per minute per IP
- Waitlist: 1 per hour per IP
- Message stream: 10 per minute per user
- Returns HTTP 429 with Retry-After header

**Authentication Endpoints (`main.py`):**
- `POST /api/auth/register` - Create account **(rate limited, audit logged, requires invite in prod)**
- `POST /api/auth/login` - Authenticate **(rate limited, audit logged, lockout protected)**
- `POST /api/auth/refresh` - Refresh tokens **(rate limited, audit logged, ROTATES refresh token)**
- `POST /api/auth/logout` - Revoke refresh token **(audit logged)**
- `GET /api/auth/me` - Get current user

**Waitlist & Invite Endpoints (`main.py`):**
- `POST /api/waitlist` - Join waitlist (email + optional name)
- `GET /api/invite/validate/{token}` - Validate invite token

**Storage Layer (`storage.py`):**
- Waitlist management: `add_to_waitlist()`, `list_waitlist()`, `mark_waitlist_invited()`
- Invite tokens: `create_invite_token()`, `get_invite_token()`, `validate_invite_token()`, `mark_invite_used()`, `list_invite_tokens()`
- **NEW encryption functions:**
  - `load_invites()` / `save_invites()`: Encrypt/decrypt invite tokens at rest
- Waitlist storage: `data/waitlist.json`
- Invite storage: `data/invites.json` **(encrypted)**

**Frontend Implementation:**

**`auth.js`** - Token Management
- `setAuth()`: Store tokens and user data in localStorage
- `getAccessToken()`: Retrieve current access token
- `getRefreshToken()`: Retrieve refresh token
- `getCurrentUser()`: Get stored user data
- `isAuthenticated()`: Check if user is logged in
- `clearAuth()`: Remove all auth data (logout)
- `updateAccessToken()`: Update token after refresh
- **REQUIRED UPDATE:** `updateRefreshToken()` - **Must store new refresh token from `/api/auth/refresh` response**

**`api.js`** - Enhanced with Authentication
- `fetchWithAuth()`: Wrapper that adds Authorization header
- Automatic token refresh: Catches 401, refreshes token, retries request
- Auth endpoints: register(), login(), logout(), getCurrentUser()
- All API methods updated to use fetchWithAuth()

**`AuthModal.jsx`** - Login/Register/Waitlist UI
- Three modes: login, register (with invite), waitlist
- Invite token validation on mount when provided
- Email auto-filled for invite-based registration
- Waitlist submission with success confirmation
- Error display and loading states
- Calls onSuccess callback with auth data

**`App.jsx`** - Auth State Management
- Detects invite token in URL query parameter (?invite=xxx)
- Initializes auth state from localStorage on mount
- handleAuth(): Handles login/register success (passes invite_token)
- handleLogout(): Clears auth and resets app state
- Passes user, onLogin, onLogout to Sidebar

**`Sidebar.jsx`** - Auth UI Display
- Shows "Login / Register" button when not authenticated
- Shows user name and logout button when authenticated
- Styled auth section between header and conversation list

### Backend Structure (`backend/`)

**`config.py`**
- Contains `COUNCIL_MODELS` (list of OpenRouter model identifiers)
- Contains `CHAIRMAN_MODEL` (model that synthesizes final answer)
- Uses environment variable `OPENROUTER_API_KEY` from `.env`
- Backend runs on **port 8001** (NOT 8000 - user had another app on 8000)
- `ENVIRONMENT`: "local" or "production" mode (default: "local")
- `DEFAULT_PROFILE_ID`: Default profile for local development (default: "default")
- `PROFILES_FILE`: Path to profiles metadata file
- **Encryption settings**:
  - `ENCRYPTION_ENABLED`: Enable/disable encryption (default: "true")
  - `ENCRYPTION_KEY`: Base64-encoded Fernet key from `.env`
  - `ENCRYPTION_PROVIDER`: Provider type (currently only "fernet")
- **Authentication settings**:
  - `JWT_SECRET_KEY`: Secret key for JWT signing (auto-generated if not set)
  - `ACCESS_TOKEN_EXPIRE_MINUTES`: Access token expiration (default: 15)
  - `REFRESH_TOKEN_EXPIRE_DAYS`: Refresh token expiration (default: 7)
  - `AUTH_ENABLED`: Enable/disable authentication (default: false)

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

**`encryption.py`** - Conversation Encryption
- Symmetric encryption using Fernet (AES-128-CBC) for messages at rest
- `EncryptionProvider`: Abstract base class for provider abstraction
- `FernetProvider`: Current implementation (symmetric encryption)
- `RSAProvider`: Placeholder for future asymmetric support
- `encrypt_data()` / `decrypt_data()`: JSON-safe encryption utilities
- `generate_fernet_key()`: Key generation helper
- `is_encrypted()`: Detects encrypted conversations
- Architecture supports future hybrid encryption (RSA + AES)

**`storage.py`**
- JSON-based conversation storage in `data/conversations/profile_<id>/`
- **Encryption support**: Messages encrypted at rest, metadata unencrypted
- Profile-based directory structure for multi-tenancy
- Each conversation: `{id, profile_id, created_at, title, messages[], is_public, published_at, sync_status, uses_byok}`
- Encrypted conversations add: `{_encryption: {version, provider}, messages_encrypted: <base64>}`
- Assistant messages contain: `{role, stage1, stage2, stage3, metadata, stage1_5}`
- Metadata (label_to_model, aggregate_rankings) persisted to storage
- **Encryption functions**: `get_encryption_provider()` - creates Fernet provider from config
- **Backward compatible**: Transparently reads legacy unencrypted files, re-encrypts on save
- Profile management functions: `list_profiles()`, `create_profile()`, `update_profile()`, `delete_profile()`
- Publish/unpublish functions: `publish_conversation()`, `unpublish_conversation()`
- Forum functions: `list_public_conversations()` - returns only public conversations across all profiles


**`main.py`**
- FastAPI app with CORS enabled for localhost:5173 and localhost:3000
- All endpoints now accept optional `profile_id` query parameter (defaults to DEFAULT_PROFILE_ID in local mode)
- **Conversation Endpoints:**
  - GET `/api/conversations?profile_id=<id>` - List conversations for profile
  - POST `/api/conversations?profile_id=<id>` - Create conversation (accepts `uses_byok` param)
  - GET `/api/conversations/{id}?profile_id=<id>` - Get conversation
  - PATCH `/api/conversations/{id}/rename?profile_id=<id>` - Rename conversation
  - DELETE `/api/conversations/{id}?profile_id=<id>` - Delete conversation
  - POST `/api/conversations/{id}/message?profile_id=<id>` - Send message (batch)
  - POST `/api/conversations/{id}/message/stream?profile_id=<id>` - Send message (streaming, PREFERRED)
  - GET `/api/conversations/{id}/export/{format}?profile_id=<id>` - Export conversation
- **Profile Endpoints:**
  - GET `/api/profiles` - List all profiles
  - GET `/api/profiles/{id}` - Get profile
  - POST `/api/profiles` - Create profile
  - PATCH `/api/profiles/{id}` - Update profile
  - DELETE `/api/profiles/{id}` - Delete profile
- **Publish/Forum Endpoints:**
  - POST `/api/conversations/{id}/publish?profile_id=<id>` - Publish to forum
  - DELETE `/api/conversations/{id}/unpublish?profile_id=<id>` - Unpublish from forum
  - GET `/api/forum/conversations` - List public conversations
  - GET `/api/forum/conversations/{id}?profile_id=<id>` - Get public conversation
- Streaming endpoint sends events: stage1_start, stage1_complete, stage1_5_questions_start, stage1_5_questions_complete, stage1_5_answers_start, stage1_5_answers_complete, stage2_start, stage2_complete, stage3_start, stage3_complete, title_complete, complete, error
- Title generation runs in parallel with Stage 1 to minimize perceived latency
- Metadata includes: label_to_model mapping and aggregate_rankings

### Frontend Structure (`frontend/src/`)

**`storage/localStorage.js`**
- Pure localStorage implementation for local-first architecture
- Stores conversations in browser localStorage with key `llm_council_conversations`
- Profile ID stored in `llm_council_profile_id`
- Functions: `getAllConversations()`, `getConversation()`, `createConversation()`, `updateConversation()`, `deleteConversation()`
- Conversation fields: `id`, `profile_id`, `created_at`, `title`, `messages`, `is_public`, `published_at`, `sync_status`, `uses_byok`, `is_loading`
- Publish/unpublish functions for local state management

**`storage/hybridStorage.js`**
- Hybrid storage layer combining localStorage (primary) with backend API (sync)
- Local-first: all operations happen locally first, then optionally sync to backend
- `publishConversation()`: marks public locally, syncs to backend, updates sync_status
- `unpublishConversation()`: marks private locally, syncs to backend
- Forum operations go directly to backend API
- Graceful error handling with local state rollback on sync failure

**`api.js`**
- Updated to include `profile_id` in all API calls
- Reads current profile ID from localStorage
- New endpoints: `publishConversation()`, `unpublishConversation()`, `listForumConversations()`, `getForumConversation()`
- Profile management: `listProfiles()`, `createProfile()`, `updateProfile()`, `deleteProfile()`

**`App.jsx`**
- Main orchestration: manages conversations list and current conversation
- Handles message sending via streaming API (`sendMessageStream`)
- **Handlers:**
  - `handleEditMessage()`: Removes last user message + assistant response, populates input field
  - `handleRetryMessage()`: Removes last assistant response, resends user message
  - `handlePublishConversation()`: Publishes conversation to forum
  - `handleUnpublishConversation()`: Unpublishes conversation from forum
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

**`components/Sidebar.jsx`**
- Shows conversation list with metadata
- **New UI elements:**
  - Sync status icon: 💾 (local), ⏳ (syncing), ☁️ (synced)
  - Public badge: 🌐 (visible for public conversations)
  - BYOK badge: 🔑 (visible for BYOK conversations)
- Context menu options:
  - Rename, Publish/Unpublish, Export (Markdown/PDF), Delete
  - Publish disabled for BYOK conversations
- Shows loading spinner for conversations being processed

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
- New styles for sync icons, badges, and disabled buttons in `Sidebar.css`

## Key Design Decisions

### Local-First Architecture
The application supports both traditional server-based storage and local-first architecture:

**Backend Storage (Current Default)**
- Conversations stored in `data/conversations/profile_<id>/<conversation_id>.json`
- Profile metadata in `data/profiles.json`
- All operations go through backend API

**Local-First Storage (Optional)**
- Frontend `localStorage` stores conversations in browser
- Backend used only for:
  - Publishing conversations to public forum
  - Syncing public conversations across devices
  - Storing public conversations for forum access
- Advantages:
  - Works offline
  - No server dependency for private conversations
  - Instant local operations
  - Optional cloud sync for sharing

**Profile-Based Multi-Tenancy**
- Conversations organized by profile_id
- Local mode: Auto-uses "default" profile
- Production mode: Requires authentication (TODO)
- Each profile has separate conversation namespace
- Profiles stored in centralized `profiles.json`

**Public/Private Conversation Model**
- Default: Conversations are public (can be published to forum)
- BYOK conversations: Always private (cannot be published)
- `sync_status` field tracks: "local" → "syncing" → "synced"
- Private conversations never leave local storage
- Public conversations sync to backend when published

**Encrypted Storage Architecture**
- **Encryption provider**: Fernet (AES-128-CBC) symmetric encryption
- **What's encrypted**: Only `messages[]` array (user/assistant message content)
- **What's NOT encrypted**: All metadata (id, title, timestamps, is_public, etc.)
- **Rationale**: Metadata must be searchable/indexable without decryption
- **Key management**:
  - Single encryption key per installation in `.env` file
  - Auto-generated via `generate_encryption_key.py` if missing
  - User responsible for backing up key (no key recovery mechanism)
- **File format**:
  ```json
  {
    "_encryption": {"version": "1.0", "provider": "fernet"},
    "messages_encrypted": "<base64-ciphertext>",
    "id": "...", "title": "...", "created_at": "..."
  }
  ```
- **Backward compatibility**:
  - Automatic detection: presence of `_encryption` or `messages_encrypted` field
  - Legacy unencrypted files load transparently
  - Re-encrypted on next save (no manual migration)
  - Zero-downtime migration path
- **Future-proofing**:
  - Provider abstraction layer supports future asymmetric encryption
  - Version field allows migration between encryption schemes
  - Architecture ready for RSA/hybrid encryption (not yet implemented)
- **Security considerations**:
  - Encryption enabled by default (`ENCRYPTION_ENABLED=true`)
  - Fails securely: throws error if encrypted file found but key missing
  - No plaintext fallback once encryption enabled
  - Lost key = permanently lost conversations (by design)

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
6. **Encryption Key Loss**: Lost `ENCRYPTION_KEY` = permanently lost conversations. ALWAYS back up `.env` file
7. **Missing cryptography Package**: Encryption requires `cryptography` library - install via `pip install cryptography`

## Recent Updates (Latest Session)

### 🔒 Security Hardening (Current Session - 2025-11-26)

Comprehensive security overhaul addressing critical vulnerabilities:

**Critical Fixes:**
1. ✅ **Encrypted auth data at rest** - users.json, sessions.json, invites.json now encrypted
2. ✅ **JWT secret validation** - Server fails fast if JWT_SECRET_KEY not set in production
3. ✅ **Rate limiting** - All auth endpoints protected (login: 5/15min, register: 3/hr, etc.)
4. ✅ **Profile access control** - Prevents horizontal privilege escalation (user can't access other profiles)

**Additional Security:**
5. ✅ **Security headers middleware** - CSP, X-Frame-Options, HSTS, etc.
6. ✅ **Audit logging** - All auth events logged to `data/audit.log`
7. ✅ **Account lockout** - 10 failed attempts → 30 min lockout
8. ✅ **Refresh token rotation** - One-time use tokens prevent replay attacks

**Files Created:**
- `backend/startup_validation.py` - Fail-fast security checks
- `backend/security_middleware.py` - Security headers
- `backend/audit.py` - Comprehensive event logging
- `SECURITY_IMPLEMENTATION.md` - Full documentation
- `SECURITY_MIGRATION_GUIDE.md` - Upgrade instructions
- `FRONTEND_CHANGES_REQUIRED.md` - Breaking changes for frontend

**Files Modified:**
- `backend/auth.py` - Encryption, lockout, token rotation logic
- `backend/storage.py` - Invite encryption
- `backend/main.py` - Rate limiting, audit logging integration
- `backend/auth_middleware.py` - Profile access validation
- `backend/config.py` - Security settings
- `pyproject.toml` - Added slowapi dependency
- `.env.example` - Security configuration docs

**⚠️ BREAKING CHANGE:** Refresh token rotation requires frontend update. See `FRONTEND_CHANGES_REQUIRED.md`.

### Waitlist & Invite System (Previous Session)
- **Added waitlist system**: Users can join waitlist without invite
- **Backend changes**:
  - `backend/config.py`: Added `ADMIN_EMAIL`, `WAITLIST_FILE`, `INVITES_FILE`, `INVITE_TOKEN_EXPIRE_DAYS`
  - `backend/storage.py`: Waitlist and invite token management functions
  - `backend/auth.py`: Updated `create_user()` to accept and validate invite tokens
  - `backend/main.py`: Added `/api/waitlist` and `/api/invite/validate/{token}` endpoints
- **CLI tool**: `scripts/generate_invite.py` for admin invite management
  - Generate invite links for specific emails
  - List all invites (with --list flag)
  - List waitlist entries (with --waitlist flag)
  - Tracks usage and expiration
- **Frontend changes**:
  - `AuthModal.jsx`: Three modes (login, register, waitlist), invite token validation
  - `App.jsx`: URL-based invite token detection (?invite=xxx)
  - `api.js`: Updated register() to pass invite_token
- **Security**: Invite tokens are single-use, time-limited, securely generated
- **Production mode**: Registration requires valid invite token
- **Local mode**: Registration works without invite token for development

### Encrypted Conversation Storage (Previous Session)
- **Added `backend/encryption.py`**: Encryption provider system with Fernet implementation
- **Modified `backend/storage.py`**: Automatic encryption/decryption of messages at rest
- **Updated `backend/config.py`**: Encryption configuration settings
- **Key generation**: `generate_encryption_key.py` script for automatic key setup
- **Backward compatible**: Legacy unencrypted conversations load and re-encrypt automatically
- **Test suite**: `test_encryption.py` validates encryption, decryption, and migration
- **Security**: Messages encrypted with AES-128, metadata remains unencrypted for indexing
- **Architecture**: Provider abstraction allows future RSA/hybrid encryption support

### Previous Updates

#### Streaming Implementation
- Added `/api/conversations/{id}/message/stream` endpoint with Server-Sent Events
- Frontend now uses streaming by default for real-time stage updates
- Title generation parallelized with Stage 1 to reduce perceived latency

#### Metadata Persistence
- Modified `storage.py` to accept optional metadata parameter in `add_assistant_message()`
- Backend now saves label_to_model and aggregate_rankings with each message
- Metadata survives page reloads and conversation switching

#### Edit/Retry UI
- Added Edit and Retry buttons to last user message
- Edit functionality: removes messages, populates input field, focuses textarea
- Retry functionality: removes assistant response, resends query
- Buttons only show when not loading and on the last user message

#### Multi-turn Support
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
