import { useState } from 'react';
import classicCouncilWorkflow from '../../../examples/workflows/classic_council.json';
import perspectiveMatrixWorkflow from '../../../examples/workflows/perspective_matrix.json';
import debateWorkflow from '../../../examples/workflows/debate_with_scope_alignment.json';

/**
 * Workflow visualization and builder component.
 * Displays workflow structure from JSON configuration.
 *
 * ## Workflow Types
 * - **Classic Council**: Traditional 3-stage deliberation
 * - **Perspective Matrix**: Every model analyzes from multiple perspectives
 * - **Debate with Scope Alignment**: Pre-execution role alignment
 */
export default {
  title: 'Workflows/WorkflowBuilder',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Visualizes workflow configurations from JSON. Shows supersteps, workers, and execution flow.'
      }
    }
  },
  tags: ['autodocs']
};

/**
 * WorkflowVisualization component - renders workflow structure
 */
function WorkflowVisualization({ workflow }) {
  const [expandedSteps, setExpandedSteps] = useState({});

  const toggleStep = (stepId) => {
    setExpandedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '1000px',
      margin: '0 auto'
    }}>
      {/* Workflow Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '1.5rem',
        borderRadius: '8px 8px 0 0',
        marginBottom: '1rem'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{workflow.flow_id}</h2>
        <p style={{ margin: '0.5rem 0 0', opacity: 0.9 }}>
          {workflow.supersteps.length} supersteps
          {workflow.scope_alignment?.enabled && ' • Scope Alignment Enabled'}
        </p>
      </div>

      {/* Scope Alignment Info */}
      {workflow.scope_alignment?.enabled && (
        <div style={{
          background: '#f0f4ff',
          border: '2px solid #667eea',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🎯</span>
            <strong>Scope Alignment System</strong>
          </div>
          <p style={{ margin: 0, color: '#555', fontSize: '0.9rem' }}>
            Pre-execution phase ensures clear role boundaries and prevents responsibility overlaps.
            Coordinator: <strong>{workflow.scope_alignment.coordinator_model}</strong>
          </p>
        </div>
      )}

      {/* Variables */}
      {workflow.variables && workflow.variables.length > 0 && (
        <div style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#374151' }}>
            📊 Variables ({workflow.variables.length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.5rem' }}>
            {workflow.variables.map((variable, idx) => (
              <div key={idx} style={{
                background: 'white',
                padding: '0.75rem',
                borderRadius: '4px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#6366f1' }}>
                  {variable.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {variable.type}
                  {variable.description && ` • ${variable.description}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supersteps */}
      {workflow.supersteps.map((step, stepIdx) => {
        const isExpanded = expandedSteps[step.step_id];
        const workerCount = step.map_phase?.workers?.length || 0;
        const isPerspectiveMatrix = !!step.map_phase?.perspective_matrix;
        const perspectiveCount = step.map_phase?.perspective_matrix?.perspectives?.length || 0;

        return (
          <div key={step.step_id} style={{
            marginBottom: '1rem',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            {/* Step Header */}
            <button
              onClick={() => toggleStep(step.step_id)}
              style={{
                width: '100%',
                background: isExpanded ? '#f3f4f6' : 'white',
                border: 'none',
                padding: '1rem',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'background 0.2s'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{
                    background: '#6366f1',
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold'
                  }}>
                    Step {stepIdx + 1}
                  </span>
                  <strong style={{ fontSize: '1.1rem' }}>{step.step_id}</strong>
                  {isPerspectiveMatrix && (
                    <span style={{
                      background: '#fbbf24',
                      color: 'white',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}>
                      PERSPECTIVE MATRIX
                    </span>
                  )}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  {step.description}
                </div>
                <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  {isPerspectiveMatrix
                    ? `${(workflow.models?.length || workerCount)} models × ${perspectiveCount} perspectives = ${(workflow.models?.length || workerCount) * perspectiveCount} workers`
                    : `${workerCount} workers`}
                  {' • '}
                  Output: <strong>{step.reduce_phase?.output_write_to || 'none'}</strong>
                </div>
              </div>
              <span style={{ fontSize: '1.5rem', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                ▶
              </span>
            </button>

            {/* Step Details */}
            {isExpanded && (
              <div style={{ padding: '1rem', background: '#fafafa', borderTop: '1px solid #e5e7eb' }}>

                {/* Map Phase */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem', color: '#374151' }}>
                    🔀 Map Phase
                    {step.map_phase?.concurrency_limit && (
                      <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                        (max {step.map_phase.concurrency_limit} concurrent)
                      </span>
                    )}
                  </h4>

                  {/* Perspective Matrix */}
                  {isPerspectiveMatrix && (
                    <div style={{
                      background: '#fffbeb',
                      border: '2px solid #fbbf24',
                      borderRadius: '6px',
                      padding: '1rem',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#92400e' }}>
                        Perspective Matrix: {perspectiveCount} perspectives
                      </div>
                      <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {step.map_phase.perspective_matrix.perspectives.map((perspective) => (
                          <div key={perspective.perspective_id} style={{
                            background: 'white',
                            padding: '0.75rem',
                            borderRadius: '4px',
                            border: '1px solid #fbbf24'
                          }}>
                            <div style={{ fontWeight: 'bold', color: '#b45309', marginBottom: '0.25rem' }}>
                              {perspective.perspective_id}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                              {perspective.instruction}
                            </div>
                          </div>
                        ))}
                      </div>
                      {workflow.models && (
                        <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#92400e' }}>
                          Each perspective analyzed by: {workflow.models.join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Regular Workers */}
                  {!isPerspectiveMatrix && step.map_phase?.workers && (
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {step.map_phase.workers.map((worker) => (
                        <div key={worker.worker_id} style={{
                          background: 'white',
                          padding: '1rem',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                            <div>
                              <div style={{ fontWeight: 'bold', color: '#1f2937' }}>
                                {worker.worker_id}
                              </div>
                              <div style={{ fontSize: '0.85rem', color: '#6366f1', marginTop: '0.25rem' }}>
                                {worker.model_ref}
                              </div>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '0.85rem',
                            color: '#4b5563',
                            padding: '0.5rem',
                            background: '#f9fafb',
                            borderRadius: '4px',
                            borderLeft: '3px solid #6366f1'
                          }}>
                            {worker.instruction}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reduce Phase */}
                <div>
                  <h4 style={{ margin: '0 0 0.75rem', color: '#374151' }}>🔻 Reduce Phase</h4>
                  <div style={{
                    background: 'white',
                    padding: '1rem',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.5rem', fontSize: '0.9rem' }}>
                      <div style={{ color: '#6b7280' }}>Strategy:</div>
                      <div style={{ fontWeight: 'bold', color: '#1f2937' }}>
                        {step.reduce_phase?.strategy || 'none'}
                      </div>

                      <div style={{ color: '#6b7280' }}>Model:</div>
                      <div style={{ color: '#6366f1' }}>
                        {step.reduce_phase?.model_ref || 'none'}
                      </div>

                      <div style={{ color: '#6b7280' }}>Output Variable:</div>
                      <div style={{ fontFamily: 'monospace', color: '#059669' }}>
                        {step.reduce_phase?.output_write_to || 'none'}
                      </div>

                      {step.reduce_phase?.visibility && (
                        <>
                          <div style={{ color: '#6b7280' }}>Include Input:</div>
                          <div>{step.reduce_phase.visibility.include_original_input ? '✅ Yes' : '❌ No'}</div>

                          <div style={{ color: '#6b7280' }}>Mask Identities:</div>
                          <div>{step.reduce_phase.visibility.mask_worker_identities ? '✅ Yes' : '❌ No'}</div>
                        </>
                      )}

                      {step.reduce_phase?.chairman_instructions && (
                        <>
                          <div style={{ color: '#6b7280' }}>Chairman:</div>
                          <div style={{
                            padding: '0.5rem',
                            background: '#f0f4ff',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            color: '#4b5563'
                          }}>
                            {step.reduce_phase.chairman_instructions}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ========== STORY EXPORTS ==========

/**
 * Classic Council workflow - traditional 3-stage deliberation
 */
export const ClassicCouncil = {
  render: () => <WorkflowVisualization workflow={classicCouncilWorkflow} />,
  parameters: {
    docs: {
      description: {
        story: 'Traditional LLM Council workflow with Stage 1 (parallel responses), Stage 2 (review), and Stage 3 (chairman synthesis). Features scope alignment for clear role boundaries.'
      }
    }
  }
};

/**
 * Perspective Matrix workflow - every model analyzes from multiple perspectives
 */
export const PerspectiveMatrix = {
  render: () => <WorkflowVisualization workflow={perspectiveMatrixWorkflow} />,
  parameters: {
    docs: {
      description: {
        story: 'Advanced workflow using perspective matrix: 3 models × 4 perspectives (security, UX, performance, maintainability) = 12 parallel analyses. Demonstrates multi-dimensional reasoning.'
      }
    }
  }
};

/**
 * Debate workflow with scope alignment enabled
 */
export const DebateWithScopeAlignment = {
  render: () => <WorkflowVisualization workflow={debateWorkflow} />,
  parameters: {
    docs: {
      description: {
        story: 'Debate-style workflow with pre-execution scope alignment to prevent role drift. Shows how the coordination layer refines worker responsibilities before execution.'
      }
    }
  }
};

/**
 * Comparison of all workflow types side by side
 */
export const WorkflowComparison = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
      <div>
        <h2 style={{ marginBottom: '1rem', color: '#1f2937' }}>Classic Council</h2>
        <WorkflowVisualization workflow={classicCouncilWorkflow} />
      </div>
      <div>
        <h2 style={{ marginTop: '2rem', marginBottom: '1rem', color: '#1f2937' }}>Perspective Matrix</h2>
        <WorkflowVisualization workflow={perspectiveMatrixWorkflow} />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Compare different workflow architectures side-by-side. Notice how perspective matrix generates many more workers through combinatorial expansion.'
      }
    },
    layout: 'fullscreen'
  }
};

/**
 * Interactive workflow JSON editor
 */
export const WorkflowJSONEditor = {
  render: function JSONEditor() {
    const [selectedWorkflow, setSelectedWorkflow] = useState('classic');

    const workflows = {
      classic: classicCouncilWorkflow,
      perspective: perspectiveMatrixWorkflow,
      debate: debateWorkflow
    };

    const currentWorkflow = workflows[selectedWorkflow];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', height: '600px' }}>
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <select
              value={selectedWorkflow}
              onChange={(e) => setSelectedWorkflow(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                border: '1px solid #e5e7eb',
                fontSize: '1rem',
                width: '100%'
              }}
            >
              <option value="classic">Classic Council</option>
              <option value="perspective">Perspective Matrix</option>
              <option value="debate">Debate with Scope Alignment</option>
            </select>
          </div>
          <pre style={{
            background: '#1e293b',
            color: '#e2e8f0',
            padding: '1rem',
            borderRadius: '8px',
            overflow: 'auto',
            height: 'calc(100% - 3rem)',
            fontSize: '0.85rem',
            fontFamily: 'monospace'
          }}>
            {JSON.stringify(currentWorkflow, null, 2)}
          </pre>
        </div>
        <div style={{ overflow: 'auto' }}>
          <WorkflowVisualization workflow={currentWorkflow} />
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive editor showing workflow JSON alongside visual representation. Select different workflows to compare structure.'
      }
    },
    layout: 'fullscreen'
  }
};
