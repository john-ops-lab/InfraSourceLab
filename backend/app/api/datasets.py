"""数据集路由：创建、列表、详情、删除、摘要、CI、关系、导出。

`POST /api/v1/datasets` 只接受用户最终确认后的 GenerationSpec；
AI 建议和内置模板都通过这个接口创建数据集。
"""

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth.token import require_auth
from ..datasets import service
from ..db.models import CIRelation, CIRecord, Dataset
from ..limits import (
    DEFAULT_PAGE_SIZE,
    DEFAULT_TOPOLOGY_NODES,
    MAX_PAGE_SIZE,
    MAX_PROMPT_LENGTH,
    MAX_QUERY_LENGTH,
    MAX_TOPOLOGY_NODES,
)
from ..specs.models import SpecValidationError, parse_and_validate
from ..specs.relation_types import relation_type_map
from .deps import get_session

router = APIRouter(prefix="/api/v1/datasets", tags=["数据集"], dependencies=[Depends(require_auth)])


class DatasetCreateRequest(BaseModel):
    spec: dict[str, Any]
    prompt: str = Field(default="", max_length=MAX_PROMPT_LENGTH)


def _dataset_payload(dataset: Dataset) -> dict:
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
        "created_at": dataset.created_at.isoformat() if dataset.created_at else None,
    }


def _dataset_detail_payload(dataset: Dataset) -> dict:
    payload = _dataset_payload(dataset)
    payload["spec"] = json.loads(dataset.generation_spec_json)
    payload["quality_report"] = json.loads(dataset.quality_report_json)
    return payload


def _ci_payload(record: CIRecord) -> dict:
    return {
        "id": record.ci_id,
        "type": record.type,
        "name": record.name,
        "attributes": json.loads(record.attributes_json),
        "tags": json.loads(record.tags_json),
    }


def _get_dataset_or_404(session: Session, dataset_id: int) -> Dataset:
    try:
        return service.get_dataset(session, dataset_id)
    except service.DatasetNotFound as exc:
        raise HTTPException(status_code=404, detail=f"数据集不存在：{dataset_id}") from exc


def _select_topology_node_ids(filtered_ids: list[str], relation_rows: list, limit: int) -> list[str]:
    """确定性抽样：优先保留完整关系端点，再按稳定 ID 顺序补足节点。"""
    if len(filtered_ids) <= limit:
        return filtered_ids

    eligible = set(filtered_ids)
    selected: list[str] = []
    selected_set: set[str] = set()

    for row in relation_rows:
        from_id, to_id = row[2], row[3]
        if from_id not in eligible or to_id not in eligible:
            continue
        missing = [node_id for node_id in (from_id, to_id) if node_id not in selected_set]
        if len(selected) + len(missing) > limit:
            continue
        for node_id in missing:
            selected.append(node_id)
            selected_set.add(node_id)
        if len(selected) == limit:
            return selected

    for node_id in filtered_ids:
        if node_id in selected_set:
            continue
        selected.append(node_id)
        if len(selected) == limit:
            break
    return selected


@router.post("", status_code=201)
def create_dataset(body: DatasetCreateRequest, session: Session = Depends(get_session)) -> dict:
    try:
        spec = parse_and_validate(body.spec, allowed_relation_types=set(relation_type_map(session)))
    except SpecValidationError as exc:
        raise HTTPException(status_code=422, detail={"errors": exc.errors}) from exc

    try:
        dataset = service.create_dataset(session, spec, prompt=body.prompt)
    except Exception as exc:
        # 生成或持久化失败时整体回滚，不留下伪成功数据集
        raise HTTPException(
            status_code=500, detail="数据集生成失败，已回滚，未创建任何数据。请调整规格后重试。"
        ) from exc
    return _dataset_detail_payload(dataset)


@router.get("")
def list_datasets(
    q: str | None = Query(default=None, max_length=MAX_QUERY_LENGTH),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    session: Session = Depends(get_session),
) -> dict:
    result = service.list_datasets(session, q, page, page_size)
    return {
        "items": [_dataset_payload(item) for item in result["items"]],
        "page": result["page"],
        "page_size": result["page_size"],
        "total": result["total"],
    }


@router.get("/{dataset_id}")
def get_dataset(dataset_id: int, session: Session = Depends(get_session)) -> dict:
    dataset = _get_dataset_or_404(session, dataset_id)
    return _dataset_detail_payload(dataset)


@router.delete("/{dataset_id}", status_code=204)
def delete_dataset(dataset_id: int, session: Session = Depends(get_session)) -> Response:
    try:
        service.delete_dataset(session, dataset_id)
    except service.DatasetNotFound as exc:
        raise HTTPException(status_code=404, detail=f"数据集不存在：{dataset_id}") from exc
    return Response(status_code=204)


@router.get("/{dataset_id}/summary")
def get_summary(dataset_id: int, session: Session = Depends(get_session)) -> dict:
    dataset = _get_dataset_or_404(session, dataset_id)
    return service.dataset_summary(session, dataset)


@router.get("/{dataset_id}/cis")
def list_cis(
    dataset_id: int,
    type: str | None = Query(default=None, max_length=40),
    q: str | None = Query(default=None, max_length=MAX_QUERY_LENGTH),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    session: Session = Depends(get_session),
) -> dict:
    _get_dataset_or_404(session, dataset_id)
    result = service.list_cis(session, dataset_id, type, q, page, page_size)
    return {
        "items": [_ci_payload(item) for item in result["items"]],
        "page": result["page"],
        "page_size": result["page_size"],
        "total": result["total"],
    }


@router.get("/{dataset_id}/cis/{ci_id}")
def get_ci(dataset_id: int, ci_id: str, session: Session = Depends(get_session)) -> dict:
    _get_dataset_or_404(session, dataset_id)
    try:
        record = service.get_ci(session, dataset_id, ci_id)
    except service.DatasetNotFound as exc:
        raise HTTPException(status_code=404, detail=f"CI 不存在：{ci_id}") from exc
    return _ci_payload(record)


@router.get("/{dataset_id}/relations")
def list_relations(
    dataset_id: int,
    type: str | None = Query(default=None, max_length=40),
    from_id: str | None = Query(default=None, max_length=80),
    to_id: str | None = Query(default=None, max_length=80),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    session: Session = Depends(get_session),
) -> dict:
    _get_dataset_or_404(session, dataset_id)
    result = service.list_relations(session, dataset_id, type, from_id, to_id, page, page_size)

    # 为端点补充类型和名称，方便界面直接展示
    endpoint_ids: set[str] = set()
    for item in result["items"]:
        endpoint_ids.add(item.from_ci_id)
        endpoint_ids.add(item.to_ci_id)
    endpoint_info: dict[str, tuple[str, str]] = {}
    if endpoint_ids:
        rows = session.execute(
            select(CIRecord.ci_id, CIRecord.type, CIRecord.name).where(
                CIRecord.dataset_id == dataset_id, CIRecord.ci_id.in_(endpoint_ids)
            )
        ).all()
        endpoint_info = {row[0]: (row[1], row[2]) for row in rows}

    items = []
    for item in result["items"]:
        from_info = endpoint_info.get(item.from_ci_id, ("", ""))
        to_info = endpoint_info.get(item.to_ci_id, ("", ""))
        items.append(
            {
                "id": item.relation_id,
                "type": item.type,
                "from_id": item.from_ci_id,
                "from_type": from_info[0],
                "from_name": from_info[1],
                "to_id": item.to_ci_id,
                "to_type": to_info[0],
                "to_name": to_info[1],
                "attributes": json.loads(item.attributes_json),
            }
        )
    return {
        "items": items,
        "page": result["page"],
        "page_size": result["page_size"],
        "total": result["total"],
    }


@router.get("/{dataset_id}/topology")
def get_topology(
    dataset_id: int,
    ci_type: str | None = Query(default=None, max_length=40),
    relation_type: str | None = Query(default=None, max_length=40),
    q: str | None = Query(default=None, max_length=MAX_QUERY_LENGTH),
    center: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=DEFAULT_TOPOLOGY_NODES, ge=1, le=MAX_TOPOLOGY_NODES),
    session: Session = Depends(get_session),
) -> dict:
    """简单拓扑：节点来自 ci_records、边来自 ci_relations（Issue #2）。

    有界返回：默认最多 200 个节点，超出时优先保留关系端点并标记 truncated；
    传 center 时返回该节点及其邻居（聚焦邻居）。
    """
    _get_dataset_or_404(session, dataset_id)

    keyword = q.strip().lower() if q else ""

    def matches(ci_id: str, name: str) -> bool:
        return not keyword or keyword in ci_id.lower() or keyword in name.lower()

    rows = session.execute(
        select(CIRecord.ci_id, CIRecord.type, CIRecord.name)
        .where(CIRecord.dataset_id == dataset_id)
        .order_by(CIRecord.ci_id)
    ).all()
    by_id = {row[0]: (row[1], row[2]) for row in rows}

    relation_stmt = (
        select(CIRelation.relation_id, CIRelation.type, CIRelation.from_ci_id, CIRelation.to_ci_id)
        .where(CIRelation.dataset_id == dataset_id)
        .order_by(CIRelation.relation_id)
    )
    if relation_type is not None:
        relation_stmt = relation_stmt.where(CIRelation.type == relation_type)
    rel_rows = session.execute(relation_stmt).all()

    if center is not None:
        if center not in by_id:
            raise HTTPException(status_code=404, detail=f"CI 不存在：{center}")
        neighbor_ids: set[str] = set()
        for row in rel_rows:
            if row[2] == center or row[3] == center:
                neighbor_ids.add(row[2])
                neighbor_ids.add(row[3])
        neighbor_ids.discard(center)
        node_ids = [center] + sorted(neighbor_ids)[: limit - 1]
        truncated = len(neighbor_ids) + 1 > limit
        total_nodes = len(neighbor_ids) + 1
    else:
        filtered = [
            row[0]
            for row in rows
            if (ci_type is None or row[1] == ci_type) and matches(row[0], row[2])
        ]
        total_nodes = len(filtered)
        truncated = total_nodes > limit
        node_ids = _select_topology_node_ids(filtered, rel_rows, limit)

    node_set = set(node_ids)
    nodes = [
        {"id": ci_id, "type": by_id[ci_id][0], "name": by_id[ci_id][1]}
        for ci_id in node_ids
        if ci_id in by_id
    ]

    edges = [
        {"id": row[0], "type": row[1], "from_id": row[2], "to_id": row[3]}
        for row in rel_rows
        if row[2] in node_set and row[3] in node_set
    ]

    return {
        "nodes": nodes,
        "edges": edges,
        "truncated": truncated,
        "total_nodes": total_nodes,
        "node_limit": limit,
    }


@router.get("/{dataset_id}/export")
def export_dataset(
    dataset_id: int,
    format: str = Query(default="json", pattern="^(json|csv|xlsx)$"),
    session: Session = Depends(get_session),
) -> Response:
    from ..exports.builders import build_csv_export, build_json_export, build_xlsx_export

    dataset = _get_dataset_or_404(session, dataset_id)
    builders = {
        "json": (build_json_export, "application/json; charset=utf-8"),
        "csv": (build_csv_export, "application/zip"),
        "xlsx": (
            build_xlsx_export,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
    }
    builder, content_type = builders[format]
    body, filename = builder(session, dataset)
    return Response(
        content=body,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
