import os
from contextlib import asynccontextmanager
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.errors import INTERNAL_ERROR, AppError
from app.logging_utils import log_event
from app.routers import auth, chat

FRONTEND_DIST = "frontend/dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="EVERYTHING", lifespan=lifespan)


@app.middleware("http")
async def attach_chat_request_id(request: Request, call_next):
    """Give every chat attempt a correlation id, including rejected requests."""
    if request.url.path != "/api/chat":
        return await call_next(request)

    request.state.request_id = uuid.uuid4().hex
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response

app.include_router(auth.router)
app.include_router(chat.router)


@app.exception_handler(AppError)
def app_error_handler(_request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error_code": exc.code, "message": exc.message},
    )


@app.exception_handler(Exception)
def unhandled_error_handler(_request: Request, exc: Exception):
    log_event("unhandled_exception", exception_type=type(exc).__name__)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error_code": INTERNAL_ERROR, "message": "internal error"},
    )


@app.get("/health")
def health():
    return {"status": "ok"}


# Serve the built React SPA (frontend/npm run build) as the same origin as
# the API, so the browser needs no CORS config in production. Falls back to
# index.html for any unmatched GET so react-router's client-side routes
# (e.g. /chat) work on a hard refresh. Registered last so it never shadows
# /api/*, /health, or /docs.
if os.path.isdir(f"{FRONTEND_DIST}/assets"):
    app.mount("/assets", StaticFiles(directory=f"{FRONTEND_DIST}/assets"), name="frontend-assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        return FileResponse(f"{FRONTEND_DIST}/index.html")
