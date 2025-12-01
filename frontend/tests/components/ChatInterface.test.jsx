import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '../../src/components/ChatInterface';

// Mock child components to isolate ChatInterface tests
vi.mock('../../src/components/Stage1', () => ({
  default: ({ responses }) => (
    <div data-testid="stage1">{responses.length} responses</div>
  ),
}));

vi.mock('../../src/components/Stage1_5', () => ({
  default: ({ interrogationData }) => (
    <div data-testid="stage1_5">Cross-interrogation</div>
  ),
}));

vi.mock('../../src/components/Stage2', () => ({
  default: ({ rankings }) => (
    <div data-testid="stage2">{rankings.length} rankings</div>
  ),
}));

vi.mock('../../src/components/Stage3', () => ({
  default: ({ finalResponse }) => (
    <div data-testid="stage3">Final answer</div>
  ),
}));

vi.mock('../../src/components/ModelConfig', () => ({
  default: ({ isOpen, onClose, onSave }) => (
    isOpen ? (
      <div data-testid="model-config">
        <button onClick={onClose}>Close</button>
        <button onClick={() => onSave({ council: [], chairman: '' })}>Save</button>
      </div>
    ) : null
  ),
}));

describe('ChatInterface', () => {
  let mockProps;

  beforeEach(() => {
    mockProps = {
      conversation: null,
      onSendMessage: vi.fn(),
      isLoading: false,
      onEditMessage: vi.fn(),
      onRetryMessage: vi.fn(),
      onCancelMessage: vi.fn(),
      onUpdateModels: vi.fn(),
      queryState: null,
      isReadOnly: false,
    };
  });

  describe('Empty States', () => {
    it('should show welcome message when no conversation', () => {
      render(<ChatInterface {...mockProps} />);

      expect(screen.getByText('Welcome to LLM Council')).toBeInTheDocument();
      expect(screen.getByText('Create a new conversation to get started')).toBeInTheDocument();
    });

    it('should show "start conversation" message when conversation has no messages', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [],
      };

      render(<ChatInterface {...mockProps} />);

      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
      expect(screen.getByText('Ask a question to consult the LLM Council')).toBeInTheDocument();
    });
  });

  describe('Message Display', () => {
    it('should display user message', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'What is AI?' },
        ],
      };

      render(<ChatInterface {...mockProps} />);

      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.getByText('What is AI?')).toBeInTheDocument();
    });

    it('should display assistant message with all stages', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'Test question' },
          {
            role: 'assistant',
            stage1: [
              { model: 'model-1', response: 'Response 1' },
              { model: 'model-2', response: 'Response 2' },
            ],
            stage1_5: {
              questions: [],
              answers: [],
              label_to_model: {},
            },
            stage2: [
              { model: 'model-1', ranking: 'Ranking 1', parsed_ranking: [] },
            ],
            stage3: { model: 'chairman', response: 'Final answer' },
            metadata: {
              label_to_model: {},
              aggregate_rankings: [],
            },
          },
        ],
      };

      render(<ChatInterface {...mockProps} />);

      expect(screen.getByTestId('stage1')).toHaveTextContent('2 responses');
      expect(screen.getByTestId('stage1_5')).toBeInTheDocument();
      expect(screen.getByTestId('stage2')).toHaveTextContent('1 rankings');
      expect(screen.getByTestId('stage3')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show Stage 1 loading indicator', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'Test question' },
        ],
      };
      mockProps.queryState = {
        stages: {
          stage1: { status: 'loading' },
        },
      };

      render(<ChatInterface {...mockProps} />);

      expect(screen.getByText('Running Stage 1: Collecting individual responses...')).toBeInTheDocument();
      expect(document.querySelector('.spinner')).toBeInTheDocument();
    });

    it('should show Stage 1.5 loading indicator', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'Test question' },
          { role: 'assistant', stage1: [{ model: 'm1', response: 'r1' }] },
        ],
      };
      mockProps.queryState = {
        stages: {
          stage1_5: { status: 'loading' },
        },
      };

      render(<ChatInterface {...mockProps} />);

      expect(screen.getByText('Running Stage 1.5: Cross-interrogation...')).toBeInTheDocument();
    });

    it('should show Stage 2 loading indicator', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'Test question' },
          {
            role: 'assistant',
            stage1: [{ model: 'm1', response: 'r1' }],
            stage1_5: { questions: [], answers: [] },
          },
        ],
      };
      mockProps.queryState = {
        stages: {
          stage2: { status: 'loading' },
        },
      };

      render(<ChatInterface {...mockProps} />);

      expect(screen.getByText('Running Stage 2: Peer rankings...')).toBeInTheDocument();
    });

    it('should show Stage 3 loading indicator', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'Test question' },
          {
            role: 'assistant',
            stage1: [{ model: 'm1', response: 'r1' }],
            stage1_5: { questions: [], answers: [] },
            stage2: [{ model: 'm1', ranking: 'rank' }],
          },
        ],
      };
      mockProps.queryState = {
        stages: {
          stage3: { status: 'loading' },
        },
      };

      render(<ChatInterface {...mockProps} />);

      expect(screen.getByText('Running Stage 3: Final synthesis...')).toBeInTheDocument();
    });
  });

  describe('Input Form', () => {
    it('should render input form with textarea and send button', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [],
      };

      render(<ChatInterface {...mockProps} />);

      const textarea = screen.getByPlaceholderText(/Ask your question/i);
      const sendButton = screen.getByText('Send');
      const configButton = screen.getByTitle('Configure models');

      expect(textarea).toBeInTheDocument();
      expect(sendButton).toBeInTheDocument();
      expect(configButton).toBeInTheDocument();
    });

    it('should send message when form is submitted', async () => {
      const user = userEvent.setup();
      mockProps.conversation = {
        id: 'conv-1',
        messages: [],
      };

      render(<ChatInterface {...mockProps} />);

      const textarea = screen.getByPlaceholderText(/Ask your question/i);
      const sendButton = screen.getByText('Send');

      await user.type(textarea, 'Hello world');
      await user.click(sendButton);

      expect(mockProps.onSendMessage).toHaveBeenCalledWith('Hello world');
    });

    it('should send message on Enter key', async () => {
      const user = userEvent.setup();
      mockProps.conversation = {
        id: 'conv-1',
        messages: [],
      };

      render(<ChatInterface {...mockProps} />);

      const textarea = screen.getByPlaceholderText(/Ask your question/i);

      await user.type(textarea, 'Test message{Enter}');

      expect(mockProps.onSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('should add new line on Shift+Enter', async () => {
      const user = userEvent.setup();
      mockProps.conversation = {
        id: 'conv-1',
        messages: [],
      };

      render(<ChatInterface {...mockProps} />);

      const textarea = screen.getByPlaceholderText(/Ask your question/i);

      await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2');

      expect(textarea.value).toBe('Line 1\nLine 2');
      expect(mockProps.onSendMessage).not.toHaveBeenCalled();
    });

    it('should clear input after sending', async () => {
      const user = userEvent.setup();
      mockProps.conversation = {
        id: 'conv-1',
        messages: [],
      };

      render(<ChatInterface {...mockProps} />);

      const textarea = screen.getByPlaceholderText(/Ask your question/i);

      await user.type(textarea, 'Test message');
      await user.click(screen.getByText('Send'));

      expect(textarea.value).toBe('');
    });

    it('should disable send button when input is empty', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [],
      };

      render(<ChatInterface {...mockProps} />);

      const sendButton = screen.getByText('Send');
      expect(sendButton).toBeDisabled();
    });

    it('should disable textarea when loading', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [],
      };
      mockProps.isLoading = true;

      render(<ChatInterface {...mockProps} />);

      const textarea = screen.getByPlaceholderText(/Ask your question/i);
      expect(textarea).toBeDisabled();
    });

    it('should show cancel button when loading', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [],
      };
      mockProps.isLoading = true;

      render(<ChatInterface {...mockProps} />);

      const cancelButton = screen.getByText('⏹ Stop');
      expect(cancelButton).toBeInTheDocument();
      expect(screen.queryByText('Send')).not.toBeInTheDocument();
    });

    it('should call onCancelMessage when cancel button is clicked', async () => {
      const user = userEvent.setup();
      mockProps.conversation = {
        id: 'conv-1',
        messages: [],
      };
      mockProps.isLoading = true;

      render(<ChatInterface {...mockProps} />);

      const cancelButton = screen.getByText('⏹ Stop');
      await user.click(cancelButton);

      expect(mockProps.onCancelMessage).toHaveBeenCalled();
    });
  });

  describe('Edit and Retry Actions', () => {
    it('should show edit and retry buttons on last user message', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'Question 1' },
          { role: 'assistant', stage1: [{ model: 'm1', response: 'r1' }] },
          { role: 'user', content: 'Question 2' },
        ],
      };

      render(<ChatInterface {...mockProps} />);

      const editButtons = screen.getAllByText('✏️ Edit');
      const retryButtons = screen.getAllByText('🔄 Retry');

      // Only the last user message should have action buttons
      expect(editButtons).toHaveLength(1);
      expect(retryButtons).toHaveLength(1);
    });

    it('should hide edit/retry buttons when loading', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'Question 1' },
        ],
      };
      mockProps.isLoading = true;

      render(<ChatInterface {...mockProps} />);

      expect(screen.queryByText('✏️ Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('🔄 Retry')).not.toBeInTheDocument();
    });

    it('should call onEditMessage and populate input when edit is clicked', async () => {
      const user = userEvent.setup();
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'Original message' },
        ],
      };

      render(<ChatInterface {...mockProps} />);

      const editButton = screen.getByText('✏️ Edit');
      await user.click(editButton);

      expect(mockProps.onEditMessage).toHaveBeenCalledWith('Original message');

      const textarea = screen.getByPlaceholderText(/Ask your question/i);
      expect(textarea.value).toBe('Original message');
    });

    it('should focus input after edit', async () => {
      const user = userEvent.setup();
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'Original message' },
        ],
      };

      render(<ChatInterface {...mockProps} />);

      const editButton = screen.getByText('✏️ Edit');
      await user.click(editButton);

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/Ask your question/i);
        expect(textarea).toHaveFocus();
      });
    });

    it('should call onRetryMessage when retry is clicked', async () => {
      const user = userEvent.setup();
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'Test question' },
          { role: 'assistant', stage1: [{ model: 'm1', response: 'r1' }] },
        ],
      };

      render(<ChatInterface {...mockProps} />);

      const retryButton = screen.getByText('🔄 Retry');
      await user.click(retryButton);

      expect(mockProps.onRetryMessage).toHaveBeenCalledWith('Test question');
    });
  });

  describe('Read-Only Mode', () => {
    it('should show read-only notice instead of input form', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'Test' },
        ],
      };
      mockProps.isReadOnly = true;

      render(<ChatInterface {...mockProps} />);

      expect(screen.getByText('📖 This is a public conversation. View only.')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/Ask your question/i)).not.toBeInTheDocument();
    });

    it('should hide edit/retry buttons in read-only mode', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'Test question' },
        ],
      };
      mockProps.isReadOnly = true;

      render(<ChatInterface {...mockProps} />);

      expect(screen.queryByText('✏️ Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('🔄 Retry')).not.toBeInTheDocument();
    });
  });

  describe('Model Configuration', () => {
    it('should open model config modal when config button is clicked', async () => {
      const user = userEvent.setup();
      mockProps.conversation = {
        id: 'conv-1',
        messages: [],
      };

      render(<ChatInterface {...mockProps} />);

      const configButton = screen.getByTitle('Configure models');
      await user.click(configButton);

      expect(screen.getByTestId('model-config')).toBeInTheDocument();
    });

    it('should close model config modal', async () => {
      const user = userEvent.setup();
      mockProps.conversation = {
        id: 'conv-1',
        messages: [],
      };

      render(<ChatInterface {...mockProps} />);

      const configButton = screen.getByTitle('Configure models');
      await user.click(configButton);

      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      expect(screen.queryByTestId('model-config')).not.toBeInTheDocument();
    });

    it('should call onUpdateModels when config is saved', async () => {
      const user = userEvent.setup();
      mockProps.conversation = {
        id: 'conv-1',
        messages: [],
      };

      render(<ChatInterface {...mockProps} />);

      const configButton = screen.getByTitle('Configure models');
      await user.click(configButton);

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      expect(mockProps.onUpdateModels).toHaveBeenCalledWith({
        council: [],
        chairman: '',
      });
    });
  });

  describe('Multi-turn Conversation', () => {
    it('should display multiple conversation turns', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'First question' },
          { role: 'assistant', stage1: [{ model: 'm1', response: 'r1' }] },
          { role: 'user', content: 'Follow-up question' },
          { role: 'assistant', stage1: [{ model: 'm1', response: 'r2' }] },
        ],
      };

      render(<ChatInterface {...mockProps} />);

      expect(screen.getByText('First question')).toBeInTheDocument();
      expect(screen.getByText('Follow-up question')).toBeInTheDocument();
      expect(screen.getAllByTestId('stage1')).toHaveLength(2);
    });

    it('should allow sending new message in multi-turn conversation', async () => {
      const user = userEvent.setup();
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'First question' },
          { role: 'assistant', stage1: [{ model: 'm1', response: 'r1' }] },
        ],
      };

      render(<ChatInterface {...mockProps} />);

      const textarea = screen.getByPlaceholderText(/Ask your question/i);
      await user.type(textarea, 'Follow-up{Enter}');

      expect(mockProps.onSendMessage).toHaveBeenCalledWith('Follow-up');
    });
  });

  describe('Edge Cases', () => {
    it('should not send message with only whitespace', async () => {
      const user = userEvent.setup();
      mockProps.conversation = {
        id: 'conv-1',
        messages: [],
      };

      render(<ChatInterface {...mockProps} />);

      const textarea = screen.getByPlaceholderText(/Ask your question/i);
      await user.type(textarea, '   {Enter}');

      expect(mockProps.onSendMessage).not.toHaveBeenCalled();
    });

    it('should handle empty stage arrays gracefully', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'Test' },
          {
            role: 'assistant',
            stage1: [],
            stage2: [],
          },
        ],
      };

      render(<ChatInterface {...mockProps} />);

      expect(screen.getByTestId('stage1')).toHaveTextContent('0 responses');
      expect(screen.getByTestId('stage2')).toHaveTextContent('0 rankings');
    });

    it('should handle missing metadata gracefully', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'Test' },
          {
            role: 'assistant',
            stage2: [{ model: 'm1', ranking: 'rank' }],
          },
        ],
      };

      render(<ChatInterface {...mockProps} />);

      // Should not crash when metadata is missing
      expect(screen.getByTestId('stage2')).toBeInTheDocument();
    });

    it('should handle conversation with only assistant messages', () => {
      mockProps.conversation = {
        id: 'conv-1',
        messages: [
          {
            role: 'assistant',
            stage1: [{ model: 'm1', response: 'r1' }],
          },
        ],
      };

      render(<ChatInterface {...mockProps} />);

      expect(screen.queryByText('✏️ Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('🔄 Retry')).not.toBeInTheDocument();
    });
  });
});
