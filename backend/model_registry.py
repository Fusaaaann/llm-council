"""Model validation and registry for workflow engine."""

from typing import List, Dict, Any, Optional
import httpx
from datetime import datetime, timedelta


# Cache
_model_cache: Optional[List[str]] = None
_cache_timestamp: Optional[datetime] = None
_CACHE_TTL = timedelta(hours=1)


async def get_available_models() -> List[str]:
    """
    Get list of available models from OpenRouter.

    Cached for 1 hour to reduce API calls.

    Returns:
        List of model identifiers
    """
    global _model_cache, _cache_timestamp

    # Check cache
    if _model_cache and _cache_timestamp:
        if datetime.utcnow() - _cache_timestamp < _CACHE_TTL:
            return _model_cache

    # Fetch from OpenRouter
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://openrouter.ai/api/v1/models",
                timeout=10.0
            )
            response.raise_for_status()

            data = response.json()
            models = [m['id'] for m in data.get('data', [])]

            # Update cache
            _model_cache = models
            _cache_timestamp = datetime.utcnow()

            return models

    except Exception as e:
        # If fetch fails, return cached data if available
        if _model_cache:
            return _model_cache

        # Otherwise, return empty list and log error
        print(f"Error fetching models from OpenRouter: {e}")
        return []


async def is_valid_model(model_ref: str) -> bool:
    """
    Check if model reference is valid.

    Args:
        model_ref: Model identifier (e.g., 'openai/gpt-4')

    Returns:
        True if model exists in OpenRouter
    """
    models = await get_available_models()
    return model_ref in models


async def get_model_metadata(model_ref: str) -> Optional[Dict[str, Any]]:
    """
    Get model metadata (capabilities, pricing, etc.).

    Args:
        model_ref: Model identifier

    Returns:
        Model metadata dict or None if not found
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://openrouter.ai/api/v1/models/{model_ref}",
                timeout=10.0
            )
            response.raise_for_status()

            return response.json()

    except Exception as e:
        print(f"Error fetching metadata for {model_ref}: {e}")
        return None


def clear_cache():
    """Clear model cache (for testing)."""
    global _model_cache, _cache_timestamp
    _model_cache = None
    _cache_timestamp = None
