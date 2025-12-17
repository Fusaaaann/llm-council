import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import UnifiedStage from './UnifiedStage';
import ModelConfig from './ModelConfig';
import './ChatInterface.css';

export default function ChatInterface({
  conversation,
  onSendMessage,
  isLoading,
  onEditMessage,
  onRetryMessage,
  onCancelMessage,
  onUpdateModels,
  queryState,
  errorMessage,
  isReadOnly = false,
}) {
  const [input, setInput] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  const handleEdit = (content) => {
    onEditMessage(content);
    setInput(content);
    // Focus the input field after a brief delay to allow state update
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!conversation) {
    return (
      <div className="chat-interface">
        <div className="empty-state">
          <h2>Welcome to LLM Council</h2>
          <p>Create a new conversation to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-interface">
      {errorMessage && (
        <div
          className="error-banner"
          style={{
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            padding: '12px',
            margin: '8px',
            borderRadius: '4px',
            color: '#c00',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span><strong>Error:</strong> {errorMessage}</span>
          <button
            onClick={() => onSendMessage && onSendMessage('')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#c00',
              padding: '0 8px'
            }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
      <div className="messages-container">
        {conversation.messages.length === 0 ? (
          <div className="empty-state">
            <h2>Start a conversation</h2>
            <p>Ask a question to consult the LLM Council</p>
          </div>
        ) : (
          conversation.messages.map((msg, index) => {
            const isLastUserMessage = msg.role === 'user' &&
              index === conversation.messages.length - 2 &&
              conversation.messages[conversation.messages.length - 1]?.role === 'assistant';
            const isOnlyUserMessage = msg.role === 'user' &&
              index === conversation.messages.length - 1;
            const showActions = (isLastUserMessage || isOnlyUserMessage) && !isLoading && !isReadOnly;

            return (
              <div key={index} className="message-group">
                {msg.role === 'user' ? (
                  <div className="user-message">
                    <div className="message-label">You</div>
                    <div className="message-content">
                      <div className="markdown-content">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      {showActions && (
                        <div className="message-actions">
                          <button
                            className="action-button"
                            onClick={() => handleEdit(msg.content)}
                            title="Edit message"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="action-button"
                            onClick={() => onRetryMessage(msg.content)}
                            title="Retry this message"
                          >
                            🔄 Retry
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                <div className="assistant-message">
                  {/* Unified stage component - auto-detects council vs workflow */}
                  <UnifiedStage
                    message={msg}
                    queryState={queryState}
                    isLoading={isLoading && index === conversation.messages.length - 1}
                  />
                </div>
              )}
            </div>
          );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {isReadOnly ? (
        <div className="read-only-notice">
          <p>📖 This is a public conversation. View only.</p>
        </div>
      ) : (
        <form className="input-form" onSubmit={handleSubmit}>
          <button
            type="button"
            className="config-button"
            onClick={() => setIsConfigOpen(true)}
            title="Configure models"
          >
            ⚙️
          </button>
          <textarea
            ref={inputRef}
            className="message-input"
            placeholder="Ask your question... (Shift+Enter for new line, Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={3}
          />
          {isLoading ? (
            <button
              type="button"
              className="cancel-button"
              onClick={onCancelMessage}
            >
              ⏹ Stop
            </button>
          ) : (
            <button
              type="submit"
              className="send-button"
              disabled={!input.trim()}
            >
              Send
            </button>
          )}
        </form>
      )}

      <ModelConfig
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSave={onUpdateModels}
        currentConversationId={conversation?.id}
        currentConversation={conversation}
      />
    </div>
  );
}
