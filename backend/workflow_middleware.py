"""Middleware operations for post-processing worker outputs."""

import re
from typing import List, Dict, Any, Tuple


async def apply_middleware_pipeline(
    worker_outputs: List[Dict[str, Any]],
    middleware_config: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Apply middleware pipeline to worker outputs.

    Args:
        worker_outputs: List of worker output dicts
        middleware_config: List of middleware operation configs

    Returns:
        Tuple of (processed_outputs, rejected_outputs)
    """
    processed = worker_outputs.copy()
    rejected = []

    for operation in middleware_config:
        op_type = operation['op']
        apply_to = operation['apply_to']
        config = operation.get('config', {})

        # Determine which workers to apply to
        if '*' in apply_to:
            target_workers = [w['worker_id'] for w in processed]
        else:
            target_workers = apply_to

        # Apply operation
        if op_type == 'filter_regex':
            processed, new_rejected = await filter_regex(
                processed, target_workers, config
            )
            rejected.extend(new_rejected)

        elif op_type == 'anonymize_pii':
            processed = await anonymize_pii(
                processed, target_workers, config
            )

        elif op_type == 'llm_refine':
            processed = await llm_refine(
                processed, target_workers, config
            )

        elif op_type == 'truncate':
            processed = await truncate(
                processed, target_workers, config
            )

    return processed, rejected


async def filter_regex(
    worker_outputs: List[Dict[str, Any]],
    target_workers: List[str],
    config: Dict[str, Any]
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Filter outputs based on regex pattern.

    Args:
        worker_outputs: Worker outputs
        target_workers: List of worker IDs to apply to
        config: Configuration with 'pattern' and 'action'

    Returns:
        Tuple of (processed_outputs, rejected_outputs)
    """
    pattern = config['pattern']
    action = config['action']
    regex = re.compile(pattern)

    processed = []
    rejected = []

    for output in worker_outputs:
        if output['worker_id'] not in target_workers:
            processed.append(output)
            continue

        text = output.get('response', output.get('output', ''))

        if regex.search(text):
            if action == 'drop':
                rejected.append(output)
            elif action == 'flag':
                output['_flagged'] = True
                output['_flag_reason'] = f"Matched pattern: {pattern}"
                processed.append(output)
        else:
            processed.append(output)

    return processed, rejected


async def anonymize_pii(
    worker_outputs: List[Dict[str, Any]],
    target_workers: List[str],
    config: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Anonymize PII (emails, phone numbers, etc.) in outputs.

    Args:
        worker_outputs: Worker outputs
        target_workers: List of worker IDs to apply to
        config: Configuration (currently unused, defaults to common PII patterns)

    Returns:
        Processed outputs
    """
    # Common PII patterns
    email_pattern = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
    phone_pattern = re.compile(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b')
    ssn_pattern = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')

    processed = []

    for output in worker_outputs:
        if output['worker_id'] not in target_workers:
            processed.append(output)
            continue

        text = output.get('response', output.get('output', ''))

        # Redact PII
        text = email_pattern.sub('[EMAIL]', text)
        text = phone_pattern.sub('[PHONE]', text)
        text = ssn_pattern.sub('[SSN]', text)

        output['response'] = text
        output['_anonymized'] = True
        processed.append(output)

    return processed


async def llm_refine(
    worker_outputs: List[Dict[str, Any]],
    target_workers: List[str],
    config: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Refine outputs using an LLM.

    Args:
        worker_outputs: Worker outputs
        target_workers: List of worker IDs to apply to
        config: Configuration with 'model_ref' and 'instruction'

    Returns:
        Processed outputs
    """
    from .openrouter import query_model

    model_ref = config['model_ref']
    instruction = config['instruction']

    processed = []

    for output in worker_outputs:
        if output['worker_id'] not in target_workers:
            processed.append(output)
            continue

        # Build refinement prompt
        original_text = output.get('response', output.get('output', ''))
        messages = [
            {"role": "system", "content": instruction},
            {"role": "user", "content": original_text}
        ]

        # Query model
        response = await query_model(model_ref, messages)

        if response is not None:
            output['response'] = response.get('content', original_text)
            output['_refined'] = True
            output['_refinement_instruction'] = instruction

        processed.append(output)

    return processed


async def truncate(
    worker_outputs: List[Dict[str, Any]],
    target_workers: List[str],
    config: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Truncate outputs to max length.

    Args:
        worker_outputs: Worker outputs
        target_workers: List of worker IDs to apply to
        config: Configuration with 'max_length' and 'strategy'

    Returns:
        Processed outputs
    """
    max_length = config.get('max_length', 1000)
    strategy = config.get('strategy', 'hard')

    processed = []

    for output in worker_outputs:
        if output['worker_id'] not in target_workers:
            processed.append(output)
            continue

        text = output.get('response', output.get('output', ''))

        if len(text) > max_length:
            if strategy == 'hard':
                text = text[:max_length] + '...'
            elif strategy == 'smart':
                # Truncate at sentence boundary
                text = text[:max_length]
                last_period = text.rfind('.')
                if last_period > max_length * 0.8:  # Within last 20%
                    text = text[:last_period + 1]
                else:
                    text = text + '...'

            output['response'] = text
            output['_truncated'] = True

        processed.append(output)

    return processed
