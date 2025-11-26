/**
 * Hybrid storage layer that combines localStorage (primary) with backend API (sync).
 * Local-first architecture: all operations happen locally first, then sync to backend if public.
 */

import * as localStore from './localStorage.js';
import { api } from '../api.js';

/**
 * Initialize storage - load from localStorage or create first conversation.
 */
export function initialize() {
  const conversations = localStore.getAllConversations();
  if (conversations.length === 0) {
    // Create a default conversation
    return localStore.createConversation(false);
  }
  return null;
}

/**
 * Get all conversations (from localStorage).
 */
export function getAllConversations() {
  return localStore.getConversationMetadata();
}

/**
 * Get a single conversation by ID (from localStorage).
 */
export function getConversation(conversationId) {
  return localStore.getConversation(conversationId);
}

/**
 * Create a new conversation (local-first).
 */
export function createConversation(usesByok = false) {
  return localStore.createConversation(usesByok);
}

/**
 * Update conversation title (local-first, then sync if public).
 */
export async function updateConversationTitle(conversationId, title) {
  // Update locally first
  const conversation = localStore.updateConversationTitle(conversationId, title);

  // Sync to backend if public
  if (conversation.is_public && conversation.sync_status !== 'local') {
    try {
      await api.renameConversation(conversationId, title);
    } catch (error) {
      console.error('Failed to sync title to backend:', error);
    }
  }

  return conversation;
}

/**
 * Delete a conversation (local-first, then sync if public).
 */
export async function deleteConversation(conversationId) {
  const conversation = localStore.getConversation(conversationId);

  // Delete from backend if public
  if (conversation && conversation.is_public && conversation.sync_status !== 'local') {
    try {
      await api.deleteConversation(conversationId);
    } catch (error) {
      console.error('Failed to delete from backend:', error);
    }
  }

  // Delete locally
  return localStore.deleteConversation(conversationId);
}

/**
 * Add user message (local-first).
 */
export function addUserMessage(conversationId, content) {
  return localStore.addUserMessage(conversationId, content);
}

/**
 * Add assistant message (local-first).
 */
export function addAssistantMessage(
  conversationId,
  stage1,
  stage2,
  stage3,
  metadata,
  stage1_5
) {
  return localStore.addAssistantMessage(
    conversationId,
    stage1,
    stage2,
    stage3,
    metadata,
    stage1_5
  );
}

/**
 * Set conversation loading state.
 */
export function setConversationLoading(conversationId, isLoading) {
  return localStore.setConversationLoading(conversationId, isLoading);
}

/**
 * Publish conversation to forum (sync to backend).
 */
export async function publishConversation(conversationId) {
  // Mark as public locally
  const conversation = localStore.publishConversation(conversationId);

  // Sync to backend
  try {
    await api.publishConversation(conversationId);
    localStore.markConversationSynced(conversationId);
  } catch (error) {
    console.error('Failed to publish to backend:', error);
    // Revert local state
    localStore.unpublishConversation(conversationId);
    throw error;
  }

  return conversation;
}

/**
 * Unpublish conversation from forum (sync to backend).
 */
export async function unpublishConversation(conversationId) {
  // Mark as private locally
  const conversation = localStore.unpublishConversation(conversationId);

  // Sync to backend
  try {
    await api.unpublishConversation(conversationId);
  } catch (error) {
    console.error('Failed to unpublish from backend:', error);
    throw error;
  }

  return conversation;
}

/**
 * List public conversations from forum (backend only).
 */
export async function listForumConversations() {
  return await api.listForumConversations();
}

/**
 * Get a public conversation from forum (backend only).
 */
export async function getForumConversation(conversationId, profileId) {
  return await api.getForumConversation(conversationId, profileId);
}

/**
 * Get current profile ID.
 */
export function getCurrentProfileId() {
  return localStore.getCurrentProfileId();
}

/**
 * Set current profile ID.
 */
export function setCurrentProfileId(profileId) {
  return localStore.setCurrentProfileId(profileId);
}

/**
 * Export data for debugging.
 */
export function exportData() {
  return localStore.exportData();
}

/**
 * Clear all local data.
 */
export function clearAllData() {
  return localStore.clearAllData();
}
