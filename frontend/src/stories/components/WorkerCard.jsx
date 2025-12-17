import React from 'react';
import PropTypes from 'prop-types';

/**
 * WorkerCard - Visual representation of a single worker in the workflow
 *
 * Shows worker state (pending/active/complete) with visual indicators
 */
export function WorkerCard({ worker, state, output, onClick }) {
  const getStateIcon = () => {
    switch (state) {
      case 'active':
        return '▶';
      case 'complete':
        return '✓';
      case 'pending':
      default:
        return '⏳';
    }
  };

  const getStateClass = () => {
    return `worker-card worker-card--${state}`;
  };

  const getModelDisplayName = (modelRef) => {
    if (!modelRef) return 'Unknown Model';

    // Extract readable name from model ref
    // e.g., "openai/gpt-4o" -> "GPT-4o"
    const parts = modelRef.split('/');
    const modelName = parts[parts.length - 1];

    return modelName
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  const truncateInstruction = (instruction, maxLength = 60) => {
    if (!instruction) return '';
    if (instruction.length <= maxLength) return instruction;
    return instruction.substring(0, maxLength) + '...';
  };

  return (
    <div
      className={getStateClass()}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Worker ${worker.worker_id}: ${state}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="worker-card__header">
        <span className="worker-card__icon" aria-hidden="true">
          {getStateIcon()}
        </span>
        <span className="worker-card__id">{worker.worker_id}</span>
      </div>

      <div className="worker-card__model">
        {getModelDisplayName(worker.model_ref)}
      </div>

      {worker.instruction && (
        <div className="worker-card__instruction" title={worker.instruction}>
          {truncateInstruction(worker.instruction)}
        </div>
      )}

      {worker.isPerspectiveMatrix && worker.perspectiveId && (
        <div className="worker-card__perspective">
          <span className="worker-card__badge">
            {worker.perspectiveId}
          </span>
        </div>
      )}

      {state === 'complete' && output && (
        <div className="worker-card__output-indicator">
          <span className="worker-card__output-icon">📝</span>
          <span className="worker-card__output-text">Output ready</span>
        </div>
      )}
    </div>
  );
}

WorkerCard.propTypes = {
  worker: PropTypes.shape({
    worker_id: PropTypes.string.isRequired,
    model_ref: PropTypes.string,
    instruction: PropTypes.string,
    role_definition: PropTypes.string,
    isPerspectiveMatrix: PropTypes.bool,
    perspectiveId: PropTypes.string
  }).isRequired,
  state: PropTypes.oneOf(['pending', 'active', 'complete']).isRequired,
  output: PropTypes.object,
  onClick: PropTypes.func
};

WorkerCard.defaultProps = {
  output: null,
  onClick: () => {}
};
