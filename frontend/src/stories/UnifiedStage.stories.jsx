import UnifiedStage from '../components/UnifiedStage';
import {
  mockCouncilMessage,
  mockPartialCouncilMessage1,
  mockPartialCouncilMessage2,
  mockWorkflowMessage,
  mockPartialWorkflowMessage,
  mockQueryState,
  mockLoadingQueryState
} from './mockData';
import '../components/UnifiedStage.css';

/**
 * UnifiedStage component adaptively renders both Council and Workflow execution modes.
 *
 * ## Council Mode
 * Displays traditional 4-stage deliberation (Stage 1, 1.5, 2, 3) with tab navigation.
 *
 * ## Workflow Mode
 * Displays variable-based execution with worker perspectives and progress tracking.
 */
export default {
  title: 'Components/UnifiedStage',
  component: UnifiedStage,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Auto-detecting component that renders council deliberations or workflow executions based on message structure.'
      }
    }
  },
  tags: ['autodocs']
};

// ========== COUNCIL MODE STORIES ==========

/**
 * Council mode showing only Stage 1 (initial responses).
 * This represents an in-progress deliberation.
 */
export const CouncilStage1Only = {
  args: {
    message: mockPartialCouncilMessage1,
    queryState: {
      stages: {
        stage1: { status: 'complete' },
        stage1_5: { status: 'pending' },
        stage2: { status: 'pending' },
        stage3: { status: 'pending' }
      }
    },
    isLoading: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Partial council execution showing only Stage 1 initial responses from three models.'
      }
    }
  }
};

/**
 * Council mode showing Stage 1 and Stage 2 (rankings).
 * Stage 3 synthesis is still pending.
 */
export const CouncilStage1And2 = {
  args: {
    message: mockPartialCouncilMessage2,
    queryState: {
      stages: {
        stage1: { status: 'complete' },
        stage1_5: { status: 'complete' },
        stage2: { status: 'complete' },
        stage3: { status: 'pending' }
      }
    },
    isLoading: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Partial council execution with Stage 1 responses and Stage 2 peer rankings.'
      }
    }
  }
};

/**
 * Complete council execution with all 4 stages:
 * - Stage 1: Initial responses
 * - Stage 1.5: Cross-interrogation
 * - Stage 2: Peer review rankings
 * - Stage 3: Chairman synthesis
 */
export const CouncilComplete = {
  args: {
    message: mockCouncilMessage,
    queryState: mockQueryState,
    isLoading: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete council deliberation showing all stages including cross-interrogation and final synthesis.'
      }
    }
  }
};

/**
 * Council in loading state during Stage 1.5 (cross-interrogation).
 */
export const CouncilLoading = {
  args: {
    message: mockPartialCouncilMessage1,
    queryState: mockLoadingQueryState,
    isLoading: true
  },
  parameters: {
    docs: {
      description: {
        story: 'Council execution in progress, showing loading indicator during Stage 1.5.'
      }
    }
  }
};

// ========== WORKFLOW MODE STORIES ==========

/**
 * Complete workflow execution with final output and worker perspectives.
 * Shows the perspective matrix pattern with multiple viewpoints.
 */
export const WorkflowComplete = {
  args: {
    message: mockWorkflowMessage,
    queryState: null,
    isLoading: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete workflow execution showing final output, worker perspectives (security, UX, performance), and all variables.'
      }
    }
  }
};

/**
 * Partial workflow execution showing progress indicator.
 */
export const WorkflowInProgress = {
  args: {
    message: mockPartialWorkflowMessage,
    queryState: null,
    isLoading: true
  },
  parameters: {
    docs: {
      description: {
        story: 'Workflow execution in progress, showing step 1 of 2 with progress bar.'
      }
    }
  }
};

/**
 * Workflow with expanded worker perspectives section.
 * Demonstrates how different models analyze from different angles.
 */
export const WorkflowWithPerspectives = {
  args: {
    message: mockWorkflowMessage,
    queryState: null,
    isLoading: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Workflow showing worker perspectives section, demonstrating multi-perspective analysis (security, UX, performance).'
      }
    }
  }
};

// ========== COMPARISON STORIES ==========

/**
 * Side-by-side comparison of council vs workflow modes.
 * Useful for understanding the visual differences.
 */
export const CouncilVsWorkflow = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      <div>
        <h3 style={{ marginBottom: '1rem', color: '#333' }}>Council Mode</h3>
        <UnifiedStage
          message={mockCouncilMessage}
          queryState={mockQueryState}
          isLoading={false}
        />
      </div>
      <div>
        <h3 style={{ marginBottom: '1rem', color: '#333' }}>Workflow Mode</h3>
        <UnifiedStage
          message={mockWorkflowMessage}
          queryState={null}
          isLoading={false}
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Side-by-side comparison showing how UnifiedStage adapts its UI for council vs workflow execution modes.'
      }
    }
  }
};
