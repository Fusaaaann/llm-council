import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import AuthModal from './components/AuthModal';
import AboutModal from './components/AboutModal';
import { api, API_BASE } from './api';
import { isAuthenticated, getCurrentUser, setAuth, clearAuth, getProfileIdKey } from './auth';
import { useQueryState } from './queryState.jsx';
import './App.css';

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingIntervalId, setLoadingIntervalId] = useState(null);
  const [abortController, setAbortController] = useState(null);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [inviteToken, setInviteToken] = useState(null);
  const [currentView, setCurrentView] = useState('private');
  const [reconnectionStatus, setReconnectionStatus] = useState(null); // { attempt, maxAttempts, delay }

  // Query state management
  const queryState = useQueryState();

  // Check for invite token in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) {
      setInviteToken(invite);
      setShowAuthModal(true);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Initialize authentication state
  useEffect(() => {
    if (isAuthenticated()) {
      setUser(getCurrentUser());
    }
  }, []);

  // Subscribe to conversation list updates via SSE
  useEffect(() => {
    let streamActive = true;
    const abortController = new AbortController();

    const handleEvent = (eventType, data) => {
      console.log(`[SSE] Received event: ${eventType}`, data);

      switch (eventType) {
        case 'initial':
          // Full conversation list on connection
          setConversations(data);
          break;

        case 'conversation_created':
          // New conversation added
          setConversations(prev => [...prev, data]);
          break;

        case 'conversation_updated':
          // Conversation modified
          setConversations(prev =>
            prev.map(conv => conv.id === data.id ? data : conv)
          );
          // If current conversation was updated, refresh it
          if (currentConversationId === data.id) {
            loadConversation(data.id);
          }
          break;

        case 'conversation_deleted':
          // Conversation removed
          setConversations(prev =>
            prev.filter(conv => conv.id !== data.id)
          );
          // If current conversation was deleted, clear selection
          if (currentConversationId === data.id) {
            setCurrentConversationId(null);
            setCurrentConversation(null);
          }
          break;

        case 'heartbeat':
          // Keep-alive - no action needed
          break;

        case 'error':
          console.error('[SSE] Error:', data.message);
          // Fallback to polling on error
          loadConversations();
          break;

        default:
          console.warn('[SSE] Unknown event type:', eventType);
      }
    };

    const startStream = async () => {
      try {
        console.log('[SSE] Starting conversation updates stream');
        await api.subscribeToConversationUpdates(
          handleEvent,
          currentView,
          abortController.signal
        );

        // Stream ended naturally, reconnect if still active
        if (streamActive) {
          console.log('[SSE] Stream ended, reconnecting in 1s...');
          setTimeout(startStream, 1000);
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          console.log('[SSE] Stream aborted by cleanup');
          return;
        }

        console.error('[SSE] Failed to subscribe:', error);

        // Fallback to initial load
        loadConversations();

        // Retry connection if still active
        if (streamActive) {
          console.log('[SSE] Retrying connection in 5s...');
          setTimeout(startStream, 5000);
        }
      }
    };

    startStream();

    return () => {
      console.log('[SSE] Unsubscribing from conversation updates');
      streamActive = false;
      abortController.abort();
    };
  }, [currentView, currentConversationId]);

  // Load conversation details when selected
  useEffect(() => {
    if (currentConversationId) {
      loadConversation(currentConversationId);
    }
  }, [currentConversationId]);

  const loadConversations = async () => {
    try {
      const convs = await api.listConversations(currentView);
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const handleViewChange = (view) => {
    setCurrentView(view);
    // Clear current conversation when switching views
    setCurrentConversationId(null);
    setCurrentConversation(null);
  };

  const loadConversation = async (id) => {
    try {
      // Use different endpoint based on view
      const conv = currentView === 'public'
        ? await api.getForumConversation(id)
        : await api.getConversation(id);
      setCurrentConversation(conv);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleNewConversation = async () => {
    try {
      const newConv = await api.createConversation();
      setConversations([
        { id: newConv.id, created_at: newConv.created_at, message_count: 0 },
        ...conversations,
      ]);
      setCurrentConversationId(newConv.id);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSelectConversation = (id) => {
    setCurrentConversationId(id);
  };

  const handleRenameConversation = async (id, title) => {
    try {
      await api.renameConversation(id, title);
      await loadConversations();
      if (currentConversationId === id) {
        await loadConversation(id);
      }
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    }
  };

  const handleDeleteConversation = async (id) => {
    try {
      await api.deleteConversation(id);
      // If we deleted the current conversation, clear it
      if (currentConversationId === id) {
        setCurrentConversationId(null);
        setCurrentConversation(null);
      }
      await loadConversations();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleExportConversation = async (id, format) => {
    try {
      await api.exportConversation(id, format);
    } catch (error) {
      console.error('Failed to export conversation:', error);
      alert('Export to PDF is not yet implemented. Please use Markdown export.');
    }
  };

  const handlePublishConversation = async (id) => {
    try {
      await api.publishConversation(id);
      await loadConversations();
      if (currentConversationId === id) {
        await loadConversation(id);
      }
    } catch (error) {
      console.error('Failed to publish conversation:', error);
      alert('Failed to publish conversation. Please try again.');
    }
  };

  const handleUnpublishConversation = async (id) => {
    try {
      await api.unpublishConversation(id);
      await loadConversations();
      if (currentConversationId === id) {
        await loadConversation(id);
      }
    } catch (error) {
      console.error('Failed to unpublish conversation:', error);
      alert('Failed to unpublish conversation. Please try again.');
    }
  };

  const handleAuth = async (mode, credentials) => {
    try {
      console.log('[APP] handleAuth called, mode:', mode);
      let result;
      if (mode === 'register') {
        result = await api.register(
          credentials.email,
          credentials.password,
          credentials.name,
          credentials.invite_token
        );
      } else {
        result = await api.login(credentials.email, credentials.password);
      }

      console.log('[APP] Auth API call successful, result:', {
        hasAccessToken: !!result.access_token,
        hasRefreshToken: !!result.refresh_token,
        user: result.user
      });

      // Store auth data
      console.log('[APP] Calling setAuth with tokens...');
      setAuth(result.access_token, result.refresh_token, result.user);
      console.log('[APP] Setting user state...');
      setUser(result.user);
      setShowAuthModal(false);
      setInviteToken(null); // Clear invite token after use

      console.log('[APP] Auth complete, reloading conversations...');
      // Reload conversations for the authenticated user
      await loadConversations();
    } catch (error) {
      console.error('[APP] handleAuth error:', error);
      throw error; // Re-throw to be handled by AuthModal
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }

    clearAuth();
    setUser(null);
    setConversations([]);
    setCurrentConversationId(null);
    setCurrentConversation(null);
  };

  const handleUpdateModels = async (councilModels, chairmanModel) => {
    try {
      // Update conversation models if it's a new conversation (no messages yet)
      if (currentConversationId && (!currentConversation?.messages || currentConversation.messages.length === 0)) {
        await api.updateConversationModels(currentConversationId, councilModels, chairmanModel);
        // Reload conversation to reflect changes
        await loadConversation(currentConversationId);
      }
      // For existing conversations with messages, models are read-only (enforced by ModelConfig UI)
    } catch (error) {
      console.error('Failed to update models:', error);
      throw error;
    }
  };

  const handleEditMessage = (content) => {
    // Remove the last user message and its response (if any)
    setCurrentConversation((prev) => {
      const messages = [...prev.messages];
      // Remove last message if it's assistant, then remove last user message
      if (messages[messages.length - 1]?.role === 'assistant') {
        messages.pop();
      }
      if (messages[messages.length - 1]?.role === 'user') {
        messages.pop();
      }
      return { ...prev, messages };
    });
    // Note: The input field will be populated via ChatInterface
  };

  const handleRetryMessage = async (content) => {
    if (!currentConversationId || isLoading) return;

    // Remove the assistant response (completed or incomplete)
    // The backend will also remove it and create a fresh one
    setCurrentConversation((prev) => {
      const messages = [...prev.messages];
      if (messages[messages.length - 1]?.role === 'assistant') {
        messages.pop();
      }
      return { ...prev, messages };
    });

    // Resend the message (skip adding user message since it already exists)
    await handleSendMessage(content, true);
  };

  const handleCancelMessage = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    // Cancel query state
    if (currentConversationId) {
      queryState.cancelQuery(currentConversationId);
    }
    setIsLoading(false);
    // Remove the partial assistant response
    setCurrentConversation((prev) => {
      const messages = [...prev.messages];
      if (messages[messages.length - 1]?.role === 'assistant') {
        messages.pop();
      }
      return { ...prev, messages };
    });
  };

  const handleSendMessage = async (content, skipAddingUserMessage = false) => {
    if (!currentConversationId) return;

    // Create abort controller for cancellation
    const controller = new AbortController();
    setAbortController(controller);

    setIsLoading(true);

    // Start query state tracking
    queryState.startQuery(currentConversationId);

    try {
      // Optimistically add user message to UI (unless retrying)
      if (!skipAddingUserMessage) {
        const userMessage = { role: 'user', content };
        setCurrentConversation((prev) => ({
          ...prev,
          messages: [...(prev?.messages || []), userMessage],
        }));
      }

      // Create a partial assistant message that will be updated progressively
      // (unless retrying, in which case we already removed the old one and will create fresh)
      if (!skipAddingUserMessage) {
        const assistantMessage = {
          role: 'assistant',
          stage1: null,
          stage1_5: null,
          stage2: null,
          stage3: null,
          metadata: null,
        };

        // Add the partial assistant message
        setCurrentConversation((prev) => ({
          ...prev,
          messages: [...(prev?.messages || []), assistantMessage],
        }));
      }
      // If retrying (skipAddingUserMessage=true), don't create assistant message yet
      // Backend will create it via save_partial_assistant_message() and we'll get it via events

      // Send message with streaming and reconnection handler
      await api.sendMessageStream(
        currentConversationId,
        content,
        controller.signal,
        (eventType, event) => {
        switch (eventType) {
          case 'stage1_start':
            queryState.updateStageStatus(currentConversationId, 'stage1', 'loading');
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];

              // If last message is not assistant (retry scenario), create it
              if (!lastMsg || lastMsg.role !== 'assistant') {
                messages.push({
                  role: 'assistant',
                  stage1: null,
                  stage1_5: null,
                  stage2: null,
                  stage3: null,
                  metadata: null,
                });
              }
              return { ...prev, messages };
            });
            break;

          case 'stage1_complete':
            queryState.updateStageStatus(currentConversationId, 'stage1', 'complete');
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              messages[messages.length - 1] = {
                ...lastMsg,
                stage1: event.data,
              };
              return { ...prev, messages };
            });
            break;

          case 'stage1_5_questions_start':
            queryState.updateStageStatus(currentConversationId, 'stage1_5', 'loading');
            break;

          case 'stage1_5_questions_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              // Store questions, but keep loading indicator
              messages[messages.length - 1] = {
                ...lastMsg,
                stage1_5: {
                  ...(lastMsg.stage1_5 || {}),
                  questions: event.data
                }
              };
              return { ...prev, messages };
            });
            break;

          case 'stage1_5_answers_start':
            // Keep loading indicator
            break;

          case 'stage1_5_answers_complete':
            queryState.updateStageStatus(currentConversationId, 'stage1_5', 'complete');
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              // Add answers and complete stage1_5
              messages[messages.length - 1] = {
                ...lastMsg,
                stage1_5: {
                  ...(lastMsg.stage1_5 || {}),
                  answers: event.data,
                  label_to_model: event.label_to_model
                },
              };
              return { ...prev, messages };
            });
            break;

          case 'stage2_start':
            queryState.updateStageStatus(currentConversationId, 'stage2', 'loading');
            break;

          case 'stage2_complete':
            queryState.updateStageStatus(currentConversationId, 'stage2', 'complete');
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              messages[messages.length - 1] = {
                ...lastMsg,
                stage2: event.data,
                metadata: event.metadata,
              };
              return { ...prev, messages };
            });
            break;

          case 'stage3_start':
            queryState.updateStageStatus(currentConversationId, 'stage3', 'loading');
            break;

          case 'stage3_complete':
            queryState.updateStageStatus(currentConversationId, 'stage3', 'complete');
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              messages[messages.length - 1] = {
                ...lastMsg,
                stage3: event.data,
              };
              return { ...prev, messages };
            });
            // Clear loading state immediately after stage3 completes
            // Don't wait for 'complete' event which may be delayed
            setIsLoading(false);
            break;

          case 'title_complete':
            // Optimistically update the title in local state
            if (event.data && event.data.title) {
              const newTitle = event.data.title;

              // Update conversations list
              setConversations((prev) =>
                prev.map((conv) =>
                  conv.id === currentConversationId
                    ? { ...conv, title: newTitle }
                    : conv
                )
              );

              // Update current conversation if it matches
              setCurrentConversation((prev) =>
                prev && prev.id === currentConversationId
                  ? { ...prev, title: newTitle }
                  : prev
              );
            }

            // Still reload to ensure eventual convergence
            loadConversations();
            break;

          case 'complete':
            // Stream complete, mark query as complete
            queryState.completeQuery(currentConversationId);
            loadConversations();
            setIsLoading(false);
            setAbortController(null);
            break;

          case 'error':
            console.error('Stream error:', event.message);
            queryState.cancelQuery(currentConversationId);
            setIsLoading(false);
            setAbortController(null);
            break;

          case 'heartbeat':
            // Keepalive event, no action needed
            console.log('[Stream] Heartbeat received at', new Date(event.timestamp * 1000));
            break;

          case 'reconnected':
            // Stream resumed after network interruption
            console.log('[Stream] Reconnected! Resumed from stage:', event.last_stage);
            setReconnectionStatus(null); // Clear reconnection status
            // Continue processing remaining stages normally
            break;

          case 'auth_expired':
            // Token expired or user logged out elsewhere during stream
            console.log('[Stream] Auth expired:', event.reason);
            setIsLoading(false);
            setAbortController(null);
            setReconnectionStatus(null);

            if (event.reason === 'logged_out') {
              // User logged out elsewhere
              alert(event.message || 'Session ended. Please log in again.');
              handleLogout();
            } else {
              // Token expired - try to refresh
              console.log('[Stream] Attempting to refresh token...');
              api.refreshAccessToken()
                .then(refreshed => {
                  if (refreshed) {
                    console.log('[Stream] Token refreshed, stream can be retried');
                    // Note: User can manually retry with the retry button
                  } else {
                    console.log('[Stream] Token refresh failed, logging out');
                    alert('Session expired. Please log in again.');
                    handleLogout();
                  }
                })
                .catch(err => {
                  console.error('[Stream] Token refresh error:', err);
                  alert('Session expired. Please log in again.');
                  handleLogout();
                });
            }
            break;

          default:
            console.log('Unknown event type:', eventType);
        }
      },
      // Reconnection callback
      (attempt, maxAttempts, delay) => {
        console.log(`[Stream] Reconnection attempt ${attempt}/${maxAttempts} in ${delay}ms`);
        setReconnectionStatus({ attempt, maxAttempts, delay: Math.round(delay / 1000) });
      });
    } catch (error) {
      // Check if it was aborted
      if (error.name === 'AbortError') {
        console.log('Message sending cancelled');
        queryState.cancelQuery(currentConversationId);
      } else {
        console.error('Failed to send message:', error);
        queryState.cancelQuery(currentConversationId);
        // Remove optimistic messages on error
        setCurrentConversation((prev) => ({
          ...prev,
          messages: prev.messages.slice(0, -2),
        }));
      }
      setIsLoading(false);
      setAbortController(null);
      setReconnectionStatus(null); // Clear reconnection status on error
    }
  };

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onExportConversation={handleExportConversation}
        onPublishConversation={handlePublishConversation}
        onUnpublishConversation={handleUnpublishConversation}
        user={user}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onAbout={() => setShowAboutModal(true)}
        currentView={currentView}
        onViewChange={handleViewChange}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {reconnectionStatus && (
          <div
            style={{
              backgroundColor: '#ff9800',
              color: 'white',
              padding: '10px 20px',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              zIndex: 1000,
            }}
          >
            ⚠️ Connection lost. Reconnecting in {reconnectionStatus.delay}s... (Attempt {reconnectionStatus.attempt}/{reconnectionStatus.maxAttempts})
          </div>
        )}
        <ChatInterface
          conversation={currentConversation}
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
          onRetryMessage={handleRetryMessage}
          onCancelMessage={handleCancelMessage}
          onUpdateModels={handleUpdateModels}
          isLoading={isLoading}
          queryState={currentConversationId ? queryState.getQueryState(currentConversationId) : null}
          isReadOnly={
            // Read-only if: viewing public forum AND conversation doesn't belong to current user
            currentView === 'public' &&
            currentConversation &&
            currentConversation.profile_id !== localStorage.getItem(getProfileIdKey())
          }
        />
      </div>
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuth}
        inviteToken={inviteToken}
      />
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
    </div>
  );
}

export default App;
