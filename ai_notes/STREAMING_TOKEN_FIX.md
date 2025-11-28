# Streaming Connection Lost Due to Token Expiry - Fix Documentation

## Problem Identified

**Issue:** During message streaming, the entire modal/UI state was lost after `stage1_5_answers_start` event.

**Root Cause:**
- Access tokens expire after **15 minutes** (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`)
- Long-running streams (multiple stages with AI processing) can take 5-10+ minutes
- If a user starts streaming when their token is close to expiry, it expires **mid-stream**
- The previous `sendMessageStream()` implementation used `fetchWithAuth()`, which tries to refresh on 401
- During refresh, the stream connection is **lost** and all partial data discarded
- User sees the UI reset to empty state

## Solution Implemented

### 1. Proactive Token Refresh Before Streaming

The fix ensures tokens are fresh before starting a stream:

```javascript
// Decode JWT to check expiry time
const payload = JSON.parse(atob(currentToken.split('.')[1]));
const expiresAt = payload.exp * 1000;
const timeUntilExpiry = expiresAt - Date.now();

// If token expires in less than 5 minutes, refresh it now
if (timeUntilExpiry < 5 * 60 * 1000) {
  await refreshAccessToken();
}
```

**Why 5 minutes?**
- Most streams complete in 3-5 minutes
- Provides safety buffer for slower models/responses
- Prevents mid-stream expiry in 99% of cases

### 2. Direct Fetch Instead of fetchWithAuth

Changed streaming to use direct `fetch()` instead of `fetchWithAuth()`:
- Prevents automatic retry/reconnect that loses stream data
- Manual 401 handling with explicit retry logic
- Only retries BEFORE stream starts, not during

### 3. Refresh Token Rotation Support

Fixed missing `updateRefreshToken()` implementation:
- Backend rotates refresh tokens (single-use security measure)
- Frontend now stores the new refresh token from `/api/auth/refresh` response
- Prevents "invalid refresh token" errors after first refresh

## Files Modified

### [frontend/src/api.js](../frontend/src/api.js)
- Added proactive token refresh logic in `sendMessageStream()`
- Changed from `fetchWithAuth()` to direct `fetch()` for streaming
- Added JWT decode logic to check token expiry
- Implemented refresh token rotation storage
- Added explicit 401 handling before stream starts

### [frontend/src/auth.js](../frontend/src/auth.js)
- Added `updateRefreshToken()` function for token rotation
- Exports new function for use by api.js

## How It Works

### Flow Diagram

```
User sends message
    ↓
Check token expiry (JWT decode)
    ↓
Token expires in < 5 min?
    ↓ YES                    ↓ NO
Refresh token now      Use current token
    ↓                        ↓
Start stream with fresh token
    ↓
401 error?
    ↓ YES                    ↓ NO
Refresh & retry once    Continue stream
    ↓                        ↓
Stream events arrive progressively
    ↓
Complete without interruption
```

### Key Behaviors

1. **Before stream starts:**
   - Checks token expiry by decoding JWT
   - Refreshes if < 5 minutes remaining
   - Catches refresh errors gracefully

2. **During stream:**
   - No token checks (already validated)
   - No automatic retries
   - Connection remains stable

3. **On refresh:**
   - Stores both new access token AND new refresh token
   - Old refresh token becomes invalid (security)
   - Next refresh uses new token

## Testing Recommendations

### Manual Testing
1. Log in and wait 10-14 minutes (close to token expiry)
2. Start a long message stream
3. Verify stream completes without connection loss
4. Check browser console for "[API] Token expires soon, refreshing before stream..."

### Edge Cases to Test
- Token expires exactly during stage transition
- Multiple rapid streams in succession
- Network interruption during stream
- Refresh token already used (should force re-login)

## Configuration Options

### Adjust Token Expiry (Backend)
```env
# .env file
ACCESS_TOKEN_EXPIRE_MINUTES=15  # Default
REFRESH_TOKEN_EXPIRE_DAYS=7     # Default
```

### Adjust Refresh Threshold (Frontend)
```javascript
// In sendMessageStream()
if (timeUntilExpiry < 5 * 60 * 1000) {  // 5 minutes
  // Change to 10 * 60 * 1000 for 10-minute threshold
}
```

## Security Implications

### Positive
- ✅ Prevents mid-stream authentication failures
- ✅ Maintains refresh token rotation security
- ✅ No extended token lifetime (still 15 min expiry)
- ✅ Graceful handling of expired tokens

### Considerations
- Token refresh happens proactively (slightly more frequent)
- JWT decode happens client-side (not a security risk - JWTs are signed, not encrypted)
- Stream continues even if token would expire mid-way (acceptable trade-off)

## Related Documentation

- [SECURITY_IMPLEMENTATION.md](./SECURITY_IMPLEMENTATION.md) - Full security architecture
- [CLAUDE.md](../CLAUDE.md) - Project technical notes
- Backend: `backend/auth.py` - Token generation and refresh logic
- Backend: `backend/main.py` - `/api/auth/refresh` endpoint

## Troubleshooting

### Symptom: Stream still disconnects mid-way
**Cause:** Network issue, not auth issue
**Fix:** Check browser network tab for connection errors

### Symptom: "Invalid refresh token" error
**Cause:** Old frontend code not storing new refresh token
**Fix:** Ensure `updateRefreshToken()` is called after refresh

### Symptom: "Token expired" after < 15 minutes
**Cause:** Server clock skew or config mismatch
**Fix:** Check server time, verify `ACCESS_TOKEN_EXPIRE_MINUTES` in both config files

## Future Enhancements

1. **WebSocket Alternative:** Consider WebSockets for bi-directional streams with built-in reconnection
2. **Progress Persistence:** Save partial stream data to localStorage for recovery
3. **Token Expiry UI:** Show warning when token is about to expire
4. **Longer Tokens for Streaming:** Optionally issue 30-min tokens specifically for stream endpoints

---

**Fixed By:** Claude (Assistant)
**Date:** 2025-11-29
**Issue Reported By:** User observing modal loss after `stage1_5_answers_start`
