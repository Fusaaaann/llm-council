import { useState } from 'react';
import ModelSelect from '../../../components/workflow-editor/components/ModelSelect.jsx';
import { mockGlobalModels } from '../../mockData.js';

/**
 * ModelSelect is a dropdown component for selecting AI models.
 * It separates custom models from defaults into optgroups.
 *
 * ## Features
 * - User/default model separation
 * - Empty state with placeholder
 * - Required field support
 * - Flexible label customization
 */
export default {
  title: 'WorkflowEditor/Components/ModelSelect',
  component: ModelSelect,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Reusable model dropdown with user/default separation. Displays custom models first, followed by default models in separate optgroups.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'model changed' }
  }
};

// Default models only (no custom models)
const defaultModelsOnly = [
  {
    id: 'default_gpt4',
    label: 'GPT-4',
    modelRef: 'openai/gpt-4',
    isDefault: true
  },
  {
    id: 'default_gpt4_turbo',
    label: 'GPT-4 Turbo',
    modelRef: 'openai/gpt-4-turbo',
    isDefault: true
  },
  {
    id: 'default_claude_sonnet',
    label: 'Claude Sonnet',
    modelRef: 'anthropic/claude-3.5-sonnet',
    isDefault: true
  },
  {
    id: 'default_gemini_flash',
    label: 'Gemini Flash',
    modelRef: 'google/gemini-2.0-flash-exp',
    isDefault: true
  }
];

/**
 * Default models only
 */
export const DefaultModels = {
  args: {
    value: '',
    globalModels: defaultModelsOnly,
    label: 'Select Model',
    required: false
  },
  parameters: {
    docs: {
      description: {
        story: 'ModelSelect with only default models. Shows single optgroup for default models.'
      }
    }
  }
};

/**
 * With custom models (mix of default and custom)
 */
export const WithCustomModels = {
  args: {
    value: '',
    globalModels: mockGlobalModels,
    label: 'Chairman Model',
    required: false
  },
  parameters: {
    docs: {
      description: {
        story: 'ModelSelect with both custom and default models. Custom models appear first in a separate optgroup.'
      }
    }
  }
};

/**
 * Pre-selected value
 */
export const Selected = {
  args: {
    value: 'openai/gpt-4-turbo',
    globalModels: mockGlobalModels,
    label: 'Primary Model',
    required: false
  },
  parameters: {
    docs: {
      description: {
        story: 'ModelSelect with a pre-selected value (GPT-4 Turbo).'
      }
    }
  }
};

/**
 * Empty selection (placeholder shown)
 */
export const Empty = {
  args: {
    value: '',
    globalModels: mockGlobalModels,
    label: 'Choose Model',
    required: false
  },
  parameters: {
    docs: {
      description: {
        story: 'ModelSelect with no selection. Shows placeholder "Select a model..."'
      }
    }
  }
};

/**
 * Required field
 */
export const Required = {
  args: {
    value: '',
    globalModels: mockGlobalModels,
    label: 'Model (Required)',
    required: true
  },
  parameters: {
    docs: {
      description: {
        story: 'ModelSelect with required indicator (*). Shows asterisk next to label.'
      }
    }
  }
};

/**
 * Long label text
 */
export const LongLabel = {
  args: {
    value: 'anthropic/claude-3.5-sonnet',
    globalModels: mockGlobalModels,
    label: 'Select the AI model that will coordinate and synthesize all perspectives',
    required: true
  },
  parameters: {
    docs: {
      description: {
        story: 'ModelSelect with long label text. Tests text wrapping and layout.'
      }
    }
  }
};

/**
 * Interactive demo with state
 */
export const Interactive = {
  render: function InteractiveModelSelect() {
    const [selected, setSelected] = useState('');

    return (
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <ModelSelect
          value={selected}
          onChange={setSelected}
          globalModels={mockGlobalModels}
          label="Choose Model"
          required
        />
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: '#f7fafc',
          borderRadius: '4px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: '0.9rem', color: '#4a5568', marginBottom: '0.5rem' }}>
            <strong>Selected:</strong>
          </div>
          <div style={{ fontFamily: 'monospace', color: '#2d3748' }}>
            {selected || '(none)'}
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Fully interactive ModelSelect with state management. Try selecting different models to see the value update.'
      }
    }
  }
};
