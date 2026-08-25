# Qoder Go Mode + direct-main 开发与 Review

## 1. 当前开发方式

InfraSourceLab 采用个人快速开发：

- 一个较大的 MVP Issue；
- Qoder Go Mode 端到端实现；
- 不强制 PR；
- 完成后直接 push `main`；
- 外部 Review 使用 Base SHA...Head SHA；
- Critical/Important 修完后关闭 Issue。

这种方式的关键不是增加流程，而是**防止 Go Mode 自行扩张产品范围**。

---

## 2. 当前权威范围

开发前只读：

```text
README.md
docs/product.md
docs/architecture.md
docs/scenario-model.md
docs/backend-strategy.md
docs/frontend-design.md
docs/security-and-licensing.md
docs/development-workflow.md
目标 Issue
```

`docs/research/` 是历史调研，不是实现要求。

Closed Issues #3～#8 不得作为待开发 backlog。

---

## 3. 开始前

```bash
git checkout main
git pull --ff-only
git status --short
git rev-parse HEAD
```

在 #1 留言：

```text
Go Mode implementation started.
Base SHA: <sha>
```

Working tree 应干净。

---

## 4. 给 Qoder 的首要指令

```text
Implement Issue #1 end-to-end on current main.
This is a lean single-application CMDB data generator.
Do not add closed or future platform features.
Use SQLite, one API key, a deterministic local generator, a simple authenticated REST API, exports and a small UI.
Use UI Skills + shadcn/ui + assistant-ui + Chrome DevTools MCP for frontend work.
Do not create a PR; push main only after all gates pass.
```

---

## 5. 可以自主决定

Qoder 可以在范围内决定：

- 文件组织；
- 类/函数命名；
- SQLAlchemy 模型细节；
- Pydantic model 组织；
- shadcn 组件组合；
- 测试拆分；
- 普通错误处理；
- 局部重构；
- 导出库选择；
- Mimesis/Faker 的合理分工。

---

## 6. 不允许自行增加

```text
Lab Agent
Docker socket
PostgreSQL required deployment
Redis / Celery / queue
microservices
Compile / Run / Truth Version
Timeline / Fault / Toxiproxy
Observation / Verifier
protocol simulators
real service orchestration
remote Agent
RBAC / OAuth / SSO
attachments/importer framework
graph database
plugin system
100k platform optimization
```

也不要为了“未来扩展”创建大量空 interface、空目录、抽象工厂或占位页面。

如果实现中发现 #1 无法完成，先报告真正阻塞，不用新平台掩盖问题。

---

## 7. 前端开发闭环

```text
主用户任务
  ↓
UI Skills：层级/流程
  ↓
shadcn registry/docs：找现成组件
  ↓
assistant-ui：Create 页
  ↓
实现
  ↓
Chrome DevTools MCP：真实点击/Console/Network
  ↓
修正
  ↓
Playwright 固化
```

前端只需完成：

```text
Create
Datasets
Dataset Detail
API & Export
Settings/API key
```

不要做 fake navigation 或灰色占位的平台菜单。

---

## 8. 实现顺序

推荐：

### Step 1：后端最小闭环

```text
SQLite models
API key middleware/dependency
GenerationSpec
built-in generators
relations
Dataset APIs
```

先用固定 spec 跑通。

### Step 2：AI

```text
OpenAI-compatible provider
prompt → spec
fake provider
unconfigured fallback
```

### Step 3：导出

JSON → CSV → XLSX。

### Step 4：前端

Create → Dataset Detail → API/Export。

### Step 5：真实浏览器与 E2E

不要先花大量时间打磨空壳 UI。

---

## 9. 本地 Gate

### Backend

```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy
uv run pytest
```

### Frontend

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

### Integration

至少：

- fresh SQLite startup；
- wrong/missing/correct Bearer key；
- fake prompt → valid spec；
- deterministic data generation；
- relation integrity；
- 10k smoke；
- pagination/filter/search；
- JSON/CSV/XLSX export；
- one-command Docker startup；
- Playwright main path。

---

## 10. Chrome DevTools MCP Gate

真实 Chrome 至少检查：

```text
API key entry
→ prompt
→ structured spec
→ edit counts/seed
→ generate
→ browse CI
→ browse relations
→ copy curl
→ export
```

同时检查：

- AI unconfigured/template fallback；
- wrong key 401；
- loading/error/empty；
- long prompt/name；
- 10k paginated table；
- 1024/1280/1440/1920；
- Console；
- Network；
- keyboard/focus。

不要求为未实现的 topology/平台页面截图。

---

## 11. 提交策略

可以有少量有意义 commits：

```text
feat(core): add generation spec and deterministic generators
feat(api): add authenticated dataset API
feat(web): add create and dataset pages
feat(export): add JSON CSV XLSX export
fix: resolve review findings
```

不要求每个小功能提交一次，也不需要 PR。

---

## 12. 完成回报

在 #1 留言：

```text
Implementation complete.

Base SHA: ...
Head SHA: ...

Implemented:
- ...

Validation:
- backend ... PASS
- web ... PASS
- integration ... PASS
- Playwright ... PASS

Evidence:
- sample prompt and validated spec
- generated CI/relation counts
- same spec+seed deterministic comparison
- curl with Bearer Token
- wrong key 401
- JSON/CSV/XLSX exports
- Docker startup

Chrome DevTools MCP:
- version
- flows
- widths
- Console
- Network
- screenshots

Known limitations:
- ...
```

先不要关闭。

---

## 13. 外部 Review

Review 范围：

```text
Base...Head commits
current main critical files
actual tests
Docker startup
API auth
sample generation
browser evidence
```

优先级：

```text
Critical
Important
Minor
```

Critical/Important 必须修。

重点不是检查是否有“企业级架构”，而是：

- 核心路径是否真的可用；
- 数据是否合理且关系完整；
- API 是否简单可调用；
- Bearer auth 是否生效；
- 是否出现不必要的平台化代码；
- UI 是否省力；
- 导出是否正确。

---

## 14. 修复

修复 session 只读：

- #1；
- Review comment；
- 当前 main；
- 相关精简文档。

只修 findings，不进入 #2，不增加未来功能。

---

## 15. 停止规则

当下面链路通过：

```text
Prompt / Template
→ GenerationSpec
→ 10k coherent CI + relations
→ Bearer REST API
→ JSON/CSV/XLSX
→ DLR/curl reads data
```

#1 就完成。

不要因为还有 token、时间或“架构上顺便”继续增加功能。先实际使用，再决定 #2。