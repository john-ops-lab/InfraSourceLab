"""确定性生成器测试：覆盖方向、去重、自环、引用完整性、万级冒烟。"""

import pytest

from app.generators.engine import generate_dataset
from app.specs.models import parse_and_validate


def make_spec(ci_types, relations, seed=7) -> dict:
    return {
        "name": "生成器测试",
        "seed": seed,
        "ci_types": ci_types,
        "relations": relations,
    }


def test_determinism_same_seed():
    raw = make_spec(
        ci_types=[
            {"type": "physical_server", "count": 30},
            {"type": "virtual_machine", "count": 80},
        ],
        relations=[
            {"type": "runs_on", "from_type": "virtual_machine",
             "to_type": "physical_server", "strategy": "balanced", "coverage": "from"},
        ],
    )
    first = generate_dataset(parse_and_validate(raw))
    second = generate_dataset(parse_and_validate(raw))

    assert [ci.id for ci in first.cis] == [ci.id for ci in second.cis]
    assert [ci.attributes for ci in first.cis] == [ci.attributes for ci in second.cis]
    assert [(r.type, r.from_id, r.to_id) for r in first.relations] == [
        (r.type, r.from_id, r.to_id) for r in second.relations
    ]


def test_different_seed_changes_data():
    raw = make_spec(
        ci_types=[{"type": "virtual_machine", "count": 10}],
        relations=[],
        seed=1,
    )
    other = dict(raw, seed=2)
    first = generate_dataset(parse_and_validate(raw))
    second = generate_dataset(parse_and_validate(other))
    assert [ci.attributes for ci in first.cis] != [ci.attributes for ci in second.cis]


def test_coverage_from_gives_every_source_one_edge():
    raw = make_spec(
        ci_types=[
            {"type": "physical_server", "count": 10},
            {"type": "virtual_machine", "count": 50},
        ],
        relations=[
            {"type": "runs_on", "from_type": "virtual_machine",
             "to_type": "physical_server", "strategy": "balanced", "coverage": "from"},
        ],
    )
    result = generate_dataset(parse_and_validate(raw))
    sources = {rel.from_id for rel in result.relations}
    vm_ids = {ci.id for ci in result.cis if ci.type == "virtual_machine"}
    assert sources == vm_ids
    assert len(result.relations) == 50


def test_coverage_to_gives_every_target_one_edge():
    raw = make_spec(
        ci_types=[
            {"type": "data_center", "count": 3},
            {"type": "rack", "count": 25},
        ],
        relations=[
            {"type": "contains", "from_type": "data_center", "to_type": "rack",
             "strategy": "random_seeded", "coverage": "to"},
        ],
    )
    result = generate_dataset(parse_and_validate(raw))
    targets = {rel.to_id for rel in result.relations}
    rack_ids = {ci.id for ci in result.cis if ci.type == "rack"}
    assert targets == rack_ids
    assert len(result.relations) == 25


def test_balanced_distributes_evenly():
    raw = make_spec(
        ci_types=[
            {"type": "data_center", "count": 2},
            {"type": "rack", "count": 10},
        ],
        relations=[
            {"type": "contains", "from_type": "data_center", "to_type": "rack",
             "strategy": "balanced", "coverage": "to"},
        ],
    )
    result = generate_dataset(parse_and_validate(raw))
    per_source = {}
    for rel in result.relations:
        per_source[rel.from_id] = per_source.get(rel.from_id, 0) + 1
    assert sorted(per_source.values()) == [5, 5]


def test_no_self_loops_for_same_type_relation():
    raw = make_spec(
        ci_types=[{"type": "application", "count": 12}],
        relations=[
            {"type": "depends_on", "from_type": "application",
             "to_type": "application", "strategy": "random_seeded", "coverage": "from"},
        ],
    )
    result = generate_dataset(parse_and_validate(raw))
    assert len(result.relations) == 12
    for rel in result.relations:
        assert rel.from_id != rel.to_id


def test_accidental_duplicate_edges_deduped_with_warning():
    # 两条不同规则可能生成同一条边：随机策略下同类型同方向的两条规则
    raw = make_spec(
        ci_types=[
            {"type": "application", "count": 4},
            {"type": "database", "count": 2},
        ],
        relations=[
            {"type": "uses", "from_type": "application", "to_type": "database",
             "strategy": "balanced", "coverage": "from"},
            {"type": "depends_on", "from_type": "application", "to_type": "database",
             "strategy": "balanced", "coverage": "from"},
        ],
    )
    # balanced 下两条规则会生成完全相同的边集合（类型不同不算重复边），
    # 因此这里构造同类型同规则参数不同 coverage 的场景：
    raw["relations"] = [
        {"type": "uses", "from_type": "application", "to_type": "database",
         "strategy": "balanced", "coverage": "from"},
        {"type": "uses", "from_type": "application", "to_type": "database",
         "strategy": "random_seeded", "coverage": "from"},
    ]
    result = generate_dataset(parse_and_validate(raw))
    edges = [(rel.type, rel.from_id, rel.to_id) for rel in result.relations]
    assert len(edges) == len(set(edges)), "重复边必须被去重"
    assert any("重复边" in warning for warning in result.warnings)
    # coverage=from 至少保证每个起点一条出边
    sources = {rel.from_id for rel in result.relations if rel.type == "uses"}
    assert sources == {ci.id for ci in result.cis if ci.type == "application"}


def test_relation_referential_integrity():
    raw = make_spec(
        ci_types=[
            {"type": "rack", "count": 5},
            {"type": "physical_server", "count": 20},
            {"type": "virtual_machine", "count": 40},
        ],
        relations=[
            {"type": "mounted_in", "from_type": "physical_server", "to_type": "rack",
             "strategy": "random_seeded", "coverage": "from"},
            {"type": "runs_on", "from_type": "virtual_machine", "to_type": "physical_server",
             "strategy": "random_seeded", "coverage": "from"},
        ],
    )
    result = generate_dataset(parse_and_validate(raw))
    all_ids = {ci.id for ci in result.cis}
    for rel in result.relations:
        assert rel.from_id in all_ids
        assert rel.to_id in all_ids


def test_ten_thousand_record_smoke():
    raw = make_spec(
        ci_types=[
            {"type": "physical_server", "count": 2_000},
            {"type": "virtual_machine", "count": 7_000},
            {"type": "application", "count": 1_000},
        ],
        relations=[
            {"type": "runs_on", "from_type": "virtual_machine", "to_type": "physical_server",
             "strategy": "balanced", "coverage": "from"},
            {"type": "hosted_on", "from_type": "application", "to_type": "virtual_machine",
             "strategy": "random_seeded", "coverage": "from"},
        ],
    )
    result = generate_dataset(parse_and_validate(raw))
    assert len(result.cis) == 10_000
    assert len(result.relations) == 7_000 + 1_000
    assert all(ci.search_text for ci in result.cis)


def test_search_text_only_whitelist_fields():
    raw = make_spec(
        ci_types=[{"type": "physical_server", "count": 3}],
        relations=[],
    )
    result = generate_dataset(parse_and_validate(raw))
    ci = result.cis[0]
    assert ci.id in ci.search_text
    assert ci.name in ci.search_text
    assert ci.attributes["hostname"].lower() in ci.search_text
    assert ci.attributes["management_ip"] in ci.search_text
    assert ci.attributes["serial_number"].lower() in ci.search_text
    # 非白名单字段不得进入 search_text
    assert ci.attributes["vendor"] not in ci.search_text
    assert ci.attributes["os_name"] not in ci.search_text
    assert ci.search_text == ci.search_text.lower()


def test_name_prefix_override():
    raw = make_spec(
        ci_types=[{"type": "application", "count": 2, "overrides": {"name_prefix": "team-a"}}],
        relations=[],
    )
    result = generate_dataset(parse_and_validate(raw))
    assert all(ci.name.startswith("team-a-") for ci in result.cis)
