import { useState } from 'react';

function Step1ProblemDefinition({ state, onChange, onNext }) {
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!state.problemStatement || state.problemStatement.trim() === '') {
      newErrors.problemStatement = 'Problem statement is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  return (
    <div className="wizard-step step-problem-definition">
      <div className="step-header">
        <h2>Step 1: Define Your Workflow Pattern</h2>
        <p className="step-description">
          Define what <strong>type of problem</strong> this workflow solves.
        </p>
      </div>

      <div className="step-content">
        <div className="form-group">
          <label htmlFor="problemStatement">
            What problem does this workflow solve?
            <span className="required">*</span>
          </label>
          <textarea
            id="problemStatement"
            value={state.problemStatement || ''}
            onChange={(e) => onChange({ problemStatement: e.target.value })}
            placeholder="Example: Technology Migration Decision Framework, Strategic Planning & Recommendations, Technical Architecture Review"
            rows={4}
            className={errors.problemStatement ? 'error' : ''}
          />
          {errors.problemStatement && (
            <span className="error-message">{errors.problemStatement}</span>
          )}
          <span className="help-text">
            Describes the workflow's purpose. Specific questions come at runtime.
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="audience">
            Context or scope?
            <span className="optional">(optional)</span>
          </label>
          <input
            type="text"
            id="audience"
            value={state.audience || ''}
            onChange={(e) => onChange({ audience: e.target.value })}
            placeholder="Example: Technical stakeholders requiring deep analysis, Executive decision-makers needing concise summaries"
          />
          <span className="help-text">
            Sets the tone and depth for workflow execution.
          </span>
        </div>

        <div className="info-box">
          <strong>💡 Examples:</strong>
          <ul>
            <li><strong>✅ Good:</strong> "Technology Migration Framework"</li>
            <li><strong>❌ Bad:</strong> "Should we migrate to MongoDB?" (too specific)</li>
          </ul>
        </div>
      </div>

      <div className="step-actions">
        <button onClick={handleNext} className="btn-primary">
          Next: Answer Format & Rules →
        </button>
      </div>
    </div>
  );
}

export default Step1ProblemDefinition;
