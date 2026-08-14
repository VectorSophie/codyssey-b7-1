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
from app.services import chat as chat_module


_LOOPBACK_HOSTS = {"127.0.0.1", "::1", "localhost"}


def _is_loopback(address) -> bool:
    host = address[0] if isinstance(address, tuple) else address
    return host in _LOOPBACK_HOSTS


@pytest.fixture(autouse=True)
def block_external_network(monkeypatch):
    """Fail fast if a test accidentally tries to reach a real external host.

    Loopback connections are allowed: Windows' asyncio ProactorEventLoop opens
    a real 127.0.0.1 socketpair internally for its self-pipe, so a blanket
    block breaks every async test (and TestClient) on Windows.
    """
    orig_create_connection = socket.create_connection
    orig_connect = socket.socket.connect
    orig_connect_ex = socket.socket.connect_ex

    def guarded_create_connection(address, *args, **kwargs):
        if not _is_loopback(address):
            raise AssertionError("external network access is forbidden during tests")
        return orig_create_connection(address, *args, **kwargs)

    def guarded_connect(self, address, *args, **kwargs):
        if not _is_loopback(address):
            raise AssertionError("external network access is forbidden during tests")
        return orig_connect(self, address, *args, **kwargs)

    def guarded_connect_ex(self, address, *args, **kwargs):
        if not _is_loopback(address):
            raise AssertionError("external network access is forbidden during tests")
        return orig_connect_ex(self, address, *args, **kwargs)

    monkeypatch.setattr(socket, "create_connection", guarded_create_connection)
    monkeypatch.setattr(socket.socket, "connect", guarded_connect)
    monkeypatch.setattr(socket.socket, "connect_ex", guarded_connect_ex)


@pytest.fixture(autouse=True)
def reset_chat_rate_limit():
    """Each test reuses user id 1 in a fresh DB; the rate limiter's window is
    a module-level dict, so it must not carry counts over between tests."""
    chat_module.reset_rate_limit_state()
    yield
    chat_module.reset_rate_limit_state()


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
