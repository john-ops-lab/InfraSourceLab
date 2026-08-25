"""管理员登录、会话令牌、改密码与 AI 配置接口测试。"""

from conftest import TEST_KEY


def _login(client, username="admin", password="admin123"):
    return client.post("/api/v1/auth/login", json={"username": username, "password": password})


def test_default_admin_login_and_session_access(client):
    response = _login(client)
    assert response.status_code == 200, response.text
    token = response.json()["token"]
    assert response.json()["username"] == "admin"

    # 会话令牌可以访问数据接口（与 API Key 等价的备用通道之外的主通道）
    headers = {"Authorization": f"Bearer {token}"}
    datasets = client.get("/api/v1/datasets", headers=headers)
    assert datasets.status_code == 200


def test_login_wrong_password(client):
    response = _login(client, password="wrong")
    assert response.status_code == 401
    assert "用户名或密码错误" in response.json()["detail"]


def test_api_key_still_works_as_backup(client, auth):
    datasets = client.get("/api/v1/datasets", headers=auth)
    assert datasets.status_code == 200


def test_admin_endpoints_require_session(client, auth):
    # API Key 不能访问管理接口
    response = client.get("/api/v1/admin/ai-config", headers=auth)
    assert response.status_code == 403


def test_change_password_flow(client):
    token = _login(client).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 错误的旧密码
    bad = client.post(
        "/api/v1/auth/change-password",
        json={"old_password": "nope", "new_password": "newpass1"},
        headers=headers,
    )
    assert bad.status_code == 400

    # 新密码过短
    short = client.post(
        "/api/v1/auth/change-password",
        json={"old_password": "admin123", "new_password": "123"},
        headers=headers,
    )
    assert short.status_code == 422

    ok = client.post(
        "/api/v1/auth/change-password",
        json={"old_password": "admin123", "new_password": "newpass1"},
        headers=headers,
    )
    assert ok.status_code == 204

    # 旧密码失效，新密码可用；改密不强制，但改后立即生效
    assert _login(client, password="admin123").status_code == 401
    assert _login(client, password="newpass1").status_code == 200


def test_logout_invalidates_session(client):
    token = _login(client).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/datasets", headers=headers).status_code == 200
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/v1/datasets", headers=headers).status_code == 401


def test_ai_config_get_update_and_status(client, auth):
    token = _login(client).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 初始未配置（测试环境无 AI 环境变量）
    initial = client.get("/api/v1/admin/ai-config", headers=headers)
    assert initial.status_code == 200
    assert initial.json()["ai_configured"] is False

    # 保存完整配置后立即生效
    saved = client.put(
        "/api/v1/admin/ai-config",
        json={
            "base_url": "https://ai.example.com/v1",
            "api_key": "sk-test-123456",
            "model": "gpt-test",
            "timeout_seconds": 45,
        },
        headers=headers,
    )
    assert saved.status_code == 200
    body = saved.json()
    assert body["ai_configured"] is True
    assert body["api_key_configured"] is True
    assert body["api_key_hint"] == "****3456"
    assert "sk-test" not in body["api_key_hint"]

    status = client.get("/api/v1/status", headers=auth)
    assert status.json()["ai_configured"] is True

    # api_key 省略时保持原值
    keep = client.put(
        "/api/v1/admin/ai-config",
        json={"base_url": "https://ai.example.com/v1", "model": "gpt-test", "timeout_seconds": 45},
        headers=headers,
    )
    assert keep.json()["api_key_configured"] is True

    # 清空 base_url 后回到未配置
    cleared = client.put(
        "/api/v1/admin/ai-config",
        json={"base_url": "", "model": "gpt-test", "timeout_seconds": 45},
        headers=headers,
    )
    assert cleared.json()["ai_configured"] is False


def test_session_and_api_key_headers_not_echoed(client):
    response = client.get("/api/v1/datasets", headers={"Authorization": "Bearer bad-token"})
    assert response.status_code == 401
    assert "bad-token" not in response.json()["detail"]
    assert TEST_KEY not in response.text
