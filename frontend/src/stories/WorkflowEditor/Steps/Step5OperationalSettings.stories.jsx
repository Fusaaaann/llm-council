import { useState } from 'react';
import Step5OperationalSettings from '../../../components/workflow-editor/steps/Step5OperationalSettings.jsx';
import { mockWizardStateBasic, mockWizardStateEmpty } from '../../mockData.js';

/**
 * Step5OperationalSettings - Runtime, safety & filters configuration
 *
 * This step component configures operational settings for workflow execution:
 * 1. Time Limits - Global workflow timeout (30-600 seconds)
 * 2. Delegate Output Filtering - PII removal, refusal filtering, truncation
 * 3. Cost Controls - (Coming soon) Cost optimization features
 *
 * Most users can safely keep the default settings. This step is optional for basic workflows.
 */
export default {
  title: 'WorkflowEditor/Steps/Step5OperationalSettings',
  component: Step5OperationalSettings,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Operational settings step for workflow runtime configuration. Includes timeout controls, output filtering (PII removal, refusal filtering, truncation), and future cost controls. Provides sensible defaults for most use cases.'
      }
    }
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        <Story />
      </div>
    )
  ],
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'state changed' },
    onNext: { action: 'next clicked' },
    onBack: { action: 'back clicked' }
  }
};

/**
 * Default - Default configuration
 */
export const Default = {
  args: {
    state: {
      ...mockWizardStateEmpty,
      globalTimeout: 120000, // 120 seconds
      filters: []
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Default state with 120-second workflow timeout and no filters enabled. Shows the recommended starting configuration.'
      }
    }
  }
};

/**
 * WithCustomTimeout - Custom timeout value
 */
export const WithCustomTimeout = {
  args: {
    state: {
      ...mockWizardStateEmpty,
      globalTimeout: 180000, // 180 seconds / 3 minutes
      filters: []
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Custom timeout set to 180 seconds (3 minutes). Useful for longer workflows with debate or multi-stage processing.'
      }
    }
  }
};

/**
 * WithAllFilters - All filters enabled
 */
export const WithAllFilters = {
  args: {
    state: {
      ...mockWizardStateEmpty,
      globalTimeout: 120000,
      filters: ['remove_pii', 'filter_refusals', 'truncate']
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'All three output filters enabled: PII removal, refusal filtering, and response truncation. Recommended for production workflows processing sensitive data.'
      }
    }
  }
};

/**
 * WithPIIFilter - Only PII removal enabled
 */
export const WithPIIFilter = {
  args: {
    state: {
      ...mockWizardStateEmpty,
      globalTimeout: 120000,
      filters: ['remove_pii']
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'PII removal filter enabled. Automatically redacts emails, phone numbers, and other identifiers from delegate outputs.'
      }
    }
  }
};

/**
 * WithRefusalFilter - Only refusal filtering enabled
 */
export const WithRefusalFilter = {
  args: {
    state: {
      ...mockWizardStateEmpty,
      globalTimeout: 120000,
      filters: ['filter_refusals']
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Refusal filter enabled. Flags or removes pure refusal responses (e.g., "I cannot help with that") before collection.'
      }
    }
  }
};

/**
 * CompleteConfiguration - Custom timeout + all filters
 */
export const CompleteConfiguration = {
  args: {
    state: {
      ...mockWizardStateEmpty,
      globalTimeout: 300000, // 300 seconds / 5 minutes
      filters: ['remove_pii', 'filter_refusals', 'truncate']
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete configuration with 5-minute timeout and all filters enabled. Suitable for complex, production workflows with strict safety requirements.'
      }
    }
  }
};

/**
 * Interactive - Fully interactive demo
 */
export const Interactive = {
  render: function InteractiveDemo() {
    const [state, setState] = useState({
      globalTimeout: 120000,
      filters: []
    });

    const handleChange = (updates) => {
      console.log('State updated:', updates);
      setState(prev => ({ ...prev, ...updates }));
    };

    const handleNext = () => {
      console.log('Next clicked - current state:', state);
      alert(`Operational settings:\n- Timeout: ${state.globalTimeout / 1000} seconds\n- Filters: ${state.filters.length > 0 ? state.filters.join(', ') : 'none'}`);
    };

    const handleBack = () => {
      console.log('Back clicked');
      alert('Going back to Step 4');
    };

    const handleSkip = () => {
      console.log('Skip clicked - using defaults');
      alert('Skipping to review with default settings');
    };

    return (
      <div>
        <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>Interactive Demo</h4>
          <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#666' }}>
            Adjust workflow timeout (30-600 seconds) and toggle output filters (PII removal, refusal filtering, truncation).
            Try the "Skip to Review" button to use default settings.
          </p>
          <div style={{ marginTop: '10px', fontSize: '12px', fontFamily: 'monospace', background: 'white', padding: '10px', borderRadius: '4px' }}>
            globalTimeout: {state.globalTimeout}ms ({state.globalTimeout / 1000}s)<br/>
            filters: [{state.filters.length > 0 ? state.filters.map(f => `"${f}"`).join(', ') : ''}]<br/>
            <br/>
            Active filters:<br/>
            {state.filters.includes('remove_pii') && '  ✓ PII removal\n'}
            {state.filters.includes('filter_refusals') && '  ✓ Refusal filtering\n'}
            {state.filters.includes('truncate') && '  ✓ Response truncation\n'}
            {state.filters.length === 0 && '  (none)'}
          </div>
        </div>

        <Step5OperationalSettings
          state={state}
          onChange={handleChange}
          onNext={handleNext}
          onBack={handleBack}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Fully interactive Step5OperationalSettings. Adjust timeout with number input (30-600 seconds), toggle individual filters, use skip button. See real-time state updates above.'
      }
    }
  }
};
