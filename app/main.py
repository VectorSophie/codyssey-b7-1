from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.errors import INTERNAL_ERROR, AppError
from app.logging_utils import log_event
from app.routers import auth, chat, pages


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="EVERYTHING", lifespan=lifespan)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(pages.router)
app.mount("/static", StaticFiles(directory="app/static"), name="static")


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
