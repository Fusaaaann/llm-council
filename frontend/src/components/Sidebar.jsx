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

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>LLM Council</h1>
        <button className="new-conversation-btn" onClick={onNewConversation}>
          + New Conversation
        </button>
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
