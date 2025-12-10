# Session Revocation on Server Shutdown

## Overview

Implemented automatic revocation of all login sessions when the backend server shuts down. This is a security best practice that ensures no stale sessions remain active after server restarts.

## Changes Made

### 1. New Function in `backend/auth.py`

Added `revoke_all_sessions()` function:

```python
def revoke_all_sessions():
    """
    Revoke all active sessions (all users).
    Typically called on server shutdown for security.
    """
    ensure_auth_files()
    save_sessions({})
```

**Purpose:**
- Clears all refresh tokens from the session store
- Prevents stale sessions after server restart
- Forces users to re-authenticate on next access

### 2. Lifespan Handler in `backend/main.py`

Migrated from deprecated `@app.on_event` decorators to modern `lifespan` context manager:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown."""
    # Startup: Run security validation
    try:
        run_startup_validation()
    except SecurityValidationError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)

    yield

    # Shutdown: Revoke all sessions for security
    from .auth import revoke_all_sessions
    from .audit import log_session_revocation
    revoke_all_sessions()
    log_session_revocation("server_shutdown")
    print("All sessions revoked on shutdown", file=sys.stderr)
```

**Benefits of lifespan handler:**
- Modern FastAPI best practice (replaces deprecated `on_event`)
- Single function for startup/shutdown logic
- Better resource management via context manager pattern

### 3. Audit Logging in `backend/audit.py`

Added session revocation logging:

```python
def log_session_revocation(reason: str, details: Optional[Dict[str, Any]] = None):
    """Log session revocation event."""
    log_event(
        "session_revocation",
        "success",
        details={"reason": reason, **(details or {})}
    )
```

**Audit log entry format:**
```json
{
  "timestamp": "2025-11-29T12:34:56Z",
  "event_type": "session_revocation",
  "result": "success",
  "user_id": null,
  "email": null,
  "ip_address": null,
  "user_agent": null,
  "details": {"reason": "server_shutdown"}
}
```

## Security Implications

### Positive Effects

1. **Prevents Session Hijacking After Restart**
   - Old sessions don't persist across server restarts
   - Reduces attack window for stolen tokens

2. **Clean State on Restart**
   - No stale or orphaned sessions
   - Session store is reset to empty state

3. **Audit Trail**
   - All session revocations logged with timestamp
   - Can track server restart events via audit log

### User Experience Impact

**After server restart, users will need to:**
1. Refresh their browser page
2. Frontend detects 401 Unauthorized
3. Attempts token refresh → fails (token revoked)
4. Shows login modal automatically
5. User logs in again

**Mitigations:**
- Clear error messages in frontend
- Automatic redirect to login
- Session persistence only within server uptime

## Testing

### Manual Test

1. Start server:
   ```bash
   python -m backend.main
   ```

2. Login via frontend (creates session)

3. Stop server (Ctrl+C)

4. Check `data/audit.log`:
   ```bash
   tail -1 data/audit.log
   ```
   Should show session_revocation event

5. Check `data/sessions.json`:
   ```bash
   cat data/sessions.json
   ```
   Should be empty: `{}`

6. Restart server and try to refresh token:
   - Should fail with invalid token error

### Automated Test

Test script created at `test_shutdown.py`:

```bash
python test_shutdown.py
```

Expected output:
```
Creating test session...
Sessions before revocation: 1
Calling revoke_all_sessions()...
Sessions after revocation: 0
✓ Session revocation works correctly
```

## Related Security Features

This complements existing security measures:

1. **Token Rotation** - One-time use refresh tokens
2. **Token Expiry** - 15min access, 7day refresh tokens
3. **Account Lockout** - 10 failed attempts → 30min lockout
4. **Rate Limiting** - Prevent brute force attacks
5. **Audit Logging** - All auth events tracked

## Production Considerations

### Docker/Container Deployments

Sessions will be revoked on:
- Container restart
- Container shutdown
- Pod eviction (Kubernetes)
- Rolling updates

**Recommendation:**
- Warn users before planned maintenance
- Implement graceful shutdown with notification

### High-Availability Setups

For multiple backend instances:
- Each instance has its own session store (file-based)
- Solution: Migrate to shared session store (Redis, database)
- Future enhancement: Centralized session management

### Monitoring

Add monitoring for:
- Session revocation events in audit log
- Spike in failed token refreshes after restart
- User complaints about forced logouts

## Future Enhancements

1. **Graceful Shutdown**
   - Send SSE event to active clients warning of shutdown
   - Allow 30-second grace period for finishing streams

2. **Session Store Migration**
   - Move from file-based to Redis/database
   - Enables session persistence across restarts
   - Better for HA/load-balanced deployments

3. **Selective Revocation**
   - Config option: `REVOKE_SESSIONS_ON_SHUTDOWN` (default: true)
   - Development mode: Keep sessions across restarts
   - Production mode: Always revoke for security

4. **Session Statistics**
   - Log number of sessions revoked
   - Track affected users
   - Notify admins of mass revocations

## Documentation Updates

Update CLAUDE.md to document:
- Session revocation on shutdown
- User experience implications
- Testing procedures
- Production considerations
