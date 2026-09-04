"""关系类型注册表：种子、CRUD、删除引用保护、contains→contained_in 迁移、动态提示词。"""

import json

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.ai.provider import build_default_system_prompt
from app.db.models import CIRelation, Dataset
from app.specs.relation_types import DEFAULT_RELATION_TYPES, migrate_contains_to_contained_in


def _make_settings(tmp_path) -> Settings:
    return Settings(
        isl_api_key="test-api-key-123",
        isl_data_dir=tmp_path / "data",
        _env_file=None,
    )


def _admin_headers(client) -> dict:
    """管理接口需要管理员登录会话，API Key 不够。"""
    response = client.post(
        "/api/v1/auth/login", json={"username": "admin", "password": "admin123"}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_seeded_builtin_relation_types(client, auth):
    response = client.get("/api/v1/relation-types", headers=auth)
    assert response.status_code == 200
    items = response.json()
    seeded = {item["type"] for item in items}
    assert seeded == {row[0] for row in DEFAULT_RELATION_TYPES}
    assert "contained_in" in seeded and "contains" not in seeded
    # 层级关系的 direction 是 child_to_parent，平级是 peer
    by_type = {item["type"]: item for item in items}
    assert by_type["contained_in"]["direction"] == "child_to_parent"
    assert by_type["contained_in"]["name_zh"] == "包含于"
    assert by_type["uses"]["direction"] == "peer"


def test_admin_crud_roundtrip(client, auth):
    admin = _admin_headers(client)
    # 新增自定义关系
    created = client.post(
        "/api/v1/admin/relation-types",
        json={"type": "monitors", "name_zh": "监控", "name_en": "monitors", "direction": "peer"},
        headers=admin,
    )
    assert created.status_code == 201, created.text
    assert created.json()["is_builtin"] is False

    # 重复创建 → 409
    dup = client.post(
        "/api/v1/admin/relation-types",
        json={"type": "monitors", "name_zh": "监控", "name_en": "monitors", "direction": "peer"},
        headers=admin,
    )
    assert dup.status_code == 409

    # 修改内置关系的中英文名称
    updated = client.put(
        "/api/v1/admin/relation-types/runs_on",
        json={"name_zh": "跑在之上", "name_en": "runs on", "direction": "child_to_parent"},
        headers=admin,
    )
    assert updated.status_code == 200
    assert updated.json()["name_zh"] == "跑在之上"
    assert updated.json()["name_en"] == "runs on"

    # 列表可见修改
    items = client.get("/api/v1/relation-types", headers=auth).json()
    by_type = {item["type"]: item for item in items}
    assert by_type["monitors"]["name_zh"] == "监控"
    assert by_type["runs_on"]["name_zh"] == "跑在之上"

    # 未被引用的自定义关系可删除
    deleted = client.delete("/api/v1/admin/relation-types/monitors", headers=admin)
    assert deleted.status_code == 204
    items = client.get("/api/v1/relation-types", headers=auth).json()
    assert "monitors" not in {item["type"] for item in items}

    # 删除不存在的 → 404
    assert client.delete("/api/v1/admin/relation-types/monitors", headers=admin).status_code == 404


def test_delete_referenced_relation_type_rejected(client, auth):
    admin = _admin_headers(client)
    created = client.post(
        "/api/v1/datasets",
        json={
            "spec": {
                "name": "引用测试",
                "description": "",
                "seed": 5,
                "ci_types": [
                    {"type": "data_center", "count": 1},
                    {"type": "rack", "count": 3},
                ],
                "relations": [
                    {"type": "contained_in", "from_type": "rack", "to_type": "data_center",
                     "strategy": "balanced", "coverage": "from"},
                ],
            }
        },
        headers=auth,
    )
    assert created.status_code == 201, created.text

    # contained_in 被数据集规格引用 → 409
    blocked = client.delete("/api/v1/admin/relation-types/contained_in", headers=admin)
    assert blocked.status_code == 409
    assert "引用" in blocked.json()["detail"]


def test_delete_unreferenced_builtin_relation_type_rejected(client):
    admin = _admin_headers(client)

    blocked = client.delete("/api/v1/admin/relation-types/contained_in", headers=admin)

    assert blocked.status_code == 409
    assert "内置关系类型" in blocked.json()["detail"]


def test_custom_relation_type_accepted_in_spec(client, auth):
    admin = _admin_headers(client)
    client.post(
        "/api/v1/admin/relation-types",
        json={"type": "monitors", "name_zh": "监控", "name_en": "monitors", "direction": "peer"},
        headers=admin,
    )
    created = client.post(
        "/api/v1/datasets",
        json={
            "spec": {
                "name": "自定义关系测试",
                "description": "",
                "seed": 6,
                "ci_types": [
                    {"type": "application", "count": 3},
                    {"type": "middleware", "count": 2},
                ],
                "relations": [
                    {"type": "monitors", "from_type": "application", "to_type": "middleware",
                     "strategy": "balanced", "coverage": "from"},
                ],
            }
        },
        headers=auth,
    )
    assert created.status_code == 201, created.text

    # 未注册类型 → 422
    unknown = client.post(
        "/api/v1/datasets",
        json={
            "spec": {
                "name": "未知关系测试",
                "description": "",
                "seed": 6,
                "ci_types": [
                    {"type": "application", "count": 3},
                    {"type": "middleware", "count": 2},
                ],
                "relations": [
                    {"type": "teleports_to", "from_type": "application", "to_type": "middleware",
                     "strategy": "balanced", "coverage": "from"},
                ],
            }
        },
        headers=auth,
    )
    assert unknown.status_code == 422
    assert any("未知关系类型" in err for err in unknown.json()["detail"]["errors"])


def test_contains_data_migrated_on_startup(tmp_path):
    """老库中的 contains 数据（from=父→to=子）启动时被迁移为 contained_in 并互换端点。"""
    app = create_app(_make_settings(tmp_path))
    session_factory = app.state.session_factory

    # 第一次启动：建库 + 种子
    with session_factory() as session:
        assert session.query(CIRelation).count() == 0

    # 手工构造一份含 contains 的老数据（模拟升级前的库）
    with session_factory() as session:
        spec = {
            "name": "老数据集",
            "description": "",
            "seed": 1,
            "ci_types": [
                {"type": "data_center", "count": 1},
                {"type": "rack", "count": 2},
            ],
            "relations": [
                {"type": "contains", "from_type": "data_center", "to_type": "rack",
                 "strategy": "balanced", "coverage": "to"},
            ],
        }
        dataset = Dataset(
            name="老数据集",
            description="",
            prompt="",
            generation_spec_json=json.dumps(spec, ensure_ascii=False),
            seed=1,
            generator_version="1.1.0",
            record_count=3,
            relation_count=2,
        )
        session.add(dataset)
        session.flush()
        session.add_all(
            [
                CIRelation(dataset_id=dataset.id, relation_id="rel-000001", type="contains",
                           from_ci_id="dc-0001", to_ci_id="rack-0001"),
                CIRelation(dataset_id=dataset.id, relation_id="rel-000002", type="contains",
                           from_ci_id="dc-0001", to_ci_id="rack-0002"),
            ]
        )
        session.commit()

    # 再次启动：执行迁移
    create_app(_make_settings(tmp_path))

    with session_factory() as session:
        edges = session.query(CIRelation).all()
        assert all(edge.type == "contained_in" for edge in edges)
        # 端点已互换：from=子(rack)、to=父(dc)
        assert {(e.from_ci_id, e.to_ci_id) for e in edges} == {
            ("rack-0001", "dc-0001"),
            ("rack-0002", "dc-0001"),
        }
        migrated_spec = json.loads(session.query(Dataset).one().generation_spec_json)
        assert migrated_spec["relations"][0]["type"] == "contained_in"
        assert migrated_spec["relations"][0]["from_type"] == "rack"
        assert migrated_spec["relations"][0]["to_type"] == "data_center"
        # 端点互换后覆盖方向同步翻转：原 coverage=to（覆盖每个子级 rack）→ from
        assert migrated_spec["relations"][0]["coverage"] == "from"

    # 第三次启动：幂等，无 contains 可迁移
    with session_factory() as session:
        assert migrate_contains_to_contained_in(session) == 0


def test_default_prompt_contains_dynamic_relation_types(client, auth):
    admin = _admin_headers(client)
    response = client.get("/api/v1/admin/ai-prompts", headers=admin)
    assert response.status_code == 200
    prompt = response.json()["default_prompt"]
    # 动态清单包含方向与中文对照
    assert "contained_in=包含于（child_to_parent）" in prompt
    assert "contains" not in prompt
    assert "rack contained_in data_center" in prompt

    # 修改中文名后，提示词同步变化
    client.put(
        "/api/v1/admin/relation-types/runs_on",
        json={"name_zh": "跑在之上", "name_en": "runs_on", "direction": "child_to_parent"},
        headers=admin,
    )
    updated = client.get("/api/v1/admin/ai-prompts", headers=admin).json()["default_prompt"]
    assert "runs_on=跑在之上" in updated


def test_build_default_prompt_fallback_without_registry():
    prompt = build_default_system_prompt(None)
    assert "contained_in=包含于（child_to_parent）" in prompt
    assert "rack contained_in data_center" in prompt
