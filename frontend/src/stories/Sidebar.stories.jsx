import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { mockConversations, mockUser } from './mockData';
import '../components/Sidebar.css';

/**
 * Sidebar component for conversation navigation and management.
 *
 * ## Features
 * - Conversation list with real-time updates
 * - Public/Private view toggle
 * - Sync status indicators (☁️ synced, ⏳ syncing, 💾 local)
 * - Badges (🌐 public, 🔑 BYOK)
 * - Context menu (rename, delete, export, publish)
 * - Authentication UI
 * - New conversation button
 */
export default {
  title: 'Components/Sidebar',
  component: Sidebar,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Navigation sidebar for managing conversations, switching views, and authentication.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    onSelectConversation: { action: 'select conversation' },
    onNewConversation: { action: 'new conversation' },
    onRenameConversation: { action: 'rename conversation' },
    onDeleteConversation: { action: 'delete conversation' },
    onExportConversation: { action: 'export conversation' },
    onPublishConversation: { action: 'publish conversation' },
    onUnpublishConversation: { action: 'unpublish conversation' },
    onLogin: { action: 'login' },
    onLogout: { action: 'logout' },
    onAbout: { action: 'about' },
    onViewChange: { action: 'view change' }
  },
  decorators: [
    (Story) => (
      <div style={{ height: '600px', display: 'flex' }}>
        <Story />
      </div>
    )
  ]
};

// ========== BASIC STATES ==========

/**
 * Empty sidebar with no conversations.
 */
export const EmptyState = {
  args: {
    conversations: [],
    currentConversationId: null,
    onSelectConversation: () => {},
    onNewConversation: () => {},
    onRenameConversation: () => {},
    onDeleteConversation: () => {},
    onExportConversation: () => {},
    onPublishConversation: () => {},
    onUnpublishConversation: () => {},
    user: mockUser,
    onLogin: () => {},
    onLogout: () => {},
    onAbout: () => {},
    currentView: 'private',
    onViewChange: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty state when user has no conversations yet.'
      }
    }
  }
};

/**
 * Sidebar with multiple conversations.
 */
export const WithConversations = {
  args: {
    conversations: mockConversations,
    currentConversationId: 'conv-2',
    onSelectConversation: () => {},
    onNewConversation: () => {},
    onRenameConversation: () => {},
    onDeleteConversation: () => {},
    onExportConversation: () => {},
    onPublishConversation: () => {},
    onUnpublishConversation: () => {},
    user: mockUser,
    onLogin: () => {},
    onLogout: () => {},
    onAbout: () => {},
    currentView: 'private',
    onViewChange: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Sidebar with conversation list. Second conversation is active/highlighted.'
      }
    }
  }
};

/**
 * Sidebar showing logged out state.
 */
export const LoggedOut = {
  args: {
    conversations: mockConversations,
    currentConversationId: 'conv-1',
    onSelectConversation: () => {},
    onNewConversation: () => {},
    onRenameConversation: () => {},
    onDeleteConversation: () => {},
    onExportConversation: () => {},
    onPublishConversation: () => {},
    onUnpublishConversation: () => {},
    user: null,
    onLogin: () => {},
    onLogout: () => {},
    onAbout: () => {},
    currentView: 'private',
    onViewChange: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Sidebar when user is logged out. Shows Login/Register button.'
      }
    }
  }
};

// ========== VIEW STATES ==========

/**
 * Private conversations view (My Conversations).
 */
export const PrivateView = {
  args: {
    conversations: mockConversations,
    currentConversationId: 'conv-1',
    onSelectConversation: () => {},
    onNewConversation: () => {},
    onRenameConversation: () => {},
    onDeleteConversation: () => {},
    onExportConversation: () => {},
    onPublishConversation: () => {},
    onUnpublishConversation: () => {},
    user: mockUser,
    onLogin: () => {},
    onLogout: () => {},
    onAbout: () => {},
    currentView: 'private',
    onViewChange: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Private view showing user\'s own conversations with menu buttons visible.'
      }
    }
  }
};

/**
 * Public forum view.
 */
export const PublicView = {
  args: {
    conversations: mockConversations.filter(c => c.is_public),
    currentConversationId: null,
    onSelectConversation: () => {},
    onNewConversation: () => {},
    onRenameConversation: () => {},
    onDeleteConversation: () => {},
    onExportConversation: () => {},
    onPublishConversation: () => {},
    onUnpublishConversation: () => {},
    user: mockUser,
    onLogin: () => {},
    onLogout: () => {},
    onAbout: () => {},
    currentView: 'public',
    onViewChange: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Public forum view showing only published conversations. Menu buttons hidden, no New Conversation button.'
      }
    }
  }
};

// ========== BADGE STATES ==========

/**
 * Conversation with various status indicators.
 */
export const StatusBadges = {
  render: (args) => (
    <div style={{ height: '600px', display: 'flex', gap: '1rem' }}>
      <div style={{ flex: 1 }}>
        <h4 style={{ marginBottom: '0.5rem' }}>Sync Status</h4>
        <Sidebar {...args} conversations={[
          { ...mockConversations[0], sync_status: 'synced', title: 'Synced to Cloud ☁️' },
          { ...mockConversations[1], sync_status: 'syncing', title: 'Syncing... ⏳' },
          { ...mockConversations[2], sync_status: 'local', title: 'Local Only 💾' }
        ]} />
      </div>
      <div style={{ flex: 1 }}>
        <h4 style={{ marginBottom: '0.5rem' }}>Visibility & BYOK</h4>
        <Sidebar {...args} conversations={[
          { ...mockConversations[0], is_public: true, title: 'Public 🌐' },
          { ...mockConversations[1], uses_byok: true, title: 'BYOK 🔑' },
          { ...mockConversations[2], is_public: true, uses_byok: true, title: 'Public + BYOK 🌐🔑' }
        ]} />
      </div>
    </div>
  ),
  args: {
    currentConversationId: null,
    onSelectConversation: () => {},
    onNewConversation: () => {},
    onRenameConversation: () => {},
    onDeleteConversation: () => {},
    onExportConversation: () => {},
    onPublishConversation: () => {},
    onUnpublishConversation: () => {},
    user: mockUser,
    onLogin: () => {},
    onLogout: () => {},
    onAbout: () => {},
    currentView: 'private',
    onViewChange: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Comparison of different status badges: sync status (☁️⏳💾), public badge (🌐), and BYOK badge (🔑).'
      }
    }
  }
};

/**
 * Conversation with loading indicator (streaming in progress).
 */
export const LoadingIndicator = {
  args: {
    conversations: [
      { ...mockConversations[0], is_loading: true, title: 'Generating response...' },
      ...mockConversations.slice(1)
    ],
    currentConversationId: 'conv-1',
    onSelectConversation: () => {},
    onNewConversation: () => {},
    onRenameConversation: () => {},
    onDeleteConversation: () => {},
    onExportConversation: () => {},
    onPublishConversation: () => {},
    onUnpublishConversation: () => {},
    user: mockUser,
    onLogin: () => {},
    onLogout: () => {},
    onAbout: () => {},
    currentView: 'private',
    onViewChange: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Conversation with loading spinner indicating active streaming response.'
      }
    }
  }
};

// ========== INTERACTIVE STATES ==========

/**
 * Interactive demo with stateful menu.
 */
export const InteractiveDemo = {
  render: function InteractiveSidebar(args) {
    const [conversations, setConversations] = useState(mockConversations);
    const [currentId, setCurrentId] = useState('conv-2');

    const handleRename = (id, newTitle) => {
      setConversations(prev =>
        prev.map(c => c.id === id ? { ...c, title: newTitle } : c)
      );
    };

    const handleDelete = (id) => {
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentId === id) setCurrentId(null);
    };

    const handlePublish = (id) => {
      setConversations(prev =>
        prev.map(c => c.id === id ? { ...c, is_public: true } : c)
      );
    };

    const handleUnpublish = (id) => {
      setConversations(prev =>
        prev.map(c => c.id === id ? { ...c, is_public: false } : c)
      );
    };

    return (
      <Sidebar
        {...args}
        conversations={conversations}
        currentConversationId={currentId}
        onSelectConversation={setCurrentId}
        onRenameConversation={handleRename}
        onDeleteConversation={handleDelete}
        onPublishConversation={handlePublish}
        onUnpublishConversation={handleUnpublish}
      />
    );
  },
  args: {
    onNewConversation: () => {},
    onExportConversation: () => {},
    user: mockUser,
    onLogin: () => {},
    onLogout: () => {},
    onAbout: () => {},
    currentView: 'private',
    onViewChange: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Fully interactive sidebar demo. Try selecting, renaming, deleting, and publishing conversations.'
      }
    }
  }
};

/**
 * Sidebar with context menu open.
 * Shows rename, publish, export, delete options.
 */
export const ContextMenuOpen = {
  render: function SidebarWithMenu(args) {
    // Note: This is a visual representation only
    // Actual menu opening requires user interaction
    return (
      <div style={{ height: '600px', display: 'flex' }}>
        <Sidebar {...args} />
        <div style={{
          position: 'absolute',
          left: '240px',
          top: '180px',
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '0.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          fontSize: '14px'
        }}>
          <div style={{ padding: '0.5rem', cursor: 'pointer' }}>✏️ Rename</div>
          <div style={{ padding: '0.5rem', cursor: 'pointer' }}>🌐 Publish to Forum</div>
          <div style={{ padding: '0.5rem', cursor: 'pointer' }}>📄 Export (Markdown)</div>
          <div style={{ padding: '0.5rem', cursor: 'pointer' }}>🌐 Export (HTML)</div>
          <div style={{ padding: '0.5rem', cursor: 'pointer' }}>📋 Export (JSON)</div>
          <div style={{ padding: '0.5rem', cursor: 'pointer', color: '#d32f2f' }}>🗑️ Delete</div>
        </div>
      </div>
    );
  },
  args: {
    conversations: mockConversations,
    currentConversationId: 'conv-2',
    onSelectConversation: () => {},
    onNewConversation: () => {},
    onRenameConversation: () => {},
    onDeleteConversation: () => {},
    onExportConversation: () => {},
    onPublishConversation: () => {},
    onUnpublishConversation: () => {},
    user: mockUser,
    onLogin: () => {},
    onLogout: () => {},
    onAbout: () => {},
    currentView: 'private',
    onViewChange: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Visual representation of context menu (click ⋮ on a conversation to open). Actual interaction requires InteractiveDemo.'
      }
    }
  }
};
