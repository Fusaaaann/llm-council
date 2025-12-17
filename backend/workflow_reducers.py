"""Reduce strategies for synthesizing worker outputs."""

from typing import List, Dict, Any
from collections import Counter


async def execute_reducer(
    strategy: str,
    worker_outputs: List[Dict[str, Any]],
    memory: 'WorkflowMemory',
    config: Dict[str, Any]
) -> str:
    """
    Execute reduce strategy.

    Args:
        strategy: Reducer strategy name
        worker_outputs: Processed worker outputs
        memory: Workflow memory for context
        config: Strategy-specific configuration

    Returns:
        Synthesized output string
    """
    if strategy == 'council_chairman':
        return await council_chairman(worker_outputs, memory, config)

    elif strategy == 'simple_summary':
        return await simple_summary(worker_outputs, memory, config)

    elif strategy == 'vote_majority':
        return await vote_majority(worker_outputs, memory, config)

    elif strategy == 'subquery_single_model':
        return await subquery_single_model(worker_outputs, memory, config)

    elif strategy == 'cross_interrogation':
        return await cross_interrogation(worker_outputs, memory, config)

    elif strategy == 'column_wise_summary':
        return await column_wise_summary(worker_outputs, memory, config)

    elif strategy == 'score_and_rank':
        return await score_and_rank(worker_outputs, memory, config)

    else:
        raise ValueError(f"Unknown reducer strategy: {strategy}")


async def council_chairman(
    worker_outputs: List[Dict[str, Any]],
    memory: 'WorkflowMemory',
    config: Dict[str, Any]
) -> str:
    """
    Chairman synthesis strategy (similar to existing Stage 3).

    Synthesizes worker outputs into a comprehensive answer,
    considering rankings and peer feedback if available.

    Args:
        worker_outputs: Worker outputs
        memory: Workflow memory
        config: Configuration with model_ref, chairman_instructions, etc.

    Returns:
        Synthesized response
    """
    from .openrouter import query_model

    model_ref = config['model_ref']
    chairman_instructions = config.get('chairman_instructions', '')
    messages = config.get('messages', [])
    visibility = config.get('visibility', {})

    # Build context for chairman
    outputs_text = "\n\n".join([
        f"Worker: {output['worker_id']}\nOutput: {output.get('response', output.get('output', ''))}"
        for output in worker_outputs
    ])

    # Include original input if visibility allows
    original_input = ""
    if visibility.get('include_original_input', True):
        user_query = messages[-1]['content'] if messages else ""
        original_input = f"Original Question: {user_query}\n\n"

    # Build chairman prompt
    chairman_prompt = f"""You are the Chairman synthesizing multiple perspectives.

{original_input}Worker Outputs:
{outputs_text}

{chairman_instructions}

Your task: Synthesize these perspectives into a single, comprehensive, accurate answer. Consider:
- The individual outputs and their insights
- Any patterns of agreement or disagreement
- The specific instructions provided above

Provide a clear, well-reasoned final answer:"""

    # Build messages
    chairman_messages = messages[:-1] + [{"role": "user", "content": chairman_prompt}]

    # Debug logging
    print(f"[DEBUG] Querying chairman model: {model_ref}")
    print(f"[DEBUG] Chairman prompt length: {len(chairman_prompt)} chars")
    print(f"[DEBUG] Message history length: {len(chairman_messages)} messages")

    # Query chairman model
    response = await query_model(model_ref, chairman_messages)

    if response is None:
        error_msg = f"Error: Chairman model '{model_ref}' failed to respond. Please check model availability and API connectivity."
        print(f"[ERROR] {error_msg}")
        return error_msg

    content = response.get('content', '')

    # Check if content is empty
    if not content or not content.strip():
        error_msg = f"Error: Chairman model '{model_ref}' returned empty response. Check chairman_instructions and ensure the model can handle the request."
        print(f"[ERROR] {error_msg}")
        print(f"[DEBUG] Full response object: {response}")
        return error_msg

    print(f"[DEBUG] Chairman returned {len(content)} chars")
    return content


async def simple_summary(
    worker_outputs: List[Dict[str, Any]],
    memory: 'WorkflowMemory',
    config: Dict[str, Any]
) -> str:
    """
    Simple concatenation and summarization strategy.

    Concatenates all worker outputs and asks LLM to summarize.

    Args:
        worker_outputs: Worker outputs
        memory: Workflow memory
        config: Configuration with model_ref

    Returns:
        Summary response
    """
    from .openrouter import query_model

    model_ref = config['model_ref']

    # Concatenate all outputs
    combined = "\n\n".join([
        f"Perspective {i+1}: {output.get('response', output.get('output', ''))}"
        for i, output in enumerate(worker_outputs)
    ])

    # Summarize
    summary_prompt = f"""Summarize the following perspectives into a concise response:

{combined}

Provide a clear summary:"""

    messages = [{"role": "user", "content": summary_prompt}]
    response = await query_model(model_ref, messages)

    if response is None:
        return "Error: Unable to generate summary."

    return response.get('content', '')


async def vote_majority(
    worker_outputs: List[Dict[str, Any]],
    memory: 'WorkflowMemory',
    config: Dict[str, Any]
) -> str:
    """
    Majority vote strategy.

    Workers vote on options, majority wins.
    Useful for binary decisions or multiple choice.

    Args:
        worker_outputs: Worker outputs
        memory: Workflow memory
        config: Configuration

    Returns:
        Vote result summary
    """
    # Extract votes from worker outputs
    # Assume outputs are formatted as "VOTE: <option>"
    votes = []
    for output in worker_outputs:
        text = output.get('response', output.get('output', '')).strip()
        if text.startswith('VOTE:'):
            vote = text.replace('VOTE:', '').strip()
            votes.append(vote)

    if not votes:
        return "Error: No votes found in worker outputs."

    # Count votes
    vote_counts = Counter(votes)
    winner = vote_counts.most_common(1)[0][0]

    # Format result
    result = f"Majority vote result: {winner}\n\n"
    result += "Vote breakdown:\n"
    for option, count in vote_counts.most_common():
        result += f"- {option}: {count} vote(s)\n"

    return result


async def subquery_single_model(
    worker_outputs: List[Dict[str, Any]],
    memory: 'WorkflowMemory',
    config: Dict[str, Any]
) -> str:
    """
    Clean subquery strategy using a single anonymous model.

    Queries a single model with the current input only (no context, no worker outputs).
    Model identity remains anonymous to maintain blind evaluation.

    Use case: Starting fresh subqueries without revealing prior discussion context,
    useful for getting unbiased perspectives or generating synthetic queries.

    Args:
        worker_outputs: Worker outputs (ignored if include_worker_outputs=False)
        memory: Workflow memory
        config: Configuration with model_ref, visibility settings

    Returns:
        Model response
    """
    from .openrouter import query_model

    model_ref = config['model_ref']
    messages = config.get('messages', [])
    visibility = config.get('visibility', {})
    chairman_instructions = config.get('chairman_instructions', '')

    # Determine what to include based on visibility settings
    include_history = visibility.get('include_conversation_history', False)
    include_workers = visibility.get('include_worker_outputs', False)
    include_input = visibility.get('include_original_input', True)

    # Build clean message history
    clean_messages = []

    if include_history:
        # Include full conversation history (excluding current message)
        clean_messages = messages[:-1] if messages else []

    # Build current query
    current_query = ""

    # Add worker outputs if requested
    if include_workers and worker_outputs:
        outputs_text = "\n\n".join([
            f"Perspective {i+1}: {output.get('response', output.get('output', ''))}"
            for i, output in enumerate(worker_outputs)
        ])
        current_query += f"Previous perspectives:\n{outputs_text}\n\n"

    # Add custom instructions
    if chairman_instructions:
        current_query += f"{chairman_instructions}\n\n"

    # Add original input if requested
    if include_input and messages:
        user_query = messages[-1]['content']
        if current_query:
            current_query += f"Question: {user_query}"
        else:
            current_query = user_query
    elif not current_query:
        # Fallback if no input sources
        current_query = "Please provide a response."

    # Add current query to messages
    clean_messages.append({"role": "user", "content": current_query})

    # Query model anonymously
    response = await query_model(model_ref, clean_messages)

    if response is None:
        return "Error: Unable to generate subquery response."

    return response.get('content', '')


async def cross_interrogation(
    worker_outputs: List[Dict[str, Any]],
    memory: 'WorkflowMemory',
    config: Dict[str, Any]
) -> str:
    """
    Cross-interrogation strategy for Q&A between models.

    Parses questions from worker outputs, routes them to target workers,
    collects answers, and returns structured Q&A format.

    Expected worker output format:
        QUESTIONS FOR Response [X]:
        1. [Question 1]
        2. [Question 2]

    Returns JSON string with questions and routing metadata:
        {
            "questions": [
                {
                    "from_worker": "worker1",
                    "to_label": "Response A",
                    "questions": ["Q1", "Q2"]
                }
            ],
            "label_to_worker": {"Response A": "worker1", ...}
        }

    Args:
        worker_outputs: Worker outputs containing questions
        memory: Workflow memory
        config: Configuration

    Returns:
        JSON string with structured Q&A data
    """
    import re
    import json

    # Create label-to-worker mapping (Response A, B, C...)
    label_to_worker = {}
    for i, output in enumerate(worker_outputs):
        label = f"Response {chr(65 + i)}"  # A, B, C...
        label_to_worker[label] = output['worker_id']

    # Parse questions from each worker output
    questions_data = []

    for output in worker_outputs:
        worker_id = output['worker_id']
        questions_text = output.get('response', output.get('output', ''))

        # Parse "QUESTIONS FOR Response X:" sections
        pattern = r'QUESTIONS FOR (Response [A-Z]):\s*\n((?:\d+\..*(?:\n|$))+)'
        matches = re.findall(pattern, questions_text, re.MULTILINE)

        for target_label, questions_block in matches:
            # Extract individual questions
            question_lines = re.findall(r'\d+\.\s*(.+)', questions_block)

            if question_lines:
                questions_data.append({
                    "from_worker": worker_id,
                    "to_label": target_label,
                    "questions": [q.strip() for q in question_lines]
                })

    # Build result structure
    result = {
        "questions": questions_data,
        "label_to_worker": label_to_worker
    }

    return json.dumps(result, indent=2)


async def column_wise_summary(
    worker_outputs: List[Dict[str, Any]],
    memory: 'WorkflowMemory',
    config: Dict[str, Any]
) -> str:
    """
    Column-wise summary strategy for perspective-based analysis.

    Groups worker outputs by perspective (column), then summarizes each perspective
    by comparing how different models analyzed it.

    Assumptions:
    - Worker IDs follow format: "{model_name}_{perspective_id}"
    - Each perspective has multiple models analyzing it

    Example:
        Input worker_outputs:
            - gpt-4_security: "..."
            - claude_security: "..."
            - gemini_security: "..."
            - gpt-4_ux: "..."
            - claude_ux: "..."
            - gemini_ux: "..."

        Output (JSON string):
            {
                "security": "GPT-4 emphasized X, Claude noted Y, Gemini highlighted Z...",
                "ux": "All models agreed on A, but GPT-4 uniquely identified B..."
            }

    Args:
        worker_outputs: Worker outputs with perspective-based worker IDs
        memory: Workflow memory
        config: Configuration with model_ref, chairman_instructions, messages

    Returns:
        JSON string mapping perspective_id to summary
    """
    import json
    from collections import defaultdict
    from .openrouter import query_model

    model_ref = config['model_ref']
    chairman_instructions = config.get('chairman_instructions', '')
    messages = config.get('messages', [])
    visibility = config.get('visibility', {})

    # Group outputs by perspective
    # Parse worker_id format: "{model_name}_{perspective_id}"
    perspective_outputs = defaultdict(dict)

    for output in worker_outputs:
        worker_id = output['worker_id']

        # Split worker_id to extract model and perspective
        # Handle multi-part model names (e.g., "gpt-4-turbo_security")
        parts = worker_id.split('_')
        if len(parts) >= 2:
            # Last part is perspective_id, everything before is model name
            perspective_id = parts[-1]
            model_name = '_'.join(parts[:-1])

            perspective_outputs[perspective_id][model_name] = output.get('response', output.get('output', ''))

    # If no perspectives found, fall back to simple summary
    if not perspective_outputs:
        return await simple_summary(worker_outputs, memory, config)

    # Synthesize each perspective column-wise
    perspective_summaries = {}

    for perspective_id, model_outputs in perspective_outputs.items():
        # Format outputs for this perspective
        outputs_text = "\n\n".join([
            f"**{model_name}**: {output}"
            for model_name, output in model_outputs.items()
        ])

        # Include original input if visibility allows
        original_input = ""
        if visibility.get('include_original_input', True) and messages:
            user_query = messages[-1]['content']
            original_input = f"Original Question: {user_query}\n\n"

        # Build perspective-specific synthesis prompt
        perspective_prompt = f"""You are synthesizing multiple models' analyses of the "{perspective_id}" perspective.

{original_input}Perspective: {perspective_id}

Different models analyzed this perspective:
{outputs_text}

{chairman_instructions}

Your task: Compare and synthesize how different models analyzed this perspective.
- Identify common themes and consensus
- Note unique insights from specific models
- Highlight any disagreements or different emphasis
- Provide a balanced synthesis that captures the full picture

Provide a clear synthesis for the "{perspective_id}" perspective:"""

        # Build messages for this perspective
        perspective_messages = messages[:-1] + [{"role": "user", "content": perspective_prompt}] if messages else [{"role": "user", "content": perspective_prompt}]

        # Query model to synthesize this perspective
        response = await query_model(model_ref, perspective_messages)

        if response is None:
            perspective_summaries[perspective_id] = "Error: Unable to generate synthesis for this perspective."
        else:
            perspective_summaries[perspective_id] = response.get('content', '')

    # Return as JSON string (structured output)
    return json.dumps(perspective_summaries, indent=2)
