/**
 * E2E tests for authentication flow.
 */

import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures.js';

test.describe('Authentication', () => {
  test('should register a new user', async ({ page }) => {
    await page.goto('/');

    // Click login/register button
    await page.click('button:has-text("Login / Register")');

    // Switch to register mode
    await page.click('button:has-text("Register")');

    // Fill registration form
    const testEmail = `test-${Date.now()}@example.com`;
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.fill('input[placeholder*="name"]', 'Test User');

    // Submit
    await page.click('button:has-text("Register")');

    // Should be logged in - verify sidebar shows user
    await expect(page.locator('button:has-text("Logout")')).toBeVisible({ timeout: 10000 });
  });

  test('should login with existing user', async ({ page, request }) => {
    // Create a user first
    const authData = await createTestUser(request);

    await page.goto('/');

    // Click login button
    await page.click('button:has-text("Login / Register")');

    // Fill login form
    await page.fill('input[type="email"]', authData.email);
    await page.fill('input[type="password"]', authData.password);

    // Submit
    await page.click('button:has-text("Login")');

    // Verify logged in
    await expect(page.locator('button:has-text("Logout")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Test User')).toBeVisible();
  });

  test('should show user name in sidebar after login', async ({ page, request }) => {
    const authData = await createTestUser(request);

    await page.goto('/');

    // Login
    await page.click('button:has-text("Login / Register")');
    await page.fill('input[type="email"]', authData.email);
    await page.fill('input[type="password"]', authData.password);
    await page.click('button:has-text("Login")');

    // Verify user name is displayed
    await expect(page.locator('.auth-section')).toContainText('Test User');
  });

  test('should persist auth after page reload', async ({ page, request }) => {
    const authData = await createTestUser(request);

    await page.goto('/');

    // Login
    await page.click('button:has-text("Login / Register")');
    await page.fill('input[type="email"]', authData.email);
    await page.fill('input[type="password"]', authData.password);
    await page.click('button:has-text("Login")');

    await expect(page.locator('button:has-text("Logout")')).toBeVisible();

    // Reload page
    await page.reload();

    // Should still be logged in
    await expect(page.locator('button:has-text("Logout")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Test User')).toBeVisible();
  });
});
