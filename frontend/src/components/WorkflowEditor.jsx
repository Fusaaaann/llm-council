import { useState, useEffect } from 'react';
import './WorkflowEditor.css';

const MODEL_FORMAT_REGEX = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/;

export default function WorkflowEditor({ workflowJson, isReadOnly, onSave, onClose }) {
  const [workflowData, setWorkflowData] = useState(null);
  const [newModel, setNewModel] = useState('');
  const [validationMessages, setValidationMessages] = useState([]);
  const [collapsedSteps, setCollapsedSteps] = useState(new Set());
  const [parseError, setParseError] = useState(null);

  // Parse JSON on mount and when workflowJson changes
  useEffect(() => {
    if (!workflowJson) return;

    try {
      const parsed = JSON.parse(workflowJson);
      // Initialize models array if it doesn't exist
      if (!parsed.models) {
        parsed.models = [];
      }
      setWorkflowData(parsed);
      setParseError(null);
      validate(parsed);
    } catch (error) {
      setParseError(`Failed to parse JSON: ${error.message}`);
      setWorkflowData(null);
    }
  }, [workflowJson]);

  // Count how many times each model is referenced in the workflow
  const countModelUsage = (data = workflowData) => {
    const usage = {};
    if (!data) return usage;

    // Check scope alignment
    if (data.scope_alignment?.coordinator_model) {
      const model = data.scope_alignment.coordinator_model;
      usage[model] = (usage[model] || 0) + 1;
    }

    // Check supersteps
    (data.supersteps || []).forEach(step => {
      // Check perspectives
      if (step.map_phase?.perspectives) {
        step.map_phase.perspectives.forEach(p => {
          if (p.model_ref) {
            usage[p.model_ref] = (usage[p.model_ref] || 0) + 1;
          }
        });
      }

      // Check reduce phase
      if (step.reduce_phase?.model_ref) {
        const model = step.reduce_phase.model_ref;
        usage[model] = (usage[model] || 0) + 1;
      }

      // Check middleware
      if (step.middleware_phase) {
        step.middleware_phase.forEach(m => {
          if (m.op === 'llm_refine' && m.config?.model_ref) {
            const model = m.config.model_ref;
            usage[model] = (usage[model] || 0) + 1;
          }
        });
      }
    });

    return usage;
  };

  // Validate the workflow
  const validate = (data = workflowData) => {
    const messages = [];

    if (!data) return;

    const models = data.models || [];

    // Check root models format
    models.forEach((model, index) => {
      if (!MODEL_FORMAT_REGEX.test(model)) {
        messages.push({ type: 'error', text: `Invalid model format at index ${index}: "${model}"` });
      }
    });

    // Check for unused models
    const usage = countModelUsage(data);
    models.forEach(model => {
      if (!usage[model]) {
        messages.push({ type: 'warning', text: `Model "${model}" is defined but never used` });
      }
    });

    // Check scope alignment
    if (data.scope_alignment?.coordinator_model) {
      const model = data.scope_alignment.coordinator_model;
      if (!models.includes(model)) {
        messages.push({ type: 'error', text: `Scope alignment coordinator model "${model}" not in root models array` });
      }
    }

    // Check supersteps
    (data.supersteps || []).forEach((step, stepIndex) => {
      const stepId = step.step_id || `Step ${stepIndex + 1}`;

      // Check perspectives
      if (step.map_phase?.perspectives) {
        step.map_phase.perspectives.forEach((p, pIndex) => {
          if (p.model_ref) {
            if (!models.includes(p.model_ref)) {
              messages.push({ type: 'error', text: `${stepId}: Perspective "${p.perspective_id}" references model "${p.model_ref}" not in root array` });
            }
          } else {
            // Model-neutral perspective requires root models
            if (models.length === 0) {
              messages.push({ type: 'warning', text: `${stepId}: Perspective "${p.perspective_id}" has no model_ref but root models array is empty` });
            }
          }
        });
      }

      // Check reduce phase
      if (step.reduce_phase) {
        if (!step.reduce_phase.model_ref) {
          messages.push({ type: 'error', text: `${stepId}: Reduce phase missing required model_ref` });
        } else if (!models.includes(step.reduce_phase.model_ref)) {
          messages.push({ type: 'error', text: `${stepId}: Reduce phase references model "${step.reduce_phase.model_ref}" not in root array` });
        }
      }

      // Check middleware
      if (step.middleware_phase) {
        step.middleware_phase.forEach((m, mIndex) => {
          if (m.op === 'llm_refine' && m.config?.model_ref) {
            if (!models.includes(m.config.model_ref)) {
              messages.push({ type: 'error', text: `${stepId}: Middleware ${mIndex} references model "${m.config.model_ref}" not in root array` });
            }
          }
        });
      }
    });

    // Add summary
    const totalRefs = Object.values(usage).reduce((sum, count) => sum + count, 0);
    messages.push({ type: 'info', text: `${models.length} models defined, ${totalRefs} total references` });

    if (messages.filter(m => m.type === 'error').length === 0 && messages.filter(m => m.type === 'warning').length === 0) {
      messages.push({ type: 'info', text: '✓ Validation passed' });
    }

    setValidationMessages(messages);
  };

  // Add a model to the root array
  const handleAddModel = () => {
    if (!newModel.trim()) {
      return;
    }

    if (!MODEL_FORMAT_REGEX.test(newModel.trim())) {
      setValidationMessages([...validationMessages, { type: 'error', text: 'Invalid model format. Use: provider/model-name' }]);
      return;
    }

    if (workflowData.models?.includes(newModel.trim())) {
      setValidationMessages([...validationMessages, { type: 'warning', text: 'Model already exists in the list' }]);
      return;
    }

    const updated = {
      ...workflowData,
      models: [...(workflowData.models || []), newModel.trim()]
    };

    setWorkflowData(updated);
    setNewModel('');
    validate(updated);
  };

  // Remove a model from the root array
  const handleRemoveModel = (index) => {
    const model = workflowData.models[index];
    const usage = countModelUsage()[model] || 0;

    if (usage > 0) {
      if (!window.confirm(`This model is used in ${usage} place(s). Remove anyway?`)) {
        return;
      }
    }

    const updated = {
      ...workflowData,
      models: workflowData.models.filter((_, i) => i !== index)
    };

    setWorkflowData(updated);
    validate(updated);
  };

  // Update perspective model_ref
  const updatePerspectiveModel = (stepIndex, perspectiveIndex, value) => {
    const updated = { ...workflowData };
    const perspective = updated.supersteps[stepIndex].map_phase.perspectives[perspectiveIndex];

    if (value) {
      perspective.model_ref = value;
    } else {
      delete perspective.model_ref;
    }

    setWorkflowData(updated);
    validate(updated);
  };

  // Update reduce phase model_ref
  const updateReduceModel = (stepIndex, value) => {
    const updated = { ...workflowData };
    updated.supersteps[stepIndex].reduce_phase.model_ref = value;
    setWorkflowData(updated);
    validate(updated);
  };

  // Update middleware model_ref
  const updateMiddlewareModel = (stepIndex, middlewareIndex, value) => {
    const updated = { ...workflowData };
    const middleware = updated.supersteps[stepIndex].middleware_phase[middlewareIndex];

    if (!middleware.config) {
      middleware.config = {};
    }

    if (value) {
      middleware.config.model_ref = value;
    } else {
      delete middleware.config.model_ref;
    }

    setWorkflowData(updated);
    validate(updated);
  };

  // Update scope alignment coordinator model
  const updateScopeAlignmentModel = (value) => {
    const updated = { ...workflowData };
    if (!updated.scope_alignment) {
      updated.scope_alignment = {};
    }
    updated.scope_alignment.coordinator_model = value;
    setWorkflowData(updated);
    validate(updated);
  };

  // Toggle superstep collapse
  const toggleSuperstep = (index) => {
    const newCollapsed = new Set(collapsedSteps);
    if (newCollapsed.has(index)) {
      newCollapsed.delete(index);
    } else {
      newCollapsed.add(index);
    }
    setCollapsedSteps(newCollapsed);
  };

  // Handle save
  const handleSave = () => {
    if (!workflowData) return;

    // Check for validation errors
    const hasErrors = validationMessages.some(m => m.type === 'error');
    if (hasErrors) {
      alert('Please fix validation errors before saving');
      return;
    }

    const json = JSON.stringify(workflowData, null, 2);
    onSave(json);
  };

  // Render model dropdown options
  const renderModelOptions = (currentValue, allowEmpty = false) => {
    const models = workflowData?.models || [];

    return (
      <>
        {allowEmpty && (
          <option value="">{!currentValue ? '(none - use all models)' : '(none - use all models)'}</option>
        )}
        {models.length === 0 && !allowEmpty && (
          <option value="">⚠️ No models in root array</option>
        )}
        {models.map(model => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
        {currentValue && !models.includes(currentValue) && currentValue !== '' && (
          <option value={currentValue}>⚠️ {currentValue} (not in root)</option>
        )}
      </>
    );
  };

  if (parseError) {
    return (
      <div className="workflow-editor-overlay" onClick={onClose}>
        <div className="workflow-editor-modal" onClick={(e) => e.stopPropagation()}>
          <div className="workflow-editor-header">
            <h2>Workflow Editor</h2>
            <button className="workflow-editor-close" onClick={onClose}>✕</button>
          </div>
          <div className="workflow-editor-body">
            <div className="workflow-editor-error">
              {parseError}
            </div>
          </div>
          <div className="workflow-editor-footer">
            <button onClick={onClose} className="workflow-editor-btn">Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (!workflowData) {
    return null;
  }

  const usage = countModelUsage();
  const models = workflowData.models || [];

  return (
    <div className="workflow-editor-overlay" onClick={onClose}>
      <div className="workflow-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="workflow-editor-header">
          <h2>Workflow Model Editor</h2>
          <button className="workflow-editor-close" onClick={onClose}>✕</button>
        </div>

        <div className="workflow-editor-body">
          {/* Root Models Section */}
          <div className="workflow-editor-section">
            <h3 className="workflow-editor-section-title">Root Models</h3>
            <div className="workflow-editor-model-list">
              {models.length === 0 ? (
                <div className="workflow-editor-empty">No models defined</div>
              ) : (
                models.map((model, index) => (
                  <div key={index} className="workflow-editor-model-item">
                    <span className="workflow-editor-model-name">{model}</span>
                    <span className="workflow-editor-model-count">
                      (used in {usage[model] || 0} place{(usage[model] || 0) !== 1 ? 's' : ''})
                    </span>
                    {!isReadOnly && (
                      <button
                        onClick={() => handleRemoveModel(index)}
                        className="workflow-editor-btn-delete"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            {!isReadOnly && (
              <div className="workflow-editor-add-model">
                <input
                  type="text"
                  placeholder="provider/model-name"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddModel();
                  }}
                  className="workflow-editor-input"
                />
                <button onClick={handleAddModel} className="workflow-editor-btn">
                  Add Model
                </button>
              </div>
            )}
          </div>

          {/* Model References Section */}
          <div className="workflow-editor-section">
            <h3 className="workflow-editor-section-title">Model References</h3>

            {/* Scope Alignment */}
            {workflowData.scope_alignment && (
              <div className="workflow-editor-superstep">
                <div className="workflow-editor-superstep-header">
                  <span className="workflow-editor-superstep-title">Scope Alignment</span>
                </div>
                <div className="workflow-editor-superstep-content">
                  <div className="workflow-editor-ref-item">
                    <div className="workflow-editor-ref-label">Coordinator Model</div>
                    <select
                      className="workflow-editor-select"
                      value={workflowData.scope_alignment.coordinator_model || ''}
                      onChange={(e) => updateScopeAlignmentModel(e.target.value)}
                      disabled={isReadOnly}
                    >
                      {renderModelOptions(workflowData.scope_alignment.coordinator_model, false)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Supersteps */}
            {(workflowData.supersteps || []).map((step, stepIndex) => {
              const isCollapsed = collapsedSteps.has(stepIndex);
              return (
                <div key={stepIndex} className="workflow-editor-superstep">
                  <div
                    className="workflow-editor-superstep-header"
                    onClick={() => toggleSuperstep(stepIndex)}
                  >
                    <span className="workflow-editor-superstep-title">
                      Superstep: {step.step_id || `Step ${stepIndex + 1}`}
                    </span>
                    <span className="workflow-editor-collapse-toggle">
                      {isCollapsed ? '▼' : '▲'}
                    </span>
                  </div>
                  {!isCollapsed && (
                    <div className="workflow-editor-superstep-content">
                      {step.description && (
                        <div className="workflow-editor-ref-detail">{step.description}</div>
                      )}

                      {/* Map Phase - Perspectives */}
                      {step.map_phase?.perspectives && (
                        <div className="workflow-editor-phase-section">
                          <div className="workflow-editor-phase-title">Map Phase - Perspectives</div>
                          {step.map_phase.perspectives.map((perspective, perspectiveIndex) => (
                            <div key={perspectiveIndex} className="workflow-editor-ref-item">
                              <div className="workflow-editor-ref-label">
                                Perspective: {perspective.perspective_id}
                              </div>
                              {perspective.instruction && (
                                <div className="workflow-editor-ref-detail">
                                  {perspective.instruction.length > 100
                                    ? perspective.instruction.substring(0, 100) + '...'
                                    : perspective.instruction}
                                </div>
                              )}
                              <select
                                className="workflow-editor-select"
                                value={perspective.model_ref || ''}
                                onChange={(e) => updatePerspectiveModel(stepIndex, perspectiveIndex, e.target.value)}
                                disabled={isReadOnly}
                              >
                                {renderModelOptions(perspective.model_ref, true)}
                              </select>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reduce Phase */}
                      {step.reduce_phase && (
                        <div className="workflow-editor-phase-section">
                          <div className="workflow-editor-phase-title">Reduce Phase</div>
                          <div className="workflow-editor-ref-item">
                            <div className="workflow-editor-ref-label">
                              Synthesis Model
                              <span className="workflow-editor-required-badge">REQUIRED</span>
                            </div>
                            <div className="workflow-editor-ref-detail">
                              Strategy: {step.reduce_phase.strategy}
                            </div>
                            <select
                              className="workflow-editor-select"
                              value={step.reduce_phase.model_ref || ''}
                              onChange={(e) => updateReduceModel(stepIndex, e.target.value)}
                              disabled={isReadOnly}
                            >
                              {renderModelOptions(step.reduce_phase.model_ref, false)}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Middleware Phase */}
                      {step.middleware_phase && step.middleware_phase.some(m => m.op === 'llm_refine') && (
                        <div className="workflow-editor-phase-section">
                          <div className="workflow-editor-phase-title">Middleware Phase</div>
                          {step.middleware_phase.map((middleware, middlewareIndex) => {
                            if (middleware.op !== 'llm_refine') return null;
                            return (
                              <div key={middlewareIndex} className="workflow-editor-ref-item">
                                <div className="workflow-editor-ref-label">LLM Refine Operation</div>
                                <div className="workflow-editor-ref-detail">
                                  Apply to: {middleware.apply_to?.join(', ') || 'N/A'}
                                </div>
                                <select
                                  className="workflow-editor-select"
                                  value={middleware.config?.model_ref || ''}
                                  onChange={(e) => updateMiddlewareModel(stepIndex, middlewareIndex, e.target.value)}
                                  disabled={isReadOnly}
                                >
                                  {renderModelOptions(middleware.config?.model_ref, true)}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {(!workflowData.supersteps || workflowData.supersteps.length === 0) && (
              <div className="workflow-editor-empty">No supersteps defined</div>
            )}
          </div>

          {/* Validation Panel */}
          <div className="workflow-editor-section">
            <h3 className="workflow-editor-section-title">Validation</h3>
            <div className="workflow-editor-validation">
              {validationMessages.length === 0 ? (
                <div className="workflow-editor-validation-item workflow-editor-validation-info">
                  Ready
                </div>
              ) : (
                validationMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`workflow-editor-validation-item workflow-editor-validation-${msg.type}`}
                  >
                    {msg.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="workflow-editor-footer">
          <button onClick={onClose} className="workflow-editor-btn-cancel">
            {isReadOnly ? 'Close' : 'Cancel'}
          </button>
          {!isReadOnly && (
            <button
              onClick={handleSave}
              className="workflow-editor-btn-save"
              disabled={validationMessages.some(m => m.type === 'error')}
            >
              Save Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
