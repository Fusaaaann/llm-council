import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import AuthModal from './components/AuthModal';
import { api } from './api';
import { isAuthenticated, getCurrentUser, setAuth, clearAuth } from './auth';
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
  const [inviteToken, setInviteToken] = useState(null);

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

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Poll for conversation loading states
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
    }, 1000); // Poll every second

    return () => clearInterval(interval);
  }, []);

  // Load conversation details when selected
  useEffect(() => {
    if (currentConversationId) {
      loadConversation(currentConversationId);
    }
  }, [currentConversationId]);

  const loadConversations = async () => {
    try {
      const convs = await api.listConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadConversation = async (id) => {
    try {
      const conv = await api.getConversation(id);
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

      // Store auth data
      setAuth(result.access_token, result.refresh_token, result.user);
      setUser(result.user);
      setShowAuthModal(false);
      setInviteToken(null); // Clear invite token after use

      // Reload conversations for the authenticated user
      await loadConversations();
    } catch (error) {
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
      const response = await fetch('http://localhost:8001/api/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          council_models: councilModels,
          chairman_model: chairmanModel,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to update models');
      }
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

    // Remove the last assistant response (if any)
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
      const assistantMessage = {
        role: 'assistant',
        stage1: null,
        stage1_5: null,
        stage2: null,
        stage3: null,
        metadata: null,
        loading: {
          stage1: false,
          stage1_5: false,
          stage2: false,
          stage3: false,
        },
      };

      // Add the partial assistant message
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...(prev?.messages || []), assistantMessage],
      }));

      // Send message with streaming
      await api.sendMessageStream(currentConversationId, content, controller.signal, (eventType, event) => {
        switch (eventType) {
          case 'stage1_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage1 = true;
              return { ...prev, messages };
            });
            break;

          case 'stage1_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage1 = event.data;
              lastMsg.loading.stage1 = false;
              return { ...prev, messages };
            });
            break;

          case 'stage1_5_questions_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage1_5 = true;
              return { ...prev, messages };
            });
            break;

          case 'stage1_5_questions_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              // Store questions, but keep loading indicator
              if (!lastMsg.stage1_5) lastMsg.stage1_5 = {};
              lastMsg.stage1_5.questions = event.data;
              return { ...prev, messages };
            });
            break;

          case 'stage1_5_answers_start':
            // Keep loading indicator
            break;

          case 'stage1_5_answers_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              // Add answers and complete stage1_5
              if (!lastMsg.stage1_5) lastMsg.stage1_5 = {};
              lastMsg.stage1_5.answers = event.data;
              lastMsg.stage1_5.label_to_model = event.label_to_model;
              lastMsg.loading.stage1_5 = false;
              return { ...prev, messages };
            });
            break;

          case 'stage2_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage2 = true;
              return { ...prev, messages };
            });
            break;

          case 'stage2_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage2 = event.data;
              lastMsg.metadata = event.metadata;
              lastMsg.loading.stage2 = false;
              return { ...prev, messages };
            });
            break;

          case 'stage3_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage3 = true;
              return { ...prev, messages };
            });
            break;

          case 'stage3_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage3 = event.data;
              lastMsg.loading.stage3 = false;
              return { ...prev, messages };
            });
            break;

          case 'title_complete':
            // Reload conversations to get updated title
            loadConversations();
            break;

          case 'complete':
            // Stream complete, reload conversations list
            loadConversations();
            setIsLoading(false);
            setAbortController(null);
            break;

          case 'error':
            console.error('Stream error:', event.message);
            setIsLoading(false);
            setAbortController(null);
            break;

          default:
            console.log('Unknown event type:', eventType);
        }
      });
    } catch (error) {
      // Check if it was aborted
      if (error.name === 'AbortError') {
        console.log('Message sending cancelled');
      } else {
        console.error('Failed to send message:', error);
        // Remove optimistic messages on error
        setCurrentConversation((prev) => ({
          ...prev,
          messages: prev.messages.slice(0, -2),
        }));
      }
      setIsLoading(false);
      setAbortController(null);
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
      />
      <ChatInterface
        conversation={currentConversation}
        onSendMessage={handleSendMessage}
        onEditMessage={handleEditMessage}
        onRetryMessage={handleRetryMessage}
        onCancelMessage={handleCancelMessage}
        onUpdateModels={handleUpdateModels}
        isLoading={isLoading}
      />
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuth}
        inviteToken={inviteToken}
      />
    </div>
  );
}

export default App;
