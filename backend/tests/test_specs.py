"""GenerationSpec 模型与语义校验测试。"""

import pytest

from app.specs.models import (
    BUILTIN_RELATION_TYPES,
    SpecValidationError,
    parse_and_validate,
)


def base_spec(**overrides) -> dict:
    spec = {
        "name": "测试数据集",
        "seed": 1,
        "ci_types": [
            {"type": "data_center", "count": 2},
            {"type": "rack", "count": 10},
        ],
        "relations": [
            {"type": "contained_in", "from_type": "rack", "to_type": "data_center",
             "strategy": "balanced", "coverage": "from"},
        ],
    }
    spec.update(overrides)
    return spec


def test_valid_spec_passes():
    spec = parse_and_validate(base_spec())
    assert spec.name == "测试数据集"
    assert len(spec.relations) == 1


def test_all_builtin_relation_types_accepted():
    """全部内置关系类型（含扩充的 connected_to/owned_by 等）均能通过校验并参与生成。"""
    raw = {
        "name": "全关系类型",
        "seed": 7,
        "ci_types": [
            {"type": "data_center", "count": 1},
            {"type": "rack", "count": 2},
        ],
        "relations": [
            {"type": rel_type, "from_type": from_type, "to_type": to_type,
             "strategy": "balanced", "coverage": "from"}
            for rel_type in BUILTIN_RELATION_TYPES
            for from_type, to_type in [("rack", "data_center")]
        ],
    }
    spec = parse_and_validate(raw)
    assert len(spec.relations) == len(BUILTIN_RELATION_TYPES)


def test_unknown_ci_type_rejected():
    raw = base_spec()
    raw["ci_types"].append({"type": "starship", "count": 1})
    with pytest.raises(SpecValidationError) as excinfo:
        parse_and_validate(raw)
    assert any("未知 CI 类型" in item for item in excinfo.value.errors)


def test_count_limits():
    raw = base_spec()
    raw["ci_types"][0]["count"] = 100_000
    with pytest.raises(SpecValidationError):
        parse_and_validate(raw)

    raw = base_spec()
    raw["ci_types"][0]["count"] = 20_000
    raw["ci_types"][1]["count"] = 20_000
    with pytest.raises(SpecValidationError) as excinfo:
        parse_and_validate(raw)
    assert any("总量" in item for item in excinfo.value.errors)


def test_zero_total_rejected():
    raw = base_spec(ci_types=[{"type": "rack", "count": 0}])
    with pytest.raises(SpecValidationError) as excinfo:
        parse_and_validate(raw)
    assert any("数量大于 0" in item for item in excinfo.value.errors)


def test_relation_endpoint_missing():
    raw = base_spec()
    raw["relations"][0]["to_type"] = "application"
    with pytest.raises(SpecValidationError) as excinfo:
        parse_and_validate(raw)
    assert any("终点类型不存在" in item for item in excinfo.value.errors)


def test_duplicate_relation_spec_rejected():
    raw = base_spec()
    raw["relations"].append(dict(raw["relations"][0]))
    with pytest.raises(SpecValidationError) as excinfo:
        parse_and_validate(raw)
    assert any("重复的关系规格" in item for item in excinfo.value.errors)


def test_invalid_strategy_and_coverage_rejected():
    raw = base_spec()
    raw["relations"][0]["strategy"] = "round_robin"
    with pytest.raises(SpecValidationError):
        parse_and_validate(raw)

    raw = base_spec()
    raw["relations"][0]["coverage"] = "both"
    with pytest.raises(SpecValidationError):
        parse_and_validate(raw)


def test_same_type_relation_with_single_ci_rejected():
    raw = base_spec(
        ci_types=[{"type": "application", "count": 1}],
        relations=[{"type": "depends_on", "from_type": "application",
                    "to_type": "application", "strategy": "random_seeded",
                    "coverage": "from"}],
    )
    with pytest.raises(SpecValidationError) as excinfo:
        parse_and_validate(raw)
    assert any("自环" in item for item in excinfo.value.errors)


def test_unknown_override_param_diagnosed():
    raw = base_spec()
    raw["ci_types"][0]["overrides"] = {"color": "red"}
    with pytest.raises(SpecValidationError) as excinfo:
        parse_and_validate(raw)
    assert any("不支持的覆盖参数" in item for item in excinfo.value.errors)


def test_zero_count_types_normalized_away():
    raw = base_spec()
    raw["ci_types"].append({"type": "application", "count": 0})
    spec = parse_and_validate(raw)
    assert [entry.type for entry in spec.ci_types] == ["data_center", "rack"]
