# Scenario DSL 与 Truth Graph 模型

## 1. 设计目标

Scenario 是 InfraSourceLab 的“源码”。它必须同时满足：

- 人可以读、改、Review；
- AI 可以稳定生成；
- JSON Schema 可以校验；
- 编译器可以确定性地产生大量对象；
- 同一个 canonical world 可以投影成多个来源；
- 生命周期和故障可描述；
- 后续新增 Driver 不要求重写所有已有 Scenario。

第一版使用 YAML 作为主编辑格式，内部统一解析为 JSON-compatible model。

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
- Revision 保存原始文本、normalized document、schema version 和 digest。

---

## 3. World：描述真实世界，不描述接口

一个场景可以同时使用显式对象和 count/template 生成。

示例：

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

### 原则

World 中字段尽量使用**领域语义**，不要提前写成某个 API 的字段名。

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

建议内部结构：

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

### 为什么用通用 node/edge，而不是把所有 CI 类型都写成数据库表

- Source 类型会持续扩展；
- CMDB 模型不是 ISL 的固定模型；
- 关系是验证重点；
- 同一对象可以被多个 source 以完全不同 schema 表达；
- JSONB attributes 可以承载长尾属性。

但 Scenario DSL 可以仍然提供强类型 convenience sections，Compiler 再降到通用 graph。

---

## 5. 稳定 ID 与随机性

### 5.1 不直接使用随机 UUID 作为生成对象 ID

生成 ID 应由：

```text
scenario namespace + resource path + deterministic index
```

决定，例如：

```text
physical_server/server-0001
vm/vm-001287
```

必要时 UUID 可以使用 UUIDv5 / deterministic hash 派生，而不是 `uuid4()`。

### 5.2 Seed 的边界

`seed` 只保证同一生成算法/依赖版本下的伪随机序列。仅保存 seed 不足以保证几年后绝对重复。

Compile Manifest 必须同时记录：

```yaml
compilerVersion: 0.x.y
generatorVersions:
  mimesis: x.y.z
  faker: x.y.z
scenarioDigest: sha256:...
```

依赖要 pin 到明确版本；升级生成器需要新的 manifest。

---

## 6. IP / 网络资源分配

Scenario 应提供 deterministic allocator，而不是让每个 Driver 自己随机 IP。

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

### 7.1 示例

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

### 7.2 Projection 操作

第一版支持有限、安全、可验证的表达式，不要直接执行 Python/JS：

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

后期可考虑 CEL/JQ，但 MVP 不需要自建脚本语言。

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

### Deterministic selection

`percentage` 不能调用不可控的 runtime random；应使用基于 `(seed, node_id, defect_id)` 的 deterministic hash 判断。

---

## 9. Source Driver 配置

Driver-specific 内容放在 `driverConfig`，核心 schema 只验证通用字段，具体 Driver 再做二次 schema 校验。

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

Compiler 调用 Driver capability/schema 验证，不允许未知字段悄悄被忽略。

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

这样 Truth 已变化，但 Excel source 仍然暴露旧版本。

---

## 11. Network / Protocol Faults 与语义 Defects 分离

不要把所有故障都放到 `projection.defects`。

### Semantic

改变“数据内容”：

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

---

## 12. Source Refresh / Staleness

企业数据源很少完全实时，因此 source projection 要明确真值版本：

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

错误禁止 Start；warning 可由用户接受。

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

---

## 15. Scale 设计

不要要求 YAML 显式写 100,000 条对象。

大规模场景必须依赖：

- generate/count；
- templates；
- distributions；
- deterministic allocators；
- vectorized/batched persistence；
- streaming artifact render。

Compile Preview 在真正物化前先给出估算：

```text
nodes: ~101,200
edges: ~280,000
containers: 6
estimated memory: 2.4 GiB
estimated artifact size: 180 MiB
```

---

## 16. v1alpha1 明确暂不支持

- arbitrary embedded Python/JS；
- Jinja 模板任意执行；
- 用户任意 Docker image；
- source 在每次请求时调用 LLM；
- 任意 DAG/workflow；
- 多用户冲突合并；
- distributed Truth Graph；
- graph query language。

保持 DSL 可审计和可确定性比“万能表达能力”更重要。
