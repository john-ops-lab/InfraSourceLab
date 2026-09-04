"""SQLite PRAGMA user_version 行为：空库、v1 到 v2 迁移和未知版本。"""

import sqlite3

import pytest

from app.db.session import DatabaseVersionError, init_database


def test_empty_database_initializes_to_version_2(tmp_path):
    db_path = tmp_path / "fresh.db"
    engine = init_database(db_path)
    with engine.connect() as conn:
        version = conn.exec_driver_sql("PRAGMA user_version").scalar()
    assert version == 2

    # 再次启动（版本 2）应当正常
    engine.dispose()
    engine2 = init_database(db_path)
    with engine2.connect() as conn:
        assert conn.exec_driver_sql("PRAGMA user_version").scalar() == 2
    engine2.dispose()


def test_version_1_database_migrates_quality_report_without_losing_rows(tmp_path):
    db_path = tmp_path / "legacy.db"
    connection = sqlite3.connect(db_path)
    connection.executescript(
        """
        CREATE TABLE datasets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(120) NOT NULL,
            description VARCHAR(500) NOT NULL,
            prompt TEXT NOT NULL,
            generation_spec_json TEXT NOT NULL,
            seed INTEGER NOT NULL,
            generator_version VARCHAR(20) NOT NULL,
            record_count INTEGER NOT NULL,
            relation_count INTEGER NOT NULL,
            warnings_json TEXT NOT NULL,
            created_at DATETIME NOT NULL
        );
        INSERT INTO datasets (
            name, description, prompt, generation_spec_json, seed,
            generator_version, record_count, relation_count, warnings_json, created_at
        ) VALUES ('legacy', '', '', '{}', 1, '1.1.0', 0, 0, '[]', '2026-01-01');
        PRAGMA user_version = 1;
        """
    )
    connection.commit()
    connection.close()

    engine = init_database(db_path)
    with engine.connect() as conn:
        assert conn.exec_driver_sql("PRAGMA user_version").scalar() == 2
        columns = {
            row[1] for row in conn.exec_driver_sql("PRAGMA table_info(datasets)").fetchall()
        }
        assert "quality_report_json" in columns
        row = conn.exec_driver_sql(
            "SELECT name, quality_report_json FROM datasets WHERE id = 1"
        ).first()
        assert row == ("legacy", "[]")
    engine.dispose()


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
