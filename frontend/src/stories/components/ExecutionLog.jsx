import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * ExecutionLog - Shows execution events and worker outputs
 *
 * Displays a chronological log of execution events
 */
export function ExecutionLog({ events, maxEntries = 50 }) {
  const logRef = useRef(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour12: false });
  };

  const formatEvent = (event) => {
    switch (event.type) {
      case 'worker_complete':
        return {
          icon: '✓',
          text: `Worker ${event.workerId} completed (${event.progress.current}/${event.progress.total})`,
          className: 'success'
        };

      case 'reduce_complete':
        return {
          icon: '🔻',
          text: `Reduce complete in ${event.superstep} → ${event.variableWritten}`,
          className: 'success'
        };

      case 'middleware_complete':
        return {
          icon: '🔧',
          text: `Middleware applied (${event.operations} operations)`,
          className: 'info'
        };

      case 'execution_complete':
        return {
          icon: '🎉',
          text: 'Execution complete',
          className: 'complete'
        };

      case 'already_complete':
        return {
          icon: '⚠',
          text: 'Execution already complete',
          className: 'warning'
        };

      default:
        return {
          icon: '•',
          text: JSON.stringify(event),
          className: 'default'
        };
    }
  };

  const displayEvents = events.slice(-maxEntries);

  if (events.length === 0) {
    return (
      <div className="execution-log execution-log--empty">
        <div className="execution-log__header">
          <span className="execution-log__icon">📝</span>
          <h3 className="execution-log__title">Execution Log</h3>
        </div>
        <div className="execution-log__empty-state">
          <p className="execution-log__empty-text">
            No events yet. Click "Step" or "Run" to start execution.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="execution-log">
      <div className="execution-log__header">
        <span className="execution-log__icon">📝</span>
        <h3 className="execution-log__title">Execution Log</h3>
        <span className="execution-log__count">{events.length} events</span>
      </div>

      <div className="execution-log__entries" ref={logRef} role="log" aria-live="polite">
        {displayEvents.map((event, index) => {
          const formatted = formatEvent(event);

          return (
            <div
              key={index}
              className={`execution-log__entry execution-log__entry--${formatted.className}`}
            >
              <span className="execution-log__time">{formatTime()}</span>
              <span className="execution-log__event-icon">{formatted.icon}</span>
              <span className="execution-log__event-text">{formatted.text}</span>
            </div>
          );
        })}
      </div>

      {events.length > maxEntries && (
        <div className="execution-log__footer">
          Showing last {maxEntries} of {events.length} events
        </div>
      )}
    </div>
  );
}

ExecutionLog.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  maxEntries: PropTypes.number
};

ExecutionLog.defaultProps = {
  events: [],
  maxEntries: 50
};
