import { useState } from 'react';
import { getDefaultModels } from '../utils/defaultModels.js';

const OUTPUT_FORMATS = [
  { value: 'text_summary', label: 'Text Summary', description: 'Clear written answer in paragraph form' },
  { value: 'json', label: 'Structured Data (JSON)', description: 'Machine-readable structured output' },
  { value: 'ranked', label: 'Ranked Options', description: 'Prioritized list with justifications' },
  { value: 'custom', label: 'Custom Format', description: 'Specify your own format requirements' }
];

const QUALITY_OPTIONS = [
  { value: 'accurate', label: 'Accurate', description: 'Factually correct and well-researched' },
  { value: 'balanced', label: 'Balanced', description: 'Considers multiple viewpoints fairly' },
  { value: 'risk_aware', label: 'Risk-Aware', description: 'Identifies and evaluates risks' },
  { value: 'concise', label: 'Concise', description: 'Brief and to-the-point' },
  { value: 'detailed', label: 'Detailed', description: 'Comprehensive and thorough' },
  { value: 'conservative', label: 'Conservative', description: 'Cautious and risk-averse' },
  { value: 'creative', label: 'Creative', description: 'Innovative and unconventional' },
  { value: 'practical', label: 'Practical', description: 'Focused on implementation feasibility' }
];

function Step2SuccessCriteria({ state, onChange, onNext, onBack }) {
  const [newConstraint, setNewConstraint] = useState('');
  const [showModelConfig, setShowModelConfig] = useState(false);
  const [newModelLabel, setNewModelLabel] = useState('');
  const [newModelRef, setNewModelRef] = useState('');

  const toggleQuality = (quality) => {
    const qualities = state.qualities || [];
    const newQualities = qualities.includes(quality)
      ? qualities.filter(q => q !== quality)
      : [...qualities, quality];
    onChange({ qualities: newQualities });
  };

  const addConstraint = () => {
    if (newConstraint.trim()) {
      const constraints = state.constraints || [];
      onChange({ constraints: [...constraints, newConstraint.trim()] });
      setNewConstraint('');
    }
  };

  const removeConstraint = (index) => {
    const constraints = state.constraints || [];
    onChange({ constraints: constraints.filter((_, i) => i !== index) });
  };

  const addCustomModel = () => {
    if (!newModelLabel.trim() || !newModelRef.trim()) {
      alert('Both display name and model ID are required');
      return;
    }

    const globalModels = state.globalModels || getDefaultModels();
    const newModel = {
      id: `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label: newModelLabel.trim(),
      modelRef: newModelRef.trim(),
      isDefault: false
    };

    onChange({ globalModels: [...globalModels, newModel] });
    setNewModelLabel('');
    setNewModelRef('');
  };

  const removeModel = (index) => {
    const globalModels = state.globalModels || [];
    onChange({ globalModels: globalModels.filter((_, i) => i !== index) });
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
        {/* Output Format */}
        <div className="form-group">
          <label>What should the final answer look like?</label>
          <span className="help-text">
            Format of the workflow's final output.
          </span>
          <div className="radio-group">
            {OUTPUT_FORMATS.map(format => (
              <label key={format.value} className="radio-option">
                <input
                  type="radio"
                  name="outputFormat"
                  value={format.value}
                  checked={state.outputFormat === format.value}
                  onChange={(e) => onChange({ outputFormat: e.target.value })}
                />
                <div className="radio-label">
                  <strong>{format.label}</strong>
                  <span className="radio-description">{format.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Custom Format Details */}
        {state.outputFormat === 'custom' && (
          <div className="form-group">
            <label htmlFor="customFormat">Describe your custom format:</label>
            <textarea
              id="customFormat"
              value={state.customFormat || ''}
              onChange={(e) => onChange({ customFormat: e.target.value })}
              placeholder="Example: Valid JSON with fields: title, pros (list), cons (list), and a final_recommendation string"
              rows={3}
            />
          </div>
        )}

        {/* Quality Criteria */}
        <div className="form-group">
          <label>Key qualities for the final answer (select all that apply):</label>
          <span className="help-text">
            Guides how perspectives reason and decide.
          </span>
          <div className="checkbox-grid">
            {QUALITY_OPTIONS.map(quality => (
              <label key={quality.value} className="checkbox-option">
                <input
                  type="checkbox"
                  checked={(state.qualities || []).includes(quality.value)}
                  onChange={() => toggleQuality(quality.value)}
                />
                <div className="checkbox-label">
                  <strong>{quality.label}</strong>
                  <span className="checkbox-description">{quality.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Hard Constraints */}
        <div className="form-group">
          <label>Hard rules the final answer must follow (optional):</label>
          <span className="help-text">
            Strict requirements the answer must satisfy.
          </span>

          <div className="constraint-input">
            <input
              type="text"
              value={newConstraint}
              onChange={(e) => setNewConstraint(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addConstraint()}
              placeholder="Enter a constraint..."
            />
            <button onClick={addConstraint} className="btn-secondary" type="button">
              Add
            </button>
          </div>

          {state.constraints && state.constraints.length > 0 && (
            <ul className="constraints-list">
              {state.constraints.map((constraint, index) => (
                <li key={index}>
                  {constraint}
                  <button
                    onClick={() => removeConstraint(index)}
                    className="btn-remove"
                    type="button"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Global Model Configuration */}
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

              {/* Model List */}
              <div className="models-list">
                {(state.globalModels || getDefaultModels()).map((model, index) => (
                  <div key={model.id} className="model-item">
                    <div className="model-info">
                      <strong>{model.label}</strong>
                      <code className="model-ref">{model.modelRef}</code>
                      {model.isDefault && <span className="badge-default">Default</span>}
                    </div>
                    <button
                      onClick={() => removeModel(index)}
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

              {/* Add Custom Model */}
              <div className="add-model-form">
                <h4>Add Custom Model</h4>
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="Display Name (e.g., 'Custom GPT-4')"
                    value={newModelLabel}
                    onChange={(e) => setNewModelLabel(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Model ID (e.g., 'openai/gpt-4')"
                    value={newModelRef}
                    onChange={(e) => setNewModelRef(e.target.value)}
                  />
                  <button onClick={addCustomModel} className="btn-secondary" type="button">
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
        <button onClick={onBack} className="btn-secondary">
          ← Back
        </button>
        <button onClick={onNext} className="btn-primary">
          Next: Delegates & Perspectives →
        </button>
      </div>
    </div>
  );
}

export default Step2SuccessCriteria;
