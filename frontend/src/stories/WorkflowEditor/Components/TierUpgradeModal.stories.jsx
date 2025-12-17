import { useState } from 'react';
import TierUpgradeModal from '../../../components/workflow-editor/components/TierUpgradeModal.jsx';
import { mockActiveAdvancedFeatures } from '../../mockData.js';

/**
 * TierUpgradeModal prompts users to upgrade from Basic to Advanced mode.
 * Shown when attempting to use Advanced features while in Basic tier.
 *
 * ## Features
 * - Feature-triggered upgrade prompts
 * - List of Advanced mode benefits
 * - Display of currently active advanced features
 * - Upgrade/Cancel actions
 */
export default {
  title: 'WorkflowEditor/Components/TierUpgradeModal',
  component: TierUpgradeModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Modal for upgrading from Basic to Advanced tier. Shows benefits and handles tier transition.'
      }
    }
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: '600px', background: 'rgba(0,0,0,0.05)', padding: '2rem' }}>
        <Story />
      </div>
    )
  ],
  tags: ['autodocs'],
  argTypes: {
    onUpgrade: { action: 'upgraded to advanced' },
    onCancel: { action: 'modal cancelled' }
  }
};

/**
 * Modal open and visible
 */
export const Open = {
  args: {
    isOpen: true,
    featureName: null,
    advancedFeatures: []
  },
  parameters: {
    docs: {
      description: {
        story: 'TierUpgradeModal in open state. Shows list of Advanced mode benefits and upgrade/cancel buttons.'
      }
    }
  }
};

/**
 * Modal closed (hidden)
 */
export const Closed = {
  args: {
    isOpen: false,
    featureName: null,
    advancedFeatures: []
  },
  parameters: {
    docs: {
      description: {
        story: 'TierUpgradeModal in closed state. Component returns null and renders nothing.'
      }
    }
  }
};

/**
 * Triggered by specific feature
 */
export const WithFeatureName = {
  args: {
    isOpen: true,
    featureName: 'Middleware Pipeline',
    advancedFeatures: []
  },
  parameters: {
    docs: {
      description: {
        story: 'Modal triggered by attempting to use a specific feature (Middleware Pipeline). Shows feature name in the message.'
      }
    }
  }
};

/**
 * With active advanced features listed
 */
export const WithActiveFeatures = {
  args: {
    isOpen: true,
    featureName: 'Column-wise Summary',
    advancedFeatures: mockActiveAdvancedFeatures
  },
  parameters: {
    docs: {
      description: {
        story: 'Modal showing currently active advanced features. Helps users understand what features they are already using.'
      }
    }
  }
};

/**
 * Interactive modal with open/close state
 */
export const Interactive = {
  render: function InteractiveTierUpgradeModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [hasAdvancedFeatures, setHasAdvancedFeatures] = useState(false);

    return (
      <div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          maxWidth: '400px',
          margin: '0 auto',
          padding: '2rem',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: 0 }}>Tier Upgrade Demo</h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Click buttons below to trigger the upgrade modal:
          </p>

          <button
            onClick={() => setIsOpen(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Open Modal (Simple)
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="has-features"
              checked={hasAdvancedFeatures}
              onChange={(e) => setHasAdvancedFeatures(e.target.checked)}
            />
            <label htmlFor="has-features" style={{ fontSize: '0.9rem', color: '#4b5563' }}>
              Show active advanced features
            </label>
          </div>
        </div>

        <TierUpgradeModal
          isOpen={isOpen}
          featureName="Interactive Demo Feature"
          advancedFeatures={hasAdvancedFeatures ? mockActiveAdvancedFeatures : []}
          onUpgrade={() => {
            console.log('Upgraded to Advanced');
            setIsOpen(false);
          }}
          onCancel={() => {
            console.log('Upgrade cancelled');
            setIsOpen(false);
          }}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Fully interactive TierUpgradeModal. Try opening/closing the modal and toggling the advanced features list.'
      }
    }
  }
};
