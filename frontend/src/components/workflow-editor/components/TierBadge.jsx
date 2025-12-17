/**
 * TierBadge - Display current tier level with visual indicator
 */

import { TIERS } from '../utils/tierDetection.js';

const TIER_CONFIG = {
  [TIERS.BASIC]: {
    label: 'Basic Mode',
    icon: '🌱',
    className: 'tier-badge-basic',
    description: 'Simplified interface with essential features'
  },
  [TIERS.ADVANCED]: {
    label: 'Advanced Mode',
    icon: '⚡',
    className: 'tier-badge-advanced',
    description: 'Full control with all workflow features'
  }
};

function TierBadge({ tier, onClick }) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG[TIERS.BASIC];

  return (
    <div
      className={`tier-badge ${config.className} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      title={config.description}
    >
      <span className="tier-icon">{config.icon}</span>
      <span className="tier-label">{config.label}</span>
    </div>
  );
}

export default TierBadge;
