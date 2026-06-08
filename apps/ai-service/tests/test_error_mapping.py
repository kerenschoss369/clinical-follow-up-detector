import pytest

import llm_client
from exceptions import LlmProviderError, LlmTimeoutError
from main import app
from tests.helpers import DEFAULT_NOTE

try:
    from fastapi.testclient import TestClient
except ImportError:
    from starlette.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_provider_timeout_returns_504(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def raise_timeout(_messages: list[dict[str, str]]) -> str:
        raise LlmTimeoutError()

    monkeypatch.setattr(llm_client, "complete_extraction", raise_timeout)

    response = client.post(
        "/extract-actions",
        json={"text": DEFAULT_NOTE, "reference_date": "2026-06-05"},
    )

    assert response.status_code == 504
    body = response.json()
    assert body["error"]["code"] == "LLM_TIMEOUT"
    assert DEFAULT_NOTE not in response.text


def test_provider_failure_returns_502(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def raise_provider_error(_messages: list[dict[str, str]]) -> str:
        raise LlmProviderError()

    monkeypatch.setattr(llm_client, "complete_extraction", raise_provider_error)

    response = client.post(
        "/extract-actions",
        json={"text": DEFAULT_NOTE, "reference_date": "2026-06-05"},
    )

    assert response.status_code == 502
    body = response.json()
    assert body["error"]["code"] == "LLM_PROVIDER_ERROR"
    assert DEFAULT_NOTE not in response.text


def test_invalid_model_output_returns_502(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def return_empty(_messages: list[dict[str, str]]) -> str:
        return ""

    monkeypatch.setattr(llm_client, "complete_extraction", return_empty)

    response = client.post(
        "/extract-actions",
        json={"text": DEFAULT_NOTE, "reference_date": "2026-06-05"},
    )

    assert response.status_code == 502
    body = response.json()
    assert body["error"]["code"] == "INVALID_MODEL_OUTPUT"
    assert DEFAULT_NOTE not in response.text


def test_whitespace_text_returns_400(client: TestClient) -> None:
    response = client.post(
        "/extract-actions",
        json={"text": "   ", "reference_date": "2026-06-05"},
    )

    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "INVALID_EXTRACTION_REQUEST"
    assert body["error"]["message"] == "Note text is required."
    assert DEFAULT_NOTE not in response.text


def test_invalid_reference_date_returns_400(client: TestClient) -> None:
    response = client.post(
        "/extract-actions",
        json={"text": DEFAULT_NOTE, "reference_date": "bad"},
    )

    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "INVALID_EXTRACTION_REQUEST"
    assert body["error"]["message"] == "The extraction request is invalid."
    assert DEFAULT_NOTE not in response.text
