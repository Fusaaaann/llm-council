import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { WorkerCard } from './WorkerCard';

/**
 * SuperstepNode - Represents a complete superstep with MAP, MIDDLEWARE, and REDUCE phases
 *
 * Displays workers in a grid layout and shows phase progression
 */
export function SuperstepNode({
  superstep,
  superstepIndex,
  workers,
  workerStates,
  workerOutputs,
  reduceOutput,
  superstepState,
  onWorkerClick
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getSuperstepStateClass = () => {
    return `superstep-node superstep-node--${superstepState}`;
  };

  const getSuperstepStateIcon = () => {
    switch (superstepState) {
      case 'complete':
        return '✓';
      case 'map_active':
      case 'reduce_active':
        return '▶';
      case 'pending':
      default:
        return '○';
    }
  };

  const getPhaseState = (phase) => {
    if (superstepState === 'complete') return 'complete';
    if (superstepState === `${phase}_active`) return 'active';
    return 'pending';
  };

  const hasMiddleware = superstep.middleware_phase && superstep.middleware_phase.length > 0;

  return (
    <div className={getSuperstepStateClass()}>
      <div className="superstep-node__header">
        <button
          className="superstep-node__toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse superstep' : 'Expand superstep'}
        >
          <span className="superstep-node__toggle-icon">
            {isExpanded ? '▼' : '▶'}
          </span>
        </button>

        <span className="superstep-node__state-icon" aria-hidden="true">
          {getSuperstepStateIcon()}
        </span>

        <h3 className="superstep-node__title">
          Superstep {superstepIndex + 1}: {superstep.step_id}
        </h3>

        {superstep.description && (
          <span className="superstep-node__description">
            {superstep.description}
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="superstep-node__content">
          {/* MAP PHASE */}
          <div className={`superstep-phase superstep-phase--map superstep-phase--${getPhaseState('map')}`}>
            <div className="superstep-phase__header">
              <span className="superstep-phase__icon" aria-hidden="true">🔀</span>
              <h4 className="superstep-phase__title">MAP PHASE</h4>
              <span className="superstep-phase__count">
                {workers.length} worker{workers.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="superstep-phase__workers">
              {workers.map((worker) => {
                const workerId = worker.worker_id;
                const state = workerStates[workerId] || 'pending';
                const output = workerOutputs[`${superstep.step_id}:${workerId}`];

                return (
                  <WorkerCard
                    key={workerId}
                    worker={worker}
                    state={state}
                    output={output}
                    onClick={() => onWorkerClick?.(superstep.step_id, worker, output)}
                  />
                );
              })}
            </div>

            {/* Perspective Matrix Indicator */}
            {superstep.map_phase?.perspective_matrix && (
              <div className="superstep-phase__matrix-info">
                <span className="superstep-phase__badge">Perspective Matrix</span>
                <span className="superstep-phase__matrix-details">
                  {workers.length} workers = {superstep.map_phase.perspective_matrix.perspectives?.length || 0} perspectives × models
                </span>
              </div>
            )}
          </div>

          {/* MIDDLEWARE PHASE (optional) */}
          {hasMiddleware && (
            <div className={`superstep-phase superstep-phase--middleware superstep-phase--${getPhaseState('middleware')}`}>
              <div className="superstep-phase__header">
                <span className="superstep-phase__icon" aria-hidden="true">🔧</span>
                <h4 className="superstep-phase__title">MIDDLEWARE PHASE</h4>
                <span className="superstep-phase__count">
                  {superstep.middleware_phase.length} operation{superstep.middleware_phase.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="superstep-phase__middleware-ops">
                {superstep.middleware_phase.map((op, idx) => (
                  <div key={idx} className="superstep-phase__middleware-op">
                    <span className="superstep-phase__op-name">{op.op}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REDUCE PHASE */}
          <div className={`superstep-phase superstep-phase--reduce superstep-phase--${getPhaseState('reduce')}`}>
            <div className="superstep-phase__header">
              <span className="superstep-phase__icon" aria-hidden="true">🔻</span>
              <h4 className="superstep-phase__title">REDUCE PHASE</h4>
            </div>

            <div className="superstep-phase__reducer">
              <div className="reducer-card">
                <div className="reducer-card__strategy">
                  {superstep.reduce_phase?.strategy || 'unknown'}
                </div>

                {superstep.reduce_phase?.model_ref && (
                  <div className="reducer-card__model">
                    {superstep.reduce_phase.model_ref}
                  </div>
                )}

                {superstep.reduce_phase?.output_write_to && (
                  <div className="reducer-card__output-var">
                    Writes to: <strong>{superstep.reduce_phase.output_write_to}</strong>
                  </div>
                )}

                {reduceOutput && (
                  <div className="reducer-card__status">
                    <span className="reducer-card__icon">✓</span>
                    Synthesis complete
                  </div>
                )}

                {!reduceOutput && getPhaseState('reduce') === 'active' && (
                  <div className="reducer-card__status reducer-card__status--active">
                    <span className="reducer-card__icon">▶</span>
                    Synthesizing...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Variable output indicator */}
      {superstep.reduce_phase?.output_write_to && (
        <div className="superstep-node__footer">
          <span className="superstep-node__arrow">↓</span>
          <span className="superstep-node__variable-output">
            Writes: <code>{superstep.reduce_phase.output_write_to}</code>
          </span>
        </div>
      )}
    </div>
  );
}

SuperstepNode.propTypes = {
  superstep: PropTypes.shape({
    step_id: PropTypes.string.isRequired,
    description: PropTypes.string,
    map_phase: PropTypes.object.isRequired,
    middleware_phase: PropTypes.array,
    reduce_phase: PropTypes.object.isRequired
  }).isRequired,
  superstepIndex: PropTypes.number.isRequired,
  workers: PropTypes.array.isRequired,
  workerStates: PropTypes.object.isRequired,
  workerOutputs: PropTypes.object.isRequired,
  reduceOutput: PropTypes.object,
  superstepState: PropTypes.oneOf(['pending', 'map_active', 'reduce_active', 'complete']).isRequired,
  onWorkerClick: PropTypes.func
};

SuperstepNode.defaultProps = {
  reduceOutput: null,
  onWorkerClick: () => {}
};
