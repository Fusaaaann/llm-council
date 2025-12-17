"""Unit tests for json_utils module."""

import pytest
from backend.json_utils import extract_json_from_text, parse_json_safe, is_json_like


class TestExtractJsonFromText:
    """Test JSON extraction from various text formats."""

    def test_extract_from_json_markdown_block(self):
        """Extract JSON from ```json block."""
        text = '```json\n{"key": "value"}\n```'
        result = extract_json_from_text(text)
        assert result == '{"key": "value"}'

    def test_extract_from_generic_code_block(self):
        """Extract JSON from generic ``` block."""
        text = '```\n{"key": "value"}\n```'
        result = extract_json_from_text(text)
        assert result == '{"key": "value"}'

    def test_extract_with_prose_prefix(self):
        """Extract JSON when preceded by prose."""
        text = 'Here is the result:\n```json\n{"key": "value"}\n```'
        result = extract_json_from_text(text)
        assert result == '{"key": "value"}'

    def test_extract_with_prose_suffix(self):
        """Extract JSON when followed by prose."""
        text = '```json\n{"key": "value"}\n```\nThis is the answer.'
        result = extract_json_from_text(text)
        assert result == '{"key": "value"}'

    def test_bracket_matching_with_nested_objects(self):
        """Extract JSON with nested objects using bracket matching."""
        text = 'Data: {"outer": {"inner": "value"}, "list": [1, 2, 3]}'
        result = extract_json_from_text(text)
        assert result == '{"outer": {"inner": "value"}, "list": [1, 2, 3]}'

    def test_bracket_matching_with_escaped_quotes(self):
        """Handle escaped quotes in strings."""
        text = 'Result: {"message": "He said \\"hello\\""}'
        result = extract_json_from_text(text)
        assert result == '{"message": "He said \\"hello\\""}'

    def test_plain_json_object(self):
        """Handle plain JSON without wrapping."""
        text = '{"key": "value"}'
        result = extract_json_from_text(text)
        assert result == '{"key": "value"}'

    def test_plain_json_array(self):
        """Handle plain JSON array without wrapping."""
        text = '[1, 2, 3]'
        result = extract_json_from_text(text)
        assert result == '[1, 2, 3]'

    def test_no_json_found(self):
        """Return None when no JSON found."""
        text = 'This is just plain text with no JSON.'
        result = extract_json_from_text(text)
        assert result is None

    def test_empty_string(self):
        """Handle empty string gracefully."""
        result = extract_json_from_text('')
        assert result is None

    def test_multiple_code_blocks(self):
        """Extract from first code block when multiple exist."""
        text = '```json\n{"first": 1}\n```\n\nAnd:\n```json\n{"second": 2}\n```'
        result = extract_json_from_text(text)
        assert result == '{"first": 1}'

    def test_json_in_code_block_with_backticks_inside(self):
        """Handle JSON that contains backticks within strings."""
        text = '```json\n{"code": "Use `backticks` for code"}\n```'
        result = extract_json_from_text(text)
        assert result == '{"code": "Use `backticks` for code"}'

    def test_array_in_markdown(self):
        """Extract JSON array from markdown block."""
        text = '```json\n[1, 2, 3, 4]\n```'
        result = extract_json_from_text(text)
        assert result == '[1, 2, 3, 4]'

    def test_case_insensitive_json_marker(self):
        """Handle different case variations of json marker."""
        text = '```JSON\n{"key": "value"}\n```'
        result = extract_json_from_text(text)
        assert result == '{"key": "value"}'

    def test_whitespace_variations(self):
        """Handle various whitespace patterns."""
        text = '```json  \n  {"key": "value"}  \n  ```'
        result = extract_json_from_text(text)
        assert result == '{"key": "value"}'


class TestParseJsonSafe:
    """Test safe JSON parsing with type validation."""

    def test_parse_simple_object(self):
        """Parse simple JSON object."""
        success, result, error = parse_json_safe('{"x": 1}', dict)
        assert success is True
        assert result == {"x": 1}
        assert error is None

    def test_parse_from_markdown(self):
        """Parse JSON from markdown block."""
        success, result, error = parse_json_safe('```json\n{"x": 1}\n```', dict)
        assert success is True
        assert result == {"x": 1}
        assert error is None

    def test_type_mismatch_dict_expected_list(self):
        """Reject dict when list expected."""
        success, result, error = parse_json_safe('{"x": 1}', list)
        assert success is False
        assert result is None
        assert "Expected list" in error and "got dict" in error

    def test_type_mismatch_list_expected_dict(self):
        """Reject list when dict expected."""
        success, result, error = parse_json_safe('[1, 2, 3]', dict)
        assert success is False
        assert result is None
        assert "Expected dict" in error and "got list" in error

    def test_invalid_json(self):
        """Handle invalid JSON gracefully."""
        success, result, error = parse_json_safe('{invalid json}', dict)
        assert success is False
        assert result is None
        assert "JSON parsing failed" in error

    def test_no_json_in_text(self):
        """Handle plain text with no JSON."""
        success, result, error = parse_json_safe('Just plain text', dict)
        assert success is False
        assert result is None
        assert "Could not extract JSON" in error or "could not extract" in error.lower()

    def test_var_name_in_error_messages(self):
        """Include variable name in error messages."""
        success, result, error = parse_json_safe('invalid', dict, var_name='test_var')
        assert success is False
        assert "Variable 'test_var'" in error

    def test_no_type_validation(self):
        """Parse without type validation when expected_type=None."""
        success, result, error = parse_json_safe('{"x": 1}')
        assert success is True
        assert result == {"x": 1}

        success, result, error = parse_json_safe('[1, 2, 3]')
        assert success is True
        assert result == [1, 2, 3]

    def test_empty_input(self):
        """Handle empty input gracefully."""
        success, result, error = parse_json_safe('', dict)
        assert success is False
        assert result is None
        assert "empty" in error.lower() or "non-string" in error.lower()

    def test_parse_complex_nested_structure(self):
        """Parse complex nested JSON structure."""
        json_text = '''```json
{
    "team_a_to_team_b": [
        "Question 1",
        "Question 2"
    ],
    "team_b_to_team_a": [
        "Question 3"
    ]
}
```'''
        success, result, error = parse_json_safe(json_text, dict)
        assert success is True
        assert "team_a_to_team_b" in result
        assert len(result["team_a_to_team_b"]) == 2

    def test_parse_with_prose_around_json(self):
        """Parse JSON embedded in prose text."""
        text = 'Here is the JSON you requested:\n```json\n{"status": "success"}\n```\nPlease let me know if you need more information.'
        success, result, error = parse_json_safe(text, dict)
        assert success is True
        assert result == {"status": "success"}

    def test_parse_list_from_markdown(self):
        """Parse list from markdown block."""
        text = '```json\n["item1", "item2", "item3"]\n```'
        success, result, error = parse_json_safe(text, list)
        assert success is True
        assert result == ["item1", "item2", "item3"]

    def test_error_message_includes_preview(self):
        """Error messages include text preview."""
        long_text = "x" * 300
        success, result, error = parse_json_safe(long_text, dict)
        assert success is False
        assert "..." in error  # Indicates text was truncated


class TestIsJsonLike:
    """Test JSON-like string detection."""

    def test_object_is_json_like(self):
        """Detect JSON objects."""
        assert is_json_like('{"x": 1}') is True

    def test_array_is_json_like(self):
        """Detect JSON arrays."""
        assert is_json_like('[1, 2, 3]') is True

    def test_plain_text_not_json_like(self):
        """Reject plain text."""
        assert is_json_like('just text') is False

    def test_empty_string_not_json_like(self):
        """Reject empty string."""
        assert is_json_like('') is False

    def test_whitespace_handled(self):
        """Handle leading/trailing whitespace."""
        assert is_json_like('  {"x": 1}  ') is True
        assert is_json_like('  [1, 2, 3]  ') is True

    def test_none_input(self):
        """Handle None input gracefully."""
        assert is_json_like(None) is False

    def test_non_string_input(self):
        """Handle non-string input gracefully."""
        assert is_json_like(123) is False
        assert is_json_like([1, 2, 3]) is False
