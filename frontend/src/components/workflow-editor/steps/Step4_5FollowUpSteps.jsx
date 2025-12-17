import { useState } from 'react';
import ModelSelect from '../components/ModelSelect.jsx';

function Step4_5FollowUpSteps({ state, onChange, onNext, onBack }) {
  const [showAdvanced, setShowAdvanced] = useState([]);

  const followUpSteps = state.followUpSteps || [];

  // Get available variables from main workflow + previous follow-ups
  const getAvailableVariables = () => {
    const vars = [{ name: getFinalOutputVar(state), label: 'Final Answer from Main Workflow' }];

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

  const addFollowUpStep = () => {
    const newStep = {
      id: `followup_${Date.now()}`,
      inputVariables: [], // Variables to read
      taskDescription: '',
      mode: 'single_worker', // 'single_worker', 'chairman_only', 'multiple_workers'
      workerModel: null,
      outputVar: '',
      // Advanced settings (future)
      workers: [],
      reduceStrategy: 'simple_summary',
      visibility: 'full',
      middleware: []
    };

    onChange({ followUpSteps: [...followUpSteps, newStep] });
  };

  const removeFollowUpStep = (index) => {
    onChange({ followUpSteps: followUpSteps.filter((_, i) => i !== index) });
  };

  const updateFollowUpStep = (index, updates) => {
    const updated = [...followUpSteps];
    updated[index] = { ...updated[index], ...updates };
    onChange({ followUpSteps: updated });
  };

  const toggleAdvanced = (index) => {
    setShowAdvanced(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  return (
    <div className="wizard-step step-follow-up">
      <div className="step-header">
        <h2>Step 5: Follow-Up Steps (Optional)</h2>
        <p className="step-description">
          Add additional processing steps after the main workflow completes.
          Examples: risk analysis, executive summary, format conversion, validation checks.
        </p>
      </div>

      <div className="step-content">
        {followUpSteps.length === 0 ? (
          <div className="empty-state">
            <p>No follow-up steps configured. The workflow will output the final answer directly.</p>
            <button onClick={addFollowUpStep} className="btn-primary" type="button">
              + Add Follow-Up Step
            </button>
          </div>
        ) : (
          <>
            {followUpSteps.map((step, index) => (
              <div key={step.id} className="follow-up-step-card">
                <div className="step-card-header">
                  <h4>Follow-Up Step {index + 1}</h4>
                  <button onClick={() => removeFollowUpStep(index)} className="btn-remove" type="button">
                    Remove
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
                            updateFollowUpStep(index, { inputVariables: inputVars });
                          }}
                        />
                        <span>{variable.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Task Description */}
                <div className="form-group">
                  <label>What should this step do? *</label>
                  <textarea
                    value={step.taskDescription || ''}
                    onChange={(e) => updateFollowUpStep(index, { taskDescription: e.target.value })}
                    placeholder="e.g., 'Analyze risks mentioned in the final answer and rate them from 1-10' or 'Convert the answer into valid JSON format'"
                    rows={3}
                    required
                  />
                </div>

                {/* Simple Mode: Single Worker or Chairman Only */}
                <div className="form-group">
                  <label>How should this step execute?</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name={`mode_${index}`}
                        checked={step.mode === 'single_worker'}
                        onChange={() => updateFollowUpStep(index, { mode: 'single_worker' })}
                      />
                      <div className="radio-label">
                        <strong>Single AI Worker</strong>
                        <span className="radio-description">One model processes the input</span>
                      </div>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name={`mode_${index}`}
                        checked={step.mode === 'chairman_only'}
                        onChange={() => updateFollowUpStep(index, { mode: 'chairman_only' })}
                      />
                      <div className="radio-label">
                        <strong>Chairman Only</strong>
                        <span className="radio-description">Synthesis model, no workers</span>
                      </div>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name={`mode_${index}`}
                        checked={step.mode === 'multiple_workers'}
                        onChange={() => updateFollowUpStep(index, { mode: 'multiple_workers' })}
                      />
                      <div className="radio-label">
                        <strong>Multiple Workers</strong>
                        <span className="radio-description">Advanced - configure below</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Model Selection (simple modes) */}
                {(step.mode === 'single_worker' || step.mode === 'chairman_only') && (
                  <ModelSelect
                    value={step.workerModel || ''}
                    onChange={(modelRef) => updateFollowUpStep(index, { workerModel: modelRef })}
                    globalModels={state.globalModels}
                    label="Model"
                    required
                  />
                )}

                {/* Output Variable */}
                <div className="form-group">
                  <label>Save result to variable: *</label>
                  <input
                    type="text"
                    value={step.outputVar || ''}
                    onChange={(e) => updateFollowUpStep(index, { outputVar: e.target.value })}
                    placeholder={`step_${index + 1}_result`}
                    required
                  />
                  <span className="help-text">
                    This variable can be used by subsequent follow-up steps.
                  </span>
                </div>

                {/* Advanced Configuration Toggle */}
                <button
                  onClick={() => toggleAdvanced(index)}
                  className="btn-link"
                  type="button"
                >
                  {showAdvanced.includes(index) ? '− Hide Advanced Settings' : '+ Show Advanced Settings'}
                </button>

                {/* Advanced Settings (if shown and multiple_workers mode) */}
                {showAdvanced.includes(index) && step.mode === 'multiple_workers' && (
                  <div className="advanced-settings">
                    <p className="info-text">
                      Advanced multi-worker configuration coming soon.
                      For now, use single worker mode or switch to the Advanced Editor.
                    </p>
                  </div>
                )}
              </div>
            ))}

            <button onClick={addFollowUpStep} className="btn-secondary" type="button">
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
            <li><strong>Translation:</strong> Translate final answer to another language</li>
          </ul>
        </div>
      </div>

      <div className="step-actions">
        <button onClick={onBack} className="btn-secondary">
          ← Back
        </button>
        <button onClick={onNext} className="btn-primary">
          Next: Runtime & Safety →
        </button>
      </div>
    </div>
  );
}

export default Step4_5FollowUpSteps;

// Helper to get main workflow output variable
function getFinalOutputVar(state) {
  const { outputFormat } = state;
  const varNames = {
    text_summary: 'final_answer',
    json: 'final_output',
    ranked: 'ranked_options',
    custom: 'result'
  };
  return varNames[outputFormat] || 'final_answer';
}
