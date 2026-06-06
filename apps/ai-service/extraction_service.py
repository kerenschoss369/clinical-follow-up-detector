import json
import logging
import re
from collections.abc import Awaitable, Callable
from datetime import date, timedelta

from pydantic import ValidationError

import llm_client
from exceptions import InvalidModelOutputError
from models import (
    ExtractActionsResponse,
    ExtractedAction,
    LlmActionPayload,
    LlmExtractionPayload,
    Priority,
)
from prompts import build_messages

logger = logging.getLogger(__name__)

URGENCY_PATTERN = re.compile(
    r"\b(urgent|immediately|without delay|as soon as possible|emergency)\b",
    re.IGNORECASE,
)

VAGUE_DEADLINE_PATTERN = re.compile(
    r"\b(soon|later|as needed|when possible)\b",
    re.IGNORECASE,
)

YEAR_PATTERN = re.compile(r"\b(?:19|20)\d{2}\b")

MONTH_OR_SLASH_DATE_PATTERN = re.compile(
    r"\b(?:january|february|march|april|may|june|july|august|september|october|november|december|"
    r"jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b|\b\d{1,2}[/-]\d{1,2}\b",
    re.IGNORECASE,
)

COMPLETED_PATTERN = re.compile(
    r"\b(?:was completed|were completed|already received|completed last|has been completed)\b",
    re.IGNORECASE,
)

FUTURE_FOLLOWUP_PATTERN = re.compile(
    r"\b(?:repeat|return|follow[- ]?up|schedule|book|within|in \d|tomorrow)\b",
    re.IGNORECASE,
)

EVIDENCE_NOT_VERIFIED_REASON = "Evidence could not be verified in the source note."
DEADLINE_NOT_VERIFIED_REASON = "Deadline wording could not be verified in the source note."
MISSING_YEAR_REASON = "The deadline omits a year and cannot be normalized safely."
VAGUE_DEADLINE_REASON = "The note uses vague deadline wording that cannot be normalized."
DATE_MISMATCH_REASON = "The normalized deadline could not be verified against the note wording."


def _has_explicit_urgency(text: str) -> bool:
    return URGENCY_PATTERN.search(text) is not None


def _deadline_omits_year(deadline_text: str | None) -> bool:
    if deadline_text is None:
        return False
    if YEAR_PATTERN.search(deadline_text):
        return False
    return MONTH_OR_SLASH_DATE_PATTERN.search(deadline_text) is not None


def _is_vague_deadline(deadline_text: str | None) -> bool:
    if deadline_text is None:
        return False
    return VAGUE_DEADLINE_PATTERN.search(deadline_text) is not None


def _is_completed_without_followup(evidence: str) -> bool:
    if COMPLETED_PATTERN.search(evidence) is None:
        return False
    return FUTURE_FOLLOWUP_PATTERN.search(evidence) is None


def _resolve_relative_deadline(
    deadline_text: str | None,
    reference_date: date,
) -> date | None:
    if deadline_text is None:
        return None

    lowered = deadline_text.lower()

    if re.search(r"\btomorrow\b", lowered):
        return reference_date + timedelta(days=1)

    seven_days_match = re.search(r"\b(?:within|in)\s+seven\s+days\b", lowered)
    if seven_days_match:
        return reference_date + timedelta(days=7)

    numeric_days_match = re.search(r"\b(?:within|in)\s+(\d+)\s+days\b", lowered)
    if numeric_days_match:
        return reference_date + timedelta(days=int(numeric_days_match.group(1)))

    two_weeks_match = re.search(r"\bin\s+two\s+weeks\b", lowered)
    if two_weeks_match:
        return reference_date + timedelta(days=14)

    numeric_weeks_match = re.search(r"\bin\s+(\d+)\s+weeks\b", lowered)
    if numeric_weeks_match:
        return reference_date + timedelta(weeks=int(numeric_weeks_match.group(1)))

    return None


def _parse_normalized_deadline(value: str | None) -> date | None:
    if value is None:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise InvalidModelOutputError() from exc


def _apply_deadline_validation(
    action: LlmActionPayload,
    reference_date: date,
) -> tuple[date | None, bool, str | None]:
    needs_review = action.needs_review
    uncertainty_reason = action.uncertainty_reason
    normalized_deadline = _parse_normalized_deadline(action.normalized_deadline)

    if _is_vague_deadline(action.deadline_text):
        normalized_deadline = None
        needs_review = True
        uncertainty_reason = VAGUE_DEADLINE_REASON
        return normalized_deadline, needs_review, uncertainty_reason

    if _deadline_omits_year(action.deadline_text):
        normalized_deadline = None
        needs_review = True
        uncertainty_reason = MISSING_YEAR_REASON
        return normalized_deadline, needs_review, uncertainty_reason

    expected_deadline = _resolve_relative_deadline(action.deadline_text, reference_date)

    if expected_deadline is not None:
        if normalized_deadline is None:
            normalized_deadline = expected_deadline
        elif normalized_deadline != expected_deadline:
            normalized_deadline = None
            needs_review = True
            uncertainty_reason = DATE_MISMATCH_REASON

    return normalized_deadline, needs_review, uncertainty_reason


def _apply_evidence_validation(
    action: LlmActionPayload,
    note_text: str,
    needs_review: bool,
    uncertainty_reason: str | None,
) -> tuple[bool, str | None]:
    if action.evidence not in note_text:
        return True, EVIDENCE_NOT_VERIFIED_REASON

    if (
        action.deadline_text is not None
        and action.deadline_text not in note_text
        and action.deadline_text not in action.evidence
    ):
        return True, DEADLINE_NOT_VERIFIED_REASON

    return needs_review, uncertainty_reason


def _validate_action(
    action: LlmActionPayload,
    note_text: str,
    reference_date: date,
) -> ExtractedAction | None:
    if action.priority == Priority.URGENT and not _has_explicit_urgency(action.evidence):
        raise InvalidModelOutputError()

    if _is_completed_without_followup(action.evidence):
        return None

    normalized_deadline, needs_review, uncertainty_reason = _apply_deadline_validation(
        action,
        reference_date,
    )
    needs_review, uncertainty_reason = _apply_evidence_validation(
        action,
        note_text,
        needs_review,
        uncertainty_reason,
    )

    return ExtractedAction(
        title=action.title,
        type=action.type,
        deadline_text=action.deadline_text,
        normalized_deadline=normalized_deadline,
        priority=action.priority,
        evidence=action.evidence,
        needs_review=needs_review,
        uncertainty_reason=uncertainty_reason,
    )


def _parse_llm_payload(raw_content: str) -> LlmExtractionPayload:
    if not raw_content.strip():
        raise InvalidModelOutputError()

    try:
        parsed = json.loads(raw_content)
    except json.JSONDecodeError as exc:
        raise InvalidModelOutputError() from exc

    try:
        return LlmExtractionPayload.model_validate(parsed)
    except ValidationError as exc:
        logger.warning(
            "LLM output failed schema validation",
            extra={"validation_errors": len(exc.errors())},
        )
        raise InvalidModelOutputError() from exc


async def extract_actions(
    text: str,
    reference_date: date,
    *,
    llm_complete: Callable[[list[dict[str, str]]], Awaitable[str]] | None = None,
) -> ExtractActionsResponse:
    complete = llm_complete or llm_client.complete_extraction
    messages = build_messages(text, reference_date)
    raw_content = await complete(messages)
    payload = _parse_llm_payload(raw_content)

    validated_actions: list[ExtractedAction] = []
    for action in payload.actions:
        validated = _validate_action(action, text, reference_date)
        if validated is not None:
            validated_actions.append(validated)

    return ExtractActionsResponse(actions=validated_actions)