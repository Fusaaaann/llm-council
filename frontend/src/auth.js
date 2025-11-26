/**
 * Authentication utilities for the frontend.
 */

const TOKEN_KEY = 'llm_council_access_token';
const REFRESH_TOKEN_KEY = 'llm_council_refresh_token';
const USER_KEY = 'llm_council_user';

/**
 * Store authentication tokens and user data.
 */
export function setAuth(accessToken, refreshToken, user) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));

  // Update profile ID to user's default profile
  localStorage.setItem('llm_council_profile_id', user.default_profile_id);
}

/**
 * Get the current access token.
 */
export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
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
  return !!getAccessToken();
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
