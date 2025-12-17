/**
 * TierUpgradeModal - Modal for upgrading from Basic to Advanced tier
 * Shows when user tries to use Advanced features while in Basic tier
 */

import { TIERS } from '../utils/tierDetection.js';

function TierUpgradeModal({
  isOpen,
  onUpgrade,
  onCancel,
  featureName,
  advancedFeatures = []
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content tier-upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚡ Upgrade to Advanced Mode?</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          <p className="upgrade-message">
            {featureName
              ? `"${featureName}" requires Advanced Mode.`
              : 'This feature requires Advanced Mode.'
            }
          </p>

          <div className="upgrade-benefits">
            <h3>Advanced Mode includes:</h3>
            <ul>
              <li>
                <strong>Multi-step workflows</strong> - Chain multiple processing stages together
              </li>
              <li>
                <strong>Middleware pipeline</strong> - Filter, transform, and refine outputs
              </li>
              <li>
                <strong>Variable interpolation</strong> - Reference outputs in later steps
              </li>
              <li>
                <strong>Scope alignment</strong> - Prevent role drift in complex workflows
              </li>
              <li>
                <strong>Advanced visibility controls</strong> - Fine-tune what models see
              </li>
              <li>
                <strong>Per-perspective summaries</strong> - Column-wise reduction strategy
              </li>
            </ul>
          </div>

          {advancedFeatures.length > 0 && (
            <div className="active-features">
              <p className="info-text">
                <strong>Currently active advanced features:</strong>
              </p>
              <ul>
                {advancedFeatures.map((feature, idx) => (
                  <li key={idx}>{feature}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button onClick={onUpgrade} className="btn-primary">
            Upgrade to Advanced Mode
          </button>
        </div>
      </div>
    </div>
  );
}

export default TierUpgradeModal;
