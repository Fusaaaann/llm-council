import { useState, useEffect } from 'react';
import Step1ProblemDefinition from './steps/Step1ProblemDefinition.jsx';
import Step2SuccessCriteria from './steps/Step2SuccessCriteria.jsx';
import Step3Perspectives from './steps/Step3Perspectives.jsx';
import Step4DeliberationStrategy from './steps/Step4DeliberationStrategy.jsx';
import Step5OperationalSettings from './steps/Step5OperationalSettings.jsx';
import Step6Review from './steps/Step6Review.jsx';
import { INTERACTION_MODES } from './utils/strategyTemplates.js';
import { wizardToAdvancedConfig } from './utils/wizardTranslator.js';
import { generateWorkflowId } from './utils/workflowIdGenerator.js';
import './WorkflowWizard.css';

const STEPS = [
  { id: 1, title: 'Workflow Goal', component: Step1ProblemDefinition },
  { id: 2, title: 'Answer Format & Variables', component: Step2SuccessCriteria },
  { id: 3, title: 'Delegates (AI Helpers)', component: Step3Perspectives },
  { id: 4, title: 'How to Collect & Decide', component: Step4DeliberationStrategy },
  { id: 5, title: 'Runtime & Safety', component: Step5OperationalSettings },
  { id: 6, title: 'Review & Export', component: Step6Review }
];

function WorkflowWizard({ onSave, onSwitchToAdvanced }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardState, setWizardState] = useState({
    // Step 1: Goal & Audience
    workflowId: '', // Auto-generated from problemStatement
    problemStatement: '',
    audience: '',

    // Step 2: Answer Format & Variables
    outputFormat: 'text_summary',
    customFormat: '',
    finalOutputVar: 'final_answer',
    qualities: ['accurate', 'balanced'],
    constraints: [],

    // Step 3: Delegates (AI Helpers)
    perspectives: [],
    defaultDelegateRole: '',

    // Step 4: How to Collect & Decide
    interactionMode: INTERACTION_MODES.INDEPENDENT_SYNTHESIS,
    decisionMaker: {
      type: 'chairman',
      model: null,
      instructions: ''
    },
    visibilityMode: 'full',
    collectTimeout: null,

    // Step 5: Runtime & Safety
    globalTimeout: 120000,
    concurrencyLimit: null,
    filters: [],
    costControls: {}
  });

  const updateWizardState = (updates) => {
    setWizardState(prev => ({ ...prev, ...updates }));
  };

  // Auto-generate workflow ID when problem statement changes
  useEffect(() => {
    if (wizardState.problemStatement && !wizardState.workflowIdManuallySet) {
      const autoId = generateWorkflowId(wizardState.problemStatement);
      setWizardState(prev => ({ ...prev, workflowId: autoId }));
    }
  }, [wizardState.problemStatement]);

  const goToStep = (step) => {
    if (step >= 1 && step <= STEPS.length) {
      setCurrentStep(step);
    }
  };

  const handleNext = () => {
    goToStep(currentStep + 1);
  };

  const handleBack = () => {
    goToStep(currentStep - 1);
  };

  const handleSave = async (workflowData) => {
    if (onSave) {
      await onSave(workflowData);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset the wizard? All progress will be lost.')) {
      setCurrentStep(1);
      setWizardState({
        workflowId: '',
        problemStatement: '',
        audience: '',
        outputFormat: 'text_summary',
        customFormat: '',
        finalOutputVar: 'final_answer',
        qualities: ['accurate', 'balanced'],
        constraints: [],
        perspectives: [],
        defaultDelegateRole: '',
        interactionMode: INTERACTION_MODES.INDEPENDENT_SYNTHESIS,
        decisionMaker: {
          type: 'chairman',
          model: null,
          instructions: ''
        },
        visibilityMode: 'full',
        collectTimeout: null,
        globalTimeout: 120000,
        concurrencyLimit: null,
        filters: [],
        costControls: {}
      });
    }
  };

  const handleSwitchToAdvanced = () => {
    if (onSwitchToAdvanced) {
      // Translate wizard state to advanced editor config
      const advancedConfig = wizardToAdvancedConfig(wizardState);
      onSwitchToAdvanced(advancedConfig);
    }
  };

  const CurrentStepComponent = STEPS[currentStep - 1].component;

  return (
    <div className="workflow-wizard">
      {/* Header */}
      <div className="wizard-header">
        <div className="wizard-title">
          <h1>🔮 Workflow Wizard</h1>
          <p>Build custom workflows with a guided, question-driven interface</p>
        </div>
        <div className="wizard-header-actions">
          {onSwitchToAdvanced && (
            <button onClick={handleSwitchToAdvanced} className="btn-link">
              Switch to Advanced Editor
            </button>
          )}
          <button onClick={handleReset} className="btn-link">
            Reset Wizard
          </button>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="wizard-progress">
        <div className="progress-steps">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`progress-step ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}
              onClick={() => goToStep(step.id)}
            >
              <div className="progress-step-number">
                {currentStep > step.id ? '✓' : step.id}
              </div>
              <div className="progress-step-title">{step.title}</div>
            </div>
          ))}
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Current Step */}
      <div className="wizard-body">
        <CurrentStepComponent
          state={wizardState}
          onChange={updateWizardState}
          onNext={handleNext}
          onBack={handleBack}
          onSave={handleSave}
        />
      </div>

      {/* Footer */}
      <div className="wizard-footer">
        <div className="wizard-footer-content">
          <span className="step-indicator">
            Step {currentStep} of {STEPS.length}
          </span>
          <span className="help-text">
            Need help? Check out the <a href="#docs">workflow documentation</a> or{' '}
            <a href="#examples">example workflows</a>.
          </span>
        </div>
      </div>
    </div>
  );
}

export default WorkflowWizard;
