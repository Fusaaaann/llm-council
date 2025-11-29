"""Conversation management and messaging endpoints."""

from fastapi import APIRouter, HTTPException, Query, Depends, Request
from fastapi.responses import StreamingResponse, Response
from typing import List, Dict, Any, Optional
import uuid
import json
import asyncio
import time

from .. import config, storage, auth
from ..council import (
    stage1_collect_responses,
    stage1_5_cross_interrogation,
    stage1_5_collect_answers,
    stage2_collect_rankings,
    stage3_synthesize_final,
    calculate_aggregate_rankings,
    generate_conversation_title
)
from ..auth_middleware import get_current_user_optional, get_profile_id_for_request
from ..models import (
    CreateConversationRequest,
    SendMessageRequest,
    RenameConversationRequest,
    Conversation,
    ConversationMetadata
)
from ..utils import conversation_to_markdown
from ..rate_limiter import limiter

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


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
    # For public view, no profile access check needed
    if view == "public":
        return storage.list_conversations(profile_id="default", view="public")

    # For private/all views, validate profile access
    pid = get_profile_id_for_request(user, profile_id)
    return storage.list_conversations(pid, view)


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
    # If token provided in query param (EventSource workaround), verify it
    if token and not user:
        try:
            payload = auth.verify_access_token(token)
            user = {"id": payload["user_id"], "profile_id": payload.get("profile_id")}
        except Exception:
            # Invalid token - continue without auth (for public view)
            pass

    # For public view, no profile access check needed
    if view == "public":
        pid = "default"
    else:
        # For private/all views, validate profile access
        pid = get_profile_id_for_request(user, profile_id)

    async def event_generator():
        try:
            # Send initial conversation list
            conversations = storage.list_conversations(pid, view)
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
                current_conversations = storage.list_conversations(pid, view)
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
    conversation = storage.create_conversation(conversation_id, pid, req.uses_byok)
    return conversation


@router.get("/{conversation_id}", response_model=Conversation)
async def get_conversation(
    conversation_id: str,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Get a specific conversation with all its messages."""
    pid = get_profile_id_for_request(user, profile_id)
    conversation = storage.get_conversation(conversation_id, pid)
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
    conversation = storage.get_conversation(conversation_id, pid)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    storage.update_conversation_title(conversation_id, req.title, pid)
    return {"success": True}


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Delete a conversation."""
    pid = get_profile_id_for_request(user, profile_id)
    success = storage.delete_conversation(conversation_id, pid)
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
    conversation = storage.get_conversation(conversation_id, pid)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    markdown = conversation_to_markdown(conversation)
    filename = f"{conversation['title'].replace(' ', '_')}.md"

    return Response(
        content=markdown,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
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
    """
    pid = get_profile_id_for_request(user, profile_id)

    # Check if conversation exists
    conversation = storage.get_conversation(conversation_id, pid)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    try:
        # Set loading state
        storage.set_conversation_loading(conversation_id, True, pid)

        # Add user message
        storage.add_user_message(conversation_id, req.content, pid)

        # Generate title in parallel if first message
        title_task = None
        if is_first_message:
            title_task = asyncio.create_task(generate_conversation_title(req.content))

        # Stage 1: Collect responses
        stage1_results = await stage1_collect_responses(req.content)

        # Stage 1.5: Cross-interrogation (questions)
        questions_results, label_to_model_interrogation = await stage1_5_cross_interrogation(req.content, stage1_results)

        # Stage 1.5: Collect answers
        answers_results = await stage1_5_collect_answers(req.content, stage1_results, questions_results, label_to_model_interrogation)

        # Stage 2: Collect rankings
        stage2_results, label_to_model = await stage2_collect_rankings(req.content, stage1_results)
        aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)

        # Stage 3: Synthesize final answer
        stage3_result = await stage3_synthesize_final(req.content, stage1_results, stage2_results)

        # Wait for title if it was started
        if title_task:
            title = await title_task
            storage.update_conversation_title(conversation_id, title, pid)

        # Build metadata and stage1_5 data
        metadata = {
            'label_to_model': label_to_model,
            'aggregate_rankings': aggregate_rankings
        }
        stage1_5_data = {
            'questions': questions_results,
            'answers': answers_results,
            'label_to_model': label_to_model_interrogation
        }

        # Add assistant message with all stages and metadata
        storage.add_assistant_message(
            conversation_id,
            stage1_results,
            stage2_results,
            stage3_result,
            metadata,
            stage1_5_data,
            pid
        )

        # Clear loading state
        storage.set_conversation_loading(conversation_id, False, pid)

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
        storage.set_conversation_loading(conversation_id, False, pid)
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
    """
    pid = get_profile_id_for_request(user, profile_id)

    # Check if conversation exists
    conversation = storage.get_conversation(conversation_id, pid)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    async def event_generator():
        try:
            # Generate connection token for this streaming session
            stream_id = str(uuid.uuid4())
            connection_token = None

            # Only generate connection token if user is authenticated
            if user:
                connection_token = auth.create_connection_token(
                    user_id=user["id"],
                    conversation_id=conversation_id,
                    stream_id=stream_id
                )

            # Send stream initialization event with connection token
            yield f"data: {json.dumps({'type': 'stream_init', 'stream_id': stream_id, 'connection_token': connection_token})}\n\n"

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
                            return ('auth_expired', {
                                'type': 'auth_expired',
                                'reason': 'logged_out',
                                'message': 'Session ended. Please log in again.'
                            })

                    # Send heartbeat
                    last_heartbeat[0] = now
                    return ('heartbeat', {
                        'type': 'heartbeat',
                        'timestamp': now
                    })

                return None  # No heartbeat needed

            # Set loading state to true
            storage.set_conversation_loading(conversation_id, True, pid)

            try:
                # Add user message (with idempotency check to prevent duplicates on retry)
                # Check if last message is already this exact user message
                last_msg = conversation["messages"][-1] if conversation["messages"] else None
                is_duplicate = (
                    last_msg
                    and last_msg.get("role") == "user"
                    and last_msg.get("content") == req.content
                )

                if not is_duplicate:
                    storage.add_user_message(conversation_id, req.content, pid)
                else:
                    print(f"[INFO] Skipping duplicate user message for conversation {conversation_id}")

                # Start title generation in parallel (don't await yet)
                title_task = None
                if is_first_message:
                    title_task = asyncio.create_task(generate_conversation_title(req.content))

                # Stage 1: Collect responses
                yield f"data: {json.dumps({'type': 'stage1_start'})}\n\n"
                stage1_results = await stage1_collect_responses(req.content)
                yield f"data: {json.dumps({'type': 'stage1_complete', 'data': stage1_results})}\n\n"
                # Save partial state after stage1
                storage.save_partial_assistant_message(conversation_id, "stage1", stage1_results, profile_id=pid)

                # Check heartbeat and send if needed
                heartbeat_event = check_and_send_heartbeat()
                if heartbeat_event:
                    event_type, event_data = heartbeat_event
                    yield f"data: {json.dumps(event_data)}\n\n"
                    if event_type == 'auth_expired':
                        return  # Stop stream if auth expired

                # Stage 1.5: Cross-interrogation (questions)
                yield f"data: {json.dumps({'type': 'stage1_5_questions_start'})}\n\n"
                questions_results, label_to_model_interrogation = await stage1_5_cross_interrogation(req.content, stage1_results)
                yield f"data: {json.dumps({'type': 'stage1_5_questions_complete', 'data': questions_results})}\n\n"

                # Stage 1.5: Collect answers
                yield f"data: {json.dumps({'type': 'stage1_5_answers_start'})}\n\n"
                answers_results = await stage1_5_collect_answers(req.content, stage1_results, questions_results, label_to_model_interrogation)
                yield f"data: {json.dumps({'type': 'stage1_5_answers_complete', 'data': answers_results, 'label_to_model': label_to_model_interrogation})}\n\n"
                # Save partial state after stage1_5
                stage1_5_data = {
                    'questions': questions_results,
                    'answers': answers_results,
                    'label_to_model': label_to_model_interrogation
                }
                storage.save_partial_assistant_message(conversation_id, "stage1_5", stage1_5_data, profile_id=pid)

                # Check heartbeat and send if needed
                heartbeat_event = check_and_send_heartbeat()
                if heartbeat_event:
                    event_type, event_data = heartbeat_event
                    yield f"data: {json.dumps(event_data)}\n\n"
                    if event_type == 'auth_expired':
                        return

                # Stage 2: Collect rankings
                yield f"data: {json.dumps({'type': 'stage2_start'})}\n\n"
                stage2_results, label_to_model = await stage2_collect_rankings(req.content, stage1_results)
                aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)
                yield f"data: {json.dumps({'type': 'stage2_complete', 'data': stage2_results, 'metadata': {'label_to_model': label_to_model, 'aggregate_rankings': aggregate_rankings}})}\n\n"
                # Save partial state after stage2 (with metadata)
                metadata = {
                    'label_to_model': label_to_model,
                    'aggregate_rankings': aggregate_rankings
                }
                storage.save_partial_assistant_message(conversation_id, "stage2", stage2_results, metadata=metadata, profile_id=pid)

                # Check heartbeat and send if needed
                heartbeat_event = check_and_send_heartbeat()
                if heartbeat_event:
                    event_type, event_data = heartbeat_event
                    yield f"data: {json.dumps(event_data)}\n\n"
                    if event_type == 'auth_expired':
                        return

                # Stage 3: Synthesize final answer
                yield f"data: {json.dumps({'type': 'stage3_start'})}\n\n"
                stage3_result = await stage3_synthesize_final(req.content, stage1_results, stage2_results)
                yield f"data: {json.dumps({'type': 'stage3_complete', 'data': stage3_result})}\n\n"
                # Save partial state after stage3 (marks as complete)
                storage.save_partial_assistant_message(conversation_id, "stage3", stage3_result, profile_id=pid)

                # Wait for title generation if it was started
                if title_task:
                    title = await title_task
                    storage.update_conversation_title(conversation_id, title, pid)
                    yield f"data: {json.dumps({'type': 'title_complete', 'data': {'title': title}})}\n\n"

                # Note: Assistant message already saved incrementally via save_partial_assistant_message()
                # after each stage. No need to call add_assistant_message() here.

                # Send completion event
                yield f"data: {json.dumps({'type': 'complete'})}\n\n"

            finally:
                # Always clear loading state, even if errors occurred
                storage.set_conversation_loading(conversation_id, False, pid)

        except Exception as e:
            # Set loading state to false on error (in case finally block didn't run)
            storage.set_conversation_loading(conversation_id, False, pid)

            # Send error event
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.get("/{conversation_id}/encryption-status")
async def get_encryption_status(
    conversation_id: str,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Get the encryption status of a conversation."""
    pid = get_profile_id_for_request(user, profile_id)
    try:
        status = storage.get_conversation_encryption_status(conversation_id, pid)
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
        conversation = storage.encrypt_conversation(conversation_id, pid)
        return {
            "success": True,
            "message": "Conversation encrypted",
            "status": storage.get_conversation_encryption_status(conversation_id, pid)
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
        conversation = storage.decrypt_conversation(conversation_id, pid)
        return {
            "success": True,
            "message": "Conversation decrypted",
            "status": storage.get_conversation_encryption_status(conversation_id, pid)
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
        conversation = storage.publish_conversation(conversation_id, pid)
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
        conversation = storage.unpublish_conversation(conversation_id, pid)
        return conversation
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
