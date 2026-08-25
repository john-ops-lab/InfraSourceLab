# InfraSourceLab

> 用自然语言描述需要的 CMDB 测试环境，生成数量可控、字段合理、关系一致的配置数据，并通过带认证的 REST API 提供给 CMDB、数据导入程序或测试脚本。

## 项目状态：MVP 已实现，等待审查

当前 `main` 已包含 Issue #1 的完整实现：

```text
├─ LICENSE
├─ README.md
├─ docs/                 产品、架构、前端与调研设计文档 + 状态说明
├─ backend/              FastAPI + SQLAlchemy + SQLite 数据生成引擎（60 个 pytest）
├─ web/                  React 19 + Vite + Tailwind v4 + shadcn/ui 前端（Vitest + Playwright）
├─ Dockerfile            单镜像：后端 + 内置前端静态产物
└─ docker-compose.yml    只向 127.0.0.1:8080 发布
```

验收证据（测试命令、浏览器验证、容器验证）记录在 [`docs/status.md`](docs/status.md) 与 Issue #1 完成报告中。外部审查确认前不声称已验收。

当前工作项：

- [Issue #1](https://github.com/john-ops-lab/InfraSourceLab/issues/1)：**MVP 已实现，等待审查**；
- [Issue #2](https://github.com/john-ops-lab/InfraSourceLab/issues/2)：**可选增强设计，仅包含简单拓扑、基础数据质量和 CMDB 使用示例，必须等待 #1 审查通过并实际使用后再决定是否开发**；
- Issues #3～#8：已关闭为“不计划实施”，不属于当前开发范围。

权威状态说明见 [`docs/status.md`](docs/status.md)。

## 快速开始

### Docker（推荐）

```bash
cp .env.example .env        # 修改 ISL_API_KEY；可选填 OpenAI 兼容 AI 配置
docker compose up -d --build
curl http://127.0.0.1:8080/health
```

浏览器打开 `http://127.0.0.1:8080`：

- **管理员登录（主通道）**：默认账户 `admin` / `admin123`，不强制改密，登录后可在设置页自行修改；会话令牌 12 小时有效。
- **API Key（备用通道）**：在设置页或登录页的「改用 API Key」入口填入 `.env` 中的 `ISL_API_KEY`。
- **AI 模型配置**：管理员登录后在导航「AI 配置」页设置 OpenAI 兼容服务的 base_url / api_key / model，保存到数据库并立即生效，无需重启。

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
cd backend && uv run pytest        # 60 个用例
cd web && npm test                 # Vitest 单测
cd web && npx playwright test      # 端到端（自动拉起生产形态服务）
```

## 计划解决的问题

个人开发 CMDB 时，通常没有真实企业环境，也难以准备大量合理的服务器、虚拟机、网络设备、应用、数据库、Kubernetes 等配置项及关系数据。

InfraSourceLab 计划提供最短闭环：

```text
自然语言 / 内置模板
        ↓
AI 生成经过校验的 GenerationSpec
        ↓
用户确认数量、关系和 seed
        ↓
本地确定性生成 CI 与关系
        ↓
Bearer Token REST API
        ├─ CMDB 接口与导入测试
        ├─ 其他测试程序读取
        └─ JSON / CSV / 可选 XLSX 导出
```

AI 只负责把自然语言转换成结构化规格，不逐条生成上万条数据，也不在每次 API 请求时调用模型。

## MVP 计划范围

计划包含：

- 常用 CMDB CI 类型和关系；
- 相同 `GenerationSpec + seed + 生成器版本` 产生相同结果；
- SQLite 本地持久化；
- 一个环境变量配置的 Bearer Token；
- 分页、筛选、搜索的 REST API；
- JSON、CSV，以及低成本情况下的 XLSX 导出；
- 简单的创建、数据集、数据集详情、API 使用界面；
- OpenAI 兼容的 AI 服务提供方，同时保留无 AI 模板入口；
- 单应用、单 Docker 服务的本地运行方式。

Issue #2 中的简单拓扑和少量脏数据开关不是 #1 的前置条件。

## 已固定的关键设计决策

### 创建接口采用两步流程

```text
POST /api/v1/specs/from-prompt
自然语言 → 经过校验的 GenerationSpec 建议

POST /api/v1/datasets
用户确认后的 GenerationSpec → 持久化数据集
```

内置模板也提交到同一个 `POST /api/v1/datasets`，不让数据集接口同时处理提示词和规格两套模式。

### 关系明确覆盖方向

`RelationSpec` 使用：

```text
strategy = balanced | random_seeded
coverage = from | to
```

`coverage=from` 表示每个起点 CI 获得一条关系；`coverage=to` 表示每个终点 CI 获得一条关系。相同数据集内不允许重复边。

### 搜索使用受控聚合字段

CI 保存由 `ci_id`、`name`、`hostname`、`ip_address`、`management_ip`、`serial_number`、`code` 等白名单字段生成的小写 `search_text`。`q` 只查询该字段，不直接对整个 `attributes_json` 做模糊匹配，也不在 MVP 引入 FTS5。

### SQLite 首版只做轻量版本标记

首版使用 SQLite `PRAGMA user_version = 1`。空数据库自动建表并写入版本；发现不兼容的已有版本时明确停止启动并提示备份、删除后重建。MVP 不引入 Alembic 或自动升级链，真正出现保留旧数据的升级需求后再单独立项。

### 创建页采用一次性规格生成

Issue #1 的创建页固定为“一次提示词 → 结构化规格建议 → 用户调整 → 生成数据集”，使用 shadcn/ui 轻量组件实现，不强制引入聊天框架。只有未来明确需要多轮对话时才引入 assistant-ui，且不得同时维护两套 AI 创建界面。

## 开发过程中必须遵循的前端工具约束

权威要求见 [`docs/qoder-frontend-tooling.md`](docs/qoder-frontend-tooling.md)。要点：

1. **UI Skills**（https://github.com/ibelick/ui-skills）：写页面代码前完成界面设计判断，并在 Issue 完成报告中记录关键决定；
2. **shadcn/ui**（https://github.com/shadcn-ui/ui）：作为前端组件和视觉体系的基础，不引入第二套大型通用组件库；
3. **Chrome DevTools MCP**（https://github.com/ChromeDevTools/chrome-devtools-mcp）：真实浏览器检查是前端完成的必过门槛，不能以构建或 Playwright 通过替代；
4. **assistant-ui**（https://github.com/assistant-ui/assistant-ui）：保留为未来多轮对话交互的首选组件；Issue #1 的一次性规格创建界面不要求引入。

Playwright 用于自动化回归，但不能替代 Chrome DevTools MCP 的真实浏览器验收。

## 明确不做

当前不建设：

- vCenter、SNMP、Kubernetes、Redfish 等协议模拟器；
- PostgreSQL、Kafka、Redis、NetBox 等真实服务编排；
- Lab Agent、Docker socket 管理、远程 Agent；
- 时间线、故障注入、Toxiproxy、观察和验证平台；
- 多租户、RBAC、SSO；
- 图数据库或生产数字孪生；
- 通用插件、导入器或规则引擎平台。

只有实际使用证明通用 REST 或文件接口不足时，才针对一个具体缺口单独立项。

## 设计文档

- [项目状态](docs/status.md)
- [产品定义](docs/product.md)
- [精简架构](docs/architecture.md)
- [GenerationSpec 与数据模型](docs/scenario-model.md)
- [生成与接口策略](docs/backend-strategy.md)
- [前端设计](docs/frontend-design.md)
- [前端开发工具约束](docs/qoder-frontend-tooling.md)
- [安全与许可证](docs/security-and-licensing.md)
- [开发与代码审查流程](docs/development-workflow.md)
- [精简路线图](docs/roadmap.md)

`docs/research/` 是早期工具调研，只用于未来选型参考，不是当前实现清单。

## 许可证

InfraSourceLab 使用 [Apache License 2.0](LICENSE)。