"""Utility functions for the backend."""

from typing import Dict, Any


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
