"""覆盖默认 API Key、提示词配置、模型列表/连通性测试与 JSON 容错。"""

import pytest

from app.ai.provider import AIProviderError, _extract_json
from app.auth.token import DEFAULT_API_KEY
from conftest import TEST_KEY


def _login(client, username="admin", password="admin123"):
    return client.post("/api/v1/auth/login", json={"username": username, "password": password})


def _session_headers(client):
    token = _login(client).json()["token"]
    return {"Authorization": f"Bearer {token}"}


# ---------- 默认 API Key ----------


def test_default_api_key_grants_data_access(client):
    response = client.get(
        "/api/v1/datasets", headers={"Authorization": f"Bearer {DEFAULT_API_KEY}"}
    )
    assert response.status_code == 200


def test_env_api_key_still_works(client):
    response = client.get(
        "/api/v1/datasets", headers={"Authorization": f"Bearer {TEST_KEY}"}
    )
    assert response.status_code == 200


def test_status_exposes_default_api_key(client):
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    assert response.json()["default_api_key"] == DEFAULT_API_KEY


# ---------- 提示词配置 ----------


def test_prompt_config_roundtrip(client):
    headers = _session_headers(client)

    first = client.get("/api/v1/admin/ai-prompts", headers=headers)
    assert first.status_code == 200
    body = first.json()
    assert body["active"] == "default"
    assert body["default_prompt"].strip()

    to_custom = client.put(
        "/api/v1/admin/ai-prompts",
        headers=headers,
        json={"active": "custom", "custom_prompt": "你是自定义提示词。"},
    )
    assert to_custom.status_code == 200
    assert to_custom.json()["active"] == "custom"
    assert to_custom.json()["custom_prompt"] == "你是自定义提示词。"

    back_to_default = client.put(
        "/api/v1/admin/ai-prompts", headers=headers, json={"active": "default"}
    )
    assert back_to_default.status_code == 200
    # 切回默认后自定义内容保留，供再次切换
    assert back_to_default.json()["active"] == "default"
    assert back_to_default.json()["custom_prompt"] == "你是自定义提示词。"


def test_prompt_config_custom_empty_falls_back_at_provider_level(client):
    headers = _session_headers(client)
    response = client.put(
        "/api/v1/admin/ai-prompts",
        headers=headers,
        json={"active": "custom", "custom_prompt": "   "},
    )
    assert response.status_code == 200
    assert response.json()["custom_prompt"] == ""


def test_prompt_config_rejects_invalid_active(client):
    headers = _session_headers(client)
    response = client.put(
        "/api/v1/admin/ai-prompts", headers=headers, json={"active": "weird"}
    )
    assert response.status_code == 422


def test_prompt_config_forbidden_for_api_key(client):
    response = client.get(
        "/api/v1/admin/ai-prompts", headers={"Authorization": f"Bearer {TEST_KEY}"}
    )
    assert response.status_code == 403


# ---------- 模型列表 / 连通性测试（FakeProvider 视为未配置）----------


def test_list_models_unconfigured_returns_503(client):
    headers = _session_headers(client)
    response = client.get("/api/v1/admin/ai-config/models", headers=headers)
    assert response.status_code == 503


def test_connection_unconfigured_reports_not_ok(client):
    headers = _session_headers(client)
    response = client.post("/api/v1/admin/ai-config/test", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert body["message"]


def test_models_and_test_forbidden_for_api_key(client):
    headers = {"Authorization": f"Bearer {TEST_KEY}"}
    assert client.get("/api/v1/admin/ai-config/models", headers=headers).status_code == 403
    assert client.post("/api/v1/admin/ai-config/test", headers=headers).status_code == 403


# ---------- AI 返回 JSON 容错 ----------


def test_extract_json_plain_object():
    assert _extract_json('{"name": "x"}') == {"name": "x"}


def test_extract_json_with_surrounding_text():
    content = '好的，以下是建议：{"name": "x", "ci_types": []} 请查收。'
    assert _extract_json(content) == {"name": "x", "ci_types": []}


def test_extract_json_markdown_fence():
    content = '```json\n{"name": "x"}\n```'
    assert _extract_json(content) == {"name": "x"}


def test_extract_json_rejects_garbage():
    with pytest.raises(AIProviderError):
        _extract_json("抱歉，我无法生成内容。")


def test_extract_json_rejects_top_level_array():
    with pytest.raises(AIProviderError):
        _extract_json("[1, 2, 3]")
