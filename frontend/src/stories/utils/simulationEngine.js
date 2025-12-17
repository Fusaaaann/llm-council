/**
 * Workflow Execution Simulation Engine
 *
 * Simulates step-by-step execution of workflow JSON with deterministic mock outputs.
 * Supports interactive stepping through MAP and REDUCE phases.
 */

/**
 * WorkflowSimulationEngine - Core execution logic for workflow simulation
 */
export class WorkflowSimulationEngine {
  constructor(workflowDef, mockData) {
    this.workflow = workflowDef;
    this.mockData = mockData;
    this.state = this.initializeState();
    this.eventLog = [];
  }

  /**
   * Initialize execution state
   */
  initializeState() {
    const variables = {};

    // Initialize all variables with null
    if (this.workflow.variables) {
      this.workflow.variables.forEach(v => {
        variables[v.name] = v.default_value || null;
      });
    }

    return {
      currentSuperstepIndex: 0,
      currentPhase: 'map',
      currentWorkerIndex: 0,
      variables: variables,
      workerOutputs: new Map(),
      reduceOutputs: new Map(),
      completedWorkers: new Set(),
      completedSupersteps: new Set(),
      isComplete: false,
      isPaused: false
    };
  }

  /**
   * Execute one step (one worker or one reduce)
   * Returns: { state, event, done }
   */
  step() {
    if (this.state.isComplete) {
      return {
        state: this.state,
        event: { type: 'already_complete' },
        done: true
      };
    }

    const superstep = this.workflow.supersteps[this.state.currentSuperstepIndex];

    if (!superstep) {
      // Should not happen, but handle gracefully
      this.state.isComplete = true;
      return {
        state: this.state,
        event: { type: 'execution_complete' },
        done: true
      };
    }

    if (this.state.currentPhase === 'map') {
      return this.executeMapStep(superstep);
    } else if (this.state.currentPhase === 'middleware') {
      return this.executeMiddlewareStep(superstep);
    } else if (this.state.currentPhase === 'reduce') {
      return this.executeReduceStep(superstep);
    }
  }

  /**
   * Execute one worker in MAP phase
   */
  executeMapStep(superstep) {
    const workers = this.expandWorkers(superstep.map_phase);

    if (this.state.currentWorkerIndex < workers.length) {
      // Execute current worker
      const worker = workers[this.state.currentWorkerIndex];
      const output = this.simulateWorkerExecution(worker, superstep);

      const workerId = `${superstep.step_id}:${worker.worker_id}`;
      this.state.workerOutputs.set(workerId, output);
      this.state.completedWorkers.add(workerId);
      this.state.currentWorkerIndex++;

      const event = {
        type: 'worker_complete',
        superstep: superstep.step_id,
        workerId: worker.worker_id,
        output: output,
        progress: {
          current: this.state.currentWorkerIndex,
          total: workers.length
        }
      };

      this.eventLog.push(event);

      return {
        state: this.state,
        event: event,
        done: false
      };
    } else {
      // All workers complete, move to next phase
      if (superstep.middleware_phase && superstep.middleware_phase.length > 0) {
        this.state.currentPhase = 'middleware';
        this.state.currentWorkerIndex = 0;
      } else {
        this.state.currentPhase = 'reduce';
        this.state.currentWorkerIndex = 0;
      }

      // Recursively call step to execute next phase
      return this.step();
    }
  }

  /**
   * Execute middleware phase (simplified - just transition)
   */
  executeMiddlewareStep(superstep) {
    // For simulation purposes, middleware is instant
    // In real implementation, this would apply filters/transformations

    this.state.currentPhase = 'reduce';
    this.state.currentWorkerIndex = 0;

    const event = {
      type: 'middleware_complete',
      superstep: superstep.step_id,
      operations: superstep.middleware_phase?.length || 0
    };

    this.eventLog.push(event);

    // Immediately move to reduce
    return this.step();
  }

  /**
   * Execute REDUCE phase
   */
  executeReduceStep(superstep) {
    const output = this.simulateReduceExecution(superstep);

    this.state.reduceOutputs.set(superstep.step_id, output);

    // Write to variable
    const outputVar = superstep.reduce_phase.output_write_to;
    if (outputVar) {
      this.state.variables[outputVar] = output;
    }

    this.state.completedSupersteps.add(superstep.step_id);

    const event = {
      type: 'reduce_complete',
      superstep: superstep.step_id,
      output: output,
      variableWritten: outputVar
    };

    this.eventLog.push(event);

    // Move to next superstep
    this.state.currentSuperstepIndex++;
    this.state.currentPhase = 'map';
    this.state.currentWorkerIndex = 0;

    // Check if execution is complete
    if (this.state.currentSuperstepIndex >= this.workflow.supersteps.length) {
      this.state.isComplete = true;

      const completeEvent = {
        type: 'execution_complete',
        finalVariables: this.state.variables
      };

      this.eventLog.push(completeEvent);

      return {
        state: this.state,
        event: completeEvent,
        done: true
      };
    }

    return {
      state: this.state,
      event: event,
      done: false
    };
  }

  /**
   * Expand workers from map_phase (handle explicit workers and perspective_matrix)
   */
  expandWorkers(mapPhase) {
    if (!mapPhase) return [];

    // Explicit workers
    if (mapPhase.workers && mapPhase.workers.length > 0) {
      return mapPhase.workers;
    }

    // Perspective matrix (cartesian product)
    if (mapPhase.perspective_matrix) {
      const matrix = mapPhase.perspective_matrix;
      const models = this.getModelsForMatrix(matrix);
      const perspectives = matrix.perspectives || [];

      const workers = [];
      models.forEach(model => {
        perspectives.forEach(perspective => {
          workers.push({
            worker_id: `${this.sanitizeId(model)}_${perspective.perspective_id}`,
            model_ref: model,
            instruction: perspective.instruction,
            isPerspectiveMatrix: true,
            perspectiveId: perspective.perspective_id
          });
        });
      });

      return workers;
    }

    return [];
  }

  /**
   * Get models for perspective matrix based on use_models config
   */
  getModelsForMatrix(matrix) {
    const globalModels = this.workflow.models || [];

    if (matrix.use_models === 'all') {
      return globalModels;
    } else if (matrix.use_models === 'whitelist') {
      return matrix.models_filter || [];
    } else if (matrix.use_models === 'blacklist') {
      const blacklist = new Set(matrix.models_filter || []);
      return globalModels.filter(m => !blacklist.has(m));
    }

    return globalModels;
  }

  /**
   * Simulate worker execution with deterministic mock output
   */
  simulateWorkerExecution(worker, superstep) {
    // Generate deterministic response based on worker_id hash
    const hash = this.hashCode(worker.worker_id);
    const responseIndex = Math.abs(hash) % this.mockData.workerResponses.length;
    const response = this.mockData.workerResponses[responseIndex];

    return {
      worker_id: worker.worker_id,
      model_ref: worker.model_ref,
      response: response,
      instruction: worker.instruction || worker.role_definition,
      isPerspectiveMatrix: worker.isPerspectiveMatrix || false,
      perspectiveId: worker.perspectiveId
    };
  }

  /**
   * Simulate reduce execution
   */
  simulateReduceExecution(superstep) {
    const strategy = superstep.reduce_phase?.strategy || 'simple_summary';

    // Get worker outputs for this superstep
    const workerOutputs = [];
    const workers = this.expandWorkers(superstep.map_phase);

    workers.forEach(worker => {
      const workerId = `${superstep.step_id}:${worker.worker_id}`;
      const output = this.state.workerOutputs.get(workerId);
      if (output) {
        workerOutputs.push(output);
      }
    });

    // Generate synthesis based on strategy
    const hash = this.hashCode(superstep.step_id + strategy);
    const responseIndex = Math.abs(hash) % this.mockData.synthesisResponses.length;
    const synthesis = this.mockData.synthesisResponses[responseIndex];

    return {
      strategy: strategy,
      model_ref: superstep.reduce_phase?.model_ref,
      synthesis: synthesis,
      workerCount: workerOutputs.length
    };
  }

  /**
   * Reset execution to initial state
   */
  reset() {
    this.state = this.initializeState();
    this.eventLog = [];
  }

  /**
   * Get current execution status
   */
  getStatus() {
    if (this.state.isComplete) {
      return 'complete';
    }

    if (this.state.isPaused) {
      return 'paused';
    }

    if (this.state.currentSuperstepIndex > 0 || this.state.currentWorkerIndex > 0) {
      return 'running';
    }

    return 'idle';
  }

  /**
   * Pause execution (for auto-run)
   */
  pause() {
    this.state.isPaused = true;
  }

  /**
   * Resume execution (for auto-run)
   */
  resume() {
    this.state.isPaused = false;
  }

  /**
   * Helper: Simple string hash function
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Helper: Sanitize model name for ID
   */
  sanitizeId(str) {
    return str.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * Get worker state (pending, active, complete)
   */
  getWorkerState(superstepIndex, workerId) {
    const superstep = this.workflow.supersteps[superstepIndex];
    if (!superstep) return 'pending';

    const fullWorkerId = `${superstep.step_id}:${workerId}`;

    // Check if completed
    if (this.state.completedWorkers.has(fullWorkerId)) {
      return 'complete';
    }

    // Check if active
    if (superstepIndex === this.state.currentSuperstepIndex &&
        this.state.currentPhase === 'map') {
      const workers = this.expandWorkers(superstep.map_phase);
      const currentWorker = workers[this.state.currentWorkerIndex];

      if (currentWorker && currentWorker.worker_id === workerId) {
        return 'active';
      }
    }

    // Check if superstep hasn't started yet
    if (superstepIndex > this.state.currentSuperstepIndex) {
      return 'pending';
    }

    // Check if we're past this worker in current superstep
    if (superstepIndex === this.state.currentSuperstepIndex) {
      const workers = this.expandWorkers(superstep.map_phase);
      const workerIndex = workers.findIndex(w => w.worker_id === workerId);

      if (workerIndex !== -1 && workerIndex > this.state.currentWorkerIndex) {
        return 'pending';
      }
    }

    return 'pending';
  }

  /**
   * Get superstep state (pending, map_active, reduce_active, complete)
   */
  getSuperstepState(superstepIndex) {
    if (this.state.completedSupersteps.has(this.workflow.supersteps[superstepIndex]?.step_id)) {
      return 'complete';
    }

    if (superstepIndex === this.state.currentSuperstepIndex) {
      if (this.state.currentPhase === 'map') {
        return 'map_active';
      } else if (this.state.currentPhase === 'reduce') {
        return 'reduce_active';
      }
    }

    if (superstepIndex > this.state.currentSuperstepIndex) {
      return 'pending';
    }

    return 'pending';
  }
}

/**
 * Helper function to validate workflow JSON
 */
export function validateWorkflowJSON(json) {
  const errors = [];

  try {
    const workflow = typeof json === 'string' ? JSON.parse(json) : json;

    // Required fields
    if (!workflow.flow_id) {
      errors.push('Missing required field: flow_id');
    }

    if (!workflow.supersteps || !Array.isArray(workflow.supersteps)) {
      errors.push('Missing or invalid field: supersteps (must be array)');
    } else if (workflow.supersteps.length === 0) {
      errors.push('supersteps array cannot be empty');
    }

    if (!workflow.variables || !Array.isArray(workflow.variables)) {
      errors.push('Missing or invalid field: variables (must be array)');
    }

    // Validate each superstep
    if (workflow.supersteps && Array.isArray(workflow.supersteps)) {
      workflow.supersteps.forEach((step, index) => {
        if (!step.step_id) {
          errors.push(`Superstep ${index}: missing step_id`);
        }

        if (!step.map_phase) {
          errors.push(`Superstep ${index}: missing map_phase`);
        }

        if (!step.reduce_phase) {
          errors.push(`Superstep ${index}: missing reduce_phase`);
        } else if (!step.reduce_phase.output_write_to) {
          errors.push(`Superstep ${index}: reduce_phase missing output_write_to`);
        }
      });
    }

    if (errors.length === 0) {
      return { valid: true, workflow };
    } else {
      return { valid: false, errors, workflow: null };
    }
  } catch (e) {
    return {
      valid: false,
      errors: [`JSON parse error: ${e.message}`],
      workflow: null
    };
  }
}
