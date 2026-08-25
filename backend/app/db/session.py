"""数据库会话与 SQLite 模式版本边界。

版本策略（PRAGMA user_version）：
- 空数据库：自动建表并设置版本 1；
- 版本 1：正常启动；
- 其他非零版本：拒绝启动，输出明确中文错误，提示先备份再删除重建。
不引入 Alembic 或自动迁移链。
"""

from pathlib import Path

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from .models import Base

SUPPORTED_USER_VERSION = 1


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
    elif version == SUPPORTED_USER_VERSION:
        Base.metadata.create_all(engine)  # checkfirst，幂等
    else:
        raise DatabaseVersionError(
            f"SQLite 数据库模式版本为 {version}，当前应用只支持版本 {SUPPORTED_USER_VERSION}。"
            "请先备份该 SQLite 文件，再删除后重新启动应用以重建数据库。"
            "本版本不提供自动迁移。"
        )
    return engine


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False, future=True)
