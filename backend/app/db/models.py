"""SQLAlchemy 数据模型。核心数据模型保持精简：三张表。"""

from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    prompt: Mapped[str] = mapped_column(Text, default="", nullable=False)
    generation_spec_json: Mapped[str] = mapped_column(Text, nullable=False)
    seed: Mapped[int] = mapped_column(Integer, nullable=False)
    generator_version: Mapped[str] = mapped_column(String(20), nullable=False)
    record_count: Mapped[int] = mapped_column(Integer, nullable=False)
    relation_count: Mapped[int] = mapped_column(Integer, nullable=False)
    warnings_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class CIRecord(Base):
    __tablename__ = "ci_records"
    __table_args__ = (
        UniqueConstraint("dataset_id", "ci_id", name="uq_ci_dataset_ci_id"),
        Index("ix_ci_dataset_type", "dataset_id", "type"),
        Index("ix_ci_dataset_name", "dataset_id", "name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset_id: Mapped[int] = mapped_column(
        ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False
    )
    ci_id: Mapped[str] = mapped_column(String(80), nullable=False)
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    attributes_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    tags_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    # 内部辅助字段：只聚合白名单字段的小写文本，不暴露给 API 和导出
    search_text: Mapped[str] = mapped_column(Text, default="", nullable=False)


class CIRelation(Base):
    __tablename__ = "ci_relations"
    __table_args__ = (
        UniqueConstraint(
            "dataset_id", "type", "from_ci_id", "to_ci_id", name="uq_relation_edge"
        ),
        Index("ix_relation_dataset_type", "dataset_id", "type"),
        Index("ix_relation_dataset_from", "dataset_id", "from_ci_id"),
        Index("ix_relation_dataset_to", "dataset_id", "to_ci_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset_id: Mapped[int] = mapped_column(
        ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False
    )
    relation_id: Mapped[str] = mapped_column(String(24), nullable=False)
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    from_ci_id: Mapped[str] = mapped_column(String(80), nullable=False)
    to_ci_id: Mapped[str] = mapped_column(String(80), nullable=False)
    attributes_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
