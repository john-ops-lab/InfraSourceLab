"""事务边界：生成或持久化失败时不留下伪成功数据集；相同规格+seed 重复创建得到相同数据。"""

from unittest.mock import patch

from conftest import default_proposal

from app.db.models import CIRelation


def test_failed_generation_leaves_no_dataset(client, auth):
    before = client.get("/api/v1/datasets", headers=auth).json()["total"]

    with patch(
        "app.datasets.service.generate_dataset",
        side_effect=RuntimeError("模拟生成失败"),
    ):
        response = client.post(
            "/api/v1/datasets", headers=auth, json={"spec": default_proposal().spec}
        )
    assert response.status_code == 500

    after = client.get("/api/v1/datasets", headers=auth).json()["total"]
    assert after == before


def test_unique_constraint_protects_duplicate_edges(client, auth, app_env):
    """数据库唯一约束 (dataset_id, type, from_ci_id, to_ci_id) 是最终保护。"""
    from sqlalchemy import insert, text

    app, _ = app_env
    session_factory = app.state.session_factory

    response = client.post(
        "/api/v1/datasets", headers=auth, json={"spec": default_proposal().spec}
    )
    dataset_id = response.json()["id"]

    session = session_factory()
    try:
        row = session.execute(
            text(
                "SELECT type, from_ci_id, to_ci_id FROM ci_relations "
                "WHERE dataset_id = :id LIMIT 1"
            ),
            {"id": dataset_id},
        ).first()
        assert row is not None

        from sqlalchemy.exc import IntegrityError

        with_error = False
        try:
            session.execute(
                insert(CIRelation).values(
                    dataset_id=dataset_id,
                    relation_id="rel-dup",
                    type=row[0],
                    from_ci_id=row[1],
                    to_ci_id=row[2],
                    attributes_json="{}",
                )
            )
            session.flush()
        except IntegrityError:
            with_error = True
        finally:
            session.rollback()
        assert with_error, "重复边必须被唯一约束拦截"
    finally:
        session.close()


def test_same_spec_and_seed_reproducible(client, auth):
    spec = default_proposal().spec
    first = client.post("/api/v1/datasets", headers=auth, json={"spec": spec}).json()
    second = client.post("/api/v1/datasets", headers=auth, json={"spec": spec}).json()

    first_cis = client.get(
        f"/api/v1/datasets/{first['id']}/cis", headers=auth, params={"page_size": 200}
    ).json()["items"]
    second_cis = client.get(
        f"/api/v1/datasets/{second['id']}/cis", headers=auth, params={"page_size": 200}
    ).json()["items"]

    assert first_cis == second_cis

    first_rels = client.get(
        f"/api/v1/datasets/{first['id']}/relations", headers=auth, params={"page_size": 200}
    ).json()["items"]
    second_rels = client.get(
        f"/api/v1/datasets/{second['id']}/relations", headers=auth, params={"page_size": 200}
    ).json()["items"]
    assert first_rels == second_rels
