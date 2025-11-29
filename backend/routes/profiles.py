"""Profile management endpoints."""

from fastapi import APIRouter, HTTPException
import uuid

from .. import storage
from ..models import CreateProfileRequest, UpdateProfileRequest

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


@router.get("")
async def list_profiles():
    """List all profiles."""
    return storage.list_profiles()


@router.get("/{profile_id}")
async def get_profile(profile_id: str):
    """Get a specific profile."""
    profile = storage.get_profile(profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.post("")
async def create_profile(req: CreateProfileRequest):
    """Create a new profile."""
    profile_id = str(uuid.uuid4())
    try:
        profile = storage.create_profile(profile_id, req.name, req.settings)
        return profile
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{profile_id}")
async def update_profile(profile_id: str, req: UpdateProfileRequest):
    """Update a profile."""
    try:
        profile = storage.update_profile(profile_id, req.name, req.settings)
        return profile
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{profile_id}")
async def delete_profile(profile_id: str):
    """Delete a profile."""
    try:
        success = storage.delete_profile(profile_id)
        if not success:
            raise HTTPException(status_code=404, detail="Profile not found")
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
