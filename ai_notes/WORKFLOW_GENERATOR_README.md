# Workflow DSL Generator

A builder-pattern library for generating workflow definitions that conform to [dsl-schema.json](../dsl-schema.json).

## Overview

The Workflow Generator provides a fluent API for creating complex multi-agent conversation workflows without manually writing JSON. It includes:

- **Type-safe builders** for workflows, supersteps, and configurations
- **Helper functions** for common patterns (visibility, middleware)
- **Default role definitions** to reduce repetition
- **Full schema compliance** with validation

## Installation

The generator is a standalone JavaScript module:

```javascript
import {
  createWorkflow,
  createSuperstep,
  visibility,
  middleware,
  strategies,
  models
} from './src/workflowGenerator.js';
```

## Quick Start

### Simple Debate (2 models + chairman)

```javascript
const workflow = createWorkflow('simple_debate', 120000)
  .withVariable('final_answer', 'string')
  .withSuperstep(
    createSuperstep('debate', 'Two perspectives, one synthesis')
      .withWorkers([
        {
          worker_id: 'optimist',
          model_ref: models.GPT4,
          role_definition: 'You are optimistic and focus on benefits.'
        },
        {
          worker_id: 'skeptic',
          model_ref: models.CLAUDE_SONNET,
          role_definition: 'You are skeptical and focus on risks.'
        }
      ])
      .withReduce({
        strategy: strategies.COUNCIL_CHAIRMAN,
        modelRef: models.GEMINI_FLASH,
        outputWriteTo: 'final_answer',
        visibility: visibility.full(),
        chairmanInstructions: 'Balance both perspectives into a nuanced answer.'
      })
  )
  .build();
```

### Blind Review (anonymized workers)

```javascript
const workflow = createWorkflow('blind_review', 180000)
  .withVariable('final_answer', 'string')
  .withSuperstep(
    createSuperstep('gather_responses', 'Collect responses from multiple models')
      .withDefaultRole('You are a helpful AI assistant.')
      .withWorkers([
        { worker_id: 'model_a', model_ref: models.GPT4 },
        { worker_id: 'model_b', model_ref: models.CLAUDE_SONNET },
        { worker_id: 'model_c', model_ref: models.GEMINI_FLASH }
      ])
      .withReduce({
        strategy: strategies.COUNCIL_CHAIRMAN,
        modelRef: models.GPT4_TURBO,
        outputWriteTo: 'final_answer',
        visibility: visibility.blindReview(), // ← Masks worker identities
        chairmanInstructions: 'Evaluate responses without knowing which model produced them.'
      })
  )
  .build();
```

## API Reference

### `createWorkflow(flowId, globalTimeout)`

Creates a new workflow builder.

**Parameters:**
- `flowId` (string): Unique identifier for this workflow
- `globalTimeout` (number, optional): Global timeout in milliseconds (default: 120000)

**Methods:**
- `.withVariable(name, type, defaultValue)`: Add a variable
  - `type`: 'string', 'json_object', or 'list'
- `.withSuperstep(superstep)`: Add a superstep
- `.build()`: Build the final workflow object

### `createSuperstep(stepId, description)`

Creates a new superstep builder.

**Parameters:**
- `stepId` (string): Unique step identifier
- `description` (string): Human-readable description

**Methods:**

#### Map Phase
- `.withWorkers(workers)`: Add workers
  - Each worker: `{worker_id, model_ref, role_definition?}`
- `.withConcurrency(limit)`: Set concurrency limit
- `.withGlobalInstruction(instruction)`: Set global instruction overlay
- `.withDefaultRole(roleDefinition)`: Set default role for all workers (can be overridden per-worker)

#### Middleware Phase
- `.withMiddleware(middlewares)`: Add middleware pipeline
  - Array of middleware configs (see Middleware Helpers below)

#### Reduce Phase
- `.withReduce(config)`: Configure reduce phase
  - `strategy`: Reduce strategy (see Strategies)
  - `modelRef`: Model reference
  - `outputWriteTo`: Variable name to write output to
  - `visibility`: Visibility configuration (see Visibility Helpers)
  - `chairmanInstructions` (optional): Instructions for chairman
  - `timeout` (optional): Timeout in milliseconds
  - `variableInterpolation` (optional): Enable `${var_name}` interpolation

### Visibility Helpers

Pre-configured visibility patterns:

```javascript
// Full visibility - original input + worker outputs with identities
visibility.full()
// → { include_original_input: true, mask_worker_identities: false }

// Blind review - anonymized worker outputs
visibility.blindReview()
// → { include_original_input: true, mask_worker_identities: true }

// Clean subquery - only original input, no context or worker outputs
visibility.cleanSubquery()
// → {
//     include_original_input: true,
//     include_conversation_history: false,
//     include_worker_outputs: false,
//     mask_worker_identities: true
//   }

// Custom visibility
visibility.custom({
  includeOriginalInput: true,
  maskWorkerIdentities: false,
  includeRejectedItems: false,
  includeConversationHistory: true,
  includeWorkerOutputs: true
})
```

### Middleware Helpers

Pre-configured middleware operations:

```javascript
// Filter by regex pattern
middleware.filterRegex(['*'], '(?i)(sorry|cannot)', 'flag')

// Truncate output
middleware.truncate(['worker1', 'worker2'], 500, 'smart')

// LLM refine
middleware.llmRefine(['*'], models.GPT4, 'Make tone neutral')

// Anonymize PII
middleware.anonymizePii(['*'])
```

### Constants

#### Strategies
```javascript
strategies.COUNCIL_CHAIRMAN     // 'council_chairman'
strategies.SIMPLE_SUMMARY        // 'simple_summary'
strategies.VOTE_MAJORITY         // 'vote_majority'
strategies.SUBQUERY_SINGLE_MODEL // 'subquery_single_model'
strategies.CROSS_INTERROGATION   // 'cross_interrogation'
```

#### Models
```javascript
models.GPT4            // 'openai/gpt-4'
models.GPT4_TURBO      // 'openai/gpt-4-turbo'
models.CLAUDE_SONNET   // 'anthropic/claude-3.5-sonnet'
models.GEMINI_FLASH    // 'google/gemini-2.0-flash-exp'
```

## Advanced Examples

### Multi-Superstep with Variable Interpolation

```javascript
const workflow = createWorkflow('cross_interrogation_demo', 300000)
  .withVariable('stage1_responses', 'string')
  .withVariable('stage1_5_questions', 'string')
  .withVariable('stage1_5_answers', 'string')
  .withVariable('final_synthesis', 'string')

  // Stage 1: Initial responses
  .withSuperstep(
    createSuperstep('stage1', 'Gather initial perspectives')
      .withConcurrency(3)
      .withWorkers([
        { worker_id: 'worker_a', model_ref: models.GPT4, role_definition: '...' },
        { worker_id: 'worker_b', model_ref: models.CLAUDE_SONNET, role_definition: '...' },
        { worker_id: 'worker_c', model_ref: models.GEMINI_FLASH, role_definition: '...' }
      ])
      .withReduce({
        strategy: strategies.SIMPLE_SUMMARY,
        modelRef: models.GEMINI_FLASH,
        outputWriteTo: 'stage1_responses',
        visibility: visibility.full()
      })
  )

  // Stage 1.5: Generate questions (with variable interpolation)
  .withSuperstep(
    createSuperstep('stage1_5_questions', 'Generate cross-interrogation questions')
      .withConcurrency(3)
      .withGlobalInstruction('Here are the responses:\n\n${stage1_responses}\n\nGenerate follow-up questions.')
      .withDefaultRole('Review responses and generate clarifying questions.')
      .withWorkers([
        { worker_id: 'worker_a', model_ref: models.GPT4 },
        { worker_id: 'worker_b', model_ref: models.CLAUDE_SONNET },
        { worker_id: 'worker_c', model_ref: models.GEMINI_FLASH }
      ])
      .withReduce({
        strategy: strategies.CROSS_INTERROGATION,
        modelRef: models.GEMINI_FLASH,
        outputWriteTo: 'stage1_5_questions',
        variableInterpolation: true, // ← Enable ${var} interpolation
        visibility: visibility.custom({
          includeOriginalInput: false,
          maskWorkerIdentities: false
        })
      })
  )

  // ... more supersteps

  .build();
```

### Middleware Pipeline

```javascript
const workflow = createWorkflow('middleware_demo', 180000)
  .withVariable('final_answer', 'string')
  .withSuperstep(
    createSuperstep('gather_and_filter', 'Gather and filter responses')
      .withDefaultRole('You are a helpful assistant.')
      .withWorkers([
        { worker_id: 'worker1', model_ref: models.GPT4 },
        { worker_id: 'worker2', model_ref: models.CLAUDE_SONNET },
        { worker_id: 'worker3', model_ref: models.GEMINI_FLASH }
      ])
      .withMiddleware([
        // Flag responses containing refusal patterns
        middleware.filterRegex(['*'], '(?i)(sorry|cannot|unable)', 'flag'),
        // Truncate to 500 chars
        middleware.truncate(['*'], 500, 'smart')
      ])
      .withReduce({
        strategy: strategies.SIMPLE_SUMMARY,
        modelRef: models.GPT4,
        outputWriteTo: 'final_answer',
        visibility: visibility.custom({
          includeOriginalInput: true,
          maskWorkerIdentities: false,
          includeRejectedItems: false // Don't show filtered items
        })
      })
  )
  .build();
```

### Clean Subquery (No Context)

```javascript
const workflow = createWorkflow('clean_subquery_example', 120000)
  .withVariable('fresh_perspective', 'string')
  .withSuperstep(
    createSuperstep('clean_subquery', 'Get fresh perspective without context')
      .withWorkers([]) // No workers in map phase
      .withReduce({
        strategy: strategies.SUBQUERY_SINGLE_MODEL,
        modelRef: models.CLAUDE_SONNET,
        outputWriteTo: 'fresh_perspective',
        visibility: visibility.cleanSubquery(), // ← No history, no worker outputs
        chairmanInstructions: 'Provide unbiased analysis without prior context.'
      })
  )
  .build();
```

## Testing

### Run Verification Tests

```bash
cd frontend
node verify-generator.js
```

### Run Browser Tests

1. Start a local server (e.g., `python3 -m http.server 8000`)
2. Open `http://localhost:8000/frontend/test-workflow-generator.html`
3. Click "Run All Tests"

The test suite includes 7 tests that recreate all example workflows:

1. ✅ Simple Debate
2. ✅ Blind Review
3. ✅ Middleware Pipeline
4. ✅ Classic Council
5. ✅ Clean Subquery
6. ✅ Debate with Fresh Judge
7. ✅ Cross Interrogation

## Design Features

### 1. Default Role Definitions

Avoid repetition when multiple workers share the same role:

```javascript
// Before (repetitive)
.withWorkers([
  { worker_id: 'w1', model_ref: models.GPT4, role_definition: 'You are helpful.' },
  { worker_id: 'w2', model_ref: models.CLAUDE_SONNET, role_definition: 'You are helpful.' },
  { worker_id: 'w3', model_ref: models.GEMINI_FLASH, role_definition: 'You are helpful.' }
])

// After (DRY)
.withDefaultRole('You are helpful.')
.withWorkers([
  { worker_id: 'w1', model_ref: models.GPT4 },
  { worker_id: 'w2', model_ref: models.CLAUDE_SONNET },
  { worker_id: 'w3', model_ref: models.GEMINI_FLASH }
])

// Can still override per-worker
.withDefaultRole('You are helpful.')
.withWorkers([
  { worker_id: 'w1', model_ref: models.GPT4 }, // Uses default
  { worker_id: 'w2', model_ref: models.CLAUDE_SONNET, role_definition: 'You are critical.' } // Override
])
```

### 2. Builder Pattern

Fluent, chainable API for readable workflow construction:

```javascript
createWorkflow('my_flow', 120000)
  .withVariable('var1', 'string')
  .withVariable('var2', 'list')
  .withSuperstep(
    createSuperstep('step1', 'Description')
      .withConcurrency(3)
      .withWorkers([...])
      .withReduce({...})
  )
  .withSuperstep(
    createSuperstep('step2', 'Description')
      .withWorkers([...])
      .withMiddleware([...])
      .withReduce({...})
  )
  .build();
```

### 3. Type-Safe Constants

Use constants instead of magic strings:

```javascript
// Bad
.withReduce({ strategy: 'council_chairman', ... })

// Good
.withReduce({ strategy: strategies.COUNCIL_CHAIRMAN, ... })
```

### 4. Schema Compliance

All generated workflows conform to [dsl-schema.json](../dsl-schema.json):

- Required fields enforced by builder
- Enum values validated by constants
- Proper nesting structure guaranteed
- Polymorphic middleware configs supported

## Files

- [workflowGenerator.js](src/workflowGenerator.js) - Core generator library
- [workflowGenerator.test.js](src/workflowGenerator.test.js) - Test suite (7 example workflows)
- [verify-generator.js](verify-generator.js) - Node.js verification script
- [test-workflow-generator.html](test-workflow-generator.html) - Browser test runner

## Integration (Future)

This generator is **not yet integrated** into the main application. Future integration points:

1. **UI Builder**: Visual workflow editor using this generator
2. **API Endpoint**: `POST /api/workflows` to execute custom workflows
3. **Preset Templates**: Pre-built workflow templates for common patterns
4. **Storage**: Save/load custom workflows to user profiles

## License

Part of the LLM Council project. See root [README.md](../README.md) for details.
