"""Conversation management and messaging endpoints."""

from fastapi import APIRouter, HTTPException, Query, Depends, Request
from fastapi.responses import StreamingResponse, Response
from typing import List, Dict, Any, Optional
import uuid
import json
import asyncio
import time
import logging
from urllib.parse import quote

logger = logging.getLogger(__name__)

import backend.storage.conversations
import backend.storage.encryption
import backend.storage.publish

from backend import config, auth
from backend.stage_config import STAGES, SPECIAL_EVENTS, get_stage_config
from backend.council import (
    stage1_collect_responses,
    stage1_5_cross_interrogation,
    stage1_5_collect_answers,
    stage2_collect_rankings,
    stage3_synthesize_final,
    calculate_aggregate_rankings,
    generate_conversation_title
)
from backend.auth_middleware import get_current_user_optional, get_profile_id_for_request
from backend.models import (
    CreateConversationRequest,
    SendMessageRequest,
    ResumeStreamRequest,
    RenameConversationRequest,
    ModelConfigRequest,
    Conversation,
    ConversationMetadata
)
from backend.utils import conversation_to_markdown, conversation_to_html, conversation_to_json
from backend.rate_limiter import limiter

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def build_message_history(conversation: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Build OpenRouter-compatible message history from conversation.
    Extracts user messages and assistant stage3 responses (final synthesis).

    Args:
        conversation: Full conversation dict with messages array

    Returns:
        List of message dicts with 'role' and 'content' for OpenRouter API
    """
    messages = []
    for msg in conversation.get("messages", []):
        if msg["role"] == "user":
            messages.append({
                "role": "user",
                "content": msg["content"]
            })
        elif msg["role"] == "assistant":
            # Use stage3 response (final synthesis) as assistant response
            stage3 = msg.get("stage3", {})
            if stage3 and "response" in stage3:
                messages.append({
                    "role": "assistant",
                    "content": stage3["response"]
                })
    return messages


def encode_filename_header(filename: str) -> str:
    """
    Encode filename for Content-Disposition header to support non-ASCII characters.
    Uses RFC 5987 encoding: filename*=UTF-8''encoded_filename
    """
    # Try ASCII first (for better compatibility)
    try:
        filename.encode('ascii')
        return f'attachment; filename="{filename}"'
    except UnicodeEncodeError:
        # Use RFC 5987 encoding for non-ASCII characters
        encoded_filename = quote(filename, safe='')
        return f"attachment; filename*=UTF-8''{encoded_filename}"


@router.get("", response_model=List[ConversationMetadata])
async def list_conversations(
    profile_id: Optional[str] = Query(None),
    view: str = Query("private", description="View mode: private (own), public (all public), all (both)"),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    List conversations with optional view filtering.

    - view=private: User's own conversations (default, requires profile ownership)
    - view=public: All public conversations (no auth required)
    - view=all: User's conversations + all public conversations
    """
    # For public view, no profile access check needed - return all public conversations
    if view == "public":
        return backend.storage.conversations.list_conversations(view="public")

    # For private/all views, validate profile access
    pid = get_profile_id_for_request(user, profile_id)
    return backend.storage.conversations.list_conversations(pid, view)


@router.get("/stream")
async def stream_conversations(
    profile_id: Optional[str] = Query(None),
    view: str = Query("private", description="View mode: private (own), public (all public), all (both)"),
    token: Optional[str] = Query(None, description="Access token (for EventSource compatibility)"),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Stream conversation list updates via Server-Sent Events.

    Sends events:
    - initial: Full conversation list on connection
    - conversation_created: New conversation added
    - conversation_updated: Conversation modified (title, loading state, etc.)
    - conversation_deleted: Conversation removed
    - heartbeat: Keep-alive every 30 seconds

    Note: Accepts token as query parameter since EventSource doesn't support custom headers.
    """
    # IMPORTANT: EventSource cannot send Authorization headers, so ALWAYS use token from query param
    # This takes precedence over the Authorization header (if any)
    if token:
        try:
            payload = auth.verify_access_token(token)
            user_id = payload.get("sub")
            user_data = auth.get_user_by_id(user_id)

            if user_data:
                # Reconstruct full user object (matching get_current_user_optional format)
                user = {
                    "id": user_data["id"],
                    "email": user_data["email"],
                    "name": user_data["name"],
                    "profile_id": payload.get("profile_id"),
                    "default_profile_id": user_data["default_profile_id"]
                }
        except Exception:
            # Invalid token - continue without auth (for public view)
            pass

    # Determine profile ID based on view
    if view == "public":
        # For public view, profile_id is ignored by storage layer
        pid = ""  # Placeholder - not used for public view
    else:
        # For private/all views, validate profile access
        pid = get_profile_id_for_request(user, profile_id)

    async def event_generator():
        try:
            # Send initial conversation list
            conversations = backend.storage.conversations.list_conversations(pid, view) if view != "public" else backend.storage.conversations.list_conversations(view="public")
            yield f"data: {json.dumps({'type': 'initial', 'data': conversations})}\n\n"

            # Track last known state (conversation ID -> modified time)
            last_state = {
                conv['id']: conv.get('modified_at', conv.get('created_at'))
                for conv in conversations
            }

            POLL_INTERVAL = 2  # seconds
            HEARTBEAT_INTERVAL = 30  # seconds
            last_heartbeat = time.time()

            while True:
                await asyncio.sleep(POLL_INTERVAL)

                # Check for heartbeat
                now = time.time()
                if now - last_heartbeat >= HEARTBEAT_INTERVAL:
                    yield f"data: {json.dumps({'type': 'heartbeat', 'timestamp': now})}\n\n"
                    last_heartbeat = now

                # Fetch current conversation list
                current_conversations = backend.storage.conversations.list_conversations(pid, view) if view != "public" else backend.storage.conversations.list_conversations(view="public")
                current_state = {
                    conv['id']: conv.get('modified_at', conv.get('created_at'))
                    for conv in current_conversations
                }
                current_ids = set(current_state.keys())
                last_ids = set(last_state.keys())

                # Detect new conversations
                new_ids = current_ids - last_ids
                for conv_id in new_ids:
                    conv = next(c for c in current_conversations if c['id'] == conv_id)
                    yield f"data: {json.dumps({'type': 'conversation_created', 'data': conv})}\n\n"

                # Detect deleted conversations
                deleted_ids = last_ids - current_ids
                for conv_id in deleted_ids:
                    yield f"data: {json.dumps({'type': 'conversation_deleted', 'data': {'id': conv_id}})}\n\n"

                # Detect updated conversations (modified time changed)
                for conv_id in current_ids & last_ids:
                    if current_state[conv_id] != last_state[conv_id]:
                        conv = next(c for c in current_conversations if c['id'] == conv_id)
                        yield f"data: {json.dumps({'type': 'conversation_updated', 'data': conv})}\n\n"

                # Update tracked state
                last_state = current_state

        except asyncio.CancelledError:
            # Client disconnected
            pass
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


@router.post("", response_model=Conversation)
async def create_conversation(
    req: CreateConversationRequest,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Create a new conversation."""
    pid = get_profile_id_for_request(user, profile_id)
    conversation_id = str(uuid.uuid4())
    conversation = backend.storage.conversations.create_conversation(
        conversation_id,
        pid,
        req.uses_byok,
        req.council_models,
        req.chairman_model,
        req.workflow_json
    )
    return conversation


@router.get("/{conversation_id}", response_model=Conversation)
async def get_conversation(
    conversation_id: str,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Get a specific conversation with all its messages."""
    pid = get_profile_id_for_request(user, profile_id)
    conversation = backend.storage.conversations.get_conversation(conversation_id, pid)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.patch("/{conversation_id}/rename")
async def rename_conversation(
    conversation_id: str,
    req: RenameConversationRequest,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Rename a conversation."""
    pid = get_profile_id_for_request(user, profile_id)
    conversation = backend.storage.conversations.get_conversation(conversation_id, pid)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    backend.storage.conversations.update_conversation_title(conversation_id, req.title, pid)
    return {"success": True}


@router.patch("/{conversation_id}/models")
async def update_conversation_models(
    conversation_id: str,
    req: ModelConfigRequest,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Update conversation models (only allowed before first message)."""
    pid = get_profile_id_for_request(user, profile_id)
    conversation = backend.storage.conversations.get_conversation(conversation_id, pid)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify ownership
    if conversation.get("profile_id") != pid:
        raise HTTPException(
            status_code=403,
            detail="You can only update your own conversations"
        )

    # Only allow updates before first message
    if conversation.get("messages") and len(conversation["messages"]) > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot update models after messages have been sent"
        )

    # Validate: either workflow OR council config, not both
    has_workflow = req.workflow_json and req.workflow_json.strip()
    has_council = req.council_models or req.chairman_model

    if has_workflow and has_council:
        raise HTTPException(
            status_code=400,
            detail="Cannot specify both workflow_json and council configuration. Use one or the other."
        )

    if not has_workflow and not has_council:
        raise HTTPException(
            status_code=400,
            detail="Must specify either workflow_json or council configuration (council_models + chairman_model)"
        )

    # Update the conversation models/workflow
    backend.storage.conversations.update_conversation_models(
        conversation_id,
        council_models=req.council_models,
        chairman_model=req.chairman_model,
        workflow_json=req.workflow_json,
        profile_id=pid
    )
    return {"success": True}


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Delete a conversation."""
    pid = get_profile_id_for_request(user, profile_id)
    success = backend.storage.conversations.delete_conversation(conversation_id, pid)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True}


@router.get("/{conversation_id}/export/markdown")
async def export_markdown(
    conversation_id: str,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Export conversation as markdown."""
    pid = get_profile_id_for_request(user, profile_id)
    conversation = backend.storage.conversations.get_conversation(conversation_id, pid)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    markdown, filename = conversation_to_markdown(conversation)

    return Response(
        content=markdown,
        media_type="text/markdown",
        headers={"Content-Disposition": encode_filename_header(filename)}
    )


@router.get("/{conversation_id}/export/html")
async def export_html(
    conversation_id: str,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Export conversation as HTML."""
    pid = get_profile_id_for_request(user, profile_id)
    conversation = backend.storage.conversations.get_conversation(conversation_id, pid)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    html, filename = conversation_to_html(conversation)

    return Response(
        content=html,
        media_type="text/html",
        headers={"Content-Disposition": encode_filename_header(filename)}
    )


@router.get("/{conversation_id}/export/json")
async def export_json(
    conversation_id: str,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Export conversation as JSON."""
    pid = get_profile_id_for_request(user, profile_id)
    conversation = backend.storage.conversations.get_conversation(conversation_id, pid)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    json_data, filename = conversation_to_json(conversation)

    return Response(
        content=json_data,
        media_type="application/json",
        headers={"Content-Disposition": encode_filename_header(filename)}
    )


@router.post("/{conversation_id}/message")
async def send_message(
    conversation_id: str,
    req: SendMessageRequest,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Send a message and run the 3-stage council process.
    Returns the complete response with all stages.
    Now uses same stage logic as streaming endpoint.
    Only conversation owner can send messages.
    """
    pid = get_profile_id_for_request(user, profile_id)

    # Check if conversation exists
    conversation = backend.storage.conversations.get_conversation(conversation_id, pid)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify ownership: conversation's profile_id must match the request profile_id
    if conversation.get("profile_id") != pid:
        raise HTTPException(
            status_code=403,
            detail="You can only send messages to your own conversations"
        )

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    try:
        # Set loading state
        backend.storage.conversations.set_conversation_loading(conversation_id, True, pid)

        # Add user message
        backend.storage.conversations.add_user_message(conversation_id, req.content, pid)

        # Get model configuration from conversation
        council_models = conversation.get("council_models")
        chairman_model = conversation.get("chairman_model")

        # Fallback to global config if not set (backward compatibility)
        if not council_models:
            from ..config import COUNCIL_MODELS
            council_models = COUNCIL_MODELS
        if not chairman_model:
            from ..config import CHAIRMAN_MODEL
            chairman_model = CHAIRMAN_MODEL

        # Generate title in parallel if first message
        title_task = None
        if is_first_message:
            title_task = asyncio.create_task(generate_conversation_title(req.content))

        # Build message history including the new user message
        message_history = build_message_history(conversation)
        message_history.append({"role": "user", "content": req.content})

        # Stage 1: Collect responses
        stage1_results = await stage1_collect_responses(message_history, council_models)

        # Stage 1.5: Cross-interrogation (questions)
        questions_results, label_to_model_interrogation = await stage1_5_cross_interrogation(message_history, stage1_results, council_models)

        # Stage 1.5: Collect answers
        answers_results = await stage1_5_collect_answers(message_history, stage1_results, questions_results, label_to_model_interrogation)

        # Stage 2: Collect rankings
        stage2_results, label_to_model = await stage2_collect_rankings(message_history, stage1_results, council_models)
        aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)

        # Build stage1_5 data for Stage 3
        stage1_5_data = {
            'questions': questions_results,
            'answers': answers_results,
            'label_to_model': label_to_model_interrogation
        }

        # Stage 3: Synthesize final answer (with stage1_5 context)
        stage3_result = await stage3_synthesize_final(message_history, stage1_results, stage2_results, chairman_model, stage1_5_data)

        # Wait for title if it was started
        if title_task:
            title = await title_task
            backend.storage.conversations.update_conversation_title(conversation_id, title, pid)

        # Build metadata
        metadata = {
            'label_to_model': label_to_model,
            'aggregate_rankings': aggregate_rankings
        }

        # Add assistant message with all stages and metadata
        backend.storage.conversations.add_assistant_message(
            conversation_id,
            stage1_results,
            stage2_results,
            stage3_result,
            metadata,
            stage1_5_data,
            pid
        )

        # Clear loading state
        backend.storage.conversations.set_conversation_loading(conversation_id, False, pid)

        # Return the complete response with metadata
        return {
            "stage1": stage1_results,
            "stage1_5": stage1_5_data,
            "stage2": stage2_results,
            "stage3": stage3_result,
            "metadata": metadata
        }
    except Exception as e:
        # Clear loading state on error
        backend.storage.conversations.set_conversation_loading(conversation_id, False, pid)
        raise


@router.post("/{conversation_id}/message/stream")
@limiter.limit("10/minute")
async def send_message_stream(
    request: Request,
    conversation_id: str,
    req: SendMessageRequest,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Send a message and stream the 3-stage council process.
    Returns Server-Sent Events as each stage completes.
    Only conversation owner can send messages.
    """
    pid = get_profile_id_for_request(user, profile_id)

    # Check if conversation exists
    conversation = backend.storage.conversations.get_conversation(conversation_id, pid)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify ownership: conversation's profile_id must match the request profile_id
    if conversation.get("profile_id") != pid:
        raise HTTPException(
            status_code=403,
            detail="You can only send messages to your own conversations"
        )

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    async def event_generator():
        try:
            # Generate connection token for this streaming session
            stream_id = str(uuid.uuid4())
            connection_token = None
            event_sequence = [0]  # Track event sequence for IDs

            def generate_event_id(stage: str) -> str:
                """Generate unique event ID: {stream_id}-{stage}-{sequence}"""
                event_id = f"{stream_id}-{stage}-{event_sequence[0]}"
                event_sequence[0] += 1
                return event_id

            def send_event(event_type: str, data: Any = None, stage: str = None) -> str:
                """Helper to send SSE event with ID"""
                event_id = generate_event_id(stage or event_type)
                event_data = {'type': event_type}
                if data is not None:
                    if isinstance(data, dict):
                        event_data.update(data)
                    else:
                        event_data['data'] = data
                return f"id: {event_id}\ndata: {json.dumps(event_data)}\n\n"

            # Only generate connection token if user is authenticated
            if user:
                connection_token = auth.create_connection_token(
                    user_id=user["id"],
                    conversation_id=conversation_id,
                    stream_id=stream_id
                )

            # Send stream initialization event with connection token
            yield send_event('stream_init', {'stream_id': stream_id, 'connection_token': connection_token}, 'init')

            # Heartbeat tracking
            last_heartbeat = [time.time()]  # Use list for mutability in nested function
            HEARTBEAT_INTERVAL = 60  # seconds

            def check_and_send_heartbeat():
                """Check if heartbeat needed and return event if so."""
                now = time.time()

                if now - last_heartbeat[0] >= HEARTBEAT_INTERVAL:
                    # Check if user session is still valid
                    if user:
                        # Verify user still has valid session (not logged out elsewhere)
                        sessions = auth.load_sessions()
                        user_sessions = [
                            token for token, session in sessions.items()
                            if not token.startswith("connection_") and session.get("user_id") == user["id"]
                        ]

                        if not user_sessions:
                            # User logged out elsewhere - send auth_expired event
                            return send_event('auth_expired', {
                                'reason': 'logged_out',
                                'message': 'Session ended. Please log in again.'
                            }, 'heartbeat')

                    # Send heartbeat
                    last_heartbeat[0] = now
                    return send_event('heartbeat', {'timestamp': now}, 'heartbeat')

                return None  # No heartbeat needed

            # Set loading state to true
            backend.storage.conversations.set_conversation_loading(conversation_id, True, pid)

            try:
                # Add user message (with idempotency check to prevent duplicates on retry)
                # Check if last message is already this exact user message
                last_msg = conversation["messages"][-1] if conversation["messages"] else None
                is_duplicate = (
                    last_msg
                    and last_msg.get("role") == "user"
                    and last_msg.get("content") == req.content
                )

                # Check if there's an assistant message before the duplicate user message
                # This indicates a retry scenario where we need to remove the old response
                is_retry = False
                if is_duplicate and len(conversation["messages"]) >= 2:
                    second_last = conversation["messages"][-2]
                    if second_last.get("role") == "assistant":
                        is_retry = True

                if not is_duplicate:
                    backend.storage.conversations.add_user_message(conversation_id, req.content, pid)
                else:
                    print(f"[INFO] Skipping duplicate user message for conversation {conversation_id}")
                    if is_retry:
                        # Remove the previous assistant response before retrying
                        print(f"[INFO] Retry detected, removing previous assistant response")
                        # Need to temporarily remove user message, remove assistant, then restore user
                        conversation["messages"].pop()  # Remove user
                        backend.storage.conversations.remove_last_assistant_message(conversation_id, pid)
                        backend.storage.conversations.add_user_message(conversation_id, req.content, pid)

                # Check if conversation uses workflow or council execution
                workflow_json = conversation.get("workflow_json")

                if workflow_json:
                    # ========== WORKFLOW EXECUTION PATH ==========
                    from ..workflow_engine import execute_workflow_stream

                    # Start title generation in parallel (don't await yet)
                    title_task = None
                    if is_first_message:
                        title_task = asyncio.create_task(generate_conversation_title(req.content))

                    # Parse workflow JSON
                    try:
                        workflow_def = json.loads(workflow_json)
                    except json.JSONDecodeError as e:
                        yield send_event('error', {'message': f'Invalid workflow JSON: {str(e)}'}, 'error')
                        return

                    # Execute workflow with streaming
                    async for event in execute_workflow_stream(workflow_def, conversation, req.content):
                        yield event

                    # Wait for title if it was started
                    if title_task:
                        title = await title_task
                        backend.storage.conversations.update_conversation_title(conversation_id, title, pid)
                        yield send_event('title_complete', {'title': title}, 'title')

                else:
                    # ========== COUNCIL EXECUTION PATH (LEGACY) ==========
                    # Get model configuration from conversation
                    council_models = conversation.get("council_models")
                    chairman_model = conversation.get("chairman_model")

                    # Fallback to global config if not set (backward compatibility)
                    if not council_models:
                        from ..config import COUNCIL_MODELS
                        council_models = COUNCIL_MODELS
                    if not chairman_model:
                        from ..config import CHAIRMAN_MODEL
                        chairman_model = CHAIRMAN_MODEL

                    # Start title generation in parallel (don't await yet)
                    title_task = None
                    if is_first_message:
                        title_task = asyncio.create_task(generate_conversation_title(req.content))

                    # Build message history including the new user message
                    message_history = build_message_history(conversation)
                    message_history.append({"role": "user", "content": req.content})

                    # NOTE: Event names are now defined in stage_config.py for consistency
                    # with frontend. You can use: get_stage_config("stage1").event_start
                    # instead of hardcoded strings for better maintainability.

                    # Stage 1: Collect responses
                    yield send_event('stage1_start', stage='stage1')
                    stage1_results = await stage1_collect_responses(message_history, council_models)
                    yield send_event('stage1_complete', stage1_results, 'stage1')
                    # Save partial state after stage1 with stream metadata
                    backend.storage.conversations.save_partial_assistant_message(
                        conversation_id, "stage1", stage1_results,
                        profile_id=pid, stream_id=stream_id, connection_token=connection_token
                    )

                    # Check heartbeat and send if needed
                    heartbeat_event = check_and_send_heartbeat()
                    if heartbeat_event:
                        yield heartbeat_event
                        if 'auth_expired' in heartbeat_event:
                            return  # Stop stream if auth expired

                    # Stage 1.5: Cross-interrogation (questions)
                    yield send_event('stage1_5_questions_start', stage='stage1_5')
                    questions_results, label_to_model_interrogation = await stage1_5_cross_interrogation(message_history, stage1_results, council_models)
                    yield send_event('stage1_5_questions_complete', questions_results, 'stage1_5')

                    # Stage 1.5: Collect answers
                    yield send_event('stage1_5_answers_start', stage='stage1_5')
                    answers_results = await stage1_5_collect_answers(message_history, stage1_results, questions_results, label_to_model_interrogation)
                    yield send_event('stage1_5_answers_complete', {
                        'data': answers_results,
                        'label_to_model': label_to_model_interrogation
                    }, 'stage1_5')
                    # Save partial state after stage1_5 with stream metadata
                    stage1_5_data = {
                        'questions': questions_results,
                        'answers': answers_results,
                        'label_to_model': label_to_model_interrogation
                    }
                    backend.storage.conversations.save_partial_assistant_message(
                        conversation_id, "stage1_5", stage1_5_data,
                        profile_id=pid, stream_id=stream_id, connection_token=connection_token
                    )

                    # Check heartbeat and send if needed
                    heartbeat_event = check_and_send_heartbeat()
                    if heartbeat_event:
                        yield heartbeat_event
                        if 'auth_expired' in heartbeat_event:
                            return

                    # Stage 2: Collect rankings
                    yield send_event('stage2_start', stage='stage2')
                    stage2_results, label_to_model = await stage2_collect_rankings(message_history, stage1_results, council_models)
                    aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)
                    yield send_event('stage2_complete', {
                        'data': stage2_results,
                        'metadata': {
                            'label_to_model': label_to_model,
                            'aggregate_rankings': aggregate_rankings
                        }
                    }, 'stage2')
                    # Save partial state after stage2 (with metadata)
                    metadata = {
                        'label_to_model': label_to_model,
                        'aggregate_rankings': aggregate_rankings
                    }
                    backend.storage.conversations.save_partial_assistant_message(
                        conversation_id, "stage2", stage2_results, metadata=metadata,
                        profile_id=pid, stream_id=stream_id, connection_token=connection_token
                    )

                    # Check heartbeat and send if needed
                    heartbeat_event = check_and_send_heartbeat()
                    if heartbeat_event:
                        yield heartbeat_event
                        if 'auth_expired' in heartbeat_event:
                            return

                    # Stage 3: Synthesize final answer (with stage1_5 context)
                    yield send_event('stage3_start', stage='stage3')
                    stage3_result = await stage3_synthesize_final(message_history, stage1_results, stage2_results, chairman_model, stage1_5_data)
                    yield send_event('stage3_complete', stage3_result, 'stage3')
                    # Save partial state after stage3 (marks as complete, clears stream metadata)
                    backend.storage.conversations.save_partial_assistant_message(
                        conversation_id, "stage3", stage3_result,
                        profile_id=pid, stream_id=stream_id, connection_token=connection_token
                    )

                    # Wait for title generation if it was started
                    if title_task:
                        title = await title_task
                        backend.storage.conversations.update_conversation_title(conversation_id, title, pid)
                        yield send_event('title_complete', {'title': title}, 'title')

                    # Note: Assistant message already saved incrementally via save_partial_assistant_message()
                    # after each stage. No need to call add_assistant_message() here.

                    # Send completion event
                    yield send_event('complete', stage='complete')

            finally:
                # Always clear loading state, even if errors occurred
                backend.storage.conversations.set_conversation_loading(conversation_id, False, pid)

        except Exception as e:
            # Log full stack trace to backend logs
            logger.error(f"Stream error for conversation {conversation_id}: {str(e)}", exc_info=True)

            # Set loading state to false on error (in case finally block didn't run)
            backend.storage.conversations.set_conversation_loading(conversation_id, False, pid)

            # Send error event to frontend
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/{conversation_id}/message/stream/resume")
@limiter.limit("10/minute")
async def resume_message_stream(
    request: Request,
    conversation_id: str,
    req: ResumeStreamRequest,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Resume an interrupted message stream from the last completed stage.
    Requires connection_token from original stream.
    """
    pid = get_profile_id_for_request(user, profile_id)

    # Validate connection token
    connection_token = req.connection_token

    # Verify connection token
    try:
        token_data = auth.verify_connection_token(connection_token)
        if not token_data:
            raise HTTPException(status_code=401, detail="Invalid or expired connection token")

        # Verify token belongs to this conversation
        if token_data.get("conversation_id") != conversation_id:
            raise HTTPException(status_code=403, detail="Connection token does not match conversation")

        # Verify user ownership if authenticated
        # Note: JWT uses "sub" claim for user_id, not "user_id"
        token_user_id = token_data.get("sub")
        if user and token_user_id != user["id"]:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"[RESUME] User mismatch: token has user_id={token_user_id}, current user={user['id']}")
            raise HTTPException(status_code=403, detail="Connection token does not belong to current user")

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"[RESUME] Token validation error: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Token validation failed: {str(e)}")

    # Get stream metadata
    stream_metadata = backend.storage.conversations.get_stream_metadata(conversation_id, pid)
    if not stream_metadata:
        raise HTTPException(status_code=404, detail="No stream metadata found. Stream may have completed or expired.")

    # Verify connection tokens match
    if stream_metadata.get("connection_token") != connection_token:
        raise HTTPException(status_code=403, detail="Connection token mismatch")

    # Get conversation and last completed stage
    conversation = backend.storage.conversations.get_conversation(conversation_id, pid)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    last_stage = stream_metadata.get("last_stage")
    stream_id = stream_metadata.get("stream_id")

    # Determine which stages to resume from
    stage_order = ["stage1", "stage1_5", "stage2", "stage3"]
    try:
        last_stage_index = stage_order.index(last_stage)
        remaining_stages = stage_order[last_stage_index + 1:]
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid last_stage: {last_stage}")

    if not remaining_stages:
        # All stages completed, just return success
        return {"success": True, "message": "Stream already completed"}

    # Get the partial message
    messages = conversation.get("messages", [])
    if not messages or messages[-1].get("role") != "assistant":
        raise HTTPException(status_code=400, detail="No partial assistant message found")

    partial_message = messages[-1]
    stage1_results = partial_message.get("stage1")
    stage1_5_data = partial_message.get("stage1_5")
    stage2_results = partial_message.get("stage2")

    # Build message history from conversation (for context in resumed stages)
    # Note: We need to rebuild the history from conversation, not from partial_message
    # because we need the full conversation context for multi-turn support
    message_history = build_message_history(conversation)

    # Add the current user message if it exists
    if len(messages) >= 2 and messages[-2].get("role") == "user":
        user_message_content = messages[-2].get("content", "")
        # Make sure the current user message is in the history
        if not message_history or message_history[-1]["content"] != user_message_content:
            message_history.append({"role": "user", "content": user_message_content})
    else:
        # Fallback: if we can't find the user message, use the last message from history
        user_message_content = message_history[-1]["content"] if message_history else ""

    # Get model configuration from conversation
    council_models = conversation.get("council_models")
    chairman_model = conversation.get("chairman_model")

    # Fallback to global config if not set (backward compatibility)
    if not council_models:
        from ..config import COUNCIL_MODELS
        council_models = COUNCIL_MODELS
    if not chairman_model:
        from ..config import CHAIRMAN_MODEL
        chairman_model = CHAIRMAN_MODEL

    # Stream remaining stages
    async def resume_generator():
        try:
            event_sequence = [0]

            def generate_event_id(stage: str) -> str:
                event_id = f"{stream_id}-resume-{stage}-{event_sequence[0]}"
                event_sequence[0] += 1
                return event_id

            def send_event(event_type: str, data: Any = None, stage: str = None) -> str:
                event_id = generate_event_id(stage or event_type)
                event_data = {'type': event_type}
                if data is not None:
                    if isinstance(data, dict):
                        event_data.update(data)
                    else:
                        event_data['data'] = data
                return f"id: {event_id}\ndata: {json.dumps(event_data)}\n\n"

            # Send resume initialization
            yield send_event('resume_init', {
                'stream_id': stream_id,
                'last_stage': last_stage,
                'remaining_stages': remaining_stages
            }, 'resume')

            # Resume from next stage
            for stage in remaining_stages:
                if stage == "stage1_5":
                    # Stage 1.5: Cross-interrogation
                    yield send_event('stage1_5_questions_start', stage='stage1_5')
                    questions_results, label_to_model_interrogation = await stage1_5_cross_interrogation(
                        message_history, stage1_results, council_models
                    )
                    yield send_event('stage1_5_questions_complete', questions_results, 'stage1_5')

                    yield send_event('stage1_5_answers_start', stage='stage1_5')
                    answers_results = await stage1_5_collect_answers(
                        message_history, stage1_results, questions_results, label_to_model_interrogation
                    )
                    yield send_event('stage1_5_answers_complete', {
                        'data': answers_results,
                        'label_to_model': label_to_model_interrogation
                    }, 'stage1_5')

                    stage1_5_data = {
                        'questions': questions_results,
                        'answers': answers_results,
                        'label_to_model': label_to_model_interrogation
                    }
                    backend.storage.conversations.save_partial_assistant_message(
                        conversation_id, "stage1_5", stage1_5_data,
                        profile_id=pid, stream_id=stream_id, connection_token=connection_token
                    )

                elif stage == "stage2":
                    # Stage 2: Rankings
                    yield send_event('stage2_start', stage='stage2')
                    stage2_results, label_to_model = await stage2_collect_rankings(message_history, stage1_results, council_models)
                    aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)
                    yield send_event('stage2_complete', {
                        'data': stage2_results,
                        'metadata': {
                            'label_to_model': label_to_model,
                            'aggregate_rankings': aggregate_rankings
                        }
                    }, 'stage2')

                    metadata = {
                        'label_to_model': label_to_model,
                        'aggregate_rankings': aggregate_rankings
                    }
                    backend.storage.conversations.save_partial_assistant_message(
                        conversation_id, "stage2", stage2_results, metadata=metadata,
                        profile_id=pid, stream_id=stream_id, connection_token=connection_token
                    )

                elif stage == "stage3":
                    # Stage 3: Final synthesis (with stage1_5 context if available)
                    yield send_event('stage3_start', stage='stage3')
                    stage3_result = await stage3_synthesize_final(message_history, stage1_results, stage2_results, chairman_model, stage1_5_data)
                    yield send_event('stage3_complete', stage3_result, 'stage3')
                    backend.storage.conversations.save_partial_assistant_message(
                        conversation_id, "stage3", stage3_result,
                        profile_id=pid, stream_id=stream_id, connection_token=connection_token
                    )

            # Send completion
            yield send_event('complete', stage='complete')
            backend.storage.conversations.set_conversation_loading(conversation_id, False, pid)

        except Exception as e:
            backend.storage.conversations.set_conversation_loading(conversation_id, False, pid)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        resume_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/{conversation_id}/message/stream/cancel")
@limiter.limit("10/minute")
async def cancel_stream(
    request: Request,
    conversation_id: str,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Cancel an in-progress stream.
    Clears stream metadata to prevent resume.
    NOTE: Cannot interrupt in-progress LLM API calls.
    """
    pid = get_profile_id_for_request(user, profile_id)

    # Get connection token from request body
    try:
        body = await request.json()
        connection_token = body.get("connection_token")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body")

    if not connection_token:
        raise HTTPException(status_code=400, detail="connection_token is required")

    # Validate connection token
    try:
        token_data = auth.verify_connection_token(connection_token)
        if not token_data:
            raise HTTPException(status_code=401, detail="Invalid or expired connection token")

        # Verify token belongs to this conversation
        if token_data.get("conversation_id") != conversation_id:
            raise HTTPException(status_code=403, detail="Connection token does not match conversation")

        # Verify user ownership if authenticated
        token_user_id = token_data.get("sub")
        if user and token_user_id != user["id"]:
            raise HTTPException(status_code=403, detail="Connection token does not belong to current user")

    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"[CANCEL] Token validation error: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Token validation failed: {str(e)}")

    # Clear stream metadata
    conversation = backend.storage.conversations.get_conversation(conversation_id, pid)
    if conversation:
        if "_stream_metadata" in conversation:
            del conversation["_stream_metadata"]
            backend.storage.conversations._save_conversation(conversation_id, conversation, pid)

        # Clear loading state
        backend.storage.conversations.set_conversation_loading(conversation_id, False, pid)

    return {"success": True, "message": "Stream cancelled"}


@router.get("/{conversation_id}/encryption-status")
async def get_encryption_status(
    conversation_id: str,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Get the encryption status of a conversation."""
    pid = get_profile_id_for_request(user, profile_id)
    try:
        status = backend.storage.encryption.get_conversation_encryption_status(conversation_id, pid)
        return status
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{conversation_id}/encrypt")
async def encrypt_conversation(
    conversation_id: str,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Encrypt a conversation's messages."""
    pid = get_profile_id_for_request(user, profile_id)
    try:
        conversation = backend.storage.encryption.encrypt_conversation(conversation_id, pid)
        return {
            "success": True,
            "message": "Conversation encrypted",
            "status": backend.storage.encryption.get_conversation_encryption_status(conversation_id, pid)
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{conversation_id}/decrypt")
async def decrypt_conversation(
    conversation_id: str,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Decrypt a conversation's messages (save as plaintext)."""
    pid = get_profile_id_for_request(user, profile_id)
    try:
        conversation = backend.storage.encryption.decrypt_conversation(conversation_id, pid)
        return {
            "success": True,
            "message": "Conversation decrypted",
            "status": backend.storage.encryption.get_conversation_encryption_status(conversation_id, pid)
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{conversation_id}/publish")
async def publish_conversation(
    conversation_id: str,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Publish a conversation to the forum."""
    pid = get_profile_id_for_request(user, profile_id)
    try:
        conversation = backend.storage.publish.publish_conversation(conversation_id, pid)
        return conversation
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{conversation_id}/unpublish")
async def unpublish_conversation(
    conversation_id: str,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Unpublish a conversation from the forum."""
    pid = get_profile_id_for_request(user, profile_id)
    try:
        conversation = backend.storage.publish.unpublish_conversation(conversation_id, pid)
        return conversation
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
