/**
 * Authentication utilities for the frontend.
 */

// Generate storage keys based on app origin to avoid conflicts
function generateStorageKey(suffix) {
  const origin = window.location.origin;
  // Simple hash function for consistent key generation
  const hash = Array.from(origin).reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0) | 0;
  }, 0);
  return `llm_council_${Math.abs(hash)}_${suffix}`;
}

const TOKEN_KEY = generateStorageKey('access_token');
const REFRESH_TOKEN_KEY = generateStorageKey('refresh_token');
const USER_KEY = generateStorageKey('user');
const PROFILE_ID_KEY = generateStorageKey('profile_id');

/**
 * Get the profile ID storage key (for use by other modules).
 */
export function getProfileIdKey() {
  return PROFILE_ID_KEY;
}

/**
 * Store authentication tokens and user data.
 */

export function setAuth(accessToken, refreshToken, user) {
  console.log('[AUTH] setAuth called with:', {
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    user: user,
    TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    USER_KEY,
    PROFILE_ID_KEY
  });

  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));

  // Update profile ID to user's default profile
  localStorage.setItem(PROFILE_ID_KEY, user.default_profile_id);

  console.log('[AUTH] Tokens stored. Verification:', {
    storedAccessToken: localStorage.getItem(TOKEN_KEY)?.substring(0, 20) + '...',
    storedRefreshToken: localStorage.getItem(REFRESH_TOKEN_KEY)?.substring(0, 20) + '...',
    storedUser: localStorage.getItem(USER_KEY),
    storedProfileId: localStorage.getItem(PROFILE_ID_KEY)
  });
}

/**
 * Get the current access token.
 */
export function getAccessToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  console.log('[AUTH] getAccessToken called:', {
    TOKEN_KEY,
    hasToken: !!token,
    tokenPreview: token ? token.substring(0, 20) + '...' : null,
    allKeys: Object.keys(localStorage)
  });
  return token;
}

/**
 * Get the current refresh token.
 */
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Get the current user data.
 */
export function getCurrentUser() {
  const userJson = localStorage.getItem(USER_KEY);
  return userJson ? JSON.parse(userJson) : null;
}

/**
 * Check if user is authenticated.
 */
export function isAuthenticated() {
  const token = getAccessToken();
  const authenticated = !!token;
  console.log('[AUTH] isAuthenticated:', authenticated);
  return authenticated;
}

/**
 * Clear all authentication data (logout).
 */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Update the access token after refresh.
 */
export function updateAccessToken(accessToken) {
  localStorage.setItem(TOKEN_KEY, accessToken);
}

/**
 * Update the refresh token after refresh (token rotation).
 */
export function updateRefreshToken(refreshToken) {
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}
