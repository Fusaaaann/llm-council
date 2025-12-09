import { useState } from 'react';

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

  return (
    <div className="wizard-step step-success-criteria">
      <div className="step-header">
        <h2>Step 2: Define the Final Answer & Rules</h2>
        <p className="step-description">
          Specify what the final answer should look like and what rules it must follow. This shapes the workflow's output variable and instructions.
        </p>
      </div>

      <div className="step-content">
        {/* Output Format */}
        <div className="form-group">
          <label>What should the final answer look like?</label>
          <span className="help-text">
            This defines the format of the workflow's final output (text, structured JSON, ranked list, etc.).
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
            These guide how delegates reason and how the final collector judges the best answer.
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
            These are strict requirements the answer MUST satisfy (e.g., "Must not violate GDPR", "Must be valid JSON", "Under 500 words").
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
