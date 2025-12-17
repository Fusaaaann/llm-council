import React from 'react';
import PropTypes from 'prop-types';

/**
 * VariableWatcher - Shows current state of workflow variables
 *
 * Displays variable values with visual indicators for updates
 */
export function VariableWatcher({ variables, variableDefinitions }) {
  if (!variableDefinitions || variableDefinitions.length === 0) {
    return null;
  }

  const formatValue = (value, type) => {
    if (value === null || value === undefined) {
      return <em className="variable-watcher__value-null">null</em>;
    }

    if (type === 'json_object' || type === 'list') {
      const preview = JSON.stringify(value);
      if (preview.length > 80) {
        return preview.substring(0, 77) + '...';
      }
      return preview;
    }

    if (typeof value === 'object' && value.synthesis) {
      // Reduce output object
      const text = value.synthesis;
      if (text.length > 100) {
        return text.substring(0, 97) + '...';
      }
      return text;
    }

    if (typeof value === 'string') {
      if (value.length > 100) {
        return value.substring(0, 97) + '...';
      }
      return value;
    }

    return String(value);
  };

  return (
    <div className="variable-watcher">
      <div className="variable-watcher__header">
        <span className="variable-watcher__icon">📊</span>
        <h3 className="variable-watcher__title">Variables</h3>
      </div>

      <div className="variable-watcher__list">
        {variableDefinitions.map((varDef) => {
          const currentValue = variables[varDef.name];
          const hasValue = currentValue !== null && currentValue !== undefined;

          return (
            <div
              key={varDef.name}
              className={`variable-watcher__item ${hasValue ? 'variable-watcher__item--has-value' : ''}`}
            >
              <div className="variable-watcher__name">
                <code>{varDef.name}</code>
                <span className="variable-watcher__type">{varDef.type}</span>
              </div>

              <div className="variable-watcher__value">
                {formatValue(currentValue, varDef.type)}
              </div>

              {hasValue && (
                <span className="variable-watcher__indicator" aria-label="Value set">
                  ✓
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

VariableWatcher.propTypes = {
  variables: PropTypes.object.isRequired,
  variableDefinitions: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      default_value: PropTypes.any
    })
  )
};

VariableWatcher.defaultProps = {
  variableDefinitions: []
};
