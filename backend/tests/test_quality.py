"""数据质量缺陷（Issue #2）：确定性、四种缺陷语义与规格校验。"""

from app.generators.engine import generate_dataset
from app.specs.models import SpecValidationError, parse_and_validate

BASE = {
    "name": "质量缺陷测试",
    "description": "",
    "seed": 7,
    "ci_types": [
        {"type": "rack", "count": 4},
        {"type": "physical_server", "count": 10},
    ],
    "relations": [
        {"type": "mounted_in", "from_type": "physical_server", "to_type": "rack",
         "strategy": "balanced", "coverage": "from"},
    ],
}


def _spec_with(*defects):
    raw = dict(BASE)
    raw["quality_defects"] = list(defects)
    return parse_and_validate(raw)


def test_defects_are_deterministic_under_same_seed():
    spec = _spec_with({"kind": "missing_field", "ci_type": "physical_server", "count": 3})
    first = generate_dataset(spec)
    second = generate_dataset(spec)
    dump_a = [(c.id, c.name, sorted(c.attributes.items())) for c in first.cis]
    dump_b = [(c.id, c.name, sorted(c.attributes.items())) for c in second.cis]
    assert dump_a == dump_b
    assert first.warnings == second.warnings


def test_missing_field_removes_exactly_requested_count():
    spec = _spec_with(
        {"kind": "missing_field", "ci_type": "physical_server", "field": "serial_number", "count": 3}
    )
    result = generate_dataset(spec)
    servers = [ci for ci in result.cis if ci.type == "physical_server"]
    missing = [ci for ci in servers if "serial_number" not in ci.attributes]
    assert len(missing) == 3
    assert any("缺失字段" in w for w in result.warnings)


def test_missing_field_ratio_rounds_and_keeps_at_least_one():
    clean = generate_dataset(_spec_with())
    rack_keys = sorted(next(ci.attributes for ci in clean.cis if ci.type == "rack"))
    default_field = rack_keys[0]
    result = generate_dataset(_spec_with({"kind": "missing_field", "ci_type": "rack", "ratio": 0.25}))
    racks = [ci for ci in result.cis if ci.type == "rack"]
    affected = [ci for ci in racks if default_field not in ci.attributes]
    assert len(affected) == 1  # round(4 * 0.25) = 1
    assert any("缺失字段" in w for w in result.warnings)


def test_case_drift_changes_field_case():
    clean = generate_dataset(_spec_with())
    drifted = generate_dataset(
        _spec_with(
            {"kind": "case_drift", "ci_type": "physical_server", "field": "os_name", "count": 4}
        )
    )
    clean_values = {
        ci.id: ci.attributes["os_name"] for ci in clean.cis if ci.type == "physical_server"
    }
    changed = [
        ci for ci in drifted.cis
        if ci.type == "physical_server" and ci.attributes["os_name"] != clean_values[ci.id]
    ]
    # os_name 恒为混合大小写（如 Ubuntu 22.04 LTS），三种变换都产生可见漂移
    assert len(changed) == 4
    for ci in changed:
        assert ci.attributes["os_name"].lower() == clean_values[ci.id].lower()


def test_duplicate_record_adds_business_duplicates():
    clean = generate_dataset(_spec_with())
    clean_ids = {ci.id for ci in clean.cis if ci.type == "physical_server"}
    result = generate_dataset(
        _spec_with({"kind": "duplicate_record", "ci_type": "physical_server", "count": 2})
    )
    servers = [ci for ci in result.cis if ci.type == "physical_server"]
    assert len(servers) == 12
    names = [ci.name for ci in servers]
    duplicated = {name for name in names if names.count(name) > 1}
    assert len(duplicated) == 2
    # ID 必须唯一，业务字段相同
    assert len({ci.id for ci in servers}) == 12
    # 新增的重复记录不继承关系
    added_ids = {ci.id for ci in servers} - clean_ids
    assert len(added_ids) == 2
    for ci in servers:
        if ci.id in added_ids:
            assert ci.id in ci.search_text
    for rel in result.relations:
        assert rel.from_id not in added_ids and rel.to_id not in added_ids


def test_wrong_value_uses_known_invalid_mapping():
    result = generate_dataset(
        _spec_with({"kind": "wrong_value", "ci_type": "physical_server", "field": "status", "count": 2})
    )
    broken = [
        ci for ci in result.cis
        if ci.type == "physical_server" and ci.attributes.get("status") == "unknown"
    ]
    assert len(broken) == 2
    assert any("错误值" in w for w in result.warnings)


def test_defect_validation_rejects_bad_rules():
    # ratio 与 count 二选一
    try:
        _spec_with(
            {"kind": "missing_field", "ci_type": "rack", "ratio": 0.5, "count": 1}
        )
        raise AssertionError("应拒绝同时给出 ratio 与 count")
    except SpecValidationError as exc:
        assert any("二选一" in e for e in exc.errors)

    # 目标类型不存在
    try:
        _spec_with({"kind": "wrong_value", "ci_type": "application", "count": 1})
        raise AssertionError("应拒绝不存在的目标类型")
    except SpecValidationError as exc:
        assert any("缺陷目标类型不存在" in e for e in exc.errors)

    # 重复规则
    try:
        _spec_with(
            {"kind": "missing_field", "ci_type": "rack", "count": 1},
            {"kind": "missing_field", "ci_type": "rack", "count": 2},
        )
        raise AssertionError("应拒绝重复缺陷规则")
    except SpecValidationError as exc:
        assert any("重复的缺陷规则" in e for e in exc.errors)


def test_api_create_dataset_with_defects_keeps_data_consistent(client, auth):
    spec = dict(BASE)
    spec["name"] = "API 脏数据"
    spec["quality_defects"] = [
        {"kind": "wrong_value", "ci_type": "physical_server", "field": "status", "count": 2}
    ]
    response = client.post("/api/v1/datasets", json={"spec": spec}, headers=auth)
    assert response.status_code == 201, response.text
    dataset_id = response.json()["id"]
    assert any("错误值" in w for w in response.json()["warnings"])

    # CI 列表中的脏数据与警告一致
    cis = client.get(f"/api/v1/datasets/{dataset_id}/cis?type=physical_server", headers=auth)
    broken = [item for item in cis.json()["items"] if item["attributes"].get("status") == "unknown"]
    assert len(broken) == 2
