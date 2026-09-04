"""数据库会话与 SQLite 模式版本边界。

版本策略（PRAGMA user_version）：
- 空数据库：自动建表并设置版本 2；
- 版本 1：执行唯一受支持的向前迁移，新增质量报告字段；
- 版本 2：正常启动；
- 其他非零版本：拒绝启动，输出明确中文错误。
当前只有一条小型、幂等的 SQLite 迁移，不引入 Alembic。
"""

from pathlib import Path

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from .models import Base

SUPPORTED_USER_VERSION = 2


class DatabaseVersionError(RuntimeError):
    """SQLite 模式版本未知，拒绝启动。"""


def _enable_sqlite_fks(engine: Engine) -> None:
    @event.listens_for(engine, "connect")
    def _on_connect(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def _read_user_version(engine: Engine) -> int:
    with engine.connect() as conn:
        row = conn.execute(text("PRAGMA user_version")).first()
    return int(row[0]) if row else 0


def _migrate_v1_to_v2(engine: Engine) -> None:
    """给历史数据集补质量报告列；旧数据用空报告表示未知。"""
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        columns = {
            row[1] for row in conn.exec_driver_sql("PRAGMA table_info(datasets)").fetchall()
        }
        if "quality_report_json" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE datasets ADD COLUMN quality_report_json "
                    "TEXT NOT NULL DEFAULT '[]'"
                )
            )
        conn.execute(text(f"PRAGMA user_version = {SUPPORTED_USER_VERSION}"))


def init_database(db_path: Path) -> Engine:
    """初始化数据库引擎并完成版本检查。"""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    is_new_file = not db_path.exists() or db_path.stat().st_size == 0

    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        future=True,
    )
    _enable_sqlite_fks(engine)

    version = 0 if is_new_file else _read_user_version(engine)

    if version == 0:
        Base.metadata.create_all(engine)
        with engine.begin() as conn:
            conn.execute(text(f"PRAGMA user_version = {SUPPORTED_USER_VERSION}"))
    elif version == 1:
        _migrate_v1_to_v2(engine)
    elif version == SUPPORTED_USER_VERSION:
        Base.metadata.create_all(engine)  # checkfirst，幂等
    else:
        raise DatabaseVersionError(
            f"SQLite 数据库模式版本为 {version}，当前应用只支持版本 {SUPPORTED_USER_VERSION}。"
            "仅版本 1 可自动迁移。请先备份该 SQLite 文件，再删除后重新启动应用以重建数据库。"
        )
    return engine


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False, future=True)
