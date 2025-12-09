import { useState } from 'react';
import { mapWizardStateToWorkflow, validateWizardState } from '../utils/workflowWizardMapper.js';
import { getStrategyDescription } from '../utils/strategyTemplates.js';
import { isValidWorkflowId, sanitizeWorkflowId } from '../utils/workflowIdGenerator.js';
import { api } from '../../../api.js';

function Step6Review({ state, onChange, onBack, onSave }) {
  const [generatedWorkflow, setGeneratedWorkflow] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [workflowName, setWorkflowName] = useState(state.workflowId || '');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [workflowIdError, setWorkflowIdError] = useState('');

  // Auto-generate workflow on mount
  useState(() => {
    try {
      const workflow = mapWizardStateToWorkflow(state);
      setGeneratedWorkflow(workflow);
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
        <h2>Step 6: Review & Export Workflow</h2>
        <p className="step-description">
          Review your configuration and generate the workflow definition (JSON) that powers the advanced editor and runtime.
        </p>
      </div>

      <div className="step-content">
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
                <>Auto-generated from your workflow goal. You can customize it if needed.</>
              ) : (
                <>Unique identifier for this workflow (lowercase, underscores/hyphens allowed).</>
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
