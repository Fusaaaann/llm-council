# Security Migration Guide

This guide helps you upgrade existing LLM Council installations to the new security-hardened version.

## ⚠️ Breaking Changes

### 1. Refresh Token Rotation

**What changed:** Refresh tokens are now single-use and rotated on every refresh.

**Frontend update required:**

**Before (old code):**
```javascript
// frontend/src/api.js - refreshAccessToken()
const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refresh_token: getRefreshToken() })
});
const data = await response.json();
updateAccessToken(data.access_token);  // Only updated access token
```

**After (new code required):**
```javascript
// frontend/src/api.js - refreshAccessToken()
const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refresh_token: getRefreshToken() })
});
const data = await response.json();
updateAccessToken(data.access_token);
// NEW: Must also update stored refresh token
setAuth({
  accessToken: data.access_token,
  refreshToken: data.refresh_token,  // ⚠️ CRITICAL: Store new refresh token
  user: getCurrentUser()
});
```

**Migration impact:**
- Existing sessions will break on first refresh (users must re-login)
- This is a one-time disruption for enhanced security

---

## 🔄 Migration Steps

### Step 1: Backup Existing Data

```bash
# Backup all data files (CRITICAL!)
cp -r data/ data_backup_$(date +%Y%m%d)/

# Backup .env file
cp .env .env.backup
```

### Step 2: Update Dependencies

```bash
# Install new dependency
uv sync  # or: pip install slowapi>=0.1.9
```

### Step 3: Configure Environment Variables

Add to your `.env` file:

```bash
# JWT Secret (REQUIRED for production)
# Generate with: python -c 'import secrets; print(secrets.token_urlsafe(32))'
JWT_SECRET_KEY=<paste_generated_value_here>

# Account Security Settings (optional, defaults shown)
ACCOUNT_LOCKOUT_THRESHOLD=10
ACCOUNT_LOCKOUT_DURATION_MINUTES=30
```

**If not already set:**
```bash
# Encryption key (REQUIRED if you want encryption)
# Generate with: python scripts/generate_encryption_key.py
ENCRYPTION_KEY=<paste_generated_value_here>
ENCRYPTION_ENABLED=true
```

### Step 4: Test Startup Validation

```bash
# Test startup in local mode first
ENVIRONMENT=local python -m backend.main
```

**Expected output:**
```
🔒 Running security startup validation...
✅ Security validation passed
```

**If you see errors:**
- Follow the error message instructions (very clear)
- Common issues:
  - Missing `JWT_SECRET_KEY` (generate one)
  - Missing `ENCRYPTION_KEY` (generate one)
  - Encrypted files found without key (restore from backup or set key)

### Step 5: Migrate Existing Data to Encrypted Format

**If `ENCRYPTION_ENABLED=true`:**

Existing unencrypted files will be automatically detected and re-encrypted on first save. To force immediate encryption:

```python
# Run this Python script to encrypt existing auth data
from backend import auth, storage

# Load and save users (triggers encryption)
users = auth.load_users()
auth.save_users(users)

# Load and save sessions (triggers encryption)
sessions = auth.load_sessions()
auth.save_sessions(sessions)

# Load and save invites (triggers encryption)
invites = storage.load_invites()
storage.save_invites(invites)

print("✅ All auth data encrypted")
```

**Or just restart the server - files will encrypt on next update.**

### Step 6: Update Frontend Code

See "Breaking Changes" section above for required frontend updates.

**Key files to modify:**
- `frontend/src/api.js` - Update `refreshAccessToken()` function
- `frontend/src/auth.js` - Ensure `setAuth()` stores both tokens

### Step 7: Deploy & Verify

```bash
# Start server
python -m backend.main
```

**Verify:**
1. ✅ Startup validation passes
2. ✅ Login works
3. ✅ Token refresh works (check new refresh token returned)
4. ✅ Rate limiting works (try 6 logins → 429 error)
5. ✅ Audit log created: `ls -la data/audit.log`

---

## 🔍 Verification Checklist

### Security Features Active

- [ ] Startup validation passes
- [ ] JWT_SECRET_KEY set (production)
- [ ] ENCRYPTION_KEY set (if using encryption)
- [ ] Rate limiting working (test with multiple requests)
- [ ] Audit log file created (`data/audit.log`)
- [ ] Security headers present (check browser DevTools Network tab)
- [ ] Account lockout working (test with 10 failed logins)
- [ ] Profile access control enforced (test unauthorized access)

### Data Integrity

- [ ] Existing users can log in
- [ ] Existing sessions still valid (or users logged out - expected)
- [ ] Conversations still accessible
- [ ] No data corruption (verify key conversations load)

### Frontend Compatibility

- [ ] Login flow works
- [ ] Token refresh works
- [ ] New refresh token stored after refresh
- [ ] Locked account message displays correctly (if triggered)

---

## 🚨 Rollback Procedure

If you need to rollback:

### Step 1: Restore Backup

```bash
# Stop server
# Restore data directory
rm -rf data/
cp -r data_backup_<date>/ data/

# Restore .env
cp .env.backup .env
```

### Step 2: Checkout Previous Commit

```bash
git checkout <previous_commit_hash>
```

### Step 3: Reinstall Dependencies

```bash
uv sync  # or pip install -r requirements.txt
```

### Step 4: Restart Server

```bash
python -m backend.main
```

---

## 📊 Migration Impact Summary

### Zero Downtime Features
- Startup validation (only affects misconfigured deploys)
- Auth data encryption (transparent migration)
- Rate limiting (gradual rollout)
- Security headers (transparent)
- Audit logging (new feature, no impact)
- Account lockout (only affects brute force attempts)
- Profile access control (only affects unauthorized access)

### Requires User Action
- **Refresh token rotation:** Users must re-login after first token refresh
  - Impact: One-time disruption per active session
  - Duration: < 5 seconds per user
  - Severity: Minor inconvenience

### Requires Code Changes
- **Frontend refresh logic:** Must store new refresh token from response
  - Lines of code: ~5-10
  - Complexity: Low
  - Critical: Yes (feature breaks without it)

---

## 🆘 Troubleshooting

### Problem: Server won't start - "JWT_SECRET_KEY must be set"

**Solution:**
```bash
# Generate a key
python -c 'import secrets; print(secrets.token_urlsafe(32))'
# Add to .env:
echo "JWT_SECRET_KEY=<generated_value>" >> .env
```

### Problem: Server won't start - "Encrypted files found but ENCRYPTION_KEY not set"

**Solution:**
You have encrypted files but no key. Either:

**Option A: Set the original key**
```bash
echo "ENCRYPTION_KEY=<your_original_key>" >> .env
```

**Option B: Restore from backup**
```bash
rm -rf data/
cp -r data_backup_<date>/ data/
```

### Problem: Users getting "Account locked" message

**Solution:**
This is expected behavior after 10 failed logins. Wait 30 minutes or manually unlock:

```python
# Manual unlock script
from backend import auth
users = auth.load_users()
for user in users.values():
    if user['email'] == 'user@example.com':
        user['locked_until'] = None
        user['failed_login_attempts'] = 0
auth.save_users(users)
print("User unlocked")
```

### Problem: Rate limit errors (429) for legitimate users

**Solution:**
Rate limits are intentionally aggressive. Adjust in `backend/main.py`:

```python
# Increase limits if needed
@limiter.limit("10/15minutes")  # Was: "5/15minutes"
async def login(...):
```

### Problem: Frontend refresh not working - "Invalid refresh token"

**Solution:**
You're not storing the new refresh token from the response. See "Breaking Changes" section.

---

## 📞 Support

If you encounter issues not covered here:

1. Check `data/audit.log` for security events
2. Check server logs for error details
3. Review [SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md) for architecture details
4. Open an issue on GitHub with:
   - Error message
   - Steps to reproduce
   - Relevant log excerpts

---

**Migration Date:** 2025-11-26
**Estimated Migration Time:** 30-45 minutes
**Downtime Required:** 0-5 minutes (server restart only)
