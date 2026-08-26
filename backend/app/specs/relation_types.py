"""关系类型注册表：内置默认清单、种子与 contains→contained_in 数据迁移。

关系方向统一约定（与拓扑「叶子→根」的展示方向一致）：
- child_to_parent：层级关系，from=子、to=父（如 rack contained_in data_center）；
- peer：平级关系，不参与拓扑分层，仅绘制连线。

历史包袱：早期版本存在 contains（from=父、to=子），与统一方向相反，
启动时通过 _migrate_contains_to_contained_in 幂等迁移为 contained_in 并互换端点。
"""

import json
import logging

from sqlalchemy.orm import Session

from ..db.models import AppSetting, CIRelation, Dataset, RelationType

logger = logging.getLogger("infrasourcelab")

SEED_MARKER_KEY = "relation_types_seeded"

# (type, name_zh, name_en, direction)：业界 CMDB 常见关系清单
DEFAULT_RELATION_TYPES: list[tuple[str, str, str, str]] = [
    ("contained_in", "包含于", "contained_in", "child_to_parent"),
    ("mounted_in", "安装于", "mounted_in", "child_to_parent"),
    ("runs_on", "运行于", "runs_on", "child_to_parent"),
    ("hosted_on", "托管于", "hosted_on", "child_to_parent"),
    ("deployed_on", "部署于", "deployed_on", "child_to_parent"),
    ("belongs_to", "隶属于", "belongs_to", "child_to_parent"),
    ("depends_on", "依赖于", "depends_on", "peer"),
    ("uses", "使用", "uses", "peer"),
    ("has_ip", "拥有 IP", "has_ip", "peer"),
    ("connected_to", "连接至", "connected_to", "peer"),
    ("owned_by", "归属于", "owned_by", "peer"),
    ("manages", "管理", "manages", "peer"),
    ("provides", "提供服务", "provides", "peer"),
    ("consumes", "消费服务", "consumes", "peer"),
    ("backup_of", "备份于", "backup_of", "peer"),
]


def seed_relation_types(session: Session) -> None:
    """首次启动种入内置关系类型；用 AppSetting 标记保证删空后不会被重新种入。"""
    seeded = session.get(AppSetting, SEED_MARKER_KEY)
    if seeded is not None:
        return
    existing = {row.type for row in session.query(RelationType).all()}
    added = 0
    for type_, name_zh, name_en, direction in DEFAULT_RELATION_TYPES:
        if type_ in existing:
            continue
        session.add(
            RelationType(
                type=type_,
                name_zh=name_zh,
                name_en=name_en,
                direction=direction,
                is_builtin=True,
            )
        )
        added += 1
    session.add(AppSetting(key=SEED_MARKER_KEY, value="1"))
    session.commit()
    if added:
        logger.info("已种入 %d 个内置关系类型。", added)


def list_relation_types(session: Session) -> list[RelationType]:
    return session.query(RelationType).order_by(RelationType.direction, RelationType.type).all()


def relation_type_map(session: Session) -> dict[str, RelationType]:
    return {row.type: row for row in session.query(RelationType).all()}


def migrate_contains_to_contained_in(session: Session) -> int:
    """幂等迁移：contains（from=父→to=子）→ contained_in（from=子→to=父），端点互换。

    覆盖关系实例表与数据集规格 JSON 两处；迁移后拓扑展示方向与数据方向一致。
    返回迁移的规格条数（关系实例行数另记日志）。
    """
    edge_rows = session.query(CIRelation).filter(CIRelation.type == "contains").all()
    existing_keys = {
        (row.dataset_id, row.type, row.from_ci_id, row.to_ci_id)
        for row in session.query(
            CIRelation.dataset_id, CIRelation.type, CIRelation.from_ci_id, CIRelation.to_ci_id
        ).filter(CIRelation.type == "contained_in")
    }
    dropped = 0
    for row in edge_rows:
        # 互换后的目标键若已存在（历史上同时存在正反两条），丢弃源行避免撞唯一约束
        target_key = (row.dataset_id, "contained_in", row.to_ci_id, row.from_ci_id)
        if target_key in existing_keys:
            session.delete(row)
            dropped += 1
            continue
        row.type = "contained_in"
        row.from_ci_id, row.to_ci_id = row.to_ci_id, row.from_ci_id
        existing_keys.add((row.dataset_id, "contained_in", row.from_ci_id, row.to_ci_id))

    migrated_specs = 0
    for dataset in session.query(Dataset).all():
        try:
            spec = json.loads(dataset.generation_spec_json)
        except (TypeError, ValueError):
            continue
        relations = spec.get("relations")
        if not isinstance(relations, list):
            continue
        changed = False
        for rel in relations:
            if isinstance(rel, dict) and rel.get("type") == "contains":
                rel["type"] = "contained_in"
                rel["from_type"], rel["to_type"] = rel.get("to_type"), rel.get("from_type")
                # 端点互换后覆盖方向随之翻转：原 coverage=to（覆盖每个子级）→ from，反之亦然
                if rel.get("coverage") == "to":
                    rel["coverage"] = "from"
                elif rel.get("coverage") == "from":
                    rel["coverage"] = "to"
                changed = True
                migrated_specs += 1
        if changed:
            dataset.generation_spec_json = json.dumps(spec, ensure_ascii=False)

    if edge_rows or migrated_specs:
        session.commit()
        logger.info(
            "contains→contained_in 迁移完成：%d 条关系实例（丢弃重复 %d）、%d 条规格条目。",
            len(edge_rows),
            dropped,
            migrated_specs,
        )
    return migrated_specs
