/**
 * Step5VariablesAndInterpolation - Variable management and interpolation
 * Advanced tier step for custom variables and ${variable} interpolation
 */

import { useState } from 'react';
import QuestionCard from '../components/QuestionCard.jsx';

const VARIABLE_TYPES = [
  { value: 'string', label: 'String', description: 'Text value' },
  { value: 'number', label: 'Number', description: 'Numeric value' },
  { value: 'boolean', label: 'Boolean', description: 'True/False' },
  { value: 'json', label: 'JSON', description: 'Structured data' },
  { value: 'array', label: 'Array', description: 'List of values' }
];

function Step5VariablesAndInterpolation({ state, onChange, onNext, onBack }) {
  const [errors, setErrors] = useState({});
  const [expandedVariable, setExpandedVariable] = useState(null);

  const variables = state.variables || [];
  const variableInterpolation = state.variableInterpolation || false;

  const handleAddVariable = () => {
    const newVariable = {
      id: `var_${Date.now()}`,
      name: '',
      type: 'string',
      default_value: '',
      description: '',
      required: false
    };
    onChange({ variables: [...variables, newVariable] });
    setExpandedVariable(variables.length);
  };

  const handleRemoveVariable = (index) => {
    onChange({ variables: variables.filter((_, i) => i !== index) });
    if (expandedVariable === index) {
      setExpandedVariable(null);
    }
  };

  const handleUpdateVariable = (index, field, value) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ variables: updated });
  };

  const handleToggleExpanded = (index) => {
    setExpandedVariable(expandedVariable === index ? null : index);
  };

  const handleToggleInterpolation = (enabled) => {
    onChange({ variableInterpolation: enabled });
  };

  const handleValidateAndNext = () => {
    const newErrors = {};

    // Validate variables
    variables.forEach((variable, index) => {
      if (!variable.name) {
        newErrors[`variable_${index}_name`] = 'Variable name is required';
      } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable.name)) {
        newErrors[`variable_${index}_name`] = 'Variable name must be valid (letters, numbers, underscores, no spaces)';
      }

      // Check for duplicate names
      const duplicates = variables.filter(v => v.name === variable.name);
      if (duplicates.length > 1) {
        newErrors[`variable_${index}_name`] = 'Variable name must be unique';
      }

      // Validate default value based on type
      if (variable.default_value) {
        if (variable.type === 'number' && isNaN(Number(variable.default_value))) {
          newErrors[`variable_${index}_value`] = 'Default value must be a number';
        }
        if (variable.type === 'boolean' && !['true', 'false', 'True', 'False'].includes(variable.default_value)) {
          newErrors[`variable_${index}_value`] = 'Default value must be true or false';
        }
        if (variable.type === 'json') {
          try {
            JSON.parse(variable.default_value);
          } catch (e) {
            newErrors[`variable_${index}_value`] = 'Default value must be valid JSON';
          }
        }
      }
    });

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onNext();
    }
  };

  // Get all variable names for interpolation reference
  const getVariableNames = () => {
    return variables.map(v => v.name).filter(Boolean);
  };

  return (
    <div className="wizard-step step-variables-interpolation">
      <div className="step-header">
        <h2>Step 5: Variables & Interpolation 📊</h2>
        <p className="step-description">
          Define custom variables and enable dynamic interpolation in worker instructions.
        </p>
      </div>

      <div className="step-content">
        {/* Q12.1: Variable Interpolation Toggle */}
        <QuestionCard
          question="Q12.1: Enable variable interpolation?"
          description="Allow ${variable_name} syntax in worker instructions to dynamically inject values."
        >
          <div className="radio-group">
            <label className="radio-option">
              <input
                type="radio"
                checked={!variableInterpolation}
                onChange={() => handleToggleInterpolation(false)}
              />
              <div className="radio-label">
                <strong>No (Default)</strong>
                <span className="radio-description">
                  Worker instructions are static (no variable replacement)
                </span>
              </div>
            </label>

            <label className="radio-option">
              <input
                type="radio"
                checked={variableInterpolation}
                onChange={() => handleToggleInterpolation(true)}
              />
              <div className="radio-label">
                <strong>Yes, Enable Interpolation</strong>
                <span className="radio-description">
                  Use ${'{'}variable_name{'}'} syntax to inject variable values at runtime
                </span>
              </div>
            </label>
          </div>

          {variableInterpolation && (
            <div className="info-box">
              <strong>💡 Variable Interpolation:</strong>
              <p>
                Use ${'{'}variable_name{'}'} in worker instructions to dynamically inject values.
              </p>
              <p>
                <strong>Example:</strong> If you define a variable <code>max_budget</code>, you can write:
                <br />
                <em>"Analyze the proposal and ensure it stays under ${'{'}max_budget{'}'}"</em>
              </p>
            </div>
          )}
        </QuestionCard>

        {/* Variable Editor */}
        <QuestionCard
          question="Q12.2: Define custom variables"
          description="Create variables that can be used in worker instructions, middleware configs, or follow-up steps."
        >
          <div className="variables-section">
            {variables.length === 0 ? (
              <div className="empty-state">
                <p>No variables defined. Variables allow you to parameterize your workflow.</p>
                <button onClick={handleAddVariable} className="btn-primary" type="button">
                  + Add Variable
                </button>
              </div>
            ) : (
              <>
                <div className="variables-list">
                  {variables.map((variable, index) => {
                    const isExpanded = expandedVariable === index;
                    return (
                      <div key={variable.id} className={`variable-card ${isExpanded ? 'expanded' : ''}`}>
                        <div className="variable-card-header" onClick={() => handleToggleExpanded(index)}>
                          <div className="variable-info">
                            <span className="variable-name">
                              {variable.name || '<unnamed>'}
                            </span>
                            <span className="variable-type-badge">
                              {VARIABLE_TYPES.find(t => t.value === variable.type)?.label || variable.type}
                            </span>
                            {variable.required && (
                              <span className="variable-required-badge">Required</span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveVariable(index);
                            }}
                            className="btn-remove-small"
                            type="button"
                          >
                            ×
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="variable-card-config">
                            {/* Variable Name */}
                            <div className="form-group">
                              <label>
                                Variable Name
                                <span className="required">*</span>
                              </label>
                              <input
                                type="text"
                                value={variable.name}
                                onChange={(e) => handleUpdateVariable(index, 'name', e.target.value)}
                                placeholder="e.g., max_budget, user_role, deadline"
                              />
                              {errors[`variable_${index}_name`] && (
                                <span className="error-text">{errors[`variable_${index}_name`]}</span>
                              )}
                              <span className="help-text">
                                Use letters, numbers, and underscores only. No spaces.
                              </span>
                            </div>

                            {/* Variable Type */}
                            <div className="form-group">
                              <label>Type</label>
                              <select
                                value={variable.type}
                                onChange={(e) => handleUpdateVariable(index, 'type', e.target.value)}
                              >
                                {VARIABLE_TYPES.map(type => (
                                  <option key={type.value} value={type.value}>
                                    {type.label} - {type.description}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Default Value */}
                            <div className="form-group">
                              <label>Default Value</label>
                              {variable.type === 'json' || variable.type === 'array' ? (
                                <textarea
                                  value={variable.default_value}
                                  onChange={(e) => handleUpdateVariable(index, 'default_value', e.target.value)}
                                  placeholder={variable.type === 'json' ? '{"key": "value"}' : '["item1", "item2"]'}
                                  rows={3}
                                />
                              ) : (
                                <input
                                  type={variable.type === 'number' ? 'number' : 'text'}
                                  value={variable.default_value}
                                  onChange={(e) => handleUpdateVariable(index, 'default_value', e.target.value)}
                                  placeholder={
                                    variable.type === 'boolean' ? 'true or false' :
                                    variable.type === 'number' ? '42' :
                                    'Default value...'
                                  }
                                />
                              )}
                              {errors[`variable_${index}_value`] && (
                                <span className="error-text">{errors[`variable_${index}_value`]}</span>
                              )}
                            </div>

                            {/* Description */}
                            <div className="form-group">
                              <label>Description</label>
                              <textarea
                                value={variable.description}
                                onChange={(e) => handleUpdateVariable(index, 'description', e.target.value)}
                                placeholder="What does this variable control?"
                                rows={2}
                              />
                            </div>

                            {/* Required Toggle */}
                            <div className="form-group">
                              <label className="checkbox-option">
                                <input
                                  type="checkbox"
                                  checked={variable.required}
                                  onChange={(e) => handleUpdateVariable(index, 'required', e.target.checked)}
                                />
                                <span>Required (must be provided at runtime)</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button onClick={handleAddVariable} className="btn-secondary" type="button">
                  + Add Another Variable
                </button>
              </>
            )}

            {/* Variable Reference Helper */}
            {variableInterpolation && variables.length > 0 && (
              <div className="variable-reference-box">
                <h4>📋 Available Variables for Interpolation:</h4>
                <div className="variable-chips">
                  {getVariableNames().map(name => (
                    <code key={name} className="variable-chip">
                      ${'{'}
                      {name}
                      {'}'}
                    </code>
                  ))}
                </div>
                <p className="help-text">
                  Copy these variable references and use them in worker instructions, middleware configs, or follow-up step descriptions.
                </p>
              </div>
            )}

            {/* Example Usage */}
            {variableInterpolation && (
              <div className="info-box">
                <strong>💡 Example Usage:</strong>
                <div className="example-code">
                  <p><strong>Scenario:</strong> Budget Analysis Workflow</p>
                  <p><strong>Variables Defined:</strong></p>
                  <ul>
                    <li><code>max_budget</code> (number): 50000</li>
                    <li><code>currency</code> (string): "USD"</li>
                    <li><code>strict_mode</code> (boolean): true</li>
                  </ul>
                  <p><strong>Worker Instruction (with interpolation):</strong></p>
                  <pre>
Analyze the proposal and ensure all costs stay under ${'{'}max_budget{'}'} ${'{'}currency{'}'}.
{'{'}{'#'}if strict_mode{'}'}Flag any items within 10% of the limit.{'{'}{'\/'}if{'}'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </QuestionCard>

        {/* Variable Flow Diagram */}
        {variables.length > 0 && (
          <div className="variable-flow-diagram">
            <h4>Variable Flow:</h4>
            <div className="flow-visualization">
              <div className="flow-node">Variables Defined</div>
              <div className="flow-arrow">↓</div>
              <div className="flow-node">Runtime Values Provided</div>
              <div className="flow-arrow">↓</div>
              <div className="flow-node">Interpolated into Instructions</div>
              <div className="flow-arrow">↓</div>
              <div className="flow-node">Workers Execute with Dynamic Context</div>
            </div>
          </div>
        )}
      </div>

      <div className="step-actions">
        <button onClick={onBack} className="btn-secondary">
          ← Back
        </button>
        <button onClick={handleValidateAndNext} className="btn-primary">
          Next: Optimization →
        </button>
      </div>
    </div>
  );
}

export default Step5VariablesAndInterpolation;
