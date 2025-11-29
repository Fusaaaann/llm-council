"""Model configuration endpoints."""

from fastapi import APIRouter

from .. import config
from ..models import ModelConfigRequest

router = APIRouter(prefix="/api", tags=["models"])


@router.get("/models")
async def get_models():
    """Get current model configuration."""
    return {
        "council_models": config.COUNCIL_MODELS,
        "chairman_model": config.CHAIRMAN_MODEL
    }


@router.post("/models")
async def update_models(req: ModelConfigRequest):
    """Update model configuration for the session."""
    config.COUNCIL_MODELS = req.council_models
    config.CHAIRMAN_MODEL = req.chairman_model
    return {"success": True}
