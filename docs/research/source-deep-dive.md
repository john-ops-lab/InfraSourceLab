# 重点项目源码拆解与设计借鉴

> 本文记录我们从成熟项目抽取什么架构模式、哪些东西直接复用、哪些东西不复制。它是**设计研究**，不是正式 Driver capability 清单。正式能力以 InfraSourceLab pin 的 backend 版本 + integration test 为准。

## 1. Microcks：Importer Registry + 统一模型 + 结构化 AI

Repo: `microcks/microcks`

值得借鉴：

```text
Input Artifact
     ↓
Importer Registry
     ↓
Intermediate Model
     ↓
Scenario Candidate
     ↓
Validation / Review / Apply
```

Microcks 的 importer 体系覆盖 OpenAPI/Swagger/AsyncAPI/Postman/Protobuf/GraphQL/SOAP/HAR 等，说明 Import 不应塞成 Scenario API 里的巨大 if/else。

AI 方面值得借鉴的是：

- prompt 约束输出结构；
- schema-aware examples；
- LLM 输出再次 parse 到正式 domain model；
- 自由文本不能直接成为运行配置。

ISL 对应：

```text
LLM output
  ↓ strict extraction
ScenarioCandidate
  ↓ schema/semantic/capability/security validation
User review / Apply
```

不复制：Spring Boot、MongoDB、Keycloak、Microcks domain model、Async Minion 实现。

---

## 2. MockForge：Core / Driver / Plugin 分层

Repo: `SaaSy-Solutions/mockforge`

值得借鉴：

```text
Core Domain
  ↑ no concrete backend dependency
Driver Contract / Registry
  ↑
Concrete Drivers
  ↑
Agent Runtime
```

不要出现：

```python
if driver == "vcsim": ...
elif driver == "kwok": ...
```

散落在 Compiler 中。

其 plugin/datasource trait 进一步验证：capability / validate / lifecycle / cleanup 应是正式契约。

不复制：Rust 技术栈、WASM plugin system、自研多协议实现、超前 marketplace。

---

## 3. govmomi/vcsim：compact model → real protocol objects

Repo: `vmware/govmomi`

重点价值：

- count-based inventory；
- Datacenter/Cluster/Host/VM/Datastore/Network 等真实 vSphere 对象语义；
- registry/native identity；
- deterministic-like fixture knobs；
- delay/mutation 能力。

### 对 ISL 的借鉴

大规模 Scenario 应描述：

```yaml
generate:
  count: 1500
  template: ...
```

而不是 AI 展开 1500 个 VM block。

统一 Compiler 分配 canonical ID/IP；Driver 保存：

```text
canonical_id ↔ MoRef/UUID/native path
```

**实际 Driver 能调用哪些 mutation/delay 能力，以 ISL 最终 pin 的 govmomi 版本验证为准。**

---

## 4. KWOK：声明式状态阶段

Repo: `kubernetes-sigs/kwok`

KWOK Stage 展示了 selector + delay/jitter + ordered patch/event/delete/apply 等声明式变化方式。

ISL 借鉴：

```text
selector + typed action + deterministic ordering
```

而不是后台随机线程。

但 KWOK Stage 深度绑定 Kubernetes object/subresource，所以 ISL Core Timeline 仍保持 source-neutral；K8s Driver 再翻译。

---

## 5. snmpsim：Projection、Variation 与 Protocol Fault 分层

Repo: `etingof/snmpsim`

snmpsim 证明 SNMP 不需要我们自己实现 PDU。

可借鉴能力类别：

- recorded data；
- `.snmprec`；
- dynamic value variation；
- delay/error；
- time-series/multiplex；
- trap/inform；
- external-backed values。

ISL 模型保持：

```text
Initial Source Projection
       +
Lifecycle / Variation
       +
Protocol / Transport Fault
```

具体 variation module 能力以正式 pin 版本测试为准。

---

## 6. DMTF Redfish Interface Emulator：Static + Dynamic

Repo: `DMTF/Redfish-Interface-Emulator`

值得复用：

- static mockup；
- dynamic resource；
- GET/PATCH/POST/DELETE；
- populate/infragen 的 count/hierarchy 配置。

这与 ISL 的：

```text
Truth hierarchy/edges
 → Redfish Projection
 → populate/resources
```

天然匹配。

不复制其协议 route 到 Core；通过 Driver 编排 backend。

---

## 7. Mockoon：Backend config 是编译产物，不是 Scenario

Repo: `mockoon/mockoon`

```text
Scenario
  ↓
Projection
  ↓
HttpSource intermediate model
  ↓
Mockoon Renderer
  ↓
environment config
```

Mockoon config 不进入 public Scenario DSL。

这样以后换 backend，Truth/Projection 不变。

---

## 8. Toxiproxy：共享 Transport Fault Backend

Repo: `Shopify/toxiproxy`

架构价值：不要给每个 Driver 各写：

```text
add_latency
add_timeout
add_bandwidth
...
```

统一：

```text
Test Client
   ↓
Toxiproxy published endpoint
   ↓
Source Backend
```

### 版本事实必须区分

上游项目的 `main` 会变化；正式 ISL Driver 会 pin 某个 release/image。因此本文即使观察到 upstream source 中存在 latency、bandwidth、timeout、reset_peer、packet_loss、limit_data、slicer、slow_close 等实现，也**不能直接等价为 ISL 当前支持**。

正式流程：

```text
pin version
  ↓
integration test each required toxic
  ↓
capability registry
```

这样避免研究文档比实际发行版本“跑得更快”。

---

## 9. FakeNOS / scrapli-replay：Synthetic 与 Capture 两条 CLI 路线

### FakeNOS

用于 synthetic CLI endpoint，适合 Truth-driven：

```text
show version
show inventory
show interfaces
show ip interface brief
```

### scrapli-replay

用于真实授权设备的 capture → sanitize → replay。

ISL 不需要在二者中二选一：

```text
Synthetic → FakeNOS
Recorded  → scrapli-replay
High fidelity → later user-provided NOS lab
```

---

## 10. Netopeer2 + sysrepo：标准协议用标准服务

```text
YANG model
  ↓
sysrepo datastore
  ↓
Netopeer2
  ↓
NETCONF SSH endpoint
```

ISL 只负责 Truth Projection → datastore，不实现 NETCONF framing/RPC/YANG engine。

---

## 11. Moto / Azurite / fake-gcs-server

### Moto

适合 standalone AWS mock endpoint；ISL 使用 SDK endpoint override 与 fake credentials。

### Azurite

只代表 Azure Storage，不是整个 Azure control plane。

### fake-gcs-server

只代表 GCS-compatible endpoint，不是整个 GCP。

共同借鉴：**Simulator capability 应精确描述，不用一个产品名暗示整个平台都被模拟。**

---

## 12. Real Services：真服务比 fake wire protocol 更便宜

PostgreSQL/MySQL/Redis/Kafka/RabbitMQ/MQTT/SFTP/LDAP 等：

```text
Truth Projection
  ↓
render seed/config
  ↓
real service
```

不要重新实现 wire protocol。

可以共享 start/health/credentials/cleanup abstraction，但不要为了“统一”把所有协议业务操作都强制抽象成相同 CRUD。

---

## 13. NetBox：真实应用数据源

NetBox 本身就是成熟 Source of Truth，适合：

```text
Truth
 ↓ supported NetBox API/import
real NetBox objects
 ↓
DLR / CMDB collector
```

比“模仿 NetBox REST routes”更有验证价值。

---

## 14. 最终抽取的设计模式

### Pattern A — Truth-first

所有 backend 从同一 canonical world 获得输入。

### Pattern B — Driver config is generated artifact

Mockoon config、SNMP records、Redfish populate、YANG datastore 等不污染 Core Scenario model。

### Pattern C — Capability registry

```text
actual pinned backend
  ↓ integration test
DriverCapabilities
  ↓
Compiler + UI
```

### Pattern D — Identity map

每个 source 保存 canonical ↔ native identity。

### Pattern E — Lifecycle source-neutral

Core action 是 create/patch/delete/relink/refresh/fault；Driver 翻译为 backend-native operation。

### Pattern F — Shared fault layer

transport fault 尽可能统一，protocol/application fault 由 backend 原生实现。

### Pattern G — Importer registry

格式解析与 Scenario domain 解耦。

### Pattern H — AI proposes structured state

AI 输出 Candidate，经过 strict validation 与 user Apply；不直接触碰 runtime。

---

## 15. 明确不复制

- 某个模拟器的完整协议实现；
- Microcks/MockForge 的整套 runtime；
- DLR 前端；
- vendor proprietary models/images；
- 任意第三方 capability 未经 pin-version test 的“推测支持”。

研究的目标是**少写代码、提高 fidelity、降低长期维护成本**。