"""数据集服务：创建、查询、删除。

创建流程：校验规格 → 生成记录和关系 → 校验引用完整性与去重
→ 在单个事务中持久化 → 数据集变为可读取状态。
失败时回滚，不留下“看起来成功但数据不完整”的数据集。
"""

import json

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..db.models import CIRecord, CIRelation, Dataset
from ..generators.engine import GENERATOR_VERSION, generate_dataset
from ..specs.models import GenerationSpec


class DatasetNotFound(LookupError):
    pass


def escape_like(text: str) -> str:
    """把 LIKE 通配符转义为普通文字。"""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def create_dataset(session: Session, spec: GenerationSpec, prompt: str = "") -> Dataset:
    """生成并持久化数据集；任何一步失败都整体回滚。"""
    result = generate_dataset(spec)

    dataset = Dataset(
        name=spec.name,
        description=spec.description,
        prompt=prompt,
        generation_spec_json=json.dumps(spec.model_dump(mode="json"), ensure_ascii=False),
        seed=spec.seed,
        generator_version=GENERATOR_VERSION,
        record_count=len(result.cis),
        relation_count=len(result.relations),
        warnings_json=json.dumps(result.warnings, ensure_ascii=False),
        quality_report_json=json.dumps(result.quality_report, ensure_ascii=False),
    )
    try:
        session.add(dataset)
        session.flush()

        session.add_all(
        [
            CIRecord(
                dataset_id=dataset.id,
                ci_id=ci.id,
                type=ci.type,
                name=ci.name,
                attributes_json=json.dumps(ci.attributes, ensure_ascii=False),
                tags_json=json.dumps(ci.tags, ensure_ascii=False),
                search_text=ci.search_text,
            )
            for ci in result.cis
        ]
        )
        session.add_all(
            [
                CIRelation(
                    dataset_id=dataset.id,
                    relation_id=rel.id,
                    type=rel.type,
                    from_ci_id=rel.from_id,
                    to_ci_id=rel.to_id,
                    attributes_json=json.dumps(rel.attributes, ensure_ascii=False),
                )
                for rel in result.relations
            ]
        )
        session.flush()
        session.commit()
    except Exception:
        session.rollback()
        raise
    session.refresh(dataset)
    return dataset


def list_datasets(session: Session, q: str | None, page: int, page_size: int) -> dict:
    stmt = select(Dataset).order_by(Dataset.id.desc())
    if q:
        # 名称包含搜索，通配符按普通文字处理
        stmt = stmt.where(Dataset.name.like(f"%{escape_like(q)}%", escape="\\"))
    total = session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = session.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": list(rows), "page": page, "page_size": page_size, "total": int(total)}


def get_dataset(session: Session, dataset_id: int) -> Dataset:
    dataset = session.get(Dataset, dataset_id)
    if dataset is None:
        raise DatasetNotFound(dataset_id)
    return dataset


def delete_dataset(session: Session, dataset_id: int) -> None:
    dataset = get_dataset(session, dataset_id)
    session.execute(delete(CIRecord).where(CIRecord.dataset_id == dataset_id))
    session.execute(delete(CIRelation).where(CIRelation.dataset_id == dataset_id))
    session.delete(dataset)
    session.commit()


def dataset_summary(session: Session, dataset: Dataset) -> dict:
    ci_rows = session.execute(
        select(CIRecord.type, func.count())
        .where(CIRecord.dataset_id == dataset.id)
        .group_by(CIRecord.type)
    ).all()
    relation_rows = session.execute(
        select(CIRelation.type, func.count())
        .where(CIRelation.dataset_id == dataset.id)
        .group_by(CIRelation.type)
    ).all()
    return {
        "id": dataset.id,
        "name": dataset.name,
        "description": dataset.description,
        "prompt": dataset.prompt,
        "seed": dataset.seed,
        "generator_version": dataset.generator_version,
        "record_count": dataset.record_count,
        "relation_count": dataset.relation_count,
        "warnings": json.loads(dataset.warnings_json),
        "spec": json.loads(dataset.generation_spec_json),
        "ci_counts_by_type": {row[0]: row[1] for row in ci_rows},
        "relation_counts_by_type": {row[0]: row[1] for row in relation_rows},
        "created_at": dataset.created_at.isoformat() if dataset.created_at else None,
    }


def list_cis(
    session: Session,
    dataset_id: int,
    ci_type: str | None,
    q: str | None,
    page: int,
    page_size: int,
) -> dict:
    stmt = select(CIRecord).where(CIRecord.dataset_id == dataset_id)
    if ci_type:
        stmt = stmt.where(CIRecord.type == ci_type)
    if q:
        # q 只查询受控 search_text，通配符按普通文字处理
        stmt = stmt.where(CIRecord.search_text.like(f"%{escape_like(q.lower())}%", escape="\\"))
    stmt = stmt.order_by(CIRecord.ci_id)
    total = session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = session.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": list(rows), "page": page, "page_size": page_size, "total": int(total)}


def get_ci(session: Session, dataset_id: int, ci_id: str) -> CIRecord:
    row = session.scalar(
        select(CIRecord).where(CIRecord.dataset_id == dataset_id, CIRecord.ci_id == ci_id)
    )
    if row is None:
        raise DatasetNotFound(ci_id)
    return row


def list_relations(
    session: Session,
    dataset_id: int,
    relation_type: str | None,
    from_id: str | None,
    to_id: str | None,
    page: int,
    page_size: int,
) -> dict:
    stmt = select(CIRelation).where(CIRelation.dataset_id == dataset_id)
    if relation_type:
        stmt = stmt.where(CIRelation.type == relation_type)
    if from_id:
        stmt = stmt.where(CIRelation.from_ci_id == from_id)
    if to_id:
        stmt = stmt.where(CIRelation.to_ci_id == to_id)
    stmt = stmt.order_by(CIRelation.relation_id)
    total = session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = session.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": list(rows), "page": page, "page_size": page_size, "total": int(total)}


def iter_all_cis(session: Session, dataset_id: int, batch: int = 2000):
    offset = 0
    while True:
        rows = session.scalars(
            select(CIRecord)
            .where(CIRecord.dataset_id == dataset_id)
            .order_by(CIRecord.ci_id)
            .offset(offset)
            .limit(batch)
        ).all()
        if not rows:
            break
        yield from rows
        offset += batch


def iter_all_relations(session: Session, dataset_id: int, batch: int = 2000):
    offset = 0
    while True:
        rows = session.scalars(
            select(CIRelation)
            .where(CIRelation.dataset_id == dataset_id)
            .order_by(CIRelation.relation_id)
            .offset(offset)
            .limit(batch)
        ).all()
        if not rows:
            break
        yield from rows
        offset += batch
