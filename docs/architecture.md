# InfraSourceLab 总体架构

## 1. 架构目标

InfraSourceLab 的架构服务于四个核心性质：

1. **确定性**：同一 Scenario Revision 可以重复构建；
2. **可扩展**：新增数据源主要增加 Driver，不侵入核心编译器；
3. **不造协议轮子**：尽量编排成熟模拟器或真实服务；
4. **可验证**：Ground Truth 从编译开始就是一等数据，不是运行后的附属物。

---

## 2. 总体架构

```text
┌─────────────────────────────────────────────────────────────┐
│ Web                                                         │
│ React + TypeScript + Vite + Ant Design + Monaco            │
│ assistant-ui + i18next                                     │
│                                                             │
│ Scenario Catalog / Editor / Source Views / Runs / Reports   │
│ AI Scenario Assistant                                      │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP / JSON / SSE
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ Control                                                     │
│ FastAPI + Pydantic + SQLAlchemy + Alembic                  │
│                                                             │
│ Scenario / Revision / Compiler                             │
│ Truth Graph / Projection / Driver Registry                 │
│ Run State / Timeline / Observation / Verification          │
│ AI Gateway / Importers                                     │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────┐       ┌──────────────────────────┐
│ PostgreSQL               │       │ Lab Agent                │
│ metadata / truth / runs  │       │ privileged runtime plane │
│ projections / reports    │       │ Docker orchestration     │
└──────────────────────────┘       │ allowlisted Drivers       │
                                   └────────────┬─────────────┘
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

---

## 3. 为什么必须拆 Control 和 Lab Agent

启动容器、创建网络、挂载文件、分配端口等能力接近 Docker 主机管理权限。如果 Control 直接挂载 `/var/run/docker.sock`，一个普通 Web/API 漏洞就可能扩大成宿主机高权限风险。

因此采用与 DLR “Control 不直接执行用户 Adapter”类似的分离思想：

### Control

负责可信平台状态：

- Scenario CRUD / revision；
- 编译；
- Truth Graph；
- validation；
- Run 状态机；
- verification；
- AI；
- 用户请求鉴权（后期）；
- 发出结构化 Agent Command。

### Lab Agent

唯一可以接触 Docker Engine 的组件：

- 按 Driver allowlist 拉取/启动允许的镜像；
- 创建 per-run network / volumes；
- 写生成的配置；
- 查询 health；
- 执行 driver-defined lifecycle action；
- 收集受控日志；
- teardown / GC。

Agent **不接受 Control 传来的任意 shell command、任意 image name 或任意 host mount**。

第一版 Control 与 Agent 可以部署在同一台机器，但协议边界从第一天存在，为未来 remote Agent 留出空间。

---

## 4. 核心领域模块

建议后端保持模块化单体，不要过早拆微服务：

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
- Working Copy；
- immutable Revision；
- schema validation；
- revision fingerprint。

### compiler

纯函数优先：

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

把 canonical world 转为来源可见世界，包括：

- field mapping；
- identity mapping；
- omit；
- duplicate；
- corruption；
- staleness；
- source-specific relationship mapping。

### drivers

Driver Registry + capability contracts。核心代码只知道能力，不知道某个工具内部实现。

### runs

协调一次 Lab Run 的 prepare/start/ready/stop/fail/cleanup。

### timeline

根据 manual step / virtual clock 对 Truth version、Source Projection 和 Driver Runtime 执行变化。

### observations / verification

接受下游结果，标准化并与 Ground Truth 比较。

### ai

仅用于 Scenario authoring / import assistance。AI 没有运行面高权限。

---

## 5. Driver 架构

### 5.1 Driver Contract

建议 Driver 采用 Python Protocol / ABC，第一版接口大致包含：

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

### 5.2 Driver 必须声明 capability

例如：

```yaml
name: snmpsim
kind: protocol-emulator
protocols: [snmp-v1, snmp-v2c, snmp-v3]
features:
  dynamic-data: true
  lifecycle-patch: true
  protocol-errors: true
  record-replay: true
  network-fault-proxy: true
resourceHints:
  cpu: low
  memory: low
```

Scenario 编译时先检查 capability，避免运行到一半才发现 backend 不支持某个 fault。

### 5.3 Driver 类型

- `artifact`：写 JSON/YAML/CSV/Excel；
- `contract-mock`：生成 OpenAPI/Mockoon/Prism 等配置；
- `protocol-emulator`：vcsim/KWOK/snmpsim/Redfish/FakeNOS；
- `real-service`：启动真实数据库/消息系统；
- `record-replay`：从 capture 生成响应；
- `external`：连接用户已存在的实验系统，后期支持。

### 5.4 Driver Package 与 Core 解耦

第一版可放单仓库，但目录上保持：

```text
drivers/
  artifact/
  http_mockoon/
  postgresql/
  vcsim/
  kwok/
  snmpsim/
  redfish/
  fakenos/
```

不要让 `compiler/` import 具体 driver implementation；只通过 registry/capability schema 交互。

---

## 6. Lab Run 生命周期

```text
DRAFT
  ↓ compile
COMPILED
  ↓ start
PREPARING
  ↓
STARTING
  ↓ all required health checks
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

异常：

```text
PREPARING/STARTING/READY/STOPPING
               ↓
             FAILED
               ↓
            cleanup
```

### 关键合同

- Run 永远引用 immutable Scenario Revision + Compile Manifest；
- 一个 Run 有稳定 `run_id`；
- 所有容器/network/volume/resource 使用 run-scoped labels；
- cleanup 必须幂等；
- Control 崩溃重启后能根据 Agent + labels 恢复/判定真实 runtime 状态；
- 不能因为 DB 状态说 STOPPED 就假设容器一定不存在。

---

## 7. Per-Run 隔离

每次 Lab Run 建独立 Docker network，例如：

```text
isl-run-<id>
```

容器统一 label：

```text
io.infrasourcelab.managed=true
io.infrasourcelab.run=<run_id>
io.infrasourcelab.driver=<driver>
io.infrasourcelab.source=<source_name>
```

原则：

- 默认不 publish 到 `0.0.0.0`；
- 需要宿主机访问时绑定 `127.0.0.1` 随机端口；
- 容器之间用 run network DNS 名访问；
- 用户显式选择 LAN 暴露时才开放；
- source secrets 每 run 单独生成；
- teardown 只删除带本 run label 的资源。

---

## 8. 数据存储

建议 PostgreSQL 16，与 DLR 技术栈一致。

### 核心表族

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

### Truth Graph 是否需要图数据库？

第一阶段不需要。

CMDB 规模在开发测试阶段即使达到 10 万节点，PostgreSQL 的：

- normalized edge table；
- JSONB attributes；
- composite indexes；
- batch insert；
- recursive CTE（必要时）；

足以完成生成、查找、差异和验证。引入 Neo4j 等额外数据库会增加部署和维护成本。

### 大对象/生成文件

生成的 CSV、OpenAPI、Mockoon config、SNMP records、capture 等不直接塞进 JSONB：

```text
runs/<run-id>/
  manifest.json
  sources/<name>/...
  reports/...
```

DB 只保存 path/digest/metadata。以后可抽象 Artifact Store。

---

## 9. API 边界

建议第一版 API 分为：

```text
/api/scenarios
/api/scenarios/{id}/revisions
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

### Ground Truth API

必须支持：

- nodes filter/page；
- edges filter/page；
- entity detail；
- source projection view；
- injected defects；
- truth version；
- manifest digest。

不要让测试程序必须读 ISL 内部数据库。

---

## 10. 前端信息架构

继续使用 DLR 的高密度工作台布局：

```text
┌─────────────────────────────────────────────────────────────┐
│ Top Bar: ISL / health / active run / settings              │
├──────────────┬──────────────────────────────────────────────┤
│ Scenario     │ Scenario Workbench                           │
│ Catalog      │                                              │
│              │ Header: revision / compile / start           │
│ search       │ Tabs:                                        │
│ filters      │  Editor | World | Sources | Timeline | Runs  │
│ rows         │  Verify                                      │
│              │                                              │
│              │                              AI Assistant →  │
└──────────────┴──────────────────────────────────────────────┘
```

不做 Dashboard-first 的大卡片首页；核心用户的主工作是“选择一个 Scenario → 编辑/编译/运行/观察”。

---

## 11. AI 架构

AI 请求：

```text
Current Scenario Working Copy
+ user instruction
+ explicit context/attachments
+ Driver Capability Registry (read-only)
+ Scenario JSON Schema
        ↓
       LLM
        ↓
Scenario Candidate
        ↓
strict parse/validate
        ↓
Diff → user Apply
```

AI Provider：

```python
class AiProvider(Protocol):
    async def complete(self, request: AiRequest) -> AiResponse: ...
```

MVP 优先 OpenAI-compatible HTTP provider；以后可以增加 Anthropic/Ollama 等。Provider 由管理员配置，不能硬编码 Qoder/Qwen/某个会员。

### AI 权限

AI 可：

- 读 Scenario schema；
- 读 Driver capabilities；
- 估算资源；
- 提议 Scenario 修改；
- 解释验证报告。

AI 不可：

- 任意执行 shell；
- 直接操作 Docker；
- 自动 Save；
- 自动 Start/Stop/Delete Run；
- 绕过 image/driver allowlist。

---

## 12. Observability

平台自身至少输出：

- structured logs；
- run lifecycle events；
- source health；
- start duration；
- compile duration；
- entity/edge counts；
- Agent command duration/error；
- verification summary。

后期可暴露 Prometheus metrics，但不要在 M0 引入完整 tracing stack 作为硬依赖。

---

## 13. 可恢复性与 GC

Lab 工具非常容易留下大量容器和卷，所以从 M0 就必须做：

- run-scoped labels；
- Agent startup reconciliation；
- manual `cleanup run`；
- orphan detection；
- TTL 可选；
- cleanup dry-run；
- 不删除未知/无 ISL label 资源。

这是生产级开发体验的一部分，不应作为最后再补的功能。

---

## 14. 技术栈建议

为了复用 DLR 经验与代码结构：

| 层 | 建议 |
|---|---|
| Web | React 19 + TypeScript + Vite 7 |
| UI | Ant Design 5 + Pro Components |
| Editor | Monaco |
| AI UI | assistant-ui |
| i18n | i18next |
| Web test | Vitest + Testing Library + Playwright |
| Control | Python 3.13 + FastAPI |
| Validation | Pydantic v2 + JSON Schema |
| Persistence | SQLAlchemy 2 + Alembic + PostgreSQL 16 |
| Data generation | Mimesis 为主，Faker/JSON Schema 工具按需 |
| Agent | Python 3.13；Docker Engine API/SDK |
| Fault | Toxiproxy |
| Packaging | Docker Compose |
| Python quality | uv + pytest + Ruff + mypy |

第一阶段不因为“模拟器很多是 Go/Rust”就改变 ISL 主技术栈；Driver 可以通过进程/容器/API 调用它们。

---

## 15. 架构决策摘要

- **ADR-001**：Truth-first，而不是 mock-first；
- **ADR-002**：AI compile-time authoring，不做 request-time AI responses；
- **ADR-003**：成熟 simulator / real service 优先，自研 protocol 最后；
- **ADR-004**：Control 与 Docker-privileged Lab Agent 分离；
- **ADR-005**：PostgreSQL 足够作为第一阶段 Truth Graph 存储；
- **ADR-006**：Scenario Revision 不可变，Run 必须绑定 revision；
- **ADR-007**：manual deterministic timeline 是 MVP 默认，realtime 后置；
- **ADR-008**：DLR UI 技术栈和交互模式复用，但业务领域保持独立；
- **ADR-009**：Driver capability registry 是扩展边界；
- **ADR-010**：Verification 使用通用 Observation schema，不绑定某个 CMDB。
