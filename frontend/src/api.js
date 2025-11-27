/**
 * API client for the LLM Council backend.
 */

import { getAccessToken, updateAccessToken, getRefreshToken, clearAuth } from './auth.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8003';

// Get current profile ID from localStorage
function getCurrentProfileId() {
  return localStorage.getItem('llm_council_profile_id') || 'default';
}

// Get auth headers
function getAuthHeaders() {
  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Refresh access token
async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    updateAccessToken(data.access_token);
    return true;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    return false;
  }
}

// Enhanced fetch with automatic token refresh
async function fetchWithAuth(url, options = {}) {
  // Add auth headers
  options.headers = {
    ...options.headers,
    ...getAuthHeaders(),
  };

  let response = await fetch(url, options);

  // If 401, try to refresh token and retry once
  if (response.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry with new token
      options.headers = {
        ...options.headers,
        ...getAuthHeaders(),
      };
      response = await fetch(url, options);
    } else {
      // Refresh failed, clear auth
      clearAuth();
      throw new Error('Authentication expired. Please log in again.');
    }
  }

  return response;
}

export const api = {
  // ==================== Authentication ====================

  /**
   * Register a new user.
   */
  async register(email, password, name, invite_token = null) {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, name, invite_token }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to register');
    }
    return response.json();
  },

  /**
   * Log in a user.
   */
  async login(email, password) {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to log in');
    }
    return response.json();
  },

  /**
   * Log out the current user.
   */
  async logout() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return;
    }

    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }

    // Always clear local auth state
    clearAuth();
  },

  /**
   * Get current authenticated user.
   */
  async getCurrentUser() {
    const response = await fetchWithAuth(`${API_BASE}/api/auth/me`);
    if (!response.ok) {
      throw new Error('Failed to get current user');
    }
    return response.json();
  },

  // ==================== Conversations ====================

  /**
   * List all conversations.
   */
  async listConversations() {
    const profileId = getCurrentProfileId();
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations?profile_id=${profileId}`
    );
    if (!response.ok) {
      throw new Error('Failed to list conversations');
    }
    return response.json();
  },

  /**
   * Create a new conversation.
   */
  async createConversation(usesByok = false) {
    const profileId = getCurrentProfileId();
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations?profile_id=${profileId}`,
      {
        method: 'POST',
        body: JSON.stringify({ uses_byok: usesByok }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to create conversation');
    }
    return response.json();
  },

  /**
   * Get a specific conversation.
   */
  async getConversation(conversationId) {
    const profileId = getCurrentProfileId();
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations/${conversationId}?profile_id=${profileId}`
    );
    if (!response.ok) {
      throw new Error('Failed to get conversation');
    }
    return response.json();
  },

  /**
   * Send a message in a conversation.
   */
  async sendMessage(conversationId, content) {
    const profileId = getCurrentProfileId();
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations/${conversationId}/message?profile_id=${profileId}`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    return response.json();
  },

  /**
   * Send a message and receive streaming updates.
   * @param {string} conversationId - The conversation ID
   * @param {string} content - The message content
   * @param {AbortSignal} signal - Abort signal for cancellation
   * @param {function} onEvent - Callback function for each event: (eventType, data) => void
   * @returns {Promise<void>}
   */
  async sendMessageStream(conversationId, content, signal, onEvent) {
    const profileId = getCurrentProfileId();
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations/${conversationId}/message/stream?profile_id=${profileId}`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
        signal: signal,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data);
            onEvent(event.type, event);
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
    }
  },

  /**
   * Rename a conversation.
   */
  async renameConversation(conversationId, title) {
    const profileId = getCurrentProfileId();
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations/${conversationId}/rename?profile_id=${profileId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to rename conversation');
    }
    return response.json();
  },

  /**
   * Delete a conversation.
   */
  async deleteConversation(conversationId) {
    const profileId = getCurrentProfileId();
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations/${conversationId}?profile_id=${profileId}`,
      {
        method: 'DELETE',
      }
    );
    if (!response.ok) {
      throw new Error('Failed to delete conversation');
    }
    return response.json();
  },

  /**
   * Export conversation to a format.
   */
  async exportConversation(conversationId, format) {
    const profileId = getCurrentProfileId();
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations/${conversationId}/export/${format}?profile_id=${profileId}`
    );
    if (!response.ok) {
      throw new Error('Failed to export conversation');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation.${format === 'markdown' ? 'md' : 'pdf'}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  /**
   * Publish a conversation to the forum.
   */
  async publishConversation(conversationId) {
    const profileId = getCurrentProfileId();
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations/${conversationId}/publish?profile_id=${profileId}`,
      {
        method: 'POST',
      }
    );
    if (!response.ok) {
      throw new Error('Failed to publish conversation');
    }
    return response.json();
  },

  /**
   * Unpublish a conversation from the forum.
   */
  async unpublishConversation(conversationId) {
    const profileId = getCurrentProfileId();
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations/${conversationId}/unpublish?profile_id=${profileId}`,
      {
        method: 'DELETE',
      }
    );
    if (!response.ok) {
      throw new Error('Failed to unpublish conversation');
    }
    return response.json();
  },

  /**
   * List all public conversations in the forum.
   */
  async listForumConversations() {
    const response = await fetchWithAuth(`${API_BASE}/api/forum/conversations`);
    if (!response.ok) {
      throw new Error('Failed to list forum conversations');
    }
    return response.json();
  },

  /**
   * Get a public conversation from the forum.
   */
  async getForumConversation(conversationId, profileId) {
    const response = await fetchWithAuth(
      `${API_BASE}/api/forum/conversations/${conversationId}?profile_id=${profileId}`
    );
    if (!response.ok) {
      throw new Error('Failed to get forum conversation');
    }
    return response.json();
  },

  /**
   * List all profiles.
   */
  async listProfiles() {
    const response = await fetchWithAuth(`${API_BASE}/api/profiles`);
    if (!response.ok) {
      throw new Error('Failed to list profiles');
    }
    return response.json();
  },

  /**
   * Create a new profile.
   */
  async createProfile(name, settings = null) {
    const response = await fetchWithAuth(`${API_BASE}/api/profiles`, {
      method: 'POST',
      body: JSON.stringify({ name, settings }),
    });
    if (!response.ok) {
      throw new Error('Failed to create profile');
    }
    return response.json();
  },

  /**
   * Update a profile.
   */
  async updateProfile(profileId, name = null, settings = null) {
    const response = await fetchWithAuth(`${API_BASE}/api/profiles/${profileId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, settings }),
    });
    if (!response.ok) {
      throw new Error('Failed to update profile');
    }
    return response.json();
  },

  /**
   * Delete a profile.
   */
  async deleteProfile(profileId) {
    const response = await fetchWithAuth(`${API_BASE}/api/profiles/${profileId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete profile');
    }
    return response.json();
  },

  /**
   * Get encryption status of a conversation.
   */
  async getEncryptionStatus(conversationId) {
    const profileId = getCurrentProfileId();
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations/${conversationId}/encryption-status?profile_id=${profileId}`
    );
    if (!response.ok) {
      throw new Error('Failed to get encryption status');
    }
    return response.json();
  },

  /**
   * Encrypt a conversation.
   */
  async encryptConversation(conversationId) {
    const profileId = getCurrentProfileId();
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations/${conversationId}/encrypt?profile_id=${profileId}`,
      {
        method: 'POST',
      }
    );
    if (!response.ok) {
      throw new Error('Failed to encrypt conversation');
    }
    return response.json();
  },

  /**
   * Decrypt a conversation (save as plaintext).
   */
  async decryptConversation(conversationId) {
    const profileId = getCurrentProfileId();
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations/${conversationId}/decrypt?profile_id=${profileId}`,
      {
        method: 'POST',
      }
    );
    if (!response.ok) {
      throw new Error('Failed to decrypt conversation');
    }
    return response.json();
  },
};
