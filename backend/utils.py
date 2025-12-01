"""Utility functions for the backend."""

import json
import re
from typing import Dict, Any, Tuple
from html import escape


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


def conversation_to_markdown(conversation: Dict[str, Any]) -> Tuple[str, str]:
    """Convert a conversation to markdown format.

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
            md += "## 🤖 LLM Council\n\n"

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

        md += "---\n\n"

    filename = sanitize_filename(conversation['title']) + '.md'
    return md, filename


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
            html += """
        <div class="message assistant-message">
            <div class="message-header">🤖 LLM Council</div>
"""

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

            html += """
        </div>
"""

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
    </script>
</body>
</html>
"""

    filename = sanitize_filename(conversation['title']) + '.html'
    return html, filename


def conversation_to_json(conversation: Dict[str, Any]) -> Tuple[str, str]:
    """Convert a conversation to clean JSON format.

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
            # Assistant message with all stages
            assistant_msg = {"role": "assistant"}

            if msg.get("stage1"):
                assistant_msg["stage1"] = msg["stage1"]

            if msg.get("stage1_5"):
                assistant_msg["stage1_5"] = msg["stage1_5"]

            if msg.get("stage2"):
                assistant_msg["stage2"] = msg["stage2"]

            if msg.get("stage3"):
                assistant_msg["stage3"] = msg["stage3"]

            if msg.get("metadata"):
                assistant_msg["metadata"] = msg["metadata"]

            export_data["messages"].append(assistant_msg)

    json_content = json.dumps(export_data, indent=2, ensure_ascii=False)
    filename = sanitize_filename(conversation['title']) + '.json'
    return json_content, filename
