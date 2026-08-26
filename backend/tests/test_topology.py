"""拓扑视图接口（Issue #2）：有界返回、筛选、聚焦邻居与确定性。"""

SPEC = {
    "name": "拓扑测试",
    "description": "",
    "seed": 11,
    "ci_types": [
        {"type": "data_center", "count": 1},
        {"type": "rack", "count": 4},
        {"type": "physical_server", "count": 8},
        {"type": "virtual_machine", "count": 20},
    ],
    "relations": [
        {"type": "contained_in", "from_type": "rack", "to_type": "data_center",
         "strategy": "balanced", "coverage": "from"},
        {"type": "mounted_in", "from_type": "physical_server", "to_type": "rack",
         "strategy": "balanced", "coverage": "from"},
        {"type": "runs_on", "from_type": "virtual_machine", "to_type": "physical_server",
         "strategy": "balanced", "coverage": "from"},
    ],
}


def _create(client, auth) -> int:
    response = client.post("/api/v1/datasets", json={"spec": SPEC}, headers=auth)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_topology_returns_nodes_and_edges(client, auth):
    dataset_id = _create(client, auth)
    response = client.get(f"/api/v1/datasets/{dataset_id}/topology", headers=auth)
    assert response.status_code == 200
    body = response.json()
    assert len(body["nodes"]) == 33
    assert body["truncated"] is False
    assert body["total_nodes"] == 33
    assert len(body["edges"]) > 0
    # 边的端点都在节点集合内
    node_ids = {node["id"] for node in body["nodes"]}
    for edge in body["edges"]:
        assert edge["from_id"] in node_ids and edge["to_id"] in node_ids


def test_topology_limit_truncates_with_stable_order(client, auth):
    dataset_id = _create(client, auth)
    first = client.get(f"/api/v1/datasets/{dataset_id}/topology?limit=5", headers=auth).json()
    second = client.get(f"/api/v1/datasets/{dataset_id}/topology?limit=5", headers=auth).json()
    assert first == second  # 确定性
    assert len(first["nodes"]) == 5
    assert first["truncated"] is True
    assert first["total_nodes"] == 33
    assert first["node_limit"] == 5


def test_topology_ci_type_filter(client, auth):
    dataset_id = _create(client, auth)
    body = client.get(
        f"/api/v1/datasets/{dataset_id}/topology?ci_type=virtual_machine", headers=auth
    ).json()
    assert len(body["nodes"]) == 20
    assert all(node["type"] == "virtual_machine" for node in body["nodes"])
    # 同类型内部没有关系，边为空
    assert body["edges"] == []


def test_topology_relation_type_filter(client, auth):
    dataset_id = _create(client, auth)
    body = client.get(
        f"/api/v1/datasets/{dataset_id}/topology?relation_type=mounted_in", headers=auth
    ).json()
    assert len(body["nodes"]) == 33
    assert body["edges"]
    assert all(edge["type"] == "mounted_in" for edge in body["edges"])


def test_topology_text_filter(client, auth):
    dataset_id = _create(client, auth)
    body = client.get(f"/api/v1/datasets/{dataset_id}/topology?q=vm-", headers=auth).json()
    assert body["nodes"]
    assert all("vm-" in node["id"] for node in body["nodes"])


def test_topology_center_returns_neighbors(client, auth):
    dataset_id = _create(client, auth)
    center = "server-0001"
    body = client.get(
        f"/api/v1/datasets/{dataset_id}/topology?center={center}", headers=auth
    ).json()
    node_ids = {node["id"] for node in body["nodes"]}
    assert center in node_ids
    assert len(node_ids) > 1
    # 每条边都必须接触中心节点
    for edge in body["edges"]:
        assert edge["from_id"] == center or edge["to_id"] == center


def test_topology_center_missing_returns_404(client, auth):
    dataset_id = _create(client, auth)
    response = client.get(
        f"/api/v1/datasets/{dataset_id}/topology?center=nope-0001", headers=auth
    )
    assert response.status_code == 404


def test_topology_requires_auth(client):
    dataset_id = _create(client, {"Authorization": "Bearer test-api-key-123"})
    assert client.get(f"/api/v1/datasets/{dataset_id}/topology").status_code == 401
