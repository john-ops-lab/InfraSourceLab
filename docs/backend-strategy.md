# 模拟器与数据源后端策略

## 1. 总原则

InfraSourceLab 的长期维护成本主要取决于一个决策：**我们是否自己实现协议。**

默认答案应当是“不”。

每增加一个数据源，按以下顺序决策：

```text
1. 有没有成熟、可自动化、许可证合适的专用 Simulator？
       ↓ no
2. 能否直接启动真实开源服务，并向其中灌入 Truth Projection？
       ↓ no
3. 能否用 OpenAPI/JSON Schema/AsyncAPI 等标准契约模拟？
       ↓ no
4. 能否从真实系统 capture 一次，再安全地 record/replay？
       ↓ no
5. 是否真的需要高保真厂商虚拟设备，并由用户提供合法镜像？
       ↓ no
6. 才考虑自研一个尽可能薄的 Driver/Backend。
```

ISL 的产品价值在“统一世界、统一控制、统一验证”，不是拥有最多自研协议。

---

## 2. Fidelity Ladder

### L0 — Artifact

直接生成：

- JSON；
- YAML；
- CSV；
- Excel/xlsx；
- line-delimited JSON；
- directory tree / static files。

用途：

- 人工资产台账；
- 批量导入；
- SFTP/文件采集的文件内容；
- 快速验证字段映射。

ISL 自己实现这一层，因为它本质是数据渲染，不是协议模拟。

### L1 — Contract Mock

适用：

- REST/OpenAPI；
- GraphQL/gRPC/AsyncAPI（后期）；
- SaaS/ITSM/厂商 API 在没有真实系统时。

优先利用标准工具，不在 Control 内嵌一个万能 Router/Template Engine。

### L2 — Protocol Emulator

适用：

- vSphere/vCenter；
- Kubernetes；
- SNMP；
- Redfish/IPMI；
- 网络设备 SSH CLI；
- NETCONF/YANG。

这类协议行为复杂，成熟模拟器价值最大。

### L3 — Real Service

对于本地启动成本很低的系统，**真实服务比假协议更简单、更可信**：

- PostgreSQL / MySQL；
- Redis；
- Kafka；
- RabbitMQ；
- MQTT broker；
- SFTP/SSH file server；
- LDAP；
- HTTP file server；
- Prometheus-compatible endpoint（需要时）。

ISL 只生成 schema/data/config 并编排服务。

### L4 — Virtual Appliance Lab

适用真正需要厂商 NOS/设备行为的少量测试：

- containerlab；
- GNS3；
- vrnetlab；
- 其他用户自有虚拟设备环境。

这一层资源重、许可复杂，永远是 optional，不作为安装默认依赖。

---

## 3. 默认与可选后端矩阵

| 数据源 | 首选 | 方式 | 阶段 | 决策 |
|---|---|---|---|---|
| JSON/YAML/CSV/xlsx | ISL renderer | L0 | M1 | Core |
| 通用 REST | Mockoon CLI | L1 | M1 | Default driver |
| OpenAPI contract-only | Prism | L1 | M1/M4 | Optional driver |
| HTTP record/replay | Hoverfly | L1 | M2/M4 | Optional/default capture backend |
| 多协议 API | Microcks | L1 | M4+ | Optional heavy backend |
| vCenter/ESXi | govmomi vcsim | L2 | M3 | Default |
| Kubernetes | KWOK | L2 | M3 | Default |
| SNMP | snmpsim | L2 | M3 | Default |
| Redfish | DMTF Redfish Interface Emulator | L2 | M3 | Default |
| Network SSH CLI | FakeNOS | L2 | M3 | Default |
| Network SSH replay | scrapli-replay | L2 | M4 | Optional |
| NETCONF/YANG | Netopeer2 + sysrepo | L2 | M4 | Default when NETCONF enabled |
| IPMI | OpenIPMI `ipmi_sim` | L2 | M4+ | Candidate; license/build verify before integration |
| AWS | Moto | L2 | M4 | Default |
| Azure Storage | Azurite | L2/L3 | M4 | Default for Blob/Queue/Table only |
| GCS | fake-gcs-server | L2 | M4 | Default |
| VMware-independent hypervisor API | libvirt test driver | L2 | M4 | Optional |
| PostgreSQL | official/community image | L3 | M1 | Default real-service pack |
| MySQL | official/community image | L3 | M4 | Real-service pack |
| Redis | official image | L3 | M4 | Real-service pack |
| Kafka | Apache Kafka image | L3 | M4 | Real-service pack |
| MQTT | Eclipse Mosquitto | L3 | M4 | Real-service pack |
| RabbitMQ | RabbitMQ | L3 | M4 | Real-service pack |
| SFTP | OpenSSH-based image | L3 | M1/M4 | Real-service pack; pin/verify image |
| LDAP | OpenLDAP | L3 | M4 | Real-service pack |
| NetBox | real NetBox + demo/seed data | L3 | M4 | Source pack |
| Nautobot | real Nautobot + seed data | L3 | later | Source pack |
| Ralph | real Ralph + seed data | L3 | later | Source pack |
| 高保真 NOS | containerlab + user images | L4 | later | Optional |

---

## 4. 通用 HTTP：为什么首选 Mockoon CLI

MVP 需要一个轻量、无 Java/Kubernetes 依赖、适合 Docker/headless、配置可生成的 HTTP backend。

Mockoon CLI 满足：

- MIT；
- CLI + Docker；
- OpenAPI import；
- templating；
- response rules；
- Faker seed；
- JSON data；
- proxy；
- request logs；
- admin API；
- 可在一个进程运行多个 mock。

Driver 不让用户直接编辑 Mockoon config。流程应是：

```text
Truth Projection
      ↓
ISL http_mockoon Driver
      ↓
render Mockoon environment.json
      ↓
Mockoon CLI container
```

这样以后换 backend 不影响 Scenario。

### Prism 的位置

Prism 更适合：

- 已有 OpenAPI；
- 想严格验证 request 是否符合 contract；
- 不需要复杂状态/数据库。

它不是 ISL 通用 HTTP 的唯一后端，因为 CMDB 数据源常需要 pagination、状态变化、可控错误等更丰富行为。

### Hoverfly 的位置

Hoverfly 强项是：

- capture；
- simulate；
- stateful response sequence；
- latency / failure；
- 可导出 simulation。

因此主要作为 **record/replay pipeline**，而不是所有 synthetic REST 的默认 renderer。

### Microcks 的位置

Microcks 是成熟度最高的多协议 API mocking/test 平台之一，支持 OpenAPI、AsyncAPI、gRPC、GraphQL、SOAP 等，也支持异步协议和 AI 示例生成。但它自己的 Spring Boot/MongoDB/Keycloak/Minion 体系明显比 ISL MVP 重。

策略：

- 不 fork；
- 不把它设为 M0/M1 硬依赖；
- 后期做 `microcks` driver，让需要高级 API/async contract 的用户选择启用。

---

## 5. vCenter：govmomi vcsim

不要模拟 vSphere SOAP/REST。

`vcsim` 已经拥有真实 govmomi 对象模型和 API 行为，能够生成：

- Datacenter；
- Cluster；
- HostSystem；
- ResourcePool；
- Datastore；
- VirtualMachine；
- network / distributed portgroup；
- folder / app / storage pod 等。

源码中的 `Model` 还提供：

- count-based inventory；
- deterministic host IP base；
- 全局/per-method delay；
- delay jitter；
- inventory property 变更能力。

### ISL Driver 要做的事

- 根据 Truth Projection 生成/初始化 vcsim inventory；
- 保留 canonical ID ↔ vSphere ManagedObjectRef/UUID 映射；
- 把 timeline patch/relink 映射为 vcsim mutation；
- 把 transport fault 尽量交给 Toxiproxy，而不是重复做 network fault；
- 对 vcsim 不支持的细节明确降级，不伪装成真实 vCenter 全功能。

---

## 6. Kubernetes：KWOK

KWOK 的关键价值不是“返回 Pod JSON”，而是它使用真实 Kubernetes API 语义并能低成本制造大量 Node/Pod。

ISL 应借鉴 KWOK `Stage`：

- selector；
- weighted state；
- delay/jitter；
- ordered patch/event/delete/apply steps。

但 ISL Timeline 必须保持 source-neutral；不要把 KWOK Stage schema 直接变成平台统一 DSL。

### Driver 责任

- 生成集群所需 manifests；
- 启动 KWOK cluster；
- apply initial nodes/pods/workloads；
- timeline 时 patch/delete/apply；
- capture Kubernetes object UID/resourceVersion 到 source identity map。

---

## 7. SNMP：snmpsim

snmpsim 已覆盖大量我们本来很容易重复实现的能力：

- SNMP v1/v2c/v3；
- 大量 agent；
- 从真实 SNMP 数据录制；
- `.snmprec`；
- dynamic variation modules；
- numeric counters；
- delay；
- protocol errors；
- time-series/multiplex；
- trap/inform；
- SQL/Redis-backed values。

ISL 不实现 SNMP PDU。

### Driver 责任

- 维护 MIB/OID mapping profile；
- Truth Projection → `.snmprec`/variation config；
- 多设备 endpoint/identity；
- timeline 更新；
- fault 映射。

后续可以提供社区维护的设备 profile，例如 common server/network MIB，而不是复制厂商 MIB 的受限内容。

---

## 8. Redfish：DMTF Redfish Interface Emulator

DMTF 官方项目支持 static 和 dynamic resource；其 `infragen/populate-config.json` 已经展示了很适合 ISL 的 count/template 生成方式，例如 Chassis → Systems → CPU/Memory/Storage/NIC。

### 为什么选 Interface Emulator，而不仅是 static Mockup Server

CMDB 需要生命周期，动态 Emulator 支持 GET/PATCH/POST/DELETE，适合：

- server inventory；
- BMC endpoint；
- processor/memory/storage/NIC；
- power/status change；
- dynamic composition（后期）。

Driver 仍然只使用 DMTF backend，不把其 Python dynamic resource 实现复制到 ISL core。

---

## 9. Network CLI：FakeNOS + scrapli-replay

### FakeNOS

适合 synthetic CLI device：

- 提供 SSH server；
- 模拟多种 NOS 命令行为；
- inventory-driven；
- MIT；
- Python 生态，Driver 集成成本低。

ISL 提供 source profiles，例如：

```text
show version
show inventory
show interfaces
show ip interface brief
```

输出来自 Truth Projection。

### scrapli-replay

适合 capture/replay：从真实设备一次采集命令/输出后，生成 semi-interactive SSH server。它还会把 replay server credential 固定成测试 credential，降低原始密码泄漏风险。

ISL 后期可以做：

```text
import captured session
 → sanitize
 → map placeholders to Truth fields
 → replay source
```

---

## 10. NETCONF/YANG：Netopeer2 + sysrepo

这是比“自己做一个 NETCONF fake server”更可靠的路径：

- Netopeer2 提供真实 NETCONF server；
- libyang 处理 YANG；
- sysrepo 作为 YANG datastore；
- 可以装载标准或用户提供的 YANG module；
- ISL 只负责把 Source Projection 写入 sysrepo。

需要注意：YANG module 自身可能存在版权/再分发约束。ISL core 只捆绑许可明确的标准模型，厂商模型由用户提供。

---

## 11. Cloud

### AWS：Moto 作为默认

Moto 可直接作为 standalone server，适合非 Python DLR client。它对 AWS 服务覆盖广，且比 2026 年商业策略变化后的 LocalStack 更适合做开源项目默认依赖。

### LocalStack：明确 optional

2026-03-23 起原 Community repo 归档，新统一镜像需要账号/auth token；免费 Hobby 面向非商业用途，商业使用需要相应订阅。因此：

- ISL 不把 LocalStack 作为默认；
- 可以允许用户配置已有 LocalStack endpoint/token；
- 不把凭据/许可逻辑耦合到 Core。

### Azure：Azurite

只把它描述为 **Azure Storage emulator**，不要假装能模拟整个 Azure control plane。适合 Blob/Queue/Table 采集场景。

### GCP：fake-gcs-server

适合 GCS-compatible local API。更广泛 GCP resource management 模拟先用 contract mock 或特定服务模拟器，不宣称“全 GCP”。

---

## 12. 数据库与中间件：真实服务优先

例如 DLR 要测试 PostgreSQL 采集：

错误方案：

```text
ISL 自己实现 PostgreSQL wire protocol
```

正确方案：

```text
Truth Projection
  ↓
postgres Driver
  ↓
CREATE TABLE / INSERT deterministic rows
  ↓
real PostgreSQL container
```

同理 Redis/Kafka/MQTT。

### Service Driver 共性

```text
prepare schema/config
start container
wait health
seed data
publish endpoint + test credential
timeline apply mutation
cleanup
```

这部分可以抽出 `RealServiceDriverBase`，但不要为了“统一”强行把每种服务所有生命周期都抽象成完全相同 SQL/command。

---

## 13. Source-of-Truth / CMDB 系统本身

### NetBox

非常适合后期做“真实应用数据源”：

- DCIM；
- IPAM；
- virtualization；
- circuits；
- REST API / OpenAPI；
- 社区有 demo data。

策略不是模拟 NetBox API，而是启动真实 NetBox，按 Truth Projection 创建 site/rack/device/VM/IP 等对象。

这样 DLR 可以用真实 NetBox API 开发 Adapter。

### Nautobot / Ralph / iTop

同理作为 optional source packs。优先考虑：

- 容器部署成熟度；
- seed API；
- 许可证；
- ARM64/Mac 开发可用性；
- 启动开销。

不要在 M1 同时支持一堆 CMDB 产品。

---

## 14. 网络故障：Toxiproxy 作为统一 sidecar

Toxiproxy 支持：

- latency + jitter；
- timeout；
- reset peer；
- bandwidth；
- packet loss；
- slow close；
- disable proxy；
- HTTP control API。

因此只要协议走 TCP，大部分网络故障都统一走：

```text
DLR → Toxiproxy → actual source backend
```

Source Driver 不应各自再实现一套“延迟/断网”。只有协议层错误（例如 SNMP error PDU、HTTP 429）由对应 Driver 处理。

---

## 15. Record / Replay 安全策略

Capture 是非常有价值的“没有模拟器”降级路径，但也是最容易泄露生产信息的能力。

任何 capture import 必须经过：

1. credential/header redaction；
2. cookies/tokens/session IDs 清理；
3. hostname/IP/serial/MAC 可选脱敏；
4. body rule scan；
5. 用户预览 Diff；
6. 才能保存到 repo/Artifact Store。

默认 `.gitignore` capture raw directory；只有 sanitized artifact 才能进入版本库。

---

## 16. 高保真网络：为什么后置

containerlab/GNS3 很强，但它们解决的是“网络实验室”而不是普通 CMDB source fixture：

- host 要求更高；
- Mac 上常涉及 Linux VM；
- 厂商镜像许可复杂；
- 启动慢；
- 自动化清理更难。

M3 的 FakeNOS + SNMP + NETCONF 已能覆盖大量配置采集测试。只有 DLR Adapter 真正依赖厂商 CLI 细节时才需要 L4。

---

## 17. 新 Driver 引入 Gate

每个 Driver 合并前回答：

- 是否有更成熟现成工具？
- 为什么不用真实服务？
- 许可证是否允许我们的集成方式？
- 是否 ARM64 可用？如果不可用如何降级？
- Docker image 是否固定 digest/tag？
- 启动/health/cleanup 是否幂等？
- 是否支持 deterministic seed/data？
- source identity 如何回映 canonical ID？
- timeline 哪些 action 真支持？
- fault 哪些真支持？
- endpoint 默认是否只绑定本地/isolated network？
- logs/captures 是否可能泄露 secret？
- 最小 E2E 测试是什么？

没有通过 Gate 的 Driver 不进入默认发行包。
