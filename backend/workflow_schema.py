"""Workflow JSON schema validation with resource limits."""

import json
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from jsonschema import validate, ValidationError


# Resource limits (security and performance)
MAX_SUPERSTEPS = 20
MAX_WORKERS_PER_STEP = 20  # Increased for perspective_matrix (e.g., 5 models × 4 perspectives)
MAX_CONCURRENCY = 5
MAX_GLOBAL_TIMEOUT_MS = 600000  # 10 min
MAX_STEP_TIMEOUT_MS = 120000    # 2 min
MAX_VARIABLE_SIZE_BYTES = 1048576  # 1MB


def load_schema() -> Dict[str, Any]:
    """Load workflow schema from dsl-schema.json."""
    schema_path = Path(__file__).parent.parent / 'dsl-schema.json'
    with open(schema_path, 'r') as f:
        return json.load(f)


def validate_workflow(workflow: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate workflow against schema.

    Args:
        workflow: Workflow definition dict

    Returns:
        Tuple of (is_valid, error_message)
    """
    schema = load_schema()

    # Basic schema validation
    try:
        validate(instance=workflow, schema=schema)
    except ValidationError as e:
        return False, f"Schema validation failed: {e.message}"

    # Custom validations
    error = validate_resource_limits(workflow)
    if error:
        return False, error

    error = validate_variable_consistency(workflow)
    if error:
        return False, error

    error = validate_worker_ids_unique(workflow)
    if error:
        return False, error

    # Model validation (async, done separately via validate_workflow_models)

    return True, None


def validate_resource_limits(workflow: Dict[str, Any]) -> Optional[str]:
    """Validate resource limits."""

    # Check global timeout
    global_timeout = workflow.get('global_timeout_ms', 60000)
    if global_timeout > MAX_GLOBAL_TIMEOUT_MS:
        return f"global_timeout_ms exceeds maximum: {MAX_GLOBAL_TIMEOUT_MS}ms"

    # Check superstep count
    supersteps = workflow.get('supersteps', [])
    if len(supersteps) > MAX_SUPERSTEPS:
        return f"Too many supersteps: {len(supersteps)} > {MAX_SUPERSTEPS}"

    # Check each superstep
    for i, superstep in enumerate(supersteps):
        map_phase = superstep.get('map_phase', {})

        # Calculate worker count (either explicit or from perspective_matrix)
        worker_count = 0
        if 'workers' in map_phase:
            worker_count = len(map_phase['workers'])
        elif 'perspective_matrix' in map_phase:
            matrix = map_phase['perspective_matrix']

            # Determine model count
            if 'models' in matrix:
                # Legacy: explicit models in matrix
                model_count = len(matrix['models'])
            else:
                # Use global models with filtering
                global_models = workflow.get('models', [])
                use_models = matrix.get('use_models', 'all')

                if use_models == 'all':
                    model_count = len(global_models)
                elif use_models in ['whitelist', 'blacklist']:
                    models_filter = matrix.get('models_filter', [])
                    if use_models == 'whitelist':
                        model_count = len([m for m in global_models if m in models_filter])
                    else:  # blacklist
                        model_count = len([m for m in global_models if m not in models_filter])
                else:
                    model_count = len(global_models)

            perspective_count = len(matrix.get('perspectives', []))
            worker_count = model_count * perspective_count

        if worker_count > MAX_WORKERS_PER_STEP:
            return f"Superstep {i}: Too many workers: {worker_count} > {MAX_WORKERS_PER_STEP}"

        # Check concurrency limit
        concurrency = map_phase.get('concurrency_limit', worker_count)
        if concurrency > MAX_CONCURRENCY:
            return f"Superstep {i}: Concurrency limit too high: {concurrency} > {MAX_CONCURRENCY}"

        # Check reduce timeout
        timeout = superstep.get('reduce_phase', {}).get('timeout_ms', 30000)
        if timeout > MAX_STEP_TIMEOUT_MS:
            return f"Superstep {i}: Timeout exceeds maximum: {timeout}ms > {MAX_STEP_TIMEOUT_MS}ms"

    return None


def validate_variable_consistency(workflow: Dict[str, Any]) -> Optional[str]:
    """Validate variable read/write consistency."""

    # Get defined variables
    defined_vars = {v['name'] for v in workflow.get('variables', [])}

    # Check that all output_write_to variables are defined
    for i, superstep in enumerate(workflow.get('supersteps', [])):
        output_var = superstep.get('reduce_phase', {}).get('output_write_to')
        if output_var and output_var not in defined_vars:
            return f"Superstep {i}: output_write_to variable '{output_var}' not defined"

    return None


def validate_worker_ids_unique(workflow: Dict[str, Any]) -> Optional[str]:
    """Validate worker IDs are unique within each superstep."""

    for i, superstep in enumerate(workflow.get('supersteps', [])):
        workers = superstep.get('map_phase', {}).get('workers', [])
        worker_ids = [w['worker_id'] for w in workers]

        if len(worker_ids) != len(set(worker_ids)):
            return f"Superstep {i}: Duplicate worker IDs found"

    return None


async def validate_workflow_models(workflow: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate that all model references exist in OpenRouter.

    Args:
        workflow: Workflow definition dict

    Returns:
        Tuple of (is_valid, error_message)
    """
    from .model_registry import is_valid_model

    # Collect all model refs
    model_refs = set()

    # Add global models
    for model_ref in workflow.get('models', []):
        model_refs.add(model_ref)

    for superstep in workflow.get('supersteps', []):
        map_phase = superstep.get('map_phase', {})

        # Map phase models (explicit workers)
        for worker in map_phase.get('workers', []):
            model_refs.add(worker['model_ref'])

        # Map phase models (perspective_matrix)
        if 'perspective_matrix' in map_phase:
            matrix = map_phase['perspective_matrix']
            # Legacy: explicit models in matrix
            if 'models' in matrix:
                for model_ref in matrix['models']:
                    model_refs.add(model_ref)

        # Reduce phase model
        reduce_model = superstep.get('reduce_phase', {}).get('model_ref')
        if reduce_model:
            model_refs.add(reduce_model)

        # Middleware models (llm_refine)
        for middleware in superstep.get('middleware_phase', []):
            if middleware.get('op') == 'llm_refine':
                config = middleware.get('config', {})
                if 'model_ref' in config:
                    model_refs.add(config['model_ref'])

    # Validate each model
    invalid_models = []
    for model_ref in model_refs:
        if not await is_valid_model(model_ref):
            invalid_models.append(model_ref)

    if invalid_models:
        return False, f"Invalid model references: {', '.join(invalid_models)}"

    return True, None
