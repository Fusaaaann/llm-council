"""Core workflow execution engine following BSP architecture."""

import json
import logging
from typing import Dict, Any, List, Optional, AsyncGenerator, Tuple
from backend.json_utils import parse_json_safe

logger = logging.getLogger(__name__)


class WorkflowMemory:
    """Variable storage with type validation."""

    def __init__(self, var_definitions: List[Dict]):
        """
        Initialize variables with defaults.

        Args:
            var_definitions: List of variable definition dicts
        """
        self.variables = {v['name']: v.get('default_value') for v in var_definitions}
        self.types = {v['name']: v['type'] for v in var_definitions}

    def read(self, var_name: str) -> Any:
        """
        Read variable value.

        Args:
            var_name: Variable name

        Returns:
            Variable value

        Raises:
            ValueError: If variable not defined
        """
        if var_name not in self.variables:
            raise ValueError(f"Variable '{var_name}' not defined")
        return self.variables[var_name]

    def write(self, var_name: str, value: Any) -> None:
        """
        Write variable value with type checking and auto-coercion.

        Args:
            var_name: Variable name
            value: Value to write

        Raises:
            ValueError: If variable not defined or type mismatch
        """
        if var_name not in self.variables:
            raise ValueError(f"Variable '{var_name}' not defined")

        # Get expected type and apply coercion if needed
        expected_type = self.types[var_name]
        coerced_value = self._coerce_type(value, expected_type, var_name)

        # Validate the coerced value
        self._validate_type(coerced_value, expected_type)

        self.variables[var_name] = coerced_value

    def _coerce_type(self, value: Any, expected_type: str, var_name: str) -> Any:
        """
        Attempt to coerce value to expected type.

        This handles common mismatches, especially when LLMs return JSON strings
        instead of parsed objects.

        Args:
            value: Value to coerce
            expected_type: Target type ('string', 'json_object', 'list')
            var_name: Variable name (for logging)

        Returns:
            Coerced value

        Raises:
            ValueError: If coercion fails
        """
        # If types already match, no coercion needed
        if expected_type == 'string' and isinstance(value, str):
            return value
        elif expected_type == 'list' and isinstance(value, list):
            return value
        elif expected_type == 'json_object' and isinstance(value, dict):
            return value

        # Attempt coercion for common mismatches
        if expected_type == 'json_object' and isinstance(value, str):
            # LLM returned JSON as string - parse it with robust extraction
            success, parsed, error = parse_json_safe(value, expected_type=dict, var_name=var_name)

            if success:
                logger.info(f"Auto-parsed JSON string to object for variable '{var_name}'")
                return parsed
            else:
                # Check if empty string for better error message
                if not value.strip():
                    raise ValueError(
                        f"Variable '{var_name}' expects json_object, but got empty string. "
                        f"The reducer likely failed or returned no content. Check model logs above for details."
                    )
                else:
                    raise ValueError(error)

        elif expected_type == 'list' and isinstance(value, str):
            # Try parsing string as JSON list with robust extraction
            success, parsed, error = parse_json_safe(value, expected_type=list, var_name=var_name)

            if success:
                logger.info(f"Auto-parsed JSON string to list for variable '{var_name}'")
                return parsed
            else:
                # Check if empty string for better error message
                if not value.strip():
                    raise ValueError(
                        f"Variable '{var_name}' expects list, but got empty string. "
                        f"The reducer likely failed or returned no content. Check model logs above for details."
                    )
                else:
                    raise ValueError(error)

        # No coercion available, return as-is and let validation catch it
        return value

    def _validate_type(self, value: Any, expected_type: str) -> None:
        """
        Validate value matches expected type.

        Args:
            value: Value to validate
            expected_type: Expected type string ('string', 'json_object', 'list')

        Raises:
            ValueError: If type mismatch
        """
        if expected_type == 'string' and not isinstance(value, str):
            raise ValueError(f"Expected string, got {type(value).__name__}")
        elif expected_type == 'list' and not isinstance(value, list):
            raise ValueError(f"Expected list, got {type(value).__name__}")
        elif expected_type == 'json_object' and not isinstance(value, dict):
            raise ValueError(f"Expected json_object, got {type(value).__name__}")

    def to_dict(self) -> Dict[str, Any]:
        """
        Export all variables for storage.

        Returns:
            Dict of variable name -> value
        """
        return self.variables.copy()


class WorkflowExecutor:
    """Main execution orchestrator for BSP workflows."""

    def __init__(self, workflow_def: Dict[str, Any]):
        """
        Initialize workflow executor.

        Args:
            workflow_def: Complete workflow JSON definition
        """
        self.workflow = workflow_def
        self.memory = WorkflowMemory(workflow_def.get('variables', []))
        self.global_timeout_ms = workflow_def.get('global_timeout_ms', 60000)
        self.global_models = workflow_def.get('models', [])
        self.worker_outputs_by_step = {}  # Track worker outputs per superstep
        self.superstep_results = []  # Track reducer outputs with metadata
        self.scope_map = {}  # Refined scope definitions (populated if scope_alignment enabled)
        self.scope_alignment_enabled = False  # Track if alignment was performed

    async def execute_stream(
        self,
        conversation: Dict[str, Any],
        user_input: str
    ) -> AsyncGenerator[str, None]:
        """
        Execute workflow with SSE streaming.

        Args:
            conversation: Full conversation object with history
            user_input: Current user message

        Yields:
            SSE event strings (data: {json}\n\n format)
        """
        # Build message history
        messages = self._build_message_history(conversation, user_input)

        # Run scope alignment if enabled (silent pre-execution phase)
        await self._run_scope_alignment_if_enabled(user_input)

        # Stream init event
        yield self._send_event("stream_init", {
            "workflow_id": self.workflow['flow_id'],
            "superstep_count": len(self.workflow['supersteps'])
        })

        # Execute each superstep
        for superstep in self.workflow['supersteps']:
            step_id = superstep['step_id']
            superstep_type = superstep.get('superstep_type', 'map_reduce')

            # Dispatch to appropriate executor based on superstep type
            if superstep_type == 'score_and_rank':
                # SCORE AND RANK SUPERSTEP
                async for event in self._execute_score_and_rank_superstep(
                    superstep,
                    user_input,
                    conversation
                ):
                    yield event

            else:
                # MAP-REDUCE SUPERSTEP (default)
                # MAP PHASE
                yield self._send_event(f"superstep_{step_id}_map_start", {
                    "step_id": step_id,
                    "description": superstep.get('description', '')
                })

                # Apply variable interpolation if enabled
                map_phase = superstep['map_phase']
                if superstep.get('reduce_phase', {}).get('variable_interpolation', False):
                    map_phase = self._apply_interpolation_to_map_phase(map_phase)

                worker_outputs = await self._execute_map_phase(
                    map_phase,
                    messages
                )

                # Store worker outputs for this step
                self.worker_outputs_by_step[step_id] = worker_outputs

                yield self._send_event(f"superstep_{step_id}_map_complete", {
                    "step_id": step_id,
                    "worker_count": len(worker_outputs),
                    "worker_outputs": worker_outputs
                })

                # MIDDLEWARE PHASE (optional)
                rejected = []
                if 'middleware_phase' in superstep and superstep['middleware_phase']:
                    processed, rejected = await self._execute_middleware_phase(
                        worker_outputs,
                        superstep['middleware_phase']
                    )
                    worker_outputs = processed

                    yield self._send_event(f"superstep_{step_id}_middleware_complete", {
                        "step_id": step_id,
                        "processed_count": len(processed),
                        "rejected_count": len(rejected)
                    })

                # REDUCE PHASE
                yield self._send_event(f"superstep_{step_id}_reduce_start", {
                    "step_id": step_id
                })

                result = await self._execute_reduce_phase(
                    superstep['reduce_phase'],
                    worker_outputs,
                    messages,
                    rejected
                )

                # Write to variable
                output_var = superstep['reduce_phase']['output_write_to']
                self.memory.write(output_var, result)

                # Track reducer output with metadata for UI display
                from datetime import datetime, timezone
                self.superstep_results.append({
                    'step_id': step_id,
                    'superstep_type': 'map_reduce',
                    'reducer_strategy': superstep['reduce_phase']['strategy'],
                    'reducer_model': superstep['reduce_phase']['model_ref'],
                    'output_variable': output_var,
                    'output_value': result,
                    'worker_count': len(worker_outputs),
                    'timestamp': datetime.now(timezone.utc).isoformat()
                })

                yield self._send_event(f"superstep_{step_id}_reduce_complete", {
                    "step_id": step_id,
                    "output_variable": output_var,
                    "result": result
                })

            # Save partial state after each superstep
            await self._save_partial_state(conversation, step_id)

        # Complete event
        yield self._send_event("complete", {
            "workflow_id": self.workflow['flow_id'],
            "final_variables": self.memory.to_dict()
        })

    async def _execute_map_phase(
        self,
        map_config: Dict[str, Any],
        messages: List[Dict[str, str]]
    ) -> List[Dict[str, Any]]:
        """
        Execute map phase with parallel workers.

        Args:
            map_config: Map phase configuration
            messages: Message history

        Returns:
            List of worker output dicts
        """
        from .openrouter import query_model
        import asyncio

        # Expand perspective_matrix if present
        workers = self._expand_map_phase_workers(map_config)
        concurrency_limit = map_config.get('concurrency_limit', len(workers))
        global_instruction = map_config.get('global_instruction_overlay', '')

        # Semaphore for concurrency control
        semaphore = asyncio.Semaphore(concurrency_limit)

        async def execute_worker(worker: Dict[str, Any]) -> Optional[Dict[str, Any]]:
            """Execute single worker with concurrency control."""
            async with semaphore:
                # Build worker prompt (support both 'instruction' and legacy 'role_definition')
                instruction = worker.get('instruction') or worker.get('role_definition', '')

                # Apply scope alignment if enabled
                if self.scope_alignment_enabled:
                    from .scope_alignment import apply_scope_to_instruction
                    instruction = apply_scope_to_instruction(
                        worker['worker_id'],
                        instruction,
                        self.scope_map
                    )

                if global_instruction:
                    instruction += f"\n\n{global_instruction}"

                # Build messages with instruction as system prompt
                worker_messages = [{"role": "system", "content": instruction}] + messages

                # Query model
                response = await query_model(worker['model_ref'], worker_messages)

                if response is not None:
                    return {
                        'worker_id': worker['worker_id'],
                        'model_ref': worker['model_ref'],
                        'response': response.get('content', ''),  # Changed from 'output' to match frontend
                        'role_definition': worker.get('role_definition', worker.get('instruction', '')),
                        'instruction': instruction  # Keep for backward compatibility
                    }
                return None

        # Execute all workers in parallel (with concurrency limit)
        tasks = [execute_worker(worker) for worker in workers]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out None and exceptions
        worker_outputs = []
        for result in results:
            if isinstance(result, dict):
                worker_outputs.append(result)
            elif isinstance(result, Exception):
                # Log error but continue
                logger.error(f"Worker execution error: {result}", exc_info=True)

        return worker_outputs

    def _expand_map_phase_workers(self, map_config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Expand workers from perspectives array (unified DSL).

        Model-neutral by default: Each perspective without model_ref creates N workers (one per workflow model).
        Model-specific opt-out: Perspectives with model_ref create 1 worker.

        Args:
            map_config: Map phase configuration

        Returns:
            List of worker definitions
        """
        perspectives = map_config.get('perspectives', [])
        workers = []

        for perspective in perspectives:
            perspective_id = perspective['perspective_id']
            instruction = perspective['instruction']

            if 'model_ref' in perspective:
                # Model-specific (opt-out case): Create single worker
                model_ref = perspective['model_ref']
                model_short = model_ref.split('/')[-1]
                worker_id = f"{model_short}_{perspective_id}"
                workers.append({
                    'worker_id': worker_id,
                    'model_ref': model_ref,
                    'instruction': instruction
                })
            else:
                # Model-neutral (default): Create worker for each workflow model
                for model_ref in self.workflow.get('models', []):
                    model_short = model_ref.split('/')[-1]
                    worker_id = f"{model_short}_{perspective_id}"
                    workers.append({
                        'worker_id': worker_id,
                        'model_ref': model_ref,
                        'instruction': instruction
                    })

        return workers

    async def _execute_middleware_phase(
        self,
        worker_outputs: List[Dict[str, Any]],
        middleware_config: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Execute middleware pipeline.

        Args:
            worker_outputs: Worker outputs
            middleware_config: Middleware configuration

        Returns:
            Tuple of (processed_outputs, rejected_outputs)
        """
        from .workflow_middleware import apply_middleware_pipeline

        processed, rejected = await apply_middleware_pipeline(
            worker_outputs,
            middleware_config
        )

        return processed, rejected

    async def _execute_reduce_phase(
        self,
        reduce_config: Dict[str, Any],
        worker_outputs: List[Dict[str, Any]],
        messages: List[Dict[str, str]],
        rejected_outputs: List[Dict[str, Any]]
    ) -> str:
        """
        Execute reduce phase.

        Args:
            reduce_config: Reduce phase configuration
            worker_outputs: Processed worker outputs
            messages: Message history
            rejected_outputs: Middleware-rejected outputs

        Returns:
            Synthesized result string
        """
        from .workflow_reducers import execute_reducer

        # Apply visibility controls
        visibility = reduce_config.get('visibility', {})
        filtered_outputs = self._apply_visibility_controls(
            worker_outputs,
            visibility
        )

        # Include rejected items if visibility allows
        if visibility.get('include_rejected_items', False):
            filtered_outputs.extend(rejected_outputs)

        # Apply variable interpolation to chairman_instructions if enabled
        chairman_instructions = reduce_config.get('chairman_instructions', '')
        if reduce_config.get('variable_interpolation', False):
            chairman_instructions = self._interpolate_variables(chairman_instructions)

        # Execute reducer strategy
        result = await execute_reducer(
            strategy=reduce_config['strategy'],
            worker_outputs=filtered_outputs,
            memory=self.memory,
            config={
                'model_ref': reduce_config['model_ref'],
                'chairman_instructions': chairman_instructions,
                'messages': messages,
                'visibility': visibility
            }
        )

        return result

    async def _execute_score_and_rank_superstep(
        self,
        superstep: Dict[str, Any],
        user_input: str,
        conversation: Dict[str, Any]
    ) -> AsyncGenerator[str, None]:
        """
        Execute score_and_rank superstep: anonymous peer review and ranking.

        This is a special superstep type where multiple evaluator models receive
        the full conversation history (anonymized) and rank previous outputs.
        Rankings are aggregated algorithmically (not by LLM).

        Args:
            superstep: Score and rank superstep configuration
            user_input: Original user query
            conversation: Full conversation object

        Yields:
            SSE event strings
        """
        from .openrouter import query_model
        from .ranking_utils import (
            create_anonymous_labels,
            build_ranking_prompt,
            parse_ranking_from_text,
            calculate_aggregate_rankings,
            format_leaderboard
        )
        import asyncio

        step_id = superstep['step_id']
        evaluator_models = superstep['evaluator_models']
        ranking_instructions = superstep.get('ranking_instructions', 'Rank responses by quality, accuracy, and usefulness.')
        visibility = superstep.get('visibility', {})
        ranking_algorithm = superstep.get('ranking_algorithm', 'average_position')
        output_format = superstep.get('output_format', 'leaderboard')
        output_var = superstep['output_write_to']
        require_complete = superstep.get('require_complete_rankings', False)

        # Start event
        yield self._send_event(f"superstep_{step_id}_score_and_rank_start", {
            "step_id": step_id,
            "description": superstep.get('description', ''),
            "evaluator_count": len(evaluator_models),
            "algorithm": ranking_algorithm
        })

        # 1. Collect conversation history from previous supersteps
        include_supersteps = visibility.get('include_supersteps', ['all'])
        include_original_input = visibility.get('include_original_input', True)
        mask_identities = visibility.get('mask_worker_identities', True)

        # Determine which supersteps to include
        if include_supersteps == ['all']:
            # Include all previous supersteps
            included_steps = list(self.worker_outputs_by_step.keys())
        elif include_supersteps == ['latest']:
            # Only the most recent superstep
            if self.worker_outputs_by_step:
                included_steps = [list(self.worker_outputs_by_step.keys())[-1]]
            else:
                included_steps = []
        else:
            # Specific indices
            all_steps = list(self.worker_outputs_by_step.keys())
            included_steps = [all_steps[i] for i in include_supersteps if i < len(all_steps)]

        # Collect worker outputs from included supersteps
        all_worker_outputs = []
        for step_key in included_steps:
            all_worker_outputs.extend(self.worker_outputs_by_step[step_key])

        if not all_worker_outputs:
            # No outputs to rank - skip this superstep
            yield self._send_event(f"superstep_{step_id}_score_and_rank_complete", {
                "step_id": step_id,
                "output_variable": output_var,
                "result": {"error": "No worker outputs to rank"}
            })
            self.memory.write(output_var, {"error": "No worker outputs to rank"})
            return

        # 2. Anonymize worker identities (Response A, B, C...)
        labels, label_to_worker = create_anonymous_labels(
            all_worker_outputs,
            id_field='worker_id'
        )

        # Build mapping of worker_id to model_ref for final output
        worker_to_model = {
            output['worker_id']: output.get('model_ref', output['worker_id'])
            for output in all_worker_outputs
        }

        # Create anonymized responses dict for prompt
        anonymized_responses = {}
        worker_id_to_label = {}
        for i, output in enumerate(all_worker_outputs):
            label = f"Response {labels[i]}"
            anonymized_responses[label] = output.get('response', output.get('output', ''))
            worker_id_to_label[output['worker_id']] = label

        # 3. Build evaluation prompt
        question = user_input if include_original_input else "The following responses:"
        ranking_prompt = build_ranking_prompt(
            question=question,
            responses=anonymized_responses,
            custom_instructions=ranking_instructions
        )

        # 4. Query evaluators in parallel
        async def query_evaluator(model_ref: str) -> Optional[Dict[str, Any]]:
            """Query a single evaluator model."""
            messages = [{"role": "user", "content": ranking_prompt}]
            response = await query_model(model_ref, messages)

            if response is not None:
                ranking_text = response.get('content', '')
                parsed_ranking = parse_ranking_from_text(ranking_text)

                # Validate completeness if required
                if require_complete and len(parsed_ranking) != len(labels):
                    logger.warning(f"Warning: {model_ref} provided incomplete ranking ({len(parsed_ranking)}/{len(labels)})")
                    return None

                return {
                    'evaluator_model': model_ref,
                    'ranking_text': ranking_text,
                    'parsed_ranking': parsed_ranking
                }
            return None

        # Execute all evaluators in parallel
        tasks = [query_evaluator(model) for model in evaluator_models]
        evaluator_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out None and exceptions
        valid_rankings = []
        for i, result in enumerate(evaluator_results):
            if isinstance(result, dict):
                valid_rankings.append(result)

                # Emit individual evaluator complete event
                yield self._send_event(f"superstep_{step_id}_evaluator_complete", {
                    "step_id": step_id,
                    "evaluator_model": result['evaluator_model'],
                    "ranking": result['parsed_ranking']
                })
            elif isinstance(result, Exception):
                logger.error(f"Evaluator execution error: {result}", exc_info=True)

        if not valid_rankings:
            # No valid rankings - return error
            error_result = {"error": "All evaluators failed"}
            yield self._send_event(f"superstep_{step_id}_score_and_rank_complete", {
                "step_id": step_id,
                "output_variable": output_var,
                "result": error_result
            })
            self.memory.write(output_var, error_result)
            return

        # 5. Aggregate rankings algorithmically
        aggregate_rankings = calculate_aggregate_rankings(
            evaluator_rankings=valid_rankings,
            label_to_worker=label_to_worker,
            algorithm=ranking_algorithm,
            id_field='worker_id'
        )

        # 6. Format output based on output_format
        if output_format == 'leaderboard':
            # Format as street ranking card
            result = format_leaderboard(
                aggregate_rankings=aggregate_rankings,
                model_refs=worker_to_model,
                label_to_worker=label_to_worker
            )
        elif output_format == 'full':
            # Include all data
            result = {
                "aggregate_rankings": aggregate_rankings,
                "evaluator_rankings": valid_rankings,
                "label_mapping": label_to_worker,
                "worker_to_model": worker_to_model,
                "algorithm": ranking_algorithm
            }
        elif output_format == 'rankings_only':
            # Just the sorted worker IDs
            result = [entry['worker_id'] for entry in aggregate_rankings]
        else:
            result = {"error": f"Unknown output_format: {output_format}"}

        # 7. Write to variable
        self.memory.write(output_var, result)

        # Track score_and_rank output with metadata for UI display
        from datetime import datetime, timezone
        evaluated_count = 0
        if isinstance(result, dict):
            if 'leaderboard' in result:
                evaluated_count = len(result.get('leaderboard', []))
            elif 'aggregate_rankings' in result:
                evaluated_count = len(result.get('aggregate_rankings', []))

        self.superstep_results.append({
            'step_id': step_id,
            'superstep_type': 'score_and_rank',
            'evaluator_models': superstep['evaluator_models'],
            'ranking_algorithm': ranking_algorithm,
            'output_variable': output_var,
            'output_value': result,
            'evaluated_count': evaluated_count,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })

        # Complete event
        yield self._send_event(f"superstep_{step_id}_score_and_rank_complete", {
            "step_id": step_id,
            "output_variable": output_var,
            "result": result,
            "evaluator_count": len(valid_rankings),
            "algorithm": ranking_algorithm
        })

    def _apply_visibility_controls(
        self,
        worker_outputs: List[Dict[str, Any]],
        visibility: Dict[str, bool]
    ) -> List[Dict[str, Any]]:
        """
        Apply visibility controls to worker outputs.

        Args:
            worker_outputs: Worker outputs
            visibility: Visibility configuration

        Returns:
            Filtered worker outputs
        """
        import copy
        filtered = copy.deepcopy(worker_outputs)

        if visibility.get('mask_worker_identities', False):
            # Anonymize worker identities (Response A, B, C)
            for i, output in enumerate(filtered):
                output['anonymous_label'] = f"Response {chr(65 + i)}"  # A, B, C...
                output['_original_worker_id'] = output['worker_id']
                output['worker_id'] = output['anonymous_label']

        return filtered

    def _build_message_history(
        self,
        conversation: Dict[str, Any],
        user_input: str
    ) -> List[Dict[str, str]]:
        """
        Build OpenRouter-compatible message history.

        Args:
            conversation: Conversation object
            user_input: Current user message

        Returns:
            List of message dicts
        """
        messages = []
        for msg in conversation.get("messages", []):
            if msg["role"] == "user":
                messages.append({"role": "user", "content": msg["content"]})
            elif msg["role"] == "assistant":
                # Use final variable from workflow if available
                if "variables" in msg:
                    # Get the main output variable
                    # Convention: use the last variable as the response
                    var_names = list(msg["variables"].keys())
                    if var_names:
                        last_var = var_names[-1]
                        content = msg["variables"][last_var]
                        messages.append({
                            "role": "assistant",
                            "content": str(content)
                        })
                elif "stage3" in msg:
                    # Backward compatibility with legacy format
                    messages.append({
                        "role": "assistant",
                        "content": msg["stage3"]["response"]
                    })

        # Add current user input
        messages.append({"role": "user", "content": user_input})
        return messages

    def _apply_interpolation_to_map_phase(self, map_phase: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply variable interpolation to map phase configuration.

        Args:
            map_phase: Map phase configuration

        Returns:
            Map phase with interpolated values
        """
        import copy
        interpolated = copy.deepcopy(map_phase)

        # Interpolate global_instruction_overlay
        if 'global_instruction_overlay' in interpolated:
            interpolated['global_instruction_overlay'] = self._interpolate_variables(
                interpolated['global_instruction_overlay']
            )

        # Interpolate worker instruction/role_definition
        for worker in interpolated.get('workers', []):
            if 'instruction' in worker:
                worker['instruction'] = self._interpolate_variables(worker['instruction'])
            elif 'role_definition' in worker:
                worker['role_definition'] = self._interpolate_variables(worker['role_definition'])

        # Interpolate perspective_matrix instructions
        if 'perspective_matrix' in interpolated:
            for perspective in interpolated['perspective_matrix'].get('perspectives', []):
                if 'instruction' in perspective:
                    perspective['instruction'] = self._interpolate_variables(perspective['instruction'])

        return interpolated

    def _interpolate_variables(self, text: str) -> str:
        """
        Interpolate ${variable_name} patterns with memory values.

        Args:
            text: Text with ${var} patterns

        Returns:
            Text with variables replaced
        """
        import re

        def replace_var(match):
            var_name = match.group(1)
            try:
                value = self.memory.read(var_name)
                # Convert to string representation
                if isinstance(value, (dict, list)):
                    return json.dumps(value, indent=2)
                return str(value)
            except ValueError:
                # Variable not found, leave placeholder
                return match.group(0)

        return re.sub(r'\$\{(\w+)\}', replace_var, text)

    async def _run_scope_alignment_if_enabled(self, user_input: str) -> None:
        """
        Run scope alignment if enabled in workflow config.

        This is a silent pre-execution phase that refines worker role definitions
        to prevent role drift, overlaps, and gaps.

        Args:
            user_input: User's task description (used as TaskSpec)
        """
        scope_config = self.workflow.get('scope_alignment', {})

        if not scope_config.get('enabled', False):
            return

        try:
            from .scope_alignment import execute_scope_alignment

            # Run scope alignment
            self.scope_map = await execute_scope_alignment(
                workflow_def=self.workflow,
                task_spec=user_input,
                config=scope_config
            )

            # Mark as enabled if we got scopes back
            if self.scope_map:
                self.scope_alignment_enabled = True
        except Exception as e:
            # Silent failure - fall back to original instructions
            logger.warning(f"Scope alignment failed: {e}", exc_info=True)
            self.scope_map = {}
            self.scope_alignment_enabled = False

    def _send_event(self, event_type: str, data: Any) -> str:
        """
        Format SSE event.

        Args:
            event_type: Event type string
            data: Event data dict

        Returns:
            Formatted SSE event string
        """
        event_data = {"type": event_type, **data}
        return f"data: {json.dumps(event_data)}\n\n"

    async def _save_partial_state(
        self,
        conversation: Dict[str, Any],
        step_id: str
    ) -> None:
        """
        Save partial workflow state to conversation.

        Args:
            conversation: Conversation object
            step_id: Current step ID
        """
        import backend.storage.conversations as storage

        # Get conversation details
        conversation_id = conversation['id']
        profile_id = conversation.get('profile_id', 'default')

        # Prepare workflow metadata
        total_steps = len(self.workflow['supersteps'])
        completed_steps = [s['step_id'] for s in self.workflow['supersteps']].index(step_id) + 1

        metadata = {
            'workflow_id': self.workflow['flow_id'],
            'current_step': step_id,
            'completed_steps': completed_steps,
            'total_steps': total_steps,
            'execution_mode': 'workflow'
        }

        # Save current variable state to assistant message
        # Use "variables" as the field name for workflow execution
        storage.save_partial_assistant_message(
            conversation_id=conversation_id,
            stage_name="variables",
            stage_data=self.memory.to_dict(),
            metadata=metadata,
            profile_id=profile_id
        )

        # Also save worker outputs for display in UI
        storage.save_partial_assistant_message(
            conversation_id=conversation_id,
            stage_name="worker_outputs",
            stage_data=self.worker_outputs_by_step,
            metadata=None,  # Already saved above
            profile_id=profile_id
        )

        # Save superstep results (reducer outputs with metadata)
        storage.save_partial_assistant_message(
            conversation_id=conversation_id,
            stage_name="superstep_results",
            stage_data=self.superstep_results,
            metadata=None,  # Already saved above
            profile_id=profile_id
        )


async def execute_workflow_stream(
    workflow_def: Dict[str, Any],
    conversation: Dict[str, Any],
    user_input: str
) -> AsyncGenerator[str, None]:
    """
    Main entry point for workflow execution.

    Args:
        workflow_def: Complete workflow JSON definition
        conversation: Full conversation object with history
        user_input: Current user message

    Yields:
        SSE event strings
    """
    executor = WorkflowExecutor(workflow_def)
    async for event in executor.execute_stream(conversation, user_input):
        yield event
