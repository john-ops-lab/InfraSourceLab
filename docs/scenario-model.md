# Scenario DSL 与 Truth Graph 模型

## 1. Scenario 的定位

Scenario 是 InfraSourceLab 的版本化领域源码，但不是普通用户必须手写的入口。

```text
AI Create ────────┐
Visual Builder ───┼──→ Scenario Working Copy
Expert YAML ──────┘          │
                             ├─ Validate
                             ├─ Estimate
                             └─ semantic_digest
                             ↓
                         User Save
                             ↓
                     Immutable Revision
                             ↓
                           Compile
```

YAML 是 canonical human-readable serialization / Expert representation；内部解析为 JSON-compatible typed model。

---

## 2. Working Copy、Raw YAML、Normalized Document

```text
Raw YAML/source text
       ↓ parse
Normalized typed document
       ↑        ↑
    Builder    AI Candidate
```

Normalized typed document 是语义真值；Raw YAML 是人类可读原文与 provenance artifact。

Builder 可以规范化 formatting/comments/key-order，不承诺逐字符 round-trip；必须承诺合法 advanced semantic fields 不被静默删除/改值。

---

## 3. Digest 模型

```text
source_digest   = raw source/YAML text hash
semantic_digest = canonical normalized typed document hash
```

- source_digest：原文 provenance；
- semantic_digest：AI base/stale、Builder/YAML semantic sync、Compile input identity。

Canonical serialization 必须 deterministic，并记录 schema/normalization version。非语义系统字段（如数据库 created_at）不进入 semantic digest。

---

## 4. AI Candidate Staleness

Candidate：

```text
base_semantic_digest
candidate semantic document
candidate_semantic_digest
```

Apply 前必须比较 current semantic digest；不一致时 M1 起禁止 blind Apply。M5 再增加 frozen snapshot / 3-way compare / rebase。

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
  # run-scoped deterministic changes

faults:
  # run-scoped transport/application faults

expectations:
  # optional verification hints
```

Unknown `apiVersion` not silently accepted；schema migration explicit；Revision stores raw/normalized/source_digest/semantic_digest/schema+normalization version。

---

## 6. Builder Compatibility

Builder covers high-frequency 80% semantics and patches known typed paths：

```text
parse → typed document
       ↓
patch known paths
       ↓
preserve untouched valid advanced fields
       ↓
validate/serialize
```

有 advanced config 时 UI 提示；Builder 不重建一份“只含自己认识字段”的 Scenario。

---

## 7. World：领域语义，不描述接口

```yaml
world:
  sites:
    - id: shanghai-dc
      name: Shanghai DC
    - id: suzhou-dc
      name: Suzhou DC

  physicalServers:
    generate:
      count: 300
      template:
        id: server-{index:04d}
        hostname: srv-{index:04d}
        serial:
          pattern: CZ{index:08d}
        managementIp:
          allocateFrom: mgmt-pool
        rackRef:
          distributeOver: racks
```

SNMP `sysName.0`、Redfish `SerialNumber` 等属于 Source Projection，不属于 World。

---

## 8. Truth Graph

```text
TruthNode(id, kind, attributes, tags)
TruthEdge(id, type, from, to, attributes)
```

Scenario 可提供 strong-typed convenience sections；Compiler 最终降为 graph。

---

## 9. Compile Base Truth 与 Run Truth

Compile immutable Revision：

```text
Compile C12
Base Truth V0
Base Source Projections
Compile Manifest
```

每次 Start Run 后独立 evolution：

```text
Compile C12 / Base V0
      ├───────────────────┐
      ↓                   ↓
Run A                     Run B
V0 → V1 → V2              V0 → V1
```

- Timeline modifies target Run only；
- Run A not affect B；
- Run not mutate Compile Base；
- Source freshness/faults run-scoped；
- historical Run Truth Version can be verification baseline。

Scenario `timeline` 描述每个 Run 可执行/重放的计划，不在 Compile 阶段直接修改 Base V0。

---

## 10. Stable ID / Seed

Generated identity from scenario namespace + resource path + deterministic index。必要 UUID 用 UUIDv5/deterministic hash。

Compile Manifest records schema/normalization/compiler/generator versions + semantic digest。AI 可以非确定，但保存 Revision 后 deterministic boundary 生效。

---

## 11. IP Allocator

```yaml
world:
  addressPools:
    mgmt-pool:
      cidr: 10.20.0.0/20
      reserved: [10.20.0.1]
```

Compiler checks overlap/capacity/duplicates/reserved/format；Driver 不自行随机 canonical IP。

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
```

Pure transforms：map/rename、case、prefix/suffix/format、omit、constant、enum map、split/join、deterministic hash、relation flatten/reference。No arbitrary Python/JS/Jinja。

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

Percentage selector uses deterministic hash `(seed,node_id,defect_id)`。

Compile creates Base Projection definition；Run Source Projection Version may evolve from Truth/freshness in M2。

---

## 14. Driver Config

```yaml
sources:
  - name: vc-a
    driver: vcsim
    driverConfig:
      apiMode: vcenter
      tls: true
```

Driver-specific config gets second schema/capability validation。普通 UI uses capability-aware controls；raw config Advanced/Expert。

---

## 15. Transport / Protocol metadata

Source/Driver capability must be able to express actual transport/protocol, e.g.：

```text
HTTP API → TCP
PostgreSQL → TCP
SSH/SFTP → TCP
SNMP v2c default → UDP
```

Fault availability = Source transport + Driver capability + FaultBackend capability。Toxiproxy is TCP-only; default SNMP/UDP must not falsely inherit TCP faults。

---

## 16. Clock / Timeline

MVP manual clock：

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

Run execution：Run V0 → Step → Run V1 → Source refresh policy。

---

## 17. Source Refresh / Staleness

```yaml
sources:
  - name: excel-export
    refresh:
      mode: every-steps
      steps: 3
```

Runtime records run_id, current canonical version, source projected version, runtime projection version, stale_by_steps。Same Source definition can have different freshness in Run A/B。

---

## 18. Faults vs Defects

Semantic Defect changes data；Transport Fault changes transport；Protocol/Application Fault changes protocol behavior。

```yaml
faults:
  - id: vc-latency
    target: vc-a
    layer: transport
    type: latency
    params:
      latencyMs: 1500
```

Fault capability must match actual transport/backend/pin version. UDP network fault is unavailable until a dedicated backend is explicitly implemented。

---

## 19. Compile Manifest — deterministic, no Run ephemera

Authoritative Compile only from immutable Revision。

Example logical contents：

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
    planDigest: sha256:...
generators:
  mimesis: ...
```

### Compile Manifest MUST NOT contain

```text
run_id
host published port
container/network/volume ID/name
per-Run random credential/token/community/key
runtime endpoint
runtime-only native IDs generated after start
active runtime faults
current Run Truth Version
```

Deterministic artifact/Driver Plan may include internal service-port requirements and content-addressed config templates, but no runtime secret/state。

---

## 20. Run Manifest / RunSource materialization

Run starts from Compile plan and records per-Run ephemera：

```text
run_id
Agent assignment
container/network/volume names/IDs
host published ports
runtime endpoint
per-Run generated credential / secret reference
runtime native IDs / identity map
current Truth Version
current Source Projection Version
active faults
health/status
```

Same Compile can therefore create multiple isolated Runs without port/credential collisions or changing Compile digest。

Runtime secrets are not dumped into ordinary user-visible manifest/logs。

---

## 21. Diagnostics

Unified error/warning/info with code/path/message/hint。Errors block authoritative Compile/Start。

Typical：invalid schema、unsafe YAML/input limits、duplicate ID、broken ref、impossible relation、IP exhausted、driver unavailable、transport/fault mismatch、resource limit。

---

## 22. Scale

Use generate/count/templates/distributions/deterministic allocator/batch persistence/streaming artifacts。Authoring Estimate works before save/Compile。

Run Truth can use snapshot+delta/materialization to avoid full 100k copy each Step while preserving historical version/query semantics and Run isolation。

---

## 23. `v1alpha1` 暂不支持

- arbitrary Python/JS/Jinja；
- arbitrary Docker image；
- request-time LLM Source responses；
- arbitrary DAG/workflow；
- distributed Truth Graph；
- graph query language；
- guaranteed comment/format preservation；
- implicit UDP privileged network-fault backend。

优先可审计、确定、安全、Run isolated。