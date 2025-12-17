/**
 * Step4AdvancedFeatures - Advanced tier configuration
 * Shown after Basic Steps 1-3 when in Advanced mode
 * Includes: Multi-superstep, Concurrency, Middleware, Column-wise summary, Advanced visibility
 */

import { useState } from 'react';
import QuestionCard from '../components/QuestionCard.jsx';
import MiddlewareBuilder from '../components/MiddlewareBuilder.jsx';

function Step4AdvancedFeatures({ state, onChange, onNext, onBack }) {
  const [errors, setErrors] = useState({});

  // Extract state
  const followUpSteps = state.followUpSteps || [];
  const concurrencyLimit = state.concurrencyLimit;
  const middleware = state.middleware || [];
  const useColumnWiseSummary = state.useColumnWiseSummary || false;
  const advancedVisibility = state.advancedVisibility || {
    includeRejectedItems: false,
    includeConversationHistory: true
  };

  const handleAddFollowUpStep = () => {
    const newStep = {
      id: `followup_${Date.now()}`,
      inputVariables: [],
      taskDescription: '',
      mode: 'single_worker',
      workerModel: null,
      outputVar: '',
      workers: [],
      reduceStrategy: 'simple_summary',
      visibility: 'full',
      middleware: []
    };
    onChange({ followUpSteps: [...followUpSteps, newStep] });
  };

  const handleRemoveFollowUpStep = (index) => {
    onChange({ followUpSteps: followUpSteps.filter((_, i) => i !== index) });
  };

  const handleUpdateFollowUpStep = (index, updates) => {
    const updated = [...followUpSteps];
    updated[index] = { ...updated[index], ...updates };
    onChange({ followUpSteps: updated });
  };

  const handleConcurrencyChange = (e) => {
    const value = e.target.value;
    onChange({ concurrencyLimit: value === '' ? null : parseInt(value) });
  };

  const handleColumnWiseToggle = (enabled) => {
    onChange({ useColumnWiseSummary: enabled });
  };

  const handleAdvancedVisibilityChange = (field, value) => {
    onChange({
      advancedVisibility: {
        ...advancedVisibility,
        [field]: value
      }
    });
  };

  const handleValidateAndNext = () => {
    const newErrors = {};

    // Validate follow-up steps
    followUpSteps.forEach((step, index) => {
      if (!step.taskDescription) {
        newErrors[`followup_${index}_task`] = 'Task description is required';
      }
      if (!step.outputVar) {
        newErrors[`followup_${index}_output`] = 'Output variable is required';
      }
      if ((step.mode === 'single_worker' || step.mode === 'chairman_only') && !step.workerModel) {
        newErrors[`followup_${index}_model`] = 'Model is required';
      }
    });

    // Validate concurrency limit
    if (concurrencyLimit !== null && (concurrencyLimit < 1 || isNaN(concurrencyLimit))) {
      newErrors.concurrencyLimit = 'Concurrency limit must be a positive integer';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onNext();
    }
  };

  // Get available variables for follow-up steps
  const getAvailableVariables = () => {
    const vars = [{ name: 'final_answer', label: 'Final Answer from Main Workflow' }];

    followUpSteps.forEach((step, idx) => {
      if (step.outputVar) {
        vars.push({
          name: step.outputVar,
          label: `Output from Follow-up ${idx + 1}: ${step.taskDescription || 'Untitled'}`
        });
      }
    });

    return vars;
  };

  return (
    <div className="wizard-step step-advanced-features">
      <div className="step-header">
        <h2>Step 4: Advanced Features ⚡</h2>
        <p className="step-description">
          Configure advanced workflow capabilities including multi-step workflows, middleware pipelines, and performance optimization.
        </p>
      </div>

      <div className="step-content">
        {/* Q6.1: Multi-Superstep (Follow-Up Steps) */}
        <QuestionCard
          question="Q6.1: Do you need multiple workflow stages?"
          description="Add follow-up steps that process the main workflow's output (e.g., risk analysis, format conversion, validation)."
        >
          <div className="follow-up-steps-section">
            {followUpSteps.length === 0 ? (
              <div className="empty-state">
                <p>No follow-up steps configured. The workflow will output the final answer directly.</p>
                <button onClick={handleAddFollowUpStep} className="btn-primary" type="button">
                  + Add Follow-Up Step
                </button>
              </div>
            ) : (
              <>
                {followUpSteps.map((step, index) => (
                  <div key={step.id} className="follow-up-step-card">
                    <div className="step-card-header">
                      <h4>Follow-Up Step {index + 1}</h4>
                      <button
                        onClick={() => handleRemoveFollowUpStep(index)}
                        className="btn-remove-small"
                        type="button"
                      >
                        ×
                      </button>
                    </div>

                    {/* Input Variables */}
                    <div className="form-group">
                      <label>Use results from:</label>
                      <div className="checkbox-list">
                        {getAvailableVariables().map(variable => (
                          <label key={variable.name} className="checkbox-option">
                            <input
                              type="checkbox"
                              checked={(step.inputVariables || []).includes(variable.name)}
                              onChange={(e) => {
                                const inputVars = e.target.checked
                                  ? [...(step.inputVariables || []), variable.name]
                                  : (step.inputVariables || []).filter(v => v !== variable.name);
                                handleUpdateFollowUpStep(index, { inputVariables: inputVars });
                              }}
                            />
                            <span>{variable.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Task Description */}
                    <div className="form-group">
                      <label>
                        What should this step do?
                        <span className="required">*</span>
                      </label>
                      <textarea
                        value={step.taskDescription || ''}
                        onChange={(e) => handleUpdateFollowUpStep(index, { taskDescription: e.target.value })}
                        placeholder="e.g., 'Analyze risks mentioned in the final answer and rate them from 1-10'"
                        rows={3}
                      />
                      {errors[`followup_${index}_task`] && (
                        <span className="error-text">{errors[`followup_${index}_task`]}</span>
                      )}
                    </div>

                    {/* Mode Selection */}
                    <div className="form-group">
                      <label>Execution mode:</label>
                      <select
                        value={step.mode}
                        onChange={(e) => handleUpdateFollowUpStep(index, { mode: e.target.value })}
                      >
                        <option value="single_worker">Single AI Worker</option>
                        <option value="chairman_only">Chairman Only</option>
                        <option value="multiple_workers">Multiple Workers (Advanced)</option>
                      </select>
                    </div>

                    {/* Model Selection (for simple modes) */}
                    {(step.mode === 'single_worker' || step.mode === 'chairman_only') && (
                      <div className="form-group">
                        <label>
                          Model
                          <span className="required">*</span>
                        </label>
                        <select
                          value={step.workerModel || ''}
                          onChange={(e) => handleUpdateFollowUpStep(index, { workerModel: e.target.value })}
                        >
                          <option value="">Select a model...</option>
                          {(state.globalModels || []).map(m => (
                            <option key={m.modelRef} value={m.modelRef}>
                              {m.displayName || m.modelRef}
                            </option>
                          ))}
                        </select>
                        {errors[`followup_${index}_model`] && (
                          <span className="error-text">{errors[`followup_${index}_model`]}</span>
                        )}
                      </div>
                    )}

                    {/* Output Variable */}
                    <div className="form-group">
                      <label>
                        Save result to variable:
                        <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        value={step.outputVar || ''}
                        onChange={(e) => handleUpdateFollowUpStep(index, { outputVar: e.target.value })}
                        placeholder={`step_${index + 1}_result`}
                      />
                      {errors[`followup_${index}_output`] && (
                        <span className="error-text">{errors[`followup_${index}_output`]}</span>
                      )}
                      <span className="help-text">
                        This variable can be used by subsequent follow-up steps.
                      </span>
                    </div>
                  </div>
                ))}

                <button onClick={handleAddFollowUpStep} className="btn-secondary" type="button">
                  + Add Another Follow-Up Step
                </button>
              </>
            )}

            <div className="info-box">
              <strong>💡 Common Follow-Up Steps:</strong>
              <ul>
                <li><strong>Risk Analysis:</strong> Identify and rate risks in the final answer</li>
                <li><strong>Executive Summary:</strong> Create a concise 1-paragraph summary</li>
                <li><strong>Format Conversion:</strong> Convert text to JSON, markdown, etc.</li>
                <li><strong>Validation:</strong> Check answer against constraints/requirements</li>
              </ul>
            </div>
          </div>
        </QuestionCard>

        {/* Q7.1: Concurrency Limit */}
        <QuestionCard
          question="Q7.1: Limit concurrent worker execution?"
          description="Control how many workers can run simultaneously to manage rate limits and costs."
          error={errors.concurrencyLimit}
        >
          <div className="concurrency-controls">
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  checked={concurrencyLimit === null}
                  onChange={() => onChange({ concurrencyLimit: null })}
                />
                <div className="radio-label">
                  <strong>No Limit</strong>
                  <span className="radio-description">All workers run in parallel (fastest, may hit rate limits)</span>
                </div>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  checked={concurrencyLimit !== null}
                  onChange={() => onChange({ concurrencyLimit: 3 })}
                />
                <div className="radio-label">
                  <strong>Set Limit</strong>
                  <span className="radio-description">Control concurrency for rate limit and cost management</span>
                </div>
              </label>
            </div>

            {concurrencyLimit !== null && (
              <div className="form-group">
                <label>Max concurrent workers:</label>
                <input
                  type="number"
                  min="1"
                  value={concurrencyLimit || ''}
                  onChange={handleConcurrencyChange}
                  placeholder="e.g., 3"
                />
                <span className="help-text">
                  Recommended: 3-5 for API rate limits, 10+ for high throughput
                </span>
              </div>
            )}
          </div>
        </QuestionCard>

        {/* Q8: Middleware Pipeline */}
        <QuestionCard
          question="Q8: Add middleware operations?"
          description="Filter, transform, or refine worker outputs before the reduce phase."
        >
          <MiddlewareBuilder
            middleware={middleware}
            onChange={(updatedMiddleware) => onChange({ middleware: updatedMiddleware })}
            globalModels={state.globalModels || []}
          />
        </QuestionCard>

        {/* Q9.1: Column-Wise Summary */}
        <QuestionCard
          question="Q9.1: Use column-wise reduction?"
          description="Compare models per-perspective instead of global synthesis (useful for comparing model capabilities across different perspectives)."
        >
          <div className="radio-group">
            <label className="radio-option">
              <input
                type="radio"
                checked={!useColumnWiseSummary}
                onChange={() => handleColumnWiseToggle(false)}
              />
              <div className="radio-label">
                <strong>No (Default)</strong>
                <span className="radio-description">
                  Global synthesis: Chairman sees all responses and creates unified answer
                </span>
              </div>
            </label>

            <label className="radio-option">
              <input
                type="radio"
                checked={useColumnWiseSummary}
                onChange={() => handleColumnWiseToggle(true)}
              />
              <div className="radio-label">
                <strong>Yes, Use Column-Wise</strong>
                <span className="radio-description">
                  Per-perspective comparison: Compare models within each perspective independently
                </span>
              </div>
            </label>
          </div>

          {useColumnWiseSummary && (
            <div className="info-box">
              <strong>📊 Column-Wise Reduction:</strong>
              <p>
                Instead of synthesizing all responses together, the chairman will compare models
                within each perspective independently. This is useful when you want to evaluate
                which models perform best on specific types of analysis.
              </p>
              <p>
                <strong>Example:</strong> For perspectives [Security, Performance, UX], the chairman
                will compare Model A vs Model B vs Model C separately for each perspective.
              </p>
            </div>
          )}
        </QuestionCard>

        {/* Q11: Advanced Visibility Controls */}
        <QuestionCard
          question="Q11: Advanced visibility controls?"
          description="Control what information workers and chairman can see."
        >
          <div className="visibility-controls">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={advancedVisibility.includeRejectedItems}
                onChange={(e) => handleAdvancedVisibilityChange('includeRejectedItems', e.target.checked)}
              />
              <div className="checkbox-label">
                <strong>Include Rejected Items</strong>
                <span className="checkbox-description">
                  Show outputs that were filtered/flagged by middleware to the chairman
                </span>
              </div>
            </label>

            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={advancedVisibility.includeConversationHistory}
                onChange={(e) => handleAdvancedVisibilityChange('includeConversationHistory', e.target.checked)}
              />
              <div className="checkbox-label">
                <strong>Include Conversation History</strong>
                <span className="checkbox-description">
                  Provide full conversation context to workers (recommended for follow-up questions)
                </span>
              </div>
            </label>
          </div>
        </QuestionCard>
      </div>

      <div className="step-actions">
        <button onClick={onBack} className="btn-secondary">
          ← Back
        </button>
        <button onClick={handleValidateAndNext} className="btn-primary">
          Next: Variables & Interpolation →
        </button>
      </div>
    </div>
  );
}

export default Step4AdvancedFeatures;
