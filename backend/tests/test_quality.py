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
    assert result.quality_report == [
        {
            "kind": "missing_field",
            "ci_type": "physical_server",
            "field": "serial_number",
            "requested_count": 3,
            "affected_count": 3,
            "affected_ids": [ci.id for ci in missing],
        }
    ]


def test_missing_field_ratio_rounds_and_keeps_at_least_one():
    clean = generate_dataset(_spec_with())
    rack_keys = sorted(next(ci.attributes for ci in clean.cis if ci.type == "rack"))
    default_field = rack_keys[0]
    result = generate_dataset(_spec_with({"kind": "missing_field", "ci_type": "rack", "ratio": 0.25}))
    racks = [ci for ci in result.cis if ci.type == "rack"]
    affected = [ci for ci in racks if default_field not in ci.attributes]
    assert len(affected) == 1  # round(4 * 0.25) = 1
    assert any("缺失字段" in w for w in result.warnings)


def test_requested_count_is_not_silently_capped_to_available_records():
    spec = _spec_with(
        {
            "kind": "missing_field",
            "ci_type": "physical_server",
            "field": "serial_number",
            "count": 25,
        },
    )
    result = generate_dataset(spec)

    report = result.quality_report[0]
    assert report["requested_count"] == 25
    assert report["affected_count"] == 10
    assert len(report["affected_ids"]) == 10
    assert any("请求 25 条缺失字段，实际注入 10 条" in warning for warning in result.warnings)


def test_later_rule_reports_zero_when_an_earlier_rule_removed_every_target_field():
    spec = _spec_with(
        {
            "kind": "missing_field",
            "ci_type": "physical_server",
            "field": "status",
            "count": 10,
        },
        {
            "kind": "wrong_value",
            "ci_type": "physical_server",
            "field": "status",
            "count": 2,
        },
    )
    result = generate_dataset(spec)

    report = result.quality_report[1]
    assert report["requested_count"] == 2
    assert report["affected_count"] == 0
    assert report["affected_ids"] == []
    assert any("请求 2 条错误值，实际注入 0 条" in warning for warning in result.warnings)
    assert not any("已注入 2 条错误值" in warning for warning in result.warnings)


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
    assert drifted.quality_report[0]["affected_count"] == 4
    assert set(drifted.quality_report[0]["affected_ids"]) == {ci.id for ci in changed}


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
    report = result.quality_report[0]
    assert set(report["affected_ids"]) == added_ids
    assert set(report["source_by_duplicate_id"]) == added_ids
    assert set(report["source_by_duplicate_id"].values()) <= clean_ids


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
    assert result.quality_report[0]["applied_value"] == "unknown"
    assert set(result.quality_report[0]["affected_ids"]) == {ci.id for ci in broken}


def test_unknown_or_incompatible_defect_field_is_rejected_before_generation():
    for defect, expected in [
        (
            {"kind": "missing_field", "ci_type": "physical_server", "field": "not_a_field", "count": 3},
            "字段不存在",
        ),
        (
            {"kind": "case_drift", "ci_type": "physical_server", "field": "cpu_cores", "count": 3},
            "字符串字段",
        ),
        (
            {"kind": "duplicate_record", "ci_type": "physical_server", "field": "status", "count": 1},
            "不接受 field",
        ),
    ]:
        try:
            _spec_with(defect)
            raise AssertionError("无效缺陷字段应在生成前被拒绝")
        except SpecValidationError as exc:
            assert any(expected in item for item in exc.errors)


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
    report = response.json()["quality_report"]
    assert report[0]["affected_count"] == 2
    assert report[0]["field"] == "status"

    # CI 列表中的脏数据与警告一致
    cis = client.get(f"/api/v1/datasets/{dataset_id}/cis?type=physical_server", headers=auth)
    broken = [item for item in cis.json()["items"] if item["attributes"].get("status") == "unknown"]
    assert len(broken) == 2

    # 质量报告随数据集持久化，详情接口能精确列出同一批记录。
    detail = client.get(f"/api/v1/datasets/{dataset_id}", headers=auth).json()
    assert set(detail["quality_report"][0]["affected_ids"]) == {item["id"] for item in broken}
