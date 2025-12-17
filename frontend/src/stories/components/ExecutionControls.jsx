import React from 'react';
import PropTypes from 'prop-types';

/**
 * ExecutionControls - Control panel for workflow execution
 *
 * Provides Step/Pause/Run/Reset buttons and speed control
 */
export function ExecutionControls({
  executionMode,
  executionSpeed,
  canStep,
  onStep,
  onRun,
  onPause,
  onReset,
  onSpeedChange
}) {
  const isRunning = executionMode === 'running';
  const isComplete = executionMode === 'complete';
  const isIdle = executionMode === 'idle';

  return (
    <div className="execution-controls">
      <div className="execution-controls__buttons">
        <button
          className="execution-controls__button execution-controls__button--step"
          onClick={onStep}
          disabled={!canStep || isRunning || isComplete}
          aria-label="Execute one step"
          title="Execute one worker (Shortcut: Space)"
        >
          <span className="execution-controls__button-icon">⏯</span>
          <span className="execution-controls__button-text">Step</span>
        </button>

        {!isRunning ? (
          <button
            className="execution-controls__button execution-controls__button--run"
            onClick={onRun}
            disabled={!canStep || isComplete}
            aria-label="Auto-run execution"
            title="Auto-advance until complete"
          >
            <span className="execution-controls__button-icon">▶</span>
            <span className="execution-controls__button-text">
              {isIdle ? 'Run' : 'Resume'}
            </span>
          </button>
        ) : (
          <button
            className="execution-controls__button execution-controls__button--pause"
            onClick={onPause}
            aria-label="Pause execution"
            title="Pause auto-run"
          >
            <span className="execution-controls__button-icon">⏸</span>
            <span className="execution-controls__button-text">Pause</span>
          </button>
        )}

        <button
          className="execution-controls__button execution-controls__button--reset"
          onClick={onReset}
          disabled={isIdle && !isComplete}
          aria-label="Reset execution"
          title="Reset to initial state"
        >
          <span className="execution-controls__button-icon">🔄</span>
          <span className="execution-controls__button-text">Reset</span>
        </button>
      </div>

      <div className="execution-controls__speed">
        <label htmlFor="speed-slider" className="execution-controls__speed-label">
          Speed:
        </label>
        <input
          id="speed-slider"
          type="range"
          min="100"
          max="3000"
          step="100"
          value={executionSpeed}
          onChange={(e) => onSpeedChange(parseInt(e.target.value, 10))}
          className="execution-controls__speed-slider"
          aria-label="Execution speed"
        />
        <span className="execution-controls__speed-value">
          {executionSpeed}ms
        </span>
        <div className="execution-controls__speed-labels">
          <span className="execution-controls__speed-label-min">Fast</span>
          <span className="execution-controls__speed-label-max">Slow</span>
        </div>
      </div>

      {/* Execution mode indicator */}
      <div className={`execution-controls__status execution-controls__status--${executionMode}`}>
        {executionMode === 'running' && (
          <>
            <span className="execution-controls__status-icon">▶</span>
            <span className="execution-controls__status-text">Running...</span>
          </>
        )}
        {executionMode === 'complete' && (
          <>
            <span className="execution-controls__status-icon">✓</span>
            <span className="execution-controls__status-text">Complete</span>
          </>
        )}
        {executionMode === 'idle' && (
          <>
            <span className="execution-controls__status-icon">○</span>
            <span className="execution-controls__status-text">Ready</span>
          </>
        )}
      </div>
    </div>
  );
}

ExecutionControls.propTypes = {
  executionMode: PropTypes.oneOf(['idle', 'running', 'paused', 'complete']).isRequired,
  executionSpeed: PropTypes.number.isRequired,
  canStep: PropTypes.bool.isRequired,
  onStep: PropTypes.func.isRequired,
  onRun: PropTypes.func.isRequired,
  onPause: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  onSpeedChange: PropTypes.func.isRequired
};
