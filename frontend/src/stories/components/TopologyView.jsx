import React from 'react';
import PropTypes from 'prop-types';
import { SuperstepNode } from './SuperstepNode';

/**
 * TopologyView - Main canvas showing the workflow DAG topology
 *
 * Renders supersteps in vertical layout with dependency arrows
 */
export function TopologyView({
  workflow,
  engine,
  onWorkerClick
}) {
  if (!workflow || !workflow.supersteps) {
    return (
      <div className="topology-view topology-view--empty">
        <div className="topology-view__empty-state">
          <span className="topology-view__empty-icon">📋</span>
          <p className="topology-view__empty-text">
            Paste workflow JSON to visualize topology
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="topology-view">
      {/* Variables Header */}
      {workflow.variables && workflow.variables.length > 0 && (
        <div className="topology-view__variables-header">
          <span className="topology-view__variables-icon">📊</span>
          <span className="topology-view__variables-title">Variables:</span>
          <div className="topology-view__variables-list">
            {workflow.variables.map((v, idx) => (
              <span key={idx} className="topology-view__variable-badge">
                {v.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Supersteps */}
      <div className="topology-view__supersteps">
        {workflow.supersteps.map((superstep, index) => {
          const workers = engine ? engine.expandWorkers(superstep.map_phase) : [];

          // Build worker states map
          const workerStates = {};
          workers.forEach(worker => {
            const state = engine
              ? engine.getWorkerState(index, worker.worker_id)
              : 'pending';
            workerStates[worker.worker_id] = state;
          });

          // Get worker outputs
          const workerOutputs = {};
          if (engine && engine.state.workerOutputs) {
            workers.forEach(worker => {
              const key = `${superstep.step_id}:${worker.worker_id}`;
              if (engine.state.workerOutputs.has(key)) {
                workerOutputs[key] = engine.state.workerOutputs.get(key);
              }
            });
          }

          // Get reduce output
          const reduceOutput = engine && engine.state.reduceOutputs
            ? engine.state.reduceOutputs.get(superstep.step_id)
            : null;

          // Get superstep state
          const superstepState = engine
            ? engine.getSuperstepState(index)
            : 'pending';

          return (
            <SuperstepNode
              key={superstep.step_id}
              superstep={superstep}
              superstepIndex={index}
              workers={workers}
              workerStates={workerStates}
              workerOutputs={workerOutputs}
              reduceOutput={reduceOutput}
              superstepState={superstepState}
              onWorkerClick={onWorkerClick}
            />
          );
        })}
      </div>

      {/* Final Variables Footer */}
      {engine && engine.state.isComplete && (
        <div className="topology-view__variables-footer">
          <span className="topology-view__complete-icon">✓</span>
          <span className="topology-view__complete-text">Execution Complete</span>
        </div>
      )}
    </div>
  );
}

TopologyView.propTypes = {
  workflow: PropTypes.object,
  engine: PropTypes.object,
  onWorkerClick: PropTypes.func
};

TopologyView.defaultProps = {
  workflow: null,
  engine: null,
  onWorkerClick: () => {}
};
