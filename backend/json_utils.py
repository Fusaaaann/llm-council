"""Robust JSON extraction and parsing utilities for LLM responses.

This module provides utilities to extract and parse JSON from text that may
contain markdown code blocks, prose, or other formatting commonly found in
LLM responses.
"""

import json
import re
import logging
from typing import Any, Optional, Tuple

logger = logging.getLogger(__name__)


def extract_json_from_text(text: str) -> Optional[str]:
    """
    Extract JSON from text that may contain markdown code blocks or prose.

    Tries multiple strategies in order:
    1. Markdown code blocks with ```json
    2. Generic code blocks with ``` (if contains { or [)
    3. Bracket extraction (find first { or [ and extract until matching close)
    4. Plain text (if text already looks like JSON)

    Args:
        text: Raw text that may contain JSON

    Returns:
        Extracted JSON string, or None if no JSON found

    Examples:
        >>> extract_json_from_text('```json\\n{"key": "value"}\\n```')
        '{"key": "value"}'

        >>> extract_json_from_text('Here is the data: {"key": "value"}')
        '{"key": "value"}'
    """
    if not text or not isinstance(text, str):
        return None

    text = text.strip()
    if not text:
        return None

    # Strategy 1: Extract from markdown code blocks (```json or ``` with JSON content)
    # Pattern: ``` optionally followed by 'json', then content, then ```
    # Flexible whitespace - no required newlines
    code_block_pattern = r'```(?:json)?\s*(.*?)\s*```'
    matches = re.findall(code_block_pattern, text, re.DOTALL | re.IGNORECASE)
    if matches:
        for match in matches:
            candidate = match.strip()
            if candidate and (candidate.startswith('{') or candidate.startswith('[')):
                logger.debug("Extracted JSON from code block")
                return candidate

    # Strategy 2: Simple bracket extraction - find first { or [, extract rest
    # Let JSON parser handle validation instead of manual bracket matching
    for i, char in enumerate(text):
        if char in '{[':
            candidate = text[i:].strip()
            if candidate:
                logger.debug("Extracted JSON from bracket position")
                return candidate

    # Strategy 3: Text already looks like JSON - try as-is
    if text.startswith('{') or text.startswith('['):
        logger.debug("Text already appears to be raw JSON")
        return text

    logger.debug("No JSON found in text using any strategy")
    return None


def is_json_like(text: str) -> bool:
    """
    Quick check if text looks like JSON (starts with { or [).

    Args:
        text: Text to check

    Returns:
        True if text starts with JSON-like characters
    """
    if not text or not isinstance(text, str):
        return False
    text = text.strip()
    return text.startswith('{') or text.startswith('[')


def parse_json_safe(
    text: str,
    expected_type: Optional[type] = None,
    var_name: Optional[str] = None
) -> Tuple[bool, Optional[Any], Optional[str]]:
    """
    Parse JSON from text with fallback extraction strategies and type validation.

    This is the main entry point for parsing LLM responses that may contain
    JSON wrapped in markdown or other formatting.

    Args:
        text: Raw text containing JSON
        expected_type: Expected Python type (dict, list, str, int, float, bool, or None for any)
        var_name: Variable name for better error messages (optional)

    Returns:
        Tuple of (success: bool, result: Any, error_message: str or None)

    Examples:
        >>> success, result, error = parse_json_safe('```json\\n{"x": 1}\\n```', dict)
        >>> success
        True
        >>> result
        {'x': 1}

        >>> success, result, error = parse_json_safe('{"x": 1}', list)
        >>> success
        False
        >>> error
        'Expected list, got dict'
    """
    if not text or not isinstance(text, str):
        error = f"Variable '{var_name}' received empty or non-string input" if var_name else "Empty or non-string input"
        return (False, None, error)

    # Step 1: Extract JSON from text
    json_str = extract_json_from_text(text)

    if json_str is None:
        # Provide helpful preview
        preview = text[:200] + "..." if len(text) > 200 else text
        if var_name:
            error = (
                f"Variable '{var_name}' expects JSON but could not extract valid JSON from text.\n"
                f"Text preview (first 200 chars): {preview}"
            )
        else:
            error = f"Could not extract JSON from text. Preview: {preview}"
        return (False, None, error)

    # Step 2: Parse JSON
    try:
        parsed = json.loads(json_str)
    except json.JSONDecodeError as e:
        preview = json_str[:200] + "..." if len(json_str) > 200 else json_str
        if var_name:
            error = (
                f"Variable '{var_name}' expects valid JSON but parsing failed.\n"
                f"JSON Parse Error: {e}\n"
                f"Extracted JSON (first 200 chars): {preview}"
            )
        else:
            error = f"JSON parsing failed: {e}. Extracted JSON: {preview}"
        return (False, None, error)

    # Step 3: Type validation (if expected_type specified)
    if expected_type is not None:
        if not isinstance(parsed, expected_type):
            actual_type = type(parsed).__name__
            expected_name = expected_type.__name__
            if var_name:
                error = f"Variable '{var_name}' expects {expected_name}, but got {actual_type}"
            else:
                error = f"Expected {expected_name}, but got {actual_type}"
            return (False, None, error)

    # Success!
    return (True, parsed, None)
