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
          Define the <strong>type of problem</strong> this workflow handles. Think of it as designing an intelligence architecture, not solving a specific task. Users will provide specific questions at runtime.
        </p>
      </div>

      <div className="step-content">
        <div className="form-group">
          <label htmlFor="problemStatement">
            What type of problem or decision pattern does this workflow address?
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
            This defines the workflow's <strong>purpose and pattern</strong>, not a specific question. Users provide specific queries when they execute the workflow. We'll also use this to auto-generate a workflow ID.
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="audience">
            What context or scope does this workflow operate in?
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
            Describe the typical context, audience level, or domain scope. This helps set the tone and depth for all executions of this workflow.
          </span>
        </div>

        <div className="info-box">
          <strong>💡 Design Reusable Patterns:</strong>
          <ul>
            <li><strong>✅ Good:</strong> "Technology Migration Decision Framework" → Users ask: "Should we migrate from PostgreSQL to MongoDB?"</li>
            <li><strong>❌ Bad:</strong> "Should we migrate from PostgreSQL to MongoDB?" (too specific, not reusable)</li>
            <li><strong>✅ Good:</strong> "Strategic Planning & Recommendations" → Users ask: "What should our Q4 marketing strategy be?"</li>
            <li><strong>❌ Bad:</strong> "Q4 Marketing Strategy" (one-off task, not a pattern)</li>
            <li><strong>✅ Good:</strong> "Research Synthesis & Analysis" → Users ask: "Summarize the key findings from this paper"</li>
          </ul>
          <div style={{ marginTop: '10px', fontStyle: 'italic' }}>
            Think: "What <strong>category of problems</strong> will this workflow solve repeatedly?" not "What specific question am I solving today?"
          </div>
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
