"""Mock OpenRouter API for testing."""

from typing import List, Dict, Any


class MockOpenRouter:
    """Mock OpenRouter API responses for testing."""

    @staticmethod
    def get_stage1_response(model: str, query: str) -> Dict[str, Any]:
        """Mock Stage 1 response from a council model."""
        return {
            "content": f"[{model}] Stage 1 response to: {query[:50]}...",
            "reasoning_details": None
        }

    @staticmethod
    def get_stage1_5_questions(model: str, responses: str) -> Dict[str, Any]:
        """Mock Stage 1.5 question generation."""
        return {
            "content": f"[{model}] Question for Response A: Can you clarify your assumption?\nQuestion for Response B: What evidence supports this claim?",
            "reasoning_details": None
        }

    @staticmethod
    def get_stage1_5_answers(model: str, questions: str) -> Dict[str, Any]:
        """Mock Stage 1.5 answer to questions."""
        return {
            "content": f"[{model}] Answer: The assumption is based on common practice in this domain. The evidence includes...",
            "reasoning_details": None
        }

    @staticmethod
    def get_stage2_ranking(model: str, responses: str) -> Dict[str, Any]:
        """Mock Stage 2 ranking evaluation."""
        return {
            "content": f"""[{model}] Evaluation:

Response A provides clear reasoning but lacks depth.
Response B offers comprehensive analysis with good examples.
Response C is concise but misses key points.

FINAL RANKING:
1. Response B
2. Response A
3. Response C""",
            "reasoning_details": None
        }

    @staticmethod
    def get_stage3_synthesis(model: str, all_context: str) -> Dict[str, Any]:
        """Mock Stage 3 chairman synthesis."""
        return {
            "content": f"[{model} Chairman] After reviewing all council responses and deliberations, the synthesized answer is: This is a comprehensive response that addresses the user's query by combining insights from all council members.",
            "reasoning_details": None
        }

    @staticmethod
    def get_title_generation(query: str) -> Dict[str, Any]:
        """Mock title generation."""
        return {
            "content": f"Discussion: {query[:30]}...",
            "reasoning_details": None
        }


# Monkey patch function to replace real OpenRouter calls
async def mock_query_model(model: str, messages: List[Dict[str, str]], **kwargs) -> Dict[str, Any]:
    """Mock query_model function."""
    mock = MockOpenRouter()
    user_content = messages[0]["content"] if messages else ""

    # Detect which stage based on message content
    if "generate 1-2 follow-up questions" in user_content:
        return mock.get_stage1_5_questions(model, user_content)
    elif "Answer the following questions" in user_content:
        return mock.get_stage1_5_answers(model, user_content)
    elif "evaluate and rank" in user_content.lower():
        return mock.get_stage2_ranking(model, user_content)
    elif "synthesize" in user_content.lower() or "chairman" in user_content.lower():
        return mock.get_stage3_synthesis(model, user_content)
    elif len(user_content) < 100:  # Short query = title generation
        return mock.get_title_generation(user_content)
    else:
        return mock.get_stage1_response(model, user_content)


async def mock_query_models_parallel(models: List[str], messages: List[Dict[str, str]], **kwargs) -> Dict[str, Dict[str, Any]]:
    """Mock query_models_parallel function."""
    results = {}
    for model in models:
        results[model] = await mock_query_model(model, messages, **kwargs)
    return results
