import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { validateWorkflowJSON } from '../utils/simulationEngine';

/**
 * JSONInput - JSON editor with validation for workflow input
 *
 * Allows pasting workflow JSON with validation feedback
 */
export function JSONInput({ initialJSON, onValidWorkflow, exampleWorkflows }) {
  const [jsonText, setJsonText] = useState(
    initialJSON ? JSON.stringify(initialJSON, null, 2) : ''
  );
  const [validationError, setValidationError] = useState(null);
  const [isValid, setIsValid] = useState(!!initialJSON);

  const handleJSONChange = (e) => {
    const newText = e.target.value;
    setJsonText(newText);

    if (!newText.trim()) {
      setValidationError(null);
      setIsValid(false);
      return;
    }

    const result = validateWorkflowJSON(newText);

    if (result.valid) {
      setValidationError(null);
      setIsValid(true);
      onValidWorkflow(result.workflow);
    } else {
      setValidationError(result.errors);
      setIsValid(false);
      onValidWorkflow(null);
    }
  };

  const handleLoadExample = (e) => {
    const exampleName = e.target.value;
    if (exampleName && exampleWorkflows[exampleName]) {
      const workflow = exampleWorkflows[exampleName];
      const formattedJSON = JSON.stringify(workflow, null, 2);
      setJsonText(formattedJSON);

      const result = validateWorkflowJSON(workflow);
      if (result.valid) {
        setValidationError(null);
        setIsValid(true);
        onValidWorkflow(result.workflow);
      }
    }
  };

  const handleClear = () => {
    setJsonText('');
    setValidationError(null);
    setIsValid(false);
    onValidWorkflow(null);
  };

  const getWorkflowSummary = () => {
    if (!isValid) return null;

    try {
      const workflow = JSON.parse(jsonText);
      const superstepCount = workflow.supersteps?.length || 0;
      const variableCount = workflow.variables?.length || 0;

      return `${superstepCount} superstep${superstepCount !== 1 ? 's' : ''}, ${variableCount} variable${variableCount !== 1 ? 's' : ''}`;
    } catch {
      return null;
    }
  };

  return (
    <div className="json-input">
      <div className="json-input__header">
        <label htmlFor="json-textarea" className="json-input__label">
          Paste Workflow JSON
        </label>

        <div className="json-input__actions">
          {exampleWorkflows && (
            <select
              className="json-input__example-select"
              onChange={handleLoadExample}
              defaultValue=""
              aria-label="Load example workflow"
            >
              <option value="" disabled>
                Load Example...
              </option>
              {Object.keys(exampleWorkflows).map((key) => (
                <option key={key} value={key}>
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </option>
              ))}
            </select>
          )}

          <button
            className="json-input__clear-button"
            onClick={handleClear}
            disabled={!jsonText}
            aria-label="Clear JSON"
          >
            Clear
          </button>
        </div>
      </div>

      <textarea
        id="json-textarea"
        className="json-input__textarea"
        value={jsonText}
        onChange={handleJSONChange}
        placeholder='Paste workflow JSON here...

Example:
{
  "flow_id": "my_workflow",
  "variables": [...],
  "supersteps": [...]
}'
        spellCheck="false"
        aria-describedby="json-validation-feedback"
      />

      <div id="json-validation-feedback" className="json-input__feedback">
        {isValid && (
          <div className="json-input__validation json-input__validation--success">
            <span className="json-input__validation-icon">✓</span>
            <span className="json-input__validation-text">
              Valid workflow ({getWorkflowSummary()})
            </span>
          </div>
        )}

        {validationError && (
          <div className="json-input__validation json-input__validation--error">
            <span className="json-input__validation-icon">✗</span>
            <div className="json-input__validation-text">
              <strong>Validation errors:</strong>
              <ul className="json-input__error-list">
                {validationError.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

JSONInput.propTypes = {
  initialJSON: PropTypes.object,
  onValidWorkflow: PropTypes.func.isRequired,
  exampleWorkflows: PropTypes.object
};

JSONInput.defaultProps = {
  initialJSON: null,
  exampleWorkflows: null
};
