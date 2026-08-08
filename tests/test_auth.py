def register(client, username="alice", email="alice@example.com"):
    return client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": "password123"},
    )


def test_registration_succeeds_and_sets_authenticated_session(client):
    response = register(client)

    assert response.status_code == 201
    assert response.json()["user"]["username"] == "alice"
    assert client.get("/api/auth/me").status_code == 200


def test_duplicate_username_and_email_are_rejected(client):
    assert register(client).status_code == 201

    duplicate_username = register(client, email="other@example.com")
    duplicate_email = register(client, username="other")

    assert duplicate_username.status_code == 400
    assert duplicate_username.json()["error_code"] == "USERNAME_TAKEN"
    assert duplicate_email.status_code == 400
    assert duplicate_email.json()["error_code"] == "EMAIL_TAKEN"


def test_login_succeeds_and_wrong_credentials_fail_without_detail_leak(client):
    register(client)
    client.post("/api/auth/logout")

    wrong = client.post(
        "/api/auth/login", json={"username": "alice", "password": "wrong-password"}
    )
    missing = client.post(
        "/api/auth/login", json={"username": "missing", "password": "wrong-password"}
    )
    correct = client.post(
        "/api/auth/login", json={"username": "alice", "password": "password123"}
    )

    assert wrong.status_code == missing.status_code == 401
    assert wrong.json()["error_code"] == missing.json()["error_code"] == "INVALID_CREDENTIALS"
    assert wrong.json()["message"] == missing.json()["message"]
    assert correct.status_code == 200


def test_logout_invalidates_browser_access(client):
    register(client)
    assert client.get("/api/auth/me").status_code == 200

    response = client.post("/api/auth/logout")

    assert response.status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_username_with_disallowed_characters_is_rejected(client):
    response = client.post(
        "/api/auth/register",
        json={"username": "al ice!", "email": "alice@example.com", "password": "password123"},
    )

    assert response.status_code == 422


def test_registration_race_translates_integrity_error_to_taken(client, monkeypatch):
    import app.routers.auth as auth_module
    from app.database import get_db
    from app.main import app
    from app.models.user import User

    db = next(app.dependency_overrides[get_db]())
    db.add(User(username="racer", email="racer@example.com", password_hash="x"))
    db.commit()
    db.close()

    # Simulate two requests racing past the pre-insert check: make it report
    # "no conflict" once (like the real UNIQUE constraint check would if it
    # ran a moment before the concurrent insert landed), so this request
    # falls through to db.commit() and hits the real constraint instead.
    call_count = {"n": 0}
    real_find = auth_module._find_conflicting_user

    def racy_find(db, username, email):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return None
        return real_find(db, username, email)

    monkeypatch.setattr(auth_module, "_find_conflicting_user", racy_find)

    response = client.post(
        "/api/auth/register",
        json={"username": "racer", "email": "different@example.com", "password": "password123"},
    )

    assert response.status_code == 400
    assert response.json()["error_code"] == "USERNAME_TAKEN"


def test_unauthenticated_chat_and_history_are_blocked(client):
    chat_response = client.post(
        "/api/chat", json={"session_id": None, "message": "질문"}
    )
    requests = [
        chat_response,
        client.get("/api/chats"),
        client.get("/api/chats/1"),
        client.delete("/api/chats/1"),
    ]

    assert all(response.status_code == 401 for response in requests)
    assert all(response.json()["error_code"] == "AUTH_REQUIRED" for response in requests)
    assert len(chat_response.headers["X-Request-ID"]) == 32
