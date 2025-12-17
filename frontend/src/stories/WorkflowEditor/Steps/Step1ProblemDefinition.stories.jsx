import { useState } from 'react';
import Step1ProblemDefinition from '../../../components/workflow-editor/steps/Step1ProblemDefinition.jsx';
import { mockWizardStateEmpty, mockWizardStateBasic } from '../../mockData.js';

/**
 * Step1ProblemDefinition - First wizard step for defining the workflow pattern
 *
 * This step asks users to define:
 * 1. What problem does this workflow solve? (required)
 * 2. Context or scope? (optional)
 *
 * The problem statement should describe the workflow's purpose at a high level,
 * not a specific question (which will be provided at runtime).
 */
export default {
  title: 'WorkflowEditor/Steps/Step1ProblemDefinition',
  component: Step1ProblemDefinition,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'First wizard step where users define the type of problem their workflow solves. Includes validation for required problem statement field and optional context/scope field.'
      }
    }
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        <Story />
      </div>
    )
  ],
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'state changed' },
    onNext: { action: 'next clicked' }
  }
};

/**
 * Empty - Initial blank state
 */
export const Empty = {
  args: {
    state: mockWizardStateEmpty,
    onChange: () => {},
    onNext: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty initial state when user first lands on Step 1. Shows helpful placeholder text and examples in the info box.'
      }
    }
  }
};

/**
 * Filled valid - Complete with valid data ready for next step
 */
export const FilledValid = {
  args: {
    state: {
      problemStatement: 'Technology Migration Decision Framework',
      audience: 'Technical stakeholders requiring deep analysis'
    },
    onChange: () => {},
    onNext: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Valid filled state with both problem statement and optional audience field completed. Ready to proceed to next step.'
      }
    }
  }
};

/**
 * Validation errors - Shows error when required field is missing
 */
export const ValidationErrors = {
  render: function ValidationDemo() {
    const [state, setState] = useState({ problemStatement: '', audience: '' });
    const [showError, setShowError] = useState(false);

    const handleNext = () => {
      setShowError(true);
    };

    const handleChange = (updates) => {
      setState(prev => ({ ...prev, ...updates }));
      setShowError(false);
    };

    // Manually render to show validation error
    return (
      <div className="wizard-step step-problem-definition">
        <div className="step-header">
          <h2>Step 1: Define Your Workflow Pattern</h2>
          <p className="step-description">
            Define what <strong>type of problem</strong> this workflow solves.
          </p>
        </div>

        <div className="step-content">
          <div className="form-group">
            <label htmlFor="problemStatement">
              What problem does this workflow solve?
              <span className="required">*</span>
            </label>
            <textarea
              id="problemStatement"
              value={state.problemStatement}
              onChange={(e) => handleChange({ problemStatement: e.target.value })}
              placeholder="Example: Technology Migration Decision Framework, Strategic Planning & Recommendations, Technical Architecture Review"
              rows={4}
              className={showError && !state.problemStatement ? 'error' : ''}
            />
            {showError && !state.problemStatement && (
              <span className="error-message">Problem statement is required</span>
            )}
            <span className="help-text">
              Describes the workflow's purpose. Specific questions come at runtime.
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="audience">
              Context or scope?
              <span className="optional">(optional)</span>
            </label>
            <input
              type="text"
              id="audience"
              value={state.audience}
              onChange={(e) => handleChange({ audience: e.target.value })}
              placeholder="Example: Technical stakeholders requiring deep analysis, Executive decision-makers needing concise summaries"
            />
            <span className="help-text">
              Sets the tone and depth for workflow execution.
            </span>
          </div>

          <div className="info-box">
            <strong>💡 Examples:</strong>
            <ul>
              <li><strong>✅ Good:</strong> "Technology Migration Framework"</li>
              <li><strong>❌ Bad:</strong> "Should we migrate to MongoDB?" (too specific)</li>
            </ul>
          </div>
        </div>

        <div className="step-actions">
          <button onClick={handleNext} className="btn-primary">
            Next: Answer Format & Rules →
          </button>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Validation error displayed when clicking Next without filling required problem statement field. Error clears when user starts typing.'
      }
    }
  }
};

/**
 * With audience - Optional audience field filled
 */
export const WithAudience = {
  args: {
    state: {
      problemStatement: 'Strategic Planning & Recommendations',
      audience: 'Executive decision-makers needing concise summaries with actionable insights'
    },
    onChange: () => {},
    onNext: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Example showing the optional audience/context field being used to specify the intended scope and tone for the workflow.'
      }
    }
  }
};

/**
 * Interactive - Full form interaction with validation
 */
export const Interactive = {
  render: function InteractiveDemo() {
    const [state, setState] = useState({
      problemStatement: '',
      audience: ''
    });

    const handleChange = (updates) => {
      console.log('State updated:', updates);
      setState(prev => ({ ...prev, ...updates }));
    };

    const handleNext = () => {
      if (!state.problemStatement || state.problemStatement.trim() === '') {
        console.log('Validation failed: Problem statement is required');
        alert('Please fill in the problem statement before proceeding.');
      } else {
        console.log('Validation passed! Moving to next step...');
        alert(`✅ Validation passed!\n\nProblem: ${state.problemStatement}\nAudience: ${state.audience || '(not specified)'}`);
      }
    };

    return (
      <div>
        <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>Interactive Demo</h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
            Try filling in the form fields and clicking Next. The problem statement is required,
            while the audience/context field is optional. Check the Actions panel and console for onChange events.
          </p>
          <div style={{ marginTop: '10px', fontSize: '12px', fontFamily: 'monospace', background: 'white', padding: '10px', borderRadius: '4px' }}>
            problemStatement: {state.problemStatement ? `"${state.problemStatement}"` : '(empty)'}<br/>
            audience: {state.audience ? `"${state.audience}"` : '(empty)'}
          </div>
        </div>

        <Step1ProblemDefinition
          state={state}
          onChange={handleChange}
          onNext={handleNext}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Fully interactive Step 1. Fill in the form, try validation by clicking Next without filling fields, and see real-time state updates above the form.'
      }
    }
  }
};
