import { useState, useEffect } from 'react';
import Step1ProblemDefinition from './steps/Step1ProblemDefinition.jsx';
import Step2SuccessCriteria from './steps/Step2SuccessCriteria.jsx';
import Step3Perspectives from './steps/Step3Perspectives.jsx';
import Step4DeliberationStrategy from './steps/Step4DeliberationStrategy.jsx';
import Step4_5FollowUpSteps from './steps/Step4_5FollowUpSteps.jsx';
import Step4AdvancedFeatures from './steps/Step4AdvancedFeatures.jsx';
import Step5OperationalSettings from './steps/Step5OperationalSettings.jsx';
import Step5VariablesAndInterpolation from './steps/Step5VariablesAndInterpolation.jsx';
import Step6Optimization from './steps/Step6Optimization.jsx';
import Step6Review from './steps/Step6Review.jsx';
import TierBadge from './components/TierBadge.jsx';
import TierUpgradeModal from './components/TierUpgradeModal.jsx';
import TierDowngradeModal from './components/TierDowngradeModal.jsx';
import { INTERACTION_MODES } from './utils/strategyTemplates.js';
import { wizardToAdvancedConfig } from './utils/wizardTranslator.js';
import { generateWorkflowId } from './utils/workflowIdGenerator.js';
import { getDefaultModels } from './utils/defaultModels.js';
import { TIERS, detectTier, canDowngradeToBasic, getActiveAdvancedFeatures } from './utils/tierDetection.js';
import './WorkflowWizard.css';

// Basic Tier Steps (4 steps)
const BASIC_STEPS = [
  { id: 1, title: 'Workflow Goal', component: Step1ProblemDefinition },
  { id: 2, title: 'Answer Format & Variables', component: Step2SuccessCriteria },
  { id: 3, title: 'Delegates (AI Helpers)', component: Step3Perspectives },
  { id: 4, title: 'How to Collect & Decide', component: Step4DeliberationStrategy },
  // Step 5 (Follow-up) moved to Advanced tier
  // Step 6 (Runtime) moved to Advanced tier as part of Optimization
  { id: 5, title: 'Review & Export', component: Step6Review }
];

// Advanced Tier Steps (10 steps)
const ADVANCED_STEPS = [
  { id: 1, title: 'Workflow Goal', component: Step1ProblemDefinition },
  { id: 2, title: 'Answer Format & Variables', component: Step2SuccessCriteria },
  { id: 3, title: 'Delegates (AI Helpers)', component: Step3Perspectives },
  { id: 4, title: 'How to Collect & Decide', component: Step4DeliberationStrategy },
  { id: 5, title: 'Advanced Features', component: Step4AdvancedFeatures },
  { id: 6, title: 'Variables & Interpolation', component: Step5VariablesAndInterpolation },
  { id: 7, title: 'Optimization', component: Step6Optimization },
  { id: 8, title: 'Runtime & Safety', component: Step5OperationalSettings },
  { id: 9, title: 'Review & Export', component: Step6Review }
];

function WorkflowWizard({ onSave, onSwitchToAdvanced }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [currentTier, setCurrentTier] = useState(TIERS.BASIC);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [pendingAdvancedFeature, setPendingAdvancedFeature] = useState(null);

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
    globalModels: getDefaultModels(), // Global model library (NEW)

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
    followUpSteps: [], // Follow-up supersteps (NEW)

    // Step 5: Runtime & Safety
    globalTimeout: 120000,
    concurrencyLimit: null,
    filters: [],
    costControls: {},

    // Advanced Tier Fields
    middleware: [], // Middleware pipeline (Advanced)
    useColumnWiseSummary: false, // Column-wise reduction (Advanced)
    variables: [], // Custom variables (Advanced)
    variableInterpolation: false, // Variable interpolation (Advanced)
    scopeAlignment: { // Scope alignment (Advanced)
      enabled: false,
      coordinatorModel: '',
      scopeTimeout: 30000,
      alignmentTimeout: 60000
    },
    advancedVisibility: { // Advanced visibility controls
      includeRejectedItems: false,
      includeConversationHistory: true
    }
  });

  const updateWizardState = (updates) => {
    setWizardState(prev => ({ ...prev, ...updates }));
  };

  // Get current STEPS array based on tier
  const STEPS = currentTier === TIERS.BASIC ? BASIC_STEPS : ADVANCED_STEPS;

  // Auto-generate workflow ID when problem statement changes
  useEffect(() => {
    if (wizardState.problemStatement && !wizardState.workflowIdManuallySet) {
      const autoId = generateWorkflowId(wizardState.problemStatement);
      setWizardState(prev => ({ ...prev, workflowId: autoId }));
    }
  }, [wizardState.problemStatement]);

  // Auto-detect tier when state changes (optional - for auto-upgrade)
  useEffect(() => {
    const detectedTier = detectTier(wizardState);
    if (detectedTier === TIERS.ADVANCED && currentTier === TIERS.BASIC) {
      // User has added advanced features, but we stay in Basic until they explicitly upgrade
      // This is intentional - we don't auto-upgrade, we just detect
    }
  }, [wizardState, currentTier]);

  const goToStep = (step) => {
    if (step >= 1 && step <= STEPS.length) {
      setCurrentStep(step);
    }
  };

  // Tier transition handlers
  const handleTierUpgrade = () => {
    setCurrentTier(TIERS.ADVANCED);
    setShowUpgradeModal(false);
    setPendingAdvancedFeature(null);
    // Stay on current step, user can navigate to advanced steps
  };

  const handleTierDowngrade = () => {
    const { canDowngrade, blockers } = canDowngradeToBasic(wizardState);

    if (!canDowngrade) {
      // Show blockers in modal (modal will handle this)
      setShowDowngradeModal(true);
      return;
    }

    setCurrentTier(TIERS.BASIC);
    setShowDowngradeModal(false);

    // If current step is beyond Basic tier, move to last Basic step
    if (currentStep > BASIC_STEPS.length) {
      setCurrentStep(BASIC_STEPS.length);
    }
  };

  const triggerAdvancedFeature = (featureName) => {
    if (currentTier === TIERS.BASIC) {
      setPendingAdvancedFeature(featureName);
      setShowUpgradeModal(true);
    }
  };

  const handleTierBadgeClick = () => {
    if (currentTier === TIERS.ADVANCED) {
      // Show downgrade modal
      setShowDowngradeModal(true);
    } else {
      // Show info about upgrading
      setShowUpgradeModal(true);
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
      setCurrentTier(TIERS.BASIC); // Reset to Basic tier
      setWizardState({
        workflowId: '',
        problemStatement: '',
        audience: '',
        outputFormat: 'text_summary',
        customFormat: '',
        finalOutputVar: 'final_answer',
        qualities: ['accurate', 'balanced'],
        constraints: [],
        globalModels: getDefaultModels(),
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
        followUpSteps: [],
        globalTimeout: 120000,
        concurrencyLimit: null,
        filters: [],
        costControls: {},
        // Reset Advanced tier fields
        middleware: [],
        useColumnWiseSummary: false,
        variables: [],
        variableInterpolation: false,
        scopeAlignment: {
          enabled: false,
          coordinatorModel: '',
          scopeTimeout: 30000,
          alignmentTimeout: 60000
        },
        advancedVisibility: {
          includeRejectedItems: false,
          includeConversationHistory: true
        }
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
          <div className="wizard-title-row">
            <h1>🔮 Workflow Wizard</h1>
            <TierBadge tier={currentTier} onClick={handleTierBadgeClick} />
          </div>
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

      {/* Tier Modals */}
      <TierUpgradeModal
        isOpen={showUpgradeModal}
        onUpgrade={handleTierUpgrade}
        onCancel={() => {
          setShowUpgradeModal(false);
          setPendingAdvancedFeature(null);
        }}
        featureName={pendingAdvancedFeature || 'Advanced Features'}
      />

      <TierDowngradeModal
        isOpen={showDowngradeModal}
        onDowngrade={handleTierDowngrade}
        onCancel={() => setShowDowngradeModal(false)}
        blockers={canDowngradeToBasic(wizardState).blockers}
        canDowngrade={canDowngradeToBasic(wizardState).canDowngrade}
      />
    </div>
  );
}

export default WorkflowWizard;
