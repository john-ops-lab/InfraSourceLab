# InfraSourceLab

> **用自然语言快速生成有关系的 CMDB 配置数据，并通过带认证的 REST API 提供给 DLR、CMDB 或其他测试程序。**

InfraSourceLab（ISL）是一个本地优先、单用户的 **AI CMDB 数据生成工具**。

它解决的核心问题很简单：个人开发 DLR 或 CMDB 时，没有真实企业测试环境，也很难准备大量合理的服务器、虚拟机、网络设备、应用、数据库、Kubernetes 等配置项及关系数据。

InfraSourceLab 的最短路径是：

```text
自然语言描述
   ↓
AI 生成小型 GenerationSpec
   ↓
Python 按 seed 确定性生成 CI 与关系
   ↓
数据预览
   ↓
Bearer Token REST API
   ├─ DLR 采集
   ├─ CMDB 导入
   └─ JSON / CSV / XLSX 导出
```

AI 只负责理解需求并生成结构化规格，不负责逐条生成上万条记录，也不会在每次 API 请求时调用大模型。

---

## MVP 能做什么

用户可以输入：

> 生成一家中型企业的配置数据：2 个数据中心、30 个机柜、200 台物理服务器、800 台虚拟机、80 个应用、20 个数据库和 2 个 Kubernetes 集群，并建立运行、包含、依赖和 IP 关系。

系统返回一个可确认的结构化规格，随后本地生成：

- 配置项记录；
- 配置项关系；
- 各类型数量统计；
- 可分页、筛选、搜索的 REST API；
- JSON、CSV、XLSX 导出。

首批内置 CI 类型：

```text
data_center
rack
physical_server
virtual_machine
network_device
ip_address
application
database
middleware
kubernetes_cluster
kubernetes_node
kubernetes_workload
```

首批关系类型：

```text
contains
mounted_in
runs_on
hosted_on
belongs_to
depends_on
uses
has_ip
```

---

## 产品界面

界面保持简单：

```text
Create
Datasets
Dataset Detail
  ├─ Overview
  ├─ CI Data
  ├─ Relations
  └─ API & Export
Settings / API usage
```

普通用户不需要写 YAML，也不需要面对 Monaco、复杂 DSL、容器编排或协议模拟器。

前端使用：

- UI Skills：设计工程方法；
- shadcn/ui + Tailwind CSS：产品组件和视觉体系；
- assistant-ui：自然语言创建体验；
- Chrome DevTools MCP：真实浏览器检查；
- Playwright：关键路径回归。

简单拓扑图是第二阶段可选增强，不阻塞 MVP。

---

## 带认证的 REST API

MVP 使用一个环境变量配置的 API Key：

```bash
ISL_API_KEY=replace-with-a-strong-local-key
```

数据接口使用：

```http
Authorization: Bearer <ISL_API_KEY>
```

核心接口计划：

```text
GET    /api/v1/datasets
POST   /api/v1/datasets/generate
GET    /api/v1/datasets/{id}
DELETE /api/v1/datasets/{id}

GET /api/v1/datasets/{id}/cis
GET /api/v1/datasets/{id}/cis/{ci_id}
GET /api/v1/datasets/{id}/relations
GET /api/v1/datasets/{id}/summary
GET /api/v1/datasets/{id}/export?format=json|csv|xlsx
```

示例：

```bash
curl -H "Authorization: Bearer $ISL_API_KEY" \
  "http://127.0.0.1:8080/api/v1/datasets/<dataset-id>/cis?type=virtual_machine&page=1&page_size=100"
```

这已经足够让 DLR 开发一个标准 HTTP Adapter，也足够让未来 CMDB 做批量导入和关系验证。

---

## 技术架构

MVP 是一个单体应用：

```text
React Web
   ↓
FastAPI
   ├─ AI: natural language → GenerationSpec
   ├─ deterministic data generator
   ├─ authenticated REST API
   ├─ export
   └─ SQLite
```

推荐技术栈：

```text
Python 3.13
FastAPI + Pydantic + SQLAlchemy
SQLite default
Mimesis and/or Faker
React + TypeScript + Vite
Tailwind CSS v4 + shadcn/ui
assistant-ui
i18next
pytest + Vitest + Playwright
```

正常使用目标是：一个 Docker 镜像、一个 Compose service、一个数据卷、一个启动命令。

---

## 明确不做

MVP 不建设：

- vCenter、SNMP、Kubernetes、Redfish 等协议模拟器；
- PostgreSQL、Kafka、Redis、NetBox 等真实服务编排；
- Lab Agent 或 Docker socket 管理；
- Compile/Run/Truth-Version 平台；
- Timeline、Fault、Toxiproxy；
- Observation、Verifier；
- Remote Agent、GC、分布式调度；
- 通用 Importer/Plugin 平台；
- 多租户、RBAC、SSO；
- 图数据库；
- 生产级数字孪生。

这些能力只有在 MVP 实际使用后出现明确需求时，才按单个问题重新评估。

---

## 开发路线

当前只保留两个活跃 Issue：

| 阶段 | Issue | 目标 |
|---|---|---|
| MVP | [#1](https://github.com/john-ops-lab/InfraSourceLab/issues/1) | AI 生成规格、确定性 CI/关系、Bearer API、导出、简单 UI |
| 可选增强 | [#2](https://github.com/john-ops-lab/InfraSourceLab/issues/2) | 简单拓扑图和少量数据质量开关 |

原来的协议模拟、故障验证、远程 Agent 和平台化 Issues 已关闭为 `not planned`。

---

## 文档

- [产品定义](docs/product.md)
- [精简架构](docs/architecture.md)
- [GenerationSpec 与数据模型](docs/scenario-model.md)
- [生成与接口策略](docs/backend-strategy.md)
- [前端设计](docs/frontend-design.md)
- [安全与许可证](docs/security-and-licensing.md)
- [Qoder direct-main 开发与 Review](docs/development-workflow.md)
- [精简路线图](docs/roadmap.md)

`docs/research/` 保留早期工具调研，仅作未来参考，不是 MVP 实现要求。

---

## License

InfraSourceLab 使用 [Apache License 2.0](LICENSE)。