# InfraSourceLab 总体架构

## 1. 架构目标

InfraSourceLab 的架构服务于五个核心性质：

1. **确定性**：同一 Scenario Revision 可以重复构建；
2. **可扩展**：新增数据源主要增加 Driver，不侵入核心编译器；
3. **不造协议轮子**：尽量编排成熟模拟器或真实服务；
4. **可验证**：Ground Truth 从编译开始就是一等数据；
5. **低交互成本**：普通用户通过 AI / Visual Builder 创建场景，YAML 只作为专家资产。

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
│ Scenario / Revision / Compiler                              │
│ Truth Graph / Projection / Driver Registry                  │
│ Run State / Timeline / Observation / Verification           │
│ AI Gateway / Importers                                      │
└───────────────┬──────────────────────────────┬───────────────┘
                │                              │
                ▼                              ▼
┌──────────────────────────┐       ┌───────────────────────────┐
│ PostgreSQL               │       │ Lab Agent                 │
│ metadata / truth / runs  │       │ privileged runtime plane  │
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

运行架构之外，前端实现必须经过：

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

`ui-skills` 与 `chrome-devtools-mcp` 是开发/验收工具，不进入产品运行时。

---

## 3. Control 与 Lab Agent 分离

启动容器、创建网络、挂载文件、分配端口等能力接近 Docker 主机管理权限。如果 Control 直接挂载 Docker socket，一个普通 Web/API 漏洞可能扩大为宿主机高权限风险。

因此：

### Control

负责可信平台状态：

- Scenario CRUD / revision；
- Working Copy validation；
- 编译；
- Truth Graph；
- Run 状态机；
- verification；
- AI Gateway；
- importer；
- 发出结构化 Agent Command。

### Lab Agent

唯一可以接触 Docker Engine 的组件：

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

### scenario

- Scenario；
- Working Copy wire model；
- immutable Revision；
- schema validation；
- revision fingerprint。

AI、Visual Builder、Expert YAML 最终都必须提交到同一个 Scenario model/Working Copy，不存在三套业务模型。

### compiler

```text
Scenario Revision
  → parse
  → schema validation
  → semantic validation
  → normalize defaults
  → deterministic allocation
  → Truth Graph
  → Source Projection
  → Driver Plan
  → Compile Manifest
```

Compiler 不启动容器。

### truth

维护 canonical entities / relationships 及每个 truth version。

### projection

把 canonical world 转为来源可见世界：field mapping、identity mapping、omit、duplicate、corruption、staleness、source-specific relationship mapping。

### drivers

Driver Registry + capability contracts。Core 只知道能力，不依赖具体工具内部实现。

### runs

协调 Lab Run 的 prepare/start/ready/stop/fail/cleanup。

### timeline

通过 typed action 对 Truth version、Source Projection 和 Driver Runtime 执行变化。

### observations / verification

接受下游结果，标准化并与 Source Projection / Ground Truth 比较。

### ai

AI 是 Scenario authoring / import / explain 层，不拥有运行面高权限。

---

## 5. Scenario Authoring 架构

产品不是 YAML-first。

```text
┌─────────────────┐
│ AI Create       │
└────────┬────────┘
         │
┌────────▼────────┐
│ Visual Builder  │
└────────┬────────┘
         │
┌────────▼────────┐
│ Expert YAML     │
└────────┬────────┘
         │
         ▼
 Scenario Working Copy
         │
         ├─ schema diagnostics
         ├─ semantic diagnostics
         ├─ driver capability validation
         ├─ resource estimate
         └─ structured change summary
         │
         ▼
    Save Revision
```

### 单一状态原则

Visual Builder 不维护独立 JSON，YAML Editor 也不维护独立业务副本。所有视图围绕统一 Scenario Working Copy 读写。

需要时可以采用内部 typed model + YAML serialization，但“Builder 改了，YAML 没改”属于严重 bug。

---

## 6. Driver 架构

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

---

## 7. Lab Run 生命周期

```text
DRAFT
  ↓ compile
COMPILED
  ↓ start
PREPARING
  ↓
STARTING
  ↓ health
READY
  ↓ step / faults / observations
READY
  ↓ stop
STOPPING
  ↓
STOPPED
  ↓ cleanup
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

## 8. Per-Run 隔离

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

## 9. 数据存储

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

## 10. API 边界

建议：

```text
/api/scenarios
/api/scenarios/{id}/revisions
/api/scenarios/{id}/validate
/api/scenarios/{id}/estimate
/api/compile
/api/drivers
/api/runs
/api/runs/{id}/sources
/api/runs/{id}/timeline
/api/runs/{id}/truth
/api/runs/{id}/observations
/api/runs/{id}/verify
/api/ai
/api/imports
/api/health
```

Ground Truth API 必须支持分页/filter，不能要求测试程序直读内部 DB。

---

## 11. 前端信息架构

不继承 DLR 的 Shell/Catalog 布局，不以 Monaco 为主工作区。

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
[ Guided Builder ] [ Template ] [ Import ] [ Expert YAML ]
```

具体页面布局由 UI Skills 指导、shadcn 组件组合和真实 Chrome 迭代决定，不把某张旧截图或某个旧产品布局写死为架构。

---

## 12. 前端技术与组件边界

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

开发/验收工具：

| 工具 | 作用 |
|---|---|
| UI Skills | 页面设计、交互与视觉工程参考 |
| Chrome DevTools MCP | 实机点击、截图、Console、Network、Performance、响应式检查 |

明确不采用 Ant Design / Ant Design Pro / DLR Design System。

详见 `docs/frontend-design.md`。

---

## 13. AI 架构

基础 authoring 从 M1 开始可真实使用。

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

M1 至少 OpenAI-compatible HTTP provider；以后可增加其他 provider。

### AI 权限

AI 可：

- 读 Scenario schema；
- 读 Driver capabilities；
- validate / estimate；
- 提议修改；
- 解释 diagnostics / verification。

AI 不可：

- 任意 shell；
- Docker；
- 自动 Save；
- 自动 Start/Stop/Delete；
- 绕过 driver/image allowlist；
- 读取 secrets。

### M5 扩展

M5 不再“第一次接 AI”，而是增加：attachments/importers、context snippets、read-only tool calls、Regenerate/frozen snapshots、advanced conflict UX 和 richer generative UI。

---

## 14. 前端验收架构

UI Wave 的完成定义包含真实 Chrome：

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

至少验证 1280 / 1440 / 1920 desktop 与 1024 窄桌面。实验平台不强制 mobile-first，但不能出现基本布局崩坏。

---

## 15. Observability

平台至少输出：structured logs、run lifecycle events、source health、start/compile duration、entity/edge counts、Agent command duration/error、verification summary。

后期可加 Prometheus metrics，M0 不引入完整 tracing stack。

---

## 16. 可恢复性与 GC

从 M0 就必须考虑：

- run-scoped labels；
- Agent startup reconciliation；
- manual cleanup；
- orphan detection；
- TTL 可选；
- cleanup dry-run；
- 不删除未知/无 ISL label 资源。

---

## 17. 架构红线

- 不把 YAML Expert Mode 作为默认创建流程；
- 不让 Builder/AI/YAML 维护三套状态；
- 不重新实现已有成熟协议；
- Control 不持有 Docker socket；
- Agent 不接受任意命令/image/mount；
- 不引入 Ant Design 作为第二套组件系统；
- 不从 DLR 复制前端视觉/CSS/Shell；
- AI 不能执行运行面高权限动作；
- UI 不能只通过 build 就宣布完成，必须有真实 Chrome 证据。