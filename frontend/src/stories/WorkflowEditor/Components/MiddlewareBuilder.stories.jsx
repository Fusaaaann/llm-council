import { useState } from 'react';
import MiddlewareBuilder from '../../../components/workflow-editor/components/MiddlewareBuilder.jsx';
import { mockGlobalModels, mockMiddleware } from '../../mockData.js';

/**
 * MiddlewareBuilder - Component for building middleware pipelines in Advanced tier
 *
 * Middleware operations run after workers complete, allowing you to filter, transform,
 * or refine outputs before the reduce phase. This is an Advanced tier feature.
 *
 * Supports 4 operation types:
 * - filter_regex: Filter outputs by regex pattern
 * - anonymize_pii: Remove personally identifiable information
 * - truncate: Limit output length
 * - llm_refine: Use an LLM to refine or transform output
 */
export default {
  title: 'WorkflowEditor/Components/MiddlewareBuilder',
  component: MiddlewareBuilder,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Advanced tier component for building middleware pipelines that process worker outputs before reduction. Supports filtering, PII removal, truncation, and LLM refinement.'
      }
    }
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
        <Story />
      </div>
    )
  ],
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'middleware changed' }
  }
};

/**
 * Empty state - no middleware operations configured
 */
export const Empty = {
  args: {
    middleware: [],
    globalModels: mockGlobalModels,
    onChange: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty state showing helpful text explaining what middleware operations do. Click "Add Operation" to add your first middleware operation.'
      }
    }
  }
};

/**
 * Single operation - one filter_regex middleware operation
 */
export const SingleOperation = {
  args: {
    middleware: [mockMiddleware[0]], // filter_regex
    globalModels: mockGlobalModels,
    onChange: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Single filter_regex operation configured to flag outputs matching a pattern. Click the operation header to expand/collapse configuration.'
      }
    }
  }
};

/**
 * Multiple operations - 3 operations in pipeline
 */
export const MultipleOperations = {
  args: {
    middleware: [
      mockMiddleware[0], // filter_regex
      mockMiddleware[1], // anonymize_pii
      mockMiddleware[2]  // truncate
    ],
    globalModels: mockGlobalModels,
    onChange: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Three middleware operations chained in a pipeline: filter → anonymize → truncate. The visual pipeline shows the flow from Workers through each operation to the Reducer.'
      }
    }
  }
};

/**
 * All operation types - demonstrates all 4 middleware operation types
 */
export const AllOperationTypes = {
  args: {
    middleware: mockMiddleware, // All 4 types
    globalModels: mockGlobalModels,
    onChange: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'All 4 middleware operation types: filter_regex, anonymize_pii, truncate, and llm_refine. Each has different configuration requirements.'
      }
    }
  }
};

/**
 * Expanded operation - shows configuration form for llm_refine
 */
export const Expanded = {
  render: function ExpandedDemo() {
    const [expandedIndex, setExpandedIndex] = useState(3); // Start with llm_refine expanded
    const [middleware, setMiddleware] = useState(mockMiddleware);

    // Simple implementation that shows expanded state
    return (
      <div className="middleware-builder">
        <div className="middleware-header">
          <h4>Middleware Pipeline</h4>
          <button className="btn-secondary btn-small">+ Add Operation</button>
        </div>

        <div className="middleware-list">
          {middleware.map((op, index) => {
            const isExpanded = expandedIndex === index;
            const opLabels = {
              filter_regex: 'Filter by Regex',
              anonymize_pii: 'Anonymize PII',
              truncate: 'Truncate Output',
              llm_refine: 'LLM Refine'
            };

            return (
              <div key={index} className={`middleware-item ${isExpanded ? 'expanded' : ''}`}>
                <div
                  className="middleware-item-header"
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="middleware-item-info">
                    <span className="middleware-index">{index + 1}</span>
                    <span className="middleware-label">{opLabels[op.op] || op.op}</span>
                    <span className="middleware-apply-to">
                      {op.apply_to?.includes('*') ? 'All workers' : `${op.apply_to?.length || 0} workers`}
                    </span>
                  </div>
                  <div className="middleware-item-actions">
                    <button className="btn-remove-small" onClick={(e) => e.stopPropagation()}>×</button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="middleware-item-config">
                    <div className="form-group">
                      <label>Operation Type</label>
                      <select value={op.op}>
                        <option value="filter_regex">Filter by Regex</option>
                        <option value="anonymize_pii">Anonymize PII</option>
                        <option value="truncate">Truncate Output</option>
                        <option value="llm_refine">LLM Refine</option>
                      </select>
                      <span className="help-text">
                        {op.op === 'llm_refine' && 'Use an LLM to refine or transform output'}
                      </span>
                    </div>

                    <div className="form-group">
                      <label>Apply To</label>
                      <input
                        type="text"
                        value={op.apply_to?.join(', ') || '*'}
                        placeholder="* (all workers) or worker_id1, worker_id2"
                      />
                      <span className="help-text">Use * for all workers, or comma-separated worker IDs</span>
                    </div>

                    {op.op === 'llm_refine' && (
                      <>
                        <div className="form-group">
                          <label>Refine Model <span className="required">*</span></label>
                          <select value={op.config?.model_ref || ''}>
                            <option value="">Select a model...</option>
                            <option value="openai/gpt-4o">GPT-4o</option>
                            <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Refine Instruction <span className="required">*</span></label>
                          <textarea
                            value={op.config?.instruction || ''}
                            rows={3}
                            placeholder="Instructions for refining the output..."
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="middleware-pipeline-visual">
          <div className="pipeline-flow">
            <div className="pipeline-node">Workers</div>
            <div className="pipeline-arrow">→</div>
            {middleware.map((op, idx) => (
              <div key={idx} className="pipeline-op">
                {opLabels[op.op] || op.op}
                <div className="pipeline-arrow">→</div>
              </div>
            ))}
            <div className="pipeline-node">Reducer</div>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'LLM Refine operation expanded showing its configuration form. Requires a model selection and refine instruction. Click any operation header to expand/collapse it.'
      }
    }
  }
};

/**
 * Interactive demo - fully functional middleware builder
 */
export const Interactive = {
  render: function InteractiveDemo() {
    const [middleware, setMiddleware] = useState([mockMiddleware[0]]);

    const handleChange = (updatedMiddleware) => {
      console.log('Middleware updated:', updatedMiddleware);
      setMiddleware(updatedMiddleware);
    };

    return (
      <div>
        <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>Interactive Demo</h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
            Try adding, removing, and configuring middleware operations. Click operation headers to expand/collapse.
            The pipeline visualization at the bottom shows the flow.
          </p>
          <div style={{ marginTop: '10px', fontSize: '12px', fontFamily: 'monospace', background: 'white', padding: '10px', borderRadius: '4px' }}>
            Current pipeline: {middleware.length} operation(s)
          </div>
        </div>

        <MiddlewareBuilder
          middleware={middleware}
          onChange={handleChange}
          globalModels={mockGlobalModels}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Fully interactive MiddlewareBuilder. Add operations, configure them, remove them, and watch the pipeline update in real-time. Check the Actions panel to see onChange events.'
      }
    }
  }
};
