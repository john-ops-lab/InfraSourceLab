# InfraSourceLab 总体架构

## 1. 架构目标

InfraSourceLab 的架构服务于五个核心性质：

1. **确定性**：同一 Scenario Revision 在相同编译器/生成器版本下可重复构建；
2. **可扩展**：新增数据源主要增加 Driver，不侵入核心编译器；
3. **不造协议轮子**：优先编排成熟模拟器或真实轻量服务；
4. **可验证**：Ground Truth 从编译开始就是一等数据；
5. **低交互成本**：普通用户通过 AI / Visual Builder 创建场景，YAML 只是 Expert representation。

---

## 2. 总体架构

```text
┌──────────────────────────────────────────────────────────────┐
│ Web                                                          │
│ React 19 + TypeScript + Vite 7                               │
│ Tailwind CSS v4 + shadcn/ui                                  │
│ assistant-ui + Monaco (Expert YAML) + i18next                │
│                                                              │
│ AI Create / Visual Builder / Scenario / World / Sources      │
│ Timeline / Runs / Verification / Expert YAML                 │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP / JSON / SSE
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ Control                                                      │
│ FastAPI + Pydantic + SQLAlchemy + Alembic                   │
│                                                              │
│ Authoring / Scenario / Revision / Compiler                   │
│ Truth Graph / Projection / Driver Registry                   │
│ Run State / Timeline / Observation / Verification            │
│ AI Gateway / Importers                                       │
└───────────────┬──────────────────────────────┬───────────────┘
                │                              │
                ▼                              ▼
┌──────────────────────────┐       ┌───────────────────────────┐
│ PostgreSQL               │       │ Lab Agent                 │
│ metadata / truth / runs  │       │ privileged runtime plane │
│ projections / reports    │       │ Docker orchestration      │
└──────────────────────────┘       │ allowlisted Drivers       │
                                   └─────────────┬─────────────┘
                                                 │
                        ┌────────────────────────┼───────────────────────┐
                        │                        │                       │
                        ▼                        ▼                       ▼
              Protocol Simulators        Real Services          Contract/Replay
              vcsim / KWOK /             PostgreSQL /           Mockoon / Prism /
              snmpsim / Redfish /        Redis / Kafka /        Hoverfly / etc.
              FakeNOS / ...              MQTT / ...
                        │                        │                       │
                        └────────────────────────┼───────────────────────┘
                                                 ▼
                                        Per-Run Lab Network
                                                 │
                                                 ▼
                                       DLR / CMDB / Test Client
                                                 │
                                                 ▼
                                          Observation API
                                                 │
                                                 ▼
                                              Verifier
```

### 开发时前端设计闭环

```text
Product requirement
      ↓
UI Skills / design playbook
      ↓
shadcn component composition
      ↓
Implementation
      ↓
Chrome DevTools MCP real-browser inspection
      ↓
visual / console / network / performance iteration
      ↓
Playwright regression
```

`ui-skills` 与 `chrome-devtools-mcp` 是开发/验收工具，不进入产品 runtime。Qoder 的具体使用见 `docs/qoder-frontend-tooling.md`。

---

## 3. Control 与 Lab Agent 分离

启动容器、创建网络、挂载文件、分配端口等能力接近 Docker 主机管理权限。如果 Control 直接挂载 Docker socket，一个普通 Web/API 漏洞可能扩大为宿主机高权限风险。

### Control

负责可信平台状态：

- unsaved Working Copy validation / estimate；
- Scenario CRUD / immutable Revision；
- 编译；
- Truth Graph；
- Run 状态机；
- verification；
- AI Gateway；
- importer；
- 发出结构化 Agent Command。

### Lab Agent

唯一可以接触 Docker Engine：

- 按 Driver allowlist 启动允许的镜像；
- 创建 per-run network / volumes；
- 写生成配置；
- health；
- driver-defined lifecycle action；
- 受控日志；
- teardown / GC。

Agent **不接受任意 shell command、任意 image name 或任意 host mount**。

第一版 Control 与 Agent 可以同机，但协议边界从第一天存在。

---

## 4. 核心领域模块

后端保持模块化单体：

```text
backend/
  app/
    authoring/
    scenario/
    compiler/
    truth/
    projection/
    drivers/
    runs/
    timeline/
    observations/
    verification/
    ai/
    imports/
    api/
```

### authoring

处理**尚未持久化**的 Working Copy：

- parse；
- schema/semantic validation；
- capability validation；
- resource estimate；
- normalized typed document；
- semantic digest；
- structured diagnostics/change summary。

它不能要求已经存在 `scenario_id`，否则 AI-first 新建流程会被迫“先保存一个空场景”。

### scenario

- Scenario metadata；
- Working Copy wire model；
- immutable Revision；
- revision provenance；
- source/semantic digests。

AI、Visual Builder、Expert YAML 最终都读写同一 Scenario model/Working Copy，不存在三套业务模型。

### compiler

```text
Immutable Scenario Revision
  → parse normalized document
  → schema validation
  → semantic validation
  → normalize defaults
  → deterministic allocation
  → Truth Graph
  → Source Projection
  → Driver Plan
  → Compile Manifest
```

**Authoring Preview 可以对未保存 Working Copy validate/estimate，但 authoritative Compile 只接受 immutable Scenario Revision。**

Compiler 不启动容器。

### truth

维护 canonical entities / relationships 及每个 Truth Version。

### projection

把 canonical world 转为来源可见世界：field mapping、identity mapping、omit、duplicate、corruption、staleness、source-specific relationships。

### drivers

Driver Registry + capability contracts。Core 只知道能力，不依赖具体工具内部实现。

### runs

协调 Lab Run 的 prepare/start/ready/stop/fail/cleanup。

### timeline

通过 typed action 对 Truth Version、Source Projection 和 Driver runtime 执行变化。

### observations / verification

接受下游结果，标准化并与 Source Projection / Ground Truth 比较。

### ai

AI 是 Scenario authoring / import / explain 层，不拥有运行面高权限。

---

## 5. Scenario Authoring 架构

产品不是 YAML-first。

```text
AI Create ────────┐
Visual Builder ───┼──→ Scenario Working Copy
Expert YAML ──────┘          │
                             ├─ parse/schema diagnostics
                             ├─ semantic diagnostics
                             ├─ driver capability validation
                             ├─ resource estimate
                             └─ semantic digest
                             │
                             ▼
                       Save Revision
```

### 单一状态原则

Visual Builder 不维护独立业务 JSON，YAML Editor 也不维护独立业务副本。可以有 UI form state/editor buffer，但提交 Authoring service 后必须收敛到同一 typed document。

Builder 改了而 Expert YAML 语义没变、或反之，属于严重 bug。

### Working Copy 不等于 Revision

Working Copy 可以反复修改和预览；只有显式 Save 才产生 immutable Revision。

AI Candidate 只修改 Working Copy，不能自动 Save。

---

## 6. Authoring / Persistence / Compile API 边界

这是产品易用性与可审计性的关键边界。

### 6.1 Unsaved authoring API

新建场景还没有 Scenario ID，因此必须允许直接提交 Working Copy payload：

```text
POST /api/authoring/validate
POST /api/authoring/estimate
POST /api/ai/scenario-candidate     # M1
```

请求中携带当前 typed document / YAML representation、base semantic digest（如有）和必要上下文。

这些 API：

- 可以在保存前使用；
- 不产生 authoritative Revision；
- 不启动容器；
- 不产生 authoritative Compile Manifest。

### 6.2 Scenario persistence API

```text
GET  /api/scenarios
POST /api/scenarios
GET  /api/scenarios/{id}
GET  /api/scenarios/{id}/revisions
POST /api/scenarios/{id}/revisions
GET  /api/scenarios/{id}/revisions/{revision_id}
```

创建 Scenario metadata 与保存 Revision 是两个概念；实现可以在 UX 上合并为一次“Create/Save”动作，但 domain 里必须保留 immutable revision semantics。

### 6.3 Compile API

建议 noun-style：

```text
POST /api/compiles
GET  /api/compiles/{id}
```

`POST /api/compiles` 必须引用：

```text
scenario_revision_id
```

而不是任意浏览器 Working Copy。

Compile Manifest 记录 revision/source/semantic digest 与编译器/生成器/Driver provenance。

### 6.4 Run API

```text
POST /api/runs
GET  /api/runs
GET  /api/runs/{id}
POST /api/runs/{id}/stop
POST /api/runs/{id}/cleanup
```

Start Run 必须引用一个成功且完整的 `compile_id` / immutable Compile Manifest。不能从当前未保存 Working Copy 直接启动。

### 6.5 Ground Truth / Observation / Verify

```text
/api/compiles/{id}/truth/...
/api/runs/{id}/sources
/api/runs/{id}/timeline
/api/runs/{id}/observations
/api/runs/{id}/verify
```

Ground Truth API 必须分页/filter，测试程序不直读内部 DB。

---

## 7. Revision Digest 与 AI Staleness

Builder 与 YAML 的序列化格式可能不同，不能仅靠 raw text hash 判断“语义是否变化”。

每个 Revision/Working Copy 建议至少有：

```text
source_digest    = raw YAML/source text 的 hash
semantic_digest  = canonical normalized typed document 的 hash
```

用途：

- `source_digest`：精确 artifact provenance / 原文审计；
- `semantic_digest`：AI Candidate base、Builder/YAML 同步、semantic staleness、compile input identity。

AI Candidate 必须携带 `base_semantic_digest`。

M1 起的最小安全合同：

```text
candidate.base_semantic_digest == current Working Copy semantic_digest
```

才允许直接 Apply；不相等必须阻止 blind overwrite。M5 再提供 richer 3-way diff/rebase/regenerate UX。

---

## 8. Driver 架构

### Driver Contract

```python
class Driver(Protocol):
    name: str
    version: str

    def capabilities(self) -> DriverCapabilities: ...
    def validate(self, source: CompiledSource) -> list[Diagnostic]: ...
    def render(self, source: CompiledSource, workspace: Path) -> DriverManifest: ...
    async def start(self, ctx: RunContext, manifest: DriverManifest) -> RuntimeEndpoint: ...
    async def health(self, ctx: RunContext) -> Health: ...
    async def apply(self, ctx: RunContext, action: TimelineAction) -> ActionResult: ...
    async def stop(self, ctx: RunContext) -> None: ...
    async def cleanup(self, ctx: RunContext) -> None: ...
```

Driver 必须声明：protocol、feature、timeline、fault、architecture、version、license、resource hints。

Driver 类型：

- `artifact`；
- `contract-mock`；
- `protocol-emulator`；
- `real-service`；
- `record-replay`；
- `external`。

Compiler 不 import 具体 Driver implementation，只通过 registry/capability contract 交互。

### Backend capability 以实际 pin 版本为准

不能因为上游 `main` 有某能力就宣称当前 Driver 可用。每个默认 Driver：

- pin 明确版本/image tag/digest；
- registry 声明该版本 capability；
- integration test 验证关键能力；
- 升级版本时重跑 compatibility tests。

---

## 9. Lab Run 生命周期

```text
DRAFT WORKING COPY
  ↓ Save
REVISION
  ↓ Compile
COMPILED
  ↓ Start
PREPARING
  ↓
STARTING
  ↓ health
READY
  ↓ step / faults / observations
READY
  ↓ Stop
STOPPING
  ↓
STOPPED
  ↓ Cleanup
CLEANED
```

异常进入 `FAILED`，随后允许/要求 cleanup。

关键合同：

- Run 引用 immutable Revision + Compile Manifest；
- 所有容器/network/volume/resource 使用 run-scoped labels；
- cleanup 幂等；
- Control 重启后根据 Agent + real runtime state reconcile；
- DB 状态不等于 Docker 真实状态。

---

## 10. Per-Run 隔离

每次 Run 建独立 network，例如 `isl-run-<id>`。

统一 label：

```text
io.infrasourcelab.managed=true
io.infrasourcelab.run=<run_id>
io.infrasourcelab.driver=<driver>
io.infrasourcelab.source=<source_name>
```

原则：

- 默认不 publish 到 `0.0.0.0`；
- 需要宿主机访问时绑定 `127.0.0.1` 随机端口；
- 用户显式 LAN 暴露时才开放；
- source secrets 每 run 生成；
- teardown 只删除本 run label 的资源。

---

## 11. 数据存储

PostgreSQL 16。

核心表族：

```text
scenarios
scenario_revisions
compile_manifests
truth_versions
truth_nodes
truth_edges
source_projections
lab_runs
run_sources
run_events
observations
verification_reports
```

Revision 至少保存：

```text
raw source text
normalized typed document
source_digest
semantic_digest
schema version
created_at / sequence
```

第一阶段不引入图数据库。

生成文件使用 workspace/artifact store：

```text
runs/<run-id>/
  manifest.json
  sources/<name>/...
  reports/...
```

DB 保存 path/digest/metadata。

---

## 12. 前端信息架构

不继承 DLR Shell/Catalog，不以 Monaco 为主工作区。

一级入口建议：

```text
Create Lab / Home
Scenarios
Runs
Sources / Drivers
Verification
Settings
```

Scenario detail：

```text
Overview
Builder
World
Sources
Timeline
Runs
Verify
Expert YAML
```

新建场景：

```text
What do you want to simulate?
[ AI composer + examples ]

Start from
[ Guided Builder ] [ Template ] [ Expert YAML ]
```

`Import` 在 M5 Importer Registry 真正可用前不作为可点击主入口；不要提前放一个 dead/disabled fake CTA。

具体页面布局由 UI Skills 指导、shadcn 组件组合和真实 Chrome 迭代决定，不把旧截图/旧产品布局写死为架构。

---

## 13. 前端技术与组件边界

运行时：

| 类别 | 选型 |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 7 |
| Styling | Tailwind CSS v4 |
| Component system | shadcn/ui |
| AI UX | assistant-ui |
| Expert editor | Monaco Editor |
| i18n | i18next |
| component tests | Vitest + Testing Library |
| browser regression | Playwright |

开发/验收：

| 工具 | 作用 |
|---|---|
| UI Skills | 页面设计、交互与视觉工程参考 |
| Chrome DevTools MCP | 实机点击、截图、Console、Network、Performance、响应式检查 |

明确不采用 Ant Design / Ant Design Pro / DLR Design System。

详见 `docs/frontend-design.md` 与 `docs/qoder-frontend-tooling.md`。

---

## 14. AI 架构

基础 authoring 从 M1 开始可真实使用，但 AI 是 optional enhancement：**未配置 AI Provider 时 Builder/Expert YAML/validate/estimate/compile/run 仍必须可用。**

```text
User prompt
+ current Scenario Working Copy
+ Scenario schema
+ Driver Capability Registry
+ resource policy
        ↓
       LLM
        ↓
Scenario Candidate
        ↓
strict parse / schema / semantic / capability / resource validation
        ↓
structured proposal
        ↓
User Apply → Working Copy
```

Provider abstraction：

```python
class AiProvider(Protocol):
    async def complete(self, request: AiRequest) -> AiResponse: ...
```

M1 至少 OpenAI-compatible HTTP provider。Provider secret 只在 server-side；Web 只能看到 configured/unconfigured/health-like capability state，不得到 secret。

### AI 权限

AI 可：

- 读 Scenario schema；
- 读 Driver capabilities；
- validate / estimate；
- 提议修改；
- 解释 diagnostics / verification。

AI 不可自动：

- Save Revision；
- authoritative Compile；
- Start/Stop/Delete Run；
- Step Timeline / destructive Fault；
- 任意 shell/Docker；
- 绕过 driver/image allowlist；
- 读取 secrets。

### M5 扩展

M5 不再“第一次接 AI”，而增加：attachments/importers、context snippets、read-only tool calls、Regenerate/frozen snapshots、advanced 3-way conflict UX 和 richer generative UI。

---

## 15. 前端验收架构

UI Wave 完成定义包含真实 Chrome：

```text
Agent implementation
    ↓
Chrome DevTools MCP
    ├─ click flow
    ├─ screenshot
    ├─ console
    ├─ network
    ├─ performance trace (heavy pages)
    └─ responsive widths
    ↓
fix / iterate
    ↓
Playwright regression
```

至少验证 1024 / 1280 / 1440 / 1920。实验平台不强制 mobile-first，但不能出现基本布局/操作歧义。

---

## 16. Observability

平台至少输出：structured logs、run lifecycle events、source health、start/compile duration、entity/edge counts、Agent command duration/error、verification summary。

后期可加 Prometheus metrics，M0 不引入完整 tracing stack。

---

## 17. 可恢复性与 GC

从 M0 考虑：

- run-scoped labels；
- Agent startup reconciliation；
- manual cleanup；
- orphan detection；
- TTL 可选；
- cleanup dry-run；
- 不删除未知/无 ISL label 资源。

---

## 18. 核心不可破坏约束

后续任何 Wave 不得静默改变：

1. AI-first / Builder / Expert YAML 的 authoring 层级；
2. Working Copy 可未保存 validate/estimate；
3. authoritative Compile 只基于 immutable Revision；
4. Run 只基于成功 Compile Manifest；
5. Truth-first + Source Projection；
6. Core 不重新实现成熟协议；
7. Control 无 Docker socket；
8. Agent typed command + allowlisted runtime；
9. AI 无运行面写权限；
10. shadcn/ui 是唯一主要通用组件体系；
11. Driver capabilities 以实际 pin 版本和测试为准。