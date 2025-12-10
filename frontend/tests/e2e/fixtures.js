/**
 * Shared fixtures and utilities for Playwright E2E tests.
 */

import { test as base } from '@playwright/test';

const API_BASE = 'http://localhost:8003';

/**
 * Create a test user and return auth credentials.
 */
export async function createTestUser(request, email = null) {
  const testEmail = email || `test-${Date.now()}@example.com`;

  const response = await request.post(`${API_BASE}/api/auth/register`, {
    data: {
      email: testEmail,
      password: 'TestPass123!',
      name: 'Test User',
    },
  });

  if (response.status() !== 200) {
    throw new Error(`Failed to create test user: ${response.status()}`);
  }

  const data = await response.json();
  return {
    user: data.user,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    email: testEmail,
    password: 'TestPass123!',
  };
}

/**
 * Login via UI.
 */
export async function loginViaUI(page, email, password) {
  // Wait for login button
  await page.waitForSelector('button:has-text("Login / Register")', { timeout: 5000 });
  await page.click('button:has-text("Login / Register")');

  // Fill login form
  await page.waitForSelector('input[type="email"]', { timeout: 5000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Submit
  await page.click('button:has-text("Login")');

  // Wait for auth to complete
  await page.waitForSelector('button:has-text("Logout")', { timeout: 10000 });
}

/**
 * Set auth tokens in localStorage.
 */
export async function setAuthTokens(page, authData) {
  await page.addInitScript((data) => {
    localStorage.setItem('llm_council_access_token', data.accessToken);
    localStorage.setItem('llm_council_refresh_token', data.refreshToken);
    localStorage.setItem('llm_council_user', JSON.stringify(data.user));
    localStorage.setItem('llm_council_profile_id', data.user.default_profile_id);
  }, authData);
}

/**
 * Create a test conversation via API.
 */
export async function createTestConversation(request, authData) {
  const response = await request.post(`${API_BASE}/api/conversations`, {
    headers: {
      Authorization: `Bearer ${authData.accessToken}`,
    },
    params: {
      profile_id: authData.user.default_profile_id,
    },
  });

  if (response.status() !== 200) {
    throw new Error(`Failed to create conversation: ${response.status()}`);
  }

  return await response.json();
}

/**
 * Extended test fixture with authenticated context.
 */
export const test = base.extend({
  authenticatedPage: async ({ page, request }, use) => {
    // Create test user
    const authData = await createTestUser(request);

    // Set tokens
    await setAuthTokens(page, authData);

    // Navigate to app
    await page.goto('/');

    // Wait for app to load
    await page.waitForSelector('.sidebar', { timeout: 10000 });

    // Use the page
    await use({ page, authData });
  },
});

export { expect } from '@playwright/test';
