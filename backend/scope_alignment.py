"""Scope alignment system for preventing role drift in workflow execution.

Implements a 4-phase approach to ensure agents maintain clear responsibility boundaries:
- Phase 1: Scope Construction - Each agent defines its operational contract
- Phase 2: Scope Alignment - Meta-agent resolves conflicts and creates responsibility map
- Phase 3: Execution - (Handled by workflow_engine.py)
- Phase 4: Post-Execution Audit - (Future enhancement)
"""

import json
import logging
from backend.json_utils import parse_json_safe

logger = logging.getLogger(__name__)
from typing import Dict, Any, List, Optional, Tuple


async def execute_scope_alignment(
    workflow_def: Dict[str, Any],
    task_spec: str,
    config: Dict[str, Any]
) -> Dict[str, Dict[str, str]]:
    """
    Execute the scope alignment process to refine worker role definitions.

    This runs before workflow execution to prevent role drift, overlaps, and gaps.

    Args:
        workflow_def: Complete workflow JSON definition
        task_spec: User's task description (frozen requirement)
        config: Scope alignment configuration

    Returns:
        Dict mapping worker_id to refined scope definition
        Format: {
            "worker1": "SCOPE:\n- Primary responsibility: ...\n...",
            "worker2": "SCOPE:\n- Primary responsibility: ...\n..."
        }
    """
    from .openrouter import query_models_parallel

    coordinator_model = config.get('coordinator_model', 'openai/gpt-4o')

    # Extract all workers from workflow
    workers = _extract_all_workers(workflow_def)

    if not workers:
        return {}

    # PHASE 1: Scope Construction (parallel per-agent)
    agent_scopes = await _phase1_construct_scopes(workers, task_spec, config)

    if not agent_scopes:
        # Alignment failed, return empty dict (fallback to original instructions)
        return {}

    # PHASE 2: Scope Alignment (meta-agent coordination)
    final_scope_map = await _phase2_align_scopes(
        workers,
        task_spec,
        agent_scopes,
        coordinator_model,
        config
    )

    return final_scope_map


async def _phase1_construct_scopes(
    workers: List[Dict[str, Any]],
    task_spec: str,
    config: Dict[str, Any]
) -> Dict[str, str]:
    """
    Phase 1: Each agent independently defines its operational contract.

    Args:
        workers: List of worker definitions
        task_spec: User's task description
        config: Configuration

    Returns:
        Dict mapping worker_id to agent scope definition
    """
    from .openrouter import query_model
    import asyncio

    async def construct_single_scope(worker: Dict[str, Any]) -> Tuple[str, Optional[str]]:
        """Construct scope for a single worker."""
        worker_id = worker['worker_id']
        instruction = worker.get('instruction') or worker.get('role_definition', '')
        model_ref = worker['model_ref']

        # Build scope construction prompt
        prompt = f"""You are defining your operational scope for a multi-agent task.

TASK SPECIFICATION (frozen requirements):
{task_spec}

YOUR ROLE INSTRUCTION:
{instruction}

Your goal: Define your operational contract by answering these questions concisely:

1. Primary Responsibility: What is YOUR core job in this task?
2. Non-Responsibilities: What should you explicitly NOT do?
3. Ownership Boundaries: Where does your work start and end?
4. Dependency Contracts: What do you need from other agents (if anything)?
5. Definition of Done: How will you know your job is complete?

RULES:
- Do NOT perform the task work yet
- Do NOT propose solutions
- ONLY define your operational scope
- Be specific and concrete
- Focus on boundaries and responsibilities

Output your scope definition in this exact format:

PRIMARY RESPONSIBILITY:
[Your answer]

NON-RESPONSIBILITIES:
[Your answer]

OWNERSHIP BOUNDARIES:
[Your answer]

DEPENDENCY CONTRACTS:
[Your answer]

DEFINITION OF DONE:
[Your answer]"""

        messages = [{"role": "user", "content": prompt}]

        # Query model with timeout
        timeout = config.get('scope_construction_timeout_ms', 30000) / 1000.0
        response = await query_model(model_ref, messages, timeout=timeout)

        if response is None:
            return worker_id, None

        return worker_id, response.get('content', '')

    # Execute all scope constructions in parallel
    tasks = [construct_single_scope(worker) for worker in workers]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Build scope map (filter out failures)
    agent_scopes = {}
    for result in results:
        if isinstance(result, tuple) and result[1] is not None:
            worker_id, scope = result
            agent_scopes[worker_id] = scope
        elif isinstance(result, Exception):
            print(f"Scope construction error: {result}")

    return agent_scopes


async def _phase2_align_scopes(
    workers: List[Dict[str, Any]],
    task_spec: str,
    agent_scopes: Dict[str, str],
    coordinator_model: str,
    config: Dict[str, Any]
) -> Dict[str, str]:
    """
    Phase 2: Meta-agent resolves overlaps, gaps, and conflicts.

    Args:
        workers: List of worker definitions
        task_spec: User's task description
        agent_scopes: Dict of worker_id -> scope definition
        coordinator_model: Model to use for coordination
        config: Configuration

    Returns:
        Dict mapping worker_id to finalized scope with instructions
    """
    from .openrouter import query_model

    # Build combined scopes text
    scopes_text = "\n\n".join([
        f"=== AGENT: {worker_id} ===\n{scope}"
        for worker_id, scope in agent_scopes.items()
    ])

    # Build alignment prompt
    prompt = f"""You are a meta-coordinator analyzing agent scopes for conflicts and gaps.

TASK SPECIFICATION:
{task_spec}

AGENT SCOPES (as defined by each agent):
{scopes_text}

Your goal: Create a final responsibility map that:
1. Detects scope conflicts (overlapping responsibilities)
2. Detects missing ownership (gaps in coverage)
3. Assigns final clear responsibilities

RULES:
- Do NOT solve the task itself
- Do NOT redo the agents' work
- ONLY produce a responsibility map
- Resolve conflicts by clarifying boundaries
- Fill gaps by assigning to appropriate agents
- Keep each agent's core purpose intact

Output format (JSON):
{{
  "conflicts_detected": [
    "Brief description of conflict 1",
    "Brief description of conflict 2"
  ],
  "gaps_detected": [
    "Brief description of gap 1"
  ],
  "final_scope_map": {{
    "worker_id_1": {{
      "primary_responsibility": "Clear, specific responsibility",
      "boundaries": "What NOT to do and where work ends",
      "dependencies": "What needed from others (or 'None')",
      "definition_of_done": "Concrete completion criteria"
    }},
    "worker_id_2": {{
      ...
    }}
  }}
}}

Provide ONLY valid JSON, no additional commentary."""

    messages = [{"role": "user", "content": prompt}]

    # Query coordinator model with timeout
    timeout = config.get('alignment_timeout_ms', 30000) / 1000.0
    response = await query_model(coordinator_model, messages, timeout=timeout)

    if response is None:
        # Alignment failed, return original scopes
        return _fallback_to_original_scopes(agent_scopes)

    # Parse JSON response with robust extraction
    success, alignment_result, error = parse_json_safe(
        response.get('content', '{}'),
        expected_type=dict,
        var_name='alignment_result'
    )

    if not success:
        logger.warning(f"Failed to parse alignment result: {error}")
        return _fallback_to_original_scopes(agent_scopes)

    final_scope_map_raw = alignment_result.get('final_scope_map', {})

    # Format final scopes as instruction prefixes
    final_scope_map = {}
    for worker_id, scope_data in final_scope_map_raw.items():
        scope_text = _format_scope_as_instruction(scope_data)
        final_scope_map[worker_id] = scope_text

    return final_scope_map


def _format_scope_as_instruction(scope_data: Dict[str, str]) -> str:
    """Format scope data as instruction prefix."""
    return f"""OPERATIONAL SCOPE (DO NOT DEVIATE):
- Primary Responsibility: {scope_data.get('primary_responsibility', 'Not specified')}
- Boundaries: {scope_data.get('boundaries', 'Not specified')}
- Dependencies: {scope_data.get('dependencies', 'None')}
- Definition of Done: {scope_data.get('definition_of_done', 'Not specified')}

"""


def _fallback_to_original_scopes(agent_scopes: Dict[str, str]) -> Dict[str, str]:
    """Fallback to original agent-defined scopes if alignment fails."""
    fallback_map = {}
    for worker_id, scope in agent_scopes.items():
        fallback_map[worker_id] = f"OPERATIONAL SCOPE:\n{scope}\n\n"
    return fallback_map


def _extract_all_workers(workflow_def: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extract all workers from workflow definition.

    Handles both explicit workers and perspective_matrix.

    Args:
        workflow_def: Workflow definition

    Returns:
        List of worker dicts with worker_id, model_ref, instruction
    """
    workers = []

    for superstep in workflow_def.get('supersteps', []):
        map_phase = superstep.get('map_phase', {})

        # Explicit workers
        if 'workers' in map_phase:
            for worker in map_phase['workers']:
                workers.append({
                    'worker_id': worker['worker_id'],
                    'model_ref': worker['model_ref'],
                    'instruction': worker.get('instruction') or worker.get('role_definition', '')
                })

        # Perspective matrix - expand to workers
        elif 'perspective_matrix' in map_phase:
            matrix = map_phase['perspective_matrix']
            perspectives = matrix.get('perspectives', [])

            # Determine models to use
            global_models = workflow_def.get('models', [])
            use_models = matrix.get('use_models', 'all')
            models_filter = matrix.get('models_filter', [])

            if 'models' in matrix:
                # Legacy: explicit models in matrix
                models = matrix['models']
            elif use_models == 'all':
                models = global_models
            elif use_models == 'whitelist':
                models = [m for m in global_models if m in models_filter]
            elif use_models == 'blacklist':
                models = [m for m in global_models if m not in models_filter]
            else:
                models = global_models

            # Generate workers from cartesian product
            for model_ref in models:
                model_short = model_ref.split('/')[-1]
                for perspective in perspectives:
                    worker_id = f"{model_short}_{perspective['perspective_id']}"
                    workers.append({
                        'worker_id': worker_id,
                        'model_ref': model_ref,
                        'instruction': perspective['instruction']
                    })

    return workers


def apply_scope_to_instruction(
    worker_id: str,
    original_instruction: str,
    scope_map: Dict[str, str]
) -> str:
    """
    Apply refined scope to worker instruction.

    Args:
        worker_id: Worker identifier
        original_instruction: Original instruction text
        scope_map: Dict of worker_id -> scope prefix

    Returns:
        Instruction with scope prepended (or original if no scope available)
    """
    if worker_id not in scope_map:
        return original_instruction

    scope_prefix = scope_map[worker_id]

    return f"""{scope_prefix}ORIGINAL TASK INSTRUCTION:
{original_instruction}"""
