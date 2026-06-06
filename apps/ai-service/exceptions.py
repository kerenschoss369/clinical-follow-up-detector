class AiServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class LlmTimeoutError(AiServiceError):
    def __init__(self) -> None:
        super().__init__(
            code="LLM_TIMEOUT",
            message="The language model did not respond within the allowed time.",
            status_code=504,
        )


class LlmProviderError(AiServiceError):
    def __init__(self) -> None:
        super().__init__(
            code="LLM_PROVIDER_ERROR",
            message="The language model provider could not process the request.",
            status_code=502,
        )


class InvalidModelOutputError(AiServiceError):
    def __init__(self) -> None:
        super().__init__(
            code="INVALID_MODEL_OUTPUT",
            message="The model returned output that did not match the required schema.",
            status_code=502,
        )