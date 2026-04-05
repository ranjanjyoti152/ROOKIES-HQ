from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
import traceback


class AppException(HTTPException):
    """Base application exception."""
    pass


class NotFoundException(AppException):
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class ForbiddenException(AppException):
    def __init__(self, detail: str = "Access denied"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class BadRequestException(AppException):
    def __init__(self, detail: str = "Bad request"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class ConflictException(AppException):
    def __init__(self, detail: str = "Conflict"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class InvalidTransitionException(BadRequestException):
    def __init__(self, current_status: str, target_status: str):
        super().__init__(
            detail=f"Invalid transition from '{current_status}' to '{target_status}'"
        )


async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler to prevent blank screens."""
    traceback.print_exc()
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal error occurred. Please try again.",
            "type": "internal_error",
        },
    )
