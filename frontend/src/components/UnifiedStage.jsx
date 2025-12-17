import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Stage1 from './Stage1';
import Stage1_5 from './Stage1_5';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import StructuredDataDisplay from './StructuredDataDisplay';
import { getDisplayData, EXECUTION_MODE, shouldUseStructuredRenderer, prepareForStructuredRenderer } from '../utils/messageDetection';
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
  const [userSelectedTab, setUserSelectedTab] = useState(null);

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

    // Default to latest stage if user hasn't selected a tab
    const activeStageTab = userSelectedTab !== null
      ? Math.min(userSelectedTab, availableStages.length - 1)
      : Math.max(0, availableStages.length - 1);

    // Ensure activeStageTab is within bounds
    const safeActiveTab = Math.max(0, activeStageTab);

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
                onClick={() => setUserSelectedTab(idx)}
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
    const { variables, workerOutputs, superstepResults, metadata, finalOutput } = displayData;

    // Filter out variables that are already displayed in reducer section
    const displayedInReducer = new Set(
      (superstepResults || []).map(r => r.output_variable)
    );
    const variableNames = Object.keys(variables).filter(
      key => !displayedInReducer.has(key)
    );

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
        <div className="workflow-final-output">
          <h3 className="output-title">Final Output</h3>
          {finalOutput ? (
            <div className="output-content">
              {/* Check if finalOutput is a leaderboard object */}
              {finalOutput.type === 'leaderboard' && finalOutput.data ? (
                <LeaderboardDisplay data={finalOutput.data} />
              ) : typeof finalOutput === 'object' && isLeaderboardData(finalOutput) ? (
                <LeaderboardDisplay data={finalOutput} />
              ) : shouldUseStructuredRenderer(finalOutput) ? (
                <StructuredDataDisplay
                  data={prepareForStructuredRenderer(finalOutput)}
                  theme="blue"
                  maxDepth={3}
                  showRawToggle={true}
                />
              ) : typeof finalOutput === 'string' ? (
                <div className="markdown-content">
                  <ReactMarkdown>{finalOutput}</ReactMarkdown>
                </div>
              ) : (
                <div className="markdown-content">
                  <ReactMarkdown>{finalOutput}</ReactMarkdown>
                </div>
              )}
            </div>
          ) : isLoading ? (
            <div className="output-placeholder">
              <div className="placeholder-spinner"></div>
              <span>Generating final output...</span>
            </div>
          ) : (
            <div className="output-placeholder empty">
              <span>No final output generated</span>
            </div>
          )}
        </div>

        {/* Supersteps (unified worker + reducer view) */}
        {((workerOutputs && Object.keys(workerOutputs).length > 0) ||
          (superstepResults && superstepResults.length > 0)) && (
          <SuperstepsSection
            workerOutputs={workerOutputs}
            superstepResults={superstepResults}
          />
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
                  const isLeaderboard = isLeaderboardData(value);

                  return (
                    <div key={varName} className={`variable-item ${isFinalOutput ? 'final' : ''} ${isLeaderboard ? 'leaderboard' : ''}`}>
                      <div className="variable-name">
                        {varName}
                        {isFinalOutput && <span className="final-badge">Final Output</span>}
                        {isLeaderboard && <span className="leaderboard-badge">🏆 Leaderboard</span>}
                      </div>
                      <div className="variable-value">
                        {isLeaderboard ? (
                          <LeaderboardDisplay data={value} />
                        ) : shouldUseStructuredRenderer(value) ? (
                          <StructuredDataDisplay
                            data={prepareForStructuredRenderer(value)}
                            theme="blue"
                            maxDepth={3}
                            showRawToggle={true}
                          />
                        ) : isString ? (
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
 * Helper: Check if a value is leaderboard data
 */
function isLeaderboardData(value) {
  return (
    value &&
    typeof value === 'object' &&
    'leaderboard' in value &&
    Array.isArray(value.leaderboard)
  );
}

/**
 * LeaderboardDisplay - Display peer review leaderboard with model-level rankings
 */
function LeaderboardDisplay({ data }) {
  const { leaderboard, metadata } = data;

  if (!leaderboard || leaderboard.length === 0) {
    return <div className="leaderboard-empty">No rankings available</div>;
  }

  const algorithm = metadata?.algorithm || 'unknown';
  const totalModels = metadata?.total_models || leaderboard.length;
  const totalWorkers = metadata?.total_evaluated || 0;

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <div className="leaderboard-title">
          <span className="trophy-icon">🏆</span>
          <span>Model Performance Rankings</span>
        </div>
        <div className="leaderboard-meta">
          <span className="meta-item">Algorithm: <strong>{algorithm}</strong></span>
          <span className="meta-item">Models: <strong>{totalModels}</strong></span>
          <span className="meta-item">Workers: <strong>{totalWorkers}</strong></span>
        </div>
      </div>

      <div className="leaderboard-content">
        {leaderboard.map((entry, index) => {
          const rank = entry.rank || index + 1;
          const badge = entry.badge || '';
          const consensus = entry.evaluator_consensus || 'unknown';
          const consensusClass = `consensus-${consensus}`;
          const modelName = entry.model_ref?.split('/')[1] || entry.model_ref;

          return (
            <div key={index} className={`leaderboard-entry rank-${rank}`}>
              <div className="entry-rank">
                <span className="rank-number">#{rank}</span>
                {badge && <span className="rank-badge">{badge}</span>}
              </div>

              <div className="entry-details">
                <div className="entry-header">
                  <span className="model-name">{modelName}</span>
                  <span className="worker-count">
                    ({entry.worker_count} worker{entry.worker_count !== 1 ? 's' : ''})
                  </span>
                </div>

                <div className="entry-stats">
                  <span className="score">
                    Avg Score: <strong>{entry.avg_score?.toFixed(2) || 'N/A'}</strong>
                  </span>
                  <span className={`consensus ${consensusClass}`}>
                    Consistency: <strong>{consensus}</strong>
                  </span>
                  {entry.individual_scores && entry.individual_scores.length > 1 && (
                    <span className="score-range">
                      Range: {Math.min(...entry.individual_scores).toFixed(2)} - {Math.max(...entry.individual_scores).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {metadata?.label_to_worker && (
        <div className="leaderboard-footer">
          <button
            className="show-metadata-btn"
            onClick={() => {
              const metaEl = document.getElementById('leaderboard-full-metadata');
              if (metaEl) metaEl.classList.toggle('hidden');
            }}
          >
            Show Full Metadata
          </button>
          <pre id="leaderboard-full-metadata" className="metadata-json hidden">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Helper function to group worker outputs and reducer results by superstep
 */
function groupBySuperstep(workerOutputs, superstepResults) {
  const superstepsMap = new Map();

  // Add worker outputs
  if (workerOutputs) {
    Object.keys(workerOutputs).forEach(stepId => {
      if (!superstepsMap.has(stepId)) {
        superstepsMap.set(stepId, { stepId, workers: null, reducerResult: null });
      }
      superstepsMap.get(stepId).workers = workerOutputs[stepId];
    });
  }

  // Add reducer results
  if (superstepResults) {
    superstepResults.forEach(result => {
      const stepId = result.step_id;
      if (!superstepsMap.has(stepId)) {
        superstepsMap.set(stepId, { stepId, workers: null, reducerResult: null });
      }
      superstepsMap.get(stepId).reducerResult = result;
    });
  }

  // Convert to array and sort by step_id
  return Array.from(superstepsMap.values()).sort((a, b) => {
    // Extract numeric part from step_id (e.g., "step_1" -> 1)
    const aNum = parseInt(a.stepId.replace(/\D/g, '')) || 0;
    const bNum = parseInt(b.stepId.replace(/\D/g, '')) || 0;
    return aNum - bNum;
  });
}

/**
 * SuperstepsSection - Display supersteps with unified worker outputs and reducer synthesis
 */
function SuperstepsSection({ workerOutputs, superstepResults }) {
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

  const supersteps = groupBySuperstep(workerOutputs, superstepResults);
  if (supersteps.length === 0) return null;

  return (
    <div className="supersteps-container">
      <div className="supersteps-header">
        <h3>📊 Superstep Results</h3>
      </div>

      {supersteps.map(superstep => {
        const isExpanded = expandedSteps[superstep.stepId] || false;
        const activeTab = activeWorkerTabs[superstep.stepId] || 0;
        const workers = superstep.workers;
        const reducerResult = superstep.reducerResult;

        return (
          <div key={superstep.stepId} className="superstep-section">
            <button
              className="superstep-header"
              onClick={() => toggleStep(superstep.stepId)}
            >
              <span className="superstep-title">
                Superstep: {superstep.stepId}
                {workers && ` (${workers.length} worker${workers.length !== 1 ? 's' : ''})`}
              </span>
              <span className="toggle-icon">
                {isExpanded ? '▼' : '▶'}
              </span>
            </button>

            {isExpanded && (
              <div className="superstep-content">
                {/* Worker Outputs */}
                {workers && workers.length > 0 && (
                  <div className="worker-outputs-subsection">
                    <h4>👥 Worker Perspectives</h4>
                    <div className="worker-tabs">
                      {workers.map((worker, index) => {
                        const modelName = worker.model_ref?.split('/')[1] || worker.model_ref || `Worker ${index + 1}`;
                        return (
                          <button
                            key={index}
                            className={`worker-tab ${activeTab === index ? 'active' : ''}`}
                            onClick={() => setActiveWorker(superstep.stepId, index)}
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

                {/* Reducer Synthesis */}
                {reducerResult && (
                  <div className="reducer-synthesis-subsection">
                    <h4>🔄 Synthesis Result</h4>
                    {(reducerResult.reducer_strategy || reducerResult.ranking_algorithm) && (
                      <span className="synthesis-strategy-badge">
                        {reducerResult.reducer_strategy || reducerResult.ranking_algorithm}
                      </span>
                    )}
                    <div className="synthesis-content">
                      {reducerResult.superstep_type === 'score_and_rank' ? (
                        <LeaderboardDisplay data={reducerResult.output_value} />
                      ) : shouldUseStructuredRenderer(reducerResult.output_value) ? (
                        <StructuredDataDisplay
                          data={prepareForStructuredRenderer(reducerResult.output_value)}
                          theme="purple"
                          maxDepth={3}
                          showRawToggle={true}
                        />
                      ) : typeof reducerResult.output_value === 'string' ? (
                        <div className="markdown-content">
                          <ReactMarkdown>{reducerResult.output_value}</ReactMarkdown>
                        </div>
                      ) : (
                        <pre className="json-content">
                          {JSON.stringify(reducerResult.output_value, null, 2)}
                        </pre>
                      )}
                    </div>
                    <div className="synthesis-metadata">
                      <span>Variable: <code>{reducerResult.output_variable}</code></span>
                      {reducerResult.reducer_model && (
                        <span>Model: <code>{reducerResult.reducer_model}</code></span>
                      )}
                      {reducerResult.worker_count && (
                        <span>Synthesized from {reducerResult.worker_count} workers</span>
                      )}
                      {reducerResult.evaluated_count && (
                        <span>Evaluated {reducerResult.evaluated_count} responses</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
