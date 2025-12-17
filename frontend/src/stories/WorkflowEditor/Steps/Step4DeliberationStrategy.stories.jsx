import { useState } from 'react';
import Step4DeliberationStrategy from '../../../components/workflow-editor/steps/Step4DeliberationStrategy.jsx';
import { mockWizardStateBasic, mockGlobalModels } from '../../mockData.js';

/**
 * Step4DeliberationStrategy - Fourth wizard step for configuring collaboration strategy
 *
 * This step configures:
 * 1. Interaction mode (Independent, Debate, Blind Review, Voting, Multi-Stage)
 * 2. Decision maker type (Chairman vs Majority Vote)
 * 3. Chairman model and instructions (if Chairman selected)
 * 4. Visibility mode (Full, Blind, Partial) - if supported by interaction mode
 *
 * Different interaction modes support different features. For example, only some
 * modes support chairman instructions or visibility controls.
 */
export default {
  title: 'WorkflowEditor/Steps/Step4DeliberationStrategy',
  component: Step4DeliberationStrategy,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Fourth wizard step for choosing how perspectives collaborate and make final decisions. Supports 5 interaction modes with varying feature availability.'
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
 * Independent synthesis - Default mode with chairman
 */
export const IndependentSynthesis = {
  args: {
    state: {
      ...mockWizardStateBasic,
      interactionMode: 'independent_synthesis',
      decisionMaker: {
        type: 'chairman',
        model: 'openai/gpt-4o'
      },
      visibilityMode: 'full'
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Independent → Chairman mode (default). Perspectives provide independent responses, then a chairman synthesizes them. Fastest option, best default.'
      }
    }
  }
};

/**
 * Debate mode - Cross-examination strategy
 */
export const DebateMode = {
  args: {
    state: {
      ...mockWizardStateBasic,
      interactionMode: 'debate',
      decisionMaker: {
        type: 'chairman',
        model: 'anthropic/claude-3.5-sonnet'
      },
      visibilityMode: 'full'
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Debate (Cross-Examination) mode. Perspectives respond, then cross-examine each other through Q&A. Provides deeper insight but slower than independent mode.'
      }
    }
  }
};

/**
 * Blind review - Anonymous review mode
 */
export const BlindReview = {
  args: {
    state: {
      ...mockWizardStateBasic,
      interactionMode: 'blind_review',
      decisionMaker: {
        type: 'chairman',
        model: 'openai/gpt-4o'
      },
      visibilityMode: 'blind'
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Blind Review mode with blind visibility. Perspectives provide responses anonymously to prevent brand bias. Ensures unbiased evaluation.'
      }
    }
  }
};

/**
 * Voting mode - Majority vote strategy
 */
export const VotingMode = {
  args: {
    state: {
      ...mockWizardStateBasic,
      interactionMode: 'voting',
      decisionMaker: {
        type: 'majority_vote'
      },
      visibilityMode: 'full'
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Voting mode with majority vote decision maker. Perspectives vote, and majority opinion becomes the decision. No chairman synthesis needed.'
      }
    }
  }
};

/**
 * Multi-stage - Multi-stage workflow
 */
export const MultiStage = {
  args: {
    state: {
      ...mockWizardStateBasic,
      interactionMode: 'multi_stage',
      decisionMaker: {
        type: 'chairman',
        model: 'openai/gpt-4o',
        instructions: 'Weigh safety over convenience. Resolve conflicts by preferring evidence-based arguments.'
      },
      visibilityMode: 'partial'
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Multi-Stage mode (3 stages): Perspectives → Peer Review → Final Synthesis. Shows chairman instructions and partial visibility mode for multi-stage workflows.'
      }
    }
  }
};

/**
 * With chairman - Chairman configuration visible
 */
export const WithChairman = {
  args: {
    state: {
      ...mockWizardStateBasic,
      interactionMode: 'independent_synthesis',
      decisionMaker: {
        type: 'chairman',
        model: 'anthropic/claude-3.5-sonnet',
        instructions: 'Prioritize practical implementation over theoretical perfection. Consider cost-benefit tradeoffs carefully.'
      },
      visibilityMode: 'full'
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Independent mode with chairman configuration showing model selection and custom instructions. Instructions guide how the chairman compares answers and resolves conflicts.'
      }
    }
  }
};

/**
 * With visibility controls - Visibility mode selector
 */
export const WithVisibilityControls = {
  args: {
    state: {
      ...mockWizardStateBasic,
      interactionMode: 'debate',
      decisionMaker: {
        type: 'chairman',
        model: 'openai/gpt-4o'
      },
      visibilityMode: 'blind'
    },
    onChange: () => {},
    onNext: () => {},
    onBack: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Debate mode showing visibility controls. Three options: Full Transparency, Blind Review, and Partial Visibility. Blind visibility selected to reduce bias.'
      }
    }
  }
};

/**
 * Interactive - Full strategy selection
 */
export const Interactive = {
  render: function InteractiveDemo() {
    const [state, setState] = useState({
      ...mockWizardStateBasic,
      interactionMode: 'independent_synthesis',
      decisionMaker: {
        type: 'chairman',
        model: 'openai/gpt-4o',
        instructions: ''
      },
      visibilityMode: 'full'
    });

    const handleChange = (updates) => {
      console.log('State updated:', updates);
      setState(prev => ({ ...prev, ...updates }));
    };

    const handleNext = () => {
      console.log('Next clicked - current state:', state);
      alert('Moving to next step with:\n' +
        `Mode: ${state.interactionMode}\n` +
        `Decision Maker: ${state.decisionMaker.type}\n` +
        `Visibility: ${state.visibilityMode}`
      );
    };

    const handleBack = () => {
      console.log('Back clicked');
      alert('Going back to Step 3');
    };

    return (
      <div>
        <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>Interactive Demo</h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
            Try different interaction modes and watch how the available options change.
            Some modes support chairman instructions and visibility controls, while others don't.
            Check the Actions panel for onChange events.
          </p>
          <div style={{ marginTop: '10px', fontSize: '12px', fontFamily: 'monospace', background: 'white', padding: '10px', borderRadius: '4px' }}>
            interactionMode: {state.interactionMode}<br/>
            decisionMaker.type: {state.decisionMaker.type}<br/>
            decisionMaker.model: {state.decisionMaker.model || '(none)'}<br/>
            visibilityMode: {state.visibilityMode}
          </div>
        </div>

        <Step4DeliberationStrategy
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
        story: 'Fully interactive Step 4. Switch between interaction modes, configure chairman settings, and adjust visibility. Notice how available features change based on selected mode.'
      }
    }
  }
};
