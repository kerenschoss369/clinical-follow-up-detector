from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from exceptions import AiServiceError
from extraction_service import extract_actions
from models import (
    ErrorResponse,
    ExtractActionsRequest,
    ExtractActionsResponse,
    HealthResponse,
)

app = FastAPI()


def _is_empty_text_error(error: dict) -> bool:
    location = error.get("loc", ())
    if len(location) < 2 or location[-1] != "text":
        return False

    if error.get("type") != "value_error":
        return False

    message = str(error.get("msg", ""))
    return "Note text is required." in message


def _validation_error_message(exc: RequestValidationError) -> str:
    for error in exc.errors():
        if _is_empty_text_error(error):
            return "Note text is required."
    return "The extraction request is invalid."


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(
    _request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    message = _validation_error_message(exc)
    body = ErrorResponse(
        error={
            "code": "INVALID_EXTRACTION_REQUEST",
            "message": message,
        }
    )
    return JSONResponse(status_code=400, content=body.model_dump())


@app.exception_handler(AiServiceError)
async def ai_service_exception_handler(
    _request: Request,
    exc: AiServiceError,
) -> JSONResponse:
    body = ErrorResponse(
        error={
            "code": exc.code,
            "message": exc.message,
        }
    )
    return JSONResponse(status_code=exc.status_code, content=body.model_dump())


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="ai-service")


@app.post("/extract-actions", response_model=ExtractActionsResponse)
async def extract_actions_endpoint(
    request: ExtractActionsRequest,
) -> ExtractActionsResponse:
    return await extract_actions(request.text, request.reference_date)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)