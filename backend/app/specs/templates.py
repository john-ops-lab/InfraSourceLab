"""内置模板：AI 未配置时的无 AI 入口，本质上也是 GenerationSpec。"""

BUILTIN_TEMPLATES: list[dict] = [
    {
        "id": "small-datacenter",
        "name": "小型数据中心",
        "description": "1 个数据中心、6 个机柜、20 台物理服务器、60 台虚拟机和 8 个应用。",
        "spec": {
            "name": "小型数据中心",
            "description": "单数据中心的基础计算资源",
            "seed": 20260101,
            "ci_types": [
                {"type": "data_center", "count": 1},
                {"type": "rack", "count": 6},
                {"type": "physical_server", "count": 20},
                {"type": "virtual_machine", "count": 60},
                {"type": "application", "count": 8},
            ],
            "relations": [
                {"type": "contained_in", "from_type": "rack", "to_type": "data_center",
                 "strategy": "balanced", "coverage": "from"},
                {"type": "mounted_in", "from_type": "physical_server", "to_type": "rack",
                 "strategy": "balanced", "coverage": "from"},
                {"type": "runs_on", "from_type": "virtual_machine", "to_type": "physical_server",
                 "strategy": "balanced", "coverage": "from"},
                {"type": "hosted_on", "from_type": "application", "to_type": "virtual_machine",
                 "strategy": "random_seeded", "coverage": "from"},
            ],
        },
    },
    {
        "id": "medium-enterprise",
        "name": "中型企业",
        "description": "2 个数据中心、30 个机柜、200 台物理服务器、800 台虚拟机和 80 个应用。",
        "spec": {
            "name": "中型企业",
            "description": "两个数据中心及其计算资源和应用",
            "seed": 20260825,
            "ci_types": [
                {"type": "data_center", "count": 2},
                {"type": "rack", "count": 30},
                {"type": "physical_server", "count": 200},
                {"type": "virtual_machine", "count": 800},
                {"type": "application", "count": 80},
            ],
            "relations": [
                {"type": "contained_in", "from_type": "rack", "to_type": "data_center",
                 "strategy": "balanced", "coverage": "from"},
                {"type": "mounted_in", "from_type": "physical_server", "to_type": "rack",
                 "strategy": "balanced", "coverage": "from"},
                {"type": "runs_on", "from_type": "virtual_machine", "to_type": "physical_server",
                 "strategy": "balanced", "coverage": "from"},
                {"type": "hosted_on", "from_type": "application", "to_type": "virtual_machine",
                 "strategy": "random_seeded", "coverage": "from"},
            ],
        },
    },
    {
        "id": "apps-and-databases",
        "name": "应用与数据库",
        "description": "40 个应用、12 个数据库、6 个中间件及依赖关系，不含机房层级。",
        "spec": {
            "name": "应用与数据库",
            "description": "应用、数据库和中间件的依赖关系",
            "seed": 20260315,
            "ci_types": [
                {"type": "application", "count": 40},
                {"type": "database", "count": 12},
                {"type": "middleware", "count": 6},
            ],
            "relations": [
                {"type": "uses", "from_type": "application", "to_type": "database",
                 "strategy": "random_seeded", "coverage": "to"},
                {"type": "depends_on", "from_type": "application", "to_type": "middleware",
                 "strategy": "random_seeded", "coverage": "to"},
                {"type": "depends_on", "from_type": "application", "to_type": "application",
                 "strategy": "random_seeded", "coverage": "to"},
            ],
        },
    },
    {
        "id": "kubernetes-basic",
        "name": "Kubernetes 基础环境",
        "description": "1 个集群、10 个节点、60 个工作负载以及承载它们的虚拟机。",
        "spec": {
            "name": "Kubernetes 基础环境",
            "description": "单集群的 Kubernetes 节点与工作负载",
            "seed": 20260601,
            "ci_types": [
                {"type": "kubernetes_cluster", "count": 1},
                {"type": "kubernetes_node", "count": 10},
                {"type": "kubernetes_workload", "count": 60},
                {"type": "virtual_machine", "count": 10},
            ],
            "relations": [
                {"type": "contained_in", "from_type": "kubernetes_node", "to_type": "kubernetes_cluster",
                 "strategy": "balanced", "coverage": "from"},
                {"type": "belongs_to", "from_type": "kubernetes_workload", "to_type": "kubernetes_cluster",
                 "strategy": "balanced", "coverage": "from"},
                {"type": "runs_on", "from_type": "kubernetes_node", "to_type": "virtual_machine",
                 "strategy": "balanced", "coverage": "from"},
            ],
        },
    },
]


def get_template(template_id: str) -> dict | None:
    for template in BUILTIN_TEMPLATES:
        if template["id"] == template_id:
            return template
    return None
