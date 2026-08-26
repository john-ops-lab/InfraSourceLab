<div align="center">

# 🏭 InfraSourceLab

**用一句话描述，生成一整套合理、一致、可复现的 CMDB 测试数据。**

没有真实企业环境？让 InfraSourceLab 帮你生成数量可控、字段合理、关系一致的 CMDB 配置数据，
并通过带认证的 REST API 提供给 CMDB、数据导入程序或测试脚本。

</div>

<div align="center">

[![Version](https://img.shields.io/badge/version-v0.1.0-2ea44f?style=flat-square)](https://github.com/john-ops-lab/InfraSourceLab/releases)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)](LICENSE)
[![Backend](https://img.shields.io/badge/backend-FastAPI-009688?style=flat-square)](backend/)
[![Frontend](https://img.shields.io/badge/frontend-React%2019-61dafb?style=flat-square)](web/)
[![Database](https://img.shields.io/badge/database-SQLite-003b57?style=flat-square)](backend/)
[![Tests](https://img.shields.io/badge/tests-103%20backend%20%7C%2024%20unit%20%7C%2012%20e2e-brightgreen?style=flat-square)](docs/status.md)
[![Docker](https://img.shields.io/badge/docker-single%20image-2496ed?style=flat-square)](Dockerfile)

</div>

---

## ✨ 特性

### 生成引擎

- **🤖 自然语言 → 结构化规格**：OpenAI 兼容 AI 服务把一句需求（“两个数据中心、20 个机柜、100 台物理服务器……”）转换为经过校验的 `GenerationSpec`，AI 只做翻译、不做逐条生成；
- **🧩 无 AI 也能用**：内置模板 + 手动调整类型数量、关系覆盖方向与 seed，走同一条生成通道；
- **🔁 确定性生成**：`GenerationSpec + seed + 生成器版本` 产生完全相同的结果，测试可复现；
- **🗃️ 12 种内置 CI 类型**：数据中心、机柜、物理/虚拟机、网络设备、IP、应用、数据库、中间件、Kubernetes 集群/节点/工作负载；
- **🔗 15 种内置关系类型**：`contained_in`、`mounted_in`、`runs_on`、`hosted_on`、`deployed_on`、`belongs_to`、`depends_on`、`uses`、`has_ip`、`connected_to` 等，关系覆盖方向明确（`coverage=from/to`）、无重复边、无悬空引用；
- **🛠️ 关系类型注册表**：设置页直接增删改关系类型的中英文名称与方向，规格校验、AI 提示词、拓扑分层、界面对照即时生效。

### 数据消费

- **🕸️ 钻取式拓扑视图**：默认从顶层折叠、点击节点逐层展开，支持中英文标签三态切换（`runs_on(运行于)`）、全屏与聚焦邻居；
- **🔌 Bearer Token REST API**：CI 分页/筛选/搜索、关系查询、规格确认与生成，开箱即用；
- **📦 多格式导出**：JSON、CSV（ZIP）、XLSX；
- **🩺 数据质量缺陷注入**：按规则注入缺字段、异常值等脏数据，用于验证 CMDB 采集/导入程序的容错；
- **🔐 双通道认证**：管理员登录会话（12 小时）+ API Key 备用通道，`/docs` 交互式 API 文档随服务提供。

## 🚀 快速开始

### Docker（推荐）

```bash
cp .env.example .env        # 设置 ISL_API_KEY；可选填 OpenAI 兼容 AI 配置
docker compose up -d --build
curl http://127.0.0.1:8080/health
```

浏览器打开 `http://127.0.0.1:8080`：

| 入口 | 说明 |
| --- | --- |
| 管理员登录 | 默认 `admin` / `admin123`（不强制改密，可在设置页修改） |
| API Key | 设置页填入 `.env` 中的 `ISL_API_KEY` 作为备用通道 |
| AI 建议服务 | 设置页配置 OpenAI 兼容 `base_url` / `api_key` / `model`，支持拉取模型列表、测试连接与自定义提示词 |

### 本地开发

```bash
# 后端（端口 8080）
cd backend && uv sync
ISL_API_KEY=dev-key uv run python -m app.main

# 前端（自动代理 /api 到 127.0.0.1:8080）
cd web && npm install && npm run dev
```

### 测试

```bash
cd backend && uv run pytest        # 103 个用例
cd web && npm test                 # Vitest 单测（24 个）
cd web && npx playwright test      # 端到端（12 个，自动拉起生产形态服务）
```

## 🔌 REST API 概览

所有 `/api/v1` 接口需要 `Authorization: Bearer <ISL_API_KEY>` 或管理员登录会话。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/v1/specs/from-prompt` | 自然语言 → 校验过的 GenerationSpec 建议 |
| `POST` | `/api/v1/datasets` | 确认后的规格 → 生成数据集 |
| `GET` | `/api/v1/datasets` | 数据集列表（分页） |
| `GET` | `/api/v1/datasets/{id}/cis` | CI 数据（分页/类型/关键字筛选） |
| `GET` | `/api/v1/datasets/{id}/relations` | 关系数据 |
| `GET` | `/api/v1/datasets/{id}/topology` | 拓扑图节点与边 |
| `GET` | `/api/v1/datasets/{id}/export?format=json\|csv\|xlsx` | 文件导出（CSV 为 ZIP） |
| `GET` | `/api/v1/relation-types` | 关系类型注册表（登录可读） |
| `POST/PUT/DELETE` | `/api/v1/admin/relation-types` | 关系类型增删改（仅管理员） |

完整接口见服务自带 `/docs`。

## 🛠️ 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | FastAPI · SQLAlchemy · SQLite · Pydantic |
| 前端 | React 19 · Vite · TypeScript · Tailwind CSS v4 · shadcn/ui |
| 拓扑 | React Flow（@xyflow/react） |
| 测试 | pytest · Vitest · Playwright |
| 部署 | 单镜像 Docker（后端 + 内置前端静态产物） |

## 📁 项目结构

```text
├── backend/            FastAPI + SQLAlchemy + SQLite 数据生成引擎（103 pytest）
├── web/                React 19 + Vite + Tailwind v4 + shadcn/ui 前端
├── docs/               产品、架构、前端与状态文档
├── Dockerfile          单镜像：后端 + 内置前端静态产物
└── docker-compose.yml  只向 127.0.0.1:8080 发布，数据存命名卷
```

## 📚 文档

- [项目状态](docs/status.md) · [产品定义](docs/product.md) · [精简架构](docs/architecture.md)
- [GenerationSpec 与数据模型](docs/scenario-model.md) · [生成与接口策略](docs/backend-strategy.md)
- [前端设计](docs/frontend-design.md) · [安全与许可证](docs/security-and-licensing.md)
- [开发与代码审查流程](docs/development-workflow.md) · [精简路线图](docs/roadmap.md)

## 📄 许可证

[Apache License 2.0](LICENSE)
