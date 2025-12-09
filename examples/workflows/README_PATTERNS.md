# Reusable Workflow Patterns

This directory contains example workflows designed as **reusable intelligence architectures**, not one-off tasks.

## Philosophy: Workflows as Patterns

Each workflow defines a **type of problem** it can solve repeatedly, not a specific question. Think of workflows as:
- 🏗️ **Architectures** for collective intelligence
- 🔄 **Reusable templates** for recurring decision types
- 🧩 **Modular frameworks** that accept specific queries at runtime

## Pattern-Based Examples

### ✅ Technology Migration Framework
**File:** `tech_migration_framework.json`

**Pattern Purpose:** Evaluate any technology migration decision
**Example Queries:**
- "Should we migrate from PostgreSQL to MongoDB?"
- "Should we move from React to Vue.js?"
- "Is migrating from AWS to GCP worth it?"

**Perspectives:**
- Technical Analyst (feasibility, architecture)
- Risk Assessor (downtime, mitigation)
- Cost-Benefit Analyst (TCO, ROI)

---

### ✅ Strategic Planning Engine
**File:** `strategic_planning_engine.json`

**Pattern Purpose:** Develop strategic recommendations for business decisions
**Example Queries:**
- "What should our Q4 marketing strategy be?"
- "Should we enter the European market?"
- "How should we respond to competitor X's new product?"

**Perspectives:**
- Market Strategist (trends, competition)
- Operational Planner (feasibility, resources)
- Financial Strategist (budget, ROI)
- Innovation Advisor (creative approaches)

---

### ✅ Research Synthesis Pipeline
**File:** `research_synthesis_pipeline.json`

**Pattern Purpose:** Synthesize academic research and literature
**Example Queries:**
- "Summarize key findings from recent NLP transformer papers"
- "What does the literature say about remote work productivity?"
- "Synthesize research on climate change mitigation strategies"

**Perspectives:**
- Methodology Reviewer (study quality)
- Findings Synthesizer (themes, patterns)
- Gap Analyst (research opportunities)

---

## Design Principles

### 🎯 Good Pattern Definition
✅ **"Technology Migration Decision Framework"** (reusable type)
❌ **"Should we migrate from PostgreSQL to MongoDB?"** (specific task)

✅ **"Strategic Planning & Recommendations"** (general pattern)
❌ **"Q4 Marketing Strategy for Product X"** (one-off task)

### 🔄 How Patterns Work at Runtime

**Workflow Definition** (stored once):
```json
{
  "flow_id": "tech_migration_framework",
  "map_phase": {
    "global_instruction_overlay": "Workflow Purpose: Technology Migration Decision Framework..."
  }
}
```

**Runtime Execution** (user provides specific query):
```
User Query: "Should we migrate from PostgreSQL to MongoDB for our e-commerce platform?"

Backend combines:
  global_instruction_overlay + user_query → workers
```

### 🧠 Context vs. Audience

The `Context` field (previously "audience") describes the **pattern's scope**, not a specific audience:

✅ **Good Context:**
"Technical stakeholders requiring deep cost/risk/benefit analysis"

❌ **Bad Context:**
"Our engineering team discussing the database migration project"

The context helps set the **tone and depth** for all executions, but it's still generic enough to be reusable.

---

## Using These Patterns

1. **Upload Pattern:** Save workflow to your profile via workflow wizard or API
2. **Execute with Query:** POST to `/api/workflows/{workflow_id}/test` with your specific question
3. **Reuse Often:** The same pattern can handle hundreds of similar queries

## Creating Your Own Patterns

When designing workflows, ask:
- ❓ "What **category of problems** will this solve repeatedly?"
- ❓ "Can this pattern be used 10 times with different specific queries?"
- ❓ "Does my workflow define a **reusable decision-making architecture**?"

If you're hardcoding specific details (company names, dates, product names), you're building a **task**, not a **pattern**.

---

## Legacy Examples

The following examples are more specific/demonstrative (not pattern-focused):
- `classic_council.json` - General council structure demo
- `blind_review.json` - Demonstrates anonymized evaluation
- `cross_interrogation.json` - Shows debate mechanics
- `perspective_matrix.json` - Demonstrates matrix-based worker generation

These are still useful for understanding **workflow mechanics**, but the pattern-based examples above better demonstrate **reusability**.
