# Quick Start: Authentication & Session Management

Get authentication up and running in 5 minutes.

## 1. Setup (One-Time)

```bash
# Run the setup script to generate JWT secret
python scripts/setup_auth.py

# Install new Python dependencies
uv sync

# No frontend dependencies needed
```

## 2. Start the Application

```bash
# Terminal 1: Start backend
python -m backend.main

# Terminal 2: Start frontend
cd frontend && npm run dev
```

## 3. Test It Out

1. Open http://localhost:5173
2. Click **"Login / Register"** in the sidebar
3. Create an account:
   - Name: Test User
   - Email: test@example.com
   - Password: password123
4. You're logged in! Try:
   - Creating a conversation
   - Sending messages
   - Logging out and back in

## That's It!

Authentication is now working. Your conversations are tied to your user account.

## Optional: Production Mode

To require authentication for all users:

1. Edit `.env`:
   ```bash
   ENVIRONMENT=production
   AUTH_ENABLED=true
   ```

2. Restart backend

3. Now everyone must log in to use the app

## What You Get

✅ User registration and login
✅ Secure password storage (bcrypt)
✅ JWT tokens with automatic refresh
✅ Per-user conversation isolation
✅ Logout functionality
✅ Optional auth (perfect for development)

## Need More Info?

- **Full Guide**: See [SESSION_MANAGEMENT.md](SESSION_MANAGEMENT.md)
- **Implementation Details**: See [CLAUDE.md](CLAUDE.md)
- **Troubleshooting**: Check the docs above or backend logs

## Common Issues

**Can't log in?**
- Check backend logs for errors
- Make sure dependencies installed: `uv sync`
- Try clearing localStorage in browser DevTools

**"Authentication required" error?**
- Set `AUTH_ENABLED=false` in `.env` for development
- Or login if AUTH_ENABLED=true

**Forgot password?**
- Password reset not implemented yet
- For now, edit `data/users.json` manually or create new account
