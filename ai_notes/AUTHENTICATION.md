# Authentication & Session Management

Complete implementation details for the authentication system in LLM Council.

## Overview

JWT-based authentication with refresh token rotation, account lockout protection, and comprehensive security features.

## Core Components

### Backend Implementation

#### `auth.py` - Core Authentication Logic

**User Management:**
- `create_user()`: User registration with automatic profile creation (accepts optional invite_token)
- `authenticate_user()`: Email/password authentication **with account lockout protection**
- User storage in `data/users.json` **(encrypted)**

**Token Management:**
- `create_access_token()`: Generate JWT access token (15 min expiry)
- `create_refresh_token_record()`: Generate and store refresh token (7 days, single-use)
- `create_connection_token()`: Generate token for streaming session validation (2hr expiry)
- `verify_access_token()`: Validate JWT token
- `verify_refresh_token()`: Validate refresh token from session store
- `verify_connection_token()`: Validate connection token (for heartbeat checks)

**Session Management:**
- `revoke_refresh_token()`: Single token revocation (logout)
- `revoke_all_user_sessions()`: All sessions revocation for specific user
- `revoke_all_sessions()`: **Revoke all sessions (all users) - called on server shutdown**
- Session storage in `data/sessions.json` **(encrypted)**
- **Automatic session cleanup**: All sessions revoked on server shutdown for security

**Security Functions:**
- `is_account_locked()`: Check if account is locked
- `lock_account()`: Lock account for specified duration
- `record_failed_login()`: Track failed attempts, auto-lock at threshold (10 attempts → 30 min lockout)
- `reset_failed_login_attempts()`: Clear counter on successful login
- `load_users()` / `save_users()`: **Encrypt/decrypt data at rest**
- `load_sessions()` / `save_sessions()`: **Encrypt/decrypt data at rest**

#### `auth_middleware.py` - Request Authentication

**Dependencies:**
- `get_current_user_optional()`: Dependency for optional auth (local mode)
- `get_current_user_required()`: Dependency for required auth
- `get_profile_id_for_request()`: Determine profile based on auth status **with access control**

**Security Functions:**
- `user_has_profile_access()`: Validates profile ownership, prevents horizontal privilege escalation

**Mode Handling:**
- Production mode: Always requires authentication
- Local mode: Authentication optional, falls back to "default" profile
- **Profile access control:** Users can only access their own profiles (based on profile_id ownership)

### Security Infrastructure

#### `startup_validation.py` - Fail-Fast Security Checks
- Runs on server startup before accepting requests
- Validates:
  - JWT_SECRET_KEY set in production mode (fails if missing)
  - ENCRYPTION_KEY set if encrypted files exist
  - File permissions on sensitive data files (warns if world-readable)
- Clear error messages with remediation instructions
- Prevents misconfigured production deployments

#### `security_middleware.py` - Security Headers
Adds comprehensive security headers to all responses:
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `Content-Security-Policy` - Restricts resource loading
- `Strict-Transport-Security` - Forces HTTPS (production only)
- `Referrer-Policy`, `Permissions-Policy`, etc.

#### `audit.py` - Security Event Logging
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
  - **Session revocations** (including server shutdown events)
- Captures: timestamp, event type, user ID/email, IP, user agent, details

#### Rate Limiting (`main.py` via slowapi)
- Login: 5 attempts per 15 minutes per IP
- Register: 3 per hour per IP
- Refresh: 20 per minute per IP
- Waitlist: 1 per hour per IP
- Message stream: 10 per minute per user
- Returns HTTP 429 with Retry-After header

### API Endpoints

#### Authentication Routes (`routes/auth.py`)
- `POST /api/auth/register` - Create account **(rate limited, audit logged, requires invite in prod)**
- `POST /api/auth/login` - Authenticate **(rate limited, audit logged, lockout protected)**
- `POST /api/auth/refresh` - Refresh tokens **(rate limited, audit logged, ROTATES refresh token)**
- `POST /api/auth/logout` - Revoke refresh token **(audit logged)**
- `GET /api/auth/me` - Get current user info

#### Waitlist & Invite Routes
- `POST /api/waitlist` - Join waitlist (email + optional name)
- `GET /api/invite/validate/{token}` - Validate invite token

### Waitlist & Invite System

**Storage Layer (`storage/registration.py`):**
- Waitlist management: `add_to_waitlist()`, `list_waitlist()`, `mark_waitlist_invited()`
- Invite tokens: `create_invite_token()`, `get_invite_token()`, `validate_invite_token()`, `mark_invite_used()`, `list_invite_tokens()`
- Encryption functions: Encrypt/decrypt invite tokens at rest
- Waitlist storage: SQLite `waitlist` table
- Invite storage: SQLite `invites` table **(encrypted)**

**CLI Tool:**
- `scripts/generate_invite.py` for admin invite management
  - Generate invite links for specific emails
  - List all invites (with --list flag)
  - List waitlist entries (with --waitlist flag)
  - Tracks usage and expiration

**Modes:**
- **Local mode**: Registration open without invite token
- **Production mode**: Invite token required for registration
- **Waitlist flow**: Users submit email → admin generates invite → user registers
- **Invite tokens**: Secure, time-limited (7 days default), single-use

## Frontend Implementation

### `auth.js` - Token Management
- `setAuth()`: Store tokens and user data in localStorage
- `getAccessToken()`: Retrieve current access token
- `getRefreshToken()`: Retrieve refresh token
- `getCurrentUser()`: Get stored user data
- `isAuthenticated()`: Check if user is logged in
- `clearAuth()`: Remove all auth data (logout)
- `updateAccessToken()`: Update token after refresh
- `updateRefreshToken()`: Store new refresh token (supports token rotation) ✓

### `api.js` - Enhanced with Authentication
- `fetchWithAuth()`: Wrapper that adds Authorization header
- Automatic token refresh: Catches 401, refreshes token, retries request
- **Proactive token refresh**: Checks JWT expiry before streaming (< 5 min threshold)
- **Streaming-specific handling**: Uses direct fetch() for streams to prevent connection loss
- **Refresh deduplication**: Module-level lock prevents race conditions (see Token Refresh section)
- Auth endpoints: register(), login(), logout(), getCurrentUser()
- Encryption endpoints: getEncryptionStatus(), encryptConversation(), decryptConversation()
- All API methods updated to use fetchWithAuth()

### UI Components

#### `AuthModal.jsx` - Login/Register/Waitlist UI
- Three modes: login, register (with invite), waitlist
- Invite token validation on mount when provided
- Email auto-filled for invite-based registration
- Waitlist submission with success confirmation
- Error display and loading states
- Calls onSuccess callback with auth data

#### `App.jsx` - Auth State Management
- Detects invite token in URL query parameter (?invite=xxx)
- Initializes auth state from localStorage on mount
- handleAuth(): Handles login/register success (passes invite_token)
- handleLogout(): Clears auth and resets app state
- Passes user, onLogin, onLogout to Sidebar

#### `Sidebar.jsx` - Auth UI Display
- Shows "Login / Register" button when not authenticated
- Shows user name and logout button when authenticated
- Styled auth section between header and conversation list

## Security Features

### Refresh Token Rotation
- **Single-use tokens**: Each refresh token can only be used once
- **Automatic rotation**: New refresh token issued with each refresh
- **Prevents replay attacks**: Old tokens immediately invalidated
- **Deduplication**: Module-level lock prevents race conditions from simultaneous API calls

### Account Lockout Protection
- **10 failed attempts**: Account locked for 30 minutes
- **Automatic tracking**: Failed login counter per user
- **Audit logging**: All lockout events logged
- **Reset on success**: Counter cleared on successful login

### Data Encryption at Rest
- **users.json**: Encrypted with Fernet (AES-128-CBC)
- **sessions.json**: Encrypted with Fernet (AES-128-CBC)
- **invites.json**: Encrypted with Fernet (AES-128-CBC)
- **Key management**: ENCRYPTION_KEY in `.env` file

### Session Security
- **Server shutdown**: All sessions revoked automatically
- **Connection tokens**: Validate streaming session ownership (2hr expiry)
- **Heartbeat checks**: Detect logout-elsewhere scenarios during streams
- **Audit trail**: All session operations logged

## Token Refresh Race Condition Fix

### Problem
When selecting a conversation, two API calls happen simultaneously:
- `subscribeToConversationUpdates()` - SSE stream for real-time updates
- `getConversation()` - Fetch conversation details

Both detect 401 (expired token) at the same time, both call `refreshAccessToken()` independently. Second refresh fails because refresh token already used (single-use rotation).

### Solution
Implemented token refresh deduplication in `api.js`:

1. **Refresh lock** - Module-level `refreshPromise` variable tracks in-flight refresh
2. **Deduplication logic** - Second caller waits for existing Promise instead of starting new refresh
3. **Automatic cleanup** - Promise cleared in `finally` block after completion
4. **Single refresh guarantee** - Only one `/api/auth/refresh` call happens, all callers share result

### Impact
- Fixes duplicate refresh calls when switching conversations
- Works across all 4 callsites: `fetchWithAuth()`, proactive pre-stream refresh, stream 401 handling, SSE 401 handling
- No more "token already used" errors from race conditions
- Preserves single-use token rotation security

## Streaming Token Expiry Fix

### Problem
- Access tokens expire after 15 minutes
- Long streams (5-10+ min) could expire mid-stream
- Automatic token refresh during stream lost connection and all partial data
- User saw UI reset to empty state after Stage 1.5

### Solution
1. **Proactive token refresh** - Checks JWT expiry before streaming (< 5 min threshold)
2. **Direct fetch for streams** - Uses `fetch()` instead of `fetchWithAuth()` to prevent auto-retry during stream
3. **Refresh token rotation support** - Added `updateRefreshToken()` to store new tokens
4. **Connection tokens** - Generated per stream for session validation during heartbeats
5. **Heartbeat with auth checks** - Every 60s checks if user logged out elsewhere
6. **Auth expiry events** - `auth_expired` event sent to frontend with reason

## Configuration

### Environment Variables (`backend/config.py`)
- `JWT_SECRET_KEY`: Secret key for JWT signing (auto-generated if not set)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Access token expiration (default: 15)
- `REFRESH_TOKEN_EXPIRE_DAYS`: Refresh token expiration (default: 7)
- `AUTH_ENABLED`: Enable/disable authentication (default: false)
- `ENVIRONMENT`: "local" or "production" mode (default: "local")
- `ADMIN_EMAIL`: Admin email for invite system
- `WAITLIST_FILE`: Path to waitlist JSON file
- `INVITES_FILE`: Path to invites JSON file (encrypted)
- `INVITE_TOKEN_EXPIRE_DAYS`: Invite token expiration (default: 7)

## Related Documentation
- [Security Implementation](SECURITY_IMPLEMENTATION.md) - Full security hardening details
- [Security Migration Guide](SECURITY_MIGRATION_GUIDE.md) - Upgrade instructions
- [Session Management](SESSION_MANAGEMENT.md) - Session management details
- [Session Revocation on Shutdown](SESSION_REVOCATION_ON_SHUTDOWN.md) - Automatic session cleanup
- [Streaming Token Fix](STREAMING_TOKEN_FIX.md) - Mid-stream token expiry solution
