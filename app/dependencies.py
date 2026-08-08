"""Shared FastAPI dependencies: DB session access and current-user resolution."""
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.errors import AUTH_REQUIRED, AppError
from app.models.user import User
from app.services.auth import verify_session_token

__all__ = ["get_db", "get_current_user", "require_auth"]


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    user_id = verify_session_token(token)
    if user_id is None:
        return None
    return db.get(User, user_id)


def require_auth(user: User | None = Depends(get_current_user)) -> User:
    if user is None:
        raise AppError(AUTH_REQUIRED, "authentication required", status_code=401)
    return user
