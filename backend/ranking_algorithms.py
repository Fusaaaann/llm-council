"""
Voting/Ranking Algorithms for LLM Council

Implements three voting methods for aggregating model rankings:
1. Ranked Pairs (Tideman): Constructs ranking from strongest pairwise victories
2. Schulze Method: Path-based Condorcet method using strongest paths
3. Borda Count: Simple positional scoring system

These are NOT currently integrated into the council.py deliberation system.
They are available for future experimentation with alternative ranking aggregation.

All methods are drop-in compatible with calculate_aggregate_rankings() from council.py.
They accept the same inputs (stage2_results, label_to_model) and return the same format.
"""

from typing import List, Dict, Any
from collections import defaultdict
import re


def ranked_pairs(rankings: List[List[str]]) -> List[str]:
    """
    Ranked Pairs (Tideman) method.

    Constructs a ranking by considering pairwise victories in order of strength,
    adding each edge that doesn't create a cycle.

    Args:
        rankings: List of rankings, where each ranking is a list of candidate IDs
                 ordered from best (index 0) to worst (index -1).
                 Example: [["A", "B", "C"], ["B", "A", "C"], ...]

    Returns:
        Aggregated ranking as list of candidate IDs from best to worst.

    Algorithm:
        1. Compute pairwise preference matrix
        2. Sort pairs by strength of victory (margin)
        3. Lock pairs in order, skipping any that create cycles
        4. Generate final ranking from locked pairs
    """
    if not rankings:
        return []

    # Get all candidates
    candidates = set()
    for ranking in rankings:
        candidates.update(ranking)
    candidates = list(candidates)

    # Step 1: Build pairwise preference matrix
    # pairwise[A][B] = number of voters who prefer A over B
    pairwise = defaultdict(lambda: defaultdict(int))

    for ranking in rankings:
        for i, cand_a in enumerate(ranking):
            for cand_b in ranking[i + 1:]:
                pairwise[cand_a][cand_b] += 1

    # Step 2: Create list of pairs with victory margins, sorted by strength
    pairs = []
    for cand_a in candidates:
        for cand_b in candidates:
            if cand_a != cand_b:
                margin = pairwise[cand_a][cand_b] - pairwise[cand_b][cand_a]
                if margin > 0:  # A beats B
                    pairs.append((cand_a, cand_b, margin))

    # Sort by margin (strongest victories first)
    pairs.sort(key=lambda x: x[2], reverse=True)

    # Step 3: Lock pairs, skipping those that create cycles
    locked = defaultdict(set)  # locked[A] = set of candidates A beats

    def creates_cycle(source: str, target: str) -> bool:
        """Check if adding edge source->target would create a cycle."""
        visited = set()

        def dfs(node: str) -> bool:
            if node == source:
                return True
            if node in visited:
                return False
            visited.add(node)
            for next_node in locked[node]:
                if dfs(next_node):
                    return True
            return False

        return dfs(target)

    for winner, loser, _ in pairs:
        if not creates_cycle(winner, loser):
            locked[winner].add(loser)

    # Step 4: Generate final ranking using topological sort
    in_degree = {c: 0 for c in candidates}
    for winner in locked:
        for loser in locked[winner]:
            in_degree[loser] += 1

    result = []
    available = [c for c in candidates if in_degree[c] == 0]

    while available:
        # Sort available candidates to ensure deterministic ordering
        available.sort()
        current = available.pop(0)
        result.append(current)

        for loser in locked[current]:
            in_degree[loser] -= 1
            if in_degree[loser] == 0:
                available.append(loser)

    return result


def schulze_method(rankings: List[List[str]]) -> List[str]:
    """
    Schulze Method (Beatpath).

    Determines winners based on strongest paths of pairwise victories.
    A candidate A is ranked above B if the strongest path from A to B
    is stronger than the strongest path from B to A.

    Args:
        rankings: List of rankings, where each ranking is a list of candidate IDs
                 ordered from best (index 0) to worst (index -1).

    Returns:
        Aggregated ranking as list of candidate IDs from best to worst.

    Algorithm:
        1. Compute pairwise preference matrix
        2. Compute strongest paths using Floyd-Warshall-like algorithm
        3. Rank candidates by comparing strongest paths
    """
    if not rankings:
        return []

    # Get all candidates
    candidates = set()
    for ranking in rankings:
        candidates.update(ranking)
    candidates = list(candidates)
    n = len(candidates)

    # Create index mapping
    cand_to_idx = {c: i for i, c in enumerate(candidates)}

    # Step 1: Build pairwise preference matrix
    pairwise = [[0] * n for _ in range(n)]

    for ranking in rankings:
        for i, cand_a in enumerate(ranking):
            for cand_b in ranking[i + 1:]:
                idx_a = cand_to_idx[cand_a]
                idx_b = cand_to_idx[cand_b]
                pairwise[idx_a][idx_b] += 1

    # Step 2: Compute strongest paths
    # strongest[i][j] = strength of strongest path from i to j
    strongest = [[0] * n for _ in range(n)]

    # Initialize with direct victories
    for i in range(n):
        for j in range(n):
            if i != j:
                if pairwise[i][j] > pairwise[j][i]:
                    strongest[i][j] = pairwise[i][j]

    # Floyd-Warshall-like algorithm to find strongest paths
    for k in range(n):
        for i in range(n):
            for j in range(n):
                if i != j and k != i and k != j:
                    # Path through k: min of (i->k) and (k->j)
                    path_strength = min(strongest[i][k], strongest[k][j])
                    strongest[i][j] = max(strongest[i][j], path_strength)

    # Step 3: Rank candidates
    # Candidate i beats j if strongest[i][j] > strongest[j][i]
    wins = [0] * n
    for i in range(n):
        for j in range(n):
            if i != j and strongest[i][j] > strongest[j][i]:
                wins[i] += 1

    # Sort by number of wins (descending)
    ranked_indices = sorted(range(n), key=lambda i: wins[i], reverse=True)
    result = [candidates[i] for i in ranked_indices]

    return result


def borda_count(rankings: List[List[str]]) -> List[str]:
    """
    Borda Count method.

    Simple positional scoring where candidates receive points based on their
    position in each ranking. First place gets (n-1) points, second gets (n-2), etc.

    Args:
        rankings: List of rankings, where each ranking is a list of candidate IDs
                 ordered from best (index 0) to worst (index -1).

    Returns:
        Aggregated ranking as list of candidate IDs from best to worst.

    Algorithm:
        1. For each ranking, assign points: (n-1) for 1st, (n-2) for 2nd, etc.
        2. Sum points for each candidate
        3. Sort by total points (descending)
    """
    if not rankings:
        return []

    # Get all candidates
    candidates = set()
    for ranking in rankings:
        candidates.update(ranking)
    n = len(candidates)

    # Calculate scores
    scores = defaultdict(int)

    for ranking in rankings:
        for position, candidate in enumerate(ranking):
            # Position 0 gets (n-1) points, position 1 gets (n-2), etc.
            points = n - 1 - position
            scores[candidate] += points

    # Sort by score (descending), then alphabetically for ties
    result = sorted(candidates, key=lambda c: (-scores[c], c))

    return result


def parse_ranking_from_text(ranking_text: str) -> List[str]:
    """
    Parse the FINAL RANKING section from the model's response.

    This is a copy of the function from council.py to make the algorithms
    self-contained and drop-in compatible.

    Args:
        ranking_text: The full text response from the model

    Returns:
        List of response labels in ranked order (e.g., ["Response A", "Response B", ...])
    """
    # Look for "FINAL RANKING:" section
    if "FINAL RANKING:" in ranking_text:
        # Extract everything after "FINAL RANKING:"
        parts = ranking_text.split("FINAL RANKING:")
        if len(parts) >= 2:
            ranking_section = parts[1]
            # Try to extract numbered list format (e.g., "1. Response A")
            numbered_matches = re.findall(r'\d+\.\s*Response [A-Z]', ranking_section)
            if numbered_matches:
                # Extract just the "Response X" part
                return [re.search(r'Response [A-Z]', m).group() for m in numbered_matches]

            # Fallback: Extract all "Response X" patterns in order
            matches = re.findall(r'Response [A-Z]', ranking_section)
            return matches

    # Fallback: try to find any "Response X" patterns in order
    matches = re.findall(r'Response [A-Z]', ranking_text)
    return matches


def calculate_aggregate_rankings_ranked_pairs(
    stage2_results: List[Dict[str, Any]],
    label_to_model: Dict[str, str]
) -> List[Dict[str, Any]]:
    """
    Calculate aggregate rankings using Ranked Pairs (Tideman) method.

    Drop-in replacement for calculate_aggregate_rankings() from council.py.

    Args:
        stage2_results: Rankings from each model (list of dicts with 'model' and 'ranking' keys)
        label_to_model: Mapping from anonymous labels (e.g., "Response A") to model names

    Returns:
        List of dicts with 'model', 'rank', and 'method' keys, sorted best to worst
    """
    # Parse all rankings
    parsed_rankings = []
    for ranking in stage2_results:
        ranking_text = ranking['ranking']
        parsed_ranking = parse_ranking_from_text(ranking_text)
        parsed_rankings.append(parsed_ranking)

    # Apply ranked pairs algorithm
    aggregate_labels = ranked_pairs(parsed_rankings)

    # Convert back to model names with ranks
    result = []
    for rank, label in enumerate(aggregate_labels, start=1):
        if label in label_to_model:
            result.append({
                "model": label_to_model[label],
                "rank": rank,
                "method": "ranked_pairs"
            })

    return result


def calculate_aggregate_rankings_schulze(
    stage2_results: List[Dict[str, Any]],
    label_to_model: Dict[str, str]
) -> List[Dict[str, Any]]:
    """
    Calculate aggregate rankings using Schulze method.

    Drop-in replacement for calculate_aggregate_rankings() from council.py.

    Args:
        stage2_results: Rankings from each model (list of dicts with 'model' and 'ranking' keys)
        label_to_model: Mapping from anonymous labels (e.g., "Response A") to model names

    Returns:
        List of dicts with 'model', 'rank', and 'method' keys, sorted best to worst
    """
    # Parse all rankings
    parsed_rankings = []
    for ranking in stage2_results:
        ranking_text = ranking['ranking']
        parsed_ranking = parse_ranking_from_text(ranking_text)
        parsed_rankings.append(parsed_ranking)

    # Apply Schulze method
    aggregate_labels = schulze_method(parsed_rankings)

    # Convert back to model names with ranks
    result = []
    for rank, label in enumerate(aggregate_labels, start=1):
        if label in label_to_model:
            result.append({
                "model": label_to_model[label],
                "rank": rank,
                "method": "schulze"
            })

    return result


def calculate_aggregate_rankings_borda(
    stage2_results: List[Dict[str, Any]],
    label_to_model: Dict[str, str]
) -> List[Dict[str, Any]]:
    """
    Calculate aggregate rankings using Borda Count method.

    Drop-in replacement for calculate_aggregate_rankings() from council.py.

    Args:
        stage2_results: Rankings from each model (list of dicts with 'model' and 'ranking' keys)
        label_to_model: Mapping from anonymous labels (e.g., "Response A") to model names

    Returns:
        List of dicts with 'model', 'rank', and 'method' keys, sorted best to worst
    """
    # Parse all rankings
    parsed_rankings = []
    for ranking in stage2_results:
        ranking_text = ranking['ranking']
        parsed_ranking = parse_ranking_from_text(ranking_text)
        parsed_rankings.append(parsed_ranking)

    # Apply Borda count
    aggregate_labels = borda_count(parsed_rankings)

    # Convert back to model names with ranks
    result = []
    for rank, label in enumerate(aggregate_labels, start=1):
        if label in label_to_model:
            result.append({
                "model": label_to_model[label],
                "rank": rank,
                "method": "borda_count"
            })

    return result


def compare_methods(rankings: List[List[str]]) -> Dict[str, List[str]]:
    """
    Compare all three ranking methods on the same input.

    Args:
        rankings: List of rankings to aggregate.

    Returns:
        Dictionary with keys 'ranked_pairs', 'schulze', 'borda_count'
        and values as the resulting rankings from each method.
    """
    return {
        'ranked_pairs': ranked_pairs(rankings),
        'schulze': schulze_method(rankings),
        'borda_count': borda_count(rankings)
    }


def compare_methods_with_stage2_data(
    stage2_results: List[Dict[str, Any]],
    label_to_model: Dict[str, str]
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Compare all three ranking methods using stage2 data format.

    Args:
        stage2_results: Rankings from each model
        label_to_model: Mapping from anonymous labels to model names

    Returns:
        Dictionary with keys 'ranked_pairs', 'schulze', 'borda_count'
        and values as the resulting aggregate rankings from each method.
    """
    return {
        'ranked_pairs': calculate_aggregate_rankings_ranked_pairs(stage2_results, label_to_model),
        'schulze': calculate_aggregate_rankings_schulze(stage2_results, label_to_model),
        'borda_count': calculate_aggregate_rankings_borda(stage2_results, label_to_model)
    }


# Example usage and testing
if __name__ == "__main__":
    print("=" * 60)
    print("Example 1: Simple rankings with list of lists")
    print("=" * 60)

    # Example: 3 voters ranking 4 candidates
    test_rankings = [
        ["A", "C", "B", "D"],  # Voter 1: A > C > B > D
        ["B", "A", "C", "D"],  # Voter 2: B > A > C > D
        ["C", "B", "A", "D"],  # Voter 3: C > B > A > D
    ]

    print("\nTest Rankings:")
    for i, ranking in enumerate(test_rankings, 1):
        print(f"  Voter {i}: {' > '.join(ranking)}")
    print()

    results = compare_methods(test_rankings)

    print("Results:")
    print(f"  Ranked Pairs:  {' > '.join(results['ranked_pairs'])}")
    print(f"  Schulze:       {' > '.join(results['schulze'])}")
    print(f"  Borda Count:   {' > '.join(results['borda_count'])}")

    print("\n" + "=" * 60)
    print("Example 2: Stage2 data format (drop-in compatible)")
    print("=" * 60)

    # Simulate stage2_results format from council.py
    stage2_results = [
        {
            "model": "openai/gpt-4",
            "ranking": """
            FINAL RANKING:
            1. Response A
            2. Response C
            3. Response B
            """
        },
        {
            "model": "anthropic/claude-3",
            "ranking": """
            FINAL RANKING:
            1. Response B
            2. Response A
            3. Response C
            """
        },
        {
            "model": "google/gemini-pro",
            "ranking": """
            FINAL RANKING:
            1. Response C
            2. Response B
            3. Response A
            """
        }
    ]

    label_to_model = {
        "Response A": "openai/gpt-4-turbo",
        "Response B": "anthropic/claude-3-opus",
        "Response C": "google/gemini-ultra"
    }

    print("\nStage 2 Rankings:")
    for result in stage2_results:
        parsed = parse_ranking_from_text(result['ranking'])
        print(f"  {result['model']}: {' > '.join(parsed)}")
    print()

    stage2_comparison = compare_methods_with_stage2_data(stage2_results, label_to_model)

    print("Results (with model names):")
    for method_name, rankings in stage2_comparison.items():
        print(f"\n  {method_name.replace('_', ' ').title()}:")
        for entry in rankings:
            print(f"    {entry['rank']}. {entry['model']}")

    print("\n" + "=" * 60)
    print("To use as drop-in replacement in council.py:")
    print("=" * 60)
    print("""
    # Instead of:
    from .council import calculate_aggregate_rankings
    aggregate = calculate_aggregate_rankings(stage2_results, label_to_model)

    # Use:
    from .ranking_algorithms import calculate_aggregate_rankings_schulze
    aggregate = calculate_aggregate_rankings_schulze(stage2_results, label_to_model)

    # Or compare all three:
    from .ranking_algorithms import compare_methods_with_stage2_data
    all_methods = compare_methods_with_stage2_data(stage2_results, label_to_model)
    """)
