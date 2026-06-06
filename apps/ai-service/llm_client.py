import logging
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from openai import APIConnectionError, APITimeoutError, AsyncOpenAI, OpenAIError

from exceptions import InvalidModelOutputError, LlmProviderError, LlmTimeoutError

load_dotenv(Path(__file__).resolve().parent / ".env")

logger = logging.getLogger(__name__)

EXTRACTION_JSON_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "actions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "type": {
                        "type": "string",
                        "enum": [
                            "appointment",
                            "test",
                            "medication",
                            "treatment",
                            "warning",
                            "other",
                        ],
                    },
                    "deadline_text": {"type": ["string", "null"]},
                    "normalized_deadline": {"type": ["string", "null"]},
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "urgent"],
                    },
                    "evidence": {"type": "string"},
                    "needs_review": {"type": "boolean"},
                    "uncertainty_reason": {"type": ["string", "null"]},
                },
                "required": [
                    "title",
                    "type",
                    "deadline_text",
                    "normalized_deadline",
                    "priority",
                    "evidence",
                    "needs_review",
                    "uncertainty_reason",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["actions"],
    "additionalProperties": False,
}


@dataclass(frozen=True)
class LlmSettings:
    api_key: str
    model: str
    timeout_seconds: float


def get_llm_settings() -> LlmSettings:
    api_key = os.getenv("LLM_API_KEY", "").strip()
    model = os.getenv("LLM_MODEL", "").strip()
    timeout_raw = os.getenv("LLM_TIMEOUT_SECONDS", "30").strip()

    if not api_key or not model:
        raise LlmProviderError()

    try:
        timeout_seconds = float(timeout_raw)
    except ValueError as exc:
        raise LlmProviderError() from exc

    if timeout_seconds <= 0:
        raise LlmProviderError()

    return LlmSettings(
        api_key=api_key,
        model=model,
        timeout_seconds=timeout_seconds,
    )


async def complete_extraction(messages: list[dict[str, str]]) -> str:
    settings = get_llm_settings()
    client = AsyncOpenAI(api_key=settings.api_key, timeout=settings.timeout_seconds)

    try:
        response = await client.chat.completions.create(
            model=settings.model,
            messages=messages,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "extraction_result",
                    "strict": True,
                    "schema": EXTRACTION_JSON_SCHEMA,
                },
            },
        )
    except APITimeoutError as exc:
        logger.warning("LLM request timed out", extra={"model": settings.model})
        raise LlmTimeoutError() from exc
    except (APIConnectionError, OpenAIError) as exc:
        logger.warning(
            "LLM provider request failed",
            extra={"model": settings.model, "error_type": type(exc).__name__},
        )
        raise LlmProviderError() from exc

    if not response.choices:
        logger.warning("LLM returned no choices", extra={"model": settings.model})
        raise InvalidModelOutputError()

    content = response.choices[0].message.content
    if content is None or not content.strip():
        logger.warning("LLM returned empty content", extra={"model": settings.model})
        raise InvalidModelOutputError()

    return content