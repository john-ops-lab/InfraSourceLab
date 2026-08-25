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
from ..db.models import CIRecord, Dataset
from ..limits import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    MAX_PROMPT_LENGTH,
    MAX_QUERY_LENGTH,
)
from ..specs.models import SpecValidationError, parse_and_validate
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


@router.post("", status_code=201)
def create_dataset(body: DatasetCreateRequest, session: Session = Depends(get_session)) -> dict:
    try:
        spec = parse_and_validate(body.spec)
    except SpecValidationError as exc:
        raise HTTPException(status_code=422, detail={"errors": exc.errors}) from exc

    try:
        dataset = service.create_dataset(session, spec, prompt=body.prompt)
    except Exception as exc:
        # 生成或持久化失败时整体回滚，不留下伪成功数据集
        raise HTTPException(
            status_code=500, detail="数据集生成失败，已回滚，未创建任何数据。请调整规格后重试。"
        ) from exc
    payload = _dataset_payload(dataset)
    payload["spec"] = json.loads(dataset.generation_spec_json)
    return payload


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
    payload = _dataset_payload(dataset)
    payload["spec"] = json.loads(dataset.generation_spec_json)
    return payload


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
