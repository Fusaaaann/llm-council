import { models } from '../../../workflowGenerator.js';
import {
  INTERACTION_MODES,
  DECISION_MAKER_TYPES,
  VISIBILITY_MODES,
  getStrategyDescription,
  getDefaultChairmanModel,
  strategySupportsFeature
} from '../utils/strategyTemplates.js';

const MODEL_OPTIONS = [
  { value: models.GPT4, label: 'GPT-4' },
  { value: models.GPT4_TURBO, label: 'GPT-4 Turbo' },
  { value: models.CLAUDE_SONNET, label: 'Claude Sonnet' },
  { value: models.GEMINI_FLASH, label: 'Gemini Flash' }
];

const INTERACTION_MODE_OPTIONS = [
  {
    value: INTERACTION_MODES.INDEPENDENT_SYNTHESIS,
    label: 'Independent → Chairman',
    icon: '🎯',
    description: 'Perspectives provide independent responses, then a chairman synthesizes them.'
  },
  {
    value: INTERACTION_MODES.DEBATE,
    label: 'Debate (Cross-Examination)',
    icon: '💬',
    description: 'Perspectives respond, then cross-examine each other through Q&A.'
  },
  {
    value: INTERACTION_MODES.BLIND_REVIEW,
    label: 'Blind Review',
    icon: '🔒',
    description: 'Perspectives provide responses anonymously to prevent brand bias.'
  },
  {
    value: INTERACTION_MODES.VOTING,
    label: 'Voting',
    icon: '🗳️',
    description: 'Perspectives vote, and majority opinion becomes the decision.'
  },
  {
    value: INTERACTION_MODES.MULTI_STAGE,
    label: 'Multi-Stage',
    icon: '🔄',
    description: 'Perspectives → Peer Review → Final Synthesis (3 stages).'
  }
];

function Step4DeliberationStrategy({ state, onChange, onNext, onBack }) {
  const interactionMode = state.interactionMode || INTERACTION_MODES.INDEPENDENT_SYNTHESIS;
  const decisionMaker = state.decisionMaker || { type: DECISION_MAKER_TYPES.CHAIRMAN };
  const visibilityMode = state.visibilityMode || VISIBILITY_MODES.FULL;

  // Auto-set chairman model if not set
  if (!decisionMaker.model && state.perspectives) {
    decisionMaker.model = getDefaultChairmanModel(state.perspectives);
  }

  const updateDecisionMaker = (field, value) => {
    onChange({
      decisionMaker: {
        ...decisionMaker,
        [field]: value
      }
    });
  };

  const supportsChairman = strategySupportsFeature(interactionMode, 'chairman_instructions');
  const supportsVisibility = strategySupportsFeature(interactionMode, 'visibility_controls');

  return (
    <div className="wizard-step step-deliberation-strategy">
      <div className="step-header">
        <h2>Step 4: How Delegates Collaborate & How We Collect the Answer</h2>
        <p className="step-description">
          Decide how delegates work together and how their answers are collected into one final answer.
        </p>
      </div>

      <div className="step-content">
        {/* Interaction Mode */}
        <div className="form-group">
          <label>How should delegates collaborate and be collected?</label>
          <div className="radio-group-cards">
            {INTERACTION_MODE_OPTIONS.map(mode => (
              <label key={mode.value} className="radio-card">
                <input
                  type="radio"
                  name="interactionMode"
                  value={mode.value}
                  checked={interactionMode === mode.value}
                  onChange={(e) => onChange({ interactionMode: e.target.value })}
                />
                <div className="radio-card-content">
                  <div className="radio-card-header">
                    <span className="radio-card-icon">{mode.icon}</span>
                    <strong>{mode.label}</strong>
                  </div>
                  <p>{mode.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Strategy Description */}
        <div className="strategy-info">
          <strong>How this workflow behaves:</strong>
          <p>{getStrategyDescription(interactionMode)}</p>
        </div>

        {/* Decision Maker (if supported) */}
        {supportsChairman && (
          <div className="form-group">
            <label>Who collects delegate answers and decides the final answer?</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="decisionMakerType"
                  value={DECISION_MAKER_TYPES.CHAIRMAN}
                  checked={decisionMaker.type === DECISION_MAKER_TYPES.CHAIRMAN}
                  onChange={(e) => updateDecisionMaker('type', e.target.value)}
                />
                <div className="radio-label">
                  <strong>Collector (Synthesis Model)</strong>
                  <span className="radio-description">
                    A separate LLM sees all delegate answers and synthesizes them into one final answer
                  </span>
                </div>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="decisionMakerType"
                  value={DECISION_MAKER_TYPES.MAJORITY_VOTE}
                  checked={decisionMaker.type === DECISION_MAKER_TYPES.MAJORITY_VOTE}
                  onChange={(e) => updateDecisionMaker('type', e.target.value)}
                />
                <div className="radio-label">
                  <strong>Majority Vote</strong>
                  <span className="radio-description">
                    Delegates vote, and the most common recommendation becomes the final answer
                  </span>
                </div>
              </label>
            </div>

            {/* Chairman Configuration */}
            {decisionMaker.type === DECISION_MAKER_TYPES.CHAIRMAN && (
              <div className="chairman-config">
                <div className="form-group">
                  <label>Collector Model</label>
                  <select
                    value={decisionMaker.model || ''}
                    onChange={(e) => updateDecisionMaker('model', e.target.value)}
                  >
                    {MODEL_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="help-text">
                    Typically a stronger or more reliable model than the delegates, used only to collect and decide the final answer.
                  </span>
                </div>

                <div className="form-group">
                  <label>
                    Collector Instructions <span className="optional">(optional)</span>
                  </label>
                  <textarea
                    value={decisionMaker.instructions || ''}
                    onChange={(e) => updateDecisionMaker('instructions', e.target.value)}
                    placeholder="e.g., Weigh safety over convenience. Resolve conflicts by preferring evidence-based arguments."
                    rows={3}
                  />
                  <span className="help-text">
                    Extra guidance for how the collector should compare delegate answers, resolve conflicts, and choose the final answer.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Visibility Controls (if supported) */}
        {supportsVisibility && (
          <div className="form-group">
            <label>What should delegates see of each other's answers?</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="visibilityMode"
                  value={VISIBILITY_MODES.FULL}
                  checked={visibilityMode === VISIBILITY_MODES.FULL}
                  onChange={(e) => onChange({ visibilityMode: e.target.value })}
                />
                <div className="radio-label">
                  <strong>Full Transparency</strong>
                  <span className="radio-description">
                    Delegates and the collector see all answers with delegate names shown
                  </span>
                </div>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="visibilityMode"
                  value={VISIBILITY_MODES.BLIND}
                  checked={visibilityMode === VISIBILITY_MODES.BLIND}
                  onChange={(e) => onChange({ visibilityMode: e.target.value })}
                />
                <div className="radio-label">
                  <strong>Blind Review</strong>
                  <span className="radio-description">
                    Answers are shown anonymously (Response A, B, C...) to reduce bias between delegates or models
                  </span>
                </div>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="visibilityMode"
                  value={VISIBILITY_MODES.PARTIAL}
                  checked={visibilityMode === VISIBILITY_MODES.PARTIAL}
                  onChange={(e) => onChange({ visibilityMode: e.target.value })}
                />
                <div className="radio-label">
                  <strong>Partial Visibility</strong>
                  <span className="radio-description">
                    Delegates only see current-stage answers, not full history; useful for multi-stage workflows
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="info-box">
          <strong>💡 Choosing how to collect and decide:</strong>
          <ul>
            <li><strong>Independent → Collector:</strong> Best default; each delegate answers, then a collector synthesizes</li>
            <li><strong>Debate:</strong> Use when you want delegates to question each other for deeper insight (slower)</li>
            <li><strong>Blind Review:</strong> Good when you want unbiased evaluation across models</li>
            <li><strong>Voting:</strong> Works well for clear yes/no or discrete options</li>
            <li><strong>Multi-Stage:</strong> Most thorough; for high-stakes or complex decisions</li>
          </ul>
        </div>
      </div>

      <div className="step-actions">
        <button onClick={onBack} className="btn-secondary">
          ← Back
        </button>
        <button onClick={onNext} className="btn-primary">
          Next: Runtime & Safety →
        </button>
      </div>
    </div>
  );
}

export default Step4DeliberationStrategy;
