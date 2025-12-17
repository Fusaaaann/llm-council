/**
 * TierDowngradeModal - Modal for downgrading from Advanced to Basic tier
 * Shows warnings if advanced features are in use
 */

function TierDowngradeModal({
  isOpen,
  onDowngrade,
  onCancel,
  blockers = []
}) {
  if (!isOpen) return null;

  const canDowngrade = blockers.length === 0;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content tier-downgrade-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🌱 Downgrade to Basic Mode?</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          {canDowngrade ? (
            <>
              <p className="downgrade-message">
                Switching to Basic Mode will simplify the interface and hide advanced features.
              </p>
              <p className="info-text">
                You can always upgrade back to Advanced Mode later if needed.
              </p>
            </>
          ) : (
            <>
              <p className="warning-message">
                ⚠ Cannot downgrade to Basic Mode while advanced features are in use.
              </p>
              <div className="blockers-list">
                <h3>The following features must be removed first:</h3>
                <ul>
                  {blockers.map((blocker, idx) => (
                    <li key={idx}>{blocker}</li>
                  ))}
                </ul>
              </div>
              <p className="info-text">
                Remove these features or stay in Advanced Mode.
              </p>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onCancel} className="btn-secondary">
            {canDowngrade ? 'Cancel' : 'Close'}
          </button>
          {canDowngrade && (
            <button onClick={onDowngrade} className="btn-primary">
              Downgrade to Basic Mode
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TierDowngradeModal;
