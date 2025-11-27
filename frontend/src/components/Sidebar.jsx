import { useState } from 'react';
import './Sidebar.css';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  onExportConversation,
  onPublishConversation,
  onUnpublishConversation,
  user,
  onLogin,
  onLogout,
  onAbout,
}) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const handleMenuToggle = (convId, e) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === convId ? null : convId);
  };

  const handleRename = (conv, e) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
    setOpenMenuId(null);
  };

  const handleRenameSubmit = (convId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameConversation(convId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleRenameCancel = (e) => {
    e.stopPropagation();
    setEditingId(null);
    setEditTitle('');
  };

  const handleDelete = (convId, e) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this conversation?')) {
      onDeleteConversation(convId);
    }
    setOpenMenuId(null);
  };

  const handleExport = (convId, format, e) => {
    e.stopPropagation();
    onExportConversation(convId, format);
    setOpenMenuId(null);
  };

  const handlePublish = (conv, e) => {
    e.stopPropagation();
    if (conv.uses_byok) {
      alert('Cannot publish conversations that use your own API key (BYOK)');
      return;
    }
    onPublishConversation(conv.id);
    setOpenMenuId(null);
  };

  const handleUnpublish = (convId, e) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to unpublish this conversation from the forum?')) {
      onUnpublishConversation(convId);
    }
    setOpenMenuId(null);
  };

  const getSyncStatusIcon = (syncStatus) => {
    switch (syncStatus) {
      case 'synced':
        return '☁️'; // Cloud synced
      case 'syncing':
        return '⏳'; // Syncing
      case 'local':
      default:
        return '💾'; // Local only
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title-row">
          <h1>LLM Council</h1>
          <button className="about-icon-btn" onClick={onAbout} title="About LLM Council">
            ℹ️
          </button>
        </div>
        <button className="new-conversation-btn" onClick={onNewConversation}>
          + New Conversation
        </button>
      </div>

      {/* Auth section */}
      <div className="auth-section">
        {user ? (
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <button className="logout-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        ) : (
          <button className="login-btn" onClick={onLogin}>
            Login / Register
          </button>
        )}
      </div>

      <div className="conversation-list">
        {conversations.length === 0 ? (
          <div className="no-conversations">No conversations yet</div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${
                conv.id === currentConversationId ? 'active' : ''
              }`}
              onClick={() => onSelectConversation(conv.id)}
            >
              <div className="conversation-content">
                {editingId === conv.id ? (
                  <form onSubmit={(e) => handleRenameSubmit(conv.id, e)} className="rename-form">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') handleRenameCancel(e);
                      }}
                      className="rename-input"
                      autoFocus
                    />
                    <button type="submit" className="rename-btn">✓</button>
                    <button type="button" onClick={handleRenameCancel} className="rename-btn">✗</button>
                  </form>
                ) : (
                  <>
                    <div className="conversation-info">
                      <div className="conversation-title">
                        <span className="sync-status-icon" title={`Status: ${conv.sync_status || 'local'}`}>
                          {getSyncStatusIcon(conv.sync_status)}
                        </span>
                        {conv.is_public && <span className="public-badge" title="Public conversation">🌐</span>}
                        {conv.uses_byok && <span className="byok-badge" title="Uses your API key">🔑</span>}
                        {conv.title || 'New Conversation'}
                        {conv.is_loading && (
                          <span className="loading-indicator">
                            <svg className="spinner" viewBox="0 0 24 24">
                              <circle className="spinner-circle" cx="12" cy="12" r="10" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div className="conversation-meta">
                        {conv.message_count} messages
                      </div>
                    </div>
                    <button
                      className="menu-button"
                      onClick={(e) => handleMenuToggle(conv.id, e)}
                    >
                      ⋮
                    </button>
                    {openMenuId === conv.id && (
                      <div className="conversation-menu">
                        <button onClick={(e) => handleRename(conv, e)}>
                          ✏️ Rename
                        </button>
                        {conv.is_public ? (
                          <button onClick={(e) => handleUnpublish(conv.id, e)}>
                            🔒 Make Private
                          </button>
                        ) : (
                          <button onClick={(e) => handlePublish(conv, e)} disabled={conv.uses_byok}>
                            🌐 Publish to Forum
                          </button>
                        )}
                        <button onClick={(e) => handleExport(conv.id, 'markdown', e)}>
                          📄 Export to Markdown
                        </button>
                        <button onClick={(e) => handleExport(conv.id, 'pdf', e)}>
                          📑 Export to PDF
                        </button>
                        <button onClick={(e) => handleDelete(conv.id, e)} className="delete-btn">
                          🗑️ Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
