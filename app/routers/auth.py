from fastapi import APIRouter, Depends, Response
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.dependencies import get_db, require_auth
from app.errors import AppError
from app.models.user import User
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserOut
from app.services.auth import create_session_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Computed once at import time; verified against on a login miss so response
# timing doesn't reveal whether a username exists (real PBKDF2 cost either way).
_DUMMY_PASSWORD_HASH = hash_password("dummy-password-for-timing-safety")


def _set_session_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=create_session_token(user_id),
        httponly=True,
        secure=settings.session_https_only,
        samesite="lax",
        max_age=settings.session_max_age_seconds,
    )


def _find_conflicting_user(db: Session, username: str, email: str) -> User | None:
    return db.query(User).filter(or_(User.username == username, User.email == email)).first()


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    existing = _find_conflicting_user(db, payload.username, payload.email)
    if existing is not None:
        if existing.username == payload.username:
            raise AppError("USERNAME_TAKEN", "username is already taken")
        raise AppError("EMAIL_TAKEN", "email is already registered")

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Two concurrent registrations can both pass the check above and
        # race to insert; the loser hits the UNIQUE constraint here instead.
        db.rollback()
        conflict = _find_conflicting_user(db, payload.username, payload.email)
        if conflict is not None and conflict.username == payload.username:
            raise AppError("USERNAME_TAKEN", "username is already taken") from None
        raise AppError("EMAIL_TAKEN", "email is already registered") from None
    db.refresh(user)

    _set_session_cookie(response, user.id)
    return AuthResponse(user=UserOut.model_validate(user))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    # Verify against a dummy hash on a miss so a nonexistent username still
    # pays the real PBKDF2 cost -- response timing shouldn't reveal whether
    # the account exists.
    password_hash = user.password_hash if user is not None else _DUMMY_PASSWORD_HASH
    password_ok = verify_password(payload.password, password_hash)
    if user is None or not password_ok:
        raise AppError("INVALID_CREDENTIALS", "invalid username or password", status_code=401)

    _set_session_cookie(response, user.id)
    return AuthResponse(user=UserOut.model_validate(user))


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(settings.session_cookie_name)
    return {"success": True}


@router.get("/me", response_model=AuthResponse)
def me(user: User = Depends(require_auth)):
    return AuthResponse(user=UserOut.model_validate(user))
