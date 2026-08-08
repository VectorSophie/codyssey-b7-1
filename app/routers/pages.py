"""Server-rendered page routes.

Templates here are minimal placeholders so the app is runnable end-to-end;
Agent 2 (feature/frontend-experience) owns the real design in app/templates/.
"""
from fastapi import APIRouter, Depends, Request
from fastapi.templating import Jinja2Templates

from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(tags=["pages"])
templates = Jinja2Templates(directory="app/templates")


@router.get("/")
def landing(request: Request):
    return templates.TemplateResponse(request, "index.html", {})


@router.get("/login")
def login_page(request: Request):
    return templates.TemplateResponse(request, "login.html", {})


@router.get("/register")
def register_page(request: Request):
    return templates.TemplateResponse(request, "register.html", {})


@router.get("/chat")
def chat_page(request: Request, user: User | None = Depends(get_current_user)):
    return templates.TemplateResponse(request, "chat.html", {"user": user})
