/**
 * API client for the LLM Council backend.
 */

import { getAccessToken, updateAccessToken, updateRefreshToken, getRefreshToken, clearAuth, getProfileIdKey } from './auth.js';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8003';

// Get current profile ID from localStorage
function getCurrentProfileId() {
  return localStorage.getItem(getProfileIdKey()) || 'default';
}

// Helper function to safely parse error responses (handles both JSON and HTML)
async function parseErrorResponse(response) {
  const contentType = response.headers.get('content-type');

  // Check if response is JSON
  if (contentType && contentType.includes('application/json')) {
    try {
      const data = await response.json();
      return data.detail || data.message || 'An error occurred';
    } catch (e) {
      return 'Failed to parse error response';
    }
  }

  // If HTML or other content, return generic message with status
  return `Server error (${response.status}): ${response.statusText || 'Unknown error'}`;
}

// Get auth headers
function getAuthHeaders() {
  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('[API] Adding auth header:', token.substring(0, 10) + '...');
  } else {
    console.warn('[API] No access token available for auth header');
  }
  return headers;
}

// Refresh access token
async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    console.warn('[API] No refresh token available');
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
      console.error('[API] Token refresh failed:', response.status, response.statusText);
      return false;
    }

    const data = await response.json();
    console.log('[API] Token refresh successful, updating tokens');
    updateAccessToken(data.access_token);
    // IMPORTANT: Backend rotates refresh tokens (single-use), must store new one
    if (data.refresh_token) {
      updateRefreshToken(data.refresh_token);
    }
    return true;
  } catch (error) {
    console.error('[API] Token refresh error:', error);
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
      const errorMsg = await parseErrorResponse(response);
      throw new Error(errorMsg);
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
      const errorMsg = await parseErrorResponse(response);
      throw new Error(errorMsg);
    }
    const data = await response.json();
    console.log('[API] login() successful, received data:', {
      hasAccessToken: !!data.access_token,
      hasRefreshToken: !!data.refresh_token,
      user: data.user
    });
    return data;
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
   * List conversations with optional view filtering.
   * @param {string} view - View mode: "private" (own), "public" (all public), "all" (both)
   */
  async listConversations(view = 'private') {
    const profileId = getCurrentProfileId();
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations?profile_id=${profileId}&view=${view}`
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

    // Connection token will be received in stream_init event
    let connectionToken = null;

    // Enhanced event handler wrapper to capture connection token
    const wrappedOnEvent = (eventType, event) => {
      if (eventType === 'stream_init') {
        connectionToken = event.connection_token;
        console.log('[API] Connection token received for stream:', event.stream_id);
        // Don't pass stream_init to caller (internal event)
        return;
      }
      onEvent(eventType, event);
    };

    // Start the stream with access token
    let response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message/stream?profile_id=${profileId}`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content }),
        signal: signal,
      }
    );

    if (!response.ok) {
      // Handle 401 specifically
      if (response.status === 401) {
        // Try to refresh access token once
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Retry the stream with new access token
          response = await fetch(
            `${API_BASE}/api/conversations/${conversationId}/message/stream?profile_id=${profileId}`,
            {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({ content }),
              signal: signal,
            }
          );
          if (!response.ok) {
            throw new Error('Failed to send message after token refresh');
          }
        } else {
          clearAuth();
          throw new Error('Authentication expired. Please log in again.');
        }
      } else {
        throw new Error('Failed to send message');
      }
    }

    // Read the stream
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
            wrappedOnEvent(event.type, event);
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
    }

    // Note: Connection token is available for reconnection logic in the future
    // Currently we don't expose it, but it's stored and could be used if network drops
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

  // ==================== Waitlist & Invites ====================

  /**
   * Join the waitlist.
   */
  async joinWaitlist(email, name) {
    const response = await fetch(`${API_BASE}/api/waitlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, name }),
    });
    if (!response.ok) {
      const errorMsg = await parseErrorResponse(response);
      throw new Error(errorMsg);
    }
    return response.json();
  },

  /**
   * Validate an invite token.
   */
  async validateInviteToken(token) {
    const response = await fetch(`${API_BASE}/api/invite/validate/${token}`);
    if (!response.ok) {
      const errorMsg = await parseErrorResponse(response);
      throw new Error(errorMsg);
    }
    return response.json();
  },

  // ==================== Models Configuration ====================

  /**
   * Get current model configuration.
   */
  async getModels() {
    const response = await fetchWithAuth(`${API_BASE}/api/models`);
    if (!response.ok) {
      throw new Error('Failed to get models');
    }
    return response.json();
  },

  /**
   * Update model configuration.
   */
  async updateModels(councilModels, chairmanModel) {
    const response = await fetchWithAuth(`${API_BASE}/api/models`, {
      method: 'POST',
      body: JSON.stringify({
        council_models: councilModels,
        chairman_model: chairmanModel,
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to update models');
    }
    return response.json();
  },

  // ==================== Static Content ====================

  /**
   * Fetch markdown content from public directory.
   */
  async fetchMarkdownContent(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('Failed to load content');
    }
    return response.text();
  },
};
