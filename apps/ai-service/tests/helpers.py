import json
from collections.abc import Awaitable, Callable
from datetime import date

REFERENCE_DATE = date(2026, 6, 5)

DEFAULT_NOTE = "The patient should repeat a CBC within seven days."


def make_action(**overrides: object) -> dict:
    action = {
        "title": "Repeat CBC blood test",
        "type": "test",
        "deadline_text": "within seven days",
        "normalized_deadline": "2026-06-12",
        "priority": "medium",
        "evidence": DEFAULT_NOTE,
        "needs_review": False,
        "uncertainty_reason": None,
    }
    action.update(overrides)
    return action


def make_llm_response(actions: list[dict]) -> str:
    return json.dumps({"actions": actions})


def async_mock_returning(content: str) -> Callable[[list[dict[str, str]]], Awaitable[str]]:
    async def _complete(_messages: list[dict[str, str]]) -> str:
        return content

    return _complete
