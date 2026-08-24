# Scenario DSL 与 Truth Graph 模型

## 1. 设计目标

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
AI Create / Context Assistant
          │
Visual Scenario Builder
          │
YAML Expert Mode (Monaco)
          │
          ▼
Scenario Working Copy
          │
          ▼
Validate / Estimate / Save Revision
```

三种入口操作**同一个逻辑 Working Copy**，不能各自维护独立配置。

YAML 是 Scenario 的 canonical human-readable serialization / Expert representation，而不是默认交互界面。内部统一解析为 JSON-compatible typed model。

---

## 2. 顶层结构建议

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

expectations:
  # optional verification hints
```

### 版本策略

- `v1alpha1` 允许快速演进；
- 解析器不得静默接受未知 `apiVersion`；
- schema migration 必须显式；
- Revision 保存原始 YAML、normalized document、schema version 和 digest；
- Builder/AI 必须通过同一 schema/semantic validation，不允许有“UI 特权字段”。

### Builder compatibility

Visual Builder 只覆盖高频 80% 语义，不要求把全部 DSL 字段做成表单。

当 Working Copy 包含 Builder 尚不能表达的高级字段时：

- Builder 必须保留它们；
- UI 要提示存在 advanced configuration；
- Builder 保存/Apply 不能静默删除未知但合法的字段；
- 用户可进入 Expert YAML 精确修改。

---

## 3. World：描述真实世界，不描述接口

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
        name: R{index:03d}

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

World 中字段使用**领域语义**，不要提前写成某个 API 字段名。

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

## 4. Truth Graph

Compiler 最终把不同资源模型归一成：

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

### 为什么用通用 node/edge

- Source 类型会持续扩展；
- CMDB 模型不是 ISL 的固定模型；
- 关系是验证重点；
- 同一对象可以被多个 source 以完全不同 schema 表达；
- JSONB attributes 可以承载长尾属性。

Scenario DSL 仍可提供强类型 convenience sections，Compiler 再降到通用 graph。

---

## 5. 稳定 ID 与随机性

### 5.1 不直接使用随机 UUID 作为生成对象 ID

生成 ID 由：

```text
scenario namespace + resource path + deterministic index
```

决定，例如：

```text
physical_server/server-0001
vm/vm-001287
```

必要时 UUID 使用 UUIDv5 / deterministic hash，而不是 `uuid4()`。

### 5.2 Seed 的边界

`seed` 只保证同一生成算法/依赖版本下的伪随机序列。仅保存 seed 不足以保证几年后绝对重复。

Compile Manifest 必须同时记录：

```yaml
compilerVersion: 0.x.y
generatorVersions:
  mimesis: x.y.z
scenarioDigest: sha256:...
```

依赖 pin 到明确版本；升级生成器形成新的 manifest provenance。

### 5.3 AI 的随机性边界

LLM 可以生成不同 Candidate，但**确定性从用户 Apply/Save 后的 Scenario Revision 开始**。

```text
AI (may be nondeterministic)
  ↓ candidate
validation + user Apply
  ↓
immutable Scenario Revision
  ↓
deterministic compiler/runtime
```

运行时绝不为了生成某条记录再调用 LLM。

---

## 6. IP / 网络资源分配

Scenario 提供 deterministic allocator，而不是让每个 Driver 自己随机 IP。

```yaml
world:
  addressPools:
    mgmt-pool:
      cidr: 10.20.0.0/20
      reserved:
        - 10.20.0.1
        - 10.20.0.2

    vm-pool:
      cidr: 10.30.0.0/16
```

Compiler 检查：

- CIDR 重叠；
- pool 容量；
- duplicate assignment；
- reserved collision；
- IPv4/IPv6 格式。

---

## 7. Source Projection

这是 ISL 区别于普通 Synthetic Data 工具的关键模型。

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

### Projection 操作

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

后期可考虑 CEL/JQ，但 MVP 不执行任意 Python/JS/Jinja。

---

## 8. Semantic Defects（语义脏数据）

脏数据必须是结构化声明，Compiler/Verifier 都知道它是“故意的”。

建议类型：

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

示例：

```yaml
projection:
  defects:
    - type: missing-field
      selector:
        percentage: 5
      field: serial_no

    - type: duplicate-record
      selector:
        every: 50
      mutate:
        hostname:
          suffix: "-copy"

    - type: wrong-relation
      selector:
        ids: [vm-0020]
      relation: runs_on
      target: host-0099
```

`percentage` 使用基于 `(seed, node_id, defect_id)` 的 deterministic hash，不能调用不可控 runtime random。

Visual Builder 可为常用 defects 提供比例/范围控件，但底层仍生成同一结构化声明。

---

## 9. Source Driver 配置

Driver-specific 内容放在 `driverConfig`，核心 schema 验证通用字段，具体 Driver 再二次 schema 校验。

```yaml
sources:
  - name: vc-a
    driver: vcsim
    projection: {...}
    driverConfig:
      apiMode: vcenter
      tls: true
      inventory:
        datacenters: 1
```

Compiler 调用 Driver capability/schema 验证，不允许未知字段悄悄忽略。

普通用户 UI 优先展示 capability-aware controls；raw `driverConfig` 属于 Advanced/Expert surface。

---

## 10. Clock 与 Timeline

### MVP：manual clock

```yaml
clock:
  mode: manual
  start: 2026-01-01T00:00:00Z
```

用户显式执行 Step，比 realtime 更可测试。

```yaml
timeline:
  - id: migrate-vm-7
    at: +10m
    actions:
      - type: relink
        entity: vm-0007
        relation: runs_on
        from: esxi-01
        to: esxi-02

  - id: rename-server
    at: +20m
    actions:
      - type: patch
        entity: server-0010
        set:
          hostname: srv-renamed
```

执行：

```text
truth version 0
  ↓ step migrate-vm-7
truth version 1
  ↓ source projections refresh according to source policies
runtime driver applies supported changes
```

### 来源可以故意滞后

```yaml
sources:
  - name: excel-export
    refresh:
      mode: every-steps
      steps: 3
```

Truth 已变化，但 Excel source 仍可暴露旧版本。

Timeline 普通操作通过 Guided UI 构造，Expert YAML 只用于高级/精确场景。

---

## 11. Network / Protocol Faults 与语义 Defects 分离

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
    layer: network
    type: latency
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
    status: 429
    match:
      path: /assets
      every: 10
```

Driver capability 决定是否支持某个 fault。

普通用户通过 Guided Fault UI 选择 Source / Type / Parameters；YAML 是高级表示。

---

## 12. Source Refresh / Staleness

企业数据源很少完全实时，因此 source projection 明确真值版本：

```json
{
  "source": "legacy-assets",
  "truth_version": 3,
  "projection_version": 2,
  "generated_at": "...",
  "stale_by_steps": 1
}
```

Verifier 可区分：

- 下游采集错了；
- Source 本身故意是旧数据；
- CMDB 按治理规则是否应该接受/拒绝旧值。

---

## 13. Compile Manifest

每次 compile 产生不可变 manifest：

```yaml
scenarioRevision: 12
scenarioDigest: sha256:...
seed: 20260824
compilerVersion: 0.1.0
schemaVersion: v1alpha1
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

## 14. 编译诊断

Diagnostics 统一结构：

```json
{
  "severity": "error|warning|info",
  "code": "scenario.ip_pool_exhausted",
  "path": "world.physicalServers.generate",
  "message": "...",
  "hint": "..."
}
```

错误禁止 Start；warning 可由用户理解后继续。

典型错误：

- invalid schema；
- duplicate canonical id；
- broken ref；
- relationship cardinality impossible；
- IP pool exhausted；
- source driver not installed；
- capability mismatch；
- source projection references missing field；
- timeline references missing entity；
- Driver resource estimate exceeds configured local budget。

Diagnostics 应能从 Visual Builder / structured preview 定位到相应配置；Expert YAML 则定位到 path/line。

---

## 15. Scale 设计

不要要求 YAML 显式写 100,000 条对象，也不要要求用户在 Builder 中逐个创建对象。

大规模场景依赖：

- generate/count；
- templates；
- distributions；
- deterministic allocators；
- vectorized/batched persistence；
- streaming artifact render。

Compile Preview 在物化前先估算：

```text
nodes: ~101,200
edges: ~280,000
containers: 6
estimated memory: 2.4 GiB
estimated artifact size: 180 MiB
```

AI/Builder 应生成 compact rules，而不是把 100k 对象展开进 Working Copy。

---

## 16. v1alpha1 明确暂不支持

- arbitrary embedded Python/JS；
- Jinja 任意执行；
- 用户任意 Docker image；
- source 每次请求调用 LLM；
- 任意 DAG/workflow；
- 多用户实时冲突合并；
- distributed Truth Graph；
- graph query language。

保持 DSL 可审计和确定性，比“万能表达能力”更重要。

---

## 17. Product-level invariants

无论 Scenario 是 AI、Builder 还是 Expert YAML 创建，都必须满足：

1. 只有一个 authoritative Working Copy model；
2. 保存后 Revision immutable；
3. Compiler/Driver 不知道配置来自哪个 UI；
4. AI Candidate 必须先 validate 再 Apply；
5. Builder 不得丢失合法 advanced fields；
6. Expert YAML 不是普通用户完成主流程的前置条件；
7. 同 Revision + pinned versions 的 deterministic runtime 合同一致。