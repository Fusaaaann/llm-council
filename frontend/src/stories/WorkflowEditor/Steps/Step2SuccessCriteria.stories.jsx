import { useState } from 'react';
import Step2SuccessCriteria from '../../../components/workflow-editor/steps/Step2SuccessCriteria.jsx';
import { mockWizardStateEmpty, mockWizardStateBasic, mockGlobalModels } from '../../mockData.js';

/**
 * Step2SuccessCriteria - Second wizard step for defining output format and quality criteria
 *
 * This step configures:
 * 1. Output format (text_summary, json, ranked, custom)
 * 2. Quality criteria (accurate, balanced, risk-aware, etc.)
 * 3. Hard constraints (optional rules the answer must follow)
 * 4. Global model library (optional customization)
 *
 * Users can select multiple quality criteria and add custom constraints.
 */
export default {
  title: 'WorkflowEditor/Steps/Step2SuccessCriteria',
  component: Step2SuccessCriteria,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Second wizard step for defining the final answer format, quality criteria, hard constraints, and available model library. All fields except output format are optional.'
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
 * Empty - Initial blank state
 */
export const Empty = {
  args: {
    state: mockWizardStateEmpty,
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty initial state with no selections. Shows all 4 output format options and 8 quality criteria options.'
      }
    }
  }
};

/**
 * Text summary format - Text summary output format selected
 */
export const TextSummaryFormat = {
  args: {
    state: {
      ...mockWizardStateEmpty,
      outputFormat: 'text_summary'
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Text Summary format selected. This is the most common format - a clear written answer in paragraph form.'
      }
    }
  }
};

/**
 * JSON format - Structured data format selected
 */
export const JSONFormat = {
  args: {
    state: {
      ...mockWizardStateEmpty,
      outputFormat: 'json'
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Structured Data (JSON) format selected. Used when the output needs to be machine-readable and structured.'
      }
    }
  }
};

/**
 * Custom format - Custom format with description field
 */
export const CustomFormat = {
  args: {
    state: {
      ...mockWizardStateEmpty,
      outputFormat: 'custom',
      customFormat: 'Valid JSON with fields: title, pros (list), cons (list), and a final_recommendation string'
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Custom format selected showing the additional textarea for specifying custom format requirements. User can describe exactly what structure they need.'
      }
    }
  }
};

/**
 * With qualities - Quality criteria selected
 */
export const WithQualities = {
  args: {
    state: {
      ...mockWizardStateEmpty,
      outputFormat: 'text_summary',
      qualities: ['accurate', 'balanced', 'risk_aware']
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Three quality criteria selected: Accurate, Balanced, and Risk-Aware. These guide how perspectives reason and make decisions.'
      }
    }
  }
};

/**
 * With constraints - Hard constraints added
 */
export const WithConstraints = {
  args: {
    state: {
      ...mockWizardStateEmpty,
      outputFormat: 'ranked',
      qualities: ['practical', 'concise'],
      constraints: [
        'Must include cost estimates',
        'Maximum 3 paragraphs',
        'No proprietary technology recommendations'
      ]
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Hard constraints added defining strict requirements the final answer must satisfy. Constraints are shown as a removable list.'
      }
    }
  }
};

/**
 * With custom models - Custom models panel open
 */
export const WithCustomModels = {
  render: function CustomModelsDemo() {
    const [state, setState] = useState({
      ...mockWizardStateBasic,
      globalModels: [
        ...mockGlobalModels,
        {
          id: 'custom_model_1',
          label: 'Custom GPT-4 Turbo',
          modelRef: 'openai/gpt-4-turbo-preview',
          isDefault: false
        }
      ]
    });
    const [showModelConfig, setShowModelConfig] = useState(true);

    const handleChange = (updates) => {
      setState(prev => ({ ...prev, ...updates }));
    };

    return (
      <div className="wizard-step step-success-criteria">
        <div className="step-header">
          <h2>Step 2: Define the Final Answer & Rules</h2>
          <p className="step-description">
            Specify the answer format and quality rules.
          </p>
        </div>

        <div className="step-content">
          <div className="form-group">
            <label>
              Available Models
              <span className="optional"> (optional - customize model library)</span>
            </label>
            <button
              onClick={() => setShowModelConfig(!showModelConfig)}
              className="btn-link"
              type="button"
            >
              {showModelConfig ? '− Hide Model Configuration' : '+ Customize Model Library'}
            </button>

            {showModelConfig && (
              <div className="model-configuration-panel">
                <p className="help-text">
                  Configure available models. Defaults are always included.
                </p>

                <div className="models-list">
                  {state.globalModels.map((model, index) => (
                    <div key={model.id} className="model-item">
                      <div className="model-info">
                        <strong>{model.label}</strong>
                        <code className="model-ref">{model.modelRef}</code>
                        {model.isDefault && <span className="badge-default">Default</span>}
                      </div>
                      <button
                        onClick={() => {
                          const newModels = state.globalModels.filter((_, i) => i !== index);
                          handleChange({ globalModels: newModels });
                        }}
                        className="btn-remove"
                        disabled={model.isDefault}
                        title={model.isDefault ? 'Cannot remove default models' : 'Remove model'}
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="add-model-form">
                  <h4>Add Custom Model</h4>
                  <div className="form-row">
                    <input
                      type="text"
                      placeholder="Display Name (e.g., 'Custom GPT-4')"
                    />
                    <input
                      type="text"
                      placeholder="Model ID (e.g., 'openai/gpt-4')"
                    />
                    <button className="btn-secondary" type="button">
                      + Add Model
                    </button>
                  </div>
                  <span className="help-text">
                    Find model IDs at <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer">OpenRouter Models</a>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="step-actions">
          <button className="btn-secondary">← Back</button>
          <button className="btn-primary">Next: Delegates & Perspectives →</button>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Custom models configuration panel expanded showing default models and one custom model added. Users can add/remove custom models but cannot remove defaults.'
      }
    }
  }
};

/**
 * Complete state - All fields filled
 */
export const CompleteState = {
  args: {
    state: {
      ...mockWizardStateBasic,
      outputFormat: 'text_summary',
      qualities: ['accurate', 'balanced', 'practical'],
      constraints: [
        'Must cite sources',
        'Include implementation timeline'
      ],
      globalModels: mockGlobalModels
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete state with all sections filled: text summary format, 3 quality criteria, 2 hard constraints, and default model library. Ready to proceed to next step.'
      }
    }
  }
};

/**
 * Interactive - Full interactive form
 */
export const Interactive = {
  render: function InteractiveDemo() {
    const [state, setState] = useState({
      outputFormat: 'text_summary',
      qualities: [],
      constraints: [],
      globalModels: mockGlobalModels
    });

    const handleChange = (updates) => {
      console.log('State updated:', updates);
      setState(prev => ({ ...prev, ...updates }));
    };

    const handleNext = () => {
      console.log('Next clicked - current state:', state);
      alert('Moving to next step with:\n' +
        `Format: ${state.outputFormat}\n` +
        `Qualities: ${state.qualities?.join(', ') || 'none'}\n` +
        `Constraints: ${state.constraints?.length || 0}`
      );
    };

    const handleBack = () => {
      console.log('Back clicked');
      alert('Going back to Step 1');
    };

    return (
      <div>
        <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>Interactive Demo</h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
            Try selecting different output formats, toggling quality criteria, adding constraints,
            and customizing the model library. Check the Actions panel for onChange events.
          </p>
          <div style={{ marginTop: '10px', fontSize: '12px', fontFamily: 'monospace', background: 'white', padding: '10px', borderRadius: '4px' }}>
            outputFormat: {state.outputFormat}<br/>
            qualities: [{state.qualities?.join(', ')}]<br/>
            constraints: {state.constraints?.length || 0} item(s)<br/>
            globalModels: {state.globalModels?.length || 0} model(s)
          </div>
        </div>

        <Step2SuccessCriteria
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
        story: 'Fully interactive Step 2. Try all features: change output format, select qualities, add/remove constraints, customize models. Real-time state displayed above.'
      }
    }
  }
};
