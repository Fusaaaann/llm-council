import { useState } from 'react';
import Step6Review from '../../../components/workflow-editor/steps/Step6Review.jsx';
import { mockWizardStateBasic, mockWizardStateAdvanced } from '../../mockData.js';

/**
 * Step6Review - Final wizard step for reviewing and exporting workflow
 *
 * This is the most complex step with many features:
 * 1. Workflow summary with all configuration details
 * 2. Tier badge showing Basic/Advanced mode
 * 3. Active advanced features list
 * 4. Workflow ID and description fields
 * 5. DSL validation (client-side and server-side)
 * 6. JSON preview with syntax highlighting
 * 7. Actions: Regenerate, Validate, Download, Copy, Save
 *
 * The component auto-generates the workflow DSL on mount and validates it.
 */
export default {
  title: 'WorkflowEditor/Steps/Step6Review',
  component: Step6Review,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Final wizard step for reviewing workflow configuration and exporting. Auto-generates workflow JSON, validates DSL, and provides download/save options.'
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
    onBack: { action: 'back clicked' },
    onSave: { action: 'save clicked' }
  }
};

/**
 * Basic tier workflow - Simple workflow review
 */
export const BasicTierWorkflow = {
  args: {
    state: {
      ...mockWizardStateBasic,
      workflowId: 'tech_migration_framework'
    },
    onChange: () => {},
    onBack: () => {},
    onSave: async () => {
      console.log('Workflow saved');
      return Promise.resolve();
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Basic tier workflow showing summary of all configuration: problem statement, output format, perspectives, and collaboration strategy. Shows tier badge and workflow details form.'
      }
    }
  }
};

/**
 * Advanced tier workflow - Complex workflow with advanced features
 */
export const AdvancedTierWorkflow = {
  args: {
    state: mockWizardStateAdvanced,
    onChange: () => {},
    onBack: () => {},
    onSave: async () => {
      console.log('Workflow saved');
      return Promise.resolve();
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Advanced tier workflow showing all advanced features: middleware operations, follow-up steps, scope alignment, column-wise summary, and variable interpolation. Lists active advanced features.'
      }
    }
  }
};

/**
 * With validation errors - DSL validation failed
 */
export const WithValidationErrors = {
  render: function ValidationErrorsDemo() {
    const [dslErrors] = useState({
      valid: false,
      errors: [
        'Missing required field: perspectives[0].role',
        'Invalid model reference: perspectives[1].model must match pattern',
        'Global timeout exceeds maximum allowed value (600000ms)'
      ],
      warnings: [
        'Custom output format detected - ensure reduce phase supports this format',
        'No hard constraints specified - consider adding validation rules'
      ]
    });

    return (
      <div className="wizard-step step-review">
        <div className="step-header">
          <h2>Step 7: Review & Export Workflow</h2>
          <p className="step-description">
            Review and export your workflow definition.
          </p>
        </div>

        <div className="step-content">
          <div className="workflow-summary">
            <h3>Workflow Summary</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <label>Workflow Goal:</label>
                <span>Technology Migration Decision Framework</span>
              </div>
            </div>
          </div>

          <div className="dsl-validation-section">
            <h4>DSL Schema Validation</h4>
            <div className="validation-errors">
              <p>⚠️ DSL validation issues found:</p>
              <ul>
                {dslErrors.errors.map((err, i) => (
                  <li key={i} className="validation-error">{err}</li>
                ))}
              </ul>
            </div>
            {dslErrors.warnings && dslErrors.warnings.length > 0 && (
              <div className="validation-warnings">
                <p>⚠️ Warnings:</p>
                <ul>
                  {dslErrors.warnings.map((warn, i) => (
                    <li key={i} className="validation-warning">{warn}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="json-preview-section">
            <h3>Generated Workflow JSON</h3>
            <pre className="json-preview">
              {JSON.stringify({
                flow_id: 'tech_migration_framework',
                description: 'Technology migration decision workflow',
                // truncated for display
              }, null, 2)}
            </pre>
          </div>
        </div>

        <div className="step-actions">
          <button className="btn-secondary">← Back</button>
          <div className="action-buttons-group">
            <button className="btn-secondary">Regenerate</button>
            <button className="btn-secondary">Validate</button>
            <button className="btn-secondary">Download JSON</button>
            <button className="btn-secondary">Copy to Clipboard</button>
            <button className="btn-primary" disabled>Save & Test Workflow</button>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'DSL validation failed showing errors and warnings. Save button is disabled until errors are fixed. Shows both validation errors (must fix) and warnings (optional).'
      }
    }
  }
};

/**
 * With warnings - DSL warnings present
 */
export const WithWarnings = {
  render: function WarningsDemo() {
    const [dslResult] = useState({
      valid: true,
      errors: [],
      warnings: [
        'No middleware operations configured - outputs will not be filtered',
        'Using default chairman model - consider customizing for better results',
        'Concurrency limit not set - workflow may exceed rate limits'
      ]
    });

    return (
      <div className="wizard-step step-review">
        <div className="step-header">
          <h2>Step 7: Review & Export Workflow</h2>
          <p className="step-description">
            Review and export your workflow definition.
          </p>
        </div>

        <div className="step-content">
          <div className="workflow-summary">
            <h3>Workflow Summary</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <label>Workflow Goal:</label>
                <span>Strategic Planning Engine</span>
              </div>
            </div>
          </div>

          <div className="dsl-validation-section">
            <h4>DSL Schema Validation</h4>
            <div className="validation-success">
              <p>✅ DSL structure is valid</p>
            </div>
            <div className="validation-warnings">
              <p>⚠️ Warnings:</p>
              <ul>
                {dslResult.warnings.map((warn, i) => (
                  <li key={i} className="validation-warning">{warn}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="json-preview-section">
            <h3>Generated Workflow JSON</h3>
            <pre className="json-preview">
              {JSON.stringify({
                flow_id: 'strategic_planning_engine',
                description: 'Strategic planning workflow',
                // truncated for display
              }, null, 2)}
            </pre>
          </div>
        </div>

        <div className="step-actions">
          <button className="btn-secondary">← Back</button>
          <div className="action-buttons-group">
            <button className="btn-secondary">Regenerate</button>
            <button className="btn-secondary">Validate</button>
            <button className="btn-secondary">Download JSON</button>
            <button className="btn-secondary">Copy to Clipboard</button>
            <button className="btn-primary">Save & Test Workflow</button>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Valid workflow with warnings. Warnings are informational and don\'t prevent saving. Save button is enabled. Warnings help improve workflow quality but aren\'t required.'
      }
    }
  }
};

/**
 * Valid workflow - Fully valid workflow ready to save
 */
export const ValidWorkflow = {
  render: function ValidDemo() {
    const [dslResult] = useState({
      valid: true,
      errors: [],
      warnings: []
    });

    return (
      <div className="wizard-step step-review">
        <div className="step-header">
          <h2>Step 7: Review & Export Workflow</h2>
          <p className="step-description">
            Review and export your workflow definition.
          </p>
        </div>

        <div className="step-content">
          <div className="tier-summary-section">
            <div className="tier-summary-header">
              <h3>Workflow Configuration</h3>
              <div className="tier-badge tier-basic">🌱 Basic Mode</div>
            </div>
          </div>

          <div className="workflow-summary">
            <h3>Workflow Summary</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <label>Workflow Goal:</label>
                <span>Technology Migration Decision Framework</span>
              </div>
              <div className="summary-item">
                <label>Final Answer Format:</label>
                <span className="badge">TEXT SUMMARY</span>
              </div>
              <div className="summary-item">
                <label>Delegates & Perspectives:</label>
                <span>3 delegates</span>
                <ul className="perspectives-list-compact">
                  <li>Security Expert</li>
                  <li>User Advocate</li>
                  <li>Technical Architect</li>
                </ul>
              </div>
              <div className="summary-item">
                <label>Collaboration & Collection Strategy:</label>
                <span>INDEPENDENT SYNTHESIS</span>
              </div>
            </div>
          </div>

          <div className="workflow-details">
            <h3>Workflow Details</h3>
            <div className="form-group">
              <label htmlFor="workflowName">
                Workflow ID <span className="required">*</span>
              </label>
              <input
                type="text"
                id="workflowName"
                value="tech_migration_framework"
                placeholder="tech_migration_framework"
              />
              <span className="help-text">Auto-generated. Customize if needed.</span>
            </div>
            <div className="form-group">
              <label htmlFor="workflowDescription">
                Description <span className="optional">(optional)</span>
              </label>
              <textarea
                id="workflowDescription"
                placeholder="Describe what this workflow does..."
                rows={2}
              />
            </div>
          </div>

          <div className="dsl-validation-section">
            <h4>DSL Schema Validation</h4>
            <div className="validation-success">
              <p>✅ DSL structure is valid</p>
            </div>
          </div>

          <div className="json-preview-section">
            <h3>Generated Workflow JSON</h3>
            <pre className="json-preview">
              {JSON.stringify({
                flow_id: 'tech_migration_framework',
                perspectives: [
                  { name: 'Security Expert', role: 'Focus on security...' },
                  { name: 'User Advocate', role: 'Prioritize user experience...' },
                  { name: 'Technical Architect', role: 'Evaluate technical feasibility...' }
                ],
                reduce: { strategy: 'independent_synthesis' }
              }, null, 2)}
            </pre>
          </div>
        </div>

        <div className="step-actions">
          <button className="btn-secondary">← Back</button>
          <div className="action-buttons-group">
            <button className="btn-secondary">Regenerate</button>
            <button className="btn-secondary">Validate</button>
            <button className="btn-secondary">Download JSON</button>
            <button className="btn-secondary">Copy to Clipboard</button>
            <button className="btn-primary">Save & Test Workflow</button>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Fully valid workflow with no errors or warnings. All buttons enabled. Shows complete summary, workflow details form, validation success, and JSON preview.'
      }
    }
  }
};

/**
 * Interactive generation - Generate/validate/download workflow
 */
export const InteractiveGeneration = {
  render: function InteractiveDemo() {
    const [workflowId, setWorkflowId] = useState('custom_workflow');
    const [description, setDescription] = useState('');
    const [validationStatus, setValidationStatus] = useState(null);

    const handleGenerate = () => {
      console.log('Regenerating workflow...');
      alert('Workflow regenerated successfully!');
    };

    const handleValidate = () => {
      console.log('Validating workflow...');
      setValidationStatus({ valid: true, errors: [] });
      alert('✅ Workflow is valid!');
    };

    const handleDownload = () => {
      console.log('Downloading workflow...');
      alert('Workflow downloaded as JSON file!');
    };

    const handleCopy = () => {
      console.log('Copying to clipboard...');
      alert('Workflow copied to clipboard!');
    };

    const handleSave = () => {
      console.log('Saving workflow...', { id: workflowId, description });
      alert(`Workflow "${workflowId}" saved successfully!`);
    };

    return (
      <div>
        <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>Interactive Demo</h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
            Try the action buttons: Regenerate, Validate, Download, Copy, and Save.
            Edit the workflow ID and description. Check the Actions panel for events.
          </p>
          <div style={{ marginTop: '10px', fontSize: '12px', fontFamily: 'monospace', background: 'white', padding: '10px', borderRadius: '4px' }}>
            workflowId: {workflowId}<br/>
            description: {description || '(empty)'}<br/>
            validationStatus: {validationStatus ? 'valid ✅' : 'not validated yet'}
          </div>
        </div>

        <div className="wizard-step step-review">
          <div className="step-header">
            <h2>Step 7: Review & Export Workflow</h2>
            <p className="step-description">
              Review and export your workflow definition.
            </p>
          </div>

          <div className="step-content">
            <div className="workflow-summary">
              <h3>Workflow Summary</h3>
              <div className="summary-grid">
                <div className="summary-item">
                  <label>Workflow Goal:</label>
                  <span>Technology Migration Decision Framework</span>
                </div>
                <div className="summary-item">
                  <label>Delegates & Perspectives:</label>
                  <span>3 delegates</span>
                </div>
              </div>
            </div>

            <div className="workflow-details">
              <h3>Workflow Details</h3>
              <div className="form-group">
                <label htmlFor="workflowName">
                  Workflow ID <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="workflowName"
                  value={workflowId}
                  onChange={(e) => setWorkflowId(e.target.value)}
                  placeholder="Enter workflow ID"
                />
              </div>
              <div className="form-group">
                <label htmlFor="workflowDescription">
                  Description <span className="optional">(optional)</span>
                </label>
                <textarea
                  id="workflowDescription"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this workflow does..."
                  rows={2}
                />
              </div>
            </div>

            {validationStatus && (
              <div className="validation-result valid">
                <p>✅ Workflow is valid and ready to use!</p>
              </div>
            )}

            <div className="json-preview-section">
              <h3>Generated Workflow JSON</h3>
              <pre className="json-preview">
                {JSON.stringify({ flow_id: workflowId, perspectives: [] }, null, 2)}
              </pre>
            </div>
          </div>

          <div className="step-actions">
            <button onClick={() => alert('Back to Step 5')} className="btn-secondary">
              ← Back
            </button>

            <div className="action-buttons-group">
              <button onClick={handleGenerate} className="btn-secondary">
                Regenerate
              </button>
              <button onClick={handleValidate} className="btn-secondary">
                Validate
              </button>
              <button onClick={handleDownload} className="btn-secondary">
                Download JSON
              </button>
              <button onClick={handleCopy} className="btn-secondary">
                Copy to Clipboard
              </button>
              <button onClick={handleSave} className="btn-primary">
                Save & Test Workflow
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Fully interactive Step 6. Try all action buttons, edit workflow ID and description, and see validation results. Check Actions panel and alerts for feedback.'
      }
    }
  }
};

/**
 * Long workflow - Tests JSON preview scrolling
 */
export const LongWorkflow = {
  render: function LongWorkflowDemo() {
    const longWorkflow = {
      flow_id: 'comprehensive_analysis',
      description: 'Comprehensive multi-perspective analysis workflow',
      perspectives: Array.from({ length: 10 }, (_, i) => ({
        id: `perspective_${i + 1}`,
        name: `Perspective ${i + 1}`,
        role: `Role definition for perspective ${i + 1} with detailed instructions...`,
        modelBound: false
      })),
      reduce: {
        strategy: 'independent_synthesis',
        chairman: { model: 'openai/gpt-4o', instructions: 'Synthesize all perspectives...' }
      },
      middleware: [
        { op: 'filter_regex', config: { pattern: '.*', action: 'flag' } },
        { op: 'anonymize_pii', config: {} },
        { op: 'truncate', config: { max_length: 5000, strategy: 'smart' } }
      ],
      follow_up_steps: [
        { taskDescription: 'Generate executive summary', outputVar: 'executive_summary' },
        { taskDescription: 'Create action items list', outputVar: 'action_items' },
        { taskDescription: 'Identify key risks', outputVar: 'risk_assessment' }
      ]
    };

    return (
      <div className="wizard-step step-review">
        <div className="step-header">
          <h2>Step 7: Review & Export Workflow</h2>
          <p className="step-description">
            Review and export your workflow definition.
          </p>
        </div>

        <div className="step-content">
          <div className="tier-summary-section">
            <div className="tier-summary-header">
              <h3>Workflow Configuration</h3>
              <div className="tier-badge tier-advanced">⚡ Advanced Mode</div>
            </div>
            <div className="advanced-features-summary">
              <h4>⚡ Advanced Features in Use:</h4>
              <ul className="advanced-features-list">
                <li><span className="feature-icon">✓</span>Middleware Operations (3)</li>
                <li><span className="feature-icon">✓</span>Follow-Up Steps (3)</li>
                <li><span className="feature-icon">✓</span>Multiple Perspectives (10)</li>
              </ul>
            </div>
          </div>

          <div className="workflow-summary">
            <h3>Workflow Summary</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <label>Delegates & Perspectives:</label>
                <span>10 delegates</span>
                <ul className="perspectives-list-compact">
                  {longWorkflow.perspectives.map((p, i) => (
                    <li key={i}>{p.name}</li>
                  ))}
                </ul>
              </div>
              <div className="summary-item">
                <label>Middleware Operations:</label>
                <span>3 operation(s)</span>
              </div>
              <div className="summary-item">
                <label>Follow-Up Steps:</label>
                <span>3 additional processing step(s)</span>
              </div>
            </div>
          </div>

          <div className="json-preview-section">
            <h3>Generated Workflow JSON</h3>
            <pre className="json-preview" style={{ maxHeight: '400px', overflow: 'auto' }}>
              {JSON.stringify(longWorkflow, null, 2)}
            </pre>
          </div>
        </div>

        <div className="step-actions">
          <button className="btn-secondary">← Back</button>
          <div className="action-buttons-group">
            <button className="btn-secondary">Regenerate</button>
            <button className="btn-secondary">Validate</button>
            <button className="btn-secondary">Download JSON</button>
            <button className="btn-secondary">Copy to Clipboard</button>
            <button className="btn-primary">Save & Test Workflow</button>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Long workflow with 10 perspectives, 3 middleware operations, and 3 follow-up steps. Tests JSON preview scrolling and summary display for complex workflows.'
      }
    }
  }
};
