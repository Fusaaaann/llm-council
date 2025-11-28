/**
 * Local storage layer for conversations.
 * Provides local-first storage with optional server sync.
 */

import { getProfileIdKey } from '../auth.js';

// Generate storage keys based on app origin to avoid conflicts
function generateStorageKey(suffix) {
  const origin = window.location.origin;
  // Simple hash function for consistent key generation
  const hash = Array.from(origin).reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0) | 0;
  }, 0);
  return `llm_council_${Math.abs(hash)}_${suffix}`;
}

const STORAGE_KEYS = {
  CONVERSATIONS: generateStorageKey('conversations'),
  SETTINGS: generateStorageKey('settings'),
};

/**
 * Get the current profile ID.
 */
export function getCurrentProfileId() {
  return localStorage.getItem(getProfileIdKey()) || 'default';
}

/**
 * Set the current profile ID.
 */
export function setCurrentProfileId(profileId) {
  localStorage.setItem(getProfileIdKey(), profileId);
}

/**
 * Get all conversations from local storage.
 */
export function getAllConversations() {
  const data = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
  if (!data) return [];

  try {
    const conversations = JSON.parse(data);
    return Array.isArray(conversations) ? conversations : [];
  } catch (e) {
    console.error('Failed to parse conversations from localStorage:', e);
    return [];
  }
}

/**
 * Get a single conversation by ID.
 */
export function getConversation(conversationId) {
  const conversations = getAllConversations();
  return conversations.find((c) => c.id === conversationId) || null;
}

/**
 * Save all conversations to local storage.
 */
function saveAllConversations(conversations) {
  localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
}

/**
 * Create a new conversation.
 */
export function createConversation(usesByok = false) {
  const conversations = getAllConversations();

  const newConversation = {
    id: crypto.randomUUID(),
    profile_id: getCurrentProfileId(),
    created_at: new Date().toISOString(),
    title: 'New Conversation',
    messages: [],
    is_public: !usesByok, // Default: public unless BYOK
    published_at: null,
    sync_status: 'local', // local, syncing, synced
    uses_byok: usesByok,
    is_loading: false,
  };

  conversations.push(newConversation);
  saveAllConversations(conversations);

  return newConversation;
}

/**
 * Update a conversation.
 */
export function updateConversation(conversationId, updates) {
  const conversations = getAllConversations();
  const index = conversations.findIndex((c) => c.id === conversationId);

  if (index === -1) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  conversations[index] = { ...conversations[index], ...updates };
  saveAllConversations(conversations);

  return conversations[index];
}

/**
 * Delete a conversation.
 */
export function deleteConversation(conversationId) {
  const conversations = getAllConversations();
  const filtered = conversations.filter((c) => c.id !== conversationId);

  if (filtered.length === conversations.length) {
    return false; // Not found
  }

  saveAllConversations(filtered);
  return true;
}

/**
 * Add a user message to a conversation.
 */
export function addUserMessage(conversationId, content) {
  const conversation = getConversation(conversationId);
  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  conversation.messages.push({
    role: 'user',
    content,
  });

  updateConversation(conversationId, conversation);
}

/**
 * Add an assistant message to a conversation.
 */
export function addAssistantMessage(
  conversationId,
  stage1,
  stage2,
  stage3,
  metadata,
  stage1_5
) {
  const conversation = getConversation(conversationId);
  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  const message = {
    role: 'assistant',
    stage1,
    stage2,
    stage3,
  };

  if (stage1_5) {
    message.stage1_5 = stage1_5;
  }

  if (metadata) {
    message.metadata = metadata;
  }

  conversation.messages.push(message);
  updateConversation(conversationId, conversation);
}

/**
 * Update conversation title.
 */
export function updateConversationTitle(conversationId, title) {
  return updateConversation(conversationId, { title });
}

/**
 * Set conversation loading state.
 */
export function setConversationLoading(conversationId, isLoading) {
  return updateConversation(conversationId, { is_loading: isLoading });
}

/**
 * Publish a conversation (mark as public).
 */
export function publishConversation(conversationId) {
  const conversation = getConversation(conversationId);
  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  if (conversation.uses_byok) {
    throw new Error('Cannot publish BYOK conversations');
  }

  return updateConversation(conversationId, {
    is_public: true,
    published_at: new Date().toISOString(),
    sync_status: 'syncing', // Will be 'synced' after server sync
  });
}

/**
 * Unpublish a conversation (mark as private).
 */
export function unpublishConversation(conversationId) {
  return updateConversation(conversationId, {
    is_public: false,
    published_at: null,
    sync_status: 'local',
  });
}

/**
 * Mark conversation as synced with server.
 */
export function markConversationSynced(conversationId) {
  return updateConversation(conversationId, {
    sync_status: 'synced',
  });
}

/**
 * Get conversation metadata for list view.
 */
export function getConversationMetadata() {
  const conversations = getAllConversations();
  return conversations.map((c) => ({
    id: c.id,
    created_at: c.created_at,
    title: c.title,
    message_count: c.messages.length,
    is_loading: c.is_loading || false,
    is_public: c.is_public || false,
    sync_status: c.sync_status || 'local',
    uses_byok: c.uses_byok || false,
  }));
}

/**
 * Clear all local data (for testing or reset).
 */
export function clearAllData() {
  localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS);
}

/**
 * Export for debugging.
 */
export function exportData() {
  return {
    conversations: getAllConversations(),
    profileId: getCurrentProfileId(),
  };
}
