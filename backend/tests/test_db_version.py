"""SQLite PRAGMA user_version 行为：空库、版本 1 和未知版本。"""

import sqlite3

import pytest

from app.db.session import DatabaseVersionError, init_database


def test_empty_database_initializes_to_version_1(tmp_path):
    db_path = tmp_path / "fresh.db"
    engine = init_database(db_path)
    with engine.connect() as conn:
        version = conn.exec_driver_sql("PRAGMA user_version").scalar()
    assert version == 1

    # 再次启动（版本 1）应当正常
    engine.dispose()
    engine2 = init_database(db_path)
    with engine2.connect() as conn:
        assert conn.exec_driver_sql("PRAGMA user_version").scalar() == 1
    engine2.dispose()


def test_unknown_version_refuses_startup(tmp_path):
    db_path = tmp_path / "future.db"
    connection = sqlite3.connect(db_path)
    connection.execute("CREATE TABLE something (id INTEGER)")
    connection.execute("PRAGMA user_version = 7")
    connection.commit()
    connection.close()

    with pytest.raises(DatabaseVersionError) as excinfo:
        init_database(db_path)
    message = str(excinfo.value)
    assert "7" in message
    assert "备份" in message
    assert "删除" in message


def test_tables_created_on_fresh_database(tmp_path):
    db_path = tmp_path / "fresh2.db"
    engine = init_database(db_path)
    with engine.connect() as conn:
        rows = conn.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
    names = {row[0] for row in rows}
    assert {"datasets", "ci_records", "ci_relations"} <= names
    engine.dispose()
