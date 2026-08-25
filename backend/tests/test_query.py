"""CI 与关系查询：受控 search_text、通配符转义、筛选分页、端点信息。"""

import pytest

from conftest import default_proposal


@pytest.fixture()
def dataset_id(client, auth):
    response = client.post(
        "/api/v1/datasets",
        headers=auth,
        json={"spec": default_proposal().spec},
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_ci_filter_by_type_and_pagination(client, auth, dataset_id):
    body = client.get(
        f"/api/v1/datasets/{dataset_id}/cis",
        headers=auth,
        params={"type": "virtual_machine", "page": 1, "page_size": 5},
    ).json()
    assert body["total"] == 16
    assert len(body["items"]) == 5
    assert all(item["type"] == "virtual_machine" for item in body["items"])
    assert "search_text" not in body["items"][0]

    page2 = client.get(
        f"/api/v1/datasets/{dataset_id}/cis",
        headers=auth,
        params={"type": "virtual_machine", "page": 2, "page_size": 5},
    ).json()
    assert page2["items"][0]["id"] != body["items"][0]["id"]


def test_q_matches_whitelist_fields_only(client, auth, dataset_id):
    # 按主机名搜索：主机名在 search_text 白名单内
    first = client.get(
        f"/api/v1/datasets/{dataset_id}/cis",
        headers=auth,
        params={"type": "virtual_machine", "page_size": 1},
    ).json()["items"][0]
    hostname = first["attributes"]["hostname"]

    found = client.get(
        f"/api/v1/datasets/{dataset_id}/cis",
        headers=auth,
        params={"q": hostname.upper()},  # 大小写不敏感
    ).json()
    assert found["total"] >= 1
    assert any(item["id"] == first["id"] for item in found["items"])

    # 按非白名单属性搜索：OS 名称不应命中
    os_name = first["attributes"]["os_name"]
    missed = client.get(
        f"/api/v1/datasets/{dataset_id}/cis",
        headers=auth,
        params={"q": os_name, "type": "virtual_machine"},
    ).json()
    assert missed["total"] == 0


def test_q_wildcards_treated_as_literals(client, auth, dataset_id):
    # % 和 _ 必须按普通文字处理，不能匹配任意字符
    response = client.get(
        f"/api/v1/datasets/{dataset_id}/cis",
        headers=auth,
        params={"q": "v_-%"},
    ).json()
    # 数据中不存在字面包含 "v_-%" 的受控字段值
    assert response["total"] == 0

    response = client.get(
        f"/api/v1/datasets/{dataset_id}/cis",
        headers=auth,
        params={"q": "%"},
    ).json()
    assert response["total"] == 0

    # 字面片段仍可命中：ci_id 前缀
    response = client.get(
        f"/api/v1/datasets/{dataset_id}/cis",
        headers=auth,
        params={"q": "vm-"},
    ).json()
    assert response["total"] == 16


def test_get_single_ci(client, auth, dataset_id):
    first_id = client.get(
        f"/api/v1/datasets/{dataset_id}/cis",
        headers=auth,
        params={"type": "rack", "page_size": 1},
    ).json()["items"][0]["id"]

    body = client.get(f"/api/v1/datasets/{dataset_id}/cis/{first_id}", headers=auth).json()
    assert body["id"] == first_id
    assert body["type"] == "rack"

    missing = client.get(f"/api/v1/datasets/{dataset_id}/cis/nope-9999", headers=auth)
    assert missing.status_code == 404


def test_relations_filters_and_endpoint_info(client, auth, dataset_id):
    body = client.get(
        f"/api/v1/datasets/{dataset_id}/relations",
        headers=auth,
        params={"type": "runs_on"},
    ).json()
    assert body["total"] == 16
    item = body["items"][0]
    assert item["from_type"] == "virtual_machine"
    assert item["to_type"] == "physical_server"
    assert item["from_name"]
    assert item["to_name"]

    # 按起点筛选
    from_id = item["from_id"]
    filtered = client.get(
        f"/api/v1/datasets/{dataset_id}/relations",
        headers=auth,
        params={"from_id": from_id},
    ).json()
    assert filtered["total"] >= 1
    assert all(rel["from_id"] == from_id for rel in filtered["items"])

    # 按终点筛选
    to_id = item["to_id"]
    filtered = client.get(
        f"/api/v1/datasets/{dataset_id}/relations",
        headers=auth,
        params={"to_id": to_id},
    ).json()
    assert filtered["total"] >= 1
    assert all(rel["to_id"] == to_id for rel in filtered["items"])
