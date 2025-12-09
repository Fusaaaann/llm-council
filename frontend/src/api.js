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
    console.debug('[API] No access token available for auth header');
  }
  return headers;
}

// Token refresh lock - prevents race conditions when multiple requests detect 401 simultaneously
// This ensures only one refresh happens at a time, and all waiting requests share the result
let refreshPromise = null;

// Refresh access token with deduplication
async function refreshAccessToken() {
  // If a refresh is already in progress, wait for it instead of starting a new one
  if (refreshPromise) {
    console.log('[API] Token refresh already in progress, waiting for existing request...');
    return refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    console.warn('[API] No refresh token available');
    return false;
  }

  console.log('[API] Attempting token refresh with token:', refreshToken.substring(0, 20) + '...');

  // Create new refresh promise and store it
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        // Enhanced error logging
        const errorDetail = await parseErrorResponse(response);
        console.error('[API] Token refresh failed:', {
          status: response.status,
          statusText: response.statusText,
          detail: errorDetail
        });

        // Specific handling for different error types
        if (response.status === 401) {
          console.error('[API] Refresh token invalid or expired - reasons could be:');
          console.error('  - Token already used (rotation security)');
          console.error('  - Token expired (7 day default)');
          console.error('  - Session revoked on server');
          console.error('  - Token not found in session store');
          // Clear auth to force re-login
          clearAuth();
        } else if (response.status === 429) {
          console.error('[API] Rate limit exceeded - too many refresh attempts');
        }

        return false;
      }

      const data = await response.json();
      console.log('[API] Token refresh successful, updating tokens');
      console.log('[API] New access token received');
      console.log('[API] New refresh token received:', !!data.refresh_token);

      updateAccessToken(data.access_token);
      // IMPORTANT: Backend rotates refresh tokens (single-use), must store new one
      if (data.refresh_token) {
        updateRefreshToken(data.refresh_token);
        console.log('[API] Refresh token rotated and stored');
      } else {
        console.warn('[API] No new refresh token in response - token rotation may be disabled');
      }
      return true;
    } catch (error) {
      console.error('[API] Token refresh error (network or parsing):', error);
      return false;
    } finally {
      // Clear the lock after completion (success or failure)
      refreshPromise = null;
    }
  })();

  return refreshPromise;
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
   * @param {boolean} usesByok - Whether the conversation uses bring-your-own-key
   * @param {string[]} councilModels - Optional list of council model identifiers
   * @param {string} chairmanModel - Optional chairman model identifier
   * @param {string} workflowJson - Optional workflow DSL JSON string
   */
  async createConversation(usesByok = false, councilModels = null, chairmanModel = null, workflowJson = null) {
    const profileId = getCurrentProfileId();
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations?profile_id=${profileId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          uses_byok: usesByok,
          council_models: councilModels,
          chairman_model: chairmanModel,
          workflow_json: workflowJson
        }),
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
   * Send a message and receive streaming updates with automatic reconnection.
   * @param {string} conversationId - The conversation ID
   * @param {string} content - The message content
   * @param {AbortSignal} signal - Abort signal for cancellation
   * @param {function} onEvent - Callback function for each event: (eventType, data) => void
   * @param {function} onReconnect - Optional callback for reconnection attempts: (attempt, maxAttempts, delay) => void
   * @returns {Promise<void>}
   */
  async sendMessageStream(conversationId, content, signal, onEvent, onReconnect = null) {
    const profileId = getCurrentProfileId();
    const MAX_RETRY_ATTEMPTS = 10;
    const INITIAL_RETRY_DELAY = 1000; // 1 second
    const MAX_RETRY_DELAY = 64000; // 64 seconds

    // Stream context for reconnection
    let streamContext = {
      connectionToken: null,
      streamId: null,
      lastEventId: null,
      conversationId,
      content,
      profileId,
      receivedComplete: false
    };

    // Enhanced event handler wrapper to capture connection token and event IDs
    const wrappedOnEvent = (eventType, event, eventId) => {
      if (eventId) {
        streamContext.lastEventId = eventId;
      }

      if (eventType === 'stream_init') {
        streamContext.connectionToken = event.connection_token;
        streamContext.streamId = event.stream_id;

        // Persist to sessionStorage for page refresh recovery
        sessionStorage.setItem(
          `llm_council_stream_${streamContext.conversationId}`,
          JSON.stringify({
            connectionToken: event.connection_token,
            streamId: event.stream_id,
            startTime: Date.now()
          })
        );

        console.log('[API] Connection token received and saved to sessionStorage:', event.stream_id);
        // Don't pass stream_init to caller (internal event)
        return;
      }

      if (eventType === 'complete') {
        streamContext.receivedComplete = true;

        // Clear sessionStorage on completion
        sessionStorage.removeItem(`llm_council_stream_${streamContext.conversationId}`);
        console.log('[API] Stream completed, cleared sessionStorage');
      }

      onEvent(eventType, event);
    };

    // Proactive token refresh: Check if access token will expire soon
    // This prevents mid-stream token expiry which would lose all progress
    try {
      const currentToken = getAccessToken();
      if (currentToken) {
        // Decode JWT to check expiry (JWT format: header.payload.signature)
        try {
          const payload = JSON.parse(atob(currentToken.split('.')[1]));
          const expiresAt = payload.exp * 1000; // Convert to milliseconds
          const timeUntilExpiry = expiresAt - Date.now();
          const REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes

          // If token expires in less than 5 minutes, refresh it now
          if (timeUntilExpiry < REFRESH_THRESHOLD) {
            console.log('[API] Token expires soon, refreshing before stream...', {
              expiresIn: Math.round(timeUntilExpiry / 1000) + 's',
              threshold: REFRESH_THRESHOLD / 1000 + 's'
            });
            const refreshed = await refreshAccessToken();
            if (!refreshed) {
              console.error('[API] Failed to refresh token before stream');
              clearAuth();
              throw new Error('Authentication expired. Please log in again.');
            }
            console.log('[API] Token refreshed successfully before stream');
          } else {
            console.log('[API] Token valid for', Math.round(timeUntilExpiry / 1000) + 's, proceeding with stream');
          }
        } catch (decodeError) {
          // JWT decode failed - token might be malformed, let the stream attempt handle it
          console.warn('[API] Failed to decode JWT for expiry check:', decodeError);
        }
      }
    } catch (refreshError) {
      console.error('[API] Error during proactive token refresh:', refreshError);
      // Don't throw here - let the stream attempt handle auth errors
    }

    // Exponential backoff retry logic
    const attemptStream = async (retryAttempt = 0, isResumeAttempt = false) => {
      try {
        // If this is a resume attempt (after first failure), use resume endpoint
        if (isResumeAttempt && streamContext.connectionToken) {
          console.log('[API] Attempting resume from checkpoint');
          try {
            await this.resumeMessageStream(conversationId, streamContext.connectionToken, signal, wrappedOnEvent);
            // Resume successful, we're done
            return;
          } catch (resumeError) {
            console.error('[API] Resume failed:', resumeError);

            // Check if error is 403/404 (stream metadata gone/invalid) - can't resume
            if (resumeError.message.includes('403') || resumeError.message.includes('404')) {
              console.error('[API] Stream metadata lost or token invalid, cannot resume.');
              onEvent('error', {
                message: 'Stream cannot be resumed. Please reload the page.',
                recoverable: false
              });
              throw resumeError; // Stop retrying
            }

            // For other errors (network, etc), let it fall through to retry logic
            throw resumeError;
          }
        }

        // Start the stream with access token (first attempt only)
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
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Stream ended - check if we received complete event
            if (!streamContext.receivedComplete && streamContext.connectionToken) {
              // Premature end - network error, attempt reconnection
              throw new Error('Stream ended prematurely');
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          let currentEventId = null;
          for (const line of lines) {
            if (line.startsWith('id: ')) {
              currentEventId = line.slice(4);
            } else if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const event = JSON.parse(data);
                wrappedOnEvent(event.type, event, currentEventId);
                currentEventId = null;
              } catch (e) {
                console.error('Failed to parse SSE event:', e);
              }
            }
          }
        }
      } catch (error) {
        // Check if error is due to abort signal
        if (signal?.aborted) {
          console.log('[API] Stream aborted by user');
          throw error;
        }

        // Check if we have connection token for resume
        if (!streamContext.connectionToken || streamContext.receivedComplete) {
          // No token or already complete, can't resume
          throw error;
        }

        // Check if we've exceeded retry attempts
        if (retryAttempt >= MAX_RETRY_ATTEMPTS) {
          console.error('[API] Max retry attempts reached, falling back to conversation reload');
          onEvent('error', {
            message: 'Connection lost. Please reload the page to see completed stages.',
            recoverable: false
          });
          throw error;
        }

        // Calculate exponential backoff delay
        const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryAttempt), MAX_RETRY_DELAY);
        console.log(`[API] Stream error, retrying in ${delay}ms (attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})`);

        // Notify caller about reconnection attempt
        if (onReconnect) {
          onReconnect(retryAttempt + 1, MAX_RETRY_ATTEMPTS, delay);
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry using resume (NOT sending a new message)
        console.log(`[API] Retrying with resume (attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})`);
        return attemptStream(retryAttempt + 1, true); // isResumeAttempt = true
      }
    };

    await attemptStream();
  },

  /**
   * Resume an interrupted message stream.
   * @param {string} conversationId - The conversation ID
   * @param {string} connectionToken - Connection token from original stream
   * @param {AbortSignal} signal - Abort signal for cancellation
   * @param {function} onEvent - Callback function for each event: (eventType, data) => void
   * @returns {Promise<void>}
   */
  async resumeMessageStream(conversationId, connectionToken, signal, onEvent) {
    const profileId = getCurrentProfileId();

    console.log('[API] Resuming stream with connection token');

    // Call resume endpoint
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message/stream/resume?profile_id=${profileId}`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ connection_token: connectionToken }),
        signal: signal,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to resume stream: ${errorText}`);
    }

    // Read the resumed stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEventId = null;
      for (const line of lines) {
        if (line.startsWith('id: ')) {
          currentEventId = line.slice(4);
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data);
            // Handle resume_init event
            if (event.type === 'resume_init') {
              console.log('[API] Stream resumed from stage:', event.last_stage);
              onEvent('reconnected', { last_stage: event.last_stage, remaining_stages: event.remaining_stages });
            } else {
              onEvent(event.type, event);
            }
            currentEventId = null;
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
    }
  },

  /**
   * Cancel an in-progress stream.
   * @param {string} conversationId - The conversation ID
   * @param {string} connectionToken - Connection token from original stream
   * @returns {Promise<void>}
   */
  async cancelStream(conversationId, connectionToken) {
    // Validate that we have a connection token
    if (!connectionToken) {
      console.log('[API] No connection token provided, skipping backend cancel');
      return { success: true, message: 'No active stream to cancel' };
    }

    const profileId = getCurrentProfileId();

    console.log('[API] Cancelling stream with connection token');

    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations/${conversationId}/message/stream/cancel?profile_id=${profileId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ connection_token: connectionToken }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to cancel stream: ${errorText}`);
    }

    return response.json();
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
   * Update conversation models or workflow (only allowed before first message).
   * @param {string} conversationId - Conversation ID
   * @param {string[]} councilModels - Council model identifiers (optional if workflowJson provided)
   * @param {string} chairmanModel - Chairman model identifier (optional if workflowJson provided)
   * @param {string} workflowJson - Workflow DSL JSON string (optional, overrides council config)
   */
  async updateConversationModels(conversationId, councilModels = null, chairmanModel = null, workflowJson = null) {
    const profileId = getCurrentProfileId();
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations/${conversationId}/models?profile_id=${profileId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          council_models: councilModels,
          chairman_model: chairmanModel,
          workflow_json: workflowJson,
        }),
      }
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update conversation models');
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

    // Extract filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `conversation.${format === 'markdown' ? 'md' : format}`;

    if (contentDisposition) {
      // Try RFC 5987 encoding first (filename*=UTF-8''...)
      const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (filenameStarMatch) {
        filename = decodeURIComponent(filenameStarMatch[1]);
      } else {
        // Fall back to regular filename="..." or filename=...
        const filenameMatch = contentDisposition.match(/filename=["']?([^"';\n]+)["']?/i);
        if (filenameMatch) {
          filename = filenameMatch[1].trim();
        }
      }
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    function sanitizeTitle(title) {
      return title.normalize('NFKD')  // Normalize Unicode (decomposes characters)
      .replace(/[\p{Cc}\p{Cf}]/gu, '')  // Remove control & format chars (native)
      .replace(/[<>:"'/\\|?*]/g, '')  // Remove invalid filename chars
      .replace(/…/g, '...')  // Replace ellipsis
      .replace(/[’‘’]/g, "'")  // Replace fancy apostrophes
      .replace(/[“”]/g, '"')  // Replace fancy quotes
      .trim().replace(/\s+/g, '-')  // Replace spaces with hyphens
      .substring(0, 100);
    }
    a.download = sanitizeTitle(filename);

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
   * No profile_id required - anyone can read public conversations.
   */
  async getForumConversation(conversationId) {
    const response = await fetchWithAuth(
      `${API_BASE}/api/forum/conversations/${conversationId}`
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

  // ==================== SSE Streaming ====================

  /**
   * Subscribe to conversation list updates via Server-Sent Events.
   * Uses fetch() with Authorization header for better security.
   * @param {function} onEvent - Callback function for each event: (eventType, data) => void
   * @param {string} view - View mode: "private", "public", or "all"
   * @param {AbortSignal} signal - Abort signal for disconnection
   * @returns {Promise<void>}
   */
  async subscribeToConversationUpdates(onEvent, view = 'private', signal = null) {
    const profileId = getCurrentProfileId();

    // Build URL with query parameters (no token - using Authorization header instead!)
    let url = `${API_BASE}/api/conversations/stream?view=${view}`;
    if (view !== 'public') {
      url += `&profile_id=${profileId}`;
    }

    // Use fetch() with Authorization header (more secure than query param)
    let response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
      signal: signal,
    });

    // Handle 401 with automatic token refresh
    if (response.status === 401 && getRefreshToken()) {
      console.log('[API] SSE stream got 401, refreshing token...');
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Retry with new token
        response = await fetch(url, {
          method: 'GET',
          headers: getAuthHeaders(),
          signal: signal,
        });
      } else {
        clearAuth();
        throw new Error('Authentication expired. Please log in again.');
      }
    }

    if (!response.ok) {
      throw new Error(`Failed to connect to conversation stream: ${response.status}`);
    }

    // Manual SSE parsing (same pattern as sendMessageStream)
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[API] SSE stream ended');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const event = JSON.parse(data);
              // EventSource format: {type: 'event_type', data: {...}}
              onEvent(event.type, event.data || event);
            } catch (e) {
              console.error('[API] Failed to parse SSE event:', e);
            }
          }
          // Note: 'id:' lines are ignored - not needed for conversation list updates
        }
      }
    } catch (error) {
      if (signal?.aborted) {
        console.log('[API] SSE stream aborted by user');
        return;
      }
      // On error, notify caller
      console.error('[API] SSE stream error:', error);
      onEvent('error', { message: 'Connection lost' });
      throw error;
    }
  },

  /**
   * Validate a workflow definition without saving.
   * @param {object} workflowRequest - Request object with name and workflow fields
   * @returns {Promise<object>} Validation result with valid and errors fields
   */
  async validateWorkflow(workflowRequest) {
    const response = await fetch(`${API_BASE}/api/workflows/validate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(workflowRequest),
    });

    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response);
      throw new Error(errorMessage);
    }

    return await response.json();
  },
};
