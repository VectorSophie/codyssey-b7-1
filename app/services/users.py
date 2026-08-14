"""User persistence: the only module that queries the users table directly."""
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models.user import User


def find_conflicting_user(db: Session, username: str, email: str) -> User | None:
    return db.query(User).filter(or_(User.username == username, User.email == email)).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def create_user(db: Session, username: str, email: str, password_hash: str) -> User:
    """Insert a user, translating a UNIQUE-constraint race into the same
    AppError the pre-insert check would have raised (see app/routers/auth.py)."""
    user = User(username=username, email=email, password_hash=password_hash)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        conflict = find_conflicting_user(db, username, email)
        if conflict is not None and conflict.username == username:
            raise AppError("USERNAME_TAKEN", "username is already taken") from None
        raise AppError("EMAIL_TAKEN", "email is already registered") from None
    db.refresh(user)
    return user
