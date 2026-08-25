# Scenario DSL 与 Truth Graph 模型

## 1. Scenario 的定位

Scenario 是 InfraSourceLab 的**版本化领域源码**，但不是普通用户必须手写的产品入口。

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
                             ▼
                           Compile
```

YAML 是 canonical human-readable serialization / Expert representation；内部统一解析为 JSON-compatible typed model。

---

## 2. Working Copy、Raw YAML、Normalized Document

```text
Raw YAML/source text
       ↓ parse
Normalized typed document
       ↑        ↑
    Builder    AI Candidate
```

Normalized typed document 是语义真值；Raw YAML 是人类可读原文与审计 artifact。

Builder round-trip 可以规范化 key order/quotes/whitespace/comments；除非以后明确引入 comment-preserving parser，**不承诺所有 YAML 注释/排版逐字符保留**。

必须承诺：合法 advanced fields 不被 Builder 静默删除/改值。

---

## 3. Digest 模型

```text
source_digest
  = raw source/YAML text hash

semantic_digest
  = canonical normalized typed document hash
```

用途：

- `source_digest`：原文 provenance / exact source change；
- `semantic_digest`：AI base/stale、Builder/YAML semantic sync、Compile input identity。

Canonical serialization 必须 deterministic，并记录 schema/normalization version。

---

## 4. AI Candidate Staleness

Candidate 至少携带：

```text
base_semantic_digest
candidate semantic document
candidate semantic_digest
```

Apply 前：

```text
candidate.base_semantic_digest == current semantic_digest
```

不相等时 M1 起禁止 blind Apply；M5 再增加 frozen snapshot / 3-way compare / rebase / richer Regenerate。

---

## 5. 顶层结构

```yaml
apiVersion: infrasourcelab.io/v1alpha1
kind: Scenario
metadata:
  name: cmdb-medium-enterprise
  description: DLR + CMDB integration lab

seed: 20260824

clock:
  mode: manual
  start: 2026-01-01T00:00:00Z

world:
  # canonical entities / generation rules

sources:
  # source projections + drivers

timeline:
  # run-scoped deterministic state changes

faults:
  # run-scoped transport/application fault declarations

expectations:
  # optional verification hints
```

版本策略：未知 `apiVersion` 不静默接受；migration 显式；Revision 保存 raw/normalized/source_digest/semantic_digest/schema version。

---

## 6. Builder Compatibility

Builder 覆盖高频 80% 语义：Environment / Sources / Data Quality / 常用 Timeline/Fault。

正确方式：

```text
parse → typed document
       ↓
patch known paths
       ↓
preserve untouched valid advanced fields
       ↓
validate/serialize
```

不是重新生成一份只含 Builder 字段的 Scenario。

有 advanced config 时 UI 必须提示。

---

## 7. World：描述真实世界，不描述接口

```yaml
world:
  sites:
    - id: shanghai-dc
      name: Shanghai DC
    - id: suzhou-dc
      name: Suzhou DC

  racks:
    generate:
      count: 40
      template:
        id: rack-{index:03d}
        siteRef:
          choose: [shanghai-dc, suzhou-dc]

  physicalServers:
    generate:
      count: 300
      template:
        id: server-{index:04d}
        hostname: srv-{index:04d}
        serial:
          pattern: CZ{index:08d}
        cpu:
          cores:
            choose: [16, 24, 32, 48]
        memoryGiB:
          choose: [64, 128, 256]
        managementIp:
          allocateFrom: mgmt-pool
        rackRef:
          distributeOver: racks
```

World 使用领域语义；SNMP `sysName.0`、Redfish `SerialNumber` 等属于 Source Projection，不属于 canonical World。

---

## 8. Truth Graph

```text
TruthNode(id, kind, attributes, tags)
TruthEdge(id, type, from, to, attributes)
```

Example：

```json
{
  "id": "server-0001",
  "kind": "physical_server",
  "attributes": {
    "hostname": "srv-0001",
    "serial": "CZ00000001",
    "management_ip": "10.20.0.10"
  }
}
```

```json
{
  "id": "edge:server-0001:rack-001",
  "type": "mounted_in",
  "from": "server-0001",
  "to": "rack-001"
}
```

Scenario 可有强类型 convenience sections，Compiler 最终降为通用 graph。

---

## 9. Compile Base Truth 与 Run Truth

**这是 Timeline 语义的重要边界。**

Compile 某个 immutable Revision 时产生：

```text
Compile C12
Base Truth V0
Base Source Projections
Compile Manifest
```

它们是 immutable compile provenance。

每次 Start Run 后，Run 从 Base V0 开始独立 evolution：

```text
Compile C12 / Base V0
      ├───────────────────┐
      ↓                   ↓
Run A                     Run B
V0 → V1 → V2              V0 → V1
```

规则：

- Timeline action 修改目标 Run 的 canonical Truth；
- Run A 不修改 Run B；
- Run 不修改 Compile Base V0；
- Source refresh/freeze/staleness 也是 run-scoped；
- historical Run Truth Version 可被 Verification 引用。

Scenario `timeline` 描述**每个 Run 可以执行/重放的变化计划**，不是编译时直接把 Base Truth 改掉。

---

## 10. Stable ID / Seed

生成 ID：

```text
scenario namespace + resource path + deterministic index
```

必要 UUID 用 UUIDv5/deterministic hash，不用 `uuid4()` 作为 canonical generated identity。

`seed` 只在同算法/依赖版本下保证伪随机稳定，所以 Compile Manifest 记录：

```text
schemaVersion
normalizationVersion
compilerVersion
generatorVersions
semanticDigest
```

AI 可以非确定，但保存 Revision 以后 Compile/Runtime 输入确定。

---

## 11. IP Allocator

```yaml
world:
  addressPools:
    mgmt-pool:
      cidr: 10.20.0.0/20
      reserved:
        - 10.20.0.1
```

Compiler 检查 overlap/capacity/duplicate/reserved/IP format；Driver 不随机决定 canonical IP。

---

## 12. Source Projection

```yaml
sources:
  - name: redfish-bmc
    driver: redfish
    select:
      kinds: [physical_server]
    projection:
      identity:
        sourceId: "bmc-{node.id}"
      fields:
        SerialNumber: "attributes.serial"
        HostName: "attributes.hostname"

  - name: legacy-assets
    driver: artifact.csv
    select:
      kinds: [physical_server]
    projection:
      fields:
        asset_name: "upper(attributes.hostname)"
        serial_no: "lower(attributes.serial)"
        ip: "attributes.management_ip"
```

第一版 pure transforms：map/rename、case、prefix/suffix/format、omit、constant、enum map、split/join、deterministic hash、relation flatten/reference。

无 arbitrary Python/JS/Jinja。

---

## 13. Semantic Defects

```text
missing-field
duplicate-record
wrong-value
stale-field
case-drift
format-drift
identity-alias
identity-collision
wrong-relation
missing-relation
extra-relation
orphan-record
```

Selector `percentage` 使用 `(seed,node_id,defect_id)` deterministic hash。

Compile 产生 Base Projection definition；Run 具体 Source Projection Version 在 M2 可随着 Truth/freshness 演化。

---

## 14. Driver Config

```yaml
sources:
  - name: vc-a
    driver: vcsim
    projection: {...}
    driverConfig:
      apiMode: vcenter
      tls: true
```

Driver-specific config 放 `driverConfig`，由具体 Driver 二次 schema/capability validation。

普通 UI 优先 capability-aware controls，raw config 属于 Advanced/Expert。

---

## 15. Clock / Timeline

MVP：

```yaml
clock:
  mode: manual
```

```yaml
timeline:
  - id: migrate-vm-7
    at: +10m
    actions:
      - type: relink_edge
        entity: vm-0007
        edgeType: runs_on
        to: esxi-02
```

Run 执行：

```text
Run V0 (derived from Compile Base V0)
  ↓ step migrate
Run V1
  ↓ source refresh policy
Run Source Projection Version updates
```

另一个 Run 不受影响。

---

## 16. Source Refresh / Staleness

```yaml
sources:
  - name: excel-export
    refresh:
      mode: every-steps
      steps: 3
```

运行时记录：

```text
run_id
current canonical truth version
source projected truth version
runtime projection version
stale_by_steps
```

同一个 Source definition 在两个 Run 可以有不同 freshness。

---

## 17. Faults 与 Defects 分离

Semantic Defect 改数据内容；Transport Fault 改连接；Protocol/Application Fault 改协议行为。

```yaml
faults:
  - id: vc-latency
    target: vc-a
    layer: transport
    type: latency
    params:
      latencyMs: 1500
```

Fault 实际 capability 以项目 pin 的 backend 版本 + integration test 为准。Run A fault 不影响 Run B。

---

## 18. Compile Manifest

Authoritative Compile 只基于 immutable Revision：

```yaml
scenarioRevision: 12
sourceDigest: sha256:...
semanticDigest: sha256:...
schemaVersion: v1alpha1
normalizationVersion: 0.1.0
compilerVersion: 0.1.0
seed: 20260824
baseTruth:
  version: 0
  nodeCount: 5120
  edgeCount: 12841
  digest: sha256:...
sources:
  - name: vc-a
    driver: vcsim
    driverVersion: ...
    backendVersion: ...
    projectionDigest: sha256:...
generators:
  mimesis: ...
```

Run Manifest/Run state 再引用这个 Compile Manifest 并维护 runtime truth/projection versions。

---

## 19. Diagnostics

```json
{
  "severity": "error|warning|info",
  "code": "scenario.ip_pool_exhausted",
  "path": "world.physicalServers.generate",
  "message": "...",
  "hint": "..."
}
```

Error 禁止 authoritative Compile/Start。

典型：invalid schema、duplicate ID、broken ref、impossible relation、IP exhausted、driver unavailable、capability mismatch、invalid projection/timeline、resource limit。

---

## 20. Scale

大规模依赖 generate/count/templates/distribution/deterministic allocator/batch persistence/streaming artifacts，不写 100k 对象 YAML。

Unsaved Authoring Estimate 可先给：

```text
nodes ~101,200
edges ~280,000
containers 6
memory ~2.4 GiB
artifact ~180 MiB
```

Estimate 不是 authoritative Compile。

Run Truth Version 实现可以 snapshot+delta/materialize，避免每步完整复制 100k graph，但领域语义必须可查询历史版本且 Run 隔离。

---

## 21. `v1alpha1` 暂不支持

- arbitrary Python/JS/Jinja；
- arbitrary Docker image；
- source request-time LLM；
- arbitrary DAG/workflow；
- distributed Truth Graph；
- graph query language；
- 保证 Builder 保留所有 YAML comments/formatting。

优先保证可审计、确定、安全、Run 隔离。