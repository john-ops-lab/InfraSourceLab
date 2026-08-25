# InfraSourceLab 总体架构

## 1. 核心架构性质

InfraSourceLab 必须同时满足：

1. **确定性**：同一 immutable Revision 在相同版本环境下可重复 Compile；
2. **Run 隔离**：同一 Compile 的多个 Run 不共享可变 Truth/Source/backend/fault state；
3. **Compile / Run 分层**：确定性计划与运行时临时信息不能混在一个 Manifest；
4. **可扩展**：新增 Source 主要增加 Driver；
5. **不造协议轮子**：优先成熟 Simulator / real service；
6. **可验证**：Truth / Projection / Observation / Verification 是一等模型；
7. **低交互成本**：AI / Builder 普通入口，YAML 仅 Expert representation。

---

## 2. 总体架构

```text
Web
│ React 19 / TS / Vite / Tailwind / shadcn / assistant-ui
│ AI Create / Builder / World / Sources / Timeline / Verify / Expert YAML
│
↓ HTTP / JSON / SSE

Control (no Docker socket)
│ Authoring / Scenario / Revision / Compile
│ Truth / Projection / Driver Registry
│ Run / Timeline / Observation / Verification
│ AI Gateway / Importers
│
├─ PostgreSQL
│
└─ typed Agent API
      ↓
   Lab Agent (Docker privilege)
      ↓
   per-Run Simulator / Real Service / Contract/Replay runtime
      ↓
   DLR / CMDB / Test Client
      ↓
   Observation / Verification
```

前端开发闭环：Requirement → UI Skills → shadcn composition → implementation → Chrome DevTools MCP → fix → Playwright。

---

## 3. Control 与 Lab Agent

### Control

负责：

- unsaved Working Copy validate/estimate；
- Scenario / immutable Revision；
- deterministic Compile；
- immutable Base Truth/Projection；
- Run state / run-scoped Truth lineage；
- Verification；
- AI/Import；
- typed Agent commands。

### Agent

唯一接触 Docker：

- allowlisted exact image/runtime；
- per-run network/workspace/volumes；
- runtime materialization；
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

处理未保存 Working Copy：parse、safe normalize、schema/semantic/capability/security validation、estimate、semantic digest。无需 Scenario ID。

### scenario

Scenario metadata、Working Copy wire model、immutable Revision、raw/normalized provenance。

### compiler

只接受 immutable Revision：

```text
Revision
 → normalize/validate
 → deterministic allocation
 → Base Truth V0
 → Base Source Projections
 → deterministic Driver Plans / artifacts
 → Compile Manifest
```

Compiler 不启动容器，也不生成 host port / container ID / runtime secret。

### runs

从成功 Compile 创建一次独立 materialization：

```text
Compile Manifest
  ↓
Run materialization
  ↓
Run Manifest / RunSource runtime state
  ↓
Agent runtime
```

### truth / projection

```text
Compile Base Truth/Projection   immutable
Run Truth Version lineage       run-scoped
Run Source Projection versions  run-scoped
```

---

## 5. Authoring 模型

```text
AI Create ────────┐
Visual Builder ───┼──→ Semantic Working Copy
Expert YAML ──────┘          │
                             ├─ Validate
                             ├─ Estimate
                             └─ semantic_digest
                             ↓
                          Save
                             ↓
                    Immutable Revision
```

Builder patch known paths and preserves untouched valid advanced fields。Raw YAML comments/formatting 不保证逐字符 round-trip；语义必须保留。

---

## 6. Digests

```text
source_digest   = raw source/YAML hash
semantic_digest = canonical normalized typed document hash
```

AI Candidate uses `base_semantic_digest`；current digest 不一致时 M1 起禁止 blind Apply。

---

## 7. API 边界

### Unsaved Authoring

```text
POST /api/authoring/validate
POST /api/authoring/estimate
POST /api/ai/scenario-candidate   # M1
```

### Persistence

```text
GET/POST /api/scenarios
GET      /api/scenarios/{id}
GET/POST /api/scenarios/{id}/revisions
GET      /api/scenarios/{id}/revisions/{revision_id}
```

### Compile

```text
POST /api/compiles    # requires scenario_revision_id
GET  /api/compiles/{id}
```

### Run

```text
POST /api/runs        # requires successful compile_id
GET  /api/runs/{id}
POST /api/runs/{id}/stop
POST /api/runs/{id}/cleanup
```

### Base Truth

```text
/api/compiles/{id}/truth/...
```

### Run evolving Truth — M2

```text
/api/runs/{id}/truth/versions
/api/runs/{id}/truth/nodes?version=...
/api/runs/{id}/truth/edges?version=...
/api/runs/{id}/sources/{source}/projection?version=...
```

Observation/Verify target Run and selected version/mode。

---

## 8. Compile Manifest vs Run Manifest

这是可复现性与多 Run 隔离的关键。

### Compile Manifest — deterministic / shareable / no secrets

应包含：

```text
scenario_revision_id
source_digest / semantic_digest
schema / normalization / compiler version
seed / generator versions
Base Truth digest/count
Base Source Projection digests
Driver names + exact backend versions/capabilities
resource requirements / internal service ports
content-addressed deterministic artifacts/plans
```

**不应包含：**

```text
host published port
runtime container/network ID/name
random generated password/token/community/key
runtime endpoint
run_id
runtime-native object IDs generated only after start
wall-clock-only values that participate in deterministic digest
```

Compile artifacts can be reused/copied into multiple Run workspaces only if they contain no Run secret/state。

### Run Manifest / RunSource — per-Run ephemeral materialization

Run start/materialization produces：

```text
run_id
Agent assignment
container/network/volume names & IDs
host published ports
runtime endpoint
per-Run generated credentials / secret references
runtime native IDs / identity mapping
runtime backend state/version
current Truth/Projection version
active faults
health/status
```

Secrets should be stored via appropriate secret/config storage and not dumped into user-visible manifest/logs。

### Why this matters

```text
Compile C12
  deterministic plan
   ├───────────────┐
   ↓               ↓
Run A             Run B
port 32101        port 32777
secret A          secret B
network A         network B
```

同一 Compile 不因不同 host port/secret 产生不同 Compile digest，也不会因固定端口/credential 冲突无法多 Run。

---

## 9. Compile Base Truth 与 Run Truth

```text
Revision R7
 ↓
Compile C12
Base Truth V0 (immutable)
 ├─────────────────────┐
 ↓                     ↓
Run A                  Run B
V0→V1→V2               V0→V1
```

- runtime action never mutates Base V0；
- Run A/B independent；
- Source freshness/faults run-scoped；
- historical Verification selects explicit Run/version。

DB/schema can use snapshot+delta/materialization but ownership cannot blur。

---

## 10. Driver Contract 分层

概念上 Driver 有两个职责层：

### Deterministic compile/render side

```text
capabilities()
validate(compiled_source)
render_plan(compiled_source) → deterministic DriverPlan/artifacts
```

不得需要 Docker socket / host port / runtime credential。

### Agent/runtime side

```text
materialize(run_context, driver_plan) → RunSource materialization
start
health
apply(run-scoped action)
stop
cleanup
```

具体 Python classes/modules 可以合并或拆分，但调用边界必须保证 Control 不需要 Docker 权限，Compile output 不掺 runtime ephemera。

### Capability authority

```text
exact pinned backend version
 → integration tests
 → DriverCapabilities
 → Compiler/UI
```

上游 main != current release capability。

---

## 11. Fault Backend / Transport capability

Toxiproxy is a shared **TCP** fault backend。Fault availability = Source transport/protocol + DriverCapabilities + FaultBackendCapabilities + Agent platform capability。

SNMP default UDP must not falsely inherit TCP-only fault options。真正 UDP network backend 另行设计。

---

## 12. Run 生命周期

```text
Working Copy
 ↓ Save
REVISION
 ↓ Compile
COMPILED (Base V0 + deterministic Compile Manifest)
 ↓ Start / Materialize
PREPARING
 ↓
STARTING
 ↓ health
READY (per-Run runtime state)
 ↓ timeline/fault/observation
READY
 ↓ Stop
STOPPED
 ↓ Cleanup
CLEANED
```

失败进入 FAILED；cleanup/reconcile 仍 run-scoped。

---

## 13. Per-Run isolation

Labels：

```text
io.infrasourcelab.managed=true
io.infrasourcelab.run=<run_id>
io.infrasourcelab.driver=<driver>
io.infrasourcelab.source=<source>
```

Default endpoint internal/127.0.0.1；no default 0.0.0.0；cleanup only target Run。

---

## 14. 数据存储

PostgreSQL 16。Domain ownership 至少能表达：

```text
scenarios
scenario_revisions
compiles / compile_manifests
compile Base Truth/Projection
lab_runs
run_manifests / run_sources
run Truth Versions / Projection Versions
run_events
observations
verification_reports
```

具体表名可优化。

Artifacts/content-addressed plans stored outside giant JSONB；DB stores digest/path/metadata。

---

## 15. Frontend IA / Design System

Create Lab / Scenarios / Runs / Sources / Verification / Settings；Scenario detail includes Builder/World/Sources/Timeline/Runs/Verify/Expert YAML。

General Importer becomes user-facing in M5, not earlier fake CTA。

Runtime UI: shadcn/Tailwind + assistant-ui; one committed `components.json`/theme baseline from M0；no Ant Design/DLR UI。

详见 `docs/frontend-design.md` 与 `docs/qoder-frontend-tooling.md`。

---

## 16. AI

M1 OpenAI-compatible provider abstraction, optional to core。AI can validate/estimate/propose but not auto Save/Compile/Run/Fault/Docker/secret。

M5 adds attachments/imports/context/tools/frozen snapshot/richer conflict/generative UI。

---

## 17. Browser Gate

UI Wave: UI Skills → shadcn reuse → Chrome DevTools MCP (flows/screenshots/Console/Network/1024–1920/performance) → Playwright regression。

---

## 18. 不可破坏约束

1. AI-first / Builder / Expert YAML；
2. unsaved validate/estimate；
3. Compile only immutable Revision；
4. **Compile Manifest deterministic and free of Run secrets/host ports/runtime IDs**；
5. Run only successful Compile；
6. **Run Manifest contains per-Run ephemeral materialization**；
7. Compile Base Truth immutable；
8. runtime Truth/Projection per-Run isolated；
9. semantic_digest stale safety；
10. mature protocols not reimplemented；
11. Control no Docker socket；
12. Agent typed/allowlisted；
13. AI no runtime write privilege；
14. one shadcn design system；
15. capabilities reflect exact tested versions/transports。