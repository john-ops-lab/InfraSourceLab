"""两步 API 主流程：规格建议不创建数据集，确认后的规格才创建。"""

import pytest

from app.ai.provider import AIProviderError
from conftest import FakeProvider, default_proposal, make_settings

from app.main import create_app


def test_from_prompt_returns_validated_spec_without_creating_dataset(client, auth, app_env):
    response = client.post(
        "/api/v1/specs/from-prompt",
        headers=auth,
        json={"prompt": "生成一个数据中心和几台服务器"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["message"]
    assert body["spec"]["ci_types"]
    assert body["warnings"]

    # 规格建议阶段不得创建数据集
    datasets = client.get("/api/v1/datasets", headers=auth).json()
    assert datasets["total"] == 0


def test_empty_prompt_rejected(client, auth):
    response = client.post(
        "/api/v1/specs/from-prompt", headers=auth, json={"prompt": "   "}
    )
    assert response.status_code == 422


def test_ai_invalid_spec_reported(tmp_path):
    provider = FakeProvider(
        error=AIProviderError("AI 返回的规格未通过服务端校验：关系起点类型不存在")
    )
    app = create_app(make_settings(tmp_path), ai_provider=provider)
    from fastapi.testclient import TestClient

    with TestClient(app) as test_client:
        response = test_client.post(
            "/api/v1/specs/from-prompt",
            headers={"Authorization": "Bearer test-api-key-123"},
            json={"prompt": "随便生成一点数据"},
        )
    assert response.status_code == 422
    assert "校验" in response.text


def test_ai_not_configured_returns_actionable_error(tmp_path):
    # 默认 Provider 在无 AI 环境变量时抛出 AINotConfigured
    app = create_app(make_settings(tmp_path))
    from fastapi.testclient import TestClient

    with TestClient(app) as test_client:
        response = test_client.post(
            "/api/v1/specs/from-prompt",
            headers={"Authorization": "Bearer test-api-key-123"},
            json={"prompt": "生成数据"},
        )
    assert response.status_code == 503
    assert "模板" in response.text


def test_create_dataset_with_confirmed_spec(client, auth):
    proposal = default_proposal()
    response = client.post(
        "/api/v1/datasets",
        headers=auth,
        json={"spec": proposal.spec, "prompt": "原始提示词"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["record_count"] == 1 + 4 + 8 + 16
    assert body["relation_count"] == 4 + 8 + 16
    assert body["warnings"] == []
    assert body["spec"]["seed"] == 42

    dataset_id = body["id"]

    # 详情与摘要
    detail = client.get(f"/api/v1/datasets/{dataset_id}", headers=auth).json()
    assert detail["name"] == "假 Provider 数据集"
    summary = client.get(f"/api/v1/datasets/{dataset_id}/summary", headers=auth).json()
    assert summary["ci_counts_by_type"]["virtual_machine"] == 16
    assert summary["relation_counts_by_type"]["runs_on"] == 16


def test_create_dataset_rejects_invalid_spec(client, auth):
    response = client.post(
        "/api/v1/datasets",
        headers=auth,
        json={"spec": {"name": "x", "seed": 1, "ci_types": [{"type": "ghost", "count": 1}]}},
    )
    assert response.status_code == 422
    assert "未知 CI 类型" in response.text


def test_template_flow_without_ai(tmp_path):
    """AI 未配置时，模板仍可创建数据集。"""
    app = create_app(make_settings(tmp_path))  # 真 Provider，未配置
    from fastapi.testclient import TestClient

    headers = {"Authorization": "Bearer test-api-key-123"}
    with TestClient(app) as test_client:
        templates = test_client.get("/api/v1/templates", headers=headers).json()
        assert templates["templates"]
        template_spec = templates["templates"][0]["spec"]

        response = test_client.post(
            "/api/v1/datasets", headers=headers, json={"spec": template_spec}
        )
        assert response.status_code == 201
        assert response.json()["record_count"] > 0


def test_dataset_list_pagination_and_delete(client, auth):
    proposal = default_proposal()
    for _ in range(3):
        client.post("/api/v1/datasets", headers=auth, json={"spec": proposal.spec})

    page = client.get(
        "/api/v1/datasets", headers=auth, params={"page": 1, "page_size": 2}
    ).json()
    assert page["total"] == 3
    assert len(page["items"]) == 2

    dataset_id = page["items"][0]["id"]
    response = client.delete(f"/api/v1/datasets/{dataset_id}", headers=auth)
    assert response.status_code == 204

    remaining = client.get("/api/v1/datasets", headers=auth).json()
    assert remaining["total"] == 2

    # CI 与关系一并删除
    response = client.get(f"/api/v1/datasets/{dataset_id}", headers=auth)
    assert response.status_code == 404


def test_page_size_upper_bound(client, auth):
    response = client.get(
        "/api/v1/datasets", headers=auth, params={"page_size": 10_000}
    )
    assert response.status_code == 422
