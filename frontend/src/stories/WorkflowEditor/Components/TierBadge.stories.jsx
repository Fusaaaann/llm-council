import TierBadge from '../../../components/workflow-editor/components/TierBadge.jsx';

/**
 * TierBadge displays the current workflow wizard tier level (Basic or Advanced).
 * It provides visual feedback about which feature set is active.
 *
 * ## Features
 * - Visual tier indicator with icon
 * - Clickable variant for tier switching
 * - Hover tooltips
 */
export default {
  title: 'WorkflowEditor/Components/TierBadge',
  component: TierBadge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Visual indicator for the current workflow wizard tier (Basic or Advanced). Can be made clickable for tier switching.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    onClick: { action: 'badge clicked' }
  }
};

/**
 * Basic tier badge
 */
export const BasicTier = {
  args: {
    tier: 'basic'
  },
  parameters: {
    docs: {
      description: {
        story: 'Badge showing Basic Mode (🌱). Indicates simplified interface with essential features.'
      }
    }
  }
};

/**
 * Advanced tier badge
 */
export const AdvancedTier = {
  args: {
    tier: 'advanced'
  },
  parameters: {
    docs: {
      description: {
        story: 'Badge showing Advanced Mode (⚡). Indicates full control with all workflow features.'
      }
    }
  }
};

/**
 * Clickable badge (hoverable)
 */
export const Clickable = {
  args: {
    tier: 'basic',
    onClick: () => console.log('Tier badge clicked')
  },
  parameters: {
    docs: {
      description: {
        story: 'Clickable badge with hover effect. Used for tier switching functionality.'
      }
    }
  }
};

/**
 * Non-clickable badge (static)
 */
export const NonClickable = {
  args: {
    tier: 'advanced',
    onClick: undefined
  },
  parameters: {
    docs: {
      description: {
        story: 'Static badge without click handler. Used for display-only contexts.'
      }
    }
  }
};

/**
 * Badge in context of header
 */
export const InContext = {
  render: (args) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1rem',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      borderRadius: '8px',
      minWidth: '600px'
    }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Workflow Wizard</h3>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
          Step 3 of 6: Configure Perspectives
        </p>
      </div>
      <TierBadge {...args} />
    </div>
  ),
  args: {
    tier: 'advanced',
    onClick: () => console.log('Switch tier')
  },
  parameters: {
    docs: {
      description: {
        story: 'TierBadge shown in the context of a wizard header. Demonstrates how it appears alongside other UI elements.'
      }
    }
  }
};
