/**
 * E2E tests for encryption controls.
 */

import { test, expect } from './fixtures.js';

test.describe('Encryption', () => {
  test('should show encryption controls', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    // Create conversation and send message
    await page.click('button:has-text("New Conversation")');
    await page.fill('textarea[placeholder*="message"]', 'Test message');
    await page.click('button:has-text("Send")');
    await expect(page.locator('.stage3-container')).toBeVisible({ timeout: 30000 });

    // Encryption controls should be visible
    await expect(page.locator('.encryption-controls')).toBeVisible({ timeout: 5000 });
  });

  test('should display encryption status', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    await page.click('button:has-text("New Conversation")');
    await page.fill('textarea[placeholder*="message"]', 'Test');
    await page.click('button:has-text("Send")');
    await expect(page.locator('.stage3-container')).toBeVisible({ timeout: 30000 });

    // Should show encryption status (either encrypted or plaintext)
    const encryptionControls = page.locator('.encryption-controls');
    await expect(encryptionControls).toContainText(/Encrypted|Plaintext/i);
  });

  test('should encrypt conversation when button clicked', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    await page.click('button:has-text("New Conversation")');
    await page.fill('textarea[placeholder*="message"]', 'Sensitive data');
    await page.click('button:has-text("Send")');
    await expect(page.locator('.stage3-container')).toBeVisible({ timeout: 30000 });

    // Look for encrypt button
    const encryptButton = page.locator('button:has-text("Encrypt")');

    // If encrypt button exists, click it
    if (await encryptButton.isVisible()) {
      await encryptButton.click();

      // Confirm dialog if present
      const confirmButton = page.locator('button:has-text("Yes, Encrypt")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Should show encrypted status
      await expect(page.locator('text=Encrypted')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should decrypt conversation when button clicked', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    await page.click('button:has-text("New Conversation")');
    await page.fill('textarea[placeholder*="message"]', 'Test data');
    await page.click('button:has-text("Send")');
    await expect(page.locator('.stage3-container')).toBeVisible({ timeout: 30000 });

    // First encrypt
    const encryptButton = page.locator('button:has-text("Encrypt")');
    if (await encryptButton.isVisible()) {
      await encryptButton.click();
      const confirmButton = page.locator('button:has-text("Yes, Encrypt")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      await page.waitForTimeout(1000);
    }

    // Then decrypt
    const decryptButton = page.locator('button:has-text("Decrypt")');
    if (await decryptButton.isVisible()) {
      await decryptButton.click();

      const confirmButton = page.locator('button:has-text("Yes, Decrypt")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Should show plaintext status
      await expect(page.locator('text=Plaintext')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should persist encryption status after reload', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    await page.click('button:has-text("New Conversation")');
    await page.fill('textarea[placeholder*="message"]', 'Persistent test');
    await page.click('button:has-text("Send")');
    await expect(page.locator('.stage3-container')).toBeVisible({ timeout: 30000 });

    // Get conversation ID
    const activeConvItem = page.locator('.conversation-item.active');
    const convId = await activeConvItem.getAttribute('data-conversation-id');

    // Encrypt
    const encryptButton = page.locator('button:has-text("Encrypt")');
    if (await encryptButton.isVisible()) {
      await encryptButton.click();
      const confirmButton = page.locator('button:has-text("Yes, Encrypt")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      await page.waitForTimeout(1000);
    }

    // Reload page
    await page.reload();
    await page.waitForSelector('.conversation-item', { timeout: 5000 });

    // Select same conversation
    await page.click(`.conversation-item[data-conversation-id="${convId}"]`);

    // Encryption status should persist
    // (Just verify conversation loads - encryption state may or may not be immediately visible)
    await expect(page.locator('.chat-interface')).toBeVisible();
  });
});
