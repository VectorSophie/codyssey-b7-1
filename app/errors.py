"""Shared application error type and the user-facing error-code vocabulary."""


class AppError(Exception):
    """Raised anywhere in the service layer; translated to a JSON error response."""

    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


# Codes from docs/API_CONTRACT.md
EMPTY_INPUT = "EMPTY_INPUT"
INPUT_TOO_LONG = "INPUT_TOO_LONG"
AUTH_REQUIRED = "AUTH_REQUIRED"
AI_TIMEOUT = "AI_TIMEOUT"
AI_RATE_LIMIT = "AI_RATE_LIMIT"
AI_API_ERROR = "AI_API_ERROR"
DB_SAVE_ERROR = "DB_SAVE_ERROR"
INTERNAL_ERROR = "INTERNAL_ERROR"
TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS"
ADMIN_REQUIRED = "ADMIN_REQUIRED"

# Documented extensions beyond the original contract (see API_CONTRACT.md "Extensions").
USERNAME_TAKEN = "USERNAME_TAKEN"
EMAIL_TAKEN = "EMAIL_TAKEN"
INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
NOT_FOUND = "NOT_FOUND"
