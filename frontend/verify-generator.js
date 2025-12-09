#!/usr/bin/env node

/**
 * Simple verification script to test workflow generator output
 * Run with: node verify-generator.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import generator functions
import {
  createWorkflow,
  createSuperstep,
  visibility,
  middleware,
  strategies,
  models
} from './src/workflowGenerator.js';

// Simple test: Generate simple_debate and verify structure
function testSimpleDebate() {
  console.log('\n🧪 Testing Simple Debate generation...');

  const workflow = createWorkflow('simple_debate', 120000)
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

  // Load expected
  const expectedPath = path.join(__dirname, '..', 'examples', 'workflows', 'simple_debate.json');
  const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));

  // Compare
  const generated = JSON.stringify(workflow, null, 2);
  const expectedStr = JSON.stringify(expected, null, 2);

  if (generated === expectedStr) {
    console.log('✅ Simple Debate: PASSED');
    return true;
  } else {
    console.log('❌ Simple Debate: FAILED');
    console.log('\nGenerated:');
    console.log(generated);
    console.log('\nExpected:');
    console.log(expectedStr);
    return false;
  }
}

// Test with default role
function testDefaultRole() {
  console.log('\n🧪 Testing Default Role feature...');

  const workflow = createWorkflow('test_default_role', 60000)
    .withVariable('output', 'string')
    .withSuperstep(
      createSuperstep('step1', 'Test default role')
        .withDefaultRole('I am the default role definition')
        .withWorkers([
          { worker_id: 'w1', model_ref: models.GPT4 },
          { worker_id: 'w2', model_ref: models.CLAUDE_SONNET },
          {
            worker_id: 'w3',
            model_ref: models.GEMINI_FLASH,
            role_definition: 'I override the default'
          }
        ])
        .withReduce({
          strategy: strategies.SIMPLE_SUMMARY,
          modelRef: models.GPT4,
          outputWriteTo: 'output',
          visibility: visibility.full()
        })
    )
    .build();

  const workers = workflow.supersteps[0].map_phase.workers;

  const checks = [
    { test: 'Worker 1 has default role', pass: workers[0].role_definition === 'I am the default role definition' },
    { test: 'Worker 2 has default role', pass: workers[1].role_definition === 'I am the default role definition' },
    { test: 'Worker 3 has override role', pass: workers[2].role_definition === 'I override the default' }
  ];

  let allPassed = true;
  checks.forEach(check => {
    if (check.pass) {
      console.log(`  ✅ ${check.test}`);
    } else {
      console.log(`  ❌ ${check.test}`);
      allPassed = false;
    }
  });

  return allPassed;
}

// Test middleware helpers
function testMiddleware() {
  console.log('\n🧪 Testing Middleware helpers...');

  const filterMw = middleware.filterRegex(['*'], 'test.*pattern', 'flag');
  const truncateMw = middleware.truncate(['worker1'], 500, 'smart');
  const refineMw = middleware.llmRefine(['*'], models.GPT4, 'Make it better');
  const piiMw = middleware.anonymizePii(['*']);

  const checks = [
    { test: 'FilterRegex structure', pass: filterMw.op === 'filter_regex' && filterMw.config.pattern === 'test.*pattern' },
    { test: 'Truncate structure', pass: truncateMw.op === 'truncate' && truncateMw.config.max_length === 500 },
    { test: 'LLM Refine structure', pass: refineMw.op === 'llm_refine' && refineMw.config.model_ref === models.GPT4 },
    { test: 'Anonymize PII structure', pass: piiMw.op === 'anonymize_pii' }
  ];

  let allPassed = true;
  checks.forEach(check => {
    if (check.pass) {
      console.log(`  ✅ ${check.test}`);
    } else {
      console.log(`  ❌ ${check.test}`);
      allPassed = false;
    }
  });

  return allPassed;
}

// Test visibility helpers
function testVisibility() {
  console.log('\n🧪 Testing Visibility helpers...');

  const full = visibility.full();
  const blind = visibility.blindReview();
  const clean = visibility.cleanSubquery();
  const custom = visibility.custom({
    includeOriginalInput: true,
    maskWorkerIdentities: false,
    includeRejectedItems: true
  });

  const checks = [
    { test: 'Full visibility', pass: full.include_original_input && !full.mask_worker_identities },
    { test: 'Blind review', pass: blind.include_original_input && blind.mask_worker_identities },
    { test: 'Clean subquery', pass: clean.include_original_input && !clean.include_conversation_history && !clean.include_worker_outputs },
    { test: 'Custom visibility', pass: custom.include_original_input && !custom.mask_worker_identities && custom.include_rejected_items }
  ];

  let allPassed = true;
  checks.forEach(check => {
    if (check.pass) {
      console.log(`  ✅ ${check.test}`);
    } else {
      console.log(`  ❌ ${check.test}`);
      allPassed = false;
    }
  });

  return allPassed;
}

// Run all tests
console.log('🚀 Workflow Generator Verification Suite');
console.log('=========================================');

const results = [
  testSimpleDebate(),
  testDefaultRole(),
  testMiddleware(),
  testVisibility()
];

const passed = results.filter(r => r).length;
const total = results.length;

console.log('\n=========================================');
console.log(`📊 Results: ${passed}/${total} tests passed`);

if (passed === total) {
  console.log('🎉 All tests passed!');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed');
  process.exit(1);
}
