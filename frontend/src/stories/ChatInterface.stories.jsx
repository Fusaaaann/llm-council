import ChatInterface from '../components/ChatInterface';
import {
  mockEmptyConversation,
  mockCouncilConversation,
  mockWorkflowConversation,
  mockMultiTurnConversation,
  mockQueryState,
  mockLoadingQueryState,
  mockUserMessage,
  mockPartialCouncilMessage1
} from './mockData';
import '../components/ChatInterface.css';

/**
 * ChatInterface is the main conversation UI component.
 *
 * ## Features
 * - Message display with markdown rendering
 * - UnifiedStage integration for council/workflow results
 * - Edit/Retry actions for user messages
 * - Stop/Cancel during streaming
 * - Model configuration modal
 * - Read-only mode for public conversations
 */
export default {
  title: 'Components/ChatInterface',
  component: ChatInterface,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Main chat interface for displaying conversations and handling user input.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    onSendMessage: { action: 'send message' },
    onEditMessage: { action: 'edit message' },
    onRetryMessage: { action: 'retry message' },
    onCancelMessage: { action: 'cancel message' },
    onUpdateModels: { action: 'update models' }
  }
};

// ========== BASIC STATES ==========

/**
 * Empty state shown when no conversation is selected.
 */
export const NoConversation = {
  args: {
    conversation: null,
    onSendMessage: () => {},
    isLoading: false,
    onEditMessage: () => {},
    onRetryMessage: () => {},
    onCancelMessage: () => {},
    onUpdateModels: () => {},
    queryState: null,
    isReadOnly: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty state displayed when no conversation is selected. Shows welcome message.'
      }
    }
  }
};

/**
 * New conversation with no messages yet.
 */
export const EmptyConversation = {
  args: {
    conversation: mockEmptyConversation,
    onSendMessage: () => {},
    isLoading: false,
    onEditMessage: () => {},
    onRetryMessage: () => {},
    onCancelMessage: () => {},
    onUpdateModels: () => {},
    queryState: null,
    isReadOnly: false
  },
  parameters: {
    docs: {
      description: {
        story: 'New conversation with no messages. Shows prompt to start asking questions.'
      }
    }
  }
};

/**
 * User message only, waiting for assistant response.
 */
export const UserMessageOnly = {
  args: {
    conversation: {
      ...mockEmptyConversation,
      messages: [mockUserMessage]
    },
    onSendMessage: () => {},
    isLoading: false,
    onEditMessage: () => {},
    onRetryMessage: () => {},
    onCancelMessage: () => {},
    onUpdateModels: () => {},
    queryState: null,
    isReadOnly: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Single user message with edit/retry actions available.'
      }
    }
  }
};

// ========== COUNCIL CONVERSATIONS ==========

/**
 * Complete council conversation with all stages visible.
 */
export const CouncilConversation = {
  args: {
    conversation: mockCouncilConversation,
    onSendMessage: () => {},
    isLoading: false,
    onEditMessage: () => {},
    onRetryMessage: () => {},
    onCancelMessage: () => {},
    onUpdateModels: () => {},
    queryState: mockQueryState,
    isReadOnly: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete council conversation showing user question and full 4-stage deliberation response.'
      }
    }
  }
};

/**
 * Multi-turn council conversation with multiple exchanges.
 */
export const MultiTurnConversation = {
  args: {
    conversation: mockMultiTurnConversation,
    onSendMessage: () => {},
    isLoading: false,
    onEditMessage: () => {},
    onRetryMessage: () => {},
    onCancelMessage: () => {},
    onUpdateModels: () => {},
    queryState: mockQueryState,
    isReadOnly: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Extended conversation with multiple user questions and council responses.'
      }
    }
  }
};

// ========== WORKFLOW CONVERSATIONS ==========

/**
 * Workflow conversation showing perspective matrix execution.
 */
export const WorkflowConversation = {
  args: {
    conversation: mockWorkflowConversation,
    onSendMessage: () => {},
    isLoading: false,
    onEditMessage: () => {},
    onRetryMessage: () => {},
    onCancelMessage: () => {},
    onUpdateModels: () => {},
    queryState: null,
    isReadOnly: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Workflow execution showing multi-perspective analysis with worker outputs.'
      }
    }
  }
};

// ========== LOADING STATES ==========

/**
 * Conversation with streaming response in progress.
 * Shows loading indicator and Stop button.
 */
export const StreamingResponse = {
  args: {
    conversation: {
      ...mockEmptyConversation,
      messages: [
        mockUserMessage,
        mockPartialCouncilMessage1
      ]
    },
    onSendMessage: () => {},
    isLoading: true,
    onEditMessage: () => {},
    onRetryMessage: () => {},
    onCancelMessage: () => {},
    onUpdateModels: () => {},
    queryState: mockLoadingQueryState,
    isReadOnly: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Active streaming showing partial response and loading indicators. Stop button is enabled.'
      }
    }
  }
};

/**
 * Conversation showing Stage 1.5 loading state.
 */
export const LoadingStage1_5 = {
  args: {
    conversation: {
      ...mockEmptyConversation,
      messages: [
        mockUserMessage,
        mockPartialCouncilMessage1
      ]
    },
    onSendMessage: () => {},
    isLoading: true,
    onEditMessage: () => {},
    onRetryMessage: () => {},
    onCancelMessage: () => {},
    onUpdateModels: () => {},
    queryState: {
      stages: {
        stage1: { status: 'complete' },
        stage1_5: { status: 'loading' },
        stage2: { status: 'pending' },
        stage3: { status: 'pending' }
      }
    },
    isReadOnly: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Loading state during Stage 1.5 cross-interrogation with spinner visible on tab.'
      }
    }
  }
};

// ========== INTERACTION STATES ==========

/**
 * Read-only mode for public/shared conversations.
 * Input is disabled and actions are hidden.
 */
export const ReadOnlyMode = {
  args: {
    conversation: mockCouncilConversation,
    onSendMessage: () => {},
    isLoading: false,
    onEditMessage: () => {},
    onRetryMessage: () => {},
    onCancelMessage: () => {},
    onUpdateModels: () => {},
    queryState: mockQueryState,
    isReadOnly: true
  },
  parameters: {
    docs: {
      description: {
        story: 'Read-only view of public conversation. No input field or edit/retry actions.'
      }
    }
  }
};

/**
 * Conversation with edit/retry actions visible.
 * Actions appear on the last user message.
 */
export const WithEditRetryActions = {
  args: {
    conversation: mockCouncilConversation,
    onSendMessage: () => {},
    isLoading: false,
    onEditMessage: () => {},
    onRetryMessage: () => {},
    onCancelMessage: () => {},
    onUpdateModels: () => {},
    queryState: mockQueryState,
    isReadOnly: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Conversation showing edit and retry buttons on the last user message.'
      }
    }
  }
};

// ========== INTERACTIVE DEMO ==========

/**
 * Interactive playground for testing all chat features.
 */
export const Interactive = {
  args: {
    conversation: mockCouncilConversation,
    onSendMessage: (msg) => console.log('Send:', msg),
    isLoading: false,
    onEditMessage: (content) => console.log('Edit:', content),
    onRetryMessage: (content) => console.log('Retry:', content),
    onCancelMessage: () => console.log('Cancel'),
    onUpdateModels: (config) => console.log('Update models:', config),
    queryState: mockQueryState,
    isReadOnly: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive demo - check the Actions panel to see event logs.'
      }
    }
  }
};
