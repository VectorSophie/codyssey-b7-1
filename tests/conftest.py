import os
import socket

# Set deterministic test configuration before importing the application.  Using
# direct assignment prevents a developer's real shell or .env credentials from
# leaking into a test run.
os.environ["APP_ENV"] = "test"
os.environ["OPENROUTER_API_KEY"] = "test-key"
os.environ["OPENROUTER_MODEL"] = "openrouter/free"
os.environ["SECRET_KEY"] = "test-secret"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SESSION_HTTPS_ONLY"] = "false"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app import main as main_module
from app.main import app


@pytest.fixture(autouse=True)
def block_external_network(monkeypatch):
    """Fail fast if a test accidentally tries to use a real network socket."""

    def blocked(*_args, **_kwargs):
        raise AssertionError("external network access is forbidden during tests")

    monkeypatch.setattr(socket, "create_connection", blocked)
    monkeypatch.setattr(socket.socket, "connect", blocked)
    monkeypatch.setattr(socket.socket, "connect_ex", blocked)


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestingSessionLocal
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture()
def client(db_session, monkeypatch):
    # The test DB is created above; do not let the app lifespan initialize the
    # configured production/development database as a side effect.
    monkeypatch.setattr(main_module, "init_db", lambda: None)
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture()
def registered_user(client):
    client.post(
        "/api/auth/register",
        json={"username": "alice", "email": "alice@example.com", "password": "password123"},
    )
    client.post("/api/auth/logout")
    return {"username": "alice", "password": "password123"}
