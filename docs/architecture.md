# InfraSourceLab 总体架构

## 1. 核心架构性质

InfraSourceLab 必须同时满足：

1. **确定性**：同一 immutable Revision 在相同版本环境下可重复 Compile；
2. **Run 隔离**：同一 Compile 启动多个 Run 时，Timeline/Fault/Source freshness 不互相污染；
3. **可扩展**：新增数据源主要增加 Driver；
4. **不造协议轮子**：优先成熟 Simulator / real service；
5. **可验证**：Ground Truth / Source Projection / Observation / Verification 是一等模型；
6. **低交互成本**：AI / Builder 为普通入口，YAML 只是 Expert representation。

---

## 2. 总体架构

```text
┌────────────────────────────────────────────────────────────┐
│ Web                                                        │
│ React 19 + TypeScript + Vite 7                             │
│ Tailwind CSS v4 + shadcn/ui                                │
│ assistant-ui + Monaco (Expert YAML)                        │
│                                                            │
│ AI Create / Builder / World / Sources / Timeline / Verify  │
└──────────────────────┬─────────────────────────────────────┘
                       │ HTTP / JSON / SSE
                       ▼
┌────────────────────────────────────────────────────────────┐
│ Control                                                    │
│ FastAPI + Pydantic + SQLAlchemy + Alembic                 │
│                                                            │
│ Authoring / Scenario / Revision / Compile                  │
│ Truth / Projection / Driver Registry                       │
│ Run / Timeline / Observation / Verification                │
│ AI Gateway / Importers                                     │
└──────────────┬──────────────────────────────┬─────────────┘
               │                              │
               ▼                              ▼
┌─────────────────────────┐       ┌──────────────────────────┐
│ PostgreSQL              │       │ Lab Agent                │
│ metadata/truth/runs/... │       │ Docker privilege         │
└─────────────────────────┘       │ allowlisted Drivers      │
                                  └────────────┬─────────────┘
                                               │
             ┌─────────────────────────────────┼─────────────────────┐
             ▼                                 ▼                     ▼
     Protocol Simulators                Real Services        Contract/Replay
     vcsim/KWOK/SNMP/...                DB/MQ/LDAP/...       Mockoon/...
             └─────────────────────────────────┼─────────────────────┘
                                               ▼
                                      Per-Run Lab Network
                                               │
                                               ▼
                                     DLR / CMDB / Client
                                               │
                                               ▼
                                        Observation API
                                               │
                                               ▼
                                            Verifier
```

前端开发闭环：

```text
Requirement → UI Skills → shadcn composition → implementation
            → Chrome DevTools MCP → iterate → Playwright
```

详情：`docs/frontend-design.md`、`docs/qoder-frontend-tooling.md`。

---

## 3. Control 与 Lab Agent

Control 不挂 Docker socket。

### Control

- unsaved Working Copy validate/estimate；
- Scenario / immutable Revision；
- Compile；
- Base Truth / Base Projection；
- Run / runtime Truth lineage；
- Timeline / Verification；
- AI / Imports；
- typed Agent Command。

### Agent

唯一接触 Docker：

- allowlisted image/runtime；
- per-run network/volume/workspace；
- Driver start/health/apply/stop/cleanup；
- bounded logs；
- reconcile/GC。

禁止任意 shell/image/host mount。

---

## 4. 核心模块

```text
backend/app/
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

处理**未保存 Working Copy**：parse、normalize、schema/semantic/capability/security validation、estimate、semantic digest。

不要求 `scenario_id`。

### scenario

保存 Scenario metadata、Working Copy wire model、immutable Revision、raw/normalized provenance。

### compiler

只接受 immutable Revision：

```text
Revision
 → normalize/validate
 → deterministic allocation
 → Base Truth V0
 → Base Source Projections
 → Driver Plans
 → Compile Manifest
```

Compiler 不启动容器。

### truth / projection

需要明确两层：

```text
Compile Base Truth / Projection      immutable
Run Truth Version lineage            mutable only inside that Run
Run Source Projection versions       mutable/freshness only inside that Run
```

### runs / timeline

Run 从某个 Compile 的 Base Truth V0 克隆/引用初始状态，然后维护自己的 Truth/Projection lineage。

### verification

Source Fidelity 可以对 Run 当前 Source Projection；Canonical Outcome 可以对 Run 当前 canonical Truth（或明确指定 version）。

---

## 5. Authoring 模型

```text
AI Create ────────┐
Visual Builder ───┼──→ Scenario Working Copy
Expert YAML ──────┘          │
                             ├─ Validate
                             ├─ Estimate
                             └─ semantic_digest
                             │
                             ▼
                         User Save
                             ▼
                     Immutable Revision
```

三种入口是同一 semantic model。

Builder 只 patch 已知路径并保留未触碰的合法 advanced fields；不承诺保留 YAML 所有 comment/formatting。

---

## 6. Digests

```text
source_digest
  = raw source text hash

semantic_digest
  = canonical normalized typed document hash
```

`source_digest` 用于 artifact provenance；`semantic_digest` 用于 AI base/stale、semantic identity、Compile input identity。

AI Candidate 必须携带 `base_semantic_digest`；M1 起当前 digest 不一致时禁止 blind Apply。

---

## 7. API 边界

### Unsaved Authoring

```text
POST /api/authoring/validate
POST /api/authoring/estimate
POST /api/ai/scenario-candidate   # M1
```

直接接受 Working Copy payload，不要求 Scenario ID，不产生 authoritative Revision/Compile。

### Persistence

```text
GET/POST /api/scenarios
GET      /api/scenarios/{id}
GET/POST /api/scenarios/{id}/revisions
GET      /api/scenarios/{id}/revisions/{revision_id}
```

### Compile

```text
POST /api/compiles
GET  /api/compiles/{id}
```

`POST /api/compiles` 必须引用 `scenario_revision_id`。

### Base Ground Truth

```text
GET /api/compiles/{id}/truth/nodes
GET /api/compiles/{id}/truth/edges
GET /api/compiles/{id}/truth/sources/{source}
GET /api/compiles/{id}/manifest
```

这些是 immutable base world / projection。

### Run

```text
POST /api/runs      # references successful compile_id
GET  /api/runs/{id}
POST /api/runs/{id}/stop
POST /api/runs/{id}/cleanup
```

### Run-scoped evolving Truth — M2

```text
GET /api/runs/{id}/truth/versions
GET /api/runs/{id}/truth/nodes?version=...
GET /api/runs/{id}/truth/edges?version=...
GET /api/runs/{id}/sources/{source}/projection?version=...
POST /api/runs/{id}/timeline/steps/...
```

具体 URI 可按实现优化，但**Compile truth 与 Run truth 的 ownership 不能混淆**。

### Observation / Verify

```text
POST /api/runs/{id}/observations
POST /api/runs/{id}/verify
```

Verification report 必须记录 run_id、truth_version、source projection version、profile、observation digest。

---

## 8. Compile / Run Truth 隔离

这是重要 invariant。

```text
Revision R7
   ↓
Compile C12
Base Truth V0 (immutable)
   ├──────────────────────┐
   ↓                      ↓
Run A                    Run B
V0 → V1 → V2             V0 → V1
Source A stale=1          Source A fresh
```

要求：

- Run A Timeline 不修改 Compile C12 Base Truth；
- Run A 不修改 Run B；
- 同 Compile 可重复启动多个独立 Run；
- Run restart/reconcile 恢复自己的 current Truth/Projection state；
- Verification 明确绑定哪个 Run + Truth Version。

数据库设计必须可表达 scope，例如 TruthVersion 具有 `compile_id` base provenance 与可选/明确 `run_id` runtime ownership，不能只用一个全局递增版本号。

---

## 9. Driver Contract

```python
class Driver(Protocol):
    def capabilities(self) -> DriverCapabilities: ...
    def validate(self, source: CompiledSource) -> list[Diagnostic]: ...
    def render(self, source: CompiledSource, workspace: Path) -> DriverManifest: ...
    async def start(self, ctx, manifest) -> RuntimeEndpoint: ...
    async def health(self, ctx) -> Health: ...
    async def apply(self, ctx, action) -> ActionResult: ...
    async def stop(self, ctx) -> None: ...
    async def cleanup(self, ctx) -> None: ...
```

Core 不 import 具体 Driver implementation。

### Capability rule

```text
exact pinned backend version
      ↓ integration test
DriverCapabilities
      ↓ Compiler / UI
```

上游 `main` 有能力不等于当前 ISL Driver 有能力。

---

## 10. Run 生命周期

```text
Working Copy
  ↓ Save
REVISION
  ↓ Compile
COMPILED (Base V0 immutable)
  ↓ Start
PREPARING
  ↓
STARTING
  ↓ health
READY (Run-scoped Truth/Projection state)
  ↓ timeline/fault/observation
READY
  ↓ Stop
STOPPED
  ↓ Cleanup
CLEANED
```

失败进入 FAILED 并保持可解释 cleanup/reconcile。

---

## 11. Per-Run 隔离

每 Run 独立 network/workspace/resources：

```text
io.infrasourcelab.managed=true
io.infrasourcelab.run=<run_id>
io.infrasourcelab.driver=<driver>
io.infrasourcelab.source=<source>
```

默认 endpoint internal/127.0.0.1；不默认 0.0.0.0；cleanup 只删除本 Run labels。

---

## 12. 数据存储

PostgreSQL 16。

至少：

```text
scenarios
scenario_revisions
compiles / compile_manifests
compile_truth_nodes / compile_truth_edges (或等价 immutable base scope)
lab_runs
truth_versions (run-scoped lineage)
truth_nodes / truth_edges versioned runtime state (实现可优化)
source_projections / projection_versions
run_sources / run_events
observations
verification_reports
```

不要求按上述表名逐字实现，但 ownership 必须明确：**base compile state immutable，runtime state run-scoped**。

Artifacts 不塞大 JSONB，使用 run/compile workspace + digest/metadata。

---

## 13. 前端 IA

```text
Create Lab / Home
Scenarios
Runs
Sources / Drivers
Verification
Settings
```

Scenario：Overview / Builder / World / Sources / Timeline / Runs / Verify / Expert YAML。

新建 M0/M1：

```text
[ AI Prompt ]
Start from: [Builder] [Template] [Expert YAML]
```

Import 在 M5 真实可用前不放主 CTA。

前端正式使用 shadcn/ui + assistant-ui；不采用 Ant Design/DLR UI。

---

## 14. AI

基础 AI 从 M1：OpenAI-compatible provider abstraction。AI Provider 未配置时，non-AI core 正常工作。

AI 可 validate/estimate/propose；不可自动 Save、authoritative Compile、Start/Stop/Fault/Docker/Secret。

M5 扩展 attachments/imports/context/tools/frozen snapshot/3-way conflict/generative UI。

---

## 15. Browser Gate

UI Wave 必须经过：

- UI Skills；
- shadcn reuse；
- Chrome DevTools MCP：flow/screenshots/Console/Network/1024–1920/performance；
- Playwright regression。

---

## 16. 不可破坏约束

1. AI-first / Builder / Expert YAML；
2. unsaved validate/estimate；
3. Compile only immutable Revision；
4. Run only successful Compile；
5. Compile Base Truth immutable；
6. runtime Truth/Projection **per Run isolated**；
7. semantic_digest stale safety；
8. Truth-first + Projection；
9. no mature protocol reimplementation；
10. Control no Docker socket；
11. Agent typed/allowlisted；
12. AI no runtime write privilege；
13. shadcn/ui is primary component system；
14. capabilities reflect exact tested versions。