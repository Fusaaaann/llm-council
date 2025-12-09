import { useState } from 'react';
import {
  createWorkflow,
  createSuperstep,
  visibility,
  middleware,
  strategies,
  models
} from '../../workflowGenerator.js';
import { api } from '../../api';
import './WorkflowAdvancedEditor.css';

function WorkflowAdvancedEditor() {
  const [flowId, setFlowId] = useState('my_workflow');
  const [globalTimeout, setGlobalTimeout] = useState(120000);
  const [variables, setVariables] = useState([]);
  const [supersteps, setSupersteps] = useState([]);
  const [generatedWorkflow, setGeneratedWorkflow] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  // Add variable
  const addVariable = () => {
    setVariables([...variables, { name: '', type: 'string', defaultValue: '' }]);
  };

  // Remove variable
  const removeVariable = (index) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  // Update variable
  const updateVariable = (index, field, value) => {
    const updated = [...variables];
    updated[index][field] = value;
    setVariables(updated);
  };

  // Add superstep
  const addSuperstep = () => {
    setSupersteps([
      ...supersteps,
      {
        stepId: `step${supersteps.length + 1}`,
        description: '',
        concurrency: null,
        globalInstruction: '',
        defaultRole: '',
        workers: [],
        middleware: [],
        reduce: {
          strategy: strategies.COUNCIL_CHAIRMAN,
          modelRef: models.GPT4,
          outputWriteTo: '',
          visibilityPreset: 'full',
          chairmanInstructions: '',
          timeout: null,
          variableInterpolation: false
        }
      }
    ]);
  };

  // Remove superstep
  const removeSuperstep = (index) => {
    setSupersteps(supersteps.filter((_, i) => i !== index));
  };

  // Update superstep
  const updateSuperstep = (index, field, value) => {
    const updated = [...supersteps];
    updated[index][field] = value;
    setSupersteps(updated);
  };

  // Add worker to superstep
  const addWorker = (stepIndex) => {
    const updated = [...supersteps];
    updated[stepIndex].workers.push({
      workerId: `worker${updated[stepIndex].workers.length + 1}`,
      modelRef: models.GPT4,
      roleDefinition: ''
    });
    setSupersteps(updated);
  };

  // Remove worker from superstep
  const removeWorker = (stepIndex, workerIndex) => {
    const updated = [...supersteps];
    updated[stepIndex].workers = updated[stepIndex].workers.filter((_, i) => i !== workerIndex);
    setSupersteps(updated);
  };

  // Update worker
  const updateWorker = (stepIndex, workerIndex, field, value) => {
    const updated = [...supersteps];
    updated[stepIndex].workers[workerIndex][field] = value;
    setSupersteps(updated);
  };

  // Generate workflow
  const generateWorkflow = () => {
    try {
      let workflow = createWorkflow(flowId, globalTimeout);

      // Add variables
      variables.forEach(v => {
        if (v.name) {
          const defaultValue = v.defaultValue ? v.defaultValue : undefined;
          workflow = workflow.withVariable(v.name, v.type, defaultValue);
        }
      });

      // Add supersteps
      supersteps.forEach(step => {
        let superstep = createSuperstep(step.stepId, step.description);

        if (step.concurrency) {
          superstep = superstep.withConcurrency(parseInt(step.concurrency));
        }

        if (step.globalInstruction) {
          superstep = superstep.withGlobalInstruction(step.globalInstruction);
        }

        if (step.defaultRole) {
          superstep = superstep.withDefaultRole(step.defaultRole);
        }

        // Add workers
        if (step.workers.length > 0) {
          const workers = step.workers.map(w => ({
            worker_id: w.workerId,
            model_ref: w.modelRef,
            role_definition: w.roleDefinition || undefined
          }));
          superstep = superstep.withWorkers(workers);
        }

        // Add middleware (if any)
        if (step.middleware && step.middleware.length > 0) {
          superstep = superstep.withMiddleware(step.middleware);
        }

        // Configure reduce phase
        const visibilityConfig = {
          full: visibility.full(),
          blindReview: visibility.blindReview(),
          cleanSubquery: visibility.cleanSubquery()
        }[step.reduce.visibilityPreset] || visibility.full();

        const reduceConfig = {
          strategy: step.reduce.strategy,
          modelRef: step.reduce.modelRef,
          outputWriteTo: step.reduce.outputWriteTo,
          visibility: visibilityConfig
        };

        if (step.reduce.chairmanInstructions) {
          reduceConfig.chairmanInstructions = step.reduce.chairmanInstructions;
        }

        if (step.reduce.timeout) {
          reduceConfig.timeout = parseInt(step.reduce.timeout);
        }

        if (step.reduce.variableInterpolation) {
          reduceConfig.variableInterpolation = true;
        }

        superstep = superstep.withReduce(reduceConfig);

        workflow = workflow.withSuperstep(superstep);
      });

      const generated = workflow.build();
      setGeneratedWorkflow(generated);
      setValidationResult(null);
      return generated;
    } catch (error) {
      alert(`Error generating workflow: ${error.message}`);
      return null;
    }
  };

  // Validate workflow
  const validateWorkflow = async () => {
    const workflow = generateWorkflow();
    if (!workflow) return;

    setIsValidating(true);
    setValidationResult(null);

    try {
      const result = await api.validateWorkflow({
        name: flowId,
        workflow: workflow
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

  // Download workflow
  const downloadWorkflow = () => {
    const workflow = generateWorkflow();
    if (!workflow) return;

    const dataStr = JSON.stringify(workflow, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${flowId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Copy to clipboard
  const copyToClipboard = () => {
    const workflow = generateWorkflow();
    if (!workflow) return;

    navigator.clipboard.writeText(JSON.stringify(workflow, null, 2));
    alert('Workflow copied to clipboard!');
  };

  // Load preset
  const loadPreset = (presetName) => {
    switch (presetName) {
      case 'simple_debate':
        setFlowId('simple_debate');
        setGlobalTimeout(120000);
        setVariables([{ name: 'final_answer', type: 'string', defaultValue: '' }]);
        setSupersteps([
          {
            stepId: 'debate',
            description: 'Two perspectives, one synthesis',
            concurrency: null,
            globalInstruction: '',
            defaultRole: '',
            workers: [
              {
                workerId: 'optimist',
                modelRef: models.GPT4,
                roleDefinition: 'You are optimistic and focus on benefits.'
              },
              {
                workerId: 'skeptic',
                modelRef: models.CLAUDE_SONNET,
                roleDefinition: 'You are skeptical and focus on risks.'
              }
            ],
            middleware: [],
            reduce: {
              strategy: strategies.COUNCIL_CHAIRMAN,
              modelRef: models.GEMINI_FLASH,
              outputWriteTo: 'final_answer',
              visibilityPreset: 'full',
              chairmanInstructions: 'Balance both perspectives into a nuanced answer.',
              timeout: null,
              variableInterpolation: false
            }
          }
        ]);
        break;

      case 'blind_review':
        setFlowId('blind_review');
        setGlobalTimeout(180000);
        setVariables([{ name: 'final_answer', type: 'string', defaultValue: '' }]);
        setSupersteps([
          {
            stepId: 'gather_responses',
            description: 'Collect responses from multiple models',
            concurrency: null,
            globalInstruction: '',
            defaultRole: 'You are a helpful AI assistant.',
            workers: [
              { workerId: 'model_a', modelRef: models.GPT4, roleDefinition: '' },
              { workerId: 'model_b', modelRef: models.CLAUDE_SONNET, roleDefinition: '' },
              { workerId: 'model_c', modelRef: models.GEMINI_FLASH, roleDefinition: '' }
            ],
            middleware: [],
            reduce: {
              strategy: strategies.COUNCIL_CHAIRMAN,
              modelRef: models.GPT4_TURBO,
              outputWriteTo: 'final_answer',
              visibilityPreset: 'blindReview',
              chairmanInstructions: 'Evaluate responses without knowing which model produced them.',
              timeout: null,
              variableInterpolation: false
            }
          }
        ]);
        break;

      default:
        break;
    }
  };

  // Reset form
  const resetForm = () => {
    setFlowId('my_workflow');
    setGlobalTimeout(120000);
    setVariables([]);
    setSupersteps([]);
    setGeneratedWorkflow(null);
    setValidationResult(null);
  };

  return (
    <div className="workflow-generator">
      <div className="generator-header">
        <h1>🔧 Workflow Generator</h1>
        <p>Build custom DSL workflows with a visual interface</p>
      </div>

      <div className="generator-content">
        {/* Left Panel - Form */}
        <div className="generator-form">
          {/* Workflow Settings */}
          <section className="form-section">
            <h2>Workflow Settings</h2>
            <div className="form-group">
              <label>Flow ID</label>
              <input
                type="text"
                value={flowId}
                onChange={(e) => setFlowId(e.target.value)}
                placeholder="my_workflow"
              />
            </div>
            <div className="form-group">
              <label>Global Timeout (ms)</label>
              <input
                type="number"
                value={globalTimeout}
                onChange={(e) => setGlobalTimeout(parseInt(e.target.value))}
                placeholder="120000"
              />
            </div>
          </section>

          {/* Presets */}
          <section className="form-section">
            <h2>Load Preset</h2>
            <div className="preset-buttons">
              <button onClick={() => loadPreset('simple_debate')}>Simple Debate</button>
              <button onClick={() => loadPreset('blind_review')}>Blind Review</button>
              <button onClick={resetForm}>Reset Form</button>
            </div>
          </section>

          {/* Variables */}
          <section className="form-section">
            <h2>Variables</h2>
            <button onClick={addVariable} className="add-button">+ Add Variable</button>
            {variables.map((v, i) => (
              <div key={i} className="variable-item">
                <input
                  type="text"
                  placeholder="Variable name"
                  value={v.name}
                  onChange={(e) => updateVariable(i, 'name', e.target.value)}
                />
                <select
                  value={v.type}
                  onChange={(e) => updateVariable(i, 'type', e.target.value)}
                >
                  <option value="string">string</option>
                  <option value="json_object">json_object</option>
                  <option value="list">list</option>
                </select>
                <input
                  type="text"
                  placeholder="Default value (optional)"
                  value={v.defaultValue}
                  onChange={(e) => updateVariable(i, 'defaultValue', e.target.value)}
                />
                <button onClick={() => removeVariable(i)} className="remove-button">×</button>
              </div>
            ))}
          </section>

          {/* Supersteps */}
          <section className="form-section">
            <h2>Supersteps</h2>
            <button onClick={addSuperstep} className="add-button">+ Add Superstep</button>
            {supersteps.map((step, stepIndex) => (
              <div key={stepIndex} className="superstep-item">
                <div className="superstep-header">
                  <h3>Superstep {stepIndex + 1}</h3>
                  <button onClick={() => removeSuperstep(stepIndex)} className="remove-button">
                    Remove
                  </button>
                </div>

                <div className="form-group">
                  <label>Step ID</label>
                  <input
                    type="text"
                    value={step.stepId}
                    onChange={(e) => updateSuperstep(stepIndex, 'stepId', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    value={step.description}
                    onChange={(e) => updateSuperstep(stepIndex, 'description', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Concurrency Limit (optional)</label>
                  <input
                    type="number"
                    value={step.concurrency || ''}
                    onChange={(e) => updateSuperstep(stepIndex, 'concurrency', e.target.value)}
                    placeholder="Leave empty for unlimited"
                  />
                </div>

                <div className="form-group">
                  <label>Global Instruction (optional)</label>
                  <textarea
                    value={step.globalInstruction}
                    onChange={(e) => updateSuperstep(stepIndex, 'globalInstruction', e.target.value)}
                    placeholder="Instruction overlay for all workers"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>Default Role (optional)</label>
                  <textarea
                    value={step.defaultRole}
                    onChange={(e) => updateSuperstep(stepIndex, 'defaultRole', e.target.value)}
                    placeholder="Default role for workers (can be overridden)"
                    rows={2}
                  />
                </div>

                {/* Workers */}
                <div className="workers-section">
                  <h4>Workers</h4>
                  <button onClick={() => addWorker(stepIndex)} className="add-button-small">
                    + Add Worker
                  </button>
                  {step.workers.map((worker, workerIndex) => (
                    <div key={workerIndex} className="worker-item">
                      <input
                        type="text"
                        placeholder="Worker ID"
                        value={worker.workerId}
                        onChange={(e) =>
                          updateWorker(stepIndex, workerIndex, 'workerId', e.target.value)
                        }
                      />
                      <select
                        value={worker.modelRef}
                        onChange={(e) =>
                          updateWorker(stepIndex, workerIndex, 'modelRef', e.target.value)
                        }
                      >
                        <option value={models.GPT4}>GPT-4</option>
                        <option value={models.GPT4_TURBO}>GPT-4 Turbo</option>
                        <option value={models.CLAUDE_SONNET}>Claude Sonnet</option>
                        <option value={models.GEMINI_FLASH}>Gemini Flash</option>
                      </select>
                      <textarea
                        placeholder="Role definition (optional if default role set)"
                        value={worker.roleDefinition}
                        onChange={(e) =>
                          updateWorker(stepIndex, workerIndex, 'roleDefinition', e.target.value)
                        }
                        rows={2}
                      />
                      <button
                        onClick={() => removeWorker(stepIndex, workerIndex)}
                        className="remove-button"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {/* Reduce Phase */}
                <div className="reduce-section">
                  <h4>Reduce Phase</h4>
                  <div className="form-group">
                    <label>Strategy</label>
                    <select
                      value={step.reduce.strategy}
                      onChange={(e) => {
                        const updated = [...supersteps];
                        updated[stepIndex].reduce.strategy = e.target.value;
                        setSupersteps(updated);
                      }}
                    >
                      <option value={strategies.COUNCIL_CHAIRMAN}>Council Chairman</option>
                      <option value={strategies.SIMPLE_SUMMARY}>Simple Summary</option>
                      <option value={strategies.VOTE_MAJORITY}>Vote Majority</option>
                      <option value={strategies.SUBQUERY_SINGLE_MODEL}>Subquery Single Model</option>
                      <option value={strategies.CROSS_INTERROGATION}>Cross Interrogation</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Model</label>
                    <select
                      value={step.reduce.modelRef}
                      onChange={(e) => {
                        const updated = [...supersteps];
                        updated[stepIndex].reduce.modelRef = e.target.value;
                        setSupersteps(updated);
                      }}
                    >
                      <option value={models.GPT4}>GPT-4</option>
                      <option value={models.GPT4_TURBO}>GPT-4 Turbo</option>
                      <option value={models.CLAUDE_SONNET}>Claude Sonnet</option>
                      <option value={models.GEMINI_FLASH}>Gemini Flash</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Output Write To (variable name)</label>
                    <input
                      type="text"
                      value={step.reduce.outputWriteTo}
                      onChange={(e) => {
                        const updated = [...supersteps];
                        updated[stepIndex].reduce.outputWriteTo = e.target.value;
                        setSupersteps(updated);
                      }}
                      placeholder="final_answer"
                    />
                  </div>

                  <div className="form-group">
                    <label>Visibility Preset</label>
                    <select
                      value={step.reduce.visibilityPreset}
                      onChange={(e) => {
                        const updated = [...supersteps];
                        updated[stepIndex].reduce.visibilityPreset = e.target.value;
                        setSupersteps(updated);
                      }}
                    >
                      <option value="full">Full</option>
                      <option value="blindReview">Blind Review</option>
                      <option value="cleanSubquery">Clean Subquery</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Chairman Instructions (optional)</label>
                    <textarea
                      value={step.reduce.chairmanInstructions}
                      onChange={(e) => {
                        const updated = [...supersteps];
                        updated[stepIndex].reduce.chairmanInstructions = e.target.value;
                        setSupersteps(updated);
                      }}
                      placeholder="Instructions for the chairman/reducer"
                      rows={3}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={step.reduce.variableInterpolation}
                        onChange={(e) => {
                          const updated = [...supersteps];
                          updated[stepIndex].reduce.variableInterpolation = e.target.checked;
                          setSupersteps(updated);
                        }}
                      />
                      Enable Variable Interpolation
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* Actions */}
          <section className="form-section actions-section">
            <button onClick={generateWorkflow} className="action-button primary">
              Generate Workflow
            </button>
            <button
              onClick={validateWorkflow}
              className="action-button"
              disabled={isValidating || !generatedWorkflow}
            >
              {isValidating ? 'Validating...' : 'Validate'}
            </button>
            <button
              onClick={downloadWorkflow}
              className="action-button"
              disabled={!generatedWorkflow}
            >
              Download JSON
            </button>
            <button
              onClick={copyToClipboard}
              className="action-button"
              disabled={!generatedWorkflow}
            >
              Copy to Clipboard
            </button>
          </section>
        </div>

        {/* Right Panel - Preview */}
        <div className="generator-preview">
          <h2>JSON Preview</h2>
          {validationResult && (
            <div className={`validation-result ${validationResult.valid ? 'valid' : 'invalid'}`}>
              {validationResult.valid ? (
                <p>✅ Workflow is valid!</p>
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
          <pre className="json-preview">
            {generatedWorkflow
              ? JSON.stringify(generatedWorkflow, null, 2)
              : '// Click "Generate Workflow" to see the JSON output'}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default WorkflowAdvancedEditor;
