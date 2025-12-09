function Step5OperationalSettings({ state, onChange, onNext, onBack }) {
  const globalTimeout = state.globalTimeout || 120000; // 120 seconds default
  const filters = state.filters || [];

  const toggleFilter = (filter) => {
    const newFilters = filters.includes(filter)
      ? filters.filter(f => f !== filter)
      : [...filters, filter];
    onChange({ filters: newFilters });
  };

  return (
    <div className="wizard-step step-operational-settings">
      <div className="step-header">
        <h2>Step 5: Runtime, Safety & Filters</h2>
        <p className="step-description">
          Set time limits and optional filters for delegate outputs. Most users can keep the defaults.
        </p>
      </div>

      <div className="step-content">
        {/* Time Limits */}
        <div className="form-group">
          <label htmlFor="globalTimeout">
            Workflow Time Limit
          </label>
          <div className="timeout-input">
            <input
              type="number"
              id="globalTimeout"
              value={globalTimeout / 1000}
              onChange={(e) => onChange({ globalTimeout: parseInt(e.target.value) * 1000 })}
              min={30}
              max={600}
            />
            <span className="unit">seconds</span>
          </div>
          <span className="help-text">
            Maximum time for the entire workflow run (all delegates and collection) to complete. This sets the workflow's global timeout.
          </span>
        </div>

        {/* Privacy & Filtering */}
        <div className="form-group">
          <label>Delegate Output Filtering</label>
          <span className="help-text">
            Apply automatic filters to delegate outputs before they are passed to the collector.
          </span>

          <div className="checkbox-group">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={filters.includes('remove_pii')}
                onChange={() => toggleFilter('remove_pii')}
              />
              <div className="checkbox-label">
                <strong>Remove PII</strong>
                <span className="checkbox-description">
                  Automatically redact emails, phone numbers, and other obvious identifiers from delegate outputs
                </span>
              </div>
            </label>

            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={filters.includes('filter_refusals')}
                onChange={() => toggleFilter('filter_refusals')}
              />
              <div className="checkbox-label">
                <strong>Filter Refusals</strong>
                <span className="checkbox-description">
                  Flag or remove answers that are pure refusals (e.g., "I cannot help with that") before collection
                </span>
              </div>
            </label>

            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={filters.includes('truncate')}
                onChange={() => toggleFilter('truncate')}
              />
              <div className="checkbox-label">
                <strong>Truncate Long Responses</strong>
                <span className="checkbox-description">
                  Limit very long delegate responses (e.g., to ~1000 characters) to control cost and keep collection efficient
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Cost Controls (UI only, not implemented yet) */}
        <div className="form-group">
          <label>Cost Controls <span className="badge-coming-soon">Coming Soon</span></label>
          <span className="help-text">
            Future feature: Set budget limits and automatically prefer cost-effective models or strategies.
          </span>

          <div className="checkbox-group disabled">
            <label className="checkbox-option disabled">
              <input type="checkbox" disabled />
              <div className="checkbox-label">
                <strong>Use Fast Models for Simple Tasks</strong>
                <span className="checkbox-description">
                  Automatically downgrade to cheaper models when appropriate
                </span>
              </div>
            </label>

            <label className="checkbox-option disabled">
              <input type="checkbox" disabled />
              <div className="checkbox-label">
                <strong>Limit Model Cost</strong>
                <span className="checkbox-description">
                  Only use models under a specific cost per call
                </span>
              </div>
            </label>
          </div>
        </div>

        <div className="info-box">
          <strong>ℹ️ About runtime & safety:</strong>
          <ul>
            <li><strong>Default settings work well</strong> for most workflows</li>
            <li><strong>Longer timeouts</strong> may be needed for debate or multi-stage strategies</li>
            <li><strong>PII filtering</strong> is recommended when processing user or production data</li>
            <li><strong>Truncation</strong> can reduce cost and help the collector focus on the most relevant content</li>
          </ul>
        </div>

        <div className="skip-section">
          <p>Most users can safely keep these defaults.</p>
          <button onClick={onNext} className="btn-secondary-outlined">
            Skip to Review & Export →
          </button>
        </div>
      </div>

      <div className="step-actions">
        <button onClick={onBack} className="btn-secondary">
          ← Back
        </button>
        <button onClick={onNext} className="btn-primary">
          Review & Generate →
        </button>
      </div>
    </div>
  );
}

export default Step5OperationalSettings;
