# 时间、故障、Observation 与自动验证设计

## 1. Verification 是核心能力

如果 InfraSourceLab 只能启动模拟接口，它与现有 Mock 工具差异很小。

真正闭环：

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

因此 Ground Truth、Observation、Verifier 从 M1/M2 就进入领域模型。

---

## 2. Truth Version

初始 Compile：

```text
Truth V0
```

canonical timeline mutation 产生新版本：

```text
V0 ─ migrate VM ─→ V1
V1 ─ rename host ─→ V2
V2 ─ remove server ─→ V3
```

Source 可以落后：

```text
vCenter → V3
SNMP    → V3
Excel   → V1   # intentionally stale
```

这是 CMDB 冲突治理测试的重要输入。

---

## 3. Clock

### `manual` — MVP

用户/API 明确执行 Step。优点：确定、可重放、自动测试稳定、不依赖 wall clock。

### `realtime` / `scaled` — later

只有真实长时间 schedule 测试需求出现再做，不阻塞 MVP。

---

## 4. Timeline Actions

Core action source-neutral：

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

Driver 接受 typed action，不接受任意代码。

常用动作通过 Guided UI；Expert YAML 是高级表示。

---

## 5. Fault Taxonomy

### Semantic Defect

发生在 Source Projection：

- missing/wrong/stale field；
- duplicate record；
- identity alias/collision；
- wrong/missing/extra relation；
- format/case drift。

### Transport Fault

由共享 Fault Backend 负责，M2 默认使用 Toxiproxy。

### Protocol/Application Fault

由 Driver/Backend 原生能力负责：

- HTTP 401/403/429/500；
- pagination error；
- malformed response；
- SNMP error；
- auth/session failure；
- API version mismatch。

### Runtime Fault

- source restart/unavailable；
- Agent disconnect；
- partial start；
- resource pressure（后期）。

不同层次不能混成一个笼统 `chaos=true`。

---

## 6. Toxiproxy / Fault Backend Capability Contract

**关键规则：以 InfraSourceLab 实际 pin 的 backend 版本为准。**

上游 `main`、README 或某篇文章声称支持某 toxic，不代表当前发行 Driver 已支持。

流程：

```text
pinned Toxiproxy version/image
          ↓
actual integration tests
          ↓
FaultBackendCapabilities
          ↓
Compiler/UI exposes only verified faults
```

M2 基础能力至少优先验证：

- latency + jitter；
- timeout；
- reset peer；
- bandwidth；
- proxy disable/down；
- slow-close/limit-data 等按实际版本选择。

`packet_loss`：如果**项目实际 pin 的 Toxiproxy 版本**包含并通过 integration test，则可声明支持；否则 capability=false，不允许 UI/Scenario 假成功。

未来如需 Toxiproxy 不提供的网络特性，可另行评估 Linux `tc/netem` 等更高权限后端，但不能偷偷塞进 M2 或让每个 Driver 各实现一次。

### Endpoint model

```text
client
  ↓
published stable proxy endpoint
  ↓
Toxiproxy
  ↓
source backend internal endpoint
```

Toxiproxy admin endpoint 不对普通 client 暴露。

---

## 7. Fault Model

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

Compiler 在 Authoritative Compile 前检查 Driver/FaultBackend capability，不允许 unsupported fault silently no-op。

---

## 8. Ground Truth API

测试程序不访问 ISL 内部 DB。

建议：

```text
GET /api/compiles/{compile}/truth/versions
GET /api/compiles/{compile}/truth/nodes
GET /api/compiles/{compile}/truth/nodes/{id}
GET /api/compiles/{compile}/truth/edges
GET /api/compiles/{compile}/truth/sources/{source}
GET /api/compiles/{compile}/truth/defects
GET /api/compiles/{compile}/manifest
```

Run 引用 Compile，因此 Run API 可提供关联导航，但 canonical initial truth 属于 Compile provenance。

所有大列表分页/stream/export，不能一次返回 100k。

---

## 9. Observation Schema

Observation 不要求使用 ISL canonical IDs。

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

Verifier 的重要工作之一就是：

```text
observed identities
     ↓ configured selectors/indexes
canonical entity
```

否则无法测试 CMDB identity resolution。

---

## 10. Verification Profile

显式描述不同下游字段/身份语义：

```yaml
verificationProfiles:
  dlr-vcenter:
    kinds:
      virtual_machine:
        identity:
          anyOf:
            - observed: identity.instance_uuid
              truth: attributes.instance_uuid
        fields:
          name: attributes.name
        relations:
          runs_on: runs_on
```

安全 normalizers：

- exact；
- normalized/case-insensitive string；
- IP normalize；
- timestamp tolerance；
- set comparison；
- numeric tolerance。

第一版不支持任意 Python comparator。

---

## 11. Findings

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

Finding 保存 bounded expected/actual、canonical/observed identity、path、source/truth context。

---

## 12. 两种 Verification Mode

### Source Fidelity

```text
Observation vs Source Projection
```

验证 DLR/collector 是否忠实采到“来源实际暴露的内容”。如果 Excel 故意错 IP，DLR 采到这个错 IP 在此模式应 PASS。

### Canonical Outcome

```text
CMDB/consumer Observation vs Canonical Truth
```

验证治理/去重/融合结果是否回到正确 Truth。

UI/API 不得混淆两种 PASS/FAIL。

---

## 13. DLR / Consumer E2E

```text
ISL HTTP/Postgres Source
       ↓
DLR Adapter / representative consumer
       ↓
normalized output
       ↓
Observation API
       ↓
Verifier
```

DLR 正式产品不硬依赖 ISL。

---

## 14. Report

MVP：

- authoritative JSON；
- Web filter/table/detail；
- downloadable JSON；
- provenance：Revision/Compile/Truth/Observation/Profile/compiler versions。

M6 增加 JUnit/CI gate 等。

---

## 15. 性能策略

100k entity 不能 O(n²)：

- canonical identity indexes；
- batch normalize；
- hash/index matching；
- canonical edge hash；
- large findings pagination；
- 必要时 DB batch/temp tables。

M6 做规模优化，但 M2 算法从一开始不能是 nested full scans。

---

## 16. 测试要求

至少覆盖：

- perfect match；
- missing/extra/duplicate；
- alias/ambiguous/collision；
- wrong field/relation；
- stale source；
- order-independent collections；
- 10k+ smoke；
- Source Fidelity 与 Canonical Outcome 差异；
- actual pinned Toxiproxy capability tests；
- unsupported fault rejected；
- fault enable/disable/recover/cleanup。

这些可信度测试比“页面截图好看”更重要。