from datetime import date
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class ActionType(str, Enum):
    APPOINTMENT = "appointment"
    TEST = "test"
    MEDICATION = "medication"
    TREATMENT = "treatment"
    WARNING = "warning"
    OTHER = "other"


class Priority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: Literal["ai-service"]


class ExtractActionsRequest(BaseModel):
    text: str
    reference_date: date

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        if value.strip() == "":
            raise ValueError("Note text is required.")
        return value


class LlmActionPayload(BaseModel):
    title: str = Field(min_length=1)
    type: ActionType
    deadline_text: str | None
    normalized_deadline: str | None
    priority: Priority
    evidence: str = Field(min_length=1)
    needs_review: bool
    uncertainty_reason: str | None

    @model_validator(mode="after")
    def validate_uncertainty_fields(self) -> "LlmActionPayload":
        if self.needs_review:
            if self.uncertainty_reason is None or self.uncertainty_reason.strip() == "":
                raise ValueError(
                    "uncertainty_reason is required when needs_review is true"
                )
            return self

        if self.uncertainty_reason is not None:
            raise ValueError(
                "uncertainty_reason must be null when needs_review is false"
            )

        return self


class LlmExtractionPayload(BaseModel):
    actions: list[LlmActionPayload]


class ExtractedAction(BaseModel):
    title: str = Field(min_length=1)
    type: ActionType
    deadline_text: str | None
    normalized_deadline: date | None
    priority: Priority
    evidence: str = Field(min_length=1)
    needs_review: bool
    uncertainty_reason: str | None

    @model_validator(mode="after")
    def validate_uncertainty_fields(self) -> "ExtractedAction":
        if self.needs_review:
            if self.uncertainty_reason is None or self.uncertainty_reason.strip() == "":
                raise ValueError(
                    "uncertainty_reason is required when needs_review is true"
                )
            return self

        if self.uncertainty_reason is not None:
            raise ValueError(
                "uncertainty_reason must be null when needs_review is false"
            )

        return self


class ExtractActionsResponse(BaseModel):
    actions: list[ExtractedAction]


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody