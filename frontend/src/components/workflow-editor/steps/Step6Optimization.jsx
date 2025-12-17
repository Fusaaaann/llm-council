/**
 * Step6Optimization - Performance and scope alignment configuration
 * Advanced tier step for scope alignment, timeouts, and performance tuning
 */

import { useState } from 'react';
import QuestionCard from '../components/QuestionCard.jsx';
import ModelSelect from '../components/ModelSelect.jsx';

function Step6Optimization({ state, onChange, onNext, onBack }) {
  const [errors, setErrors] = useState({});

  // Extract state
  const scopeAlignment = state.scopeAlignment || {
    enabled: false,
    coordinatorModel: '',
    scopeTimeout: 30000,
    alignmentTimeout: 60000
  };
  const globalTimeout = state.globalTimeout || 120000;

  const handleToggleScopeAlignment = (enabled) => {
    if (enabled && !scopeAlignment.coordinatorModel) {
      // Auto-select a default coordinator model if none set
      const defaultModel = (state.globalModels || [])[0]?.modelRef || '';
      onChange({
        scopeAlignment: {
          ...scopeAlignment,
          enabled: true,
          coordinatorModel: defaultModel
        }
      });
    } else {
      onChange({
        scopeAlignment: {
          ...scopeAlignment,
          enabled
        }
      });
    }
  };

  const handleUpdateScopeAlignment = (field, value) => {
    onChange({
      scopeAlignment: {
        ...scopeAlignment,
        [field]: value
      }
    });
  };

  const handleGlobalTimeoutChange = (value) => {
    onChange({ globalTimeout: parseInt(value) || 120000 });
  };

  const handleValidateAndNext = () => {
    const newErrors = {};

    // Validate scope alignment
    if (scopeAlignment.enabled) {
      if (!scopeAlignment.coordinatorModel) {
        newErrors.coordinatorModel = 'Coordinator model is required when scope alignment is enabled';
      }
      if (scopeAlignment.scopeTimeout < 1000) {
        newErrors.scopeTimeout = 'Scope timeout must be at least 1000ms (1 second)';
      }
      if (scopeAlignment.alignmentTimeout < 1000) {
        newErrors.alignmentTimeout = 'Alignment timeout must be at least 1000ms (1 second)';
      }
    }

    // Validate global timeout
    if (globalTimeout < 10000) {
      newErrors.globalTimeout = 'Global timeout must be at least 10000ms (10 seconds)';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onNext();
    }
  };

  // Convert milliseconds to seconds for display
  const msToSeconds = (ms) => Math.floor(ms / 1000);
  const secondsToMs = (seconds) => seconds * 1000;

  return (
    <div className="wizard-step step-optimization">
      <div className="step-header">
        <h2>Step 6: Optimization & Performance 🚀</h2>
        <p className="step-description">
          Configure scope alignment to prevent role drift and set performance parameters.
        </p>
      </div>

      <div className="step-content">
        {/* Q13.1: Scope Alignment Toggle */}
        <QuestionCard
          question="Q13.1: Enable scope alignment?"
          description="4-phase pre-execution process prevents role drift, responsibility overlaps, and coverage gaps in multi-agent workflows."
        >
          <div className="radio-group">
            <label className="radio-option">
              <input
                type="radio"
                checked={!scopeAlignment.enabled}
                onChange={() => handleToggleScopeAlignment(false)}
              />
              <div className="radio-label">
                <strong>No (Default)</strong>
                <span className="radio-description">
                  Workers execute with their original instructions (faster, simpler)
                </span>
              </div>
            </label>

            <label className="radio-option">
              <input
                type="radio"
                checked={scopeAlignment.enabled}
                onChange={() => handleToggleScopeAlignment(true)}
              />
              <div className="radio-label">
                <strong>Yes, Enable Scope Alignment</strong>
                <span className="radio-description">
                  Meta-coordination phase refines worker scopes before execution (recommended for complex workflows)
                </span>
              </div>
            </label>
          </div>

          {scopeAlignment.enabled && (
            <div className="scope-alignment-config">
              <div className="info-box">
                <strong>🎯 How Scope Alignment Works:</strong>
                <ol>
                  <li><strong>Phase 1:</strong> Each worker defines its operational contract</li>
                  <li><strong>Phase 2:</strong> Meta-agent resolves conflicts and creates final responsibility map</li>
                  <li><strong>Phase 3:</strong> Execution with refined scopes</li>
                  <li><strong>Phase 4:</strong> Post-execution audit (future)</li>
                </ol>
                <p>
                  <strong>Benefits:</strong> Prevents role drift, eliminates overlaps, fills coverage gaps, improves output quality.
                </p>
              </div>

              {/* Coordinator Model */}
              <div className="form-group">
                <label>
                  Coordinator Model
                  <span className="required">*</span>
                </label>
                <select
                  value={scopeAlignment.coordinatorModel}
                  onChange={(e) => handleUpdateScopeAlignment('coordinatorModel', e.target.value)}
                >
                  <option value="">Select a model...</option>
                  {(state.globalModels || []).map(m => (
                    <option key={m.modelRef} value={m.modelRef}>
                      {m.displayName || m.modelRef}
                    </option>
                  ))}
                </select>
                {errors.coordinatorModel && (
                  <span className="error-text">{errors.coordinatorModel}</span>
                )}
                <span className="help-text">
                  Model used for meta-coordination (Phase 2). Recommended: High-reasoning model (e.g., GPT-4, Claude Opus).
                </span>
              </div>

              {/* Scope Construction Timeout */}
              <div className="form-group">
                <label>Scope Construction Timeout</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    min="1"
                    value={msToSeconds(scopeAlignment.scopeTimeout)}
                    onChange={(e) => handleUpdateScopeAlignment('scopeTimeout', secondsToMs(parseInt(e.target.value) || 30))}
                  />
                  <span className="input-unit">seconds</span>
                </div>
                {errors.scopeTimeout && (
                  <span className="error-text">{errors.scopeTimeout}</span>
                )}
                <span className="help-text">
                  Time allowed for workers to define their operational contracts (Phase 1). Default: 30s.
                </span>
              </div>

              {/* Alignment Timeout */}
              <div className="form-group">
                <label>Alignment Timeout</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    min="1"
                    value={msToSeconds(scopeAlignment.alignmentTimeout)}
                    onChange={(e) => handleUpdateScopeAlignment('alignmentTimeout', secondsToMs(parseInt(e.target.value) || 60))}
                  />
                  <span className="input-unit">seconds</span>
                </div>
                {errors.alignmentTimeout && (
                  <span className="error-text">{errors.alignmentTimeout}</span>
                )}
                <span className="help-text">
                  Time allowed for meta-agent to resolve conflicts (Phase 2). Default: 60s.
                </span>
              </div>

              {/* Graceful Fallback Note */}
              <div className="info-box info-box-muted">
                <strong>🛡️ Graceful Fallback:</strong>
                <p>
                  If scope alignment fails or times out, the workflow will automatically fall back
                  to executing with original worker instructions. No workflow failure.
                </p>
              </div>
            </div>
          )}
        </QuestionCard>

        {/* Global Timeout */}
        <QuestionCard
          question="Q13.2: Global workflow timeout"
          description="Maximum time allowed for the entire workflow to complete."
          error={errors.globalTimeout}
        >
          <div className="timeout-controls">
            <div className="form-group">
              <label>Global Timeout</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min="10"
                  value={msToSeconds(globalTimeout)}
                  onChange={(e) => handleGlobalTimeoutChange(secondsToMs(parseInt(e.target.value) || 120))}
                />
                <span className="input-unit">seconds</span>
              </div>
              <span className="help-text">
                Total time limit for workflow execution. If exceeded, workflow stops gracefully. Default: 120s (2 minutes).
              </span>
            </div>

            {/* Timeout Presets */}
            <div className="timeout-presets">
              <button
                type="button"
                className="btn-preset"
                onClick={() => handleGlobalTimeoutChange(60000)}
              >
                1 minute
              </button>
              <button
                type="button"
                className="btn-preset"
                onClick={() => handleGlobalTimeoutChange(120000)}
              >
                2 minutes (default)
              </button>
              <button
                type="button"
                className="btn-preset"
                onClick={() => handleGlobalTimeoutChange(300000)}
              >
                5 minutes
              </button>
              <button
                type="button"
                className="btn-preset"
                onClick={() => handleGlobalTimeoutChange(600000)}
              >
                10 minutes
              </button>
            </div>
          </div>
        </QuestionCard>

        {/* Performance Hints */}
        <div className="performance-hints-box">
          <h4>⚡ Performance Optimization Tips:</h4>
          <ul>
            <li>
              <strong>Concurrency Limit:</strong> Set to 3-5 for API rate limits, 10+ for high throughput (configured in Step 4).
            </li>
            <li>
              <strong>Scope Alignment:</strong> Adds 30-90s pre-execution overhead but improves quality in complex workflows.
            </li>
            <li>
              <strong>Middleware:</strong> Filter/truncate operations are fast; LLM refine adds latency (configured in Step 4).
            </li>
            <li>
              <strong>Follow-Up Steps:</strong> Each follow-up adds sequential latency (configured in Step 4).
            </li>
            <li>
              <strong>Model Selection:</strong> Faster models (e.g., GPT-3.5, Claude Haiku) reduce latency but may sacrifice quality.
            </li>
            <li>
              <strong>Variable Interpolation:</strong> Minimal overhead, safe to enable (configured in Step 5).
            </li>
          </ul>
        </div>

        {/* Estimated Performance */}
        <div className="estimated-performance-box">
          <h4>📊 Estimated Workflow Performance:</h4>
          <div className="performance-metrics">
            <div className="metric">
              <span className="metric-label">Worker Execution:</span>
              <span className="metric-value">
                {state.perspectives?.length || 0} perspectives × {state.globalModels?.length || 0} models =
                {' '}{(state.perspectives?.length || 0) * (state.globalModels?.length || 0)} workers
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Concurrency:</span>
              <span className="metric-value">
                {state.concurrencyLimit || 'Unlimited'} concurrent workers
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Scope Alignment:</span>
              <span className="metric-value">
                {scopeAlignment.enabled ? `+${msToSeconds(scopeAlignment.scopeTimeout + scopeAlignment.alignmentTimeout)}s overhead` : 'Disabled'}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Follow-Up Steps:</span>
              <span className="metric-value">
                {state.followUpSteps?.length || 0} steps
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Middleware Operations:</span>
              <span className="metric-value">
                {state.middleware?.length || 0} operations
              </span>
            </div>
            <div className="metric metric-total">
              <span className="metric-label">Global Timeout:</span>
              <span className="metric-value">
                {msToSeconds(globalTimeout)}s max
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="step-actions">
        <button onClick={onBack} className="btn-secondary">
          ← Back
        </button>
        <button onClick={handleValidateAndNext} className="btn-primary">
          Next: Review & Export →
        </button>
      </div>
    </div>
  );
}

export default Step6Optimization;
