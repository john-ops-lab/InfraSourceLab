# 工具全景调研：InfraSourceLab 可复用生态

> 调研基线：2026-08-24。本文的目标不是列一个“Awesome Mock”清单，而是回答：**InfraSourceLab 每类数据源最应该复用哪个现有轮子、复用到什么程度、哪些工具不应成为默认依赖。**
>
> 开源项目状态、许可证和商业策略会变化。真正加入 Driver 前必须重新核验 release、license、image 与 ARM64 支持。

## 1. 结论先行

目前没有发现一个成熟开源项目能完整覆盖：

```text
统一 IT Truth
+ vCenter/K8s/SNMP/Redfish/CLI/NETCONF/Cloud/DB/API/File
+ 多源不一致
+ 生命周期
+ 故障
+ Ground Truth
+ 下游验证
```

但几乎每个协议领域都有成熟局部轮子。因此合理路线是：

> **InfraSourceLab 做“Scenario Compiler + Truth Graph + Projection + Driver Orchestration + Verification”，底层尽量复用成熟 Simulator 或真实服务。**

这不是妥协，反而是项目最有价值的边界。

---

## 2. 评估维度

每个候选按以下维度判断：

- 是否真正提供外部可连接 endpoint，而不只是单元测试 mock；
- 协议保真度；
- 是否 headless / Docker / 自动化友好；
- 是否能 seed/populate；
- 是否支持动态状态；
- 是否支持故障；
- 是否支持 record/replay；
- 许可证；
- 社区/维护状态；
- ARM64/Mac 开发可行性；
- 与 ISL Truth Projection 的集成复杂度。

决策标签：

- **DEFAULT**：计划做正式 Driver；
- **OPTIONAL**：有价值但不是基础安装依赖；
- **REFERENCE**：借鉴设计，不直接依赖；
- **EXCLUDE/DEFER**：当前明确不作为基础方案。

---

# 3. 通用 API / Service Virtualization

## 3.1 Microcks — OPTIONAL / ARCHITECTURE REFERENCE

- Repo: https://github.com/microcks/microcks
- Website: https://microcks.io/
- CNCF Incubating（2026-05 升级）；
- 支持 OpenAPI、AsyncAPI、gRPC/Protobuf、GraphQL、SOAP/WSDL、Postman 等；
- Async Minion 覆盖 Kafka、MQTT、AMQP、WebSocket、Pub/Sub 等；
- contract testing；
- AI Copilot 能根据契约生成 realistic/schema-valid examples；
- Apache-2.0。

**非常值得借鉴：** artifact importer、内部统一 domain model、AI 严格结构化输出、Minion 异步协议扩展。

**不作为 MVP 底座：** Spring Boot + Angular + MongoDB + Keycloak + Minions 对个人本地 Lab 太重，而且它解决 API mocking，不解决 infrastructure Truth Graph。

结论：后期 `microcks` Driver；不 fork。

## 3.2 Mockoon CLI — DEFAULT 通用 REST Backend

- Repo: https://github.com/mockoon/mockoon
- CLI: https://mockoon.com/cli/
- MIT；
- OpenAPI import；
- dynamic Handlebars templates；
- response rules；
- Faker/seed；
- JSON databases；
- proxy；
- logs/admin API；
- Docker/headless。

非常适合 `Truth Projection → Mockoon config → container`。

## 3.3 Prism — OPTIONAL contract-only Backend

- Repo: https://github.com/stoplightio/prism
- OpenAPI v2/v3；
- mock + request validation + proxy；
- 能从 examples/schema 生成 response；
- Apache-2.0。

优点是契约驱动很纯；短板是本身不是有状态数据源平台。

## 3.4 Hoverfly — DEFAULT/OPTIONAL Record-Replay Backend

- Repo: https://github.com/SpectoLabs/hoverfly
- Docs: https://docs.hoverfly.io/
- Apache-2.0；
- Capture / Simulate / Spy；
- stateful sequence capture/replay；
- latency/random failure/rate-limit 类行为；
- simulation 可导出。

适合真实 API 很难模拟时的 capture/replay 路径。

## 3.5 WireMock — OPTIONAL

- Repo: https://github.com/wiremock/wiremock
- Website: https://wiremock.org/
- 老牌成熟 HTTP API mocking；
- standalone JAR/Docker；
- request matching、stateful scenarios、proxy/recording、faults。

能力很强，但 JVM 方案比 Mockoon CLI 更重。可做 alternate driver，不必 MVP 同时支持。

## 3.6 MockServer — OPTIONAL

- Website: https://www.mock-server.com/
- Repo: https://github.com/mock-server/mockserver
- HTTP/HTTPS、proxy、record/replay；
- 当前版本还覆盖更现代 HTTP/gRPC 场景；
- Java 生态，功能较重。

适合用户已有 MockServer 经验时，不作为默认。

## 3.7 Imposter — OPTIONAL / STRONG REFERENCE

- Repo: https://github.com/imposter-project/imposter
- Website: https://www.imposter.sh/
- REST/OpenAPI、SOAP/WSDL、gRPC，以及 Salesforce/HBase 等 plugin；
- template、store、capture/proxy、scripting；
- 多用途 service simulator。

它的 plugin 模型值得 Driver Registry 设计参考。

## 3.8 Mockintosh — REFERENCE / OPTIONAL

- Repo: https://github.com/up9inc/mockintosh
- 多 service virtualization；
- HTTP + async actors，曾覆盖 Kafka/RabbitMQ/Redis 等；
- 模板、动态配置、UI/API。

可以借鉴 declarative multi-service configuration，但不建议把项目建立在其维护节奏之上。

## 3.9 mountebank — REFERENCE

- Repo: https://github.com/bbyars/mountebank
- HTTP/TCP generalized test doubles；
- 对“协议还没有专用模拟器”时的 raw TCP 思路有参考价值。

## 3.10 Karate Mock Server — REFERENCE

- Repo: https://github.com/karatelabs/karate
- stateful mock、Java/Netty、测试 DSL 集成强。

更像测试框架能力，不适合作为 ISL 通用运行面默认后端。

## 3.11 Pact Mock Server — EXCLUDE AS GENERAL BACKEND

Pact 的核心是 consumer-driven contract testing。官方也不把 Pact mock server 定位成通用 service virtualization。ISL 可未来导入 Pact contract，但不应拿 Pact server 当万能数据源模拟器。

---

# 4. 数据生成 / Synthetic Data

## 4.1 Mimesis — DEFAULT CORE GENERATOR

- Repo: https://github.com/lk-geimfari/mimesis
- Docs: https://mimesis.name/
- MIT；
- Python；
- 多 locale；
- Schema/DataProvider；
- 可 seed；
- relational schema / foreign-key 风格能力；
- custom provider。

为什么比“全靠 LLM 生成 10 万条记录”合理：快、稳定、可 seed、无需网络、成本固定。

## 4.2 Faker (Python) — SUPPLEMENTAL

- Repo: https://github.com/joke2k/faker
- 成熟度和 provider 生态非常强；
- Python；
- seed 支持。

注意：Faker 文档长期提醒 generated results 可能随版本变化，因此 ISL 若使用必须 pin 精确版本并写入 Compile Manifest。

## 4.3 json-schema-faker — OPTIONAL CONTRACT GENERATOR

- Repo: https://github.com/json-schema-faker/json-schema-faker
- JSON Schema 驱动；
- seeded PRNG；
- format/ref support；
- JS/TS 生态。

对于用户导入 JSON Schema/OpenAPI 很有用。但 ISL Python core 不必为了它常驻 Node 依赖；可由 Prism/Mockoon 或独立 helper driver 使用。

## 4.4 SDV — REFERENCE / OPTIONAL

- Repo: https://github.com/sdv-dev/SDV
- 面向统计/ML synthetic tabular/multi-table 数据。

对“拟真业务数据分布”强，但 CMDB 基础设施数据更重规则、关系和确定性，不需要在 Core 引入 ML 合成框架。

## 4.5 Neosync — EXCLUDE/ARCHIVED REFERENCE

曾经很适合 database anonymization/synthetic workflow，但其开源 repo 已在 2025 年归档。只借鉴数据 anonymization 思路。

---

# 5. VMware / Virtualization

## 5.1 govmomi `vcsim` — DEFAULT

- Repo: https://github.com/vmware/govmomi
- Apache-2.0；
- vSphere SDK simulator；
- 任意真实 vSphere client 可以连接；
- Datacenter/Cluster/Host/VM/Datastore/Network 等 inventory；
- property mutation；
- delay/per-method delay/jitter。

这是 vCenter Driver 的首选，自己重新实现 vSphere API 没有意义。

## 5.2 libvirt test driver — OPTIONAL

- Docs: https://libvirt.org/drvtest.html
- `test:///default` 或 custom XML；
- per-process in-memory fake hypervisor；
- 可以让真实 libvirt client 连接。

适合做“非 VMware 虚拟化 API”低成本 fixture。

## 5.3 OpenStack SDK/Nova fakes — REFERENCE

OpenStack 项目内部有大量 fake/mocking facility，但它们更多是 OpenStack 自身单元测试用 helper，并不是一个轻量 turnkey OpenStack API emulator。

策略：

- 若只测某几个 OpenStack REST endpoint，优先 contract mock；
- 若需要高保真，后期部署真实最小 OpenStack/devstack 或外部 lab；
- 不在 Core 自研 OpenStack API。

---

# 6. Kubernetes / Container

## 6.1 KWOK — DEFAULT

- Repo: https://github.com/kubernetes-sigs/kwok
- Kubernetes SIG 项目；
- 真实 Kubernetes API 语义；
- 可低资源模拟大量 Node/Pod；
- Stage 支持 selector/weight/delay/patch/event/delete/apply。

ISL Kubernetes 模拟的首选。

## 6.2 Kubernetes fake client — TEST-ONLY

client-go/controller-runtime fake clients 适合 ISL 自己的单元测试，但它们不是给 DLR 连接的外部集群 endpoint，不能代替 KWOK。

## 6.3 kind / k3d / k3s — REAL SERVICE OPTION

如果需要真实 scheduler/controller/networking，而不是只需要 API/resource lifecycle，可启动轻量真实集群。它们属于 L3/L4 选项，不作为“大量 Node/Pod”默认方式。

---

# 7. SNMP / BMC / Hardware

## 7.1 snmpsim — DEFAULT

- Repo: https://github.com/etingof/snmpsim
- BSD 系许可证；
- v1/v2c/v3；
- 多 Agent；
- record real agents；
- variation modules；
- numeric/time变化；
- SQL/Redis source；
- delay；
- protocol errors；
- trap/inform；
- multiplex time snapshots。

几乎完美覆盖 SNMP 采集器测试。

## 7.2 DMTF Redfish Interface Emulator — DEFAULT

- Repo: https://github.com/DMTF/Redfish-Interface-Emulator
- BSD-3-Clause；
- static + dynamic Redfish resources；
- Docker；
- GET/PATCH/POST/DELETE；
- `infragen` count/populate；
- Chassis/System/CPU/Memory/Storage/NIC 等。

比单纯 static Redfish mockup 更适合 CMDB lifecycle。

## 7.3 DMTF Redfish Mockup Server — OPTIONAL

适合快速把标准/厂商 Redfish mockup directory 直接暴露为 REST endpoint。对于只读采集器非常轻量；动态行为弱于 Interface Emulator。

## 7.4 OpenIPMI `ipmi_sim` — CANDIDATE / DEFER

OpenIPMI 带 BMC/IPMI simulator，可模拟 sensors/SDR/power/events 等。价值很高，但在做正式 Driver 前需要重新核验当前构建、镜像、许可证和 ARM64 体验。

---

# 8. Network CLI / Network Management

## 8.1 FakeNOS — DEFAULT

- Repo: https://github.com/fakenos/fakenos
- MIT；
- Python；
- SSH server；
- 模拟多种 network OS command interaction；
- inventory 配置。

适合 DLR 测试 CLI 采集，而无需厂商镜像。

## 8.2 scrapli-replay — OPTIONAL RECORD/REPLAY

- Repo: https://github.com/scrapli/scrapli_replay
- collector + semi-interactive SSH server；
- 从真实网络设备录制 command/response；
- replay server 使用测试凭据而不是原设备凭据。

非常适合把一次真实实验设备采集转成长期可重放 fixture。

## 8.3 Netopeer2 + sysrepo — DEFAULT FOR NETCONF

- Netopeer2: https://github.com/CESNET/netopeer2
- sysrepo: https://github.com/sysrepo/sysrepo
- 真实 NETCONF server + YANG datastore；
- libyang/libnetconf2；
- 支持装载 YANG model。

比自研 NETCONF server 强得多。

## 8.4 gNMIc / gNMI ecosystem — REFERENCE / LATER

`gnmic`/相关 cache/server 可以提供 gNMI Get/Set/Subscribe 生态能力，但它们并不等于通用厂商 NOS 模拟器。未来若 DLR 有 gNMI Adapter 再做专门验证。

## 8.5 containerlab — OPTIONAL HIGH FIDELITY

- Website: https://containerlab.dev/
- Repo: https://github.com/srl-labs/containerlab
- declarative YAML topology；
- 管理网络 + p2p links；
- 管理容器/NOS lifecycle；
- 支持大量 device kinds。

非常强，但它需要真正的 NOS/container image，某些 image 受厂商许可限制。ISL 只生成 topology/管理 lifecycle，不提供受限镜像。

## 8.6 vrnetlab — OPTIONAL COMPONENT

将 VM-based router 封装进 container runtime，是 containerlab/GNS3 高保真的辅助路径。镜像构建通常需要用户拥有厂商镜像。

## 8.7 GNS3 — OPTIONAL / HEAVY

成熟网络仿真平台，可运行 Docker/QEMU/VM。适合高级实验，不适合默认个人本地 CMDB fixture。

## 8.8 EVE-NG Community — DEFER

2026 年社区版本生命周期/商业产品边界发生变化，不把它作为本开源项目核心依赖。

## 8.9 rconfig-sim 等高密度 Cisco SSH simulator — REFERENCE

这类项目证明一台机器可以承载大量 SSH device fixture，可借鉴 scale/metrics/fault 设计；但产品过于 vendor/场景特定，不作为统一 backend。

---

# 9. Cloud Emulation

## 9.1 Moto — DEFAULT AWS

- Repo: https://github.com/getmoto/moto
- AWS mock 生态成熟；
- Python library + standalone server；
- 外部 boto3/SDK client 可连接；
- Apache-2.0。

适合 ISL：Truth Projection → 调 Moto API 创建 resources → DLR 使用 AWS SDK 采集。

## 9.2 LocalStack — OPTIONAL USER-PROVIDED

- 原 `localstack/localstack` 开源 repo 于 2026-03-23 archived；
- 新统一 image 要求账号/auth token；
- Hobby 为 non-commercial，商业使用有付费 plans。

因此不能把它作为“用户 clone repo 就能永久免费跑”的默认依赖。可做 external integration。

## 9.3 Azurite — DEFAULT AZURE STORAGE ONLY

- Microsoft 官方 Azure Storage emulator；
- Blob / Queue / Table；
- Docker/npm；
- 不等于整个 Azure management plane。

ISL UI/文档必须把 capability 说准确。

## 9.4 fake-gcs-server — DEFAULT GCS

- Repo: https://github.com/fsouza/fake-gcs-server
- Go/Docker；
- local GCS-compatible endpoint；
- 可 preload object data。

适合对象存储采集。

## 9.5 MinIO — NOT DEFAULT S3 EMULATOR

历史上常用于 S3-compatible local object storage，但项目开源/发行状态在近年有明显变化。ISL 已有 Moto 可提供 AWS/S3 fixture，因此没有必要把 MinIO 作为核心依赖；用户仍可把自己已有 S3-compatible endpoint 接进来。

---

# 10. 数据库 / Cache / MQ / Files

这里最大的“轮子复用”是：**不要找 Fake，直接跑真的。**

## 10.1 Relational DB

推荐 real-service drivers：

- PostgreSQL；
- MySQL/MariaDB；
- 后期可支持用户提供 Oracle Free / SQL Server Developer 容器，但注意镜像条款和架构限制。

ISL 负责：DDL + deterministic rows + auth + endpoint + timeline mutations。

## 10.2 Redis

直接真实 Redis。无需模拟 RESP。

## 10.3 Kafka

优先 Apache Kafka 官方容器/发行方案。不要为了本地轻量而默认选一个许可证策略可能变化的第三方 Kafka-compatible broker。

## 10.4 RabbitMQ

真实 RabbitMQ；生产协议/queue/exchange semantics 比自己 mock 更可靠。

## 10.5 MQTT

真实 Eclipse Mosquitto；ISL 生成 topics/messages/retained data 和 credential。

## 10.6 SFTP/SSH File

真实 OpenSSH-based container。Driver 创建目录树、权限、文件内容和测试用户。

镜像要由项目显式 pin 并做 license/security review；不要默认使用多年不维护的随机 Docker Hub image。

## 10.7 LDAP

真实 OpenLDAP 作为目录数据 fixture。以后如果需要 Active Directory 特有行为，再评估 Samba AD DC，而不是在第一版自己模拟 LDAP/AD。

---

# 11. 真实 CMDB / Source-of-Truth 应用作为数据源

## 11.1 NetBox — DEFAULT LATER SOURCE PACK

- Repo: https://github.com/netbox-community/netbox
- Demo data: https://github.com/netbox-community/netbox-demo-data
- REST API + OpenAPI；
- DCIM/IPAM/virtualization/circuits 等。

这是极佳的“真实应用 API”测试源。ISL 不是 mock NetBox，而是自动起真实 NetBox、seed Truth Projection。

## 11.2 Nautobot — OPTIONAL

Network Source of Truth，REST/GraphQL/plugin 生态丰富。与 NetBox 重叠，优先级低一档，等真实需求出现再做 Source Pack。

## 11.3 Ralph — OPTIONAL

开源 DCIM/CMDB/asset management，适合作为另一个企业应用 source。先评估启动复杂度和 ARM64。

## 11.4 iTop — OPTIONAL / LICENSE CAUTION

CMDB/ITSM 能力强，但 AGPL 和应用体量意味着只适合 external/container integration，不能随意复制源码进 ISL。

## 11.5 ServiceNow / 商业 ITSM / 云厂商管理平台 — CONTRACT/CAPTURE

没有合法可自由分发的完整模拟器时：

```text
OpenAPI/known schema → contract mock
或
user-owned sandbox → sanitized capture/replay
```

不要在 ISL 里复制商业 API 私有实现或样本凭据。

---

# 12. Chaos / Fault Injection

## 12.1 Toxiproxy — DEFAULT

- Repo: https://github.com/Shopify/toxiproxy
- HTTP control API；
- latency/jitter；
- down；
- bandwidth；
- slow close；
- timeout；
- reset peer；
- packet loss；
- data limiting/slicing；
- Prometheus metrics。

对于所有 TCP source，它提供统一的 transport fault layer。

## 12.2 Pumba / Chaos tooling — REFERENCE

容器 kill/network chaos 工具可用于后期 run resilience，但 MVP 更需要 deterministic endpoint faults；Toxiproxy 更容易精确验证。

---

# 13. 测试容器编排工具

## 13.1 Testcontainers — TEST REFERENCE, NOT PLATFORM RUNTIME

Testcontainers 很适合 ISL 自己的 automated integration tests：pytest 启动 PostgreSQL/Redis/Moto 等。

但产品运行时需要：

- 一次 Run 存活数小时；
- UI Start/Stop；
- 恢复状态；
- lifecycle/timeline；
- 多 source；
- GC。

因此 runtime 仍应有 Lab Agent，而不是把 Testcontainers 当产品 orchestration API。

## 13.2 Docker Compose — DEPLOYMENT

Compose 用来启动 **ISL 自己**（Control/Agent/Postgres/Web），而 Lab Run 内动态 source 数量由 Agent 管理。不要为每个 Run 修改主 `docker-compose.yml`。

---

# 14. 可借鉴但不应该 fork 的“万能 Mock”方向

## MockForge

- Repo: https://github.com/SaaSy-Solutions/mockforge
- Rust workspace；
- HTTP/WS/gRPC/GraphQL；
- data generation；
- recorder；
- chaos；
- observability；
- WASM/plugin system；
- datasource plugin contract。

它的产品理念与“万能模拟器”最接近，也有非常值得抄作业的分层，但社区成熟度远低于 Microcks/WireMock 等，而且核心问题仍然围绕 service mocking，不是 CMDB multi-source Truth。

结论：**深入读源码，借架构，不 fork。**

---

# 15. 还需要关注的扩展候选

这些不是 MVP，但 Driver Registry 应保证未来能接：

### Infrastructure
- Docker Engine API fixture；
- Proxmox API（contract/capture 或用户 lab）；
- OpenStack；
- Ceph；
- storage vendor APIs；
- DNS/IPAM systems；
- DHCP；
- VMware NSX/vSAN（需要真实或 contract fixture）。

### Network
- RESTCONF；
- gNMI；
- LLDP/CDP topology fixtures；
- network controller APIs（Cisco/Aruba/etc.）；
- firewall/load balancer APIs。

### Observability / Ops
- Prometheus API；
- Alertmanager；
- Grafana API；
- Elasticsearch/OpenSearch；
- monitoring products via contract/capture。

### Enterprise
- LDAP/AD；
- DNS；
- IPAM；
- ITSM；
- asset/procurement databases；
- spreadsheets；
- message bus；
- object stores。

这些都能通过现有五种 backend mode（artifact/contract/protocol/real/replay）扩展，不需要改变 Core。

---

# 16. 最终选型地图

```text
                         InfraSourceLab Core
                Scenario / Truth / Projection / Verify
                                │
                  Driver Registry + Capability
                                │
 ┌──────────────┬───────────────┼──────────────┬──────────────┐
 │ Artifact     │ Contract/API  │ Protocol     │ Real Service │ Replay
 │              │               │ Emulator     │              │
 │ JSON         │ Mockoon       │ vcsim        │ PostgreSQL   │ Hoverfly
 │ YAML         │ Prism         │ KWOK         │ MySQL        │ scrapli
 │ CSV/xlsx     │ Microcks opt. │ snmpsim      │ Redis        │ imports
 │              │               │ Redfish      │ Kafka        │
 │              │               │ FakeNOS      │ MQTT         │
 │              │               │ Netopeer2    │ SFTP/LDAP    │
 │              │               │ Moto/Azurite │ NetBox       │
 └──────────────┴───────────────┴──────────────┴──────────────┘
                                │
                         Toxiproxy Fault Layer
```

真正应该自研的是中间横向能力，而不是底下每个方框。

---

# 17. 主要参考链接

- Microcks: https://microcks.io/ / https://github.com/microcks/microcks
- Mockoon: https://mockoon.com/ / https://github.com/mockoon/mockoon
- Prism: https://github.com/stoplightio/prism
- Hoverfly: https://docs.hoverfly.io/ / https://github.com/SpectoLabs/hoverfly
- WireMock: https://wiremock.org/
- MockServer: https://www.mock-server.com/
- Imposter: https://www.imposter.sh/
- MockForge: https://github.com/SaaSy-Solutions/mockforge
- Mimesis: https://mimesis.name/
- Faker: https://github.com/joke2k/faker
- govmomi/vcsim: https://github.com/vmware/govmomi
- KWOK: https://github.com/kubernetes-sigs/kwok
- snmpsim: https://github.com/etingof/snmpsim
- Redfish Interface Emulator: https://github.com/DMTF/Redfish-Interface-Emulator
- FakeNOS: https://github.com/fakenos/fakenos
- scrapli-replay: https://scrapli.github.io/scrapli_replay/
- Netopeer2: https://github.com/CESNET/netopeer2
- sysrepo: https://github.com/sysrepo/sysrepo
- containerlab: https://containerlab.dev/
- Moto: https://github.com/getmoto/moto
- Azurite: https://github.com/Azure/Azurite
- fake-gcs-server: https://github.com/fsouza/fake-gcs-server
- Toxiproxy: https://github.com/Shopify/toxiproxy
- NetBox: https://github.com/netbox-community/netbox
- NetBox demo data: https://github.com/netbox-community/netbox-demo-data
