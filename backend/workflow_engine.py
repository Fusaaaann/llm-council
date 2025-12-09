"""Core workflow execution engine following BSP architecture."""

import json
from typing import Dict, Any, List, Optional, AsyncGenerator, Tuple


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
        Write variable value with type checking.

        Args:
            var_name: Variable name
            value: Value to write

        Raises:
            ValueError: If variable not defined or type mismatch
        """
        if var_name not in self.variables:
            raise ValueError(f"Variable '{var_name}' not defined")

        # Validate type matches definition
        expected_type = self.types[var_name]
        self._validate_type(value, expected_type)

        self.variables[var_name] = value

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

        # Stream init event
        yield self._send_event("stream_init", {
            "workflow_id": self.workflow['flow_id'],
            "superstep_count": len(self.workflow['supersteps'])
        })

        # Execute each superstep
        for superstep in self.workflow['supersteps']:
            step_id = superstep['step_id']

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
                print(f"Worker execution error: {result}")

        return worker_outputs

    def _expand_map_phase_workers(self, map_config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Expand workers from either explicit workers list or perspective_matrix.

        Args:
            map_config: Map phase configuration

        Returns:
            List of worker definitions
        """
        # Explicit workers list
        if 'workers' in map_config:
            return map_config['workers']

        # Perspective matrix - generate cartesian product
        if 'perspective_matrix' in map_config:
            matrix = map_config['perspective_matrix']
            perspectives = matrix['perspectives']

            # Determine which models to use
            models = self._select_models(matrix)

            workers = []
            for model_ref in models:
                # Extract short model name for worker_id (e.g., 'openai/gpt-4' -> 'gpt-4')
                model_short = model_ref.split('/')[-1]

                for perspective in perspectives:
                    worker_id = f"{model_short}_{perspective['perspective_id']}"
                    workers.append({
                        'worker_id': worker_id,
                        'model_ref': model_ref,
                        'instruction': perspective['instruction']
                    })

            return workers

        # Fallback (should not happen if schema validation works)
        return []

    def _select_models(self, matrix_config: Dict[str, Any]) -> List[str]:
        """
        Select models for perspective_matrix based on filtering rules.

        Args:
            matrix_config: perspective_matrix configuration

        Returns:
            List of model references to use
        """
        # Legacy: explicit models in perspective_matrix (backwards compat)
        if 'models' in matrix_config:
            return matrix_config['models']

        # Use global models with filtering
        use_models = matrix_config.get('use_models', 'all')

        if use_models == 'all':
            return self.global_models

        models_filter = matrix_config.get('models_filter', [])

        if use_models == 'whitelist':
            # Only use models in the filter
            return [m for m in self.global_models if m in models_filter]

        if use_models == 'blacklist':
            # Use all models except those in the filter
            return [m for m in self.global_models if m not in models_filter]

        # Fallback to all models
        return self.global_models

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
