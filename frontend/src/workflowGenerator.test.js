/**
 * Workflow Generator Test Suite
 * Tests that the generator can recreate all example workflows
 */

import {
  createWorkflow,
  createSuperstep,
  visibility,
  middleware,
  strategies,
  models
} from './workflowGenerator.js';

// Test utilities
function deepEqual(obj1, obj2) {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

function testWorkflow(name, generator, expectedPath) {
  console.log(`\n=== Testing: ${name} ===`);

  const generated = generator();

  // Load expected JSON
  fetch(expectedPath)
    .then(res => res.json())
    .then(expected => {
      const match = deepEqual(generated, expected);

      if (match) {
        console.log(`✅ ${name} - PASSED`);
      } else {
        console.log(`❌ ${name} - FAILED`);
        console.log('Generated:', JSON.stringify(generated, null, 2));
        console.log('Expected:', JSON.stringify(expected, null, 2));
      }
    })
    .catch(err => {
      console.error(`Error loading ${expectedPath}:`, err);
    });
}

// ============================================================================
// Test 1: Simple Debate
// ============================================================================
function generateSimpleDebate() {
  return createWorkflow('simple_debate', 120000)
    .withVariable('final_answer', 'string')
    .withSuperstep(
      createSuperstep('debate', 'Two perspectives, one synthesis')
        .withWorkers([
          {
            worker_id: 'optimist',
            model_ref: models.GPT4,
            role_definition: 'You are optimistic and focus on benefits and positive aspects.'
          },
          {
            worker_id: 'skeptic',
            model_ref: models.CLAUDE_SONNET,
            role_definition: 'You are skeptical and focus on risks and potential problems.'
          }
        ])
        .withReduce({
          strategy: strategies.COUNCIL_CHAIRMAN,
          modelRef: models.GEMINI_FLASH,
          outputWriteTo: 'final_answer',
          visibility: visibility.full(),
          chairmanInstructions: 'Balance both the optimistic and skeptical perspectives into a nuanced, well-reasoned answer that acknowledges both benefits and risks.'
        })
    )
    .build();
}

// ============================================================================
// Test 2: Blind Review
// ============================================================================
function generateBlindReview() {
  return createWorkflow('blind_review', 180000)
    .withVariable('final_answer', 'string')
    .withSuperstep(
      createSuperstep('gather_responses', 'Collect responses from multiple models')
        .withDefaultRole('You are a helpful AI assistant. Answer the user\'s question comprehensively and accurately.')
        .withWorkers([
          { worker_id: 'model_a', model_ref: models.GPT4 },
          { worker_id: 'model_b', model_ref: models.CLAUDE_SONNET },
          { worker_id: 'model_c', model_ref: models.GEMINI_FLASH }
        ])
        .withReduce({
          strategy: strategies.COUNCIL_CHAIRMAN,
          modelRef: models.GPT4_TURBO,
          outputWriteTo: 'final_answer',
          visibility: visibility.blindReview(),
          chairmanInstructions: 'Evaluate the responses without knowing which model produced them. Focus purely on the quality, accuracy, and completeness of the content. Synthesize the best aspects of each response into a comprehensive final answer.'
        })
    )
    .build();
}

// ============================================================================
// Test 3: Middleware Pipeline
// ============================================================================
function generateMiddlewarePipeline() {
  return createWorkflow('middleware_demo', 180000)
    .withVariable('final_answer', 'string')
    .withSuperstep(
      createSuperstep('gather_and_filter', 'Gather responses and apply middleware filtering')
        .withDefaultRole('You are a helpful assistant. Answer the question clearly and concisely.')
        .withWorkers([
          { worker_id: 'worker1', model_ref: models.GPT4 },
          { worker_id: 'worker2', model_ref: models.CLAUDE_SONNET },
          { worker_id: 'worker3', model_ref: models.GEMINI_FLASH }
        ])
        .withMiddleware([
          middleware.filterRegex(['*'], '(?i)(sorry|cannot|unable|don\'t know)', 'flag'),
          middleware.truncate(['*'], 500, 'smart')
        ])
        .withReduce({
          strategy: strategies.SIMPLE_SUMMARY,
          modelRef: models.GPT4,
          outputWriteTo: 'final_answer',
          visibility: visibility.custom({
            includeOriginalInput: true,
            maskWorkerIdentities: false,
            includeRejectedItems: false
          })
        })
    )
    .build();
}

// ============================================================================
// Test 4: Classic Council
// ============================================================================
function generateClassicCouncil() {
  return createWorkflow('classic_council', 300000)
    .withVariable('stage1_responses', 'list')
    .withVariable('final_answer', 'string')
    .withSuperstep(
      createSuperstep('stage1', 'Gather initial perspectives from council members')
        .withConcurrency(3)
        .withWorkers([
          {
            worker_id: 'gpt4',
            model_ref: models.GPT4,
            role_definition: 'You are a thoughtful AI assistant providing comprehensive, well-reasoned answers.'
          },
          {
            worker_id: 'claude',
            model_ref: models.CLAUDE_SONNET,
            role_definition: 'You are a balanced AI assistant focused on nuanced, well-reasoned responses that consider multiple perspectives.'
          },
          {
            worker_id: 'gemini',
            model_ref: models.GEMINI_FLASH,
            role_definition: 'You are an AI assistant providing clear, structured, and accurate answers.'
          }
        ])
        .withReduce({
          strategy: strategies.SIMPLE_SUMMARY,
          modelRef: models.GEMINI_FLASH,
          outputWriteTo: 'stage1_responses',
          visibility: visibility.full()
        })
    )
    .withSuperstep(
      createSuperstep('synthesis', 'Synthesize final answer using chairman')
        .withWorkers([
          {
            worker_id: 'reviewer',
            model_ref: models.GPT4,
            role_definition: 'You are a critical reviewer. Review the perspectives from other models and provide your own thoughtful analysis.'
          }
        ])
        .withReduce({
          strategy: strategies.COUNCIL_CHAIRMAN,
          modelRef: models.GPT4_TURBO,
          outputWriteTo: 'final_answer',
          visibility: visibility.full(),
          chairmanInstructions: 'Synthesize the council\'s perspectives into a comprehensive, accurate, and well-balanced answer. Consider the strengths of each perspective and integrate them into a cohesive response.'
        })
    )
    .build();
}

// ============================================================================
// Test 5: Clean Subquery
// ============================================================================
function generateCleanSubquery() {
  return createWorkflow('clean_subquery_example', 120000)
    .withVariable('fresh_perspective', 'string')
    .withSuperstep(
      createSuperstep('clean_subquery', 'Get a fresh, unbiased perspective without any context')
        .withWorkers([])
        .withReduce({
          strategy: strategies.SUBQUERY_SINGLE_MODEL,
          modelRef: models.CLAUDE_SONNET,
          outputWriteTo: 'fresh_perspective',
          visibility: visibility.cleanSubquery(),
          chairmanInstructions: 'Provide a thoughtful, unbiased analysis of the question without any prior context or discussion.'
        })
    )
    .build();
}

// ============================================================================
// Test 6: Debate with Fresh Judge
// ============================================================================
function generateDebateWithFreshJudge() {
  return createWorkflow('debate_with_fresh_judge', 180000)
    .withVariable('debate_outputs', 'string')
    .withVariable('fresh_judgment', 'string')
    .withVariable('final_synthesis', 'string')
    .withSuperstep(
      createSuperstep('initial_debate', 'Multiple perspectives debate the question')
        .withWorkers([
          {
            worker_id: 'technical_expert',
            model_ref: models.GPT4,
            role_definition: 'You are a technical expert focusing on implementation details and feasibility.'
          },
          {
            worker_id: 'business_strategist',
            model_ref: models.CLAUDE_SONNET,
            role_definition: 'You are a business strategist focusing on market viability and ROI.'
          },
          {
            worker_id: 'user_advocate',
            model_ref: models.GEMINI_FLASH,
            role_definition: 'You are a user experience advocate focusing on end-user needs and usability.'
          }
        ])
        .withReduce({
          strategy: strategies.SIMPLE_SUMMARY,
          modelRef: models.GPT4,
          outputWriteTo: 'debate_outputs',
          visibility: visibility.blindReview()
        })
    )
    .withSuperstep(
      createSuperstep('fresh_judgment', 'Get unbiased judgment from a fresh model without prior context')
        .withWorkers([])
        .withReduce({
          strategy: strategies.SUBQUERY_SINGLE_MODEL,
          modelRef: models.CLAUDE_SONNET,
          outputWriteTo: 'fresh_judgment',
          visibility: visibility.cleanSubquery(),
          chairmanInstructions: 'Analyze this question independently and provide your best answer without being influenced by any prior discussion.'
        })
    )
    .withSuperstep(
      createSuperstep('final_synthesis', 'Synthesize the debate with the fresh perspective')
        .withWorkers([])
        .withReduce({
          strategy: strategies.COUNCIL_CHAIRMAN,
          modelRef: models.GEMINI_FLASH,
          outputWriteTo: 'final_synthesis',
          visibility: visibility.full(),
          chairmanInstructions: 'Compare the group debate with the independent fresh judgment. Synthesize the best insights from both approaches into a comprehensive final answer.'
        })
    )
    .build();
}

// ============================================================================
// Test 7: Cross Interrogation
// ============================================================================
function generateCrossInterrogation() {
  return createWorkflow('cross_interrogation_demo', 300000)
    .withVariable('stage1_responses', 'string', 'Initial responses from all models')
    .withVariable('stage1_5_questions', 'string', 'Cross-interrogation questions (JSON)')
    .withVariable('stage1_5_answers', 'string', 'Answers to cross-interrogation questions')
    .withVariable('final_synthesis', 'string', 'Chairman\'s final synthesis')
    .withSuperstep(
      createSuperstep('stage1', 'Gather initial perspectives from council members')
        .withConcurrency(3)
        .withWorkers([
          {
            worker_id: 'worker_a',
            model_ref: models.GPT4,
            role_definition: 'You are a thoughtful AI assistant providing comprehensive, well-reasoned answers.'
          },
          {
            worker_id: 'worker_b',
            model_ref: models.CLAUDE_SONNET,
            role_definition: 'You are a balanced AI assistant focused on nuanced, well-reasoned responses that consider multiple perspectives.'
          },
          {
            worker_id: 'worker_c',
            model_ref: models.GEMINI_FLASH,
            role_definition: 'You are an AI assistant providing clear, structured, and accurate answers.'
          }
        ])
        .withReduce({
          strategy: strategies.SIMPLE_SUMMARY,
          modelRef: models.GEMINI_FLASH,
          outputWriteTo: 'stage1_responses',
          visibility: visibility.full()
        })
    )
    .withSuperstep(
      createSuperstep('stage1_5_questions', 'Generate cross-interrogation questions about other responses')
        .withConcurrency(3)
        .withGlobalInstruction('Here are the responses from different models:\n\n${stage1_responses}\n\nGenerate 1-2 focused follow-up questions for OTHER responses (not your own). Format as:\nQUESTIONS FOR Response [X]:\n1. [Your first question]\n2. [Your second question]')
        .withDefaultRole('Review the responses and generate clarifying questions. Your questions should probe deeper into assumptions, explore edge cases, or clarify ambiguities.')
        .withWorkers([
          { worker_id: 'worker_a', model_ref: models.GPT4 },
          { worker_id: 'worker_b', model_ref: models.CLAUDE_SONNET },
          { worker_id: 'worker_c', model_ref: models.GEMINI_FLASH }
        ])
        .withReduce({
          strategy: strategies.CROSS_INTERROGATION,
          modelRef: models.GEMINI_FLASH,
          outputWriteTo: 'stage1_5_questions',
          variableInterpolation: true,
          visibility: visibility.custom({
            includeOriginalInput: false,
            maskWorkerIdentities: false
          })
        })
    )
    .withSuperstep(
      createSuperstep('stage1_5_answers', 'Collect answers to cross-interrogation questions')
        .withConcurrency(3)
        .withGlobalInstruction('Questions directed at you:\n\n${stage1_5_questions}\n\nPlease answer each question concisely. Defend your reasoning, elaborate where necessary, or acknowledge any overlooked aspects. Keep each answer brief (1-3 sentences).')
        .withDefaultRole('Answer the questions about your original response. Be clear and concise.')
        .withWorkers([
          { worker_id: 'worker_a', model_ref: models.GPT4 },
          { worker_id: 'worker_b', model_ref: models.CLAUDE_SONNET },
          { worker_id: 'worker_c', model_ref: models.GEMINI_FLASH }
        ])
        .withReduce({
          strategy: strategies.SIMPLE_SUMMARY,
          modelRef: models.GEMINI_FLASH,
          outputWriteTo: 'stage1_5_answers',
          variableInterpolation: true,
          visibility: visibility.custom({
            includeOriginalInput: false,
            maskWorkerIdentities: false
          })
        })
    )
    .withSuperstep(
      createSuperstep('final_synthesis', 'Chairman synthesizes all perspectives including Q&A')
        .withWorkers([
          {
            worker_id: 'chairman',
            model_ref: models.GPT4_TURBO,
            role_definition: 'You are the Chairman of an LLM Council. Synthesize all information into a comprehensive answer.'
          }
        ])
        .withReduce({
          strategy: strategies.COUNCIL_CHAIRMAN,
          modelRef: models.GPT4_TURBO,
          outputWriteTo: 'final_synthesis',
          variableInterpolation: true,
          visibility: visibility.full(),
          chairmanInstructions: 'You have access to:\n\n1. Initial Responses:\n${stage1_responses}\n\n2. Cross-Interrogation Q&A:\nQuestions: ${stage1_5_questions}\nAnswers: ${stage1_5_answers}\n\nSynthesize all of this into a comprehensive, accurate answer. Consider the initial responses, the probing questions that revealed deeper insights, and the clarifying answers. Provide a clear, well-reasoned final answer that represents the council\'s collective wisdom.'
        })
    )
    .build();
}

// ============================================================================
// Run All Tests
// ============================================================================
export function runAllTests() {
  console.log('🧪 Starting Workflow Generator Test Suite\n');

  testWorkflow(
    'Simple Debate',
    generateSimpleDebate,
    '/examples/workflows/simple_debate.json'
  );

  testWorkflow(
    'Blind Review',
    generateBlindReview,
    '/examples/workflows/blind_review.json'
  );

  testWorkflow(
    'Middleware Pipeline',
    generateMiddlewarePipeline,
    '/examples/workflows/middleware_pipeline.json'
  );

  testWorkflow(
    'Classic Council',
    generateClassicCouncil,
    '/examples/workflows/classic_council.json'
  );

  testWorkflow(
    'Clean Subquery',
    generateCleanSubquery,
    '/examples/workflows/clean_subquery.json'
  );

  testWorkflow(
    'Debate with Fresh Judge',
    generateDebateWithFreshJudge,
    '/examples/workflows/debate_with_fresh_judge.json'
  );

  testWorkflow(
    'Cross Interrogation',
    generateCrossInterrogation,
    '/examples/workflows/cross_interrogation.json'
  );
}

// For manual testing in browser console or Node
if (typeof window !== 'undefined') {
  window.runWorkflowTests = runAllTests;
  window.workflowGenerators = {
    simpleDebate: generateSimpleDebate,
    blindReview: generateBlindReview,
    middlewarePipeline: generateMiddlewarePipeline,
    classicCouncil: generateClassicCouncil,
    cleanSubquery: generateCleanSubquery,
    debateWithFreshJudge: generateDebateWithFreshJudge,
    crossInterrogation: generateCrossInterrogation
  };
}

// Export generators for individual testing
export {
  generateSimpleDebate,
  generateBlindReview,
  generateMiddlewarePipeline,
  generateClassicCouncil,
  generateCleanSubquery,
  generateDebateWithFreshJudge,
  generateCrossInterrogation
};
