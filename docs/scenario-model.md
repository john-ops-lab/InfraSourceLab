# Scenario DSL 与 Truth Graph 模型

## 1. Scenario 的定位

Scenario 是 InfraSourceLab 的**版本化领域源码**，但不是普通用户必须手写的产品入口。

它必须同时满足：

- AI 可以稳定生成/修改；
- Visual Builder 可以安全读写常用语义；
- 专家可以在 Monaco 中直接阅读/编辑；
- JSON Schema / Pydantic 可以严格校验；
- 编译器可以确定性地产生大量对象；
- 同一个 canonical world 可以投影成多个来源；
- 生命周期和故障可描述；
- 新增 Driver 不要求重写所有已有 Scenario；
- 保存为 Revision 后可以长期 Review、Diff、复现。

### Authoring surfaces

```text
AI Create / Context Assistant ─┐
Visual Scenario Builder ───────┼──→ Scenario Working Copy
YAML Expert Mode (Monaco) ─────┘          │
                                          ▼
                                Validate / Estimate
                                          │
                                          ▼
                                     Save Revision
```

三种入口操作**同一个逻辑 Working Copy**，不能各自维护独立业务配置。

YAML 是 Scenario 的 canonical human-readable serialization / Expert representation，而不是默认交互界面。内部统一解析为 JSON-compatible typed model。

---

## 2. Working Copy、Raw YAML 与 Normalized Document

为了让 Builder 与 YAML 共存，必须区分三层：

```text
Raw YAML text
   ↓ parse
Normalized typed document
   ↑        ↑
Builder    AI Candidate
```

### Normalized typed document 是语义真值

- Builder 读写 typed document；
- AI Candidate 经过服务端校验后产生 typed document；
- Expert YAML parse 后产生 typed document；
- validation / estimate / compile 都围绕 typed document 工作。

### Raw YAML 是人类可读原文

Revision 保存 raw YAML/source text，用于：

- 查看原始输入；
- YAML Diff；
- audit/provenance；
- copy/export。

但**语义相同不代表 raw YAML 一定逐字符相同**。

例如 Builder round-trip 可能规范化：

- key ordering；
- quoting；
- whitespace；
- comments；
- formatting。

除非后续明确选择支持 comment-preserving round-trip parser，否则产品**不承诺 Builder 修改后保留所有 YAML 注释与原始排版**。

必须承诺的是：

> 合法的高级语义字段不能被 Builder 静默删除或改值。

---

## 3. Digest 模型

仅有一个 YAML text hash 不足以同时支撑审计、Builder round-trip 与 AI stale detection。

每个 Working Copy / Revision 建议至少记录两种 digest：

```text
source_digest
  = raw source/YAML text 的 hash

semantic_digest
  = canonical normalized typed document 的稳定序列化 hash
```

### `source_digest`

用途：

- 原始 artifact provenance；
- 精确判断 raw YAML 是否变化；
- 审计/导出。

### `semantic_digest`

用途：

- AI Candidate base identity；
- Builder ↔ YAML 语义同步；
- stale Candidate 判断；
- Compile input identity；
- 语义级 Revision 比较。

### Canonical serialization

`semantic_digest` 必须建立在稳定 canonical serialization 上，例如：

- object keys deterministic ordering；
- JSON-compatible normalized types；
- 明确 null/default normalization；
- 禁止依赖 Python dict 非合同行为；
- 同 schema/compiler normalization 版本下稳定。

Compile Manifest 应记录 normalization/schema/compiler version，避免未来算法变化产生“同 digest 语义”的错觉。

---

## 4. AI Candidate Staleness

AI Candidate 至少携带：

```text
base_semantic_digest
candidate semantic document
candidate semantic_digest
```

Apply 前必须检查：

```text
candidate.base_semantic_digest
          ==
current Working Copy semantic_digest
```

如果不同：

- M1 起就禁止 blind overwrite；
- UI 至少提示“场景在 AI 生成期间已变化”；
- 用户需要重新生成或明确比较后操作；
- M5 再增加完整 frozen snapshot / 3-way compare / rebase UX。

这条安全合同不能等到 M5 才出现。

---

## 5. 顶层结构

第一版建议：

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
  # canonical entities and generation rules

sources:
  # source projections + drivers

timeline:
  # deterministic state changes

faults:
  # optional transport/application faults

expectations:
  # optional verification hints
```

### 版本策略

- `v1alpha1` 允许快速演进；
- 解析器不得静默接受未知 `apiVersion`；
- schema migration 必须显式；
- Revision 保存 raw source、normalized document、schema version、source_digest、semantic_digest；
- Builder/AI/Expert YAML 通过同一 schema/semantic/security validation，不存在“UI 特权字段”。

---

## 6. Builder Compatibility

Visual Builder 覆盖高频 80% 语义，不把全部 DSL 复制成 200 个表单字段。

当 Working Copy 包含 Builder 尚不能表达的高级字段：

- Builder 必须保留它们；
- UI 提示存在 advanced configuration；
- Builder Apply/Save 不能静默删除未知但合法字段；
- 用户可以进入 Expert YAML 精确修改。

### 推荐实现原则

Builder 不应该这样工作：

```text
读取 YAML
→ 只抽取 Builder 认识的字段
→ 根据表单重新生成整份 YAML
```

这会丢高级字段。

更合理：

```text
parse → typed document
        ↓
Builder patch known paths
        ↓
preserve untouched valid paths
        ↓
serialize
```

---

## 7. World：描述真实世界，不描述接口

一个场景可以同时使用显式对象和 count/template 生成。

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

World 字段使用**领域语义**，不要提前写某个 API 字段名。

错误：

```yaml
world:
  server:
    sysName.0: server01
```

正确：

```yaml
world:
  physicalServers:
    - id: server01
      hostname: server01
```

`sysName.0` 属于 SNMP Source Projection。

---

## 8. Truth Graph

Compiler 最终归一成：

```text
TruthNode
TruthEdge
```

### TruthNode

```json
{
  "id": "server-0001",
  "kind": "physical_server",
  "attributes": {
    "hostname": "srv-0001",
    "serial": "CZ00000001",
    "management_ip": "10.20.0.10",
    "cpu_cores": 32,
    "memory_gib": 128
  },
  "tags": {
    "environment": "prod"
  }
}
```

### TruthEdge

```json
{
  "id": "edge:server-0001:rack-001",
  "type": "mounted_in",
  "from": "server-0001",
  "to": "rack-001",
  "attributes": {}
}
```

使用通用 node/edge 是因为 Source 类型会持续扩展、关系是验证重点、同一对象会被多个来源用不同 schema 表达。Scenario DSL 仍可提供强类型 convenience sections，Compiler 再降为 graph。

---

## 9. 稳定 ID 与随机性

### 9.1 Stable ID

生成 ID 由：

```text
scenario namespace + resource path + deterministic index
```

决定，例如：

```text
physical_server/server-0001
vm/vm-001287
```

必要 UUID 使用 UUIDv5 / deterministic hash，不使用 `uuid4()` 作为可复现对象身份。

### 9.2 Seed 的边界

`seed` 只保证同一算法/依赖版本下的伪随机序列。Compile Manifest 必须记录：

```yaml
compilerVersion: 0.x.y
normalizationVersion: 0.x.y
generatorVersions:
  mimesis: x.y.z
semanticDigest: sha256:...
```

依赖 pin 到明确版本。

### 9.3 AI 随机性边界

LLM 可以产生不同 Candidate，但确定性从用户 Apply/Save 后的 immutable Revision 开始：

```text
AI (may be nondeterministic)
  ↓
validated candidate
  ↓ user Apply / Save
immutable Revision
  ↓
deterministic compile/runtime
```

运行时绝不为了生成某条记录再调用 LLM。

---

## 10. IP / 网络资源分配

统一 deterministic allocator：

```yaml
world:
  addressPools:
    mgmt-pool:
      cidr: 10.20.0.0/20
      reserved:
        - 10.20.0.1
        - 10.20.0.2
```

Compiler 检查：CIDR overlap、pool capacity、duplicate assignment、reserved collision、IPv4/IPv6 format。

Driver 不各自随机分配 canonical IP。

---

## 11. Source Projection

Source Projection 是 ISL 区别于普通 Synthetic Data 工具的关键。

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
      defects:
        - type: stale-field
          selector:
            every: 20
          field: ip
          valueFromTruthVersion: 0
```

### Pure transforms

第一版只支持有限、安全、可验证的 pure transforms：

- rename / map；
- case transform；
- prefix/suffix；
- format；
- omit；
- constant；
- enum map；
- split/join；
- deterministic hash；
- relation flatten/reference。

MVP 不执行任意 Python/JS/Jinja。

---

## 12. Semantic Defects

脏数据是结构化声明，Compiler/Verifier 都知道它是故意的。

类型：

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

`percentage` 使用 `(seed, node_id, defect_id)` deterministic hash，不能调用不可控 runtime random。

Visual Builder 可以为常用 defects 提供比例/范围控件，底层仍生成同一结构化声明。

---

## 13. Source Driver 配置

Driver-specific 内容放 `driverConfig`，Core schema 验证通用字段，具体 Driver 再做二次 schema/capability validation。

```yaml
sources:
  - name: vc-a
    driver: vcsim
    projection: {...}
    driverConfig:
      apiMode: vcenter
      tls: true
```

普通用户 UI 优先 capability-aware controls；raw `driverConfig` 属于 Advanced/Expert surface。

Driver 不能静默忽略未知关键字段。

---

## 14. Clock 与 Timeline

MVP 默认 manual clock：

```yaml
clock:
  mode: manual
  start: 2026-01-01T00:00:00Z
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

执行：

```text
Truth V0
  ↓ step
Truth V1
  ↓ source refresh policy
Source projections/runtime update
```

来源可故意滞后：

```yaml
sources:
  - name: excel-export
    refresh:
      mode: every-steps
      steps: 3
```

普通用户通过 Guided Timeline UI 构造常用动作；Expert YAML 负责高级/精确场景。

---

## 15. Faults 与 Semantic Defects 分离

### Semantic

改变数据内容：

```yaml
projection.defects
```

### Transport

改变连接：

```yaml
faults:
  - id: vc-latency
    target: vc-a
    layer: transport
    type: latency
    params:
      latencyMs: 1500
      jitterMs: 300
```

### Protocol/Application

```yaml
faults:
  - id: api-rate-limit
    target: asset-api
    layer: application
    type: http-status
    params:
      status: 429
      every: 10
```

Driver/Fault backend capability 决定是否支持某个 fault。**实际支持能力以项目 pin 的 backend 版本和 integration test 为准，不以上游 main 或文档印象替代验证。**

普通用户通过 Guided Fault UI；YAML 是高级表示。

---

## 16. Source Refresh / Staleness

Source 明确其可见 Truth Version：

```json
{
  "source": "legacy-assets",
  "truth_version": 3,
  "projection_version": 2,
  "stale_by_steps": 1
}
```

Verifier 可区分：

- 下游采集错；
- Source 故意旧；
- CMDB 治理后是否应接受/拒绝旧值。

---

## 17. Compile Manifest

每次 authoritative compile 只基于 immutable Revision，并产生不可变 manifest：

```yaml
scenarioRevision: 12
sourceDigest: sha256:...
semanticDigest: sha256:...
schemaVersion: v1alpha1
normalizationVersion: 0.1.0
compilerVersion: 0.1.0
seed: 20260824
truth:
  version: 0
  nodeCount: 5120
  edgeCount: 12841
  digest: sha256:...
sources:
  - name: vc-a
    driver: vcsim
    driverVersion: ...
    projectionDigest: sha256:...
    artifactDigest: sha256:...
generators:
  mimesis: ...
```

Manifest 是复现和 Review 的证据。

---

## 18. Diagnostics

统一结构：

```json
{
  "severity": "error|warning|info",
  "code": "scenario.ip_pool_exhausted",
  "path": "world.physicalServers.generate",
  "message": "...",
  "hint": "..."
}
```

错误禁止 authoritative Compile/Start；warning 由用户理解后继续。

典型错误：invalid schema、duplicate canonical id、broken ref、relationship impossible、IP pool exhausted、driver unavailable、capability mismatch、projection missing field、timeline missing entity、resource budget exceeded。

Diagnostics 应能从 Builder/structured preview 定位相关配置；Expert YAML 定位 path/line。

---

## 19. Scale 设计

不要要求 YAML 显式写 100,000 条对象，也不要在 Builder 逐个创建。

大规模依赖：

- generate/count；
- templates；
- distributions；
- deterministic allocators；
- batch persistence；
- streaming artifact render。

Authoring estimate 在物化前给出：

```text
nodes: ~101,200
edges: ~280,000
containers: 6
estimated memory: ~2.4 GiB
estimated artifact size: ~180 MiB
```

Estimate 不是 authoritative Compile，也不要求 Scenario 已保存。

---

## 20. `v1alpha1` 明确暂不支持

- arbitrary embedded Python/JS；
- arbitrary Jinja execution；
- user arbitrary Docker image；
- source 每次请求调用 LLM；
- arbitrary DAG/workflow；
- distributed Truth Graph；
- graph query language；
- 保证 Visual Builder 保留所有 YAML 注释/排版。

保持 DSL 可审计、可确定、可安全 round-trip 比“万能表达能力”更重要。