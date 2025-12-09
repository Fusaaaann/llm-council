"""Workflow management endpoints (DSL workflows)."""

from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
import uuid

from ..storage import dsl
from ..workflow_schema import validate_workflow, validate_workflow_models
from ..auth_middleware import ensure_user_logged_in, get_profile_id_for_request
from ..models import BaseModel
from ..rate_limiter import limiter

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


# Request/Response Models

class WorkflowCreateRequest(BaseModel):
    """Request to create/upload a workflow."""
    name: str
    description: Optional[str] = None
    workflow: Dict[str, Any]  # The DSL JSON


class WorkflowUpdateRequest(BaseModel):
    """Request to update a workflow."""
    name: Optional[str] = None
    description: Optional[str] = None
    workflow: Optional[Dict[str, Any]] = None


class WorkflowMetadata(BaseModel):
    """Workflow metadata (without full workflow data)."""
    id: str
    profile_id: str
    name: str
    description: Optional[str]
    created_at: str
    modified_at: Optional[str]
    superstep_count: int
    worker_count: int


class WorkflowValidationResponse(BaseModel):
    """Workflow validation result."""
    valid: bool
    errors: Optional[List[str]] = None


class WorkflowTestRequest(BaseModel):
    """Request to test workflow execution."""
    content: str


# Endpoints

@router.post("", response_model=WorkflowMetadata)
@limiter.limit("10/minute")
async def create_workflow(
    request: WorkflowCreateRequest,
    req: Request,
    user: Dict[str, Any] = Depends(ensure_user_logged_in),
    profile_id: str = Depends(get_profile_id_for_request)
):
    """
    Create/upload a new workflow.

    Validates workflow against schema and saves to storage.
    """
    # Validate workflow
    is_valid, error_msg = validate_workflow(request.workflow)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Invalid workflow: {error_msg}")

    # Validate model references (async)
    is_valid, error_msg = await validate_workflow_models(request.workflow)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Invalid workflow: {error_msg}")

    # Generate workflow ID
    workflow_id = str(uuid.uuid4())

    # Save to storage
    workflow_data = dsl.save_workflow_definition(
        workflow_id=workflow_id,
        profile_id=profile_id,
        name=request.name,
        workflow=request.workflow,
        description=request.description
    )

    # Return metadata
    superstep_count = len(request.workflow.get('supersteps', []))
    worker_count = sum(
        len(s.get('map_phase', {}).get('workers', []))
        for s in request.workflow.get('supersteps', [])
    )

    return WorkflowMetadata(
        id=workflow_id,
        profile_id=profile_id,
        name=request.name,
        description=request.description,
        created_at=workflow_data['created_at'],
        modified_at=workflow_data['modified_at'],
        superstep_count=superstep_count,
        worker_count=worker_count
    )


@router.get("", response_model=List[WorkflowMetadata])
async def list_workflows(
    user: Dict[str, Any] = Depends(ensure_user_logged_in),
    profile_id: str = Depends(get_profile_id_for_request)
):
    """
    List all workflows for current profile.
    """
    workflows = dsl.list_workflow_definitions(profile_id)
    return [WorkflowMetadata(**w) for w in workflows]


@router.get("/{workflow_id}")
async def get_workflow(
    workflow_id: str,
    user: Dict[str, Any] = Depends(ensure_user_logged_in),
    profile_id: str = Depends(get_profile_id_for_request)
):
    """
    Get full workflow definition by ID.
    """
    workflow = dsl.get_workflow_definition(workflow_id, profile_id)

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    return workflow


@router.put("/{workflow_id}", response_model=WorkflowMetadata)
async def update_workflow(
    workflow_id: str,
    request: WorkflowUpdateRequest,
    user: Dict[str, Any] = Depends(ensure_user_logged_in),
    profile_id: str = Depends(get_profile_id_for_request)
):
    """
    Update an existing workflow.
    """
    # Check ownership
    if not dsl.validate_workflow_ownership(workflow_id, profile_id):
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Get existing workflow
    existing = dsl.get_workflow_definition(workflow_id, profile_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Update fields
    name = request.name or existing['name']
    description = request.description if request.description is not None else existing.get('description')
    workflow = request.workflow or existing['workflow']

    # Validate if workflow changed
    if request.workflow:
        is_valid, error_msg = validate_workflow(workflow)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Invalid workflow: {error_msg}")

        is_valid, error_msg = await validate_workflow_models(workflow)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Invalid workflow: {error_msg}")

    # Save
    workflow_data = dsl.save_workflow_definition(
        workflow_id=workflow_id,
        profile_id=profile_id,
        name=name,
        workflow=workflow,
        description=description
    )

    # Return metadata
    superstep_count = len(workflow.get('supersteps', []))
    worker_count = sum(
        len(s.get('map_phase', {}).get('workers', []))
        for s in workflow.get('supersteps', [])
    )

    return WorkflowMetadata(
        id=workflow_id,
        profile_id=profile_id,
        name=name,
        description=description,
        created_at=workflow_data['created_at'],
        modified_at=workflow_data['modified_at'],
        superstep_count=superstep_count,
        worker_count=worker_count
    )


@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: str,
    user: Dict[str, Any] = Depends(ensure_user_logged_in),
    profile_id: str = Depends(get_profile_id_for_request)
):
    """
    Delete a workflow.

    Checks if any conversations are using this workflow first.
    """
    # Check ownership
    if not dsl.validate_workflow_ownership(workflow_id, profile_id):
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Check if conversations are using this workflow
    usage_count = dsl.count_workflows_using_workflow(workflow_id)
    if usage_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete workflow: {usage_count} conversation(s) are using it"
        )

    # Delete
    deleted = dsl.delete_workflow_definition(workflow_id, profile_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Workflow not found")

    return {"message": "Workflow deleted successfully"}


@router.post("/validate", response_model=WorkflowValidationResponse)
async def validate_workflow_endpoint(
    request: WorkflowCreateRequest,
    user: Dict[str, Any] = Depends(ensure_user_logged_in)
):
    """
    Validate workflow without saving.

    Useful for testing workflows before upload.
    """
    errors = []

    # Schema validation
    is_valid, error_msg = validate_workflow(request.workflow)
    if not is_valid:
        errors.append(error_msg)

    # Model validation
    if is_valid:
        is_valid, error_msg = await validate_workflow_models(request.workflow)
        if not is_valid:
            errors.append(error_msg)

    return WorkflowValidationResponse(
        valid=len(errors) == 0,
        errors=errors if errors else None
    )


@router.post("/{workflow_id}/test")
async def test_workflow(
    workflow_id: str,
    test_input: WorkflowTestRequest,
    user: Dict[str, Any] = Depends(ensure_user_logged_in),
    profile_id: str = Depends(get_profile_id_for_request)
):
    """
    Test workflow execution without saving results.

    Returns streaming response.
    """
    from ..workflow_engine import execute_workflow_stream

    # Get workflow
    workflow = dsl.get_workflow_definition(workflow_id, profile_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Create mock conversation
    mock_conversation = {
        "id": "test",
        "profile_id": profile_id,
        "messages": []
    }

    # Execute workflow
    return StreamingResponse(
        execute_workflow_stream(
            workflow['workflow'],
            mock_conversation,
            test_input.content
        ),
        media_type="text/event-stream"
    )
