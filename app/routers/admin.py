from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_admin
from app.models.user import User
from app.schemas.admin import LogEntryOut, LogListResponse
from app.services.chat import list_recent_message_logs

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/logs", response_model=LogListResponse)
def get_logs(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Web-facing equivalent of scripts/check_logs.sql, gated to usernames
    listed in ADMIN_USERNAMES (see app/config.py)."""
    logs = list_recent_message_logs(db)
    return LogListResponse(logs=[LogEntryOut.model_validate(log) for log in logs])
