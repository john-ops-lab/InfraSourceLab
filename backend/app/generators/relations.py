"""关系生成：固定语义 strategy、coverage 与每对象连接数。

- coverage=from：每个起点 CI 生成 min_links~max_links 条出边；
- coverage=to：每个终点 CI 生成 min_links~max_links 条入边；
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
    """为被覆盖一侧的每个 CI 选择若干唯一对象，返回边列表。"""
    edges: list[tuple[str, str]] = []
    other_count = len(other_ids)
    other_positions = {item: index for index, item in enumerate(other_ids)}
    link_range = rel.max_links - rel.min_links + 1

    for index, covered in enumerate(covered_ids):
        available_count = other_count - (1 if covered in other_positions else 0)
        if available_count <= 0:
            continue

        if rel.strategy == "balanced":
            link_count = rel.min_links + (index % link_range)
            chosen_ids: list[str] = []
            cursor = index % other_count
            while len(chosen_ids) < link_count:
                chosen = other_ids[cursor]
                cursor = (cursor + 1) % other_count
                if chosen != covered and chosen not in chosen_ids:
                    chosen_ids.append(chosen)
        else:
            link_count = rng.randint(rel.min_links, rel.max_links)
            excluded_position = other_positions.get(covered)
            sampled_positions = rng.sample(range(available_count), link_count)
            if excluded_position is not None:
                sampled_positions = [
                    position + 1 if position >= excluded_position else position
                    for position in sampled_positions
                ]
            chosen_ids = [other_ids[position] for position in sampled_positions]

        for chosen in chosen_ids:
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

        rng = random.Random(
            f"{spec.seed}:rel:{rel.type}:{rel.from_type}:{rel.to_type}:"
            f"{rel.strategy}:{rel.coverage}:{rel.min_links}:{rel.max_links}"
        )
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
                f"（{rel.strategy}/{rel.coverage}，{rel.min_links}~{rel.max_links} 条）"
                f"生成时与其他规则产生 {dropped} 条重复边，已去重。"
            )

    return RelationResult(relations=relations, warnings=warnings)
