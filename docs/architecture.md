# InfraSourceLab 总体架构

## 1. 核心架构性质

InfraSourceLab 必须同时满足：

1. **确定性**：同一 immutable Revision 在相同编译器/生成器/Driver-plan 版本下可重复 Compile；
2. **Run 隔离**：同一 Compile 的多个 Run 不共享可变 Truth/Source/backend/fault state；
3. **Compile / Run 分层**：确定性计划与运行时 ephemera 不混入同一个 Manifest；
4. **Capability 分层**：产品/Driver 能力、Compile 需求、Agent 实际能力、Start admission 分开；
5. **可扩展**：新增 Source 主要增加 Driver；
6. **不造协议轮子**：优先成熟 Simulator / real service；
7. **可验证**：Truth / Projection / Observation / Verification 是一等模型；
8. **低交互成本**：AI / Builder 普通入口，YAML 仅 Expert representation。

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
│ Run / Admission / Timeline / Observation / Verification
│ AI Gateway / Importers
│
├─ PostgreSQL
│
└─ typed Agent API
      ↓
   Lab Agent (Docker privilege)
   AgentCapabilities / runtime materialization
      ↓
   per-Run Simulator / Real Service / Contract/Replay
      ↓
   DLR / CMDB / Test Client
      ↓
   Observation / Verification
```

Frontend loop：Requirement → UI Skills → shadcn composition → implementation → Chrome DevTools MCP → fix → Playwright。

---

## 3. Control 与 Lab Agent

### Control

- unsaved Working Copy validate/estimate；
- Scenario / immutable Revision；
- deterministic Compile；
- Base Truth/Projection；
- Driver Registry；
- Compile Requirements；
- Agent capability discovery + Run admission；
- Run Truth/Projection lineage；
- Verification；
- AI/Import；
- typed Agent commands。

### Agent

唯一接触 Docker：

- report actual AgentCapabilities；
- allowlisted exact image/runtime；
- per-run network/workspace/volume；
- materialize Run；
- Driver start/health/apply/stop/cleanup；
- bounded logs；
- reconcile/GC。

No arbitrary shell/image/host mount。

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
  agents/
  admission/
  runs/
  timeline/
  observations/
  verification/
  ai/
  imports/
  api/
```

不要求逐字目录名，但职责必须能表达上述边界。

---

## 5. Authoring 模型

```text
AI Create ────────┐
Visual Builder ───┼──→ Semantic Working Copy
Expert YAML ──────┘          │
                             ├─ Safe parse/validate
                             ├─ Estimate
                             └─ semantic_digest
                             ↓
                          Save
                             ↓
                    Immutable Revision
```

Builder patches known typed paths and preserves legal advanced fields。YAML comments/formatting 不保证逐字符 round-trip；语义必须保留。

---

## 6. Digests

```text
source_digest   = raw source/YAML hash
semantic_digest = canonical normalized typed-document hash
```

AI Candidate uses `base_semantic_digest`；current digest 不一致时 M1 起禁止 blind Apply。

---

## 7. Authoring / Persistence / Compile APIs

### Unsaved Authoring

```text
POST /api/authoring/validate
POST /api/authoring/estimate
POST /api/ai/scenario-candidate   # M1
```

No Scenario ID required；no runtime permission created。

### Persistence

```text
GET/POST /api/scenarios
GET      /api/scenarios/{id}
GET/POST /api/scenarios/{id}/revisions
GET      /api/scenarios/{id}/revisions/{revision_id}
```

### Compile

```text
POST /api/compiles    # scenario_revision_id
GET  /api/compiles/{id}
```

### Run

```text
POST /api/runs        # compile_id + target/default Agent selection as applicable
GET  /api/runs/{id}
POST /api/runs/{id}/stop
POST /api/runs/{id}/cleanup
```

Start request cannot carry a modified Scenario payload to bypass Compile。

---

## 8. Compile Manifest vs Run Manifest

### Compile Manifest — deterministic / no secrets / host-independent where possible

Contains：

```text
scenario_revision_id
source_digest / semantic_digest
schema / normalization / compiler version
seed / generator versions
Base Truth digest/count
Base Source Projection digests
Driver versions / exact backend versions / semantic capabilities
CompileRequirements
content-addressed deterministic Driver Plans/artifacts
```

Must NOT contain：

```text
run_id
host-published port
container/network/volume runtime IDs
per-Run random password/token/community/key
runtime endpoint
runtime-only native IDs
active runtime faults/current Run Truth version
```

Compile plan can specify internal service-port/protocol needs, required images/binaries, expected resources, architecture constraints, but not allocate the host runtime itself。

### Run Manifest / RunSource — per-Run materialization

Contains：

```text
run_id
target Agent ID
container/network/volume IDs/names
host published ports
runtime endpoint
per-Run generated credential / secret reference
runtime native identity map
actual backend/runtime version confirmation
current Truth / Projection version
active faults
health/status
```

Same Compile → multiple isolated Runs without port/credential collision or Compile-digest drift。

---

## 9. DriverCapabilities vs CompileRequirements vs AgentCapabilities

这是未来 remote Agent 不返工的关键。

### DriverCapabilities — 产品/版本层

描述一个 Driver + exact backend version **理论上/经测试能做什么**：

```text
protocols/transports
supported object/features
run-scoped actions
protocol faults
compatible FaultBackends
required image/binary families
supported architectures (known)
resource-hint model
fidelity limitations
```

来自 exact pinned version + integration tests，不来自 upstream main 猜测。

### CompileRequirements — 场景需求层

Compile 从 Scenario + Driver Plans 汇总“要运行这个 Compile 需要什么”：

```text
required Drivers/backends
protocol/transport
architecture constraints if any
required images/binaries
minimum/estimated CPU/memory/disk
container count
internal ports
special platform features
FaultBackend requirements
```

这是 deterministic Compile output 的一部分，不包含实际 host allocation。

### AgentCapabilities — 运行主机层

Agent 实际报告：

```text
agent_id
OS / arch
runtime/Docker version
available/pullable allowlisted backends
installed binaries
supported FaultBackends/transports
CPU/memory/disk availability/hints
published-port capacity
platform-specific limitations
```

M1 单 Agent 可以很简单，但模型必须独立存在；M6 再增加认证 remote Agent/多 Agent 管理。

### Start Admission

```text
CompileRequirements
       vs
AgentCapabilities
       ↓
PASS / WARNING / REJECT diagnostics
```

只有 admission PASS 才进入 Run materialization。

### Why Compile should not blindly bind current host

Driver 在产品层 supported，但当前 Mac Agent 可能因 arch/image/resource 不可运行；未来 remote Linux Agent 可能可运行。

因此要区分：

```text
unsupported by Driver/product → Compile error
supported but current Agent unavailable/incompatible → Start admission error / authoring warning
```

M1 单机 UI 可以同时展示当前 Agent feasibility，但不能把 host-specific ephemera写进 Compile semantic digest。

---

## 10. Compile Base Truth 与 Run Truth

```text
Revision R7
 ↓
Compile C12
Base Truth V0 (immutable)
 ├────────────────────┐
 ↓                    ↓
Run A                 Run B
V0→V1→V2              V0→V1
```

Runtime action never mutates Base；Runs independent；Source freshness/faults run-scoped；Verification selects explicit Run/version。

---

## 11. Driver Contract 分层

### Compile/render side

```text
capabilities()
validate(compiled_source)
render_plan(compiled_source) → deterministic DriverPlan/artifacts + Requirements
```

No Docker socket/host port/runtime secret required。

### Agent/runtime side

```text
probe_agent_capability()
materialize(run_context, driver_plan)
start / health
apply(run-scoped action)
stop / cleanup
```

Python modules/classes can vary but security/determinism boundary cannot。

---

## 12. Fault Backend / Transport capability

Toxiproxy is shared **TCP** fault backend。Fault availability = Source transport + DriverCapabilities + CompileRequirements + AgentCapabilities/FaultBackendCapabilities。

SNMP default UDP does not falsely inherit TCP faults。Dedicated UDP backend later if explicitly designed。

---

## 13. Run lifecycle

```text
Working Copy
 ↓ Save
REVISION
 ↓ Compile
COMPILED (Base V0 + Compile Manifest + Requirements)
 ↓ select/default Agent + Admission
ADMITTED
 ↓ Materialize
PREPARING / STARTING
 ↓ health
READY
 ↓ timeline/fault/observation
READY
 ↓ Stop
STOPPED
 ↓ Cleanup
CLEANED
```

`ADMITTED` can be explicit state or logical gate; implementation naming can differ, but admission check cannot be skipped。

---

## 14. Per-Run isolation

Labels：

```text
io.infrasourcelab.managed=true
io.infrasourcelab.run=<run_id>
io.infrasourcelab.driver=<driver>
io.infrasourcelab.source=<source>
```

Default endpoint internal/127.0.0.1；cleanup only target Run。

---

## 15. Storage ownership

PostgreSQL domain must express：

```text
scenarios / revisions
compiles / compile manifests / requirements
compile Base Truth/Projection
agents / capability snapshots (minimal M1, richer M6)
lab_runs / run manifests / run sources
run Truth Versions / Projection Versions
run events
observations / verification reports
```

Exact tables may differ。

Artifacts/content-addressed plans live outside giant JSONB; DB stores paths/digests/metadata。

---

## 16. Frontend / AI

Create Lab / Scenarios / Runs / Sources / Verification / Settings；Scenario detail Builder/World/Sources/Timeline/Runs/Verify/Expert YAML。

M0 establishes one shadcn `components.json`/theme/base/icon baseline；assistant-ui uses same system。No Ant Design/DLR UI。

M1 AI Provider optional；AI can validate/estimate/propose but cannot Save/Compile/Run/Fault/Docker/secret。

UI can show：

```text
Driver supported
Current Agent: available / incompatible / insufficient resources
```

without conflating them。

---

## 17. Browser Gate

UI Wave: UI Skills → shadcn reuse → Chrome DevTools MCP (flow/screenshots/Console/Network/1024–1920/performance) → Playwright。

M1 Run flow must exercise admission failure and success at least with fake/simulated Agent capability fixtures if current machine cannot cover both。

---

## 18. 不可破坏约束

1. AI-first / Builder / Expert YAML；
2. unsaved validate/estimate；
3. safe bounded parser；
4. Compile only immutable Revision；
5. Compile Manifest deterministic/no Run ephemera；
6. DriverCapabilities ≠ CompileRequirements ≠ AgentCapabilities；
7. Start requires admission PASS；
8. Run Manifest owns ephemeral materialization；
9. Compile Base Truth immutable；
10. Run Truth/Projection isolated；
11. semantic_digest stale safety；
12. no mature protocol reimplementation；
13. Control no Docker socket；
14. Agent typed/allowlisted；
15. AI no runtime write privilege；
16. one shadcn design system；
17. capability reflects exact tested version + transport/platform。