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

Ground Truth、Source Projection、Observation、Verifier 是产品核心。

---

## 2. Compile Base Truth 与 Run Truth 分层

M1 Compile：

```text
Compile C12
Base Truth V0
Base Source Projections
Compile Manifest
```

这些是 immutable provenance。

M2 每个 Run 独立 evolution：

```text
Compile C12 / Base V0
      ├──────────────────┐
      ↓                  ↓
Run A                   Run B
V0 → V1 → V2            V0 → V1
```

- Run A 不改 Compile Base；
- Run A 不影响 Run B；
- Source freshness/projection version run-scoped；
- Verification 明确绑定 run_id + truth/projection version。

---

## 3. Truth Version / Clock

Run 初始 V0 派生自 Compile Base V0。每个 canonical timeline mutation 只产生该 Run 的下一版本。

MVP 默认 `clock.mode: manual`；realtime/scaled later。

Version 记录 digest、logical timestamp/step、predecessor、run ownership。

---

## 4. Timeline Actions

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

要求 schema validation、deterministic selector、no arbitrary code、event/audit、明确失败语义、严格 Run scope。

---

## 5. Fault Taxonomy

### Semantic Defect

改变 Source Projection 内容：missing/wrong/stale field、duplicate、identity alias/collision、wrong/missing/extra relation、format/case drift。

### Transport Fault

改变传输层连接/包流。

**不能假设一个 Fault Backend 覆盖所有网络传输协议。** Fault capability 必须至少声明：

```text
backend
exact version
transport/protocol applicability (e.g. TCP only)
fault types
platform/privilege requirements
```

### Protocol/Application Fault

由 Driver/backend 原生能力负责，例如 HTTP 429、pagination error、SNMP error response/variation、auth/session failure。

### Runtime Fault

Source restart/unavailable、Agent disconnect、partial start 等。

---

## 6. Toxiproxy：共享 TCP Fault Backend

Toxiproxy 官方实现是 **TCP proxy**。它适用于：

- HTTP/HTTPS；
- PostgreSQL/MySQL/Redis；
- SSH/SFTP/NETCONF-over-SSH；
- Kafka/AMQP/MQTT-over-TCP；
- vCenter/Kubernetes API 等 TCP-based endpoints；
- 其他实际通过 TCP 的 Source。

它**不应被描述为默认 UDP fault backend**。

### 版本权威顺序

```text
exact pinned Toxiproxy version/image
      ↓
actual integration tests
      ↓
FaultBackendCapabilities(transport=TCP)
      ↓
Compiler + UI
```

M2 对实际 pin 版本优先验证：

- latency + jitter；
- timeout；
- reset peer；
- bandwidth；
- proxy disable/down；
- slow-close/limit-data 等实际支持项；
- packet_loss only if pinned version supports and test passes。

不能因为 upstream `main`/README 有功能就自动扩大发行 capability。

### Endpoint

```text
TCP client → stable published Toxiproxy endpoint → TCP source backend
```

Admin endpoint 不公开；proxy 资源 run-scoped/labelled/cleaned/reconciled。

---

## 7. UDP 与 SNMP Fault 策略

SNMP 常见采集默认使用 UDP，因此不能直接套用 Toxiproxy TCP 路径。

### M3 SNMP 首选

使用 snmpsim 本身可以验证的 protocol/data variation 能力，例如：

- delayed response / timeout-like behavior where supported；
- SNMP error responses；
- changing values / missing records；
- protocol-specific variation。

这能覆盖大量 DLR SNMP Adapter 错误处理，而不引入新的高权限网络工具。

### 真正 UDP transport fault — later unless needed

如果必须测试真正 UDP packet drop/jitter/network impairment：

- 单独设计 `UdpFaultBackend` / generic transport-fault backend；
- 可评估 Linux `tc/netem` 等工具；
- 明确 Linux/root/capability 权限影响；
- 不在 M2/M3 偷偷加入 privileged host networking；
- 不让每个 UDP Driver 自己实现一遍。

因此 capability registry 必须允许：

```text
Toxiproxy: transports=[tcp]
SNMP Driver protocol faults: snmp-specific
UDP network backend: unavailable (until explicitly implemented)
```

UI 对 unsupported UDP transport fault 不显示假按钮。

---

## 8. Fault Model

```yaml
faults:
  - id: asset-api-rate-limit
    target: asset-api
    layer: application
    type: http-status
    params:
      status: 429
      every: 10

  - id: vcenter-latency
    target: vc-primary
    layer: transport
    type: latency
    params:
      latencyMs: 1200
      jitterMs: 100
```

Compile/Step 前同时检查：

- target Driver capability；
- transport compatibility；
- selected Fault Backend availability；
- platform/Agent capability。

Unsupported fault 不能 silently no-op。

---

## 9. Ground Truth APIs

### Compile immutable base

```text
GET /api/compiles/{compile}/truth/nodes
GET /api/compiles/{compile}/truth/edges
GET /api/compiles/{compile}/truth/sources/{source}
GET /api/compiles/{compile}/manifest
```

### Run evolving truth

```text
GET /api/runs/{run}/truth/versions
GET /api/runs/{run}/truth/nodes?version=...
GET /api/runs/{run}/truth/edges?version=...
GET /api/runs/{run}/sources/{source}/projection?version=...
```

具体 URL 可优化，但 ownership 不可混淆。大结果分页/stream/export。

---

## 10. Observation

Observation 不要求 canonical IDs，至少包含 metadata、nodes、edges、observed identities、attributes、producer/run/profile info。

要求 batch、limits、diagnostics、digest、immutable record、large-payload handling。

Observation 必须明确 target Run；truth-version hint 不自动成为 authoritative baseline。

---

## 11. Verification Profile / Matcher

Profile 显式定义 identity selector、field/relation mapping、安全 normalizers（exact/case-insensitive/IP/set/timestamp/numeric tolerance）。无 arbitrary Python comparator。

Matcher 正确处理 exact/alias/ambiguity/collision/missing/duplicate，使用 indexes/hash maps。

---

## 12. Findings

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

每条 Finding 含 bounded expected/actual、identity/path/context，以及：

```text
run_id
truth_version
source_projection_version when relevant
verification_mode
```

---

## 13. 两种 Verification Mode

### Source Fidelity

```text
Observation vs Run Source Projection at selected version
```

### Canonical Outcome

```text
Observation vs Run Canonical Truth at selected version
```

Baseline version 必须显式，不让历史 Report 随“当前最新状态”漂移。

---

## 14. Report Provenance

至少：

```text
scenario_revision_id
compile_id
run_id
truth_version
source_projection_version(s)
observation_digest
verification_profile version/digest
compiler/normalization version
created_at
```

Run 后续继续 Step 不改变历史 Report 含义。

---

## 15. DLR / Consumer E2E

```text
ISL Run Source
 → DLR / representative consumer
 → normalized output
 → Observation(run_id)
 → Verify(run_id, selected version/mode)
```

DLR 正式 runtime 不硬依赖 ISL。

---

## 16. Guided UX

Timeline/Fault 使用 Guided UI，不要求普通用户手写 YAML。

Fault UI 必须根据：

```text
Source transport/protocol
+ DriverCapabilities
+ FaultBackendCapabilities
+ Agent platform capabilities
```

动态决定可用项。

例如 SNMP/UDP Source 不能仅因为系统装了 Toxiproxy 就显示 TCP packet-loss/latency proxy 能力。

Verify UI 明确 Run、Truth Version、Projection Version、Verification Mode。

---

## 17. 性能

100k entity：identity indexes、batch normalize、edge hashes、paginated findings、必要时 DB batch/temp tables。

Run versioning 可使用 snapshot+delta/materialization，不能以性能为理由破坏历史版本/Run 隔离。

---

## 18. Required Tests

### Run isolation

- same Compile starts Run A/B；
- mutate/fault A → B unchanged；
- Compile Base unchanged；
- historical report remains reproducible after later steps。

### TCP Fault

- exact pinned Toxiproxy capability tests；
- latency/timeout/reset/bandwidth/packet_loss-if-declared/recovery/cleanup；
- backend declares `transport=TCP`；
- unsupported transport rejected。

### SNMP/UDP

- default UDP path does not get falsely proxied through Toxiproxy；
- protocol delay/error/variation uses tested snmpsim capability；
- true UDP network fault remains unavailable unless a dedicated backend exists；
- UI/API clearly reports unsupported capability。

### Verifier

perfect/missing/extra/alias/ambiguity/collision/duplicate/wrong field/relation/stale/order-independent/10k/two modes/version provenance。

Transport compatibility tests are M2/M3 correctness gates, not optional documentation。