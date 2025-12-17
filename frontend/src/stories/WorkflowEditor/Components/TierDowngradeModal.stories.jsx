import { useState } from 'react';
import TierDowngradeModal from '../../../components/workflow-editor/components/TierDowngradeModal.jsx';
import { mockTierBlockers } from '../../mockData.js';

/**
 * TierDowngradeModal prompts users when attempting to downgrade from Advanced to Basic.
 * Prevents downgrade if advanced features are in use.
 *
 * ## Features
 * - Blocker detection and display
 * - Downgrade prevention when features are active
 * - Downgrade/Cancel actions
 */
export default {
  title: 'WorkflowEditor/Components/TierDowngradeModal',
  component: TierDowngradeModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Modal for downgrading from Advanced to Basic tier. Prevents downgrade when advanced features are in use.'
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
    onDowngrade: { action: 'downgraded to basic' },
    onCancel: { action: 'modal cancelled' }
  }
};

/**
 * Can downgrade (no blockers)
 */
export const CanDowngrade = {
  args: {
    isOpen: true,
    blockers: []
  },
  parameters: {
    docs: {
      description: {
        story: 'Modal allowing downgrade. No advanced features are blocking the transition to Basic tier.'
      }
    }
  }
};

/**
 * Has blockers (downgrade prevented)
 */
export const HasBlockers = {
  args: {
    isOpen: true,
    blockers: mockTierBlockers
  },
  parameters: {
    docs: {
      description: {
        story: 'Modal preventing downgrade. Shows list of advanced features that must be removed first.'
      }
    }
  }
};

/**
 * Single blocker
 */
export const SingleBlocker = {
  args: {
    isOpen: true,
    blockers: ['Middleware operations are configured']
  },
  parameters: {
    docs: {
      description: {
        story: 'Modal with a single blocking feature. User must remove middleware before downgrading.'
      }
    }
  }
};

/**
 * Multiple blockers
 */
export const MultipleBlockers = {
  args: {
    isOpen: true,
    blockers: [
      'Follow-up steps are configured',
      'Middleware operations are configured',
      'Scope alignment is enabled'
    ]
  },
  parameters: {
    docs: {
      description: {
        story: 'Modal with multiple blocking features. Shows all features that prevent downgrade.'
      }
    }
  }
};

/**
 * Interactive modal with state
 */
export const Interactive = {
  render: function InteractiveTierDowngradeModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [blockerCount, setBlockerCount] = useState(0);

    const getBlockers = () => {
      if (blockerCount === 0) return [];
      return mockTierBlockers.slice(0, blockerCount);
    };

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
          <h3 style={{ margin: 0 }}>Tier Downgrade Demo</h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Configure blockers and test the downgrade modal:
          </p>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#4b5563' }}>
              Number of blockers: {blockerCount}
            </label>
            <input
              type="range"
              min="0"
              max={mockTierBlockers.length}
              value={blockerCount}
              onChange={(e) => setBlockerCount(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <button
            onClick={() => setIsOpen(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: blockerCount > 0 ? '#ef4444' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Open Modal ({blockerCount > 0 ? 'Blocked' : 'Allowed'})
          </button>
        </div>

        <TierDowngradeModal
          isOpen={isOpen}
          blockers={getBlockers()}
          onDowngrade={() => {
            console.log('Downgraded to Basic');
            setIsOpen(false);
          }}
          onCancel={() => {
            console.log('Downgrade cancelled');
            setIsOpen(false);
          }}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Fully interactive TierDowngradeModal. Adjust the blocker count and open the modal to see how it behaves.'
      }
    }
  }
};
