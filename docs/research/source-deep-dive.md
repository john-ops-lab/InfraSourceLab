# 重点项目源码拆解与设计借鉴

> 本文不是功能介绍，而是记录：我们从哪些成熟项目的源码/架构中抽取什么设计，同时明确哪些东西不复制。

## 1. Microcks：契约导入 → 统一模型 → 示例生成

Repo: https://github.com/microcks/microcks

### 1.1 值得借鉴的架构

Microcks 当前整体是：

```text
Spring Boot Core
+ Angular UI
+ MongoDB
+ Keycloak
+ Async Minions
+ CLI / Operator / Testcontainers integrations
```

对 ISL 来说它太重，但其“导入器 + 统一 domain model”非常值得借鉴。

### 1.2 `MockRepositoryImporterFactory`

源码：

`webapp/src/main/java/io/github/microcks/util/MockRepositoryImporterFactory.java`

它根据输入文档标记选择 importer：

- Postman；
- OpenAPI 3；
- Swagger；
- AsyncAPI 2/3；
- Protobuf/gRPC；
- GraphQL；
- SoapUI；
- HAR；
- Microcks Metadata/Examples。

### 对 ISL 的借鉴

不要让所有 import 逻辑塞进 Scenario API：

```text
Input Artifact
     ↓
Importer Registry
     ↓
Intermediate Import Model
     ↓
Scenario Candidate
     ↓
Validation + Diff + Apply
```

例如未来：

```text
OpenAPI          → HttpSource Candidate
HAR              → ReplaySource Candidate
Postman          → HttpSource Candidate
snmpwalk/snmprec → SnmpSource Candidate
YANG             → NetconfSource Candidate
Redfish mockup   → RedfishSource Candidate
CSV/xlsx         → ArtifactSource Candidate
```

### 1.3 `AICopilotHelper`

源码：

`webapp/src/main/java/io/github/microcks/util/ai/AICopilotHelper.java`

关键思想不是“用了 AI”，而是：

1. Prompt 明确要求 realistic + schema-valid；
2. 每种协议有确定的输出格式；
3. 强制 YAML structure；
4. LLM output 再 parse 到正式 domain model；
5. 不把自由文本直接当运行配置。

### 对 ISL 的借鉴

AI Scenario Assistant 的返回必须是：

```text
LLM text
  ↓ strict extraction
ScenarioCandidate
  ↓ JSON Schema
  ↓ semantic validation
  ↓ Driver capability validation
Candidate Diff
```

绝不允许：

```text
LLM → shell/docker command → execute
```

### 不复制的东西

- Java/Spring Boot；
- MongoDB；
- Keycloak；
- Microcks 的 API domain model；
- Async Minion 实现。

ISL 只复用设计模式，通过可选 Driver 使用 Microcks 本身。

---

# 2. MockForge：Core / Protocol / Plugin / Feature 分层

Repo: https://github.com/SaaSy-Solutions/mockforge

MockForge 是目前调研中“产品理念最像万能模拟器”的项目之一，但成熟度不足以成为本项目长期底座。

## 2.1 Cargo workspace 分层

其 `ARCHITECTURE.md` 把 crates 分为：

### Public core/protocol

- `mockforge-core`；
- `mockforge-http`；
- `mockforge-ws`；
- `mockforge-grpc`；
- `mockforge-graphql`；
- `mockforge-data`。

### Plugin

- `mockforge-plugin-core`；
- `mockforge-plugin-sdk`；
- `mockforge-plugin-loader`。

### Internal features

- CLI；
- UI；
- recorder；
- observability；
- tracing；
- chaos；
- reporting；
- plugin registry。

依赖规则明确要求向下依赖、协议独立、插件隔离。

### 对 ISL 的借鉴

Python 项目虽然不需要 Rust crates，但需要保持同样边界：

```text
Core Domain
  ↑ no concrete driver dependency
Driver Contract / Registry
  ↑
Concrete Drivers
  ↑
Agent Runtime
```

不要出现：

```python
# compiler.py
if source.driver == "vcsim":
    ...
elif source.driver == "kwok":
    ...
```

具体 driver 选择通过 registry/capability dispatch。

## 2.2 `DataSourcePlugin` trait

源码：

`crates/mockforge-plugin-core/src/datasource.rs`

接口包含：

- capabilities；
- initialize；
- connect；
- query；
- get_schema；
- test_connection；
- validate_config；
- supported_types；
- cleanup。

### 对 ISL 的借鉴

我们的 Driver contract 同样必须把：

```text
capability
validate
render
start
health
apply lifecycle action
stop
cleanup
```

作为正式协议，而不是每个 Driver 各写一套 service class。

## 2.3 Plugin 安全

MockForge 甚至引入 WASM sandbox/plugin loader。这提醒我们：插件扩展最终一定涉及安全边界。

但 ISL 第一版不需要“第三方用户上传插件”。Driver 是仓库内受信代码 + allowlisted container。等生态真实出现再做外部 Plugin SDK。

### 不复制

- Rust 技术栈；
- WASM plugin system；
- 自己实现所有协议；
- 大量超前功能。

---

# 3. govmomi/vcsim：用模型生成真实协议对象

Repo: https://github.com/vmware/govmomi

重点源码：

- `simulator/model.go`
- `simulator/registry.go`
- `vcsim/main.go`

## 3.1 `Model` 是优秀的 count-based fixture

`Model` 直接描述：

- Datacenter count；
- Portgroup；
- Opaque Network；
- standalone Host；
- Cluster；
- ClusterHost；
- ResourcePool；
- Datastore；
- VirtualMachine；
- Folder；
- VirtualApp；
- StoragePod。

这说明真实模拟器也不要求输入一万条对象；可以从 compact model 物化 inventory。

### 对 Scenario DSL 的借鉴

我们也使用：

```yaml
generate:
  count: 1500
  template: ...
```

而不是 AI 展开 1500 个 VM YAML block。

## 3.2 Deterministic IP

`Model` 当前支持 `HostIPBase`，按创建顺序给 HostSystem 管理地址递增分配。

### 对 ISL 的借鉴

所有地址/ID allocation 统一在 Compiler 完成，不交给各 backend 自己随机分配。

## 3.3 DelayConfig

源码有：

```text
Delay
MethodDelay
DelayJitter
```

### 对 ISL 的借鉴

故障能力应支持：

```text
global transport fault
source-specific fault
operation-specific fault
```

但网络层统一走 Toxiproxy；只有 backend 自己已有 method-level fault 时才利用。

## 3.4 Registry / managed object identity

vcsim 内部 registry 保存 managed objects/references。

### 对 ISL 的借鉴

每个 Driver 必须维护：

```text
canonical_id ↔ source_native_id
```

否则 Verification 无法解释“vm-0007 在 vCenter 里实际叫哪个 MoRef/UUID”。

---

# 4. KWOK：状态阶段不是随机变化，而是声明式变化

Repo: https://github.com/kubernetes-sigs/kwok

重点：

`pkg/apis/v1alpha1/stage_types.go`

## 4.1 StageSpec

KWOK Stage 支持：

- ResourceRef；
- Selector；
- Weight；
- expression-based weight；
- Delay/Jitter；
- ordered Steps。

Step 可以：

- Patch；
- Event；
- Finalizer change；
- Delete；
- Apply。

Selector 支持 labels/annotations 和 CEL/JQ expression。

### 对 ISL 的借鉴

ISL Timeline 也必须是**声明式、可重放的状态变化**：

```text
selector + action + deterministic ordering
```

而不是写一个后台线程，每隔几秒随机改几个对象。

## 4.2 为什么不直接采用 KWOK Stage DSL

KWOK schema 深度绑定 Kubernetes Object、subresource、finalizer、server-side apply。

ISL 需要 source-neutral：

```text
patch canonical attribute
create entity
delete entity
relink edge
set source freshness
inject fault
```

K8s Driver 再把这些 action 翻译为 Stage/Kubernetes operations。

---

# 5. snmpsim：动态数据与故障应当是模块化 variation

Repo: https://github.com/etingof/snmpsim

重点文档/源码：

`docs/source/documentation/simulation-with-variation-modules.rst`

snmpsim 的 `.snmprec` 可以把某个 OID/subtree 交给 variation module。

内置 variation 覆盖：

- `numeric`：随时间变化的 counter/gauge；
- `notification`：TRAP/INFORM；
- `writecache`：SET 可写持久；
- `sql`；
- `redis`；
- `delay`；
- `error`；
- `multiplex`：时间序列 snapshot；
- `subprocess`。

## 对 ISL 的借鉴

### 动态变化与静态 Projection 分开

```text
Initial Projection
   +
Variation/Lifecycle Layer
```

### Fault taxonomy 分层

snmpsim 已明确区分：

- value variation；
- delay；
- protocol error；
- notification。

ISL 也不应该只有一个笼统 `chaos: true`。

### Record → Replay

snmpsim 能从真实 SNMP Agent 记录数据，这验证了 ISL “有真实环境时先 capture，再长期复用”的路线。

---

# 6. DMTF Redfish Interface Emulator：Static + Dynamic 双模式

Repo: https://github.com/DMTF/Redfish-Interface-Emulator

## 6.1 Static

把 Redfish mockup hierarchy 放到 static 目录即可提供 GET。

适合只读 Adapter：

```text
mockup directory → endpoint
```

## 6.2 Dynamic

每类 resource 可以用 template file + API file 实现 GET/PATCH/POST/DELETE。

它还提供 code generator，说明复杂标准协议下“由 schema/mockup 生成实现骨架”比手写每个资源合理。

## 6.3 `infragen/populate-config.json`

配置能表达：

```text
5 Chassis
 → 每 Chassis 1 System
   → 2 CPU
   → 多种 Memory
   → Storage
   → NIC
```

### 对 ISL 的借鉴

这和 Truth Graph 正好匹配：

```text
canonical hierarchy/edges
 → Redfish source projection
 → populate config/resources
```

同时说明 Scenario 的 count/template/reference 模型是合理的。

---

# 7. Mockoon：让配置格式成为 Driver 输出，不成为 Core 模型

Repo: https://github.com/mockoon/mockoon

Mockoon CLI 可以直接从：

- Mockoon environment JSON；
- OpenAPI YAML/JSON；

启动 server，还支持 Faker seed、admin API、response rules、proxy、logs。

### 对 ISL 的借鉴

`environment.json` 是**编译产物**，不是 Scenario。

```text
Scenario Source
  ↓
Projection
  ↓
HttpSource Intermediate Model
  ↓
Mockoon Renderer
  ↓
environment.json
```

如果未来换成 WireMock，前两层无需变化。

---

# 8. Toxiproxy：把网络故障从所有 Driver 中抽出去

Repo: https://github.com/Shopify/toxiproxy

Toxiproxy 通过 HTTP API 管理 TCP proxy 和 toxics：

- latency/jitter；
- bandwidth；
- timeout；
- reset_peer；
- packet_loss；
- slow_close；
- disable proxy；
- limit_data/slicer。

### 对 ISL 的关键架构意义

不要写：

```text
VcsimDriver.add_latency()
PostgresDriver.add_latency()
RedisDriver.add_latency()
SnmpDriver.add_latency()
```

统一：

```text
Source Backend
      ↑
  Toxiproxy
      ↑
 Test Client
```

Core Fault Controller 只操作 Toxiproxy；Driver 声明 endpoint 是否可 proxy。

---

# 9. FakeNOS / scrapli-replay：Synthetic 与 Capture 两条网络 CLI 路线

## FakeNOS

Repo: https://github.com/fakenos/fakenos

它证明网络 CLI 完全可以用轻量 SSH server 提供足够真实的 command prompt/response，而不用一上来启动厂商虚拟路由器。

### 借鉴

ISL 要提供“CLI profile”：

```yaml
profiles:
  cisco-ios-basic-inventory:
    commands:
      show version: ...
      show inventory: ...
      show interfaces: ...
```

模板 body 来自 Truth Projection。

## scrapli-replay

Docs: https://scrapli.github.io/scrapli_replay/

Collector 从真实设备采集 command/response，Server 再启动 semi-interactive SSH endpoint。

### 借鉴

ISL 后期 Capture Importer 应把：

```text
real session
 → sanitize
 → parameterize
 → replay profile
```

作为标准工作流，而不是只允许手写 simulator config。

---

# 10. Netopeer2 + sysrepo：标准协议优先使用标准服务实现

Netopeer2: https://github.com/CESNET/netopeer2

sysrepo: https://github.com/sysrepo/sysrepo

它们提供：

```text
YANG model
  ↓
sysrepo datastore
  ↓
Netopeer2
  ↓
real NETCONF SSH endpoint
```

### 对 ISL 的借鉴

对于 schema-driven protocol：

```text
Truth Projection
 → standard datastore
 → existing protocol server
```

往往是最佳路线。

这也说明未来 RESTCONF/gNMI 等不要本能地自己实现协议。

---

# 11. containerlab：Topology as Code 很好，但不是我们的 Core DSL

Website: https://containerlab.dev/

containerlab YAML 描述：

- topology nodes；
- node kind/image；
- links；
- management network/IP；
- startup config。

### 借鉴

- lab-scoped resource naming；
- declarative lifecycle；
- node/link 图；
- management network；
- deterministic topology rendering。

### 不直接采用它作为 Scenario

ISL World 是“配置数据真实世界”，containerlab topology 是“需要运行的网络设备拓扑”。

例如一个 CMDB 可以有 10000 台网络设备记录，但测试并不需要启动 10000 个 NOS container。

因此：

```text
Truth Graph 10,000 network devices
   ↓ projection subset/fidelity policy
FakeNOS 100 endpoints
或 containerlab 10 high-fidelity devices
```

这是 Fidelity Ladder 的实际意义。

---

# 12. 组合后的 ISL 自研最小核心

把所有源码调研叠在一起后，需要自己写的其实可以很克制：

```text
1. Scenario schema / revisions
2. Deterministic compiler
3. Truth Graph
4. Projection engine
5. Driver contract + registry
6. Lab Agent orchestration
7. Timeline controller
8. Fault controller
9. Ground Truth / Observation / Verifier
10. AI Scenario authoring surface
11. DLR-style Web workbench
```

下面这些原则上**不自己写**：

```text
HTTP generic mock engine
vSphere SOAP protocol
Kubernetes API server behavior
SNMP PDU engine
Redfish protocol model
SSH implementation
NETCONF protocol stack
AWS API emulator
PostgreSQL/MySQL/Redis/Kafka protocols
TCP chaos proxy
network NOS virtualization
```

这条边界应在每个开发 Wave Review 时重新检查。只要 Qoder 开始在 Core 里写一个现有成熟项目已经完整实现的协议，就应暂停并重新评估。
