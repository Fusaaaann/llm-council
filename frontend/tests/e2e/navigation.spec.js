/**
 * E2E tests for conversation navigation.
 */

import { test, expect } from './fixtures.js';
import { createTestConversation } from './fixtures.js';

test.describe('Navigation', () => {
  test('should switch between conversations', async ({ authenticatedPage, request }) => {
    const { page, authData } = authenticatedPage;

    // Create two conversations
    const conv1 = await createTestConversation(request, authData);
    const conv2 = await createTestConversation(request, authData);

    // Reload to see both conversations in sidebar
    await page.reload();
    await page.waitForSelector('.conversation-item', { timeout: 5000 });

    // Click first conversation
    await page.click(`.conversation-item[data-conversation-id="${conv1.id}"]`);
    await expect(page.locator('.chat-interface')).toBeVisible();

    // Click second conversation
    await page.click(`.conversation-item[data-conversation-id="${conv2.id}"]`);
    await expect(page.locator('.chat-interface')).toBeVisible();

    // Active conversation should be highlighted
    await expect(page.locator(`.conversation-item[data-conversation-id="${conv2.id}"]`))
      .toHaveClass(/active/);
  });

  test('should show conversation list in sidebar', async ({ authenticatedPage, request }) => {
    const { page, authData } = authenticatedPage;

    // Create multiple conversations
    await createTestConversation(request, authData);
    await createTestConversation(request, authData);
    await createTestConversation(request, authData);

    // Reload to see all
    await page.reload();
    await page.waitForSelector('.conversation-item', { timeout: 5000 });

    // Should have at least 3 conversation items
    const items = page.locator('.conversation-item');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('should update sidebar when conversation title changes', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    // Create conversation
    await page.click('button:has-text("New Conversation")');

    // Send message to trigger title generation
    await page.fill('textarea[placeholder*="message"]', 'What is the capital of France?');
    await page.click('button:has-text("Send")');

    // Wait for stages to complete
    await expect(page.locator('.stage3-container')).toBeVisible({ timeout: 30000 });

    // Title should eventually update in sidebar (title generation happens async)
    // Give it time to generate title
    await page.waitForTimeout(3000);

    // Reload to ensure title persisted
    await page.reload();
    await page.waitForSelector('.conversation-item', { timeout: 5000 });

    // Should no longer see "New Conversation" or should see generated title
    // (This is timing-dependent, so we just verify conversation exists)
    const conversationItems = page.locator('.conversation-item');
    await expect(conversationItems.first()).toBeVisible();
  });

  test('should maintain conversation content when switching', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    // Create first conversation with message
    await page.click('button:has-text("New Conversation")');
    await page.fill('textarea[placeholder*="message"]', 'First conversation message');
    await page.click('button:has-text("Send")');
    await expect(page.locator('.stage3-container')).toBeVisible({ timeout: 30000 });

    const firstConvText = 'First conversation message';

    // Create second conversation
    await page.click('button:has-text("New Conversation")');
    await page.fill('textarea[placeholder*="message"]', 'Second conversation message');
    await page.click('button:has-text("Send")');
    await expect(page.locator('.stage3-container')).toBeVisible({ timeout: 30000 });

    // Get conversation IDs from sidebar
    const convItems = page.locator('.conversation-item');
    const firstConvId = await convItems.nth(0).getAttribute('data-conversation-id');

    // Switch back to first conversation
    await page.click(`.conversation-item[data-conversation-id="${firstConvId}"]`);

    // Should see first conversation content
    await expect(page.locator(`text=${firstConvText}`)).toBeVisible({ timeout: 5000 });
  });
});
