import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Stage1 from './Stage1';
import Stage1_5 from './Stage1_5';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import { detectExecutionMode, getDisplayData, EXECUTION_MODE } from '../utils/messageDetection';
import { STAGES } from '../stageConfig';
import './UnifiedStage.css';

/**
 * UnifiedStage - Adaptive component that renders both council and workflow executions
 *
 * This component automatically detects the execution mode and renders appropriate UI:
 * - Council mode: Traditional stage1/2/3 display with tabs
 * - Workflow mode: Variable-based display with superstep progress
 */
export default function UnifiedStage({ message, queryState, isLoading }) {
  const [expandedVariables, setExpandedVariables] = useState(false);
  const [activeStageTab, setActiveStageTab] = useState(0);

  if (!message || message.role !== 'assistant') {
    return null;
  }

  // Detect execution mode
  const displayData = getDisplayData(message);
  const mode = displayData.mode;

  // Unknown mode - don't render anything
  if (mode === EXECUTION_MODE.UNKNOWN) {
    return null;
  }

  // COUNCIL MODE: Render traditional stages
  if (mode === EXECUTION_MODE.COUNCIL) {
    // Build list of available stages
    const availableStages = STAGES.map((stageConfig, index) => ({
      config: stageConfig,
      index,
      hasData: message[stageConfig.messageField],
      isLoading: queryState?.stages[stageConfig.name]?.status === 'loading'
    })).filter(stage => stage.hasData || stage.isLoading);

    // Ensure activeStageTab is within bounds
    const safeActiveTab = Math.min(activeStageTab, availableStages.length - 1);

    return (
      <div className="unified-stage council-mode">
        <div className="execution-mode-label">
          <span className="mode-badge council">LLM Council</span>
        </div>

        {/* Top-level stage tabs */}
        {availableStages.length > 0 && (
          <div className="stage-tabs">
            {availableStages.map((stage, idx) => (
              <button
                key={stage.config.name}
                className={`stage-tab ${safeActiveTab === idx ? 'active' : ''} ${stage.isLoading ? 'loading' : ''}`}
                onClick={() => setActiveStageTab(idx)}
              >
                {stage.config.label}
                {stage.isLoading && <span className="loading-indicator">⏳</span>}
              </button>
            ))}
          </div>
        )}

        {/* Render active stage */}
        {availableStages.length > 0 && (
          <div className="stage-tab-content">
            {availableStages[safeActiveTab].isLoading && (
              <div className="stage-loading">
                <div className="spinner"></div>
                <span>{availableStages[safeActiveTab].config.label}: {availableStages[safeActiveTab].config.loadingMessage}</span>
              </div>
            )}

            {availableStages[safeActiveTab].hasData &&
              renderCouncilStage(availableStages[safeActiveTab].config.name, message)}
          </div>
        )}
      </div>
    );
  }

  // WORKFLOW MODE: Render workflow results
  if (mode === EXECUTION_MODE.WORKFLOW) {
    const { variables, workerOutputs, metadata, finalOutput } = displayData;
    const variableNames = Object.keys(variables);
    const workflowId = metadata?.workflow_id || 'Unknown Workflow';
    const currentStep = metadata?.completed_steps || 0;
    const totalSteps = metadata?.total_steps || 0;

    return (
      <div className="unified-stage workflow-mode">
        <div className="execution-mode-label">
          <span className="mode-badge workflow">⚙️ Workflow Execution</span>
          {metadata && (
            <span className="workflow-name">{workflowId}</span>
          )}
        </div>

        {/* Progress indicator */}
        {metadata && totalSteps > 0 && (
          <div className="workflow-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
            <div className="progress-text">
              Step {currentStep} of {totalSteps}
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="stage-loading">
            <div className="spinner"></div>
            <span>Processing workflow...</span>
          </div>
        )}

        {/* Final output (highlighted) */}
        {finalOutput && (
          <div className="workflow-final-output">
            <h3 className="output-title">Final Output</h3>
            <div className="output-content markdown-content">
              <ReactMarkdown>{finalOutput}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Worker Perspectives (collapsible) */}
        {workerOutputs && Object.keys(workerOutputs).length > 0 && (
          <WorkerPerspectivesSection workerOutputs={workerOutputs} />
        )}

        {/* All variables (collapsible) */}
        {variableNames.length > 0 && (
          <div className="workflow-variables">
            <button
              className="variables-header"
              onClick={() => setExpandedVariables(!expandedVariables)}
            >
              <span className="section-title">
                📊 View All Variables ({variableNames.length})
              </span>
              <span className="toggle-icon">
                {expandedVariables ? '▼' : '▶'}
              </span>
            </button>

            {expandedVariables && (
              <div className="variables-content">
                {variableNames.map((varName, index) => {
                  const value = variables[varName];
                  const isString = typeof value === 'string';
                  const isFinalOutput = index === variableNames.length - 1;

                  return (
                    <div key={varName} className={`variable-item ${isFinalOutput ? 'final' : ''}`}>
                      <div className="variable-name">
                        {varName}
                        {isFinalOutput && <span className="final-badge">Final Output</span>}
                      </div>
                      <div className="variable-value">
                        {isString ? (
                          <div className="markdown-content">
                            <ReactMarkdown>{value}</ReactMarkdown>
                          </div>
                        ) : (
                          <pre className="json-content">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}

/**
 * Render a council stage component with appropriate props
 */
function renderCouncilStage(stageName, message) {
  switch (stageName) {
    case 'stage1':
      return <Stage1 responses={message.stage1} />;

    case 'stage1_5':
      return (
        <Stage1_5
          interrogationData={message.stage1_5}
          labelToModel={message.stage1_5?.label_to_model}
        />
      );

    case 'stage2':
      return (
        <Stage2
          rankings={message.stage2}
          labelToModel={message.metadata?.label_to_model}
          aggregateRankings={message.metadata?.aggregate_rankings}
        />
      );

    case 'stage3':
      return <Stage3 finalResponse={message.stage3} />;

    default:
      return null;
  }
}

/**
 * WorkerPerspectivesSection - Display worker perspectives grouped by superstep
 */
function WorkerPerspectivesSection({ workerOutputs }) {
  const [expandedSteps, setExpandedSteps] = useState({});
  const [activeWorkerTabs, setActiveWorkerTabs] = useState({});

  const toggleStep = (stepId) => {
    setExpandedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };

  const setActiveWorker = (stepId, index) => {
    setActiveWorkerTabs(prev => ({
      ...prev,
      [stepId]: index
    }));
  };

  const stepIds = Object.keys(workerOutputs);
  if (stepIds.length === 0) return null;

  return (
    <div className="worker-perspectives">
      <div className="perspectives-header">
        <h3 className="section-title">👥 Worker Perspectives</h3>
      </div>

      {stepIds.map(stepId => {
        const workers = workerOutputs[stepId];
        if (!workers || workers.length === 0) return null;

        const isExpanded = expandedSteps[stepId] || false;
        const activeTab = activeWorkerTabs[stepId] || 0;

        return (
          <div key={stepId} className="superstep-section">
            <button
              className="superstep-header"
              onClick={() => toggleStep(stepId)}
            >
              <span className="superstep-title">
                Superstep: {stepId} ({workers.length} workers)
              </span>
              <span className="toggle-icon">
                {isExpanded ? '▼' : '▶'}
              </span>
            </button>

            {isExpanded && (
              <div className="superstep-content">
                <div className="worker-tabs">
                  {workers.map((worker, index) => {
                    const modelName = worker.model_ref?.split('/')[1] || worker.model_ref || `Worker ${index + 1}`;
                    return (
                      <button
                        key={index}
                        className={`worker-tab ${activeTab === index ? 'active' : ''}`}
                        onClick={() => setActiveWorker(stepId, index)}
                      >
                        {modelName}
                      </button>
                    );
                  })}
                </div>

                <div className="worker-content">
                  {workers[activeTab] && (
                    <>
                      <div className="worker-model-name">
                        {workers[activeTab].model_ref || 'Unknown Model'}
                      </div>
                      {workers[activeTab].role_definition && (
                        <div className="worker-role">
                          <strong>Role:</strong> {workers[activeTab].role_definition}
                        </div>
                      )}
                      <div className="worker-response markdown-content">
                        <ReactMarkdown>{workers[activeTab].response || 'No response'}</ReactMarkdown>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
