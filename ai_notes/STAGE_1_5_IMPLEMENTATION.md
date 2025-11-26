# Stage 1.5 Cross-Interrogation Implementation

## Overview

Stage 1.5 adds a cross-interrogation round between Stage 1 (individual responses) and Stage 2 (peer rankings). Models question each other's responses to uncover deeper insights, probe assumptions, and explore unmentioned aspects of the original query.

## Architecture

### Two-Phase Process

**Phase 1: Question Generation**
- Each model reviews ALL other responses (anonymized as "Response A", "Response B", etc.)
- Generates 1-2 focused follow-up questions for other models
- Questions aim to clarify ambiguities, probe assumptions, and explore edge cases

**Phase 2: Answer Collection**
- Each model receives questions directed at their response
- Provides concise answers defending or elaborating on their original reasoning
- Format: Structured Q&A pairs

### Data Flow

```
Stage 1 Complete
    ↓
Stage 1.5 Questions Start
    ↓
Each model generates questions about other responses (parallel)
    ↓
Stage 1.5 Questions Complete
    ↓
Stage 1.5 Answers Start
    ↓
Each model answers questions directed at them (sequential)
    ↓
Stage 1.5 Answers Complete
    ↓
Stage 2 Rankings Start
```

## Backend Implementation

### New Functions in `backend/council.py`

**`stage1_5_cross_interrogation(user_query, stage1_results)`**
- Creates anonymized labels (Response A, B, C, etc.)
- Prompts each model to generate questions about other responses
- Returns: (questions_results, label_to_model mapping)
- Format: Each model returns structured "QUESTIONS FOR Response X:" sections

**`stage1_5_collect_answers(user_query, stage1_results, questions_results, label_to_model)`**
- Parses questions to determine which model each question targets
- Prompts each model to answer questions directed at them
- Returns: List of answer objects with questions, answers, and original response context
- Format: "ANSWER TO QUESTION N:" structured responses

### Streaming Events in `backend/main.py`

New SSE events:
- `stage1_5_questions_start` - Interrogation phase begins
- `stage1_5_questions_complete` - Questions generated (includes data)
- `stage1_5_answers_start` - Answer collection begins
- `stage1_5_answers_complete` - Answers collected (includes data + label_to_model)

### Storage Updates in `backend/storage.py`

**`add_assistant_message()`** now accepts optional `stage1_5` parameter:
```python
stage1_5: Optional[Dict[str, Any]] = None
```

Stored structure:
```json
{
  "stage1_5": {
    "questions": [...],
    "answers": [...],
    "label_to_model": {...}
  }
}
```

## Frontend Implementation

### New Component: `Stage1_5.jsx`

**Features:**
- Tab view showing each model's interrogation experience
- Collapsible sections for Questions Received, Answers Provided, Original Response
- Questions display: Shows who asked each question
- Answers: Markdown-rendered responses
- Original response included for reference (collapsed by default)
- Orange/beige color scheme to distinguish from other stages

**Props:**
- `interrogationData` - Contains questions, answers, label_to_model
- `labelToModel` - Mapping for de-anonymization (optional, extracted from interrogationData)

### Styling: `Stage1_5.css`

- Warm background (`#fef9f5`) to differentiate from Stage 1 (gray) and Stage 2 (blue tint)
- Collapsible section headers with hover effects
- Question items with left border accent
- Responsive, accessible design

### Integration Updates

**`ChatInterface.jsx`**
- Imports Stage1_5 component
- Renders Stage 1.5 between Stage 1 and Stage 2
- Shows loading indicator during interrogation
- Passes `msg.stage1_5` and `msg.stage1_5.label_to_model` as props

**`App.jsx`**
- Added `stage1_5` and `loading.stage1_5` to assistant message state
- Handles 4 new event types for Stage 1.5
- Progressive updates: questions first, then answers
- Persists `label_to_model` mapping from streaming event

## Prompt Engineering

### Question Generation Prompt

```
Generate 1-2 focused follow-up questions for OTHER responses. Questions should:
1. Clarify ambiguities or unmentioned aspects
2. Probe deeper into assumptions
3. Explore edge cases or alternative perspectives
4. Uncover hidden intentions in the original question

Format:
QUESTIONS FOR Response [X]:
1. [Question]
2. [Question]
```

### Answer Collection Prompt

```
Original Question: [query]
Your Original Response: [response]
Peer reviewers have asked:
[questions]

Answer each concisely. Defend reasoning, elaborate where necessary,
or acknowledge overlooked aspects.

Format:
ANSWER TO QUESTION 1:
[Answer]
```

## Key Design Decisions

### Anonymization Maintained
- Models question "Response A/B/C", not specific model names
- Prevents bias and favoritism
- Frontend de-anonymizes for display only

### Two-Phase Approach
- Separate question generation from answer collection
- Allows all models to ask questions before any answer
- Ensures comprehensive interrogation

### Structured Output Format
- Enforces parseable format: "QUESTIONS FOR Response X:"
- Regex-based parsing handles variations gracefully
- Fallback: If no questions directed at a model, displays "No questions asked"

### Progressive Loading
- Questions and answers shown separately as they complete
- Improves perceived performance
- Users can read questions while answers are being generated

### Collapsible UI
- Reduces visual clutter
- Allows users to focus on specific aspects
- Original response included but collapsed by default

## Benefits

1. **Deeper Analysis**: Forces models to defend and elaborate on reasoning
2. **Uncovers Blind Spots**: Questions reveal overlooked aspects of the query
3. **Cross-Pollination**: Models learn from each other's perspectives
4. **Bias Mitigation**: Anonymization prevents favoritism
5. **Transparency**: All questions and answers visible to users
6. **Context for Rankings**: Stage 2 rankers benefit from interrogation insights

## Usage Notes

- Stage 1.5 runs automatically after Stage 1 in all conversations
- No configuration required - uses same council models as Stage 1
- Adds ~30-60 seconds to total processing time (depending on model speeds)
- Questions are parsed with regex - models should follow format for best results
- If a model receives no questions, displays friendly "No questions asked" message

## Testing Checklist

- [ ] Backend starts without errors
- [ ] Stage 1.5 appears after Stage 1 in UI
- [ ] Questions render correctly in tabs
- [ ] Answers display with proper formatting
- [ ] Collapsible sections work
- [ ] Loading indicators show during processing
- [ ] Data persists after page reload
- [ ] Works with multi-turn conversations
- [ ] Gracefully handles model failures

## Future Enhancements

- Make Stage 1.5 optional via UI toggle
- Allow users to inject their own questions
- Show question-answer pairs in a threaded view
- Highlight particularly insightful questions/answers
- Track which questions led to revised thinking in Stage 2 rankings
