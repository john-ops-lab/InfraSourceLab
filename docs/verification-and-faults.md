# 时间、故障、Observation 与自动验证设计

## 1. Verification 是核心能力

```text
ISL knows canonical world
       ↓
Sources expose partial/distorted views
       ↓
DLR / CMDB / consumer processes them
       ↓
Observed world comes back
       ↓
ISL compares Expected vs Actual
```

Ground Truth、Source Projection、Observation、Verifier 是产品核心，不是 Mock Server 后面的附加报表。

---

## 2. Compile Base Truth 与 Run Truth 必须分层

M1 Compile 产生 immutable base world：

```text
Compile C12
  Base Truth V0
  Base Source Projections
  Compile Manifest
```

M2 Timeline **不能修改 Compile Base Truth**。每次 Run 从 Base V0 启动自己的 lineage：

```text
Compile C12 / Base V0
      ├──────────────────┐
      ↓                  ↓
Run A                   Run B
V0 → V1 → V2            V0 → V1
Excel stale=1           Excel fresh
```

Invariant：

- 同一 Compile 可以启动多个独立 Run；
- Run A mutation 不影响 Run B；
- Run mutation 不改变 Compile Base V0；
- Verification 必须明确 `run_id + truth_version`；
- Source freshness/projection version 也是 run-scoped。

这也是并发测试与可重放的基础。

---

## 3. Truth Version

Run 初始：

```text
Run Truth V0 = Compile Base Truth V0
```

每个 canonical timeline mutation 产生该 Run 的下一版本：

```text
Run A V0 ─ migrate VM ─→ V1
Run A V1 ─ rename host ─→ V2
Run A V2 ─ remove server ─→ V3
```

Source 可以落后：

```text
Run A current Truth V3
vCenter projection → V3
SNMP projection    → V3
Excel projection   → V1  # intentionally stale
```

Version 记录 digest、logical timestamp/step、predecessor、run ownership。

---

## 4. Clock

### `manual` — MVP

用户/API 显式执行 Step，最确定、可重放、测试稳定。

### `realtime` / `scaled` — later

真实需求出现再做，不阻塞 MVP。

---

## 5. Timeline Actions

Core source-neutral typed actions：

```text
create_entity
patch_entity
delete_entity
create_edge
delete_edge
relink_edge
source_refresh
source_freeze
fault_enable
fault_disable
```

要求：

- schema validated；
- deterministic selector；
- no arbitrary code；
- event/audit record；
- multi-action failure semantics 明确；
- action 只影响目标 Run。

---

## 6. Fault Taxonomy

### Semantic Defect

Source Projection 内容错误：missing/wrong/stale field、duplicate、identity collision、wrong/missing/extra relation、format/case drift。

### Transport Fault

共享 Fault Backend（M2 默认 Toxiproxy）。

### Protocol/Application Fault

Driver/backend 原生能力，例如 HTTP 429、pagination error、SNMP error、auth/session failure。

### Runtime Fault

source restart/unavailable、Agent disconnect、partial start 等。

不同层不能混成 `chaos=true`。

---

## 7. Toxiproxy / Fault Capability Contract

正式能力权威顺序：

```text
exact pinned Toxiproxy version/image
      ↓
actual integration test
      ↓
FaultBackendCapabilities
      ↓
Compiler + UI
```

M2 优先验证：latency/jitter、timeout、reset peer、bandwidth、proxy disable/down、slow-close/limit-data 等实际版本能力。

`packet_loss` 只有实际 pin 版本支持且测试通过才暴露；否则 capability=false。

不能根据 upstream `main`/README 自动宣布发行能力。

如未来需要 backend 不支持的网络故障，另评估 `tc/netem` 等，不在 M2 偷换高权限实现。

### Endpoint

```text
client → stable published proxy endpoint → internal source backend
```

Admin endpoint 不公开；proxy 资源 run-scoped、labelled、cleanable/reconcilable。

---

## 8. Fault Model

```yaml
faults:
  - id: asset-api-rate-limit
    target: asset-api
    layer: application
    type: http-status
    enabled: false
    params:
      status: 429
      every: 10

  - id: vcenter-latency
    target: vc-primary
    layer: transport
    type: latency
    enabled: false
    params:
      latencyMs: 1200
      jitterMs: 100
```

Compile/Step 前 capability gate；unsupported fault 不能 silently no-op。

---

## 9. Ground Truth APIs

### Immutable Compile Base

用于查看可复现初始世界：

```text
GET /api/compiles/{compile}/truth/nodes
GET /api/compiles/{compile}/truth/edges
GET /api/compiles/{compile}/truth/sources/{source}
GET /api/compiles/{compile}/manifest
```

### Run-scoped Evolving Truth — M2

```text
GET /api/runs/{run}/truth/versions
GET /api/runs/{run}/truth/nodes?version=...
GET /api/runs/{run}/truth/edges?version=...
GET /api/runs/{run}/sources/{source}/projection?version=...
GET /api/runs/{run}/truth/defects?version=...
```

具体 URL 可优化，但 ownership 不能混淆。

大结果必须 pagination/stream/export。

---

## 10. Observation Schema

Observation 不要求使用 canonical ID：

```json
{
  "metadata": {
    "producer": "datalinkruntime",
    "run_id": "...",
    "truth_version_hint": 2
  },
  "nodes": [
    {
      "observed_id": "abc",
      "kind": "virtual_machine",
      "identity": {"uuid": "..."},
      "attributes": {"name": "vm-007", "ip": "10.30.1.7"}
    }
  ],
  "edges": [
    {"type": "runs_on", "from": "abc", "to": "host-x"}
  ]
}
```

Observation 是 immutable submitted artifact，有 digest、size/count limits、schema diagnostics。

---

## 11. Verification Profile

显式定义 identity/field/relation semantics 和 safe normalizers：exact、case-insensitive、IP、set、timestamp tolerance、numeric tolerance。

第一版无 arbitrary Python comparator。

---

## 12. Identity Matcher

正确处理：

- exact unique；
- aliases；
- ambiguity；
- collision；
- missing identity；
- duplicate observations。

使用 indexes/hash maps，不能 full O(n²)。

---

## 13. Findings

至少：

```text
missing_entity
extra_entity
ambiguous_identity
identity_collision
duplicate_observation
missing_field
wrong_field
missing_relation
wrong_relation_target
extra_relation
stale_observation
```

每条包含 bounded expected/actual、canonical/observed identity、path、source context，以及：

```text
run_id
truth_version
source_projection_version (when relevant)
verification_mode
```

---

## 14. 两种 Verification Mode

### Source Fidelity

```text
Observation
  vs
Run Source Projection at selected version
```

验证 collector 是否忠实采到来源实际暴露内容。

### Canonical Outcome

```text
Observation
  vs
Run Canonical Truth at selected version
```

验证 CMDB/consumer 最终治理结果。

两种模式的 expected baseline 都必须明确 version，不能默认“当前最新”后让报告无法复现。

---

## 15. Verification Report Provenance

至少：

```text
scenario_revision_id
compile_id
run_id
truth_version
source_projection_version(s)
observation_digest
verification_profile_version/digest
compiler/normalization version
created_at
```

这样 Run 后续继续 Step，也不会改变历史 Report 的含义。

---

## 16. DLR / Consumer E2E

```text
ISL Run Source
 → DLR / representative consumer
 → normalized output
 → Observation(run_id)
 → Verify(run_id, selected truth/projection version)
```

DLR 正式 runtime 不硬依赖 ISL。

---

## 17. Guided UX

普通用户通过 Timeline/Fault UI，不手写 action YAML。

Verify UI 必须清楚显示：

- 当前 Run；
- selected Truth Version；
- Source Fidelity / Canonical Outcome；
- Source Projection Version；
- findings filters/detail。

如果用户选择旧 Observation，要明确它正在和哪个 historical baseline 比较。

---

## 18. 性能

100k entity：identity indexes、batch normalize、edge hashes、paginated findings、必要时 DB batch/temp tables。

Run versioning 不应每次无脑复制整个 100k Graph；实现可以选择 snapshot + delta/materialization 等策略，但 API/领域语义必须表现为独立可查询 Version。

优化不能破坏历史版本可验证性。

---

## 19. Required Tests

### Run isolation

- same Compile starts Run A and Run B；
- mutate A → B remains V0；
- mutate B independently；
- Compile Base V0 unchanged；
- report on A V1 remains reproducible after A advances to V2。

### Timeline

ordering、selector、create/patch/delete/relink、source freeze/stale、unsupported action、failed step semantics。

### Fault

actual pinned capability tests；baseline/latency/timeout/reset/bandwidth/packet_loss-if-declared/recover/cleanup；unsupported rejected。

### Verifier

perfect/missing/extra/duplicate/alias/ambiguous/collision/wrong field/relation/stale/order-independent/10k smoke/two modes/version provenance。

Run isolation tests 是 M2 完成条件，不可后置。