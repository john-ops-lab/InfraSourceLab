"""关系生成：固定语义 strategy=balanced|random_seeded，coverage=from|to。

- coverage=from：每个起点 CI 生成一条出边；
- coverage=to：每个终点 CI 生成一条入边；
- balanced：被选择的一侧尽量平均分配；
- random_seeded：基于 seed 可重复地选择连接对象；
- 默认不生成自环；
- 不同规则偶然生成同一条边时在生成阶段去重并产生 warning。
"""

import random
from dataclasses import dataclass, field

from ..specs.models import GenerationSpec, RelationSpec


@dataclass
class GeneratedRelation:
    id: str
    type: str
    from_id: str
    to_id: str
    attributes: dict = field(default_factory=dict)


@dataclass
class RelationResult:
    relations: list[GeneratedRelation]
    warnings: list[str]


def _relation_id(sequence: int) -> str:
    return f"rel-{sequence:06d}"


def _pick_targets(
    rel: RelationSpec,
    covered_ids: list[str],
    other_ids: list[str],
    covered_is_from: bool,
    rng: random.Random,
) -> list[tuple[str, str]]:
    """为被覆盖一侧的每个 CI 选择连接对象，返回 (from_id, to_id) 列表。"""
    edges: list[tuple[str, str]] = []
    other_count = len(other_ids)

    for index, covered in enumerate(covered_ids):
        if rel.strategy == "balanced":
            chosen = other_ids[index % other_count]
        else:
            chosen = other_ids[rng.randrange(other_count)]

        # 默认不生成自环：同类型关系中选中自己时顺延到下一个对象
        if chosen == covered and other_count > 1:
            position = other_ids.index(covered)
            chosen = other_ids[(position + 1) % other_count]
        if chosen == covered:
            continue  # 仅剩自己，无法避免自环，跳过（校验阶段通常已拦截）

        if covered_is_from:
            edges.append((covered, chosen))
        else:
            edges.append((chosen, covered))
    return edges


def generate_relations(
    spec: GenerationSpec,
    cis_by_type: dict[str, list[str]],
) -> RelationResult:
    warnings: list[str] = []
    seen_edges: set[tuple[str, str, str]] = set()
    relations: list[GeneratedRelation] = []

    for rel in spec.relations:
        from_ids = cis_by_type.get(rel.from_type, [])
        to_ids = cis_by_type.get(rel.to_type, [])
        if not from_ids or not to_ids:
            continue  # 规格校验已拦截，这里防御性跳过

        rng = random.Random(f"{spec.seed}:rel:{rel.type}:{rel.from_type}:{rel.to_type}")
        if rel.coverage == "from":
            edges = _pick_targets(rel, from_ids, to_ids, True, rng)
        else:
            edges = _pick_targets(rel, to_ids, from_ids, False, rng)

        dropped = 0
        for from_id, to_id in edges:
            key = (rel.type, from_id, to_id)
            if key in seen_edges:
                dropped += 1
                continue
            seen_edges.add(key)
            relations.append(
                GeneratedRelation(
                    id=_relation_id(len(relations) + 1),
                    type=rel.type,
                    from_id=from_id,
                    to_id=to_id,
                )
            )
        if dropped:
            warnings.append(
                f"关系规则 {rel.type}：{rel.from_type} → {rel.to_type}"
                f"（{rel.strategy}/{rel.coverage}）生成时与其他规则产生 {dropped} 条重复边，已去重。"
            )

    return RelationResult(relations=relations, warnings=warnings)
