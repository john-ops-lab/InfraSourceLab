# 时间、故障、Observation 与自动验证设计

## 1. 为什么 Verification 是核心而不是附加功能

如果 InfraSourceLab 只能启动一批模拟接口，它与现有 Mock 工具的差异很小。

真正服务 DLR/CMDB 的闭环必须是：

```text
ISL knows the world
       ↓
Sources expose partial/distorted views
       ↓
DLR / CMDB processes them
       ↓
Observed world comes back
       ↓
ISL compares Expected vs Actual
```

因此 Ground Truth、Observation、Verifier 必须从 M1/M2 就进入领域模型。

---

## 2. Truth Version

初始编译产生：

```text
Truth Version 0
```

每个会改变 canonical world 的 timeline step 产生下一版本：

```text
V0 ── migrate vm ──> V1
V1 ── rename host ──> V2
V2 ── remove server ──> V3
```

Source Projection 可以有自己的可见版本，因此在 V3 时：

```text
vCenter source → truth V3
SNMP source    → truth V3
Excel source   → truth V1   (intentionally stale)
```

这是 CMDB 冲突治理测试的重要输入。

---

## 3. Clock 模式

### 3.1 `manual` — MVP 默认

用户明确点击 Step/Advance：

- 最可重复；
- 自动测试最稳定；
- 不依赖 wall clock；
- 容易 Debug。

### 3.2 `realtime` — 后续

按真实时间执行 timeline。

适合长时间运行 DLR schedule，但会增加 flaky test 风险。

### 3.3 `scaled` — 后续

例如 1h 虚拟时间 = 1min 实际时间。

只有真实需求出现再做，不阻塞 MVP。

---

## 4. Timeline Action

Core action 保持 source-neutral：

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

Driver 接收到的不是任意代码，而是允许的 typed action。

### 示例

```yaml
timeline:
  - id: vm-migrate
    at: +10m
    actions:
      - type: relink_edge
        entity: vm-007
        edgeType: runs_on
        to: esxi-02

      - type: source_refresh
        source: vcenter-primary
```

---

## 5. Fault Taxonomy

必须把“数据错”和“连接错”区分开，否则报告不可解释。

### 5.1 Semantic Defect

发生在 Source Projection：

- missing field；
- wrong value；
- stale field；
- duplicate record；
- identity collision；
- wrong/missing/extra relation；
- format/case drift。

Ground Truth 明确知道这种差异是故意的。

### 5.2 Transport Fault

优先 Toxiproxy：

- latency / jitter；
- timeout；
- down；
- reset；
- packet loss；
- bandwidth；
- slow close。

### 5.3 Protocol/Application Fault

由 Driver 实现：

- HTTP 401/403/429/500；
- invalid/expired pagination token；
- truncated page；
- malformed response；
- SNMP error PDU；
- auth failure；
- session expiry；
- API version mismatch。

### 5.4 Runtime Fault

Lab backend 自身生命周期：

- container restart；
- backend unavailable；
- Agent disconnect；
- resource pressure（后期）。

这类主要验证 DLR 的 resiliency，不应与业务数据 defect 混为一谈。

---

## 6. Fault Model

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

### Capability Gate

Compiler 校验：

```text
requested fault
   ↓
driver capabilities
   ↓ supported? yes/no
```

不允许默默忽略一个 Driver 不支持的 fault。

---

# 7. Ground Truth API

目标：测试程序不需要访问 ISL DB。

建议 endpoint：

```text
GET /api/runs/{run}/truth/versions
GET /api/runs/{run}/truth/nodes
GET /api/runs/{run}/truth/nodes/{id}
GET /api/runs/{run}/truth/edges
GET /api/runs/{run}/truth/sources/{source}
GET /api/runs/{run}/truth/defects
GET /api/runs/{run}/manifest
```

每个结果带：

```text
run_id
scenario_revision
truth_version
manifest_digest
```

### 大数据

必须分页/stream/export，不能让 `/truth/nodes` 一次返回 100k 对象。

---

# 8. Observation Schema

不要绑定未来 CMDB 的数据库表。

建议统一接受：

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
      "identity": {
        "uuid": "..."
      },
      "attributes": {
        "name": "vm-007",
        "ip": "10.30.1.7"
      }
    }
  ],
  "edges": [
    {
      "type": "runs_on",
      "from": "abc",
      "to": "host-x"
    }
  ]
}
```

### Observation 不是要求下游使用 ISL canonical IDs

恰恰相反，Verifier 的重要工作之一就是通过 configured identity selectors 匹配：

```text
observed identity → canonical entity
```

否则无法测试 CMDB identity resolution。

---

## 9. Verification Profile

不同下游的字段语义不同，比较规则要显式：

```yaml
verificationProfiles:
  dlr-vcenter:
    kinds:
      virtual_machine:
        identity:
          anyOf:
            - observed: identity.instance_uuid
              truth: attributes.instance_uuid
            - observed: identity.bios_uuid
              truth: attributes.bios_uuid
        fields:
          name: attributes.name
          power_state: attributes.power_state
        relations:
          runs_on: runs_on
```

### 比较类型

- exact；
- normalized string；
- case-insensitive；
- IP normalized；
- timestamp tolerance；
- set comparison；
- numeric tolerance；
- custom bounded normalization（后期）。

第一版不要支持任意 Python comparator。

---

# 10. Verification Findings

统一 finding：

```json
{
  "severity": "error",
  "type": "missing_entity",
  "canonical_id": "vm-0381",
  "observed_id": null,
  "path": null,
  "expected": "present",
  "actual": "missing",
  "source_context": "vcenter-primary"
}
```

类型至少包括：

```text
missing_entity
extra_entity
ambiguous_identity
identity_collision
missing_field
wrong_field
missing_relation
wrong_relation_target
extra_relation
duplicate_observation
stale_observation
```

### Summary

```text
Expected nodes: 1500
Matched:        1498
Missing:        2
Extra:          1
Field errors:   7
Relation errors:3
```

---

## 11. 对“故意脏数据”的理解

Verifier 需要两种模式：

### Source Fidelity Verification

验证 DLR 是否忠实采集 **source actually exposed** 的数据。

例如 Excel source 故意写错 IP，那么 DLR 采到错误 IP 反而是“采集正确”。

比较：

```text
Observation vs Source Projection
```

### Canonical Outcome Verification

验证 CMDB 最终治理结果是否回到正确 Truth。

比较：

```text
CMDB Observation vs Canonical Truth
```

这是必须明确区分的两个层次。

---

# 12. DLR E2E 模式

M2 建议先做最简单闭环：

```text
ISL HTTP/Postgres source
       ↓
DLR Adapter
       ↓
Execution.output or dedicated test output
       ↓
Test Harness
       ↓
ISL Observation API
       ↓
Verifier
```

不要要求 DLR 正式业务逻辑主动依赖 ISL。

可提供一个测试 helper：

```text
isl verify --run <id> --profile dlr-http --file output.json
```

或 API equivalent。

---

# 13. CMDB E2E 模式

未来 CMDB 只需要能导出一个 normalization adapter：

```text
CMDB REST/DB
    ↓
CMDB Observation Exporter
    ↓
ISL Observation Schema
    ↓
Verifier
```

这样 ISL 不需要知道 CMDB 内部 table/model。

---

# 14. Report

MVP：

- JSON authoritative report；
- Web 表格/筛选/详情；
- downloadable JSON。

后期：

- JUnit XML（CI gate）；
- Markdown summary；
- HTML standalone；
- baseline comparison。

### Report 必须记录 provenance

```text
scenario revision
truth version
observation digest
verification profile version
compiler version
created_at
```

否则结果无法复现。

---

# 15. 性能策略

100k entity 场景下不能 O(n²) 全量比较。

建议：

1. 预先计算 canonical identity indexes；
2. observation 批量 normalize；
3. hash/index matching；
4. edges 使用 canonicalized endpoint pair hash；
5. large reports store counts + paginated findings；
6. PostgreSQL temporary/batch tables 可用于超大 comparison。

M6 再做规模优化，但 M2 的算法不能从一开始就是 nested loops。

---

# 16. 测试要求

Verifier 必须有 property/fixture tests 覆盖：

- 完全一致；
- 缺失；
- extra；
- duplicate；
- identity alias；
- ambiguous identity；
- relation wrong target；
- source stale vs truth；
- case normalization；
- order-independent collections；
- pagination/batch；
- 10k+ data smoke。

这些测试比 Web screenshot 更重要，因为 Verifier 是产品可信度核心。
