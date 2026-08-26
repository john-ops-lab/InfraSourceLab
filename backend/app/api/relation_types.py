"""关系类型管理：公开读取（拓扑/编辑器对照名）+ 管理员增删改。

- GET /api/v1/relation-types：登录用户可读，供拓扑分层与中英对照标签使用；
- POST/PUT/DELETE /api/v1/admin/relation-types：仅管理员，维护中英文名称、
  分层方向与类型清单；删除时若被任何数据集规格引用则拒绝（409）。
"""

import json
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as OrmSession

from ..auth.token import require_admin_session, require_auth
from ..db.models import Dataset, RelationType
from .deps import get_session

router = APIRouter(prefix="/api/v1", tags=["关系类型"], dependencies=[Depends(require_auth)])
admin_router = APIRouter(
    prefix="/api/v1/admin/relation-types",
    tags=["关系类型"],
    dependencies=[Depends(require_admin_session)],
)

_TYPE_PATTERN = re.compile(r"^[a-z][a-z0-9_]{1,39}$")


class RelationTypeInfo(BaseModel):
    type: str
    name_zh: str
    name_en: str
    direction: str
    is_builtin: bool


class RelationTypeCreate(BaseModel):
    type: str = Field(min_length=2, max_length=40)
    name_zh: str = Field(min_length=1, max_length=40)
    name_en: str = Field(min_length=1, max_length=80)
    direction: str = Field(pattern="^(child_to_parent|peer)$")


class RelationTypeUpdate(BaseModel):
    name_zh: str = Field(min_length=1, max_length=40)
    name_en: str = Field(min_length=1, max_length=80)
    direction: str = Field(pattern="^(child_to_parent|peer)$")


def _payload(row: RelationType) -> RelationTypeInfo:
    return RelationTypeInfo(
        type=row.type,
        name_zh=row.name_zh,
        name_en=row.name_en,
        direction=row.direction,
        is_builtin=row.is_builtin,
    )


@router.get("/relation-types", response_model=list[RelationTypeInfo])
def list_relation_types(session: OrmSession = Depends(get_session)) -> list[RelationTypeInfo]:
    rows = (
        session.query(RelationType)
        .order_by(RelationType.direction.desc(), RelationType.type)
        .all()
    )
    return [_payload(row) for row in rows]


def _validate_direction(direction: str) -> str:
    if direction not in ("child_to_parent", "peer"):
        raise HTTPException(status_code=422, detail="direction 只能是 child_to_parent 或 peer")
    return direction


@admin_router.post("", status_code=201, response_model=RelationTypeInfo)
def create_relation_type(body: RelationTypeCreate, session: OrmSession = Depends(get_session)) -> RelationTypeInfo:
    if not _TYPE_PATTERN.match(body.type):
        raise HTTPException(
            status_code=422,
            detail="类型标识必须为小写字母开头的字母数字下划线（2~40 位）。",
        )
    _validate_direction(body.direction)
    if session.get(RelationType, body.type) is not None:
        raise HTTPException(status_code=409, detail=f"关系类型已存在：{body.type}")
    row = RelationType(
        type=body.type,
        name_zh=body.name_zh.strip(),
        name_en=body.name_en.strip(),
        direction=body.direction,
        is_builtin=False,
    )
    session.add(row)
    session.commit()
    return _payload(row)


@admin_router.put("/{type_name}", response_model=RelationTypeInfo)
def update_relation_type(
    type_name: str, body: RelationTypeUpdate, session: OrmSession = Depends(get_session)
) -> RelationTypeInfo:
    row = session.get(RelationType, type_name)
    if row is None:
        raise HTTPException(status_code=404, detail=f"关系类型不存在：{type_name}")
    _validate_direction(body.direction)
    row.name_zh = body.name_zh.strip()
    row.name_en = body.name_en.strip()
    row.direction = body.direction
    session.commit()
    return _payload(row)


@admin_router.delete("/{type_name}", status_code=204)
def delete_relation_type(type_name: str, session: OrmSession = Depends(get_session)) -> None:
    row = session.get(RelationType, type_name)
    if row is None:
        raise HTTPException(status_code=404, detail=f"关系类型不存在：{type_name}")

    # 被任何数据集规格引用时拒绝删除，避免生成历史不可解释
    referenced = 0
    for dataset in session.query(Dataset).all():
        try:
            spec = json.loads(dataset.generation_spec_json)
        except (TypeError, ValueError):
            continue
        for rel in spec.get("relations", []):
            if isinstance(rel, dict) and rel.get("type") == type_name:
                referenced += 1
                break
    if referenced:
        raise HTTPException(
            status_code=409,
            detail=f"关系类型 {type_name} 正被 {referenced} 个数据集规格引用，不能删除。可先删除相关数据集。",
        )

    session.delete(row)
    session.commit()
