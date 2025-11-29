/**
 * E2E tests for conversation creation and messaging.
 */

import { test, expect } from './fixtures.js';

test.describe('Conversations', () => {
  test('should create new conversation', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    // Click new conversation button
    await page.click('button:has-text("New Conversation")');

    // Should see "New Conversation" in sidebar
    await expect(page.locator('.conversation-item:has-text("New Conversation")')).toBeVisible({ timeout: 5000 });

    // Should show empty chat interface
    await expect(page.locator('.chat-interface')).toBeVisible();
  });

  test('should send message and see stages appear', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    // Create new conversation
    await page.click('button:has-text("New Conversation")');

    // Wait for input field
    await page.waitForSelector('textarea[placeholder*="message"]', { timeout: 5000 });

    // Type and send message
    await page.fill('textarea[placeholder*="message"]', 'What is 2+2?');
    await page.click('button:has-text("Send")');

    // Should see loading states
    await expect(page.locator('text=Stage 1 Loading')).toBeVisible({ timeout: 5000 });

    // Wait for Stage 1 to complete (with generous timeout for mock processing)
    await expect(page.locator('.stage1-container')).toBeVisible({ timeout: 30000 });

    // Should see Stage 1.5
    await expect(page.locator('.stage1_5-container')).toBeVisible({ timeout: 30000 });

    // Should see Stage 2
    await expect(page.locator('.stage2-container')).toBeVisible({ timeout: 30000 });

    // Should see Stage 3 (final answer)
    await expect(page.locator('.stage3-container')).toBeVisible({ timeout: 30000 });

    // Message should no longer be loading
    await expect(page.locator('text=Stage 1 Loading')).not.toBeVisible();
  });

  test('should display all stage tabs', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    // Create conversation and send message
    await page.click('button:has-text("New Conversation")');
    await page.fill('textarea[placeholder*="message"]', 'Test question?');
    await page.click('button:has-text("Send")');

    // Wait for completion
    await expect(page.locator('.stage3-container')).toBeVisible({ timeout: 30000 });

    // Verify Stage 1 tabs exist
    const stage1Tabs = page.locator('.stage1-container .tab');
    await expect(stage1Tabs.first()).toBeVisible();

    // Verify Stage 2 tabs exist
    const stage2Tabs = page.locator('.stage2-container .tab');
    await expect(stage2Tabs.first()).toBeVisible();

    // Click through tabs to verify they're interactive
    const firstTab = stage1Tabs.first();
    await firstTab.click();
    await expect(firstTab).toHaveClass(/active/);
  });

  test('should enable input field after message completes', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    await page.click('button:has-text("New Conversation")');
    await page.fill('textarea[placeholder*="message"]', 'Quick test?');
    await page.click('button:has-text("Send")');

    // Wait for message to complete
    await expect(page.locator('.stage3-container')).toBeVisible({ timeout: 30000 });

    // Input should be enabled again
    const textarea = page.locator('textarea[placeholder*="message"]');
    await expect(textarea).toBeEnabled();
    await expect(textarea).toBeEmpty();
  });

  test('should allow multi-turn conversation', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    await page.click('button:has-text("New Conversation")');

    // First message
    await page.fill('textarea[placeholder*="message"]', 'First question?');
    await page.click('button:has-text("Send")');
    await expect(page.locator('.stage3-container')).toBeVisible({ timeout: 30000 });

    // Second message
    await page.fill('textarea[placeholder*="message"]', 'Follow-up question?');
    await page.click('button:has-text("Send")');
    await expect(page.locator('.message-group').nth(1)).toBeVisible({ timeout: 30000 });

    // Should have 2 message groups (each with user + assistant)
    const messageGroups = page.locator('.message-group');
    await expect(messageGroups).toHaveCount(2, { timeout: 5000 });
  });
});
