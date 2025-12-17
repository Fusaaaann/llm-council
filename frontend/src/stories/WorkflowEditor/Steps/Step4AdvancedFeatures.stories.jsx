import { useState } from 'react';
import Step4AdvancedFeatures from '../../../components/workflow-editor/steps/Step4AdvancedFeatures.jsx';
import { mockWizardStateBasic, mockWizardStateEmpty, mockGlobalModels, mockMiddleware } from '../../mockData.js';

/**
 * Step4AdvancedFeatures - Advanced workflow configuration step
 *
 * This step component configures advanced workflow features across four main sections:
 * 1. Multi-Superstep (Follow-Up Steps) - Configure additional processing steps
 * 2. Concurrency Limit - Control parallel worker execution
 * 3. Middleware Pipeline - Transform or filter outputs
 * 4. Advanced Visibility Controls - Control what delegates can see
 *
 * These features enable complex multi-stage workflows with sophisticated data processing.
 */
export default {
  title: 'WorkflowEditor/Steps/Step4AdvancedFeatures',
  component: Step4AdvancedFeatures,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Advanced features configuration step for workflow editor. Includes follow-up steps, concurrency controls, middleware pipeline, and visibility settings. Most features are optional for basic workflows.'
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
    onNext: { action: 'next clicked' },
    onBack: { action: 'back clicked' }
  }
};

/**
 * Empty - Default empty state
 */
export const Empty = {
  args: {
    state: {
      ...mockWizardStateEmpty,
      globalModels: mockGlobalModels,
      followUpSteps: [],
      concurrencyLimit: null,
      middleware: [],
      useColumnWiseSummary: false,
      advancedVisibility: {}
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty state with no advanced features configured. Shows empty state card for follow-up steps and default settings for all other sections.'
      }
    }
  }
};

/**
 * WithSingleFollowUpStep - One follow-up step configured
 */
export const WithSingleFollowUpStep = {
  args: {
    state: {
      ...mockWizardStateBasic,
      followUpSteps: [
        {
          stepId: 'implementation_plan',
          taskDescription: 'Create detailed implementation roadmap based on the analysis',
          outputVar: 'implementation_plan',
          selectedPerspectives: ['persp_1', 'persp_2'],
          executionMode: 'single_worker',
          model: 'openai/gpt-4o'
        }
      ],
      concurrencyLimit: null,
      middleware: [],
      useColumnWiseSummary: false,
      advancedVisibility: {}
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Single follow-up step configured in single_worker mode. Uses 2 perspectives as input and outputs to implementation_plan variable.'
      }
    }
  }
};

/**
 * WithMultipleFollowUpSteps - Chain of follow-up steps
 */
export const WithMultipleFollowUpSteps = {
  args: {
    state: {
      ...mockWizardStateBasic,
      followUpSteps: [
        {
          stepId: 'implementation_plan',
          taskDescription: 'Create detailed implementation roadmap based on the initial analysis',
          outputVar: 'implementation_plan',
          selectedPerspectives: ['persp_1', 'persp_2'],
          executionMode: 'single_worker',
          model: 'openai/gpt-4o'
        },
        {
          stepId: 'risk_assessment',
          taskDescription: 'Identify and evaluate risks in the implementation plan',
          outputVar: 'risk_assessment',
          selectedPerspectives: ['persp_1', 'persp_3'],
          executionMode: 'multiple_workers',
          model: null
        },
        {
          stepId: 'final_recommendations',
          taskDescription: 'Synthesize roadmap and risks into actionable recommendations',
          outputVar: 'final_recommendations',
          selectedPerspectives: ['persp_1', 'persp_2', 'persp_3'],
          executionMode: 'chairman_only',
          model: 'openai/gpt-4-turbo'
        }
      ],
      concurrencyLimit: null,
      middleware: [],
      useColumnWiseSummary: false,
      advancedVisibility: {}
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Three follow-up steps forming a processing chain. Shows different execution modes: single_worker, multiple_workers, and chairman_only.'
      }
    }
  }
};

/**
 * WithConcurrencyLimit - Concurrency control enabled
 */
export const WithConcurrencyLimit = {
  args: {
    state: {
      ...mockWizardStateBasic,
      followUpSteps: [],
      concurrencyLimit: 3,
      middleware: [],
      useColumnWiseSummary: false,
      advancedVisibility: {}
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Concurrency limit set to 3 workers. Useful for controlling API rate limits and resource usage.'
      }
    }
  }
};

/**
 * WithMiddleware - Middleware pipeline configured
 */
export const WithMiddleware = {
  args: {
    state: {
      ...mockWizardStateBasic,
      followUpSteps: [],
      concurrencyLimit: null,
      middleware: [
        mockMiddleware[0], // filter_regex
        mockMiddleware[1], // anonymize_pii
        mockMiddleware[3]  // llm_refine
      ],
      useColumnWiseSummary: false,
      advancedVisibility: {}
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Middleware pipeline with 3 operations: regex filtering, PII anonymization, and LLM refinement. Shows MiddlewareBuilder component integration.'
      }
    }
  }
};

/**
 * WithColumnWiseSummary - Column-wise reduction enabled
 */
export const WithColumnWiseSummary = {
  args: {
    state: {
      ...mockWizardStateBasic,
      followUpSteps: [],
      concurrencyLimit: null,
      middleware: [],
      useColumnWiseSummary: true,
      advancedVisibility: {}
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Column-wise summary reduction enabled. Compares models per-perspective instead of global synthesis.'
      }
    }
  }
};

/**
 * WithAdvancedVisibility - Visibility options enabled
 */
export const WithAdvancedVisibility = {
  args: {
    state: {
      ...mockWizardStateBasic,
      followUpSteps: [],
      concurrencyLimit: null,
      middleware: [],
      useColumnWiseSummary: false,
      advancedVisibility: {
        includeRejectedItems: true,
        includeConversationHistory: true
      }
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Both advanced visibility options enabled. Delegates can see rejected items and conversation history.'
      }
    }
  }
};

/**
 * ValidationErrors - Follow-up step validation errors
 */
export const ValidationErrors = {
  render: function ValidationDemo() {
    const [followUpSteps, setFollowUpSteps] = useState([
      {
        stepId: 'incomplete_step',
        taskDescription: '',
        outputVar: '',
        selectedPerspectives: [],
        executionMode: 'single_worker',
        model: null
      }
    ]);
    const [errors, setErrors] = useState({});

    const validate = () => {
      const newErrors = {};
      if (!followUpSteps[0].taskDescription) {
        newErrors.followup_0_task = 'Task description is required';
      }
      if (!followUpSteps[0].outputVar) {
        newErrors.followup_0_output = 'Output variable name is required';
      }
      if (followUpSteps[0].selectedPerspectives.length === 0) {
        newErrors.followup_0_perspectives = 'Select at least one input variable';
      }
      if (followUpSteps[0].executionMode === 'single_worker' && !followUpSteps[0].model) {
        newErrors.followup_0_model = 'Model is required for single worker mode';
      }
      setErrors(newErrors);
    };

    const handleChange = (updates) => {
      if (updates.followUpSteps) {
        setFollowUpSteps(updates.followUpSteps);
        setErrors({});
      }
    };

    return (
      <div>
        <div style={{ marginBottom: '20px', padding: '15px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600, color: '#856404' }}>
            Validation Errors Demo
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#856404' }}>
            This follow-up step has validation errors. Click Next to trigger validation and see error messages.
          </p>
          <button
            onClick={validate}
            style={{
              marginTop: '10px',
              padding: '6px 12px',
              background: '#ffc107',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500
            }}
          >
            Trigger Validation
          </button>
        </div>

        <Step4AdvancedFeatures
          state={{
            ...mockWizardStateBasic,
            followUpSteps,
            concurrencyLimit: null,
            middleware: [],
            useColumnWiseSummary: false,
            advancedVisibility: {},
            errors
          }}
          onChange={handleChange}
          onNext={() => validate()}
          onBack={() => {}}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates validation errors for incomplete follow-up step. Missing task description, output variable, input perspectives, and model selection.'
      }
    }
  }
};

/**
 * AllFeaturesEnabled - Complete configuration
 */
export const AllFeaturesEnabled = {
  args: {
    state: {
      ...mockWizardStateBasic,
      followUpSteps: [
        {
          stepId: 'synthesis',
          taskDescription: 'Synthesize all perspectives into final recommendation',
          outputVar: 'final_synthesis',
          selectedPerspectives: ['persp_1', 'persp_2', 'persp_3'],
          executionMode: 'chairman_only',
          model: 'openai/gpt-4-turbo'
        }
      ],
      concurrencyLimit: 2,
      middleware: [mockMiddleware[0], mockMiddleware[1]],
      useColumnWiseSummary: true,
      advancedVisibility: {
        includeRejectedItems: true,
        includeConversationHistory: true
      }
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'All advanced features enabled: follow-up step, concurrency limit (2), middleware pipeline (2 ops), column-wise summary, and both visibility options.'
      }
    }
  }
};

/**
 * Interactive - Fully interactive demo
 */
export const Interactive = {
  render: function InteractiveDemo() {
    const [state, setState] = useState({
      globalModels: mockGlobalModels,
      perspectives: mockWizardStateBasic.perspectives,
      followUpSteps: [],
      concurrencyLimit: null,
      middleware: [],
      useColumnWiseSummary: false,
      advancedVisibility: {}
    });

    const handleChange = (updates) => {
      console.log('State updated:', updates);
      setState(prev => ({ ...prev, ...updates }));
    };

    const handleNext = () => {
      console.log('Next clicked - current state:', state);
      alert(`Advanced features configured:\n- Follow-up steps: ${state.followUpSteps.length}\n- Concurrency limit: ${state.concurrencyLimit || 'unlimited'}\n- Middleware ops: ${state.middleware.length}\n- Column-wise summary: ${state.useColumnWiseSummary}\n- Advanced visibility: ${Object.keys(state.advancedVisibility).filter(k => state.advancedVisibility[k]).length} enabled`);
    };

    const handleBack = () => {
      console.log('Back clicked');
      alert('Going back to Step 4');
    };

    return (
      <div>
        <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>Interactive Demo</h4>
          <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#666' }}>
            Configure advanced features: add follow-up steps, set concurrency limits, build middleware pipeline,
            enable column-wise summary, and control visibility settings. All changes update the state in real-time.
          </p>
          <div style={{ marginTop: '10px', fontSize: '12px', fontFamily: 'monospace', background: 'white', padding: '10px', borderRadius: '4px' }}>
            followUpSteps: {state.followUpSteps.length} step(s)<br/>
            concurrencyLimit: {state.concurrencyLimit === null ? 'unlimited' : state.concurrencyLimit}<br/>
            middleware: {state.middleware.length} operation(s)<br/>
            useColumnWiseSummary: {state.useColumnWiseSummary.toString()}<br/>
            advancedVisibility: {JSON.stringify(state.advancedVisibility)}
          </div>
        </div>

        <Step4AdvancedFeatures
          state={state}
          onChange={handleChange}
          onNext={handleNext}
          onBack={handleBack}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Fully interactive Step4AdvancedFeatures. Add/remove follow-up steps, configure concurrency, build middleware pipeline, toggle features. See real-time state updates above.'
      }
    }
  }
};
