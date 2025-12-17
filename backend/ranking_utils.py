"""
Shared utilities for ranking and peer review functionality.

This module contains reusable functions for anonymizing responses,
building ranking prompts, parsing rankings, and calculating aggregates.
Used by both council.py (Stage 2) and workflow_reducers.py (score_and_rank).
"""

import re
from typing import List, Dict, Any, Tuple
from collections import defaultdict


def create_anonymous_labels(
    responses: List[Dict[str, Any]],
    id_field: str = 'model'
) -> Tuple[List[str], Dict[str, str]]:
    """
    Create anonymous labels (Response A, B, C...) for responses.

    Handles label overflow for > 26 responses by using numeric format.

    Args:
        responses: List of response dicts
        id_field: Field name to use as the identifier (default: 'model')

    Returns:
        Tuple of (labels_list, label_to_id_mapping)

    Examples:
        >>> responses = [{'model': 'gpt-4'}, {'model': 'claude'}]
        >>> labels, mapping = create_anonymous_labels(responses)
        >>> labels
        ['A', 'B']
        >>> mapping
        {'Response A': 'gpt-4', 'Response B': 'claude'}
    """
    labels = []
    label_to_id = {}

    for i, response in enumerate(responses):
        # For first 26 responses, use A-Z
        if i < 26:
            label = chr(65 + i)  # A, B, C, ...
        else:
            # For overflow, use numeric format: 27, 28, 29...
            label = str(i + 1)

        labels.append(label)
        response_id = response.get(id_field, f'unknown_{i}')
        label_to_id[f"Response {label}"] = response_id

    return labels, label_to_id


def build_ranking_prompt(
    question: str,
    responses: Dict[str, str],
    custom_instructions: str = None
) -> str:
    """
    Build a ranking prompt with anonymized responses.

    Args:
        question: The original user question
        responses: Dict mapping labels to response text (e.g., {'Response A': '...', 'Response B': '...'})
        custom_instructions: Optional custom criteria for evaluation

    Returns:
        Complete ranking prompt string

    Example:
        >>> responses = {'Response A': 'Answer 1', 'Response B': 'Answer 2'}
        >>> prompt = build_ranking_prompt("What is AI?", responses)
    """
    # Build responses section
    responses_text = "\n\n".join([
        f"{label}:\n{text}"
        for label, text in responses.items()
    ])

    # Default evaluation criteria
    evaluation_criteria = custom_instructions or (
        "First, evaluate each response individually. For each response, explain what it does well and what it does poorly."
    )

    ranking_prompt = f"""You are evaluating different responses to the following question:

Question: {question}

Here are the responses from different models (anonymized):

{responses_text}

Your task:
1. {evaluation_criteria}
2. Then, at the very end of your response, provide a final ranking.

IMPORTANT: Your final ranking MUST be formatted EXACTLY as follows:
- Start with the line "FINAL RANKING:" (all caps, with colon)
- Then list the responses from best to worst as a numbered list
- Each line should be: number, period, space, then ONLY the response label (e.g., "1. Response A")
- Do not add any other text or explanations in the ranking section

Example of the correct format for your ENTIRE response:

Response A provides good detail on X but misses Y...
Response B is accurate but lacks depth on Z...
Response C offers the most comprehensive answer...

FINAL RANKING:
1. Response C
2. Response A
3. Response B

Now provide your evaluation and ranking:"""

    return ranking_prompt


def parse_ranking_from_text(ranking_text: str) -> List[str]:
    """
    Parse the FINAL RANKING section from the model's response.

    Supports both letter-based (Response A, B, C) and numeric (Response 1, 2, 3) formats.

    Args:
        ranking_text: The full text response from the model

    Returns:
        List of response labels in ranked order

    Example:
        >>> text = "Response A is good...\n\nFINAL RANKING:\n1. Response C\n2. Response A\n3. Response B"
        >>> parse_ranking_from_text(text)
        ['Response C', 'Response A', 'Response B']
    """
    # Look for "FINAL RANKING:" section
    if "FINAL RANKING:" in ranking_text:
        # Extract everything after "FINAL RANKING:"
        parts = ranking_text.split("FINAL RANKING:")
        if len(parts) >= 2:
            ranking_section = parts[1]

            # Try to extract numbered list format (e.g., "1. Response A" or "1. Response 1")
            # Pattern supports both letter and numeric labels
            numbered_matches = re.findall(r'\d+\.\s*Response [A-Z0-9]+', ranking_section)
            if numbered_matches:
                # Extract just the "Response X" part
                return [re.search(r'Response [A-Z0-9]+', m).group() for m in numbered_matches]

            # Fallback: Extract all "Response X" patterns in order
            matches = re.findall(r'Response [A-Z0-9]+', ranking_section)
            return matches

    # Fallback: try to find any "Response X" patterns in order
    matches = re.findall(r'Response [A-Z0-9]+', ranking_text)
    return matches


def calculate_aggregate_rankings_simple(
    rankings: List[Dict[str, Any]],
    label_to_id: Dict[str, str],
    id_field: str = 'model'
) -> List[Dict[str, Any]]:
    """
    Calculate aggregate rankings using simple average position algorithm.

    Args:
        rankings: List of ranking dicts, each containing:
            - 'ranking' or 'ranking_text': Full ranking text
            - 'parsed_ranking': Optional pre-parsed ranking list
        label_to_id: Mapping from anonymous labels to identifiers
        id_field: Field name for the identifier in output (default: 'model')

    Returns:
        List of dicts with identifier, average rank, and count, sorted best to worst

    Example:
        >>> rankings = [
        ...     {'ranking': 'FINAL RANKING:\n1. Response A\n2. Response B'},
        ...     {'ranking': 'FINAL RANKING:\n1. Response B\n2. Response A'}
        ... ]
        >>> label_to_id = {'Response A': 'gpt-4', 'Response B': 'claude'}
        >>> calculate_aggregate_rankings_simple(rankings, label_to_id)
        [{'model': 'gpt-4', 'average_rank': 1.5, 'rankings_count': 2, 'rank_position': 1},
         {'model': 'claude', 'average_rank': 1.5, 'rankings_count': 2, 'rank_position': 2}]
    """
    # Track positions for each identifier
    id_positions = defaultdict(list)

    for ranking in rankings:
        # Get ranking text - support both field names
        ranking_text = ranking.get('ranking') or ranking.get('ranking_text', '')

        # Use pre-parsed ranking if available, otherwise parse it
        if 'parsed_ranking' in ranking and ranking['parsed_ranking']:
            parsed_ranking = ranking['parsed_ranking']
        else:
            parsed_ranking = parse_ranking_from_text(ranking_text)

        # Track position for each response
        for position, label in enumerate(parsed_ranking, start=1):
            if label in label_to_id:
                identifier = label_to_id[label]
                id_positions[identifier].append(position)

    # Calculate average position for each identifier
    aggregate = []
    for identifier, positions in id_positions.items():
        if positions:
            avg_rank = sum(positions) / len(positions)
            aggregate.append({
                id_field: identifier,
                "average_rank": round(avg_rank, 2),
                "rankings_count": len(positions),
                "individual_positions": positions
            })

    # Sort by average rank (lower is better), then by identifier for tie-breaking
    aggregate.sort(key=lambda x: (x['average_rank'], x[id_field]))

    # Add rank_position field
    for i, item in enumerate(aggregate, start=1):
        item['rank_position'] = i

    return aggregate


def calculate_aggregate_rankings(
    evaluator_rankings: List[Dict[str, Any]],
    label_to_worker: Dict[str, str],
    algorithm: str = "average_position",
    id_field: str = 'worker_id'
) -> List[Dict[str, Any]]:
    """
    Calculate aggregate rankings using the specified algorithm.

    Supports multiple ranking algorithms:
    - average_position: Simple average of rank positions (default)
    - borda_count: Borda count voting
    - ranked_pairs: Tideman's ranked pairs method
    - schulze: Schulze method (beatpath)

    Args:
        evaluator_rankings: List of dicts with 'parsed_ranking' or 'ranking' keys
        label_to_worker: Mapping from anonymous labels to worker/model IDs
        algorithm: Ranking algorithm to use
        id_field: Field name for the identifier in output

    Returns:
        List of dicts with worker_id, score, rank, sorted by rank (best first)
    """
    if algorithm == "average_position":
        result = calculate_aggregate_rankings_simple(
            evaluator_rankings,
            label_to_worker,
            id_field=id_field
        )
        # Rename fields for consistency
        for item in result:
            item['score'] = item['average_rank']
            item['rank'] = item['rank_position']
            item['algorithm'] = 'average_position'
        return result

    elif algorithm in ["borda_count", "ranked_pairs", "schulze"]:
        # Import ranking algorithms
        from backend.ranking_algorithms import (
            borda_count,
            ranked_pairs,
            schulze_method
        )

        # Extract parsed rankings
        parsed_rankings = []
        for ranking in evaluator_rankings:
            if 'parsed_ranking' in ranking and ranking['parsed_ranking']:
                parsed_rankings.append(ranking['parsed_ranking'])
            else:
                ranking_text = ranking.get('ranking') or ranking.get('ranking_text', '')
                parsed_rankings.append(parse_ranking_from_text(ranking_text))

        # Apply algorithm
        if algorithm == "borda_count":
            sorted_labels = borda_count(parsed_rankings)
        elif algorithm == "ranked_pairs":
            sorted_labels = ranked_pairs(parsed_rankings)
        else:  # schulze
            sorted_labels = schulze_method(parsed_rankings)

        # Convert to result format
        aggregate = []
        for rank, label in enumerate(sorted_labels, start=1):
            if label in label_to_worker:
                aggregate.append({
                    id_field: label_to_worker[label],
                    "rank": rank,
                    "score": rank,
                    "algorithm": algorithm
                })

        return aggregate

    else:
        raise ValueError(
            f"Unknown ranking algorithm: {algorithm}. "
            f"Supported: average_position, borda_count, ranked_pairs, schulze"
        )


def format_conversation_history(
    superstep_results: List[Dict[str, Any]],
    worker_id_to_label: Dict[str, str] = None,
    original_input: str = None,
    mask_identities: bool = True
) -> str:
    """
    Format conversation history from multiple supersteps with optional anonymization.

    Args:
        superstep_results: List of superstep result dictionaries
        worker_id_to_label: Mapping from worker IDs to anonymous labels (optional)
        original_input: Original user query (prepended if provided)
        mask_identities: Whether to replace worker IDs with anonymous labels

    Returns:
        Formatted conversation string ready for evaluator prompts
    """
    parts = []

    # Add original input if provided
    if original_input:
        parts.append(f"Original Question: {original_input}\n")

    # Process each superstep
    for superstep in superstep_results:
        # Handle different superstep result formats
        worker_outputs = superstep.get('worker_outputs', [])

        for output in worker_outputs:
            worker_id = output.get('worker_id', 'Unknown')
            content = output.get('output', output.get('response', ''))

            # Determine display name
            if mask_identities and worker_id_to_label and worker_id in worker_id_to_label:
                display_name = worker_id_to_label[worker_id]
            else:
                display_name = worker_id

            parts.append(f"{display_name}:\n{content}\n")

    return "\n".join(parts)


def format_leaderboard(
    aggregate_rankings: List[Dict[str, Any]],
    model_refs: Dict[str, str] = None,
    label_to_worker: Dict[str, str] = None
) -> Dict[str, Any]:
    """
    Format aggregate rankings as a "street ranking card" leaderboard.
    Groups rankings by model and aggregates scores.

    Args:
        aggregate_rankings: Output from calculate_aggregate_rankings()
        model_refs: Optional mapping from worker_id to model reference
        label_to_worker: Optional label mapping for metadata

    Returns:
        Dictionary with 'leaderboard' and 'metadata' keys
    """
    from datetime import datetime

    badges = {
        1: "🥇",
        2: "🥈",
        3: "🥉"
    }

    id_field = 'worker_id' if 'worker_id' in aggregate_rankings[0] else 'model'

    # Group by model and aggregate scores
    model_scores = {}
    for entry in aggregate_rankings:
        worker_id = entry.get(id_field, 'Unknown')
        model_ref = model_refs.get(worker_id, worker_id) if model_refs else worker_id
        score = entry.get('score', entry.get('average_rank', 0))

        if model_ref not in model_scores:
            model_scores[model_ref] = {
                'scores': [],
                'worker_ids': []
            }
        model_scores[model_ref]['scores'].append(score)
        model_scores[model_ref]['worker_ids'].append(worker_id)

    # Calculate average score per model
    model_aggregates = []
    for model_ref, data in model_scores.items():
        avg_score = sum(data['scores']) / len(data['scores'])
        model_aggregates.append({
            'model_ref': model_ref,
            'avg_score': avg_score,
            'worker_count': len(data['scores']),
            'worker_ids': data['worker_ids'],
            'individual_scores': data['scores']
        })

    # Sort by average score (lower is better)
    model_aggregates.sort(key=lambda x: x['avg_score'])

    # Create leaderboard with model-level aggregates
    leaderboard = []
    for rank, entry in enumerate(model_aggregates, start=1):
        # Calculate consensus based on variance of individual scores
        if len(entry['individual_scores']) > 1:
            variance = sum((s - entry['avg_score']) ** 2 for s in entry['individual_scores']) / len(entry['individual_scores'])
            if variance < 0.5:
                consensus = "unanimous"
            elif variance < 1.5:
                consensus = "strong"
            elif variance < 3.0:
                consensus = "moderate"
            else:
                consensus = "weak"
        else:
            consensus = "single"

        leaderboard.append({
            "rank": rank,
            "model_ref": entry['model_ref'],
            "avg_score": entry['avg_score'],
            "worker_count": entry['worker_count'],
            "badge": badges.get(rank, ""),
            "evaluator_consensus": consensus,
            "individual_scores": entry['individual_scores']
        })

    metadata = {
        "total_evaluated": len(aggregate_rankings),
        "total_models": len(model_aggregates),
        "algorithm": aggregate_rankings[0].get('algorithm', 'unknown') if aggregate_rankings else "unknown",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "grouping": "by_model"
    }

    if label_to_worker:
        metadata['label_to_worker'] = label_to_worker

    return {
        "leaderboard": leaderboard,
        "metadata": metadata
    }
