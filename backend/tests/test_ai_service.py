"""覆盖默认 API Key、提示词配置、模型列表/连通性测试与 JSON 容错。"""

import pytest

from app.ai.provider import AIProviderError, _extract_json, build_default_system_prompt
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


def test_default_system_prompt_explains_attribute_guarantee():
    prompt = build_default_system_prompt()

    assert "至少 10 个业务属性" in prompt
    assert "不含顶层 id、name、type 和 tags" in prompt
    assert "不要自行添加 fields 或 attributes" in prompt


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


def test_extract_json_prefers_final_spec_after_thinking_draft():
    # 混合推理模型：思考文字 + 草稿 JSON（无 spec）+ 最终 JSON（含 spec）
    content = (
        "用户需要 2 个机柜。先考虑：{\"count\": 2, \"type\": \"rack\"}\n"
        "关系用 mounted_in。最终方案：\n"
        "{\"message\": \"生成 2 机柜 6 服务器\", \"spec\": {\"name\": \"x\"}, \"warnings\": []}"
    )
    assert _extract_json(content) == {
        "message": "生成 2 机柜 6 服务器",
        "spec": {"name": "x"},
        "warnings": [],
    }


def test_extract_json_prefers_last_object_with_spec():
    content = '{"spec": {"name": "draft"}} 补充说明 {"spec": {"name": "final"}}'
    assert _extract_json(content)["spec"] == {"name": "final"}


def test_extract_json_falls_back_to_last_complete_object():
    # 无任何含 spec 的对象时，取最后一个完整对象，避免直接拒识
    content = '草稿 {"a": 1} 最终 {"b": 2}'
    assert _extract_json(content) == {"b": 2}


def test_extract_json_error_includes_preview():
    with pytest.raises(AIProviderError, match="内容开头"):
        _extract_json("抱歉，我无法生成内容。")
