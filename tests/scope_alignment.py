"""
Test suite for Scope Alignment System

Demonstrates usage and state changes in the 4-phase scope alignment process:
- Phase 1: Scope Construction (workers define operational boundaries)
- Phase 2: Scope Alignment (conflict resolution, gap filling)
- Phase 3: Execution (refined scopes injected)
- Phase 4: Post-Execution Audit (future)

Run: python -m pytest tests/scope_alignment.py -v
"""

import pytest
import json
from unittest.mock import Mock, patch, AsyncMock
from backend.scope_alignment import (
    execute_scope_alignment,
    apply_scope_to_instruction,
    _phase1_construct_scopes,
    _phase2_align_scopes,
    _extract_all_workers,
    _format_scope_as_instruction,
    _fallback_to_original_scopes
)


@pytest.fixture
def sample_workflow_def():
    """Sample workflow definition with multiple workers"""
    return {
        "models": ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"],
        "supersteps": [
            {
                "map_phase": {
                    "workers": [
                        {
                            "worker_id": "collector",
                            "model_ref": "openai/gpt-4o-mini",
                            "instruction": "Gather raw data from various sources"
                        },
                        {
                            "worker_id": "analyzer",
                            "model_ref": "anthropic/claude-3.5-sonnet",
                            "instruction": "Analyze the collected data for insights"
                        }
                    ]
                },
                "reduce_phase": {
                    "reducer_id": "synthesizer",
                    "model_ref": "openai/gpt-4o",
                    "instruction": "Synthesize findings into coherent report"
                }
            }
        ]
    }


@pytest.fixture
def perspective_matrix_workflow():
    """Workflow with perspective matrix (expands to multiple workers)"""
    return {
        "models": ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"],
        "supersteps": [
            {
                "map_phase": {
                    "perspective_matrix": {
                        "perspectives": [
                            {
                                "perspective_id": "technical",
                                "instruction": "Analyze from technical perspective"
                            },
                            {
                                "perspective_id": "business",
                                "instruction": "Analyze from business perspective"
                            }
                        ],
                        "use_models": "all"
                    }
                }
            }
        ]
    }


@pytest.fixture
def scope_alignment_config():
    """Default scope alignment configuration"""
    return {
        "coordinator_model": "openai/gpt-4o",
        "scope_construction_timeout_ms": 30000,
        "alignment_timeout_ms": 30000
    }


class TestWorkerExtraction:
    """Test extraction of workers from workflow definitions"""

    def test_extract_explicit_workers(self, sample_workflow_def):
        """Test extracting workers from explicit worker definitions"""
        workers = _extract_all_workers(sample_workflow_def)

        # Should extract 2 workers
        assert len(workers) == 2
        assert workers[0]["worker_id"] == "collector"
        assert workers[0]["model_ref"] == "openai/gpt-4o-mini"
        assert "raw data" in workers[0]["instruction"].lower()

        assert workers[1]["worker_id"] == "analyzer"
        assert workers[1]["model_ref"] == "anthropic/claude-3.5-sonnet"
        assert "analyze" in workers[1]["instruction"].lower()

    def test_extract_perspective_matrix_workers(self, perspective_matrix_workflow):
        """Test extracting workers from perspective matrix (cartesian product)"""
        workers = _extract_all_workers(perspective_matrix_workflow)

        # Should create 4 workers: 2 models × 2 perspectives
        assert len(workers) == 4

        # Check worker IDs follow pattern: {model_short}_{perspective_id}
        worker_ids = [w["worker_id"] for w in workers]
        assert "gpt-4o-mini_technical" in worker_ids
        assert "gpt-4o-mini_business" in worker_ids
        assert "claude-3.5-sonnet_technical" in worker_ids
        assert "claude-3.5-sonnet_business" in worker_ids

    def test_extract_empty_workflow(self):
        """Test extraction from workflow with no workers"""
        empty_workflow = {"supersteps": []}
        workers = _extract_all_workers(empty_workflow)
        assert len(workers) == 0


class TestPhase1ScopeConstruction:
    """Test Phase 1: Workers define operational contracts"""

    @pytest.mark.asyncio
    async def test_scope_construction_success(self, scope_alignment_config):
        """Test successful scope construction for workers"""
        workers = [
            {
                "worker_id": "collector",
                "model_ref": "openai/gpt-4o-mini",
                "instruction": "Gather raw data from sources"
            },
            {
                "worker_id": "analyzer",
                "model_ref": "anthropic/claude-3.5-sonnet",
                "instruction": "Analyze collected data"
            }
        ]

        task_spec = "Research the causes of inflation in 2024"

        # Mock query_model to return scope definitions
        # Use instruction text to differentiate which worker is being queried
        async def mock_query_model(model_ref, messages, timeout=30.0):
            messages_str = str(messages)
            if "Gather raw data from sources" in messages_str:
                return {
                    "content": """PRIMARY RESPONSIBILITY:
Collect raw economic data from official sources (Fed, BLS, etc.)

NON-RESPONSIBILITIES:
- Do NOT analyze or interpret data
- Do NOT draw conclusions about causes

OWNERSHIP BOUNDARIES:
Start: User query received
End: Raw data citations and excerpts delivered

DEPENDENCY CONTRACTS:
None - I work independently

DEFINITION OF DONE:
Raw data collected with proper citations"""
                }
            elif "Analyze collected data" in messages_str:
                return {
                    "content": """PRIMARY RESPONSIBILITY:
Analyze collected data to identify inflation patterns

NON-RESPONSIBILITIES:
- Do NOT collect new data
- Do NOT synthesize final report

OWNERSHIP BOUNDARIES:
Start: Raw data received from collector
End: Analysis insights generated

DEPENDENCY CONTRACTS:
Need: raw_data from collector

DEFINITION OF DONE:
Analysis complete with identified patterns"""
                }
            else:
                return {"content": "GENERIC SCOPE"}

        with patch('backend.openrouter.query_model', mock_query_model):
            agent_scopes = await _phase1_construct_scopes(
                workers, task_spec, scope_alignment_config
            )

        # Verify scopes were generated
        assert len(agent_scopes) == 2
        assert "collector" in agent_scopes
        assert "analyzer" in agent_scopes

        # Verify scope content
        assert "Collect raw economic data" in agent_scopes["collector"]
        assert "Do NOT analyze" in agent_scopes["collector"]
        assert "Analyze collected data" in agent_scopes["analyzer"]
        assert "raw_data from collector" in agent_scopes["analyzer"]

    @pytest.mark.asyncio
    async def test_scope_construction_with_failure(self, scope_alignment_config):
        """Test partial success when one worker fails scope construction"""
        workers = [
            {"worker_id": "worker1", "model_ref": "model1", "instruction": "Task 1"},
            {"worker_id": "worker2", "model_ref": "model2", "instruction": "Task 2"}
        ]

        # Use instruction text to differentiate workers (thread-safe)
        async def mock_query_model(model_ref, messages, timeout=30.0):
            messages_str = str(messages)
            if "Task 1" in messages_str:
                return {"content": "PRIMARY RESPONSIBILITY: Do task 1"}
            elif "Task 2" in messages_str:
                return None  # Failure for worker2
            else:
                return None

        with patch('backend.openrouter.query_model', mock_query_model):
            agent_scopes = await _phase1_construct_scopes(
                workers, "test task", scope_alignment_config
            )

        # Should have partial results (only worker1 succeeded)
        assert len(agent_scopes) == 1
        assert "worker1" in agent_scopes


class TestPhase2ScopeAlignment:
    """Test Phase 2: Meta-agent resolves conflicts and gaps"""

    @pytest.mark.asyncio
    async def test_conflict_detection_and_resolution(self, scope_alignment_config):
        """Test detection and resolution of overlapping responsibilities"""
        workers = [
            {"worker_id": "collector", "model_ref": "model1", "instruction": "Collect and validate"},
            {"worker_id": "analyzer", "model_ref": "model2", "instruction": "Validate and analyze"}
        ]

        agent_scopes = {
            "collector": """PRIMARY RESPONSIBILITY: Collect and validate data
NON-RESPONSIBILITIES: None specified
OWNERSHIP BOUNDARIES: Full data pipeline
DEPENDENCY CONTRACTS: None
DEFINITION OF DONE: Data collected and validated""",

            "analyzer": """PRIMARY RESPONSIBILITY: Validate and analyze data
NON-RESPONSIBILITIES: None specified
OWNERSHIP BOUNDARIES: Full analysis pipeline
DEPENDENCY CONTRACTS: None
DEFINITION OF DONE: Analysis complete"""
        }

        task_spec = "Process research data"

        # Mock meta-coordinator response detecting conflict
        async def mock_query_model(model_ref, messages, timeout=30.0):
            return {
                "content": json.dumps({
                    "conflicts_detected": [
                        "Both collector and analyzer claim data validation responsibility"
                    ],
                    "gaps_detected": [],
                    "final_scope_map": {
                        "collector": {
                            "primary_responsibility": "Collect raw data only - NO validation",
                            "boundaries": "Stop after collection, pass to analyzer",
                            "dependencies": "None",
                            "definition_of_done": "Raw data collected"
                        },
                        "analyzer": {
                            "primary_responsibility": "Validate and analyze received data",
                            "boundaries": "Do NOT collect new data",
                            "dependencies": "Raw data from collector",
                            "definition_of_done": "Validated analysis complete"
                        }
                    }
                })
            }

        with patch('backend.openrouter.query_model', mock_query_model):
            final_scope_map = await _phase2_align_scopes(
                workers, task_spec, agent_scopes, "openai/gpt-4o", scope_alignment_config
            )

        # Verify conflict was resolved
        assert len(final_scope_map) == 2
        assert "collector" in final_scope_map
        assert "analyzer" in final_scope_map

        # Verify refined scopes
        collector_scope = final_scope_map["collector"]
        assert "Collect raw data only - NO validation" in collector_scope
        assert "Primary Responsibility" in collector_scope

        analyzer_scope = final_scope_map["analyzer"]
        assert "Validate and analyze" in analyzer_scope
        assert "Raw data from collector" in analyzer_scope

    @pytest.mark.asyncio
    async def test_gap_filling(self, scope_alignment_config):
        """Test detection and filling of coverage gaps"""
        workers = [
            {"worker_id": "worker1", "model_ref": "model1", "instruction": "Task 1"}
        ]

        agent_scopes = {
            "worker1": """PRIMARY RESPONSIBILITY: Collect data
NON-RESPONSIBILITIES: Analysis
OWNERSHIP BOUNDARIES: Data collection only
DEPENDENCY CONTRACTS: None
DEFINITION OF DONE: Data collected"""
        }

        task_spec = "Collect and analyze data"

        # Mock meta-coordinator detecting gap (no analysis coverage)
        async def mock_query_model(model_ref, messages, timeout=30.0):
            return {
                "content": json.dumps({
                    "conflicts_detected": [],
                    "gaps_detected": [
                        "No worker assigned to analyze the collected data"
                    ],
                    "final_scope_map": {
                        "worker1": {
                            "primary_responsibility": "Collect data AND perform basic analysis",
                            "boundaries": "Complete both collection and analysis",
                            "dependencies": "None",
                            "definition_of_done": "Data collected and analyzed"
                        }
                    }
                })
            }

        with patch('backend.openrouter.query_model', mock_query_model):
            final_scope_map = await _phase2_align_scopes(
                workers, task_spec, agent_scopes, "openai/gpt-4o", scope_alignment_config
            )

        # Verify gap was filled by expanding worker1 scope
        assert "Collect data AND perform basic analysis" in final_scope_map["worker1"]

    @pytest.mark.asyncio
    async def test_alignment_failure_fallback(self, scope_alignment_config):
        """Test fallback to original scopes when alignment fails"""
        workers = [
            {"worker_id": "worker1", "model_ref": "model1", "instruction": "Task"}
        ]

        agent_scopes = {
            "worker1": "PRIMARY RESPONSIBILITY: Do task"
        }

        # Mock query_model returning None (failure)
        async def mock_query_model(model_ref, messages, timeout=30.0):
            return None

        with patch('backend.openrouter.query_model', mock_query_model):
            final_scope_map = await _phase2_align_scopes(
                workers, "test", agent_scopes, "model", scope_alignment_config
            )

        # Should fallback to original scope
        assert "worker1" in final_scope_map
        assert "PRIMARY RESPONSIBILITY: Do task" in final_scope_map["worker1"]


class TestPhase3ScopeInjection:
    """Test Phase 3: Refined scopes injected into instructions"""

    def test_apply_scope_to_instruction(self):
        """Test scope injection into worker instruction"""
        worker_id = "analyzer"
        original_instruction = "Analyze the data thoroughly"

        scope_map = {
            "analyzer": """OPERATIONAL SCOPE (DO NOT DEVIATE):
- Primary Responsibility: Analyze received data only
- Boundaries: Do NOT collect new data
- Dependencies: Raw data from collector
- Definition of Done: Analysis complete

"""
        }

        refined_instruction = apply_scope_to_instruction(
            worker_id, original_instruction, scope_map
        )

        # Verify scope was prepended
        assert "OPERATIONAL SCOPE" in refined_instruction
        assert "Primary Responsibility: Analyze received data only" in refined_instruction
        assert "ORIGINAL TASK INSTRUCTION:" in refined_instruction
        assert "Analyze the data thoroughly" in refined_instruction

    def test_apply_scope_missing_worker(self):
        """Test instruction remains unchanged when worker not in scope map"""
        worker_id = "unknown_worker"
        original_instruction = "Do some work"
        scope_map = {"other_worker": "Some scope"}

        refined_instruction = apply_scope_to_instruction(
            worker_id, original_instruction, scope_map
        )

        # Should return original instruction unchanged
        assert refined_instruction == original_instruction


class TestFullScopeAlignment:
    """Test complete scope alignment execution (Phase 1 + Phase 2)"""

    @pytest.mark.asyncio
    async def test_execute_scope_alignment_success(self, sample_workflow_def, scope_alignment_config):
        """Test full scope alignment process end-to-end"""
        task_spec = "Research economic trends"

        # Use instruction text to differentiate phases and workers
        async def mock_query_model(model_ref, messages, timeout=30.0):
            messages_str = str(messages)

            # Phase 1: Individual worker scope construction
            if "Gather raw data from various sources" in messages_str:
                return {
                    "content": """PRIMARY RESPONSIBILITY: Collect economic data
NON-RESPONSIBILITIES: Analysis
OWNERSHIP BOUNDARIES: Data collection only
DEPENDENCY CONTRACTS: None
DEFINITION OF DONE: Data collected"""
                }
            elif "Analyze the collected data for insights" in messages_str:
                return {
                    "content": """PRIMARY RESPONSIBILITY: Analyze data
NON-RESPONSIBILITIES: Collection
OWNERSHIP BOUNDARIES: Analysis only
DEPENDENCY CONTRACTS: Data from collector
DEFINITION OF DONE: Analysis done"""
                }
            # Phase 2: Meta-coordination (checks for multiple agent scopes)
            elif "AGENT SCOPES" in messages_str or "meta-coordinator" in messages_str.lower():
                return {
                    "content": json.dumps({
                        "conflicts_detected": [],
                        "gaps_detected": [],
                        "final_scope_map": {
                            "collector": {
                                "primary_responsibility": "Collect economic data from sources",
                                "boundaries": "Stop after collection",
                                "dependencies": "None",
                                "definition_of_done": "Data collected and formatted"
                            },
                            "analyzer": {
                                "primary_responsibility": "Analyze collected economic data",
                                "boundaries": "Use only provided data",
                                "dependencies": "Data from collector",
                                "definition_of_done": "Trends identified and documented"
                            }
                        }
                    })
                }
            else:
                return {"content": "FALLBACK"}

        with patch('backend.openrouter.query_model', mock_query_model):
            final_scope_map = await execute_scope_alignment(
                sample_workflow_def, task_spec, scope_alignment_config
            )

        # Verify final scope map created
        assert len(final_scope_map) == 2
        assert "collector" in final_scope_map
        assert "analyzer" in final_scope_map

        # Verify formatted scopes
        assert "OPERATIONAL SCOPE" in final_scope_map["collector"]
        assert "Collect economic data from sources" in final_scope_map["collector"]
        assert "Analyze collected economic data" in final_scope_map["analyzer"]

    @pytest.mark.asyncio
    async def test_execute_scope_alignment_empty_workflow(self, scope_alignment_config):
        """Test alignment with empty workflow (no workers)"""
        empty_workflow = {"supersteps": []}

        final_scope_map = await execute_scope_alignment(
            empty_workflow, "test task", scope_alignment_config
        )

        # Should return empty map
        assert final_scope_map == {}

    @pytest.mark.asyncio
    async def test_execute_scope_alignment_phase1_failure(self, sample_workflow_def, scope_alignment_config):
        """Test graceful fallback when Phase 1 fails"""
        # Mock query_model always failing
        async def mock_query_model(model_ref, messages, timeout=30.0):
            return None

        with patch('backend.openrouter.query_model', mock_query_model):
            final_scope_map = await execute_scope_alignment(
                sample_workflow_def, "test", scope_alignment_config
            )

        # Should return empty map (fallback)
        assert final_scope_map == {}


class TestStateTransitions:
    """Test state changes throughout scope alignment process"""

    @pytest.mark.asyncio
    async def test_state_progression(self, sample_workflow_def, scope_alignment_config):
        """Test state evolution from initial config through all phases"""
        task_spec = "Analyze market data"

        # Track state at each phase
        states = {
            "initial": None,
            "phase1": None,
            "phase2": None,
            "phase3": None
        }

        # Use instruction text and message patterns to differentiate
        async def mock_query_model(model_ref, messages, timeout=30.0):
            messages_str = str(messages)

            # Phase 1: Worker scope construction
            if "Gather raw data from various sources" in messages_str:
                return {
                    "content": """PRIMARY RESPONSIBILITY: Task collector
NON-RESPONSIBILITIES: Other tasks
OWNERSHIP BOUNDARIES: Boundary collector
DEPENDENCY CONTRACTS: Deps collector
DEFINITION OF DONE: Done collector"""
                }
            elif "Analyze the collected data for insights" in messages_str:
                return {
                    "content": """PRIMARY RESPONSIBILITY: Task analyzer
NON-RESPONSIBILITIES: Other tasks
OWNERSHIP BOUNDARIES: Boundary analyzer
DEPENDENCY CONTRACTS: Deps analyzer
DEFINITION OF DONE: Done analyzer"""
                }
            # Phase 2: Meta-coordination
            elif "AGENT SCOPES" in messages_str or "conflicts" in messages_str.lower():
                return {
                    "content": json.dumps({
                        "conflicts_detected": ["Some conflict"],
                        "gaps_detected": ["Some gap"],
                        "final_scope_map": {
                            "collector": {
                                "primary_responsibility": "REFINED: Collect only",
                                "boundaries": "REFINED: No analysis",
                                "dependencies": "None",
                                "definition_of_done": "Collection complete"
                            },
                            "analyzer": {
                                "primary_responsibility": "REFINED: Analyze only",
                                "boundaries": "REFINED: No collection",
                                "dependencies": "Data from collector",
                                "definition_of_done": "Analysis complete"
                            }
                        }
                    })
                }
            else:
                return {"content": "FALLBACK"}

        # STATE 1: Initial workflow definition
        states["initial"] = sample_workflow_def.copy()

        with patch('backend.openrouter.query_model', mock_query_model):
            # STATE 2: After Phase 1 (scope construction)
            workers = _extract_all_workers(sample_workflow_def)
            agent_scopes = await _phase1_construct_scopes(
                workers, task_spec, scope_alignment_config
            )
            states["phase1"] = agent_scopes.copy()

            # STATE 3: After Phase 2 (meta-coordination)
            final_scope_map = await _phase2_align_scopes(
                workers, task_spec, agent_scopes, "openai/gpt-4o", scope_alignment_config
            )
            states["phase2"] = final_scope_map.copy()

            # STATE 4: After Phase 3 (injection)
            original_instruction = "Analyze market data thoroughly"
            refined_instruction = apply_scope_to_instruction(
                "analyzer", original_instruction, final_scope_map
            )
            states["phase3"] = refined_instruction

        # Verify state transitions
        assert states["initial"] is not None
        assert "supersteps" in states["initial"]

        assert states["phase1"] is not None
        assert "collector" in states["phase1"]
        assert "PRIMARY RESPONSIBILITY" in states["phase1"]["collector"]

        assert states["phase2"] is not None
        assert "OPERATIONAL SCOPE" in states["phase2"]["analyzer"]
        assert "REFINED: Analyze only" in states["phase2"]["analyzer"]

        assert states["phase3"] is not None
        assert "OPERATIONAL SCOPE" in states["phase3"]
        assert "ORIGINAL TASK INSTRUCTION:" in states["phase3"]
        assert "Analyze market data thoroughly" in states["phase3"]


class TestHelperFunctions:
    """Test helper/utility functions"""

    def test_format_scope_as_instruction(self):
        """Test formatting of scope data into instruction prefix"""
        scope_data = {
            "primary_responsibility": "Collect data",
            "boundaries": "No analysis",
            "dependencies": "None",
            "definition_of_done": "Data collected"
        }

        formatted = _format_scope_as_instruction(scope_data)

        assert "OPERATIONAL SCOPE (DO NOT DEVIATE):" in formatted
        assert "Primary Responsibility: Collect data" in formatted
        assert "Boundaries: No analysis" in formatted
        assert "Dependencies: None" in formatted
        assert "Definition of Done: Data collected" in formatted

    def test_fallback_to_original_scopes(self):
        """Test fallback formatting of original agent scopes"""
        agent_scopes = {
            "worker1": "PRIMARY: Task 1",
            "worker2": "PRIMARY: Task 2"
        }

        fallback_map = _fallback_to_original_scopes(agent_scopes)

        assert len(fallback_map) == 2
        assert "OPERATIONAL SCOPE:" in fallback_map["worker1"]
        assert "PRIMARY: Task 1" in fallback_map["worker1"]
        assert "OPERATIONAL SCOPE:" in fallback_map["worker2"]
        assert "PRIMARY: Task 2" in fallback_map["worker2"]


class TestEdgeCases:
    """Test edge cases and error handling"""

    @pytest.mark.asyncio
    async def test_single_worker_alignment(self, scope_alignment_config):
        """Test alignment with only one worker (no conflicts possible)"""
        single_worker_workflow = {
            "supersteps": [
                {
                    "map_phase": {
                        "workers": [
                            {
                                "worker_id": "solo",
                                "model_ref": "model",
                                "instruction": "Do everything"
                            }
                        ]
                    }
                }
            ]
        }

        async def mock_query_model(model_ref, messages, timeout=30.0):
            if "operational contract" in str(messages).lower():
                return {"content": "PRIMARY RESPONSIBILITY: Do everything"}
            else:
                return {
                    "content": json.dumps({
                        "conflicts_detected": [],
                        "gaps_detected": [],
                        "final_scope_map": {
                            "solo": {
                                "primary_responsibility": "Complete all tasks",
                                "boundaries": "Full ownership",
                                "dependencies": "None",
                                "definition_of_done": "All done"
                            }
                        }
                    })
                }

        with patch('backend.openrouter.query_model', mock_query_model):
            final_scope_map = await execute_scope_alignment(
                single_worker_workflow, "test", scope_alignment_config
            )

        # Should succeed with single worker
        assert len(final_scope_map) == 1
        assert "solo" in final_scope_map

    @pytest.mark.asyncio
    async def test_malformed_json_response(self, scope_alignment_config):
        """Test handling of malformed JSON from meta-coordinator"""
        workers = [{"worker_id": "w", "model_ref": "m", "instruction": "i"}]
        agent_scopes = {"w": "scope"}

        async def mock_query_model(model_ref, messages, timeout=30.0):
            return {"content": "INVALID JSON {{{"}

        with patch('backend.openrouter.query_model', mock_query_model):
            final_scope_map = await _phase2_align_scopes(
                workers, "test", agent_scopes, "model", scope_alignment_config
            )

        # Should fallback to original scopes
        assert "w" in final_scope_map
        assert "OPERATIONAL SCOPE:" in final_scope_map["w"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
