"""
Stage Configuration for Backend

Centralized configuration for all deliberation stages.
This ensures consistency between backend event emission and frontend handling.

This config should match frontend/src/stageConfig.js
"""

from typing import Dict, List, Any
from dataclasses import dataclass, field


@dataclass
class SubStageConfig:
    """Configuration for a sub-stage (used in complex stages)"""
    name: str
    label: str
    event_start: str
    event_complete: str


@dataclass
class StageConfig:
    """Configuration for a deliberation stage"""
    name: str
    label: str
    message_field: str  # Which field in assistant message to update
    loading_message: str
    event_start: str
    event_complete: str
    is_complex: bool = False
    sub_stages: List[SubStageConfig] = field(default_factory=list)
    has_metadata: bool = False
    metadata_field: str = "metadata"


# Stage definitions - MUST match frontend/src/stageConfig.js
STAGES = [
    StageConfig(
        name="stage1",
        label="Stage 1: Individual Responses",
        message_field="stage1",
        loading_message="Collecting individual responses...",
        event_start="stage1_start",
        event_complete="stage1_complete"
    ),
    StageConfig(
        name="stage1_5",
        label="Stage 1.5: Cross-Interrogation",
        message_field="stage1_5",
        loading_message="Running cross-interrogation...",
        event_start="stage1_5_questions_start",  # First sub-stage start
        event_complete="stage1_5_answers_complete",  # Last sub-stage complete
        is_complex=True,
        sub_stages=[
            SubStageConfig(
                name="questions",
                label="Generating Questions",
                event_start="stage1_5_questions_start",
                event_complete="stage1_5_questions_complete"
            ),
            SubStageConfig(
                name="answers",
                label="Collecting Answers",
                event_start="stage1_5_answers_start",
                event_complete="stage1_5_answers_complete"
            )
        ]
    ),
    StageConfig(
        name="stage2",
        label="Stage 2: Peer Rankings",
        message_field="stage2",
        loading_message="Collecting peer rankings...",
        event_start="stage2_start",
        event_complete="stage2_complete",
        has_metadata=True,
        metadata_field="metadata"
    ),
    StageConfig(
        name="stage3",
        label="Stage 3: Final Synthesis",
        message_field="stage3",
        loading_message="Synthesizing final answer...",
        event_start="stage3_start",
        event_complete="stage3_complete"
    )
]

# Special event names (non-stage events)
SPECIAL_EVENTS = {
    "STREAM_INIT": "stream_init",
    "RESUME_INIT": "resume_init",
    "COMPLETE": "complete",
    "ERROR": "error",
    "HEARTBEAT": "heartbeat",
    "RECONNECTED": "reconnected",
    "AUTH_EXPIRED": "auth_expired",
    "TITLE_COMPLETE": "title_complete"
}


def get_stage_config(stage_name: str) -> StageConfig:
    """Get stage configuration by name"""
    for stage in STAGES:
        if stage.name == stage_name:
            return stage
    return None


def get_all_event_types() -> List[str]:
    """Get all event types for validation"""
    stage_events = []
    for stage in STAGES:
        if stage.is_complex:
            for sub_stage in stage.sub_stages:
                stage_events.append(sub_stage.event_start)
                stage_events.append(sub_stage.event_complete)
        else:
            stage_events.append(stage.event_start)
            stage_events.append(stage.event_complete)

    special_events = list(SPECIAL_EVENTS.values())
    return stage_events + special_events


def get_stage_names() -> List[str]:
    """Get ordered list of stage names"""
    return [stage.name for stage in STAGES]


def validate_stage_sequence(last_stage: str) -> List[str]:
    """
    Get remaining stages after a given stage.
    Used for stream resumption.

    Args:
        last_stage: Name of last completed stage

    Returns:
        List of remaining stage names
    """
    stage_names = get_stage_names()
    try:
        last_index = stage_names.index(last_stage)
        return stage_names[last_index + 1:]
    except ValueError:
        raise ValueError(f"Invalid stage name: {last_stage}")


# Example usage for generating events in conversations.py:
#
# from .stage_config import get_stage_config, SPECIAL_EVENTS
#
# stage = get_stage_config("stage1")
# yield send_event(stage.event_start, stage='stage1')
# # ... do work ...
# yield send_event(stage.event_complete, data, 'stage1')
