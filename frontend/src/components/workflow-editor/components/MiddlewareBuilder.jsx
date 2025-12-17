/**
 * MiddlewareBuilder - Component for building middleware pipelines
 * Used in Advanced tier for filtering and transforming worker outputs
 */

import { useState } from 'react';
import ModelSelect from './ModelSelect.jsx';

const MIDDLEWARE_OPS = [
  {
    op: 'filter_regex',
    label: 'Filter by Regex',
    description: 'Filter outputs matching a regex pattern',
    configFields: [
      { name: 'pattern', type: 'text', label: 'Regex Pattern', required: true },
      {
        name: 'action',
        type: 'select',
        label: 'Action',
        required: true,
        options: [
          { value: 'drop', label: 'Drop matching outputs' },
          { value: 'flag', label: 'Flag matching outputs' }
        ]
      }
    ]
  },
  {
    op: 'anonymize_pii',
    label: 'Anonymize PII',
    description: 'Remove personally identifiable information',
    configFields: []
  },
  {
    op: 'truncate',
    label: 'Truncate Output',
    description: 'Limit output length',
    configFields: [
      { name: 'max_length', type: 'number', label: 'Max Length (characters)', required: true },
      {
        name: 'strategy',
        type: 'select',
        label: 'Truncation Strategy',
        required: true,
        options: [
          { value: 'smart', label: 'Smart (preserve meaning)' },
          { value: 'hard', label: 'Hard cutoff' }
        ]
      }
    ]
  },
  {
    op: 'llm_refine',
    label: 'LLM Refine',
    description: 'Use an LLM to refine or transform output',
    configFields: [
      { name: 'model_ref', type: 'model', label: 'Refine Model', required: true },
      { name: 'instruction', type: 'textarea', label: 'Refine Instruction', required: true }
    ]
  }
];

function MiddlewareBuilder({ middleware = [], onChange, globalModels = [] }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  const addMiddleware = () => {
    const newOp = {
      op: 'filter_regex',
      apply_to: ['*'],
      config: { pattern: '', action: 'flag' }
    };
    onChange([...middleware, newOp]);
    setExpandedIndex(middleware.length);
  };

  const removeMiddleware = (index) => {
    onChange(middleware.filter((_, i) => i !== index));
    if (expandedIndex === index) {
      setExpandedIndex(null);
    }
  };

  const updateMiddleware = (index, field, value) => {
    const updated = [...middleware];
    if (field === 'op') {
      // Reset config when changing operation type
      const opDef = MIDDLEWARE_OPS.find(o => o.op === value);
      updated[index] = {
        ...updated[index],
        op: value,
        config: {}
      };
    } else if (field.startsWith('config.')) {
      const configKey = field.substring(7); // Remove 'config.' prefix
      updated[index].config = {
        ...updated[index].config,
        [configKey]: value
      };
    } else {
      updated[index][field] = value;
    }
    onChange(updated);
  };

  const toggleExpanded = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="middleware-builder">
      <div className="middleware-header">
        <h4>Middleware Pipeline</h4>
        <button onClick={addMiddleware} className="btn-secondary btn-small">
          + Add Operation
        </button>
      </div>

      {middleware.length === 0 ? (
        <div className="empty-state">
          <p>No middleware operations configured.</p>
          <p className="help-text">
            Middleware operations run after workers complete, allowing you to filter, transform, or refine outputs before the reduce phase.
          </p>
        </div>
      ) : (
        <div className="middleware-list">
          {middleware.map((op, index) => {
            const opDef = MIDDLEWARE_OPS.find(o => o.op === op.op);
            const isExpanded = expandedIndex === index;

            return (
              <div key={index} className={`middleware-item ${isExpanded ? 'expanded' : ''}`}>
                <div className="middleware-item-header" onClick={() => toggleExpanded(index)}>
                  <div className="middleware-item-info">
                    <span className="middleware-index">{index + 1}</span>
                    <span className="middleware-label">{opDef?.label || op.op}</span>
                    <span className="middleware-apply-to">
                      {op.apply_to?.includes('*') ? 'All workers' : `${op.apply_to?.length || 0} workers`}
                    </span>
                  </div>
                  <div className="middleware-item-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMiddleware(index);
                      }}
                      className="btn-remove-small"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="middleware-item-config">
                    <div className="form-group">
                      <label>Operation Type</label>
                      <select
                        value={op.op}
                        onChange={(e) => updateMiddleware(index, 'op', e.target.value)}
                      >
                        {MIDDLEWARE_OPS.map(opDef => (
                          <option key={opDef.op} value={opDef.op}>
                            {opDef.label}
                          </option>
                        ))}
                      </select>
                      <span className="help-text">{opDef?.description}</span>
                    </div>

                    <div className="form-group">
                      <label>Apply To</label>
                      <input
                        type="text"
                        value={op.apply_to?.join(', ') || '*'}
                        onChange={(e) => {
                          const value = e.target.value.trim();
                          const applyTo = value === '*' ? ['*'] : value.split(',').map(v => v.trim());
                          updateMiddleware(index, 'apply_to', applyTo);
                        }}
                        placeholder="* (all workers) or worker_id1, worker_id2"
                      />
                      <span className="help-text">
                        Use * for all workers, or comma-separated worker IDs
                      </span>
                    </div>

                    {opDef?.configFields.map(field => (
                      <div key={field.name} className="form-group">
                        <label>
                          {field.label}
                          {field.required && <span className="required">*</span>}
                        </label>
                        {field.type === 'text' && (
                          <input
                            type="text"
                            value={op.config[field.name] || ''}
                            onChange={(e) => updateMiddleware(index, `config.${field.name}`, e.target.value)}
                          />
                        )}
                        {field.type === 'number' && (
                          <input
                            type="number"
                            value={op.config[field.name] || ''}
                            onChange={(e) => updateMiddleware(index, `config.${field.name}`, parseInt(e.target.value))}
                          />
                        )}
                        {field.type === 'textarea' && (
                          <textarea
                            value={op.config[field.name] || ''}
                            onChange={(e) => updateMiddleware(index, `config.${field.name}`, e.target.value)}
                            rows={3}
                          />
                        )}
                        {field.type === 'select' && (
                          <select
                            value={op.config[field.name] || ''}
                            onChange={(e) => updateMiddleware(index, `config.${field.name}`, e.target.value)}
                          >
                            <option value="">Select...</option>
                            {field.options?.map(opt => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        )}
                        {field.type === 'model' && (
                          <ModelSelect
                            value={op.config[field.name] || ''}
                            onChange={(modelRef) => updateMiddleware(index, `config.${field.name}`, modelRef)}
                            globalModels={globalModels}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="middleware-pipeline-visual">
        <div className="pipeline-flow">
          <div className="pipeline-node">Workers</div>
          <div className="pipeline-arrow">→</div>
          {middleware.map((op, idx) => (
            <div key={idx} className="pipeline-op">
              {MIDDLEWARE_OPS.find(o => o.op === op.op)?.label || op.op}
              <div className="pipeline-arrow">→</div>
            </div>
          ))}
          <div className="pipeline-node">Reducer</div>
        </div>
      </div>
    </div>
  );
}

export default MiddlewareBuilder;
