/**
 * Mock Data for Storybook Stories
 * Provides realistic sample data for LLM Council components
 */

// ========== COUNCIL MODE DATA ==========

export const mockCouncilStage1 = [
  {
    model: 'openai/gpt-4o',
    response: `# Analysis of the Question

This is a complex question that requires careful consideration of multiple factors:

1. **Technical Feasibility**: The proposed approach is technically sound
2. **Scalability Concerns**: May face challenges at scale
3. **User Experience**: Should prioritize intuitive design

## Recommendation

Based on these factors, I recommend proceeding with a phased implementation approach.`
  },
  {
    model: 'anthropic/claude-3.5-sonnet',
    response: `I'll approach this from multiple perspectives:

**Strengths:**
- Well-structured problem statement
- Clear objectives and constraints
- Realistic scope

**Potential Issues:**
- Resource allocation may be optimistic
- Dependencies not fully addressed
- Risk mitigation could be stronger

**Balanced View:**
Consider both short-term wins and long-term sustainability.`
  },
  {
    model: 'google/gemini-2.0-flash-exp',
    response: `## Structured Analysis

### Key Points
1. Context is well-defined
2. Goals are measurable
3. Timeline is reasonable

### Considerations
- Performance benchmarks needed
- Security audit recommended
- Documentation requirements

### Conclusion
Approve with modifications to risk management strategy.`
  }
];

export const mockCouncilStage1_5 = {
  questions: [
    {
      from_model: 'openai/gpt-4o',
      to_model: 'anthropic/claude-3.5-sonnet',
      question: 'You mentioned resource allocation might be optimistic. Can you specify which resources you think are underestimated?'
    },
    {
      from_model: 'anthropic/claude-3.5-sonnet',
      to_model: 'google/gemini-2.0-flash-exp',
      question: 'What specific security audit checklist items would you prioritize for this implementation?'
    },
    {
      from_model: 'google/gemini-2.0-flash-exp',
      to_model: 'openai/gpt-4o',
      question: 'In your phased approach, what would be the key deliverables for Phase 1?'
    }
  ],
  answers: [
    {
      from_model: 'anthropic/claude-3.5-sonnet',
      to_model: 'openai/gpt-4o',
      answer: 'Primarily engineering hours and infrastructure costs. The timeline assumes 100% availability, but teams typically operate at 70-80% capacity when accounting for meetings, context switching, and unexpected issues.'
    },
    {
      from_model: 'google/gemini-2.0-flash-exp',
      to_model: 'anthropic/claude-3.5-sonnet',
      answer: 'Top priorities: 1) Authentication/authorization flows, 2) Input validation and sanitization, 3) Data encryption at rest and in transit, 4) API rate limiting, 5) Dependency vulnerability scanning.'
    },
    {
      from_model: 'openai/gpt-4o',
      to_model: 'google/gemini-2.0-flash-exp',
      answer: 'Phase 1 deliverables: 1) Core API endpoints with basic functionality, 2) Database schema and migrations, 3) Basic frontend prototype, 4) Initial test coverage (>70%), 5) Documentation for developers.'
    }
  ],
  label_to_model: {
    'Response A': 'openai/gpt-4o',
    'Response B': 'anthropic/claude-3.5-sonnet',
    'Response C': 'google/gemini-2.0-flash-exp'
  }
};

export const mockCouncilStage2 = [
  {
    model: 'openai/gpt-4o',
    ranking: 'B > A > C',
    reasoning: 'Response B provides the most balanced perspective, considering trade-offs effectively. Response A is strong but slightly less nuanced. Response C is good but more procedural.'
  },
  {
    model: 'anthropic/claude-3.5-sonnet',
    ranking: 'A > B > C',
    reasoning: 'Response A demonstrates deepest technical understanding with practical recommendations. Response B is excellent on analysis. Response C is thorough but less actionable.'
  },
  {
    model: 'google/gemini-2.0-flash-exp',
    ranking: 'B > A > C',
    reasoning: 'Response B excels at identifying risks and dependencies. Response A is technically sound. Response C provides good structure but less depth on critical issues.'
  }
];

export const mockCouncilStage3 = {
  model: 'openai/gpt-4-turbo',
  response: `# Comprehensive Synthesis

After carefully reviewing all perspectives and the cross-interrogation dialogue, here's my synthesized recommendation:

## Executive Summary

The proposed implementation is viable with strategic modifications. All council members agree on technical feasibility but identify important resource and security considerations.

## Key Insights from Council

**From GPT-4o**: Phased approach is critical. Phase 1 should focus on core API, database foundation, and basic frontend with strong test coverage.

**From Claude**: Resource planning needs adjustment. Account for 70-80% team capacity rather than 100% to create realistic timelines.

**From Gemini**: Security audit framework is essential. Prioritize auth flows, input validation, encryption, rate limiting, and dependency scanning.

## Cross-Interrogation Highlights

The dialogue revealed important details:
- Resource estimates are 20-30% optimistic based on realistic capacity planning
- Security audit has clear, actionable priorities
- Phase 1 deliverables are well-defined and measurable

## Final Recommendation

**Proceed with implementation** using this modified approach:

1. **Adjust Timeline**: Add 25% buffer to original estimates
2. **Phase 1 Focus**: Core functionality + security fundamentals (GPT-4o's deliverables + Gemini's security priorities)
3. **Resource Plan**: Budget for 75% capacity utilization (Claude's insight)
4. **Continuous Security**: Integrate security audit checklist from day 1

## Success Metrics

- Phase 1 completion with all deliverables
- Security audit passes before Phase 2
- Test coverage maintained >70%
- Timeline adherence within 10% variance

This synthesis combines the technical rigor from GPT-4o, the risk awareness from Claude, and the security framework from Gemini into a practical, executable plan.`
};

export const mockCouncilMetadata = {
  label_to_model: {
    'Response A': 'openai/gpt-4o',
    'Response B': 'anthropic/claude-3.5-sonnet',
    'Response C': 'google/gemini-2.0-flash-exp'
  },
  aggregate_rankings: {
    'Response A': 2.33,
    'Response B': 1.67,
    'Response C': 3.00
  }
};

// Complete council message
export const mockCouncilMessage = {
  role: 'assistant',
  stage1: mockCouncilStage1,
  stage1_5: mockCouncilStage1_5,
  stage2: mockCouncilStage2,
  stage3: mockCouncilStage3,
  metadata: mockCouncilMetadata
};

// Partial council message (Stage 1 only)
export const mockPartialCouncilMessage1 = {
  role: 'assistant',
  stage1: mockCouncilStage1
};

// Partial council message (Stage 1 + 2)
export const mockPartialCouncilMessage2 = {
  role: 'assistant',
  stage1: mockCouncilStage1,
  stage2: mockCouncilStage2,
  metadata: { label_to_model: mockCouncilMetadata.label_to_model }
};

// ========== WORKFLOW MODE DATA ==========

export const mockWorkflowVariables = {
  user_question: 'Should we migrate our backend from Node.js to Rust?',
  stage1_responses: 'Initial perspectives gathered from GPT-4, Claude, and Gemini...',
  final_answer: `# Migration Decision: Node.js to Rust

## Executive Summary
After comprehensive analysis from multiple perspectives (security, UX, performance, maintainability), we recommend a **hybrid approach** rather than full migration.

## Consensus Points
- Rust offers significant performance benefits for CPU-intensive operations
- Migration cost is substantial (estimated 6-12 months)
- Team has limited Rust experience

## Recommended Strategy

### Phase 1: Proof of Concept (2 months)
- Migrate one performance-critical microservice to Rust
- Measure performance improvements
- Assess team learning curve

### Phase 2: Evaluation (1 month)
- Analyze results against KPIs
- Calculate ROI of full migration
- Make go/no-go decision

### Phase 3: Incremental Migration (if approved)
- Prioritize services by performance impact
- Maintain Node.js for CRUD operations
- Run both stacks in parallel

## Risk Mitigation
- Maintain Node.js expertise
- Invest in Rust training
- Plan for 6-month transition period
- Budget for external consultants

This balanced approach minimizes risk while exploring Rust's benefits.`
};

export const mockWorkflowWorkerOutputs = {
  'stage1': [
    {
      model_ref: 'openai/gpt-4',
      role_definition: 'Analyze from security perspective',
      response: `# Security Analysis: Node.js to Rust Migration

## Security Benefits of Rust
- **Memory Safety**: Eliminates entire classes of vulnerabilities (buffer overflows, use-after-free)
- **Type Safety**: Compile-time guarantees reduce runtime exploits
- **Dependency Security**: Smaller attack surface, fewer dependencies

## Security Risks of Migration
- **New Attack Vectors**: Team unfamiliarity may introduce new vulnerabilities
- **Tooling Maturity**: Security scanning tools less mature than Node ecosystem
- **Migration Bugs**: Rewrite introduces regression risks

## Recommendation
Security benefits are significant but require experienced Rust developers and robust code review.`
    },
    {
      model_ref: 'anthropic/claude-3.5-sonnet',
      role_definition: 'Analyze from UX perspective',
      response: `# UX Impact Analysis

## End-User Impact
- **Performance**: Faster response times (positive)
- **Reliability**: Reduced crashes from memory issues (positive)
- **Feature Velocity**: Slower during migration (negative)

## Developer Experience
- **Learning Curve**: Steep for team (6+ months to proficiency)
- **Hiring**: Smaller talent pool, harder to staff
- **Debugging**: Different toolchain, new workflows

## Recommendation
UX benefits exist but are offset by slower feature delivery during transition.`
    },
    {
      model_ref: 'google/gemini-2.0-flash-exp',
      role_definition: 'Analyze from performance perspective',
      response: `# Performance Analysis

## Benchmark Expectations
- **CPU-bound operations**: 3-10x improvement
- **I/O-bound operations**: Minimal improvement (network/DB bound)
- **Memory usage**: 40-60% reduction
- **Startup time**: 2-5x faster

## Current Bottlenecks
Analyze your metrics:
- If CPU < 30% utilization → Rust won't help much
- If memory pressure → Rust provides clear wins
- If latency is network-bound → Focus on architecture instead

## Recommendation
Measure first. Rust shines for computational workloads, not CRUD APIs.`
    }
  ],
  'synthesis': [
    {
      model_ref: 'openai/gpt-4-turbo',
      role_definition: 'Synthesize all perspectives',
      response: 'Reviewing all perspectives to create balanced recommendation...'
    }
  ]
};

export const mockWorkflowMetadata = {
  workflow_id: 'perspective_matrix_demo',
  completed_steps: 2,
  total_steps: 2,
  execution_time_ms: 45230
};

export const mockWorkflowMessage = {
  role: 'assistant',
  variables: mockWorkflowVariables,
  worker_outputs: mockWorkflowWorkerOutputs,
  metadata: mockWorkflowMetadata
};

export const mockPartialWorkflowMessage = {
  role: 'assistant',
  variables: {
    user_question: 'Should we migrate our backend from Node.js to Rust?',
    stage1_responses: 'Gathering perspectives...'
  },
  worker_outputs: mockWorkflowWorkerOutputs,
  metadata: {
    workflow_id: 'perspective_matrix_demo',
    completed_steps: 1,
    total_steps: 2
  },
  partial: true
};

// ========== CONVERSATION DATA ==========

export const mockUserMessage = {
  role: 'user',
  content: 'What are the key considerations when migrating a backend service from Node.js to Rust?'
};

export const mockEmptyConversation = {
  id: 'conv-empty',
  title: 'New Conversation',
  messages: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

export const mockCouncilConversation = {
  id: 'conv-council-1',
  title: 'Node.js to Rust Migration Analysis',
  messages: [
    mockUserMessage,
    mockCouncilMessage
  ],
  created_at: '2025-12-10T10:30:00Z',
  updated_at: '2025-12-10T10:35:00Z',
  message_count: 2
};

export const mockWorkflowConversation = {
  id: 'conv-workflow-1',
  title: 'Multi-Perspective Tech Migration',
  messages: [
    mockUserMessage,
    mockWorkflowMessage
  ],
  created_at: '2025-12-10T11:00:00Z',
  updated_at: '2025-12-10T11:05:00Z',
  message_count: 2
};

export const mockMultiTurnConversation = {
  id: 'conv-multi-1',
  title: 'Extended Discussion',
  messages: [
    {
      role: 'user',
      content: 'What is the best state management solution for React in 2025?'
    },
    mockCouncilMessage,
    {
      role: 'user',
      content: 'Can you compare Zustand vs Jotai in more detail?'
    },
    {
      role: 'assistant',
      stage1: mockCouncilStage1,
      stage3: mockCouncilStage3
    }
  ],
  created_at: '2025-12-10T09:00:00Z',
  updated_at: '2025-12-10T09:20:00Z',
  message_count: 4
};

// ========== SIDEBAR DATA ==========

export const mockConversations = [
  {
    id: 'conv-1',
    title: 'React State Management 2025',
    message_count: 8,
    created_at: '2025-12-10T09:00:00Z',
    updated_at: '2025-12-10T09:20:00Z',
    sync_status: 'synced',
    is_public: false,
    uses_byok: false
  },
  {
    id: 'conv-2',
    title: 'Node.js to Rust Migration',
    message_count: 4,
    created_at: '2025-12-10T10:30:00Z',
    updated_at: '2025-12-10T10:45:00Z',
    sync_status: 'synced',
    is_public: true,
    uses_byok: false
  },
  {
    id: 'conv-3',
    title: 'Database Scaling Strategies',
    message_count: 12,
    created_at: '2025-12-09T14:00:00Z',
    updated_at: '2025-12-09T14:30:00Z',
    sync_status: 'syncing',
    is_public: false,
    uses_byok: true
  },
  {
    id: 'conv-4',
    title: 'API Design Best Practices',
    message_count: 6,
    created_at: '2025-12-08T16:00:00Z',
    updated_at: '2025-12-08T16:15:00Z',
    sync_status: 'local',
    is_public: false,
    uses_byok: false,
    is_loading: true
  }
];

export const mockUser = {
  id: 'user-123',
  name: 'Demo User',
  email: 'demo@example.com'
};

// ========== QUERY STATE (for loading indicators) ==========

export const mockQueryState = {
  stages: {
    stage1: { status: 'complete' },
    stage1_5: { status: 'complete' },
    stage2: { status: 'complete' },
    stage3: { status: 'complete' }
  }
};

export const mockLoadingQueryState = {
  stages: {
    stage1: { status: 'complete' },
    stage1_5: { status: 'loading' },
    stage2: { status: 'pending' },
    stage3: { status: 'pending' }
  }
};

// ========== WORKFLOW EXECUTION SIMULATOR DATA ==========

/**
 * Mock worker responses for simulation
 * These are used to generate deterministic outputs for any worker
 */
export const mockSimulationData = {
  workerResponses: [
    "After careful analysis, I've identified three key considerations that warrant attention. First, the technical infrastructure must support scalability from day one. Second, user experience should drive design decisions at every stage. Third, security and privacy cannot be afterthoughts—they need to be foundational principles.",

    "From this perspective, the primary concern is maintaining a balance between innovation and stability. We should embrace new technologies while ensuring backward compatibility and minimal disruption to existing workflows. The transition path is as important as the destination.",

    "Based on the available information, I recommend a phased approach that begins with a comprehensive audit of current systems, followed by incremental improvements. This minimizes risk while allowing for course correction based on real-world feedback.",

    "The data suggests several promising avenues for exploration. Market trends indicate strong demand for solutions that prioritize simplicity without sacrificing functionality. Our competitive advantage lies in our ability to deliver both.",

    "Looking at this from a different angle, we need to consider the long-term implications of short-term decisions. Quick wins are valuable, but not if they create technical debt that hampers future development. Sustainable architecture is key.",

    "My analysis reveals potential bottlenecks in the proposed workflow. Specifically, the handoff between development and operations could introduce delays. I suggest implementing automated testing and continuous integration to streamline this process.",

    "The regulatory landscape presents both challenges and opportunities. Compliance requirements, while stringent, can actually serve as a competitive differentiator if we implement them thoughtfully and transparently.",

    "Cost-benefit analysis shows favorable returns on investment, particularly when factoring in reduced maintenance overhead and improved developer productivity. The initial learning curve is offset by long-term gains in efficiency.",

    "From a user-centric viewpoint, the proposed changes align well with expressed needs and pain points. User research indicates strong preference for solutions that 'just work' without requiring extensive configuration or technical expertise.",

    "Risk assessment identifies three critical areas requiring mitigation: data migration complexity, potential service disruptions during transition, and team capacity constraints. Each has addressable solutions that should be implemented proactively.",

    "Performance benchmarks indicate that the proposed architecture can handle 10x current load with minimal latency increase. This headroom provides confidence for future growth and unexpected usage spikes.",

    "The ethical dimensions of this decision deserve consideration. Our choices impact not just our organization but also our users, partners, and the broader ecosystem. Responsible innovation means thinking beyond purely technical or business metrics.",

    "Integration points with existing systems are well-defined and feasible. The API surface area is clean, documentation is comprehensive, and backward compatibility is preserved. This reduces integration risk significantly.",

    "Team feedback highlights enthusiasm for the proposed direction, with some concerns about timeline feasibility. Additional resources or scope adjustment may be needed to deliver quality results within the desired timeframe.",

    "Historical data from similar initiatives suggests that iterative releases with frequent feedback loops produce better outcomes than big-bang deployments. This approach also builds organizational confidence incrementally."
  ],

  synthesisResponses: [
    "Synthesizing all perspectives, the balanced conclusion is that we should proceed with a measured, phased implementation. The technical foundation appears sound, but success depends on careful attention to user experience, security, and team capacity. Key priorities include establishing robust testing infrastructure, maintaining clear communication channels, and building in flexibility for course correction.",

    "After reviewing the inputs, the comprehensive answer emerges: this initiative has strong merit when approached thoughtfully. The convergence of technical feasibility, market demand, and team capability creates a favorable environment for success. Critical success factors include proper resource allocation, realistic timeline expectations, and commitment to iterative improvement.",

    "The collective wisdom points toward a strategic approach that balances ambition with pragmatism. While the vision is compelling, execution details matter enormously. Recommended next steps include detailed technical planning, stakeholder alignment, and establishing clear success metrics that go beyond purely technical measures.",

    "Integration of these diverse viewpoints reveals a nuanced picture. The opportunities are real and significant, but so are the challenges. Success requires not just technical excellence but also organizational commitment, clear communication, and willingness to adapt based on empirical evidence.",

    "Drawing from all analyses, the path forward combines the best elements of each perspective. We should embrace innovation while respecting constraints, move quickly while building sustainably, and think big while executing incrementally. This balanced approach maximizes both short-term progress and long-term viability.",

    "The synthesis shows strong alignment on core principles despite differences in emphasis. All perspectives recognize the importance of user-centricity, technical excellence, and sustainable practices. Disagreements center on timing and prioritization rather than fundamental direction.",

    "Weighing all considerations, the recommended approach prioritizes foundational work that enables future flexibility. Rather than optimizing for a single use case, we should build adaptable systems that can evolve with changing requirements. This requires more upfront investment but pays dividends over time.",

    "The holistic view suggests that success depends on three pillars: technical robustness, organizational readiness, and market timing. All three factors appear favorable, though each requires ongoing attention and investment. No single factor alone determines outcome—it's the intersection that matters."
  ]
};

// ========== WORKFLOW WIZARD DATA ==========

export const mockWizardStateEmpty = {
  problemStatement: '',
  audience: '',
  outputFormat: 'text_summary',
  customFormat: '',
  finalOutputVar: 'final_answer',
  qualities: [],
  constraints: [],
  perspectives: [],
  globalModels: [
    {
      id: 'default_gpt4',
      label: 'GPT-4',
      modelRef: 'openai/gpt-4',
      isDefault: true
    },
    {
      id: 'default_gpt4_turbo',
      label: 'GPT-4 Turbo',
      modelRef: 'openai/gpt-4-turbo',
      isDefault: true
    },
    {
      id: 'default_claude_sonnet',
      label: 'Claude Sonnet',
      modelRef: 'anthropic/claude-3.5-sonnet',
      isDefault: true
    },
    {
      id: 'default_gemini_flash',
      label: 'Gemini Flash',
      modelRef: 'google/gemini-2.0-flash-exp',
      isDefault: true
    }
  ],
  defaultDelegateRole: 'Provide a comprehensive, well-reasoned analysis.',
  interactionMode: 'independent_synthesis',
  decisionMaker: { type: 'chairman', model: 'openai/gpt-4-turbo' },
  visibilityMode: 'full',
  collectTimeout: 0,
  followUpSteps: [],
  globalTimeout: 120000,
  concurrencyLimit: null,
  filters: {},
  costControls: {},
  middleware: [],
  useColumnWiseSummary: false,
  variables: [],
  variableInterpolation: {},
  scopeAlignment: { enabled: false, coordinatorModel: 'openai/gpt-4o' },
  advancedVisibility: {}
};

export const mockWizardStateBasic = {
  workflowId: 'tech_migration_analysis',
  problemStatement: 'Technology Migration Decision Framework',
  audience: 'Technical stakeholders requiring deep analysis of migration risks and benefits',
  outputFormat: 'text_summary',
  customFormat: '',
  finalOutputVar: 'final_recommendation',
  qualities: ['accurate', 'balanced', 'practical'],
  constraints: ['Must complete analysis within 3 months', 'Budget cannot exceed $100k', 'Zero downtime requirement'],
  perspectives: [
    {
      id: 'persp_1',
      name: 'Security Expert',
      role: 'Analyze from security and vulnerability perspective, focusing on attack surface and compliance',
      modelBound: false,
      model: null
    },
    {
      id: 'persp_2',
      name: 'UX Designer',
      role: 'Focus on user experience impact, including learning curve and workflow disruption',
      modelBound: false,
      model: null
    },
    {
      id: 'persp_3',
      name: 'Performance Engineer',
      role: 'Evaluate performance implications, benchmarks, and scalability considerations',
      modelBound: false,
      model: null
    }
  ],
  globalModels: [
    {
      id: 'default_gpt4',
      label: 'GPT-4',
      modelRef: 'openai/gpt-4',
      isDefault: true
    },
    {
      id: 'default_gpt4_turbo',
      label: 'GPT-4 Turbo',
      modelRef: 'openai/gpt-4-turbo',
      isDefault: true
    },
    {
      id: 'default_claude_sonnet',
      label: 'Claude Sonnet',
      modelRef: 'anthropic/claude-3.5-sonnet',
      isDefault: true
    },
    {
      id: 'default_gemini_flash',
      label: 'Gemini Flash',
      modelRef: 'google/gemini-2.0-flash-exp',
      isDefault: true
    }
  ],
  defaultDelegateRole: 'Provide a comprehensive, well-reasoned analysis.',
  interactionMode: 'independent_synthesis',
  decisionMaker: { type: 'chairman', model: 'openai/gpt-4-turbo' },
  visibilityMode: 'full',
  collectTimeout: 0,
  followUpSteps: [],
  globalTimeout: 120000,
  concurrencyLimit: null,
  filters: {},
  costControls: {},
  middleware: [],
  useColumnWiseSummary: false,
  variables: [],
  variableInterpolation: {},
  scopeAlignment: { enabled: false, coordinatorModel: 'openai/gpt-4o' },
  advancedVisibility: {}
};

export const mockWizardStateAdvanced = {
  workflowId: 'advanced_multi_stage_analysis',
  problemStatement: 'Comprehensive Multi-Stage Analysis Framework',
  audience: 'Executive leadership and technical teams',
  outputFormat: 'structured_data',
  customFormat: 'JSON with executive_summary, detailed_analysis, and action_items fields',
  finalOutputVar: 'final_synthesis',
  qualities: ['accurate', 'balanced', 'actionable', 'comprehensive'],
  constraints: ['Must complete within 2 months', 'Budget under $150k', 'Minimal disruption to ongoing operations'],
  perspectives: [
    {
      id: 'persp_1',
      name: 'Security Expert',
      role: 'Analyze from security and vulnerability perspective',
      modelBound: true,
      model: 'openai/gpt-4'
    },
    {
      id: 'persp_2',
      name: 'UX Designer',
      role: 'Focus on user experience impact',
      modelBound: false,
      model: null
    },
    {
      id: 'persp_3',
      name: 'Performance Engineer',
      role: 'Evaluate performance implications',
      modelBound: false,
      model: null
    },
    {
      id: 'persp_4',
      name: 'Risk Manager',
      role: 'Assess business and operational risks',
      modelBound: true,
      model: 'anthropic/claude-3.5-sonnet'
    }
  ],
  globalModels: [
    {
      id: 'default_gpt4',
      label: 'GPT-4',
      modelRef: 'openai/gpt-4',
      isDefault: true
    },
    {
      id: 'default_gpt4_turbo',
      label: 'GPT-4 Turbo',
      modelRef: 'openai/gpt-4-turbo',
      isDefault: true
    },
    {
      id: 'default_claude_sonnet',
      label: 'Claude Sonnet',
      modelRef: 'anthropic/claude-3.5-sonnet',
      isDefault: true
    },
    {
      id: 'default_gemini_flash',
      label: 'Gemini Flash',
      modelRef: 'google/gemini-2.0-flash-exp',
      isDefault: true
    },
    {
      id: 'custom_1',
      label: 'Custom GPT-4o',
      modelRef: 'openai/gpt-4o',
      isDefault: false
    }
  ],
  defaultDelegateRole: 'Provide comprehensive analysis with supporting data.',
  interactionMode: 'debate',
  decisionMaker: { type: 'chairman', model: 'openai/gpt-4o' },
  visibilityMode: 'blind',
  collectTimeout: 30000,
  followUpSteps: [
    {
      stepId: 'implementation_roadmap',
      taskDescription: 'Create detailed implementation roadmap',
      outputVar: 'roadmap',
      selectedPerspectives: ['persp_1', 'persp_3']
    }
  ],
  globalTimeout: 180000,
  concurrencyLimit: 2,
  filters: {
    min_response_length: 100,
    max_response_length: 5000
  },
  costControls: {
    max_cost_per_worker: 0.50
  },
  middleware: [
    {
      op: 'filter_regex',
      apply_to: ['*'],
      config: { pattern: '\\b(confidential|secret)\\b', action: 'flag' }
    },
    {
      op: 'llm_refine',
      apply_to: ['persp_1'],
      config: { model_ref: 'openai/gpt-4', instruction: 'Summarize technical details for non-technical audience' }
    }
  ],
  useColumnWiseSummary: true,
  variables: [
    { name: 'stage1_analysis', type: 'string' },
    { name: 'final_synthesis', type: 'string' }
  ],
  variableInterpolation: {
    use_in_instructions: true
  },
  scopeAlignment: { enabled: true, coordinatorModel: 'openai/gpt-4o' },
  advancedVisibility: {
    mask_identities: true,
    include_metadata: false
  }
};

export const mockGlobalModels = [
  {
    id: 'default_gpt4',
    label: 'GPT-4',
    modelRef: 'openai/gpt-4',
    isDefault: true,
    description: 'OpenAI GPT-4 - General purpose, highly capable'
  },
  {
    id: 'default_gpt4_turbo',
    label: 'GPT-4 Turbo',
    modelRef: 'openai/gpt-4-turbo',
    isDefault: true,
    description: 'Faster GPT-4 variant with 128k context'
  },
  {
    id: 'default_claude_sonnet',
    label: 'Claude Sonnet',
    modelRef: 'anthropic/claude-3.5-sonnet',
    isDefault: true,
    description: 'Anthropic Claude 3.5 Sonnet - Excellent reasoning'
  },
  {
    id: 'default_gemini_flash',
    label: 'Gemini Flash',
    modelRef: 'google/gemini-2.0-flash-exp',
    isDefault: true,
    description: 'Google Gemini 2.0 Flash - Fast and cost-effective'
  },
  {
    id: 'custom_1',
    label: 'Custom GPT-4o',
    modelRef: 'openai/gpt-4o',
    isDefault: false,
    description: 'Latest GPT-4o model'
  },
  {
    id: 'custom_2',
    label: 'Custom Claude Opus',
    modelRef: 'anthropic/claude-opus-4',
    isDefault: false,
    description: 'Most capable Claude model'
  }
];

export const mockMiddleware = [
  {
    op: 'filter_regex',
    apply_to: ['*'],
    config: { pattern: '\\b(confidential|secret|private)\\b', action: 'drop' }
  },
  {
    op: 'anonymize_pii',
    apply_to: ['*'],
    config: {}
  },
  {
    op: 'truncate',
    apply_to: ['worker_analyst'],
    config: { max_length: 1000, strategy: 'smart' }
  },
  {
    op: 'llm_refine',
    apply_to: ['worker_technical'],
    config: {
      model_ref: 'openai/gpt-4',
      instruction: 'Remove jargon and simplify for non-technical audience. Maintain key insights.'
    }
  }
];

export const mockTierBlockers = [
  'Follow-up steps are configured',
  'Middleware operations are configured',
  'Scope alignment is enabled',
  'Column-wise summary reduction is enabled'
];

export const mockActiveAdvancedFeatures = [
  'Multi-step workflows',
  'Middleware pipeline',
  'Scope alignment',
  'Per-perspective summaries (column-wise)'
];

/**
 * Example workflows for pre-loading in stories
 */
export const mockWorkflowsForSimulator = {
  classicCouncil: {
    "flow_id": "classic_council",
    "global_timeout_ms": 300000,
    "models": ["openai/gpt-4o", "anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash-exp"],
    "variables": [
      { "name": "stage1_responses", "type": "string" },
      { "name": "final_answer", "type": "string" }
    ],
    "supersteps": [
      {
        "step_id": "stage1",
        "description": "Gather initial perspectives from council members",
        "map_phase": {
          "concurrency_limit": 3,
          "workers": [
            {
              "worker_id": "gpt4",
              "model_ref": "openai/gpt-4o",
              "instruction": "Provide a comprehensive, well-reasoned answer."
            },
            {
              "worker_id": "claude",
              "model_ref": "anthropic/claude-3.5-sonnet",
              "instruction": "Provide a balanced, nuanced response."
            },
            {
              "worker_id": "gemini",
              "model_ref": "google/gemini-2.0-flash-exp",
              "instruction": "Provide a clear, structured answer."
            }
          ]
        },
        "reduce_phase": {
          "strategy": "simple_summary",
          "model_ref": "google/gemini-2.0-flash-exp",
          "output_write_to": "stage1_responses"
        }
      },
      {
        "step_id": "synthesis",
        "description": "Synthesize final answer",
        "map_phase": {
          "workers": [
            {
              "worker_id": "reviewer",
              "model_ref": "openai/gpt-4o",
              "instruction": "Critically review the perspectives from other models."
            }
          ]
        },
        "reduce_phase": {
          "strategy": "council_chairman",
          "model_ref": "google/gemini-2.0-flash-exp",
          "output_write_to": "final_answer",
          "chairman_instructions": "Synthesize the council's perspectives into a comprehensive answer."
        }
      }
    ]
  },

  perspectiveMatrix: {
    "flow_id": "perspective_matrix",
    "global_timeout_ms": 300000,
    "models": ["openai/gpt-4o", "anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash-exp"],
    "variables": [
      { "name": "multi_perspective_analysis", "type": "string" },
      { "name": "final_synthesis", "type": "string" }
    ],
    "supersteps": [
      {
        "step_id": "perspective_analysis",
        "description": "Generate responses from multiple perspectives",
        "map_phase": {
          "perspective_matrix": {
            "use_models": "all",
            "perspectives": [
              {
                "perspective_id": "technical",
                "instruction": "Analyze from a technical architecture perspective."
              },
              {
                "perspective_id": "business",
                "instruction": "Analyze from a business value perspective."
              },
              {
                "perspective_id": "user",
                "instruction": "Analyze from a user experience perspective."
              },
              {
                "perspective_id": "risk",
                "instruction": "Analyze from a risk management perspective."
              }
            ]
          }
        },
        "reduce_phase": {
          "strategy": "simple_summary",
          "model_ref": "openai/gpt-4o",
          "output_write_to": "multi_perspective_analysis"
        }
      },
      {
        "step_id": "synthesis",
        "description": "Synthesize all perspectives",
        "map_phase": {
          "workers": [
            {
              "worker_id": "synthesizer",
              "model_ref": "openai/gpt-4o",
              "instruction": "Review all perspectives and identify patterns."
            }
          ]
        },
        "reduce_phase": {
          "strategy": "council_chairman",
          "model_ref": "anthropic/claude-3.5-sonnet",
          "output_write_to": "final_synthesis",
          "chairman_instructions": "Create a comprehensive synthesis of all perspectives."
        }
      }
    ]
  }
};
