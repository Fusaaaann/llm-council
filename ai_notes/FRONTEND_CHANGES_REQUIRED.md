# Frontend Changes Required - Security Update

## 🚨 CRITICAL: Token Rotation Change

The backend now implements **refresh token rotation** for enhanced security. This requires a frontend update.

### What Changed

**Old behavior:**
- Refresh endpoint returned only `access_token`
- Refresh token remained the same (reusable)

**New behavior:**
- Refresh endpoint returns `access_token` AND `refresh_token`
- Old refresh token immediately revoked (one-time use)
- Must store new refresh token from response

### Code Changes Required

#### File: `frontend/src/api.js`

**Find this function:**
```javascript
export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  const data = await response.json();
  updateAccessToken(data.access_token);  // ❌ INCOMPLETE

  return data.access_token;
}
```

**Change to:**
```javascript
export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  if (!response.ok) {
    // Clear auth on refresh failure (likely expired)
    clearAuth();
    throw new Error('Token refresh failed');
  }

  const data = await response.json();

  // ✅ CRITICAL: Update BOTH tokens
  updateAccessToken(data.access_token);
  updateRefreshToken(data.refresh_token);  // ⚠️ NEW LINE REQUIRED

  return data.access_token;
}
```

#### File: `frontend/src/auth.js`

**Add this function if it doesn't exist:**
```javascript
export function updateRefreshToken(newRefreshToken) {
  const currentAuth = JSON.parse(localStorage.getItem('auth') || '{}');
  currentAuth.refreshToken = newRefreshToken;
  localStorage.setItem('auth', JSON.stringify(currentAuth));
}
```

**Or if using single `setAuth()` function, update it to:**
```javascript
export function setAuth(authData) {
  localStorage.setItem('auth', JSON.stringify({
    accessToken: authData.accessToken,
    refreshToken: authData.refreshToken,  // Make sure this is stored
    user: authData.user
  }));
}
```

---

## 🔄 Other Backend Changes (No Frontend Changes Needed)

These are informational - no frontend code changes required:

### 1. Rate Limiting Active

**New rate limits:**
- Login: 5 attempts per 15 minutes per IP
- Register: 3 per hour per IP
- Refresh: 20 per minute per IP
- Waitlist: 1 per hour per IP
- Message stream: 10 per minute per user

**Frontend impact:**
- Users may see HTTP 429 errors if limits exceeded
- Backend returns `Retry-After` header
- **Consider adding:** User-friendly error message for rate limits

**Example error handling:**
```javascript
try {
  await login(email, password);
} catch (error) {
  if (error.response?.status === 429) {
    const retryAfter = error.response.headers['retry-after'];
    showError(`Too many attempts. Please try again in ${retryAfter} seconds.`);
  }
}
```

### 2. Account Lockout Protection

**New behavior:**
- Accounts locked after 10 failed login attempts
- Lockout duration: 30 minutes
- Returns HTTP 403 (not 401) when locked

**Frontend impact:**
- May see HTTP 403 responses from `/api/auth/login`
- Error message includes `locked_until` timestamp

**Recommended error handling:**
```javascript
try {
  await login(email, password);
} catch (error) {
  if (error.response?.status === 403) {
    // Account locked
    const message = error.response.data.detail;
    showError(message);  // Shows "Account locked until..."
  } else if (error.response?.status === 401) {
    // Invalid credentials
    showError('Invalid email or password');
  }
}
```

### 3. Security Headers

**New headers added automatically:**
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- More...

**Frontend impact:**
- May affect inline scripts (CSP restrictions)
- May affect iframe embedding (X-Frame-Options)
- **Test thoroughly after update**

**If you get CSP errors:**
Check browser console for CSP violation messages. May need to adjust backend CSP policy in `backend/security_middleware.py`.

### 4. Audit Logging

**New feature:**
- All auth events logged to backend `data/audit.log`
- Includes IP addresses and user agents

**Frontend impact:**
- None (purely backend feature)

---

## 🧪 Testing Checklist

After making frontend changes, test:

### Token Refresh Flow
- [ ] Login successfully
- [ ] Wait for access token to expire (15 min default)
- [ ] Make an API call → should auto-refresh
- [ ] Verify new refresh token stored in localStorage
- [ ] Make another API call → should use new refresh token
- [ ] Old refresh token should NOT work (test manually if possible)

### Login Flow
- [ ] Valid credentials → login success
- [ ] Invalid credentials → error message
- [ ] 10 failed attempts → account locked message (HTTP 403)

### Rate Limiting
- [ ] 6 login attempts in 15 min → HTTP 429 error
- [ ] Error message shows retry time

### Logout Flow
- [ ] Logout → tokens cleared
- [ ] Cannot use old tokens after logout

---

## 📋 Migration Impact

### Users Currently Logged In
- **First token refresh after upgrade:**
  - Old refresh token used → new tokens returned
  - If frontend not updated: new refresh token NOT stored
  - Next refresh attempt: FAILS (old token revoked)
  - User forced to re-login

**Recommendation:**
- Deploy frontend update FIRST (or simultaneously with backend)
- Or: Force all users to re-login (clear localStorage)

### Testing Environment
- Clear localStorage completely before testing
- Fresh login after frontend update
- Test complete token refresh cycle

---

## 🚀 Deployment Recommendation

### Option A: Simultaneous Deployment (Best)
1. Deploy frontend with token rotation fix
2. Deploy backend with new security features
3. No user disruption

### Option B: Force Re-login (Simpler)
1. Deploy backend
2. Add logout redirect on app load (clear stale tokens)
3. Deploy frontend update
4. Users re-login once

**Example force logout:**
```javascript
// In App.jsx or main component
useEffect(() => {
  const version = localStorage.getItem('app_version');
  if (version !== '2.0') {  // Increment on breaking changes
    clearAuth();  // Force logout
    localStorage.setItem('app_version', '2.0');
  }
}, []);
```

---

## 💡 Quick Fix Script

If you want a quick automated fix:

```javascript
// frontend/src/api.js

// Find and replace this pattern:
// OLD:
const data = await response.json();
updateAccessToken(data.access_token);

// NEW:
const data = await response.json();
updateAccessToken(data.access_token);
if (data.refresh_token) {  // Check if refresh token in response
  updateRefreshToken(data.refresh_token);
}
```

---

## 🆘 Help & Support

**If refresh stops working after update:**

1. Check browser console for errors
2. Check Network tab → `/api/auth/refresh` response
3. Verify response includes both `access_token` AND `refresh_token`
4. Verify `updateRefreshToken()` is called
5. Check localStorage → verify new refresh token stored

**Common mistake:**
Forgetting to call `updateRefreshToken()` after successful refresh.

---

## 📞 Questions?

If you have questions about these changes:

1. Review [SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md) for architecture details
2. Check backend endpoint: `POST /api/auth/refresh` now returns:
   ```json
   {
     "access_token": "...",
     "refresh_token": "...",  // <-- NEW
     "token_type": "bearer"
   }
   ```

---

**Priority:** 🔴 HIGH - Breaking change, requires immediate attention
**Estimated Time:** 15-30 minutes
**Testing Time:** 15-20 minutes
