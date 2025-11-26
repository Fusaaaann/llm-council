# Session Management Implementation

This document describes the session management and authentication system added to LLM Council.

## Overview

The system uses **JWT-based authentication** with:
- **Access tokens**: Short-lived (15 minutes), signed JWT tokens containing user_id and profile_id
- **Refresh tokens**: Long-lived (7 days), stored server-side for revocation capability
- **Secure password storage**: bcrypt hashing with salt
- **Automatic token refresh**: Frontend automatically refreshes expired access tokens

## Features

### Backend

1. **User Registration & Authentication**
   - Email/password registration
   - Automatic profile creation for new users
   - Secure bcrypt password hashing
   - JWT token generation

2. **Session Management**
   - Server-side refresh token storage
   - Token revocation on logout
   - Ability to revoke all user sessions
   - Session expiry handling

3. **API Security**
   - Authentication middleware for protected endpoints
   - Automatic Bearer token validation
   - Graceful fallback in local mode
   - Required authentication in production mode

### Frontend

1. **User Interface**
   - Login/Register modal with toggle
   - User info display in sidebar
   - Logout button
   - Error handling and validation

2. **Token Management**
   - Automatic token storage in localStorage
   - Automatic Bearer header injection
   - Automatic token refresh on 401 errors
   - Clean logout with state reset

3. **State Management**
   - Auth state initialization on app load
   - User context throughout the app
   - Conversation reloading after auth changes

## Setup

### 1. Install Dependencies

```bash
# Backend dependencies (PyJWT and passlib)
uv sync
```

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# JWT secret key (generate a secure random string)
JWT_SECRET_KEY=your_random_secret_key_here

# Optional: Override default expiration times
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Enable authentication (false for local testing, true for production)
AUTH_ENABLED=false
```

### 3. Run the Application

```bash
# Backend
python -m backend.main

# Frontend
cd frontend && npm run dev
```

## Usage

### Local Mode (Development)

- Authentication is **optional**
- Users can use the app without logging in
- Conversations stored under "default" profile
- Access "Login / Register" button in sidebar to create an account

### Production Mode

Set `ENVIRONMENT=production` in `.env`:

- Authentication is **required**
- All API requests must include valid JWT token
- Users must register/login before using the app
- Each user has their own isolated profile

## API Endpoints

### Authentication Endpoints

```
POST /api/auth/register
Body: { "email": "user@example.com", "password": "pass123", "name": "User Name" }
Response: { "user": {...}, "access_token": "...", "refresh_token": "...", "token_type": "bearer" }

POST /api/auth/login
Body: { "email": "user@example.com", "password": "pass123" }
Response: { "user": {...}, "access_token": "...", "refresh_token": "...", "token_type": "bearer" }

POST /api/auth/refresh
Body: { "refresh_token": "..." }
Response: { "access_token": "...", "token_type": "bearer" }

POST /api/auth/logout
Body: { "refresh_token": "..." }
Response: { "success": true }

GET /api/auth/me
Headers: Authorization: Bearer <access_token>
Response: { "user": {...} }
```

### Protected Endpoints

All existing conversation and profile endpoints now support authentication:

```
# Include access token in Authorization header
Authorization: Bearer <access_token>

# Examples:
GET /api/conversations
POST /api/conversations
GET /api/conversations/{id}
...
```

## Security Considerations

### Token Security

- **Access tokens** are short-lived to minimize exposure
- **Refresh tokens** are long-lived but stored server-side for revocation
- Tokens stored in localStorage (consider httpOnly cookies for enhanced security)
- JWT_SECRET_KEY should be a long, random string

### Password Security

- Passwords hashed with bcrypt (industry standard)
- Automatic salting
- Never stored in plaintext
- Minimum 6 character requirement (adjust in frontend as needed)

### Production Checklist

1. ✅ Set strong `JWT_SECRET_KEY` in production
2. ✅ Set `ENVIRONMENT=production`
3. ✅ Enable HTTPS for all requests
4. ✅ Consider httpOnly cookies instead of localStorage
5. ✅ Implement rate limiting on auth endpoints
6. ✅ Add email verification (future enhancement)
7. ✅ Implement password reset flow (future enhancement)

## Architecture

### Data Storage

```
data/
├── users.json              # User accounts
├── sessions.json           # Refresh tokens
├── profiles.json           # User profiles
└── conversations/          # Conversations by profile
    └── profile_{id}/
        └── {conv_id}.json
```

### Authentication Flow

1. **Registration/Login**:
   - User submits credentials
   - Backend validates and creates/verifies user
   - Backend generates access + refresh tokens
   - Frontend stores tokens and user data
   - App reloads conversations for authenticated user

2. **Making API Requests**:
   - Frontend adds `Authorization: Bearer {token}` header
   - Backend validates JWT signature and expiration
   - Backend extracts user_id and profile_id from token
   - Request proceeds with user context

3. **Token Refresh**:
   - API request returns 401 Unauthorized
   - Frontend automatically calls refresh endpoint with refresh token
   - Backend validates refresh token and issues new access token
   - Frontend retries original request with new token
   - If refresh fails, user is logged out

4. **Logout**:
   - Frontend calls logout endpoint with refresh token
   - Backend revokes refresh token from session store
   - Frontend clears all auth data from localStorage
   - App resets to unauthenticated state

## Future Enhancements

- [ ] Email verification on registration
- [ ] Password reset via email
- [ ] OAuth integration (Google, GitHub, etc.)
- [ ] Two-factor authentication (2FA)
- [ ] Session management UI (view/revoke active sessions)
- [ ] Rate limiting on authentication endpoints
- [ ] Account deletion functionality
- [ ] Password change functionality
- [ ] Remember me functionality (longer refresh tokens)
- [ ] HttpOnly cookies instead of localStorage
- [ ] CSRF protection
- [ ] Refresh token rotation

## Troubleshooting

### "Authentication required" errors

- Check that `ENVIRONMENT` is set correctly in `.env`
- In production mode, ensure you're logged in
- Check that access token hasn't expired
- Try logging out and back in

### Tokens not working

- Ensure `JWT_SECRET_KEY` is set in `.env`
- Check that backend was restarted after changing `.env`
- Clear localStorage and try logging in again
- Check browser console for error messages

### Can't log in

- Verify email/password are correct
- Check backend logs for errors
- Ensure `data/` directory is writable
- Check that dependencies (PyJWT, passlib) are installed

## Development Notes

- See [backend/auth.py](backend/auth.py) for core auth logic
- See [backend/auth_middleware.py](backend/auth_middleware.py) for request authentication
- See [frontend/src/auth.js](frontend/src/auth.js) for token management
- See [frontend/src/components/AuthModal.jsx](frontend/src/components/AuthModal.jsx) for UI
- All changes documented in [CLAUDE.md](CLAUDE.md)
