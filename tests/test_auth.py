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
