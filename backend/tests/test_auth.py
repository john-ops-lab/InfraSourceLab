"""API 认证：所有 /api/v1/* 要求 Bearer Token。"""


def test_health_requires_no_auth(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_missing_token_returns_401(client):
    response = client.get("/api/v1/datasets")
    assert response.status_code == 401


def test_wrong_token_returns_401(client):
    response = client.get(
        "/api/v1/datasets", headers={"Authorization": "Bearer wrong-key"}
    )
    assert response.status_code == 401
    # 错误响应不得回显 Key
    assert "wrong-key" not in response.text


def test_correct_token_allows_access(client, auth):
    response = client.get("/api/v1/datasets", headers=auth)
    assert response.status_code == 200


def test_status_is_public(client):
    # 登录页与设置页需要在未认证时读取 AI 配置状态
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    assert "ai_configured" in response.json()


def test_all_v1_endpoints_require_auth(client):
    paths = [
        ("GET", "/api/v1/templates"),
        ("POST", "/api/v1/specs/from-prompt"),
        ("POST", "/api/v1/datasets"),
        ("GET", "/api/v1/datasets/1"),
        ("GET", "/api/v1/datasets/1/summary"),
        ("GET", "/api/v1/datasets/1/cis"),
        ("GET", "/api/v1/datasets/1/relations"),
        ("GET", "/api/v1/datasets/1/export?format=json"),
        ("DELETE", "/api/v1/datasets/1"),
    ]
    for method, path in paths:
        response = client.request(method, path)
        assert response.status_code == 401, f"{method} {path} 未要求认证"
