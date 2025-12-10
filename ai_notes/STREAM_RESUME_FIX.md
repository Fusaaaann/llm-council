# Stream Resume Bug Fixes - 403 Error & Duplicate Messages

**Date:** 2025-11-29
**Issues:** Stream resume returning 403 errors + automatic retries sending duplicate messages

## Problems Identified

### 1. 403 Error on Stream Resume

**Symptom:**
```
Token validation failed: 403: Connection token does not belong to current user
```

**Root Cause:**
- Backend resume endpoint ([backend/routes/conversations.py:626](backend/routes/conversations.py#L626)) was checking `token_data.get("user_id")`
- But JWT connection tokens use standard `"sub"` claim for user_id (not `"user_id"`)
- This caused legitimate resume attempts to fail with 403 Forbidden

**Code Location:**
```python
# WRONG (line 626 - before fix):
if user and token_data.get("user_id") != user["id"]:

# CORRECT (line 627 - after fix):
token_user_id = token_data.get("sub")  # JWT standard claim
if user and token_user_id != user["id"]:
```

### 2. Duplicate Messages on Retry

**Symptom:**
- When stream interrupted, automatic retry sends a NEW user message
- Results in duplicate conversations and wasted API calls
- Users see the same question appear twice in conversation history

**Root Cause:**
- Frontend retry logic called `attemptStream(retryAttempt + 1)` after resume failure
- `attemptStream()` always sends the original message via POST to `/message/stream`
- No distinction between "first attempt" and "retry attempt"
- Resume endpoint was never actually used during retries

**Code Flow (Before Fix):**
```
1. User sends message → POST /message/stream (attempt 1)
2. Network error during stream
3. Retry logic triggered
4. Calls attemptStream(1) → POST /message/stream AGAIN (attempt 2) ❌
5. Another duplicate message sent
```

## Implemented Solutions

### 1. Fixed JWT Claim Usage (Backend)

**File:** [backend/routes/conversations.py](backend/routes/conversations.py) (lines 615-641)

**Changes:**
- Changed `token_data.get("user_id")` to `token_data.get("sub")`
- Added logging for user mismatch debugging
- Improved error handling to distinguish HTTP exceptions from validation errors

**Code:**
```python
# Verify user ownership if authenticated
# Note: JWT uses "sub" claim for user_id, not "user_id"
token_user_id = token_data.get("sub")
if user and token_user_id != user["id"]:
    logger.warning(f"[RESUME] User mismatch: token has user_id={token_user_id}, current user={user['id']}")
    raise HTTPException(status_code=403, detail="Connection token does not belong to current user")
```

### 2. Fixed Retry Logic to Use Resume (Frontend)

**File:** [frontend/src/api.js](frontend/src/api.js) (lines 374-501)

**Changes:**
1. Added `isResumeAttempt` parameter to `attemptStream()` function
2. On first failure, subsequent retries use resume endpoint (NOT new message send)
3. Resume errors (403/404) fail permanently with clear user message
4. Network errors continue exponential backoff with resume attempts

**Code Flow (After Fix):**
```
1. User sends message → POST /message/stream (attempt 1)
2. Network error during stream
3. Retry logic triggered with isResumeAttempt=true
4. Calls attemptStream(1, true) → POST /message/stream/resume (attempt 2) ✓
5. Resumes from last checkpoint, no duplicate message
```

**Implementation:**
```javascript
const attemptStream = async (retryAttempt = 0, isResumeAttempt = false) => {
  try {
    // If this is a resume attempt, use resume endpoint
    if (isResumeAttempt && streamContext.connectionToken) {
      console.log('[API] Attempting resume from checkpoint');
      try {
        await this.resumeMessageStream(conversationId, streamContext.connectionToken, signal, wrappedOnEvent);
        return; // Success
      } catch (resumeError) {
        // Handle 403/404 as permanent failures
        if (resumeError.message.includes('403') || resumeError.message.includes('404')) {
          onEvent('error', { message: 'Stream cannot be resumed. Please reload the page.', recoverable: false });
          throw resumeError;
        }
        throw resumeError; // Retry other errors
      }
    }

    // First attempt: send new message
    let response = await fetch(...);
    // ... rest of streaming logic
  } catch (error) {
    // ... exponential backoff logic
    // Retry with resume
    return attemptStream(retryAttempt + 1, true); // isResumeAttempt = true
  }
};
```

## Testing Validation

### Manual Test Cases

1. **Test 403 fix:**
   - Start a long stream (10+ sec)
   - Disconnect network mid-stream
   - Reconnect network
   - Verify stream resumes without 403 error
   - Check backend logs for: `[RESUME]` messages (should show successful validation)

2. **Test no duplicate messages:**
   - Start a stream
   - Disconnect network after stage1
   - Reconnect
   - Verify only ONE user message exists in conversation
   - Verify resume continues from checkpoint (doesn't restart)

3. **Test permanent failure handling:**
   - Start a stream
   - Clear stream metadata manually (simulate expired/lost state)
   - Trigger reconnection
   - Verify user sees: "Stream cannot be resumed. Please reload the page."
   - Verify NO duplicate messages sent

### Expected Log Output

**Successful Resume (Backend):**
```
[RESUME] Verifying connection token for conversation: abc-123
[RESUME] Token validated, user_id: user_xyz matches current user
[RESUME] Resuming from stage: stage1, remaining: ["stage1_5", "stage2", "stage3"]
```

**Successful Resume (Frontend):**
```
[API] Stream error, retrying in 1000ms (attempt 1/10)
[API] Retrying with resume (attempt 1/10)
[API] Attempting resume from checkpoint
[API] Stream resumed from stage: stage1
```

**Failed Resume (403):**
```
[API] Attempting resume from checkpoint
[API] Resume failed: Error: Failed to resume stream: 403 Forbidden
[API] Stream metadata lost or token invalid, cannot resume.
```

## Deployment Instructions

### Backend Deployment

1. **Update code:**
   ```bash
   cd /home/user/File-System/Bots/llm-council
   git pull origin main
   ```

2. **Restart backend:**
   ```bash
   systemctl restart llm-council-backend
   # OR
   pm2 restart llm-council
   ```

3. **Monitor logs:**
   ```bash
   journalctl -u llm-council-backend -f | grep -E "\[RESUME\]|\[AUTH\]"
   ```

### Frontend Deployment

1. **Rebuild:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy:**
   - Copy `dist/` directory to web server
   - Ensure `VITE_API_BASE_URL` is set correctly

3. **Clear browser cache:**
   - Users should hard-refresh (Ctrl+Shift+R) to get new code
   - Or increment version number to force cache bust

## Impact Analysis

### Before Fix
- ❌ Resume attempts failed with 403 error
- ❌ Every network drop sent duplicate user message
- ❌ Wasted API credits on duplicate processing
- ❌ Conversations cluttered with repeated questions
- ❌ Poor user experience with unexplained errors

### After Fix
- ✅ Resume works correctly with proper JWT claim validation
- ✅ Network drops resume from checkpoint (no duplicates)
- ✅ API credits preserved (no redundant processing)
- ✅ Clean conversation history
- ✅ Clear error messages for unrecoverable failures
- ✅ Detailed logging for debugging

## Security Considerations

### JWT Standard Compliance
- Using `"sub"` claim is JWT standard (RFC 7519)
- More compatible with third-party JWT libraries
- Consistent with access token format

### Connection Token Validation
- Still validates:
  - Token signature (prevents tampering)
  - Token expiry (30 min)
  - Conversation ownership
  - User ownership (now correctly)
  - Token matches stored metadata

### No Security Regressions
- All original security checks remain
- Only fixed incorrect claim name lookup
- Added more detailed logging for auditing

## Related Issues & Future Improvements

### Related Fixes
- See [PRODUCTION_TOKEN_FIX.md](PRODUCTION_TOKEN_FIX.md) for token expiry fixes
- See [ai_notes/SSE_NETWORK_RESILIENCE.md](ai_notes/SSE_NETWORK_RESILIENCE.md) for resume architecture

### Future Improvements
- [ ] Add resume attempt counter to UI (show "Resuming... attempt 3/10")
- [ ] Implement checksum validation for resumed data
- [ ] Add metrics: resume success rate, duplicate message detection
- [ ] Client-side deduplication: detect if message already exists before sending

## Rollback Plan

If issues occur:

1. **Revert backend:**
   ```bash
   git revert <commit-hash>
   systemctl restart llm-council-backend
   ```

2. **Revert frontend:**
   - Deploy previous `dist/` build
   - OR rebuild from previous commit

3. **Workaround for users:**
   - If stream fails, reload page (don't wait for auto-resume)
   - Manual retry instead of relying on automatic reconnection

## Monitoring After Deployment

### Success Metrics
- **Resume success rate**: Should be >90% for network drops
- **403 errors**: Should drop to near-zero
- **Duplicate messages**: Should be zero
- **User complaints**: Should decrease about interrupted streams

### Commands to Monitor
```bash
# Count successful resumes
grep "\[RESUME\] Resuming from stage" /path/to/logs | wc -l

# Count 403 errors on resume
grep "POST /api/conversations/.*/message/stream/resume.*403" /path/to/logs | wc -l

# Check for duplicate user messages (manual DB query)
# Look for consecutive user messages without assistant response

# Monitor frontend errors
# Check browser console for: "Stream cannot be resumed"
```

## Support

For issues after deployment:

1. **Check logs:**
   - Backend: `journalctl -u llm-council-backend -f | grep RESUME`
   - Browser: Console should show `[API] Attempting resume from checkpoint`

2. **Verify connection token:**
   - Should be present in `stream_init` event
   - Should match format: JWT token (3 parts separated by dots)

3. **Check stream metadata:**
   - File: `data/conversations/profile_<id>/<conversation_id>.json`
   - Should contain `stream_metadata` object with `connection_token`

4. **Common failure reasons:**
   - Connection token expired (30 min)
   - Stream metadata cleared (2hr expiry or manual deletion)
   - User logged out in another tab
   - Backend restarted (clears in-memory state)

## Changelog

### 2025-11-29 - Initial Fix
- Fixed JWT claim usage: `user_id` → `sub`
- Fixed retry logic to use resume endpoint
- Added permanent failure handling for 403/404
- Added detailed logging for debugging
- Prevented duplicate message sends on retry

---

**Related Documentation:**
- [PRODUCTION_TOKEN_FIX.md](PRODUCTION_TOKEN_FIX.md) - Token expiry fixes
- [ai_notes/SSE_NETWORK_RESILIENCE.md](ai_notes/SSE_NETWORK_RESILIENCE.md) - Full resume architecture
- [CLAUDE.md](CLAUDE.md) - Project architecture
