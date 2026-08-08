"""SPA-serving routes in app/main.py only register when frontend/dist exists
(checked at import time), so these skip when the frontend hasn't been built --
CI builds it first (see .github/workflows/ci.yml); local backend-only runs
without `npm run build` skip gracefully instead of failing.
"""
import os

import pytest

from app.main import FRONTEND_DIST

_frontend_built = os.path.isdir(f"{FRONTEND_DIST}/assets")
skip_reason = "frontend not built (run `npm run build` in frontend/) -- SPA route isn't registered"


@pytest.mark.skipif(not _frontend_built, reason=skip_reason)
def test_unmatched_api_get_is_404_json_not_html(client):
    response = client.get("/api/definitely-not-a-real-route")

    assert response.status_code == 404
    assert response.json()["error_code"] == "NOT_FOUND"


@pytest.mark.skipif(not _frontend_built, reason=skip_reason)
def test_unmatched_non_api_get_falls_back_to_spa_index(client):
    response = client.get("/some/client/side/route")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
