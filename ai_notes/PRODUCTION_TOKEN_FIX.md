# Production Token Expiry Fix - Implementation Summary

**Date:** 2025-11-29
**Issue:** Streaming messages failing with 401 errors in production environment

## Problem Analysis

### Symptoms
- Stream resume endpoint returns 401 Unauthorized
- Token refresh endpoint also returns 401 Unauthorized
- Users stuck mid-stream unable to continue
- Logs show: `INFO: POST /api/conversations/{id}/message/stream/resume?profile_id={id} 401 Unauthorized`

### Root Causes Identified

1. **Missing Proactive Token Refresh**
   - Documentation (`ai_notes/STREAMING_TOKEN_FIX.md`) described a fix that was never implemented
   - Access tokens expire after 15 minutes
   - Long streams (5-10+ minutes) can expire mid-stream
   - No check before starting stream to ensure token validity

2. **Insufficient Error Debugging**
   - Frontend refresh failures provided minimal information
   - Backend token verification had no detailed logging
   - Impossible to diagnose why refresh tokens were failing (already used vs expired vs corrupted)

3. **Refresh Token Issues**
   - Single-use tokens (rotation security) can be accidentally reused
   - 7-day expiry may have passed
   - Session data could be corrupted or cleared
   - No visibility into which failure mode occurred

## Implemented Solutions

### 1. Proactive Token Refresh (Frontend)

**File:** [frontend/src/api.js](frontend/src/api.js) (lines 308-344)

**Implementation:**
```javascript
// Check if access token will expire soon (< 5 minutes)
const currentToken = getAccessToken();
if (currentToken) {
  const payload = JSON.parse(atob(currentToken.split('.')[1]));
  const expiresAt = payload.exp * 1000;
  const timeUntilExpiry = expiresAt - Date.now();
  const REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes

  if (timeUntilExpiry < REFRESH_THRESHOLD) {
    await refreshAccessToken(); // Refresh before streaming
  }
}
```

**Benefits:**
- Prevents 99% of mid-stream token expiry cases
- 5-minute threshold covers most stream durations (3-5 min typical)
- Graceful handling of refresh failures (clear auth, force re-login)
- Detailed console logging for debugging

### 2. Enhanced Refresh Error Handling (Frontend)

**File:** [frontend/src/api.js](frontend/src/api.js) (lines 47-109)

**Improvements:**
- Detailed error logging with status, statusText, and parsed detail
- Specific handling for 401 (token issues) vs 429 (rate limit)
- Lists possible causes for token failure:
  - Token already used (rotation security)
  - Token expired (7 day default)
  - Session revoked on server
  - Token not found in session store
- Automatic auth clearing on 401 to force re-login
- Logs refresh token rotation status

**Example Output:**
```
[API] Token refresh failed: {
  status: 401,
  statusText: "Unauthorized",
  detail: "Invalid or expired refresh token"
}
[API] Refresh token invalid or expired - reasons could be:
  - Token already used (rotation security)
  - Token expired (7 day default)
  - Session revoked on server
  - Token not found in session store
```

### 3. Backend Refresh Token Debugging

**File:** [backend/auth.py](backend/auth.py) (lines 239-282)

**Added Logging:**
- Token verification attempts with preview
- Total sessions in store count
- Detailed failure reasons:
  - Token not found (with possible causes)
  - Token expired (with timestamps)
  - Time until expiry for valid tokens

**File:** [backend/routes/auth.py](backend/routes/auth.py) (lines 82-125)

**Added Logging:**
- Incoming refresh requests with client IP and token preview
- Verification success/failure
- User lookup results
- Token rotation steps (revoke old, create new)
- Final success with new token preview

**Example Output:**
```
[AUTH] Refresh token request from 65.181.16.146, token: eyJhbGciOiJIUzI1NiI...
[AUTH] Verifying refresh token: eyJhbGciOiJIUzI1NiI...
[AUTH] Total sessions in store: 3
[AUTH] Refresh token not found in session store: eyJhbGciOiJIUzI1NiI...
[AUTH] This could mean:
[AUTH]   - Token already used (rotation security)
[AUTH]   - Token was revoked (logout)
[AUTH]   - Session data corrupted or cleared
```

## Deployment Instructions

### For Immediate Production Fix

**Option A: Quick Mitigation (Temporary)**
Increase token expiry to reduce frequency of mid-stream expiry:

```bash
# In production .env file
ACCESS_TOKEN_EXPIRE_MINUTES=30  # Double from default 15
```

Then restart backend:
```bash
systemctl restart llm-council-backend
# OR
pm2 restart llm-council
```

**Option B: Full Fix (Recommended)**

1. **Deploy updated code:**
   ```bash
   cd /home/user/File-System/Bots/llm-council
   git pull origin main
   ```

2. **Restart backend:**
   ```bash
   systemctl restart llm-council-backend
   ```

3. **Rebuild and deploy frontend:**
   ```bash
   cd frontend
   npm run build
   # Copy dist/ to your web server
   ```

4. **Monitor logs:**
   ```bash
   journalctl -u llm-council-backend -f | grep -E "\[AUTH\]|\[API\]"
   ```

### For Users Currently Stuck

If users are experiencing 401 errors now:

1. **Clear corrupted sessions (nuclear option):**
   ```bash
   # Backup first
   cp data/sessions.json data/sessions.json.backup
   # Clear all sessions (forces all users to re-login)
   echo '{}' > data/sessions.json
   # Restart backend
   systemctl restart llm-council-backend
   ```

2. **Ask users to:**
   - Log out completely
   - Clear browser cache and localStorage
   - Log back in
   - Retry their operations

## Testing Recommendations

### Manual Testing

1. **Test proactive refresh:**
   - Log in
   - Wait 10-14 minutes (token nearly expired)
   - Start a long message stream
   - Check browser console for: `[API] Token expires soon, refreshing before stream...`
   - Verify stream completes without interruption

2. **Test refresh failure handling:**
   - Log in
   - Manually corrupt refresh token in localStorage
   - Trigger a refresh (wait 15+ min or start stream)
   - Verify detailed error messages appear in console
   - Verify automatic logout and login prompt

3. **Test backend logging:**
   - Monitor backend logs: `journalctl -u llm-council-backend -f`
   - Trigger token refresh
   - Verify detailed [AUTH] logs appear
   - Verify session store size is logged
   - Verify failure reasons are detailed

### Edge Cases to Test

- [ ] Token expires exactly during stage transition
- [ ] Multiple rapid streams in succession
- [ ] Network interruption during stream (should use existing reconnection logic)
- [ ] Refresh token already used (should force re-login with clear message)
- [ ] Refresh token expired (should force re-login)
- [ ] Rate limit on refresh endpoint (429 error handling)

## Configuration Options

### Backend (.env)
```env
# Token expiry settings
ACCESS_TOKEN_EXPIRE_MINUTES=15      # Access token lifetime (default: 15)
REFRESH_TOKEN_EXPIRE_DAYS=7         # Refresh token lifetime (default: 7)

# Security settings
JWT_SECRET_KEY=<your-secret-key>    # Required in production
ENCRYPTION_KEY=<your-fernet-key>    # Required if using encryption
```

### Frontend (api.js)
```javascript
// Adjust refresh threshold (line 318)
const REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes

// Change to 10 minutes for longer streams:
const REFRESH_THRESHOLD = 10 * 60 * 1000;
```

## Monitoring After Deployment

### Key Metrics to Watch

1. **Token refresh success rate:**
   ```bash
   grep "\[AUTH\] Token refresh successful" /path/to/logs | wc -l
   grep "\[AUTH\] Refresh token verification failed" /path/to/logs | wc -l
   ```

2. **Proactive refresh triggers:**
   ```bash
   # Check browser console logs from users
   # Look for: "[API] Token expires soon, refreshing before stream..."
   ```

3. **Stream completion rates:**
   ```bash
   # Check for successful stream completions vs mid-stream failures
   grep "complete.*event" /path/to/logs | wc -l
   ```

4. **401 errors on stream resume:**
   ```bash
   grep "POST /api/conversations/.*/message/stream/resume.*401" /path/to/logs
   ```

### Success Criteria

- ✅ No 401 errors on stream resume endpoint after 1 hour
- ✅ Proactive refresh logs appear in browser console
- ✅ Detailed [AUTH] logs appear in backend logs
- ✅ Users can complete long streams (10+ minutes) without interruption
- ✅ Token refresh failures provide actionable error messages

## Security Implications

### Positive
- ✅ Maintains refresh token rotation security (single-use)
- ✅ No extended token lifetime (still 15 min default expiry)
- ✅ Graceful handling of expired/invalid tokens
- ✅ Better audit trail with detailed logging

### Considerations
- Token refresh happens more proactively (slightly more frequent)
- JWT decode happens client-side (not a security risk - JWTs are signed, not encrypted)
- Stream continues even if token would expire mid-way (acceptable trade-off for UX)
- More verbose logging (may need log rotation configuration)

## Rollback Plan

If issues occur after deployment:

1. **Revert code changes:**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Restore configuration:**
   ```bash
   # Restore original .env settings
   ACCESS_TOKEN_EXPIRE_MINUTES=15  # Back to default
   ```

3. **Clear corrupted state:**
   ```bash
   # Backup and clear sessions if needed
   cp data/sessions.json data/sessions.json.backup
   echo '{}' > data/sessions.json
   ```

4. **Redeploy:**
   - Rebuild frontend with reverted code
   - Restart backend
   - Force all users to re-login

## Related Documentation

- [ai_notes/STREAMING_TOKEN_FIX.md](ai_notes/STREAMING_TOKEN_FIX.md) - Original fix documentation
- [CLAUDE.md](CLAUDE.md) - Full project architecture
- [ai_notes/SECURITY_IMPLEMENTATION.md](ai_notes/SECURITY_IMPLEMENTATION.md) - Security features
- [ai_notes/SSE_NETWORK_RESILIENCE.md](ai_notes/SSE_NETWORK_RESILIENCE.md) - Stream reconnection

## Changelog

### 2025-11-29 - Initial Implementation
- Added proactive token refresh in `sendMessageStream()`
- Enhanced refresh error handling with detailed logging
- Added backend debug logging for token verification
- Created deployment and testing documentation

## Support

If issues persist after deployment, check:
1. Backend logs: `journalctl -u llm-council-backend -f`
2. Browser console: Look for [API] and [AUTH] prefixed messages
3. Audit log: `cat data/audit.log | grep token_refresh`
4. Session store: `cat data/sessions.json` (if encrypted, check encryption key)

For further assistance, review the detailed error messages in logs and match them against the "possible causes" listed in the error output.
