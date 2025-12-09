# Changelog

Detailed history of all major updates and features implemented in LLM Council.

## 2025-12-08

### 🗄️ SQLite Migration

Migrated core storage from JSON files to SQLite database for improved performance and reliability.

**Changes:**
- Replaced JSON file storage with SQLite database (`data/conversations.db`)
- Modularized storage into `backend/storage/` directory
  - `conversations.py` - Conversation CRUD (21k LOC)
  - `database.py` - SQLite connection and schema
  - `profiles.py` - Profile management
  - `publish.py` - Publishing operations
  - `registration.py` - User registration, waitlist, invites
  - `audit.py` - Audit logging
  - `encryption.py` - Encryption utilities
  - `dsl.py` - DSL/workflow storage
- Created `scripts/migrate_to_sqlite.py` for migrating legacy JSON files
- Preserved encryption support for messages at rest
- Maintained backward compatibility via migration script

**Benefits:**
- Better performance for large conversation sets
- ACID transactions for data integrity
- Simpler backup (single database file)
- Foundation for future features (full-text search, analytics)

**Files Created:**
- `backend/storage/` - New modular storage directory
- `scripts/migrate_to_sqlite.py` - Migration script

**Files Removed:**
- `backend/storage.py` - Replaced by modular storage/
- `backend/audit.py` - Moved to storage/audit.py

---

### 📊 Ranking Algorithms

Added advanced ranking algorithms including perspective matrix for multi-dimensional evaluation.

**Features:**
- Perspective matrix ranking system
- Multiple ranking algorithm support
- Not yet integrated into main council flow

**Files Created:**
- `backend/ranking_algorithms.py` - Advanced ranking implementations
- `test_perspective_matrix.py` - Test suite

---

## 2025-12-02

### 🔄 Token Refresh Race Condition Fix

Fixed critical race condition where multiple simultaneous API calls would trigger duplicate token refresh attempts.

**Problem:**
- When selecting a conversation, two API calls happen simultaneously:
  - `subscribeToConversationUpdates()` - SSE stream for real-time updates
  - `getConversation()` - Fetch conversation details
- Both detect 401 (expired token) at the same time
- Both call `refreshAccessToken()` independently
- Second refresh fails because refresh token already used (single-use rotation)
- User sees error: "Refresh token invalid or expired - Token already used"

**Solution:**
Implemented token refresh deduplication in [frontend/src/api.js](../frontend/src/api.js):

1. ✅ **Refresh lock** - Module-level `refreshPromise` variable tracks in-flight refresh
2. ✅ **Deduplication logic** - Second caller waits for existing Promise instead of starting new refresh
3. ✅ **Automatic cleanup** - Promise cleared in `finally` block after completion
4. ✅ **Single refresh guarantee** - Only one `/api/auth/refresh` call happens, all callers share result

**Impact:**
- Fixes duplicate refresh calls when switching conversations
- Works across all 4 callsites: `fetchWithAuth()`, proactive pre-stream refresh, stream 401 handling, SSE 401 handling
- No more "token already used" errors from race conditions
- Preserves single-use token rotation security

**Files Modified:**
- `frontend/src/api.js` - Added refresh lock and deduplication logic

**Related Documentation:**
- [Authentication](AUTHENTICATION.md#token-refresh-race-condition-fix)

---

### ⚡ Configuration-Driven Event Handling

Generalized event handling system from hardcoded switch statements to dynamic, configuration-driven architecture.

**Problem:**
- 200-line switch statement in `App.jsx` with hardcoded stage names
- Adding new stages required changes in 4-5 places
- Difficult to maintain and error-prone
- Tight coupling between event handling and stage logic

**Solution:**
1. ✅ **Stage configuration module** - `frontend/src/stageConfig.js`
   - Centralized stage definitions (name, events, fields, loading messages)
   - Support for complex stages with sub-stages (e.g., stage1_5)
   - Support for metadata stages (e.g., stage2)
   - Helper functions for stage lookup and validation

2. ✅ **Dynamic event handler factory** - `frontend/src/eventHandler.js`
   - `createStreamEventHandler()` generates handlers from config
   - Automatic handling of all stage start/complete events
   - Generic logic for message updates and query state management
   - Returns boolean indicating if event was handled

3. ✅ **Refactored App.jsx** - Event handling
   - Creates dynamic handler from factory
   - Delegates all stage events to dynamic handler
   - Only handles special events (title, complete, error, heartbeat, auth_expired)
   - **Code reduction:** 200 lines → 50 lines (75% reduction)

4. ✅ **Backend stage config** - `backend/stage_config.py`
   - Mirrors frontend config for consistency
   - Prevents event name typos and mismatches
   - Used in `routes/conversations.py` for event emission

**Benefits:**
- **Easy to extend:** New stages only need config entry (3 lines)
- **Type-safe:** Single source of truth for stage/event names
- **Maintainable:** Logic centralized, not scattered
- **Testable:** Generic handlers can be unit tested
- **Consistent:** Backend-frontend contract explicit

**Adding a New Stage:**
```javascript
// 1. Add to frontend/src/stageConfig.js
{ name: 'stage4', label: 'Stage 4', messageField: 'stage4',
  loadingMessage: '...', events: { start: '...', complete: '...' }}

// 2. Add to backend/stage_config.py
StageConfig(name="stage4", label="Stage 4", ...)

// 3. Emit events from backend
yield send_event('stage4_start', stage='stage4')
yield send_event('stage4_complete', result, 'stage4')

// 4. Done! Frontend automatically handles it.
```

**Files Created:**
- `frontend/src/stageConfig.js` - Stage configuration
- `frontend/src/eventHandler.js` - Dynamic event handler factory
- `backend/stage_config.py` - Backend stage configuration

**Files Modified:**
- `frontend/src/App.jsx` - Refactored event handling (200 → 50 lines)
- `frontend/src/components/ChatInterface.jsx` - Dynamic stage rendering (50 → 25 lines)
- `backend/routes/conversations.py` - Import stage config, add comment
- `CLAUDE.md` - Documentation updates

**Related Documentation:**
- [Event Handling Architecture](EVENT_HANDLING.md)

## 2025-11-29

### 🔐 Session Revocation on Server Shutdown

Implemented automatic revocation of all login sessions when the backend server shuts down.

**Changes:**
1. ✅ **New function**: `revoke_all_sessions()` in `backend/auth.py`
2. ✅ **Lifespan handler**: Migrated from deprecated `@app.on_event` to modern `lifespan` context manager
3. ✅ **Audit logging**: Added `log_session_revocation()` to track shutdown events
4. ✅ **Clean shutdown**: All sessions cleared in `data/sessions.json` on server stop

**Security Benefits:**
- Prevents session hijacking after server restart
- No stale or orphaned sessions persist
- Audit trail for all session revocations
- Forces re-authentication after deployment/restart

**User Experience:**
- Users must log in again after server restart
- Frontend automatically detects 401 and shows login modal
- Clear error messages guide users through re-authentication

**Files Modified:**
- `backend/auth.py` - Added `revoke_all_sessions()` function
- `backend/main.py` - Lifespan handler with shutdown cleanup
- `backend/audit.py` - Added session revocation logging
- `CLAUDE.md` - Documentation updates

**Related Documentation:**
- [Session Revocation on Shutdown](SESSION_REVOCATION_ON_SHUTDOWN.md)

---

### 🌐 SSE Network Resilience & Stream Resumption

Implemented comprehensive network resilience for long-running streams and real-time updates.

**Features:**
1. ✅ **Conversation list SSE streaming** - Real-time sidebar updates without polling
2. ✅ **Automatic stream resumption** - Resume from checkpoint after network drops
3. ✅ **Exponential backoff** - 10 retry attempts with 1s → 64s delays
4. ✅ **Stream metadata** - Save checkpoint after each stage for resumption
5. ✅ **Event ID tracking** - Unique IDs for browser event tracking
6. ✅ **Resume endpoint** - `POST /api/conversations/{id}/message/stream/resume`
7. ✅ **UI feedback** - Orange banner shows reconnection status
8. ✅ **Modified timestamps** - Track `created_at` and `modified_at` for change detection

**Events:**
- Conversation list: `initial`, `conversation_created`, `conversation_updated`, `conversation_deleted`, `heartbeat`
- Message streaming: `stream_init`, `resume_init`, stage events, `complete`, `error`

**Files Modified:**
- `backend/routes/conversations.py` - Resume endpoint, conversation list SSE, event IDs
- `backend/storage.py` - Stream metadata functions, modified timestamps
- `frontend/src/api.js` - Reconnection wrapper with exponential backoff
- `frontend/src/App.jsx` - Reconnection UI feedback

**Related Documentation:**
- [SSE Network Resilience](SSE_NETWORK_RESILIENCE.md) - Full technical documentation (15k)

---

### 🔀 Backend Route Refactoring

Modularized backend from monolithic `main.py` to route-based architecture.

**New Structure:**
- `backend/routes/auth.py` - Authentication & waitlist (7 routes)
- `backend/routes/conversations.py` - Conversations & messaging (14 routes)
- `backend/routes/forum.py` - Public conversations (2 routes)
- `backend/routes/profiles.py` - Profile management (5 routes)
- `backend/routes/model_config.py` - Model configuration (2 routes)
- `backend/main.py` - Application startup, middleware, router registration

**New Modules:**
- `backend/models.py` - Pydantic request/response models
- `backend/rate_limiter.py` - Shared slowapi limiter instance
- `backend/utils.py` - Utility functions (markdown export)

**Benefits:**
- Improved code organization and maintainability
- Clearer separation of concerns
- Easier testing and development
- Better scalability for future endpoints

**Related Documentation:**
- [Backend Architecture](BACKEND_ARCHITECTURE.md)

---

### 🔧 Streaming Token Expiry Fix

Fixed critical issue where UI state was lost mid-stream due to token expiration.

**Problem:**
- Access tokens expire after 15 minutes
- Long streams (5-10+ min) could expire mid-stream
- Automatic token refresh during stream lost connection and all partial data
- User saw UI reset to empty state after Stage 1.5

**Solution:**
1. ✅ **Proactive token refresh** - Checks JWT expiry before streaming (< 5 min threshold)
2. ✅ **Direct fetch for streams** - Uses `fetch()` instead of `fetchWithAuth()` to prevent auto-retry during stream
3. ✅ **Refresh token rotation support** - Added `updateRefreshToken()` to store new tokens
4. ✅ **Connection tokens** - Generated per stream for session validation during heartbeats
5. ✅ **Heartbeat with auth checks** - Every 60s checks if user logged out elsewhere
6. ✅ **Auth expiry events** - `auth_expired` event sent to frontend with reason

**Files Modified:**
- `frontend/src/api.js` - Proactive token refresh, JWT decode, streaming fixes
- `frontend/src/auth.js` - Added `updateRefreshToken()` function
- `frontend/src/App.jsx` - Handle `auth_expired` events during streams
- `backend/auth.py` - Added `create_connection_token()` and `verify_connection_token()`
- `backend/main.py` - Connection token generation, heartbeat with session checks

**Related Documentation:**
- [Streaming Token Fix](STREAMING_TOKEN_FIX.md) - Full technical documentation

## 2025-11-26

### 🔒 Security Hardening

Comprehensive security overhaul addressing critical vulnerabilities.

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

**Related Documentation:**
- [Security Implementation](SECURITY_IMPLEMENTATION.md)
- [Security Migration Guide](SECURITY_MIGRATION_GUIDE.md)

---

### Waitlist & Invite System

Production-ready registration with invite tokens, waitlist, and admin CLI tool.

**Features:**
- **Added waitlist system**: Users can join waitlist without invite
- **Invite tokens**: Secure, time-limited (7 days default), single-use
- **Local mode**: Registration open without invite token
- **Production mode**: Invite token required for registration
- **Waitlist flow**: Users submit email → admin generates invite → user registers

**Backend Changes:**
- `backend/config.py`: Added `ADMIN_EMAIL`, `WAITLIST_FILE`, `INVITES_FILE`, `INVITE_TOKEN_EXPIRE_DAYS`
- `backend/storage.py`: Waitlist and invite token management functions
- `backend/auth.py`: Updated `create_user()` to accept and validate invite tokens
- `backend/main.py`: Added `/api/waitlist` and `/api/invite/validate/{token}` endpoints

**CLI Tool:**
- `scripts/generate_invite.py` for admin invite management
  - Generate invite links for specific emails
  - List all invites (with --list flag)
  - List waitlist entries (with --waitlist flag)
  - Tracks usage and expiration

**Frontend Changes:**
- `AuthModal.jsx`: Three modes (login, register, waitlist), invite token validation
- `App.jsx`: URL-based invite token detection (?invite=xxx)
- `api.js`: Updated register() to pass invite_token

**Related Documentation:**
- [Authentication](AUTHENTICATION.md#waitlist--invite-system)

---

### Encrypted Conversation Storage

Fernet encryption for messages at rest, backward compatible with legacy files.

**Features:**
- **Added `backend/encryption.py`**: Encryption provider system with Fernet implementation
- **Modified `backend/storage.py`**: Automatic encryption/decryption of messages at rest
- **Updated `backend/config.py`**: Encryption configuration settings
- **Key generation**: `scripts/generate_encryption_key.py` script for automatic key setup
- **Backward compatible**: Legacy unencrypted conversations load and re-encrypt automatically
- **Test suite**: `test_encryption.py` validates encryption, decryption, and migration

**Security:**
- Messages encrypted with AES-128
- Metadata remains unencrypted for indexing
- Single encryption key per installation in `.env` file
- No key recovery mechanism (by design)

**Architecture:**
- Provider abstraction allows future RSA/hybrid encryption support
- Version field allows migration between encryption schemes

**Related Documentation:**
- [Storage Architecture](STORAGE_ARCHITECTURE.md#encryption-encryptionpy)
- [Encryption Guide](ENCRYPTION_GUIDE.md)
- [Encryption API](ENCRYPTION_API.md)

## 2025-11-24

### 🔄 Stage 1.5 Cross-Interrogation

Added new deliberation stage between initial responses and peer review.

**Feature:**
- Models generate follow-up questions about OTHER models' responses
- Each model answers questions directed at them
- Uncovers assumptions, ambiguities, and overlooked aspects
- Enhances depth of deliberation before final ranking

**Implementation:**
1. ✅ **Question generation phase** - Each model asks 1-2 questions about other responses
2. ✅ **Answer collection phase** - Models answer questions directed at them
3. ✅ **Anonymization maintained** - Uses same "Response A/B/C" labels as Stage 2
4. ✅ **UI components** - Collapsible sections showing questions received, answers provided, original response

**Files Created:**
- `frontend/src/components/Stage1_5.jsx` - UI component for cross-interrogation display
- `frontend/src/components/Stage1_5.css` - Styling for collapsible sections
- `ai_notes/STAGE_1_5_IMPLEMENTATION.md` - Technical documentation

**Files Modified:**
- `backend/council.py` - Added `stage1_5_cross_interrogation()` and `stage1_5_collect_answers()`
- `backend/main.py` - Integrated Stage 1.5 into batch and streaming endpoints
- `backend/storage.py` - Added stage1_5 field to assistant messages
- `frontend/src/App.jsx` - Handle stage1_5 events and state updates

**Related Documentation:**
- [Stage 1.5 Implementation](STAGE_1_5_IMPLEMENTATION.md) - Full technical details

## Earlier Updates (Pre-2025-11-24)

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

## Summary Statistics

**Code Reductions:**
- Event handling: 200 lines → 50 lines (75% reduction)
- Stage rendering: 50 lines → 25 lines (50% reduction)
- Documentation: 1,428 lines → 332 lines (77% reduction in main file)

**Security Improvements:**
- ✅ Encrypted data at rest (users, sessions, invites, messages)
- ✅ JWT secret validation on startup
- ✅ Rate limiting on all auth endpoints
- ✅ Account lockout protection
- ✅ Refresh token rotation (single-use)
- ✅ Profile access control
- ✅ Security headers middleware
- ✅ Comprehensive audit logging

**Network Resilience:**
- ✅ Automatic stream resumption from checkpoints
- ✅ Exponential backoff (10 retries, 1s → 64s)
- ✅ Proactive token refresh before streaming
- ✅ Real-time conversation list updates via SSE
- ✅ Heartbeat with session validation

**Architecture Improvements:**
- ✅ Configuration-driven event handling
- ✅ Modular route-based backend
- ✅ Provider abstraction for encryption
- ✅ Progressive message building
- ✅ Idempotent message handling
