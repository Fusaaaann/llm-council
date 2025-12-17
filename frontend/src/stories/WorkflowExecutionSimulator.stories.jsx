import React, { useState, useEffect, useRef } from 'react';
import { WorkflowSimulationEngine } from './utils/simulationEngine';
import { mockSimulationData, mockWorkflowsForSimulator } from './mockData';
import { JSONInput } from './components/JSONInput';
import { ExecutionControls } from './components/ExecutionControls';
import { TopologyView } from './components/TopologyView';
import { VariableWatcher } from './components/VariableWatcher';
import { ExecutionLog } from './components/ExecutionLog';
import './WorkflowExecutionSimulator.css';

/**
 * WorkflowExecutionSimulator - Interactive workflow visualizer
 *
 * Allows users to paste workflow JSON and step through execution
 * with topology visualization and progressive reveal
 */
function WorkflowExecutionSimulator({ initialWorkflow, autoStart = false }) {
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [engine, setEngine] = useState(null);
  const [executionMode, setExecutionMode] = useState('idle');
  const [executionSpeed, setExecutionSpeed] = useState(1000);
  const [events, setEvents] = useState([]);
  const [, forceUpdate] = useState({});

  const autoRunIntervalRef = useRef(null);

  // Initialize engine when workflow is loaded
  useEffect(() => {
    if (workflow) {
      const newEngine = new WorkflowSimulationEngine(workflow, mockSimulationData);
      setEngine(newEngine);
      setEvents([]);
      setExecutionMode('idle');
    } else {
      setEngine(null);
      setEvents([]);
      setExecutionMode('idle');
    }
  }, [workflow]);

  // Auto-start if configured
  useEffect(() => {
    if (autoStart && engine && executionMode === 'idle') {
      handleRun();
    }
  }, [autoStart, engine]);

  // Auto-run interval
  useEffect(() => {
    if (executionMode === 'running' && engine) {
      autoRunIntervalRef.current = setInterval(() => {
        const result = engine.step();

        if (result.event) {
          setEvents(prev => [...prev, result.event]);
        }

        if (result.done) {
          setExecutionMode('complete');
          clearInterval(autoRunIntervalRef.current);
        }

        forceUpdate({});
      }, executionSpeed);

      return () => {
        if (autoRunIntervalRef.current) {
          clearInterval(autoRunIntervalRef.current);
        }
      };
    }
  }, [executionMode, executionSpeed, engine]);

  const handleStep = () => {
    if (!engine) return;

    const result = engine.step();

    if (result.event) {
      setEvents(prev => [...prev, result.event]);
    }

    if (result.done) {
      setExecutionMode('complete');
    }

    forceUpdate({});
  };

  const handleRun = () => {
    if (!engine) return;
    setExecutionMode('running');
  };

  const handlePause = () => {
    setExecutionMode('idle');
    if (autoRunIntervalRef.current) {
      clearInterval(autoRunIntervalRef.current);
    }
  };

  const handleReset = () => {
    if (!engine) return;

    engine.reset();
    setEvents([]);
    setExecutionMode('idle');
    forceUpdate({});

    if (autoRunIntervalRef.current) {
      clearInterval(autoRunIntervalRef.current);
    }
  };

  const handleValidWorkflow = (validWorkflow) => {
    setWorkflow(validWorkflow);
  };

  const handleWorkerClick = (superstepId, worker, output) => {
    // Optional: Show worker detail modal
    console.log('Worker clicked:', { superstepId, worker, output });
  };

  const canStep = engine && !engine.state.isComplete;

  return (
    <div className="workflow-simulator">
      <div className="workflow-simulator__sidebar">
        <JSONInput
          initialJSON={initialWorkflow}
          onValidWorkflow={handleValidWorkflow}
          exampleWorkflows={mockWorkflowsForSimulator}
        />

        <ExecutionControls
          executionMode={executionMode}
          executionSpeed={executionSpeed}
          canStep={canStep}
          onStep={handleStep}
          onRun={handleRun}
          onPause={handlePause}
          onReset={handleReset}
          onSpeedChange={setExecutionSpeed}
        />

        {engine && (
          <VariableWatcher
            variables={engine.state.variables}
            variableDefinitions={workflow?.variables}
          />
        )}
      </div>

      <div className="workflow-simulator__main">
        <TopologyView
          workflow={workflow}
          engine={engine}
          onWorkerClick={handleWorkerClick}
        />
      </div>

      <div className="workflow-simulator__log">
        <ExecutionLog events={events} />
      </div>
    </div>
  );
}

// ========== STORYBOOK CONFIGURATION ==========

export default {
  title: 'Workflows/ExecutionSimulator',
  component: WorkflowExecutionSimulator,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Interactive workflow execution simulator with topology visualization and step-through controls. Paste workflow JSON and watch execution unfold step-by-step with visual state tracking.'
      }
    }
  },
  tags: ['autodocs']
};

// ========== STORY VARIANTS ==========

/**
 * Interactive - Empty state, paste JSON to start
 */
export const Interactive = {
  render: () => <WorkflowExecutionSimulator />,
  parameters: {
    docs: {
      description: {
        story: 'Empty simulator ready for workflow JSON. Paste a workflow definition to visualize topology and step through execution.'
      }
    }
  }
};

/**
 * Classic Council - Pre-loaded workflow
 */
export const ClassicCouncilPreloaded = {
  render: () => (
    <WorkflowExecutionSimulator
      initialWorkflow={mockWorkflowsForSimulator.classicCouncil}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Classic Council workflow pre-loaded. Click "Step" to advance through Stage 1 (3 workers) → Synthesis (1 worker) → Final answer. Use "Run" for auto-execution.'
      }
    }
  }
};

/**
 * Perspective Matrix - 12 workers in grid
 */
export const PerspectiveMatrixPreloaded = {
  render: () => (
    <WorkflowExecutionSimulator
      initialWorkflow={mockWorkflowsForSimulator.perspectiveMatrix}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Perspective Matrix workflow with 12 workers (3 models × 4 perspectives). Step through to see cartesian product execution pattern.'
      }
    }
  }
};

/**
 * Auto-run demonstration
 */
export const AutoRunDemo = {
  render: () => (
    <WorkflowExecutionSimulator
      initialWorkflow={mockWorkflowsForSimulator.classicCouncil}
      autoStart={true}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Auto-running demonstration of Classic Council workflow. Watch as execution proceeds automatically with visual state transitions.'
      }
    }
  }
};

/**
 * Fast Execution Speed
 */
export const FastExecutionSpeed = {
  render: () => {
    const FastSpeedWrapper = () => {
      const [workflow] = useState(mockWorkflowsForSimulator.classicCouncil);
      const [, forceUpdate] = useState({});

      useEffect(() => {
        // Trigger auto-run after component mounts
        const timer = setTimeout(() => forceUpdate({}), 100);
        return () => clearTimeout(timer);
      }, []);

      return (
        <WorkflowExecutionSimulator
          initialWorkflow={workflow}
          autoStart={true}
        />
      );
    };

    return <FastSpeedWrapper />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstration with fast execution speed (adjust slider to see different speeds).'
      }
    }
  }
};
