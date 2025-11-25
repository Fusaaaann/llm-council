"""FastAPI backend for LLM Council."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from typing import List, Dict, Any
import uuid
import json
import asyncio

from . import storage
from . import config
from .council import run_full_council, generate_conversation_title, stage1_collect_responses, stage1_5_cross_interrogation, stage1_5_collect_answers, stage2_collect_rankings, stage3_synthesize_final, calculate_aggregate_rankings

app = FastAPI(title="LLM Council API")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation."""
    pass


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


class ConversationMetadata(BaseModel):
    """Conversation metadata for list view."""
    id: str
    created_at: str
    title: str
    message_count: int
    is_loading: bool = False


class Conversation(BaseModel):
    """Full conversation with all messages."""
    id: str
    created_at: str
    title: str
    messages: List[Dict[str, Any]]


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
async def update_models(request: ModelConfigRequest):
    """Update model configuration for the session."""
    config.COUNCIL_MODELS = request.council_models
    config.CHAIRMAN_MODEL = request.chairman_model
    return {"success": True}


@app.get("/api/conversations", response_model=List[ConversationMetadata])
async def list_conversations():
    """List all conversations (metadata only)."""
    return storage.list_conversations()


@app.post("/api/conversations", response_model=Conversation)
async def create_conversation(request: CreateConversationRequest):
    """Create a new conversation."""
    conversation_id = str(uuid.uuid4())
    conversation = storage.create_conversation(conversation_id)
    return conversation


@app.get("/api/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str):
    """Get a specific conversation with all its messages."""
    conversation = storage.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@app.patch("/api/conversations/{conversation_id}/rename")
async def rename_conversation(conversation_id: str, request: RenameConversationRequest):
    """Rename a conversation."""
    conversation = storage.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    storage.update_conversation_title(conversation_id, request.title)
    return {"success": True}


@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a conversation."""
    success = storage.delete_conversation(conversation_id)
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
async def export_markdown(conversation_id: str):
    """Export conversation as markdown."""
    conversation = storage.get_conversation(conversation_id)
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
async def send_message(conversation_id: str, request: SendMessageRequest):
    """
    Send a message and run the 3-stage council process.
    Returns the complete response with all stages.
    Now uses same stage logic as streaming endpoint.
    """
    # Check if conversation exists
    conversation = storage.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    try:
        # Set loading state
        storage.set_conversation_loading(conversation_id, True)

        # Add user message
        storage.add_user_message(conversation_id, request.content)

        # Generate title in parallel if first message
        title_task = None
        if is_first_message:
            title_task = asyncio.create_task(generate_conversation_title(request.content))

        # Stage 1: Collect responses
        stage1_results = await stage1_collect_responses(request.content)

        # Stage 1.5: Cross-interrogation (questions)
        questions_results, label_to_model_interrogation = await stage1_5_cross_interrogation(request.content, stage1_results)

        # Stage 1.5: Collect answers
        answers_results = await stage1_5_collect_answers(request.content, stage1_results, questions_results, label_to_model_interrogation)

        # Stage 2: Collect rankings
        stage2_results, label_to_model = await stage2_collect_rankings(request.content, stage1_results)
        aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)

        # Stage 3: Synthesize final answer
        stage3_result = await stage3_synthesize_final(request.content, stage1_results, stage2_results)

        # Wait for title if it was started
        if title_task:
            title = await title_task
            storage.update_conversation_title(conversation_id, title)

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
            stage1_5_data
        )

        # Clear loading state
        storage.set_conversation_loading(conversation_id, False)

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
        storage.set_conversation_loading(conversation_id, False)
        raise


@app.post("/api/conversations/{conversation_id}/message/stream")
async def send_message_stream(conversation_id: str, request: SendMessageRequest):
    """
    Send a message and stream the 3-stage council process.
    Returns Server-Sent Events as each stage completes.
    """
    # Check if conversation exists
    conversation = storage.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    async def event_generator():
        try:
            # Set loading state to true
            storage.set_conversation_loading(conversation_id, True)

            # Add user message
            storage.add_user_message(conversation_id, request.content)

            # Start title generation in parallel (don't await yet)
            title_task = None
            if is_first_message:
                title_task = asyncio.create_task(generate_conversation_title(request.content))

            # Stage 1: Collect responses
            yield f"data: {json.dumps({'type': 'stage1_start'})}\n\n"
            stage1_results = await stage1_collect_responses(request.content)
            yield f"data: {json.dumps({'type': 'stage1_complete', 'data': stage1_results})}\n\n"

            # Stage 1.5: Cross-interrogation (questions)
            yield f"data: {json.dumps({'type': 'stage1_5_questions_start'})}\n\n"
            questions_results, label_to_model_interrogation = await stage1_5_cross_interrogation(request.content, stage1_results)
            yield f"data: {json.dumps({'type': 'stage1_5_questions_complete', 'data': questions_results})}\n\n"

            # Stage 1.5: Collect answers
            yield f"data: {json.dumps({'type': 'stage1_5_answers_start'})}\n\n"
            answers_results = await stage1_5_collect_answers(request.content, stage1_results, questions_results, label_to_model_interrogation)
            yield f"data: {json.dumps({'type': 'stage1_5_answers_complete', 'data': answers_results, 'label_to_model': label_to_model_interrogation})}\n\n"

            # Stage 2: Collect rankings
            yield f"data: {json.dumps({'type': 'stage2_start'})}\n\n"
            stage2_results, label_to_model = await stage2_collect_rankings(request.content, stage1_results)
            aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)
            yield f"data: {json.dumps({'type': 'stage2_complete', 'data': stage2_results, 'metadata': {'label_to_model': label_to_model, 'aggregate_rankings': aggregate_rankings}})}\n\n"

            # Stage 3: Synthesize final answer
            yield f"data: {json.dumps({'type': 'stage3_start'})}\n\n"
            stage3_result = await stage3_synthesize_final(request.content, stage1_results, stage2_results)
            yield f"data: {json.dumps({'type': 'stage3_complete', 'data': stage3_result})}\n\n"

            # Wait for title generation if it was started
            if title_task:
                title = await title_task
                storage.update_conversation_title(conversation_id, title)
                yield f"data: {json.dumps({'type': 'title_complete', 'data': {'title': title}})}\n\n"

            # Save complete assistant message with metadata and stage1_5
            metadata = {
                'label_to_model': label_to_model,
                'aggregate_rankings': aggregate_rankings
            }
            stage1_5_data = {
                'questions': questions_results,
                'answers': answers_results,
                'label_to_model': label_to_model_interrogation
            }
            storage.add_assistant_message(
                conversation_id,
                stage1_results,
                stage2_results,
                stage3_result,
                metadata,
                stage1_5_data
            )

            # Set loading state to false
            storage.set_conversation_loading(conversation_id, False)

            # Send completion event
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            # Set loading state to false on error
            storage.set_conversation_loading(conversation_id, False)

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
