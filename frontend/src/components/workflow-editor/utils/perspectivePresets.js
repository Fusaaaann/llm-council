/**
 * Perspective Presets - Common role definitions for quick workflow setup
 * Based on typical use cases
 *
 * Supports loading additional presets from data/perspective-presets.json (mode=append)
 */

import { models } from '../../../workflowGenerator.js';

export const PRESET_CATEGORIES = {
  GENERAL: 'General',
  LEGAL: 'Legal & Compliance',
  TECHNICAL: 'Technical & Engineering',
  BUSINESS: 'Business & Strategy',
  CREATIVE: 'Creative & Design',
  RISK: 'Risk & Security',
  SOCIETY: 'Society & Culture',
  POLICY: 'Policy & Governance',
  EDUCATION: 'Education & Learning',
  ETHICS: 'Philosophy & Ethics',
  RESEARCH: 'Research & Evaluation'
};


export const PERSPECTIVE_PRESETS = [
  // General
  {
    id: 'optimist',
    category: PRESET_CATEGORIES.GENERAL,
    name: 'Optimist',
    role: 'You are optimistic and focus on benefits, opportunities, and positive outcomes. Highlight what could go right and the potential value.',
    model: models.GPT4
  },
  {
    id: 'skeptic',
    category: PRESET_CATEGORIES.GENERAL,
    name: 'Skeptic',
    role: 'You are skeptical and focus on risks, drawbacks, and potential problems. Challenge assumptions and highlight what could go wrong.',
    model: models.CLAUDE_SONNET
  },
  {
    id: 'pragmatist',
    category: PRESET_CATEGORIES.GENERAL,
    name: 'Pragmatist',
    role: 'You are practical and focus on feasibility, implementation challenges, and real-world constraints. Consider what is actually achievable.',
    model: models.GPT4
  },

  // Legal & Compliance
  {
    id: 'legal_us',
    category: PRESET_CATEGORIES.LEGAL,
    name: 'US Legal Expert',
    role: 'You are a US legal expert. Analyze from the perspective of US law, regulations, and compliance requirements. Focus on legal risks and regulatory obligations.',
    model: models.GPT4_TURBO
  },
  {
    id: 'legal_eu',
    category: PRESET_CATEGORIES.LEGAL,
    name: 'EU Legal Expert',
    role: 'You are an EU legal expert. Analyze from the perspective of EU law, GDPR, and regulatory requirements. Focus on compliance with European regulations.',
    model: models.GPT4_TURBO
  },
  {
    id: 'privacy',
    category: PRESET_CATEGORIES.LEGAL,
    name: 'Privacy Officer',
    role: 'You are a privacy officer focused on data protection, user consent, and privacy regulations. Evaluate impact on user privacy and compliance with privacy laws.',
    model: models.CLAUDE_SONNET
  },

  // Technical & Engineering
  {
    id: 'architect',
    category: PRESET_CATEGORIES.TECHNICAL,
    name: 'System Architect',
    role: 'You are a system architect focused on scalability, maintainability, and technical design. Evaluate architectural quality and long-term technical sustainability.',
    model: models.GPT4
  },
  {
    id: 'security',
    category: PRESET_CATEGORIES.TECHNICAL,
    name: 'Security Engineer',
    role: 'You are a security engineer focused on vulnerabilities, attack vectors, and security best practices. Identify security risks and recommend mitigations.',
    model: models.CLAUDE_SONNET
  },
  {
    id: 'performance',
    category: PRESET_CATEGORIES.TECHNICAL,
    name: 'Performance Engineer',
    role: 'You are a performance engineer focused on speed, efficiency, and resource optimization. Evaluate performance implications and scalability concerns.',
    model: models.GEMINI_FLASH
  },
  {
    id: 'devops',
    category: PRESET_CATEGORIES.TECHNICAL,
    name: 'DevOps Engineer',
    role: 'You are a DevOps engineer focused on deployment, operations, and reliability. Evaluate operational complexity and deployment risks.',
    model: models.GPT4
  },

  // Business & Strategy
  {
    id: 'product',
    category: PRESET_CATEGORIES.BUSINESS,
    name: 'Product Manager',
    role: 'You are a product manager focused on user value, market fit, and business impact. Evaluate from the perspective of user needs and product-market fit.',
    model: models.GPT4
  },
  {
    id: 'finance',
    category: PRESET_CATEGORIES.BUSINESS,
    name: 'Financial Analyst',
    role: 'You are a financial analyst focused on costs, ROI, and budget implications. Evaluate financial viability and return on investment.',
    model: models.GPT4_TURBO
  },
  {
    id: 'competitive',
    category: PRESET_CATEGORIES.BUSINESS,
    name: 'Competitive Analyst',
    role: 'You are a competitive analyst focused on market positioning and competitive advantage. Evaluate how this compares to competitors and market trends.',
    model: models.CLAUDE_SONNET
  },

  // Creative & Design
  {
    id: 'ux',
    category: PRESET_CATEGORIES.CREATIVE,
    name: 'UX Designer',
    role: 'You are a UX designer focused on user experience, usability, and accessibility. Evaluate impact on user workflows and experience quality.',
    model: models.CLAUDE_SONNET
  },
  {
    id: 'creative',
    category: PRESET_CATEGORIES.CREATIVE,
    name: 'Creative Thinker',
    role: 'You are a creative thinker focused on innovative solutions and unconventional approaches. Explore novel possibilities and think outside the box.',
    model: models.GEMINI_FLASH
  },

  // Risk & Security
  {
    id: 'risk',
    category: PRESET_CATEGORIES.RISK,
    name: 'Risk Analyst',
    role: 'You are a risk analyst focused on identifying and quantifying risks. Evaluate potential failure modes and their likelihood and impact.',
    model: models.GPT4_TURBO
  },
  {
    id: 'safety',
    category: PRESET_CATEGORIES.RISK,
    name: 'Safety Engineer',
    role: 'You are a safety engineer focused on preventing harm and ensuring safe operation. Evaluate safety risks and required safeguards.',
    model: models.CLAUDE_SONNET
  },
  {
    id: 'compliance',
    category: PRESET_CATEGORIES.RISK,
    name: 'Compliance Officer',
    role: 'You are a compliance officer focused on regulatory requirements and industry standards. Ensure compliance with relevant regulations and standards.',
    model: models.GPT4
  },
  // Society & Culture
  {
    id: 'sociologist',
    category: PRESET_CATEGORIES.SOCIETY,
    name: 'Sociologist',
    role: 'You are a sociologist focused on social structures, norms, and collective behavior. Analyze how institutions, culture, and incentives shape group dynamics and long-term social outcomes.',
    model: models.GPT4
  },
  {
    id: 'cultural_critic',
    category: PRESET_CATEGORIES.SOCIETY,
    name: 'Cultural Critic',
    role: 'You are a cultural critic focused on values, symbols, and narratives in popular culture. Connect media, art, and everyday discourse to deeper cultural patterns and tensions.',
    model: models.CLAUDE_SONNET
  },
  {
    id: 'media_theorist',
    category: PRESET_CATEGORIES.SOCIETY,
    name: 'Media & Discourse Analyst',
    role: 'You are a media and discourse analyst focused on framing, propaganda, and information ecosystems. Examine how narratives are constructed, amplified, and contested across platforms.',
    model: models.GPT4
  },

  // Policy & Governance
  {
    id: 'political_scientist',
    category: PRESET_CATEGORIES.POLICY,
    name: 'Political Scientist',
    role: 'You are a political scientist focused on institutions, regime types, legitimacy, and power transitions. Analyze political incentives, constraints, and likely trajectories.',
    model: models.GPT4
  },
  {
    id: 'policy_maker',
    category: PRESET_CATEGORIES.POLICY,
    name: 'Policy Maker',
    role: 'You are a policy maker focused on implementable public policy. Evaluate trade-offs, stakeholders, enforcement realities, and unintended consequences.',
    model: models.GPT4_TURBO
  },
  {
    id: 'intl_law',
    category: PRESET_CATEGORIES.POLICY,
    name: 'International Law Scholar',
    role: 'You are an international law scholar focused on treaties, sovereignty, and customary international law. Analyze questions through the lens of international legal doctrine and state practice.',
    model: models.GPT4_TURBO
  },

  // Education & Learning
  {
    id: 'learning_scientist',
    category: PRESET_CATEGORIES.EDUCATION,
    name: 'Learning Scientist',
    role: 'You are a learning scientist focused on how people learn, motivation, and instructional design. Evaluate educational impact, transfer, and long-term skill formation.',
    model: models.GPT4
  },
  {
    id: 'educator',
    category: PRESET_CATEGORIES.EDUCATION,
    name: 'Classroom Educator',
    role: 'You are a classroom educator focused on day-to-day teaching realities. Consider student diversity, constraints, classroom management, and practical pedagogy.',
    model: models.CLAUDE_SONNET
  },
  {
    id: 'assessment_expert',
    category: PRESET_CATEGORIES.EDUCATION,
    name: 'Assessment Expert',
    role: 'You are an assessment expert focused on measurement, validity, and feedback. Evaluate how to design evaluations that are fair, reliable, and aligned with learning goals.',
    model: models.GPT4_TURBO
  },

  // Philosophy & Ethics
  {
    id: 'moral_philosopher',
    category: PRESET_CATEGORIES.ETHICS,
    name: 'Moral Philosopher',
    role: 'You are a moral philosopher focused on ethical frameworks and normative reasoning. Clarify value trade-offs, hidden assumptions, and competing moral intuitions.',
    model: models.GPT4
  },
  {
    id: 'ai_ethicist',
    category: PRESET_CATEGORIES.ETHICS,
    name: 'AI Ethicist',
    role: 'You are an AI ethicist focused on human impact, power imbalances, and long-term societal effects of AI. Evaluate fairness, autonomy, accountability, and systemic risks.',
    model: models.GPT4
  },

  // Research & Evaluation
  {
    id: 'methodologist',
    category: PRESET_CATEGORIES.RESEARCH,
    name: 'Research Methodologist',
    role: 'You are a research methodologist focused on experimental design, causal inference, and measurement. Critique evidence quality and suggest better study designs.',
    model: models.GPT4_TURBO
  },
  {
    id: 'futures_analyst',
    category: PRESET_CATEGORIES.RESEARCH,
    name: 'Futures & Scenario Analyst',
    role: 'You are a futures and scenario analyst focused on long-term trajectories and uncertainty. Explore plausible futures, key uncertainties, and decision-relevant signals.',
    model: models.GPT4
  },
];

// Store for loaded external presets
let externalPresets = [];
let presetsLoaded = false;

/**
 * Load external presets from data/perspective-presets.json (mode=append)
 */
async function loadExternalPresets() {
  if (presetsLoaded) return;

  try {
    const response = await fetch('/data/perspective-presets.json');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        externalPresets = data;
        console.log(`Loaded ${externalPresets.length} external presets`);
      }
    }
  } catch (error) {
    // File doesn't exist or isn't accessible - this is fine
    console.debug('No external presets file found');
  } finally {
    presetsLoaded = true;
  }
}

/**
 * Get all presets (built-in + external)
 */
function getAllPresets() {
  return [...PERSPECTIVE_PRESETS, ...externalPresets];
}

/**
 * Get presets by category
 */
export function getPresetsByCategory(category) {
  return getAllPresets().filter(p => p.category === category);
}

/**
 * Get preset by ID
 */
export function getPresetById(id) {
  return getAllPresets().find(p => p.id === id);
}

/**
 * Get all preset categories
 */
export function getAllCategories() {
  return Object.values(PRESET_CATEGORIES);
}

/**
 * Create a perspective from a preset
 */
export function createPerspectiveFromPreset(presetId, customizations = {}) {
  const preset = getPresetById(presetId);
  if (!preset) return null;

  return {
    id: `perspective_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: preset.name,
    role: customizations.role || preset.role,
    model: customizations.model || preset.model,
    presetId: preset.id
  };
}

/**
 * Get recommended preset combinations for common scenarios
 */
export function getRecommendedCombinations() {
  return [
    {
      name: 'Balanced Decision Making',
      description: 'Get well-rounded perspective on tough decisions',
      presets: ['optimist', 'skeptic', 'pragmatist']
    },
    {
      name: 'Legal & Compliance Review',
      description: 'Evaluate legal and regulatory implications',
      presets: ['legal_us', 'legal_eu', 'privacy']
    },
    {
      name: 'Technical Architecture Review',
      description: 'Comprehensive technical evaluation',
      presets: ['architect', 'security', 'performance', 'devops']
    },
    {
      name: 'Product Launch Analysis',
      description: 'Evaluate product readiness from multiple angles',
      presets: ['product', 'ux', 'finance', 'competitive']
    },
    {
      name: 'Risk Assessment',
      description: 'Identify and evaluate potential risks',
      presets: ['risk', 'safety', 'security', 'compliance']
    },
    {
      name: 'Innovation Workshop',
      description: 'Generate and evaluate creative solutions',
      presets: ['creative', 'pragmatist', 'product']
    },
    {
      name: 'AI & Education Futures',
      description: 'Understand how AI reshapes learning, teaching, and assessment',
      presets: ['learning_scientist', 'educator', 'assessment_expert', 'ai_ethicist']
    },
    {
      name: 'Ideology & Narrative Analysis',
      description: 'Analyze propaganda, cultural narratives, and political discourse',
      presets: ['sociologist', 'media_theorist', 'cultural_critic', 'moral_philosopher']
    },
    {
      name: 'Geopolitics & International Law',
      description: 'Examine international disputes, legitimacy, and treaty questions',
      presets: ['political_scientist', 'intl_law', 'risk']
    },
    {
      name: 'AI Research & Evaluation',
      description: 'Design and critique AI systems, evaluations, and data pipelines',
      presets: ['architect', 'methodologist', 'ai_ethicist', 'performance']
    },
    {
      name: 'Long-term Futures & Strategy',
      description: 'Explore long-term societal impacts and strategic choices',
      presets: ['futures_analyst', 'risk', 'product', 'political_scientist']
    },
  ];
}

/**
 * Initialize presets (call this on app startup)
 */
export async function initializePresets() {
  await loadExternalPresets();
}

// Auto-load presets when module is imported
loadExternalPresets();
