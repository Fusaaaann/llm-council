import { useState } from 'react';
import Step3Perspectives from '../../../components/workflow-editor/steps/Step3Perspectives.jsx';
import { mockWizardStateBasic, mockWizardStateEmpty, mockGlobalModels } from '../../mockData.js';

/**
 * Step3Perspectives - Third wizard step for configuring perspectives/delegates
 *
 * This is the most complex step component with several features:
 * 1. Model binding toggle (All models vs Specific models)
 * 2. Recommended delegate combinations (quick start)
 * 3. Preset library with 11 categories
 * 4. Custom delegate creation
 * 5. Perspective editing with validation
 *
 * Model-neutral mode (default): All models analyze each perspective
 * Model-bound mode: Each perspective has a specific model assigned
 */
export default {
  title: 'WorkflowEditor/Steps/Step3Perspectives',
  component: Step3Perspectives,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Most complex wizard step for configuring AI perspectives/delegates. Supports model-neutral and model-bound modes, preset library with 11 categories, recommended combinations, and custom delegates.'
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
 * Empty - No perspectives selected
 */
export const Empty = {
  args: {
    state: {
      ...mockWizardStateEmpty,
      globalModels: mockGlobalModels,
      perspectives: [],
      modelBound: false
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty state showing model binding toggle, recommended delegate combinations, and preset library. No perspectives selected yet.'
      }
    }
  }
};

/**
 * Model neutral - All models mode (default, recommended)
 * Perspectives apply to all models unless explicitly bound via model_ref
 *
 * DSL Mapping: When modelBound=false or model=null, NO model_ref field is added to DSL
 * Example: { perspective_id: 'p1', instruction: '...' }  ← All models in models[] array analyze this
 */
export const ModelNeutral = {
  args: {
    state: {
      ...mockWizardStateBasic,
      modelBound: false,  // Global toggle: all new perspectives default to model-neutral
      perspectives: [
        {
          id: 'p1',
          name: 'Security Expert',
          role: 'Focus on security implications, vulnerabilities, and compliance requirements',
          modelBound: false,  // This perspective is model-neutral
          model: null  // No specific binding → NO model_ref in DSL
        },
        {
          id: 'p2',
          name: 'User Advocate',
          role: 'Prioritize user experience, accessibility, and ease of use',
          modelBound: false,
          model: null
        }
      ]
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Model-neutral mode (recommended). All 4 models analyze each of the 2 perspectives = 8 total analyses. Shows model-neutral badge with all models listed. In DSL, perspectives have NO model_ref field, so all models in the models[] array analyze them.'
      }
    }
  }
};

/**
 * Model bound - Specific model binding mode
 * Each perspective is bound to a specific model (opt-out from model-neutral default)
 *
 * DSL Mapping: When modelBound=true and model is set, the perspective gets a model_ref field in DSL
 * Example: { perspective_id: 'p1', instruction: '...', model_ref: 'openai/gpt-4o' }
 */
export const ModelBound = {
  args: {
    state: {
      ...mockWizardStateBasic,
      modelBound: true,  // Global toggle: all new perspectives default to model-bound
      perspectives: [
        {
          id: 'p1',
          name: 'Optimistic Analyst',
          role: 'Identify opportunities and best-case scenarios',
          modelBound: true,  // This perspective is bound to specific model
          model: 'openai/gpt-4o'  // Specific model binding → becomes model_ref in DSL
        },
        {
          id: 'p2',
          name: 'Risk Assessor',
          role: 'Identify risks, downsides, and potential failure modes',
          modelBound: true,
          model: 'anthropic/claude-3.5-sonnet'
        },
        {
          id: 'p3',
          name: 'Pragmatic Implementer',
          role: 'Focus on practical implementation and real-world constraints',
          modelBound: true,
          model: 'google/gemini-2.0-flash-exp'
        }
      ]
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Model-bound mode with each perspective assigned a specific model. Shows model selector dropdown for each perspective instead of model-neutral badge. When mapped to DSL, these perspectives get model_ref fields and only that model analyzes them.'
      }
    }
  }
};

/**
 * With presets - Preset library visible
 */
export const WithPresets = {
  args: {
    state: {
      ...mockWizardStateEmpty,
      globalModels: mockGlobalModels,
      perspectives: [],
      modelBound: false
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Preset library expanded showing 11 categories: General, Technical, Business, Creative, Security, Legal, Healthcare, Finance, Education, Research, and Ethics. Click a preset to add it.'
      }
    }
  }
};

/**
 * Selected perspectives - 3 perspectives configured
 */
export const SelectedPerspectives = {
  args: {
    state: {
      ...mockWizardStateBasic,
      modelBound: false,
      perspectives: [
        {
          id: 'p1',
          name: 'Technical Architect',
          role: 'Evaluate technical feasibility, scalability, and architecture requirements',
          modelBound: false,
          model: null
        },
        {
          id: 'p2',
          name: 'Business Analyst',
          role: 'Assess ROI, cost-benefit analysis, and business value',
          modelBound: false,
          model: null
        },
        {
          id: 'p3',
          name: 'Risk Manager',
          role: 'Identify risks, compliance requirements, and mitigation strategies',
          modelBound: false,
          model: null
        }
      ]
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Three perspectives configured in model-neutral mode. Each has a name and role definition. Shows remove button for each perspective.'
      }
    }
  }
};

/**
 * Recommended combinations - Quick start combinations
 */
export const RecommendedCombinations = {
  render: function RecommendationsDemo() {
    const [perspectives, setPerspectives] = useState([]);

    const loadCombination = (name) => {
      const combinations = {
        'Balanced Analysis': [
          { id: 'p1', name: 'Optimist', role: 'Focus on opportunities and positive outcomes', modelBound: false, model: null },
          { id: 'p2', name: 'Skeptic', role: 'Question assumptions and identify risks', modelBound: false, model: null },
          { id: 'p3', name: 'Pragmatist', role: 'Focus on practical implementation', modelBound: false, model: null }
        ],
        'Technical Decision': [
          { id: 'p1', name: 'Architect', role: 'Technical design and scalability', modelBound: false, model: null },
          { id: 'p2', name: 'Security Expert', role: 'Security and compliance', modelBound: false, model: null },
          { id: 'p3', name: 'DevOps Engineer', role: 'Operations and maintenance', modelBound: false, model: null }
        ],
        'Strategic Planning': [
          { id: 'p1', name: 'Visionary', role: 'Long-term vision and innovation', modelBound: false, model: null },
          { id: 'p2', name: 'Analyst', role: 'Data-driven analysis', modelBound: false, model: null },
          { id: 'p3', name: 'Executor', role: 'Execution and delivery', modelBound: false, model: null }
        ]
      };
      setPerspectives(combinations[name] || []);
    };

    return (
      <div className="wizard-step step-perspectives">
        <div className="step-header">
          <h2>Step 3: Choose Delegates & Perspectives</h2>
          <p className="step-description">
            Choose the AI perspectives that will analyze the problem.
          </p>
        </div>

        <div className="step-content">
          <div className="question-card">
            <div className="question-header">
              <h3>Model Selection</h3>
            </div>
            <p className="question-description">
              All models mode selected (4 models × perspectives)
            </p>
          </div>

          {perspectives.length === 0 && (
            <div className="recommended-combinations">
              <h3>Quick Start: Recommended Delegate Sets</h3>
              <div className="combination-grid">
                <div className="combination-card" onClick={() => loadCombination('Balanced Analysis')}>
                  <h4>Balanced Analysis</h4>
                  <p>Optimist, Skeptic, and Pragmatist for well-rounded decisions</p>
                  <span className="combination-count">3 perspectives</span>
                </div>
                <div className="combination-card" onClick={() => loadCombination('Technical Decision')}>
                  <h4>Technical Decision</h4>
                  <p>Architect, Security, DevOps for technical evaluations</p>
                  <span className="combination-count">3 perspectives</span>
                </div>
                <div className="combination-card" onClick={() => loadCombination('Strategic Planning')}>
                  <h4>Strategic Planning</h4>
                  <p>Visionary, Analyst, Executor for strategic initiatives</p>
                  <span className="combination-count">3 perspectives</span>
                </div>
              </div>
            </div>
          )}

          {perspectives.length > 0 && (
            <div className="selected-perspectives">
              <h3>Your Delegates & Perspectives ({perspectives.length})</h3>
              {perspectives.map((p, idx) => (
                <div key={p.id} className="perspective-item">
                  <div className="perspective-header">
                    <h4>Perspective {idx + 1}</h4>
                    <button onClick={() => setPerspectives([])} className="btn-remove">Remove</button>
                  </div>
                  <div className="perspective-fields">
                    <div className="form-group">
                      <label>Delegate Name *</label>
                      <input type="text" value={p.name} readOnly />
                    </div>
                    <div className="form-group full-width">
                      <label>Delegate Instructions *</label>
                      <textarea value={p.role} rows={2} readOnly />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="step-actions">
          <button className="btn-secondary">← Back</button>
          <button className="btn-primary">Next: How to Collect & Decide →</button>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Recommended combinations shown when no perspectives are selected yet. Click a combination card to load 3 pre-configured perspectives instantly.'
      }
    }
  }
};

/**
 * Validation errors - Missing required fields
 */
export const ValidationErrors = {
  render: function ValidationDemo() {
    const [perspectives, setPerspectives] = useState([
      { id: 'p1', name: '', role: '', modelBound: false, model: null }
    ]);
    const [errors, setErrors] = useState({});

    const validate = () => {
      const newErrors = {};
      if (!perspectives[0].name) newErrors.name_0 = 'Name is required';
      if (!perspectives[0].role) newErrors.role_0 = 'Role definition is required';
      setErrors(newErrors);
    };

    return (
      <div className="wizard-step step-perspectives">
        <div className="step-header">
          <h2>Step 3: Choose Delegates & Perspectives</h2>
          <p className="step-description">
            Choose the AI perspectives that will analyze the problem.
          </p>
        </div>

        <div className="step-content">
          <div className="selected-perspectives">
            <h3>Your Delegates & Perspectives (1)</h3>
            <div className="perspective-item">
              <div className="perspective-header">
                <h4>Perspective 1</h4>
                <button className="btn-remove">Remove</button>
              </div>
              <div className="perspective-fields">
                <div className="form-group">
                  <label>Delegate Name *</label>
                  <input
                    type="text"
                    value={perspectives[0].name}
                    onChange={(e) => {
                      const updated = [...perspectives];
                      updated[0].name = e.target.value;
                      setPerspectives(updated);
                      setErrors({});
                    }}
                    placeholder="e.g., Optimist, Security Expert, CFO"
                    className={errors.name_0 ? 'error' : ''}
                  />
                  {errors.name_0 && (
                    <span className="error-message">{errors.name_0}</span>
                  )}
                </div>
                <div className="form-group full-width">
                  <label>Delegate Instructions (Role & Focus) *</label>
                  <textarea
                    value={perspectives[0].role}
                    onChange={(e) => {
                      const updated = [...perspectives];
                      updated[0].role = e.target.value;
                      setPerspectives(updated);
                      setErrors({});
                    }}
                    placeholder="Describe what this delegate should focus on..."
                    rows={3}
                    className={errors.role_0 ? 'error' : ''}
                  />
                  {errors.role_0 && (
                    <span className="error-message">{errors.role_0}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="step-actions">
          <button className="btn-secondary">← Back</button>
          <button onClick={validate} className="btn-primary">
            Next: How to Collect & Decide →
          </button>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Validation errors shown when required name or role fields are empty. Click Next to trigger validation. Errors clear when user starts typing.'
      }
    }
  }
};

/**
 * Interactive - Full perspective management
 */
export const Interactive = {
  render: function InteractiveDemo() {
    const [state, setState] = useState({
      globalModels: mockGlobalModels,
      perspectives: [],
      modelBound: false
    });

    const handleChange = (updates) => {
      console.log('State updated:', updates);
      setState(prev => ({ ...prev, ...updates }));
    };

    const handleNext = () => {
      if (state.perspectives.length === 0) {
        alert('Please add at least one perspective before proceeding.');
      } else {
        console.log('Next clicked - current state:', state);
        alert(`Moving to next step with ${state.perspectives.length} perspective(s) in ${state.modelBound ? 'model-bound' : 'model-neutral'} mode.`);
      }
    };

    const handleBack = () => {
      console.log('Back clicked');
      alert('Going back to Step 2');
    };

    return (
      <div>
        <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>Interactive Demo</h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
            Try toggling model binding mode, loading recommended combinations, browsing presets,
            or adding custom delegates. This is the most complex step with many interactive features.
          </p>
          <div style={{ marginTop: '10px', fontSize: '12px', fontFamily: 'monospace', background: 'white', padding: '10px', borderRadius: '4px' }}>
            modelBound: {state.modelBound ? 'true' : 'false'}<br/>
            perspectives: {state.perspectives.length} item(s)<br/>
            {state.modelBound
              ? `Mode: Specific models (${state.perspectives.length} analyses)`
              : `Mode: All models (${mockGlobalModels.length} × ${state.perspectives.length} = ${mockGlobalModels.length * state.perspectives.length} analyses)`
            }
          </div>
        </div>

        <Step3Perspectives
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
        story: 'Fully interactive Step 3. Toggle model binding, load combinations, browse 11 preset categories, add/remove perspectives. See real-time state updates and analysis count above.'
      }
    }
  }
};
