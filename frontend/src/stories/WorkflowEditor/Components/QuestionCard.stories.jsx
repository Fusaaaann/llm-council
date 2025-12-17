import QuestionCard from '../../../components/workflow-editor/components/QuestionCard.jsx';

/**
 * QuestionCard is a reusable wrapper component for wizard questions.
 * It provides consistent styling and layout for question-based UI elements.
 *
 * ## Features
 * - Consistent question/description layout
 * - Required field indicator
 * - Error message display
 * - Flexible children content area
 */
export default {
  title: 'WorkflowEditor/Components/QuestionCard',
  component: QuestionCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Reusable wrapper component for wizard questions. Provides consistent styling for question text, description, required indicator, and error messages.'
      }
    }
  },
  tags: ['autodocs']
};

/**
 * Default state with question and description
 */
export const Default = {
  args: {
    question: 'What is your workflow goal?',
    description: 'Describe the problem or task you want to solve. Be specific about the desired outcome.',
    children: (
      <input
        type="text"
        placeholder="Enter your workflow goal..."
        style={{
          width: '100%',
          padding: '0.5rem',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}
      />
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'Basic QuestionCard with question text, description, and a text input as child content.'
      }
    }
  }
};

/**
 * Required field indicator
 */
export const Required = {
  args: {
    question: 'Problem Statement',
    description: 'This field is mandatory. Provide a clear problem statement for your workflow.',
    required: true,
    children: (
      <textarea
        placeholder="Enter problem statement..."
        rows={4}
        style={{
          width: '100%',
          padding: '0.5rem',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontFamily: 'inherit'
        }}
      />
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'QuestionCard with required indicator (*) shown next to the question.'
      }
    }
  }
};

/**
 * Error state with validation message
 */
export const WithError = {
  args: {
    question: 'Output Format',
    description: 'Select how you want the workflow to present its final results.',
    required: true,
    error: 'Output format is required. Please select an option.',
    children: (
      <select
        style={{
          width: '100%',
          padding: '0.5rem',
          border: '1px solid #e53e3e',
          borderRadius: '4px',
          backgroundColor: '#fff5f5'
        }}
      >
        <option value="">Select format...</option>
        <option value="text">Text Summary</option>
        <option value="json">Structured Data</option>
      </select>
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'QuestionCard showing an error state with validation message. The error appears below the content area with a warning icon.'
      }
    }
  }
};

/**
 * Without description (minimal version)
 */
export const WithoutDescription = {
  args: {
    question: 'Workflow Timeout (ms)',
    children: (
      <input
        type="number"
        defaultValue="120000"
        style={{
          width: '200px',
          padding: '0.5rem',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}
      />
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'QuestionCard without description text. Useful for simple, self-explanatory questions.'
      }
    }
  }
};

/**
 * Complex content with nested form inputs
 */
export const ComplexContent = {
  args: {
    question: 'Model Configuration',
    description: 'Configure the AI models that will participate in your workflow.',
    required: true,
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: '#555' }}>
            Primary Model
          </label>
          <select style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}>
            <option>GPT-4 Turbo</option>
            <option>Claude Sonnet</option>
            <option>Gemini Flash</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: '#555' }}>
            Fallback Model
          </label>
          <select style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}>
            <option>GPT-4</option>
            <option>Claude Sonnet</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" id="enable-fallback" />
          <label htmlFor="enable-fallback" style={{ fontSize: '0.9rem', color: '#555' }}>
            Enable automatic fallback
          </label>
        </div>
      </div>
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'QuestionCard with complex nested form controls. Demonstrates flexibility of the children prop.'
      }
    }
  }
};

/**
 * Long content to test text wrapping
 */
export const LongContent = {
  args: {
    question: 'What are the key constraints and requirements that must be satisfied for this workflow to be considered successful?',
    description: 'List all hard requirements, limitations, and constraints that the workflow must respect. These might include time constraints, budget limits, compliance requirements, technical limitations, or any other non-negotiable conditions. Be as specific as possible to help the AI models understand what trade-offs are acceptable.',
    required: true,
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <input
          type="text"
          placeholder="e.g., Must complete within 30 days"
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
        <input
          type="text"
          placeholder="e.g., Budget cannot exceed $50,000"
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
        <button
          type="button"
          style={{
            alignSelf: 'flex-start',
            padding: '0.5rem 1rem',
            background: '#e2e8f0',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          + Add Constraint
        </button>
      </div>
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'QuestionCard with long question and description text. Tests text wrapping and readability with verbose content.'
      }
    }
  }
};
