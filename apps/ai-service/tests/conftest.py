import pytest

import llm_client


@pytest.fixture(autouse=True)
def block_openai_and_clear_llm_env(monkeypatch: pytest.MonkeyPatch) -> None:
    def forbidden_openai(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("AsyncOpenAI must not be called in tests")

    monkeypatch.setattr(llm_client, "AsyncOpenAI", forbidden_openai)
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.delenv("LLM_MODEL", raising=False)
