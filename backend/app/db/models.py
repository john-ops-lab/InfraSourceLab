"""SQLAlchemy 数据模型。核心数据三张表 + 账户/令牌/设置三张表。

新增表通过 create_all 幂等创建，不改变 user_version=1 的版本约定。
"""

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


class AppUser(Base):
    """管理员账户：密码只存 PBKDF2 哈希。"""

    __tablename__ = "app_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuthToken(Base):
    """登录会话令牌：只存 SHA-256 哈希，带过期时间。"""

    __tablename__ = "auth_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class AppSetting(Base):
    """运行时设置（如 AI 模型配置）：键值对持久化。"""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="", nullable=False)
