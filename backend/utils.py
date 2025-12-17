"""Utility functions for the backend."""

import json
import re
from typing import Dict, Any, Tuple
from html import escape


def detect_execution_mode(message: Dict[str, Any]) -> str:
    """
    Detect execution mode of an assistant message.

    Args:
        message: Assistant message dict

    Returns:
        'workflow', 'council', or 'unknown'
    """
    if message.get('variables') is not None:
        return 'workflow'
    if message.get('stage3') is not None or message.get('stage1') is not None:
        return 'council'
    return 'unknown'


def sanitize_filename(title: str) -> str:
    """Convert a conversation title to a safe filename."""
    # Remove or replace invalid filename characters
    safe = re.sub(r'[<>:"/\\|?*]', '', title)
    # Replace spaces with underscores
    safe = safe.replace(' ', '_')
    # Limit length
    safe = safe[:100]
    # Remove leading/trailing whitespace and dots
    safe = safe.strip('. ')
    # Fallback if empty
    return safe if safe else 'conversation'


def _render_council_markdown(msg: Dict[str, Any]) -> str:
    """Render council execution results as markdown."""
    md = ""

    # Stage 1
    if msg.get('stage1'):
        md += "### Stage 1: Individual Responses\n\n"
        for resp in msg['stage1']:
            md += f"**{resp['model']}:**\n\n{resp['response']}\n\n"

    # Stage 1.5
    if msg.get('stage1_5'):
        md += "### Stage 1.5: Cross-Interrogation\n\n"

        # Questions
        if msg['stage1_5'].get('questions'):
            md += "**Questions:**\n\n"
            for q in msg['stage1_5']['questions']:
                model = q.get('model', 'Unknown')
                questions_text = q.get('questions', '')
                md += f"**{model}:**\n\n{questions_text}\n\n"

        # Answers
        if msg['stage1_5'].get('answers'):
            md += "**Answers:**\n\n"
            for a in msg['stage1_5']['answers']:
                model = a.get('model', 'Unknown')
                answers_text = a.get('answers', '')
                md += f"**{model}:**\n\n{answers_text}\n\n"

    # Stage 2
    if msg.get('stage2'):
        md += "### Stage 2: Peer Rankings\n\n"
        for ranking in msg['stage2']:
            md += f"**{ranking['model']}:**\n\n{ranking['ranking']}\n\n"

        # Aggregate rankings
        if msg.get('metadata', {}).get('aggregate_rankings'):
            md += "**Aggregate Rankings:**\n\n"
            # Sort by average rank (lower is better)
            sorted_rankings = sorted(msg['metadata']['aggregate_rankings'], key=lambda x: x['average_rank'])
            for i, rank in enumerate(sorted_rankings, 1):
                md += f"{i}. {rank['model']} (avg rank: {rank['average_rank']:.2f}, votes: {rank['rankings_count']})\n"
            md += "\n"

    # Stage 3
    if msg.get('stage3'):
        md += "### Stage 3: Final Synthesis\n\n"
        md += f"{msg['stage3']['response']}\n\n"

    return md


def _render_workflow_markdown(msg: Dict[str, Any]) -> str:
    """Render workflow execution results as markdown."""
    md = ""

    # Get metadata
    metadata = msg.get('metadata', {})
    workflow_id = metadata.get('workflow_id', 'Unknown Workflow')
    completed_steps = metadata.get('completed_steps', 0)
    total_steps = metadata.get('total_steps', 0)

    # Header with workflow info
    md += f"**Workflow**: {workflow_id}\n"
    if total_steps > 0:
        md += f"**Progress**: Completed {completed_steps}/{total_steps} steps\n\n"
    else:
        md += "\n"

    # Get variables
    variables = msg.get('variables', {})

    if variables:
        # Final output (last variable by convention)
        var_names = list(variables.keys())
        if var_names:
            final_var_name = var_names[-1]
            final_value = variables[final_var_name]

            # Convert to string if needed
            if isinstance(final_value, str):
                final_output = final_value
            else:
                final_output = json.dumps(final_value, indent=2)

            md += "### ✨ Final Output\n\n"
            md += f"{final_output}\n\n"

        # All variables section
        if len(variables) > 0:
            md += "### 📊 All Variables\n\n"
            for i, (var_name, var_value) in enumerate(variables.items()):
                # Convert to string if needed
                if isinstance(var_value, str):
                    value_str = var_value
                else:
                    value_str = json.dumps(var_value, indent=2)

                # Mark final output
                if i == len(variables) - 1:
                    md += f"**Variable: {var_name}** (Final Output)\n\n{value_str}\n\n"
                else:
                    md += f"**Variable: {var_name}**\n\n{value_str}\n\n"
    else:
        md += "No variables generated.\n\n"

    # Worker perspectives
    worker_outputs = msg.get('worker_outputs', {})
    if worker_outputs:
        md += "### 👥 Worker Perspectives\n\n"

        for step_id, workers in worker_outputs.items():
            worker_count = len(workers) if isinstance(workers, list) else 0
            md += f"**Step: {step_id}** ({worker_count} worker{'s' if worker_count != 1 else ''})\n\n"

            if isinstance(workers, list):
                for worker in workers:
                    worker_id = worker.get('worker_id', 'Unknown')
                    model_ref = worker.get('model_ref', 'Unknown')
                    response = worker.get('response', '')

                    md += f"- **{worker_id}** ({model_ref})\n\n"
                    md += f"  {response}\n\n"

            md += "\n"

    return md


def conversation_to_markdown(conversation: Dict[str, Any]) -> Tuple[str, str]:
    """Convert a conversation to markdown format.

    Supports both council and workflow execution modes.

    Returns:
        Tuple of (markdown_content, filename)
    """
    md = f"# {conversation['title']}\n\n"
    md += f"*Created: {conversation['created_at']}*\n\n"
    md += "---\n\n"

    for msg in conversation['messages']:
        if msg['role'] == 'user':
            md += f"## 👤 You\n\n{msg['content']}\n\n"
        else:
            # Detect execution mode
            mode = detect_execution_mode(msg)

            if mode == 'workflow':
                md += "## 🤖 Workflow Execution\n\n"
                md += _render_workflow_markdown(msg)
            elif mode == 'council':
                md += "## 🤖 LLM Council\n\n"
                md += _render_council_markdown(msg)
            # Unknown mode: skip silently

        md += "---\n\n"

    filename = sanitize_filename(conversation['title']) + '.md'
    return md, filename


def _render_council_html(msg: Dict[str, Any], msg_counter: int) -> str:
    """Render council execution results as HTML."""
    html = ""

    # Stage 1 - Individual Responses (with tabs)
    if msg.get('stage1'):
        stage1_id = f"stage1_{msg_counter}"
        responses = msg['stage1']

        html += f"""
            <div class="stage">
                <h3 class="stage-title">Stage 1: Individual Responses</h3>
                <div class="tabs">
"""
        for i, resp in enumerate(responses):
            model_short = resp['model'].split('/')[-1] if '/' in resp['model'] else resp['model']
            active_class = 'active' if i == 0 else ''
            html += f"""
                    <button class="tab {active_class}" onclick="switchTab('{stage1_id}', {i})">{escape(model_short)}</button>
"""

        html += """
                </div>
                <div class="tab-content">
"""

        for i, resp in enumerate(responses):
            active_class = 'active' if i == 0 else ''
            html += f"""
                    <div class="tab-panel {active_class}" data-tab-group="{stage1_id}" data-tab-index="{i}">
                        <div class="model-name">{escape(resp['model'])}</div>
                        <div class="response-text">{escape(resp['response'])}</div>
                    </div>
"""

        html += """
                </div>
            </div>
"""

    # Stage 1.5 - Cross-Interrogation (with tabs and collapsible sections)
    if msg.get('stage1_5') and msg['stage1_5'].get('answers'):
        stage15_id = f"stage15_{msg_counter}"
        answers = msg['stage1_5']['answers']

        html += f"""
            <div class="stage stage1-5">
                <h3 class="stage-title">Stage 1.5: Cross-Interrogation</h3>
                <p class="stage-description">
                    Models question each other's responses to uncover deeper insights and unmentioned aspects.
                </p>
                <div class="tabs">
"""
        for i, answer in enumerate(answers):
            model_short = answer['model'].split('/')[-1] if '/' in answer['model'] else answer['model']
            active_class = 'active' if i == 0 else ''
            html += f"""
                    <button class="tab {active_class}" onclick="switchTab('{stage15_id}', {i})">{escape(model_short)}</button>
"""

        html += """
                </div>
                <div class="tab-content">
"""

        for i, answer in enumerate(answers):
            active_class = 'active' if i == 0 else ''
            questions_section_id = f"{stage15_id}_q{i}"
            answers_section_id = f"{stage15_id}_a{i}"
            original_section_id = f"{stage15_id}_o{i}"

            questions = answer.get('questions', [])
            questions_count = len(questions)

            html += f"""
                    <div class="tab-panel {active_class}" data-tab-group="{stage15_id}" data-tab-index="{i}">
                        <div class="model-name">{escape(answer['model'])}</div>

                        <!-- Questions Received -->
                        <div class="section">
                            <button class="section-header" onclick="toggleSection('{questions_section_id}')">
                                <span class="section-title">📝 Questions Received ({questions_count})</span>
                                <span class="toggle-icon" id="{questions_section_id}_icon">▼</span>
                            </button>
                            <div class="section-content expanded" id="{questions_section_id}">
"""

            if questions:
                html += """
                                <div class="questions-list">
"""
                for q in questions:
                    from_model_short = q['from_model'].split('/')[-1] if '/' in q['from_model'] else q['from_model']
                    html += f"""
                                    <div class="question-item">
                                        <div class="question-meta">From: <strong>{escape(from_model_short)}</strong></div>
                                        <div class="question-text">{escape(q['question'])}</div>
                                    </div>
"""
                html += """
                                </div>
"""
            else:
                html += """
                                <div class="no-content">No questions were asked about this response.</div>
"""

            html += """
                            </div>
                        </div>

                        <!-- Answers Provided -->
                        <div class="section">
                            <button class="section-header" onclick="toggleSection('{0}')">
                                <span class="section-title">💬 Answers Provided</span>
                                <span class="toggle-icon" id="{0}_icon">▼</span>
                            </button>
                            <div class="section-content expanded" id="{0}">
""".format(answers_section_id)

            if answer.get('answers'):
                html += f"""
                                <div class="response-text">{escape(answer['answers'])}</div>
"""
            else:
                html += """
                                <div class="no-content">No answers provided.</div>
"""

            html += """
                            </div>
                        </div>

                        <!-- Original Response -->
                        <div class="section">
                            <button class="section-header" onclick="toggleSection('{0}')">
                                <span class="section-title">📄 Original Response (Reference)</span>
                                <span class="toggle-icon" id="{0}_icon">▶</span>
                            </button>
                            <div class="section-content" id="{0}">
                                <div class="response-text">{1}</div>
                            </div>
                        </div>
                    </div>
""".format(original_section_id, escape(answer.get('original_response', '')))

        html += """
                </div>
            </div>
"""

    # Stage 2 - Peer Rankings (with tabs and aggregate)
    if msg.get('stage2'):
        stage2_id = f"stage2_{msg_counter}"
        rankings = msg['stage2']
        label_to_model = msg.get('metadata', {}).get('label_to_model', {})

        html += f"""
            <div class="stage">
                <h3 class="stage-title">Stage 2: Peer Rankings</h3>
                <h4 style="margin: 20px 0 8px 0; color: #333; font-size: 14px; font-weight: 600;">Raw Evaluations</h4>
                <p class="stage-description">
                    Each model evaluated all responses (anonymized as Response A, B, C, etc.) and provided rankings.
                    Below, model names are shown in <strong>bold</strong> for readability, but the original evaluation used anonymous labels.
                </p>
                <div class="tabs">
"""
        for i, rank in enumerate(rankings):
            model_short = rank['model'].split('/')[-1] if '/' in rank['model'] else rank['model']
            active_class = 'active' if i == 0 else ''
            html += f"""
                    <button class="tab {active_class}" onclick="switchTab('{stage2_id}', {i})">{escape(model_short)}</button>
"""

        html += """
                </div>
                <div class="tab-content">
"""

        for i, rank in enumerate(rankings):
            active_class = 'active' if i == 0 else ''

            # De-anonymize ranking text
            ranking_text = rank['ranking']
            for label, model in label_to_model.items():
                model_short = model.split('/')[-1] if '/' in model else model
                ranking_text = ranking_text.replace(label, f"**{model_short}**")

            html += f"""
                    <div class="tab-panel {active_class}" data-tab-group="{stage2_id}" data-tab-index="{i}">
                        <div class="model-name">{escape(rank['model'])}</div>
                        <div class="response-text">{escape(ranking_text)}</div>
"""

            # Show parsed ranking if available
            if rank.get('parsed_ranking'):
                html += """
                        <div class="parsed-ranking">
                            <strong>Extracted Ranking:</strong>
                            <ol>
"""
                for label in rank['parsed_ranking']:
                    if label in label_to_model:
                        model = label_to_model[label]
                        model_short = model.split('/')[-1] if '/' in model else model
                        html += f"""
                                <li>{escape(model_short)}</li>
"""
                    else:
                        html += f"""
                                <li>{escape(label)}</li>
"""
                html += """
                            </ol>
                        </div>
"""

            html += """
                    </div>
"""

        html += """
                </div>
"""

        # Aggregate rankings
        if msg.get('metadata', {}).get('aggregate_rankings'):
            sorted_rankings = sorted(msg['metadata']['aggregate_rankings'], key=lambda x: x['average_rank'])
            html += """
                <div class="aggregate-rankings">
                    <h4>Aggregate Rankings (Street Cred)</h4>
                    <p class="stage-description">
                        Combined results across all peer evaluations (lower score is better):
                    </p>
                    <div class="aggregate-list">
"""
            for idx, agg in enumerate(sorted_rankings):
                model_short = agg['model'].split('/')[-1] if '/' in agg['model'] else agg['model']
                html += f"""
                        <div class="aggregate-item">
                            <span class="rank-position">#{idx + 1}</span>
                            <span class="rank-model">{escape(model_short)}</span>
                            <span class="rank-score">Avg: {agg['average_rank']:.2f}</span>
                            <span class="rank-count">({agg['rankings_count']} votes)</span>
                        </div>
"""
            html += """
                    </div>
                </div>
"""

        html += """
            </div>
"""

    # Stage 3 - Final Synthesis
    if msg.get('stage3'):
        chairman_model = msg['stage3']['model']
        chairman_short = chairman_model.split('/')[-1] if '/' in chairman_model else chairman_model

        html += f"""
            <div class="stage stage3">
                <h3 class="stage-title">Stage 3: Final Council Answer</h3>
                <div class="final-response">
                    <div class="chairman-label">Chairman: {escape(chairman_short)}</div>
                    <div class="final-text response-text">{escape(msg['stage3']['response'])}</div>
                </div>
            </div>
"""

    return html


def _render_workflow_html(msg: Dict[str, Any], msg_counter: int) -> str:
    """Render workflow execution results as HTML."""
    html = ""

    # Get metadata
    metadata = msg.get('metadata', {})
    workflow_id = metadata.get('workflow_id', 'Unknown Workflow')
    completed_steps = metadata.get('completed_steps', 0)
    total_steps = metadata.get('total_steps', 0)

    # Mode badge and workflow info
    html += f"""
            <div class="execution-mode-label">
                <span class="mode-badge workflow">⚙️ Workflow</span>
                <span class="workflow-name">{escape(workflow_id)}</span>
            </div>
"""

    # Progress bar
    if total_steps > 0:
        progress_percent = (completed_steps / total_steps) * 100
        html += f"""
            <div class="workflow-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {progress_percent}%;"></div>
                </div>
                <div class="progress-text">Step {completed_steps} of {total_steps}</div>
            </div>
"""

    # Get variables
    variables = msg.get('variables', {})

    if variables:
        # Final output (last variable by convention)
        var_names = list(variables.keys())
        if var_names:
            final_var_name = var_names[-1]
            final_value = variables[final_var_name]

            # Convert to string if needed
            if isinstance(final_value, str):
                final_output = final_value
            else:
                final_output = json.dumps(final_value, indent=2)

            html += f"""
            <div class="workflow-final-output">
                <h3 class="output-title">Final Output</h3>
                <div class="output-content">{escape(final_output)}</div>
            </div>
"""

    # Worker perspectives
    worker_outputs = msg.get('worker_outputs', {})
    if worker_outputs:
        html += """
            <div class="worker-perspectives">
                <div class="perspectives-header">
                    <h3>👥 Worker Perspectives</h3>
                </div>
"""

        for step_idx, (step_id, workers) in enumerate(worker_outputs.items()):
            worker_count = len(workers) if isinstance(workers, list) else 0
            step_content_id = f"step{msg_counter}_{step_idx}"

            html += f"""
                <div class="superstep-section">
                    <button class="superstep-header" onclick="toggleSuperstep('{step_content_id}')">
                        <span class="superstep-title">Step: {escape(step_id)} ({worker_count} worker{'s' if worker_count != 1 else ''})</span>
                        <span class="toggle-icon" id="{step_content_id}_icon">▶</span>
                    </button>
                    <div class="superstep-content" id="{step_content_id}" style="display: none;">
"""

            if isinstance(workers, list) and len(workers) > 0:
                # Worker tabs
                html += """
                        <div class="worker-tabs">
"""
                for worker_idx, worker in enumerate(workers):
                    worker_id = worker.get('worker_id', f'Worker {worker_idx+1}')
                    # Extract short name
                    if '/' in worker_id or '_' in worker_id:
                        worker_short = worker_id.split('/')[-1].split('_')[-1]
                    else:
                        worker_short = worker_id
                    active_class = 'active' if worker_idx == 0 else ''
                    html += f"""
                            <button class="worker-tab {active_class}" onclick="switchWorker('{step_content_id}', {worker_idx})">{escape(worker_short)}</button>
"""
                html += """
                        </div>
                        <div class="worker-content">
"""

                # Worker panels
                for worker_idx, worker in enumerate(workers):
                    worker_id = worker.get('worker_id', 'Unknown')
                    model_ref = worker.get('model_ref', 'Unknown')
                    response = worker.get('response', '')
                    active_class = 'active' if worker_idx == 0 else ''

                    html += f"""
                            <div class="worker-panel {active_class}" data-step="{step_content_id}" data-index="{worker_idx}">
                                <div class="worker-model-name">{escape(model_ref)}</div>
                                <div class="worker-response">{escape(response)}</div>
                            </div>
"""

                html += """
                        </div>
"""

            html += """
                    </div>
                </div>
"""

        html += """
            </div>
"""

    # All variables section (collapsible)
    if variables:
        html += f"""
            <div class="workflow-variables">
                <button class="variables-header" onclick="toggleVariables('msg{msg_counter}')">
                    <span class="section-title">📊 View All Variables ({len(variables)})</span>
                    <span class="toggle-icon" id="msg{msg_counter}_vars_icon">▶</span>
                </button>
                <div class="variables-content" id="msg{msg_counter}_vars" style="display: none;">
"""

        for i, (var_name, var_value) in enumerate(variables.items()):
            # Convert to string if needed
            if isinstance(var_value, str):
                value_str = var_value
            else:
                value_str = json.dumps(var_value, indent=2)

            # Mark final output
            is_final = (i == len(variables) - 1)
            final_class = 'final' if is_final else ''

            html += f"""
                    <div class="variable-item {final_class}">
                        <div class="variable-name">
                            {escape(var_name)}
"""
            if is_final:
                html += """
                            <span class="final-badge">Final Output</span>
"""
            html += f"""
                        </div>
                        <div class="variable-value">{escape(value_str)}</div>
                    </div>
"""

        html += """
                </div>
            </div>
"""

    return html


def conversation_to_html(conversation: Dict[str, Any]) -> Tuple[str, str]:
    """Convert a conversation to HTML format with interactive tabbed UI matching the chat interface.

    Returns:
        Tuple of (html_content, filename)
    """

    # Generate unique IDs for messages to avoid conflicts
    msg_counter = 0

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{escape(conversation['title'])}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }}

        .container {{
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}

        h1 {{
            color: #2c3e50;
            border-bottom: 3px solid #4a90e2;
            padding-bottom: 10px;
            margin-bottom: 10px;
        }}

        .meta {{
            color: #666;
            font-style: italic;
            margin-bottom: 30px;
            font-size: 14px;
        }}

        .message {{
            margin: 30px 0;
            padding: 20px;
            border-radius: 8px;
        }}

        .user-message {{
            background-color: #e3f2fd;
            border-left: 4px solid #2196f3;
        }}

        .assistant-message {{
            background-color: #f5f5f5;
            border-left: 4px solid #4caf50;
        }}

        .message-header {{
            font-weight: bold;
            font-size: 1.2em;
            margin-bottom: 15px;
        }}

        .response-text {{
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 1.7;
        }}

        /* Stage styling */
        .stage {{
            margin: 24px 0;
            padding: 20px;
            background: #fafafa;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
        }}

        .stage1-5 {{
            background: #fef9f5;
            border-color: #e8d5c4;
        }}

        .stage3 {{
            background: #f0fff0;
            border-color: #c8e6c8;
        }}

        .stage-title {{
            margin: 0 0 16px 0;
            color: #333;
            font-size: 16px;
            font-weight: 600;
        }}

        .stage-description {{
            margin: 0 0 16px 0;
            color: #666;
            font-size: 13px;
            font-style: italic;
            line-height: 1.5;
        }}

        /* Tab navigation */
        .tabs {{
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
            flex-wrap: wrap;
        }}

        .tab {{
            padding: 8px 16px;
            background: #ffffff;
            border: 1px solid #d0d0d0;
            border-radius: 6px 6px 0 0;
            color: #666;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }}

        .tab:hover {{
            background: #f0f0f0;
            color: #333;
            border-color: #4a90e2;
        }}

        .tab.active {{
            background: #ffffff;
            color: #4a90e2;
            border-color: #4a90e2;
            border-bottom-color: #ffffff;
            font-weight: 600;
        }}

        .tab-content {{
            background: #ffffff;
            padding: 16px;
            border-radius: 6px;
            border: 1px solid #e0e0e0;
        }}

        .tab-panel {{
            display: none;
        }}

        .tab-panel.active {{
            display: block;
        }}

        .model-name {{
            color: #888;
            font-size: 12px;
            margin-bottom: 12px;
            font-family: monospace;
        }}

        /* Stage 1.5 collapsible sections */
        .section {{
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            overflow: hidden;
            margin-bottom: 16px;
        }}

        .section-header {{
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: #f9f9f9;
            border: none;
            cursor: pointer;
            text-align: left;
            transition: background 0.2s;
            font-family: inherit;
        }}

        .section-header:hover {{
            background: #f0f0f0;
        }}

        .section-title {{
            font-weight: 600;
            font-size: 14px;
            color: #333;
        }}

        .toggle-icon {{
            color: #888;
            font-size: 12px;
        }}

        .section-content {{
            padding: 16px;
            background: #ffffff;
            display: none;
        }}

        .section-content.expanded {{
            display: block;
        }}

        .questions-list {{
            display: flex;
            flex-direction: column;
            gap: 12px;
        }}

        .question-item {{
            padding: 12px;
            background: #f8f8f8;
            border-left: 3px solid #4a90e2;
            border-radius: 4px;
        }}

        .question-meta {{
            font-size: 12px;
            color: #666;
            margin-bottom: 6px;
        }}

        .question-text {{
            font-size: 14px;
            color: #333;
            line-height: 1.5;
        }}

        .no-content {{
            color: #999;
            font-style: italic;
            font-size: 14px;
        }}

        /* Stage 2 aggregate rankings */
        .aggregate-rankings {{
            background: #f0f7ff;
            padding: 16px;
            border-radius: 8px;
            margin: 20px 0;
            border: 2px solid #d0e7ff;
        }}

        .aggregate-rankings h4 {{
            margin: 0 0 12px 0;
            color: #2a7ae2;
            font-size: 15px;
        }}

        .aggregate-list {{
            display: flex;
            flex-direction: column;
            gap: 8px;
        }}

        .aggregate-item {{
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px;
            background: #ffffff;
            border-radius: 6px;
            border: 1px solid #d0e7ff;
        }}

        .rank-position {{
            color: #2a7ae2;
            font-weight: 700;
            font-size: 16px;
            min-width: 35px;
        }}

        .rank-model {{
            flex: 1;
            color: #333;
            font-family: monospace;
            font-size: 14px;
            font-weight: 500;
        }}

        .rank-score {{
            color: #666;
            font-size: 13px;
            font-family: monospace;
        }}

        .rank-count {{
            color: #999;
            font-size: 12px;
        }}

        .parsed-ranking {{
            margin-top: 16px;
            padding-top: 16px;
            border-top: 2px solid #e0e0e0;
        }}

        .parsed-ranking strong {{
            color: #2a7ae2;
            font-size: 13px;
        }}

        .parsed-ranking ol {{
            margin: 8px 0 0 0;
            padding-left: 24px;
            color: #333;
        }}

        .parsed-ranking li {{
            margin: 4px 0;
            font-family: monospace;
            font-size: 13px;
        }}

        /* Stage 3 final response */
        .final-response {{
            background: #ffffff;
            padding: 20px;
            border-radius: 6px;
            border: 1px solid #c8e6c8;
        }}

        .chairman-label {{
            color: #2d8a2d;
            font-size: 12px;
            font-family: monospace;
            margin-bottom: 12px;
            font-weight: 600;
        }}

        .final-text {{
            color: #333;
            line-height: 1.7;
            font-size: 15px;
        }}

        .divider {{
            border: 0;
            height: 2px;
            background: linear-gradient(to right, transparent, #e0e0e0, transparent);
            margin: 40px 0;
        }}

        /* ===== WORKFLOW MODE STYLES ===== */

        .workflow-message {{
            background-color: #f5f9ff;
        }}

        .execution-mode-label {{
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
        }}

        .mode-badge {{
            display: inline-block;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 600;
        }}

        .mode-badge.workflow {{
            background: #e3f2fd;
            color: #1565c0;
            border: 1px solid #90caf9;
        }}

        .workflow-name {{
            color: #666;
            font-size: 13px;
            font-family: monospace;
        }}

        /* Progress bar */
        .workflow-progress {{
            margin-bottom: 20px;
        }}

        .progress-bar {{
            width: 100%;
            height: 8px;
            background: #e3f2fd;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 8px;
        }}

        .progress-fill {{
            height: 100%;
            background: linear-gradient(90deg, #1976d2, #42a5f5);
        }}

        .progress-text {{
            font-size: 12px;
            color: #666;
            text-align: center;
        }}

        /* Final output */
        .workflow-final-output {{
            background: #ffffff;
            padding: 20px;
            border-radius: 6px;
            border: 2px solid #1976d2;
            margin-bottom: 20px;
        }}

        .output-title {{
            color: #1565c0;
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 16px 0;
        }}

        .output-content {{
            color: #333;
            line-height: 1.7;
            font-size: 15px;
            white-space: pre-wrap;
            word-wrap: break-word;
        }}

        /* Worker perspectives */
        .worker-perspectives {{
            background: #ffffff;
            border-radius: 6px;
            border: 1px solid #90caf9;
            margin-bottom: 20px;
            overflow: hidden;
        }}

        .perspectives-header {{
            padding: 14px 18px;
            background: #e3f2fd;
            border-bottom: 1px solid #90caf9;
        }}

        .perspectives-header h3 {{
            margin: 0;
            color: #1565c0;
            font-size: 16px;
        }}

        .superstep-section {{
            border-bottom: 1px solid #e0e0e0;
        }}

        .superstep-section:last-child {{
            border-bottom: none;
        }}

        .superstep-header {{
            width: 100%;
            padding: 12px 18px;
            background: #f5f9ff;
            border: none;
            display: flex;
            justify-content: space-between;
            cursor: pointer;
            font-family: inherit;
        }}

        .superstep-header:hover {{
            background: #e3f2fd;
        }}

        .superstep-title {{
            font-weight: 600;
            font-size: 14px;
            color: #333;
        }}

        .superstep-content {{
            padding: 16px;
            background: #ffffff;
        }}

        .worker-tabs {{
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
            flex-wrap: wrap;
        }}

        .worker-tab {{
            padding: 8px 16px;
            background: #f5f5f5;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-family: inherit;
        }}

        .worker-tab:hover {{
            background: #e3f2fd;
        }}

        .worker-tab.active {{
            background: #1976d2;
            color: white;
            border-color: #1976d2;
        }}

        .worker-panel {{
            display: none;
        }}

        .worker-panel.active {{
            display: block;
        }}

        .worker-model-name {{
            font-family: monospace;
            font-size: 12px;
            color: #1976d2;
            margin-bottom: 8px;
        }}

        .worker-response {{
            color: #333;
            line-height: 1.6;
            white-space: pre-wrap;
            word-wrap: break-word;
        }}

        /* Variables section */
        .workflow-variables {{
            background: #ffffff;
            border-radius: 6px;
            border: 1px solid #90caf9;
            overflow: hidden;
        }}

        .variables-header {{
            width: 100%;
            padding: 14px 18px;
            background: #e3f2fd;
            border: none;
            display: flex;
            justify-content: space-between;
            cursor: pointer;
            font-family: inherit;
        }}

        .variables-header:hover {{
            background: #bbdefb;
        }}

        .variables-content {{
            padding: 16px;
        }}

        .variable-item {{
            padding: 16px;
            margin-bottom: 12px;
            background: #f5f5f5;
            border-radius: 6px;
        }}

        .variable-item:last-child {{
            margin-bottom: 0;
        }}

        .variable-item.final {{
            background: #e8f5e9;
            border: 1px solid #a5d6a7;
        }}

        .variable-name {{
            font-family: monospace;
            font-size: 13px;
            font-weight: 600;
            color: #1976d2;
            margin-bottom: 10px;
        }}

        .final-badge {{
            display: inline-block;
            padding: 2px 8px;
            background: #4caf50;
            color: white;
            font-size: 10px;
            border-radius: 3px;
            margin-left: 8px;
        }}

        .variable-value {{
            white-space: pre-wrap;
            word-wrap: break-word;
            color: #333;
            font-size: 14px;
            line-height: 1.6;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{escape(conversation['title'])}</h1>
        <div class="meta">Created: {escape(conversation['created_at'])}</div>
"""

    # Process each message
    for msg in conversation['messages']:
        if msg['role'] == 'user':
            html += f"""
        <div class="message user-message">
            <div class="message-header">👤 You</div>
            <div class="response-text">{escape(msg['content'])}</div>
        </div>
"""
        else:
            # Detect execution mode
            mode = detect_execution_mode(msg)

            if mode == 'workflow':
                html += """
        <div class="message assistant-message workflow-message">
            <div class="message-header">🤖 Workflow Execution</div>
"""
                html += _render_workflow_html(msg, msg_counter)
                html += """
        </div>
"""
            elif mode == 'council':
                html += """
        <div class="message assistant-message">
            <div class="message-header">🤖 LLM Council</div>
"""
                html += _render_council_html(msg, msg_counter)
                html += """
        </div>
"""
            # Unknown mode: skip silently

        html += """
        <hr class="divider">
"""

        msg_counter += 1

    # Add JavaScript for interactivity
    html += """
    </div>

    <script>
        // Tab switching function
        function switchTab(groupId, index) {
            // Hide all panels in this group
            const panels = document.querySelectorAll(`[data-tab-group="${groupId}"]`);
            panels.forEach(panel => panel.classList.remove('active'));

            // Deactivate all tabs in this group
            const tabButtons = event.currentTarget.parentElement.querySelectorAll('.tab');
            tabButtons.forEach(btn => btn.classList.remove('active'));

            // Activate selected panel
            const selectedPanel = document.querySelector(`[data-tab-group="${groupId}"][data-tab-index="${index}"]`);
            if (selectedPanel) {
                selectedPanel.classList.add('active');
            }

            // Activate clicked tab
            event.currentTarget.classList.add('active');
        }

        // Collapsible section toggle
        function toggleSection(sectionId) {
            const content = document.getElementById(sectionId);
            const icon = document.getElementById(sectionId + '_icon');

            if (content.classList.contains('expanded')) {
                content.classList.remove('expanded');
                icon.textContent = '▶';
            } else {
                content.classList.add('expanded');
                icon.textContent = '▼';
            }
        }

        // Superstep toggle function (for workflow)
        function toggleSuperstep(stepId) {
            const content = document.getElementById(stepId);
            const icon = document.getElementById(stepId + '_icon');

            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.textContent = '▼';
            } else {
                content.style.display = 'none';
                icon.textContent = '▶';
            }
        }

        // Worker tab switching (for workflow)
        function switchWorker(stepId, index) {
            // Hide all panels for this step
            const panels = document.querySelectorAll(`[data-step="${stepId}"]`);
            panels.forEach(p => p.classList.remove('active'));

            // Deactivate all tabs
            const tabs = event.currentTarget.parentElement.querySelectorAll('.worker-tab');
            tabs.forEach(t => t.classList.remove('active'));

            // Activate selected
            const selectedPanel = document.querySelector(`[data-step="${stepId}"][data-index="${index}"]`);
            if (selectedPanel) {
                selectedPanel.classList.add('active');
            }
            event.currentTarget.classList.add('active');
        }

        // Variables section toggle (for workflow)
        function toggleVariables(msgId) {
            const content = document.getElementById(msgId + '_vars');
            const icon = document.getElementById(msgId + '_vars_icon');

            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.textContent = '▼';
            } else {
                content.style.display = 'none';
                icon.textContent = '▶';
            }
        }
    </script>
</body>
</html>
"""

    filename = sanitize_filename(conversation['title']) + '.html'
    return html, filename


def conversation_to_json(conversation: Dict[str, Any]) -> Tuple[str, str]:
    """Convert a conversation to clean JSON format.

    Supports both council and workflow execution modes.

    Returns:
        Tuple of (json_content, filename) with all conversation data,
        suitable for export or programmatic consumption.
    """
    # Create a clean copy with only exportable fields
    export_data = {
        "id": conversation.get("id"),
        "title": conversation.get("title"),
        "created_at": conversation.get("created_at"),
        "modified_at": conversation.get("modified_at"),
        "is_public": conversation.get("is_public", False),
        "messages": []
    }

    # Process each message
    for msg in conversation.get("messages", []):
        if msg["role"] == "user":
            export_data["messages"].append({
                "role": "user",
                "content": msg["content"]
            })
        else:
            # Assistant message with all stages (council) or variables (workflow)
            assistant_msg = {"role": "assistant"}

            # Council mode fields
            if msg.get("stage1"):
                assistant_msg["stage1"] = msg["stage1"]

            if msg.get("stage1_5"):
                assistant_msg["stage1_5"] = msg["stage1_5"]

            if msg.get("stage2"):
                assistant_msg["stage2"] = msg["stage2"]

            if msg.get("stage3"):
                assistant_msg["stage3"] = msg["stage3"]

            # Workflow mode fields
            if msg.get("variables"):
                assistant_msg["variables"] = msg["variables"]

            if msg.get("worker_outputs"):
                assistant_msg["worker_outputs"] = msg["worker_outputs"]

            # Metadata (both modes)
            if msg.get("metadata"):
                assistant_msg["metadata"] = msg["metadata"]

            export_data["messages"].append(assistant_msg)

    json_content = json.dumps(export_data, indent=2, ensure_ascii=False)
    filename = sanitize_filename(conversation['title']) + '.json'
    return json_content, filename
