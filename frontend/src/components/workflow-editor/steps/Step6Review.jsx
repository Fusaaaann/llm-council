import { useState } from 'react';
import { mapWizardStateToWorkflow, validateWizardState } from '../utils/workflowWizardMapper.js';
import { getStrategyDescription } from '../utils/strategyTemplates.js';
import { isValidWorkflowId, sanitizeWorkflowId } from '../utils/workflowIdGenerator.js';
import { detectTier, getActiveAdvancedFeatures, TIERS } from '../utils/tierDetection.js';
import { validateWorkflowDSL } from '../utils/dslValidator.js';
import TierBadge from '../components/TierBadge.jsx';
import { api } from '../../../api.js';

function Step6Review({ state, onChange, onBack, onSave }) {
  const [generatedWorkflow, setGeneratedWorkflow] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [workflowName, setWorkflowName] = useState(state.workflowId || '');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [workflowIdError, setWorkflowIdError] = useState('');
  const [dslValidationResult, setDslValidationResult] = useState(null);

  // Detect tier
  const currentTier = detectTier(state);
  const activeAdvancedFeatures = getActiveAdvancedFeatures(state);

  // Auto-generate workflow on mount
  useState(() => {
    try {
      const workflow = mapWizardStateToWorkflow(state);
      setGeneratedWorkflow(workflow);

      // Auto-validate DSL on generation
      const dslValidation = validateWorkflowDSL(workflow);
      setDslValidationResult(dslValidation);
    } catch (error) {
      console.error('Error generating workflow:', error);
    }
  }, [state]);

  const handleGenerate = () => {
    try {
      const errors = validateWizardState(state);
      if (errors.length > 0) {
        setValidationResult({
          valid: false,
          errors: errors
        });
        return;
      }

      const workflow = mapWizardStateToWorkflow(state);
      setGeneratedWorkflow(workflow);

      // Client-side DSL validation
      const dslValidation = validateWorkflowDSL(workflow);
      setDslValidationResult(dslValidation);

      setValidationResult(null);
    } catch (error) {
      setValidationResult({
        valid: false,
        errors: [error.message]
      });
    }
  };

  const handleValidate = async () => {
    if (!generatedWorkflow) {
      handleGenerate();
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const result = await api.validateWorkflow({
        name: workflowName || 'Untitled Workflow',
        workflow: generatedWorkflow
      });

      setValidationResult(result);
    } catch (error) {
      setValidationResult({
        valid: false,
        errors: [error.message || 'Validation failed']
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedWorkflow) return;

    const dataStr = JSON.stringify(generatedWorkflow, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${generatedWorkflow.flow_id || 'workflow'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = () => {
    if (!generatedWorkflow) return;

    navigator.clipboard.writeText(JSON.stringify(generatedWorkflow, null, 2));
    alert('Workflow copied to clipboard!');
  };

  const handleWorkflowNameChange = (newName) => {
    setWorkflowName(newName);

    // Validate
    if (newName && !isValidWorkflowId(newName)) {
      setWorkflowIdError('ID must be lowercase alphanumeric with underscores/hyphens, 3-64 characters');
    } else {
      setWorkflowIdError('');
    }

    // Mark as manually set so auto-generation stops
    if (onChange) {
      onChange({ workflowId: newName, workflowIdManuallySet: true });
    }
  };

  const handleSave = async () => {
    if (!generatedWorkflow) return;

    // Final validation of workflow ID
    const finalId = workflowName || generatedWorkflow.flow_id;
    if (!isValidWorkflowId(finalId)) {
      setWorkflowIdError('Please provide a valid workflow ID');
      return;
    }

    try {
      await onSave({
        name: finalId,
        description: workflowDescription,
        workflow: generatedWorkflow
      });
    } catch (error) {
      alert(`Failed to save workflow: ${error.message}`);
    }
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
        {/* Tier Summary */}
        <div className="tier-summary-section">
          <div className="tier-summary-header">
            <h3>Workflow Configuration</h3>
            <TierBadge tier={currentTier} />
          </div>

          {currentTier === TIERS.ADVANCED && activeAdvancedFeatures.length > 0 && (
            <div className="advanced-features-summary">
              <h4>⚡ Advanced Features in Use:</h4>
              <ul className="advanced-features-list">
                {activeAdvancedFeatures.map(feature => (
                  <li key={feature}>
                    <span className="feature-icon">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="workflow-summary">
          <h3>Workflow Summary</h3>

          <div className="summary-grid">
            <div className="summary-item">
              <label>Workflow Goal:</label>
              <span>{state.problemStatement || 'Not specified'}</span>
            </div>

            {state.audience && (
              <div className="summary-item">
                <label>Audience:</label>
                <span>{state.audience}</span>
              </div>
            )}

            <div className="summary-item">
              <label>Final Answer Format:</label>
              <span className="badge">
                {state.outputFormat?.replace('_', ' ').toUpperCase() || 'TEXT'}
              </span>
            </div>

            {state.qualities && state.qualities.length > 0 && (
              <div className="summary-item">
                <label>Key Qualities:</label>
                <div className="qualities-list">
                  {state.qualities.map(q => (
                    <span key={q} className="badge-secondary">
                      {q.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="summary-item">
              <label>Delegates & Perspectives:</label>
              <span>{state.perspectives?.length || 0} delegates</span>
              <ul className="perspectives-list-compact">
                {state.perspectives?.map((p, idx) => (
                  <li key={idx}>{p.name}</li>
                ))}
              </ul>
            </div>

            <div className="summary-item">
              <label>Collaboration & Collection Strategy:</label>
              <span>{state.interactionMode?.replace('_', ' ').toUpperCase() || 'INDEPENDENT'}</span>
              <p className="strategy-description">
                {getStrategyDescription(state.interactionMode)}
              </p>
            </div>

            {state.decisionMaker?.type === 'chairman' && (
              <div className="summary-item">
                <label>Collector Model:</label>
                <span className="badge">{state.decisionMaker.model || 'GPT-4'}</span>
              </div>
            )}

            <div className="summary-item">
              <label>Workflow Time Limit:</label>
              <span>{(state.globalTimeout || 120000) / 1000} seconds</span>
            </div>

            {state.filters && state.filters.length > 0 && (
              <div className="summary-item">
                <label>Filters:</label>
                <div className="filters-list">
                  {state.filters.map(f => (
                    <span key={f} className="badge-secondary">
                      {f.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Global Models Summary */}
            {state.globalModels && state.globalModels.filter(m => !m.isDefault).length > 0 && (
              <div className="summary-item">
                <label>Custom Models:</label>
                <span>{state.globalModels.filter(m => !m.isDefault).length} custom model(s) added</span>
                <ul className="perspectives-list-compact">
                  {state.globalModels.filter(m => !m.isDefault).map((model, idx) => (
                    <li key={idx}>{model.label} ({model.modelRef})</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Follow-Up Steps Summary */}
            {state.followUpSteps && state.followUpSteps.length > 0 && (
              <div className="summary-item">
                <label>Follow-Up Steps:</label>
                <span>{state.followUpSteps.length} additional processing step(s)</span>
                <ul className="perspectives-list-compact">
                  {state.followUpSteps.map((step, idx) => (
                    <li key={idx}>
                      Step {idx + 1}: {step.taskDescription || 'Untitled'} → {step.outputVar}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Advanced Tier Fields */}
            {state.concurrencyLimit && (
              <div className="summary-item">
                <label>Concurrency Limit:</label>
                <span className="badge">{state.concurrencyLimit} concurrent workers</span>
              </div>
            )}

            {state.middleware && state.middleware.length > 0 && (
              <div className="summary-item">
                <label>Middleware Operations:</label>
                <span>{state.middleware.length} operation(s)</span>
                <ul className="perspectives-list-compact">
                  {state.middleware.map((op, idx) => (
                    <li key={idx}>
                      {op.op} (apply to: {op.apply_to?.join(', ') || '*'})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {state.useColumnWiseSummary && (
              <div className="summary-item">
                <label>Reduction Strategy:</label>
                <span className="badge-secondary">Column-Wise Summary</span>
              </div>
            )}

            {state.variables && state.variables.length > 0 && (
              <div className="summary-item">
                <label>Custom Variables:</label>
                <span>{state.variables.length} variable(s) defined</span>
                <ul className="perspectives-list-compact">
                  {state.variables.map((v, idx) => (
                    <li key={idx}>
                      {v.name} ({v.type}){v.required ? ' *' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {state.variableInterpolation && (
              <div className="summary-item">
                <label>Variable Interpolation:</label>
                <span className="badge-secondary">Enabled</span>
              </div>
            )}

            {state.scopeAlignment?.enabled && (
              <div className="summary-item">
                <label>Scope Alignment:</label>
                <span className="badge-secondary">Enabled</span>
                <p className="help-text">
                  Coordinator: {state.scopeAlignment.coordinatorModel || 'Not specified'}
                </p>
              </div>
            )}

            {state.advancedVisibility?.includeRejectedItems && (
              <div className="summary-item">
                <label>Include Rejected Items:</label>
                <span className="badge-secondary">Yes</span>
              </div>
            )}
          </div>
        </div>

        {/* Workflow Details for Save */}
        <div className="workflow-details">
          <h3>Workflow Details</h3>
          <div className="form-group">
            <label htmlFor="workflowName">
              Workflow ID
              <span className="required">*</span>
            </label>
            <input
              type="text"
              id="workflowName"
              value={workflowName}
              onChange={(e) => handleWorkflowNameChange(e.target.value)}
              placeholder={generatedWorkflow?.flow_id || 'Enter workflow ID'}
              className={workflowIdError ? 'error' : ''}
            />
            {workflowIdError && (
              <span className="error-message">{workflowIdError}</span>
            )}
            <span className="help-text">
              {state.workflowId ? (
                <>Auto-generated. Customize if needed.</>
              ) : (
                <>Unique ID (lowercase, underscores/hyphens).</>
              )}
            </span>
          </div>
          <div className="form-group">
            <label htmlFor="workflowDescription">Description <span className="optional">(optional)</span></label>
            <textarea
              id="workflowDescription"
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
              placeholder="Describe what this workflow does..."
              rows={2}
            />
          </div>
        </div>

        {/* Validation Result */}
        {validationResult && (
          <div className={`validation-result ${validationResult.valid ? 'valid' : 'invalid'}`}>
            {validationResult.valid ? (
              <p>✅ Workflow is valid and ready to use!</p>
            ) : (
              <div>
                <p>❌ Validation failed:</p>
                <ul>
                  {validationResult.errors?.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Client-Side DSL Validation */}
        {dslValidationResult && (
          <div className="dsl-validation-section">
            <h4>DSL Schema Validation</h4>
            {dslValidationResult.valid ? (
              <div className="validation-success">
                <p>✅ DSL structure is valid</p>
              </div>
            ) : (
              <div className="validation-errors">
                <p>⚠️ DSL validation issues found:</p>
                <ul>
                  {dslValidationResult.errors?.map((err, i) => (
                    <li key={i} className="validation-error">{err}</li>
                  ))}
                </ul>
              </div>
            )}
            {dslValidationResult.warnings && dslValidationResult.warnings.length > 0 && (
              <div className="validation-warnings">
                <p>⚠️ Warnings:</p>
                <ul>
                  {dslValidationResult.warnings.map((warn, i) => (
                    <li key={i} className="validation-warning">{warn}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* JSON Preview */}
        <div className="json-preview-section">
          <h3>Generated Workflow JSON</h3>
          <pre className="json-preview">
            {generatedWorkflow
              ? JSON.stringify(generatedWorkflow, null, 2)
              : '// Click "Regenerate" to see the JSON definition for this workflow'}
          </pre>
        </div>
      </div>

      <div className="step-actions">
        <button onClick={onBack} className="btn-secondary">
          ← Back
        </button>

        <div className="action-buttons-group">
          <button
            onClick={handleGenerate}
            className="btn-secondary"
          >
            Regenerate
          </button>

          <button
            onClick={handleValidate}
            className="btn-secondary"
            disabled={isValidating || !generatedWorkflow}
          >
            {isValidating ? 'Validating...' : 'Validate'}
          </button>

          <button
            onClick={handleDownload}
            className="btn-secondary"
            disabled={!generatedWorkflow}
          >
            Download JSON
          </button>

          <button
            onClick={handleCopyToClipboard}
            className="btn-secondary"
            disabled={!generatedWorkflow}
          >
            Copy to Clipboard
          </button>

          <button
            onClick={handleSave}
            className="btn-primary"
            disabled={!generatedWorkflow || (validationResult && !validationResult.valid)}
          >
            Save & Test Workflow
          </button>
        </div>
      </div>
    </div>
  );
}

export default Step6Review;
