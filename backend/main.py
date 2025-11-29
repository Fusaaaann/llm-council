"""FastAPI backend for LLM Council."""

from fastapi import FastAPI, HTTPException, Query, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid
import json
import asyncio
import sys
import time
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from . import config  # keep on top of other local modules
from . import storage
from . import auth
from .council import run_full_council, generate_conversation_title, stage1_collect_responses, stage1_5_cross_interrogation, stage1_5_collect_answers, stage2_collect_rankings, stage3_synthesize_final, calculate_aggregate_rankings
from .auth_middleware import get_current_user_optional, ensure_user_logged_in, get_profile_id_for_request
from .startup_validation import run_startup_validation, SecurityValidationError
from .security_middleware import SecurityHeadersMiddleware
from . import audit

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="LLM Council API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Run startup validation
@app.on_event("startup")
async def startup_event():
    """Run security validation on startup."""
    try:
        run_startup_validation()
    except SecurityValidationError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)

# Enable CORS - configurable via FRONTEND_URLS environment variable
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation."""
    uses_byok: bool = False


class SendMessageRequest(BaseModel):
    """Request to send a message in a conversation."""
    content: str


class RenameConversationRequest(BaseModel):
    """Request to rename a conversation."""
    title: str


class ModelConfigRequest(BaseModel):
    """Request to update model configuration."""
    council_models: List[str]
    chairman_model: str


class CreateProfileRequest(BaseModel):
    """Request to create a new profile."""
    name: str
    settings: Optional[Dict[str, Any]] = None


class UpdateProfileRequest(BaseModel):
    """Request to update a profile."""
    name: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class RegisterRequest(BaseModel):
    """Request to register a new user."""
    email: str
    password: str
    name: str
    invite_token: Optional[str] = None


class LoginRequest(BaseModel):
    """Request to log in."""
    email: str
    password: str


class RefreshTokenRequest(BaseModel):
    """Request to refresh access token."""
    refresh_token: str


class WaitlistRequest(BaseModel):
    """Request to join the waitlist."""
    email: str
    name: Optional[str] = None


class ConversationMetadata(BaseModel):
    """Conversation metadata for list view."""
    id: str
    created_at: str
    title: str
    message_count: int
    is_loading: bool = False
    is_public: bool = False
    sync_status: str = "local"
    uses_byok: bool = False


class Conversation(BaseModel):
    """Full conversation with all messages."""
    id: str
    profile_id: str
    created_at: str
    title: str
    messages: List[Dict[str, Any]]
    is_public: bool = False
    published_at: Optional[str] = None
    sync_status: str = "local"
    uses_byok: bool = False


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "LLM Council API"}


@app.get("/api/models")
async def get_models():
    """Get current model configuration."""
    return {
        "council_models": config.COUNCIL_MODELS,
        "chairman_model": config.CHAIRMAN_MODEL
    }


@app.post("/api/models")
async def update_models(req: ModelConfigRequest):
    """Update model configuration for the session."""
    config.COUNCIL_MODELS = req.council_models
    config.CHAIRMAN_MODEL = req.chairman_model
    return {"success": True}


@app.get("/api/conversations", response_model=List[ConversationMetadata])
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


@app.post("/api/conversations", response_model=Conversation)
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


@app.get("/api/conversations/{conversation_id}", response_model=Conversation)
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


@app.patch("/api/conversations/{conversation_id}/rename")
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


@app.delete("/api/conversations/{conversation_id}")
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


def conversation_to_markdown(conversation: Dict[str, Any]) -> str:
    """Convert a conversation to markdown format."""
    md = f"# {conversation['title']}\n\n"
    md += f"*Created: {conversation['created_at']}*\n\n"
    md += "---\n\n"

    for msg in conversation['messages']:
        if msg['role'] == 'user':
            md += f"## 👤 You\n\n{msg['content']}\n\n"
        else:
            md += "## 🤖 LLM Council\n\n"

            # Stage 1
            if msg.get('stage1'):
                md += "### Stage 1: Individual Responses\n\n"
                for resp in msg['stage1']:
                    md += f"**{resp['model']}:**\n\n{resp['content']}\n\n"

            # Stage 1.5
            if msg.get('stage1_5'):
                md += "### Stage 1.5: Cross-Interrogation\n\n"

                # Questions
                if msg['stage1_5'].get('questions'):
                    md += "**Questions:**\n\n"
                    for q in msg['stage1_5']['questions']:
                        label = q.get('label', 'Unknown')
                        md += f"**{label}:**\n\n{q['content']}\n\n"

                # Answers
                if msg['stage1_5'].get('answers'):
                    md += "**Answers:**\n\n"
                    for a in msg['stage1_5']['answers']:
                        label = a.get('label', 'Unknown')
                        md += f"**{label}:**\n\n{a['content']}\n\n"

            # Stage 2
            if msg.get('stage2'):
                md += "### Stage 2: Peer Rankings\n\n"
                for ranking in msg['stage2']:
                    md += f"**{ranking['model']}:**\n\n{ranking['content']}\n\n"

                # Aggregate rankings
                if msg.get('metadata', {}).get('aggregate_rankings'):
                    md += "**Aggregate Rankings:**\n\n"
                    for rank in msg['metadata']['aggregate_rankings']:
                        md += f"{rank['rank']}. {rank['model']} (avg: {rank['average_position']:.2f})\n"
                    md += "\n"

            # Stage 3
            if msg.get('stage3'):
                md += "### Stage 3: Final Synthesis\n\n"
                md += f"{msg['stage3']['content']}\n\n"

        md += "---\n\n"

    return md


@app.get("/api/conversations/{conversation_id}/export/markdown")
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


@app.post("/api/conversations/{conversation_id}/message")
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


@app.post("/api/conversations/{conversation_id}/message/stream")
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


# Profile management endpoints

@app.get("/api/profiles")
async def list_profiles():
    """List all profiles."""
    return storage.list_profiles()


@app.get("/api/profiles/{profile_id}")
async def get_profile(profile_id: str):
    """Get a specific profile."""
    profile = storage.get_profile(profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@app.post("/api/profiles")
async def create_profile(req: CreateProfileRequest):
    """Create a new profile."""
    profile_id = str(uuid.uuid4())
    try:
        profile = storage.create_profile(profile_id, req.name, req.settings)
        return profile
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.patch("/api/profiles/{profile_id}")
async def update_profile(profile_id: str, req: UpdateProfileRequest):
    """Update a profile."""
    try:
        profile = storage.update_profile(profile_id, req.name, req.settings)
        return profile
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.delete("/api/profiles/{profile_id}")
async def delete_profile(profile_id: str):
    """Delete a profile."""
    try:
        success = storage.delete_profile(profile_id)
        if not success:
            raise HTTPException(status_code=404, detail="Profile not found")
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Publish/unpublish endpoints

@app.post("/api/conversations/{conversation_id}/publish")
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


@app.delete("/api/conversations/{conversation_id}/unpublish")
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


@app.get("/api/conversations/{conversation_id}/encryption-status")
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


@app.post("/api/conversations/{conversation_id}/encrypt")
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


@app.post("/api/conversations/{conversation_id}/decrypt")
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


# Forum endpoints

@app.get("/api/forum/conversations")
async def list_forum_conversations():
    """List all public conversations in the forum."""
    return storage.list_public_conversations()


@app.get("/api/forum/conversations/{conversation_id}")
async def get_forum_conversation(
    conversation_id: str,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get a specific public conversation from the forum.
    Profile ID is needed to locate the conversation.
    """
    pid = get_profile_id_for_request(user, profile_id)
    conversation = storage.get_conversation(conversation_id, pid)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if not conversation.get("is_public", False):
        raise HTTPException(status_code=403, detail="Conversation is not public")

    return conversation


# Authentication endpoints

@app.post("/api/auth/register")
@limiter.limit("3/hour")
async def register(req: RegisterRequest, request: Request):
    """Register a new user account (requires invite token in production)."""
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        # In production mode, require invite token
        if config.ENVIRONMENT == "production" and not req.invite_token:
            audit.log_register_failure(req.email, ip_address=client_ip, user_agent=user_agent, reason="missing_invite_token")
            raise HTTPException(status_code=400, detail="Invite token required for registration")

        user = auth.create_user(req.email, req.password, req.name, req.invite_token)

        # Create tokens
        access_token = auth.create_access_token(user["id"], user["default_profile_id"])
        refresh_token_data = auth.create_refresh_token_record(user["id"], user["default_profile_id"])

        audit.log_register_success(user["id"], user["email"], ip_address=client_ip, user_agent=user_agent, invited=bool(req.invite_token))

        return {
            "user": auth.get_safe_user_data(user),
            "access_token": access_token,
            "refresh_token": refresh_token_data["token"],
            "token_type": "bearer"
        }
    except ValueError as e:
        audit.log_register_failure(req.email, ip_address=client_ip, user_agent=user_agent, reason=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/login")
@limiter.limit("5/15minutes")
async def login(req: LoginRequest, request: Request):
    """Authenticate and log in a user."""
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    user = auth.authenticate_user(req.email, req.password)

    # Check if account is locked
    if user and user.get("_locked"):
        audit.log_login_failure(req.email, ip_address=client_ip, user_agent=user_agent, reason="account_locked")
        locked_until = user.get("locked_until", "unknown")
        raise HTTPException(
            status_code=403,
            detail=f"Account temporarily locked due to too many failed login attempts. Please try again later. Locked until: {locked_until}"
        )

    if not user:
        audit.log_login_failure(req.email, ip_address=client_ip, user_agent=user_agent, reason="invalid_credentials")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Create tokens
    access_token = auth.create_access_token(user["id"], user["default_profile_id"])
    refresh_token_data = auth.create_refresh_token_record(user["id"], user["default_profile_id"])

    audit.log_login_success(user["id"], user["email"], ip_address=client_ip, user_agent=user_agent)

    return {
        "user": auth.get_safe_user_data(user),
        "access_token": access_token,
        "refresh_token": refresh_token_data["token"],
        "token_type": "bearer"
    }


@app.post("/api/auth/refresh")
@limiter.limit("20/minute")
async def refresh_token(req: RefreshTokenRequest, request: Request):
    """Refresh an access token and rotate refresh token for enhanced security."""
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    session = auth.verify_refresh_token(req.refresh_token)

    if not session:
        audit.log_token_refresh_failure(ip_address=client_ip, user_agent=user_agent, reason="invalid_token")
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = auth.get_user_by_id(session["user_id"])
    if not user:
        audit.log_token_refresh_failure(ip_address=client_ip, user_agent=user_agent, reason="user_not_found")
        raise HTTPException(status_code=401, detail="User not found")

    # Revoke old refresh token immediately (token rotation)
    auth.revoke_refresh_token(req.refresh_token)

    # Create new access token AND new refresh token
    access_token = auth.create_access_token(user["id"], user["default_profile_id"])
    new_refresh_token_data = auth.create_refresh_token_record(user["id"], user["default_profile_id"])

    audit.log_token_refresh(user["id"], user["email"], ip_address=client_ip, user_agent=user_agent)

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token_data["token"],  # Return new refresh token
        "token_type": "bearer"
    }


@app.post("/api/auth/logout")
async def logout(req: RefreshTokenRequest, request: Request):
    """Log out by revoking a refresh token."""
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Try to get user info from session before revoking
    session = auth.verify_refresh_token(req.refresh_token)
    if session:
        user = auth.get_user_by_id(session["user_id"])
        if user:
            audit.log_logout(user["id"], user["email"], ip_address=client_ip, user_agent=user_agent)

    auth.revoke_refresh_token(req.refresh_token)
    return {"success": True}


@app.get("/api/auth/me")
async def get_current_user(user: Dict[str, Any] = Depends(ensure_user_logged_in)):
    """Get current authenticated user."""
    return {"user": user}


# Waitlist endpoints

@app.post("/api/waitlist")
@limiter.limit("1/hour")
async def join_waitlist(request: Request, waitlist_data: WaitlistRequest):
    """Join the waitlist for account registration."""
    client_ip = request.client.host if request.client else None

    try:
        entry = storage.add_to_waitlist(waitlist_data.email, waitlist_data.name)

        audit.log_waitlist_submission(waitlist_data.email, ip_address=client_ip)

        # TODO: Send notification email to admin
        # This would be implemented with an email service

        return {
            "success": True,
            "message": "Successfully joined waitlist",
            "email": entry["email"]
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/invite/validate/{token}")
async def validate_invite(token: str, request: Request):
    """Validate an invite token."""
    client_ip = request.client.host if request.client else None

    is_valid, error = storage.validate_invite_token(token)

    invite = storage.get_invite_token(token) if is_valid else None
    audit.log_invite_validation(
        token,
        "success" if is_valid else "failure",
        email=invite.get("email") if invite else None,
        ip_address=client_ip
    )

    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    return {
        "valid": True,
        "email": invite.get("email"),
        "expires_at": invite.get("expires_at")
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
