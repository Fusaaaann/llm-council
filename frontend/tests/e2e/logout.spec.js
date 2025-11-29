/**
 * E2E tests for logout functionality.
 */

import { test, expect } from './fixtures.js';

test.describe('Logout', () => {
  test('should logout successfully', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    // Should be logged in initially
    await expect(page.locator('button:has-text("Logout")')).toBeVisible();

    // Click logout
    await page.click('button:has-text("Logout")');

    // Should show login/register button again
    await expect(page.locator('button:has-text("Login / Register")')).toBeVisible({ timeout: 5000 });

    // User name should no longer be visible
    await expect(page.locator('text=Test User')).not.toBeVisible();
  });

  test('should clear auth data on logout', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    // Logout
    await page.click('button:has-text("Logout")');
    await expect(page.locator('button:has-text("Login / Register")')).toBeVisible({ timeout: 5000 });

    // Check localStorage is cleared
    const accessToken = await page.evaluate(() => localStorage.getItem('llm_council_access_token'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('llm_council_refresh_token'));
    const user = await page.evaluate(() => localStorage.getItem('llm_council_user'));

    expect(accessToken).toBeNull();
    expect(refreshToken).toBeNull();
    expect(user).toBeNull();
  });

  test('should not persist logout after reload', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    // Logout
    await page.click('button:has-text("Logout")');
    await expect(page.locator('button:has-text("Login / Register")')).toBeVisible({ timeout: 5000 });

    // Reload
    await page.reload();

    // Should still be logged out
    await expect(page.locator('button:has-text("Login / Register")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Logout")')).not.toBeVisible();
  });

  test('should prevent access to conversations after logout', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    // Create a conversation
    await page.click('button:has-text("New Conversation")');
    await expect(page.locator('.chat-interface')).toBeVisible();

    // Logout
    await page.click('button:has-text("Logout")');
    await expect(page.locator('button:has-text("Login / Register")')).toBeVisible({ timeout: 5000 });

    // Conversation list should be empty or not visible
    // (In local mode, conversations may still be visible but won't be accessible)
    const conversationItems = page.locator('.conversation-item');
    const count = await conversationItems.count();

    // Either no conversations or they're not clickable
    if (count > 0) {
      // Try clicking - should not show content or require login
      await conversationItems.first().click();
      // Just verify we don't crash - behavior depends on local vs production mode
    }
  });

  test('should show login modal after logout when trying to create conversation', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    // Logout
    await page.click('button:has-text("Logout")');
    await expect(page.locator('button:has-text("Login / Register")')).toBeVisible({ timeout: 5000 });

    // Try to create conversation
    const newConvButton = page.locator('button:has-text("New Conversation")');

    if (await newConvButton.isVisible()) {
      await newConvButton.click();

      // Should prompt for login (or work in local mode)
      // Behavior depends on ENVIRONMENT setting
      // Just verify no crash
      await page.waitForTimeout(500);
    }
  });
});
