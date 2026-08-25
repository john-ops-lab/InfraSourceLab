# 模拟器与数据源后端策略

## 1. 总原则

InfraSourceLab 的长期维护成本主要取决于一个决策：**我们是否自己实现协议。**

默认答案是“不”。新增数据源按以下顺序决策：

```text
1. 有成熟、可自动化、许可证合适的专用 Simulator？
       ↓ no
2. 能直接启动真实开源服务并灌入 Truth Projection？
       ↓ no
3. 能用 OpenAPI / JSON Schema / AsyncAPI 等标准契约模拟？
       ↓ no
4. 能从用户有权访问的真实 sandbox capture，再安全 record/replay？
       ↓ no
5. 是否真的需要厂商虚拟设备，由用户合法提供镜像？
       ↓ no
6. 才考虑自研尽可能薄的 Backend。
```

ISL 的产品价值是：

```text
统一 Scenario
+ Truth Graph
+ Source Projection
+ Driver orchestration
+ Fault/Lifecycle
+ Verification
```

不是“拥有最多自研协议”。

---

## 2. Fidelity Ladder

### L0 — Artifact

JSON / YAML / CSV / xlsx / line-delimited JSON / directory tree。

ISL 自己实现，因为本质是数据渲染而不是协议模拟。

### L1 — Contract Mock / Replay

适用：

- REST/OpenAPI；
- 未来 GraphQL/gRPC/AsyncAPI；
- 商业 SaaS/ITSM 无真实 sandbox 时；
- HTTP capture/replay。

优先使用 Mockoon / Prism / Hoverfly / Microcks 等成熟工具。

### L2 — Protocol Emulator

适用：

- vSphere/vCenter；
- Kubernetes；
- SNMP；
- Redfish；
- 网络设备 SSH CLI；
- NETCONF/YANG；
- 云 API emulator。

### L3 — Real Service

真实服务本身很轻时直接跑真的：

- PostgreSQL / MySQL；
- Redis；
- Kafka；
- RabbitMQ；
- MQTT；
- SFTP/SSH；
- LDAP；
- NetBox；
- DNS 等后续服务。

### L4 — User-provided High Fidelity Lab

- containerlab；
- GNS3；
- vrnetlab；
- 用户合法拥有的 vendor appliance/image。

资源重、许可复杂，永远 optional。

---

## 3. 当前正式 Wave 矩阵

**本表必须与 GitHub Issues #1–#8 保持一致。研究文档可以更广，但实现阶段以 Issues 为准。**

| 数据源/能力 | 首选 Backend | Fidelity | 正式阶段 | 状态 |
|---|---|---:|---|---|
| JSON/YAML/CSV/xlsx | ISL renderer | L0 | **M1** | Core |
| 通用 REST | Mockoon CLI | L1 | **M1** | Default |
| PostgreSQL | real PostgreSQL | L3 | **M1** | Default real service |
| vCenter/ESXi | govmomi `vcsim` | L2 | **M3** | Default |
| Kubernetes | KWOK | L2 | **M3** | Default |
| SNMP | snmpsim | L2 | **M3** | Default |
| Redfish/BMC | DMTF Redfish Interface Emulator | L2 | **M3** | Default |
| Network SSH CLI | FakeNOS | L2 | **M3** | Default |
| AWS | Moto standalone | L2 | **M4A** | Default |
| Azure Storage | Azurite | L2/L3 | **M4A** | Blob/Queue/Table only |
| GCS | fake-gcs-server | L2 | **M4A** | Default |
| NETCONF/YANG | Netopeer2 + sysrepo | L2 | **M4A** | Default when enabled |
| libvirt | official test driver | L2 | **M4A** | Generic virtualization fixture |
| MySQL/MariaDB | real service | L3 | **M4B** | Mandatory pack |
| Redis | real service | L3 | **M4B** | Mandatory pack |
| Kafka | Apache Kafka | L3 | **M4B** | Mandatory pack |
| RabbitMQ | real service | L3 | **M4B** | Mandatory pack |
| MQTT | Eclipse Mosquitto | L3 | **M4B** | Mandatory pack |
| SFTP | maintained OpenSSH-based service | L3 | **M4B** | Mandatory pack |
| LDAP | OpenLDAP | L3 | **M4B** | Mandatory pack |
| NetBox | real NetBox + Truth seed | L3 | **M4B** | Mandatory source pack |
| HTTP record/replay | Hoverfly | L1 | **M4B** | Mandatory replay path |
| Network SSH replay | scrapli-replay | L2 | **M4B** | Mandatory replay path |
| OpenAPI contract-only | Prism | L1 | **M4B** | Mandatory alternate |
| Microcks | external optional Driver | L1 | M4B+ / later | Optional heavy backend |
| LocalStack | user-provided external integration | external | M4A+ / later | Optional only |
| DNS/CoreDNS | real service | L3 | later | Gap Map |
| DHCP/Kea | real service | L3 | later | Gap Map |
| Samba AD | real service | L3 | later | Gap Map |
| IPMI | candidate emulator | L2 | later | Re-evaluate first |
| High-fidelity NOS | containerlab/GNS3 + user image | L4 | later | Optional |

如果某文档写出不同阶段，**Issues + Roadmap 是实施 source of truth**，并应立即修正文档漂移。

---

## 4. Driver 版本与 Capability 规则

“某个上游项目支持某功能”不等于“InfraSourceLab 当前 Driver 支持”。

每个正式 Driver 必须绑定：

```text
backend project
backend version / image tag
image digest when release-hardening requires
architecture support
license/source URL
capability set
integration tests
```

### Capability 的权威顺序

```text
ISL pinned backend version
        ↓
actual integration test
        ↓
Driver capability registry
        ↓
Compiler/UI exposes capability
```

不能反过来根据上游 `main`、README 或模型印象宣称已支持。

例如 Toxiproxy 当前上游源码可能包含某 toxic，但 M2 只应暴露**实际 pin 版本已经验证**的 toxics。升级版本后重新跑 compatibility tests，再扩大 capability。

---

## 5. 通用 REST：Mockoon CLI

M1 需要轻量、headless、配置可生成的 HTTP backend。

Driver 流程：

```text
Truth Projection
      ↓
HttpSource intermediate model
      ↓
Mockoon renderer
      ↓
environment config
      ↓
Mockoon CLI runtime
```

Mockoon config 是**Driver artifact**，不是 Scenario public model。

M1 只实现足以证明：

- list/detail；
- pagination；
- deterministic records；
- 基础 auth/test credential；
- start/health/cleanup。

M2 再利用 response rules 等能力实现 401/403/429/500、分页异常等 application fault。

### Prism 的位置

Prism 更适合 strict OpenAPI contract mock/validation，但不是 M1 必需。正式放在 **M4B**，作为 Mockoon 的 contract-driven alternate。

### Hoverfly 的位置

Hoverfly 强项是 capture/replay/stateful sequence。正式放在 **M4B**，不提前塞进 M2。

### Microcks 的位置

Microcks 是成熟的多协议 API mocking/testing 平台，但运行体系较重。策略：

- 不 fork；
- 不作为 M0/M1 依赖；
- 后期 optional Driver；
- Importer/统一模型/AI 结构化输出模式可以研究借鉴。

---

## 6. vCenter：govmomi `vcsim`

不要模拟 vSphere SOAP/REST。

ISL Driver 负责：

- Truth Projection → inventory；
- canonical ID ↔ MoRef/UUID/native path；
- timeline patch/relink → vcsim mutation；
- transport fault 统一接 Fault Controller/Toxiproxy；
- backend 不支持的能力明确 capability=false。

不要宣称与真实 vCenter 100% 行为一致。

---

## 7. Kubernetes：KWOK

KWOK 的价值是使用 Kubernetes API 语义低成本制造大量 Node/Pod。

ISL Core Timeline 保持 source-neutral：

```text
patch canonical attribute
create/delete entity
relink relationship
source refresh
```

Kubernetes Driver 再翻译为 Kubernetes/KWOK 操作。不要把 KWOK Stage schema 变成 ISL 通用 DSL。

Driver 需要保存 native UID/resourceVersion identity 信息。

---

## 8. SNMP：snmpsim

ISL 不实现 SNMP PDU/ASN.1 server。

Driver 负责：

- OID mapping profile；
- Truth Projection → `.snmprec` / variation config；
- multi-agent identity；
- timeline value/inventory update；
- protocol error/variation；
- capture import extension point。

厂商 MIB 不因 snmpsim 开源就可随意再分发。

---

## 9. Redfish：DMTF Interface Emulator

优先 dynamic/populate 能力，而不是自己写 Redfish routes。

Driver 映射：

- Chassis；
- Systems；
- Managers；
- CPU/Memory/NIC/Storage；
- status/power；
- relationships；
- canonical ↔ Redfish native identity。

static mockup 可做只读 optional mode。

---

## 10. Network CLI：FakeNOS + scrapli-replay

### FakeNOS — M3

用于 synthetic SSH CLI：

- show version；
- show inventory；
- show interfaces；
- show ip interface brief / equivalent。

输出来自 Truth Projection，不写死 demo text。

### scrapli-replay — M4B

用于 capture/replay：

```text
real authorized session
 → sanitize
 → replay artifact
 → semi-interactive test SSH endpoint
```

测试 credential 与原始设备 credential 分离。

---

## 11. NETCONF/YANG：Netopeer2 + sysrepo — M4A

```text
Truth Projection
      ↓
YANG-aware renderer
      ↓
sysrepo datastore
      ↓
Netopeer2
      ↓
real NETCONF SSH endpoint
```

不自己实现 NETCONF framing/RPC/YANG datastore。

用户 YANG 属于数据输入，需 validation/size/import limits；未知 vendor YANG 不默认 bundle。

---

## 12. Cloud — M4A

### AWS：Moto

默认 AWS emulator。使用 standalone endpoint + fake credentials + SDK endpoint override，并测试 fail-closed，避免误访问真实 AWS。

### LocalStack：optional external

LocalStack 的产品/发行/许可会变化，因此**精确时间点条款只记录在 dated research 文档**。架构层只保留：

- 不作为默认依赖；
- 用户自己提供 endpoint/token/license；
- 集成时重新核对当前 terms。

### Azure：Azurite

只描述为 Azure Storage emulator，不宣传整个 Azure control plane。

### GCS：fake-gcs-server

只覆盖 GCS-compatible local API，不宣传整个 GCP。

### libvirt test driver

提供轻量 generic virtualization client fixture，不启动真实 KVM VM，也不自造 HTTP wrapper 冒充 libvirt fidelity。

---

## 13. Real Services — M1 / M4B

### M1

- PostgreSQL。

### M4B

- MySQL/MariaDB；
- Redis；
- Kafka；
- RabbitMQ；
- Mosquitto；
- SFTP/OpenSSH；
- OpenLDAP。

共同模式：

```text
Truth Projection
  ↓
render schema/config/seed
  ↓
start real allowlisted service
  ↓
health
  ↓
seed/init
  ↓
publish test endpoint + generated credential
  ↓
timeline mutation
  ↓
cleanup
```

可以抽真正共享 lifecycle，但不要强行把不同协议所有操作抽象成一套假 CRUD。

---

## 14. NetBox — M4B

不要 mock NetBox API。

启动真实 NetBox，使用受支持 API/bulk/import 路径创建：

- sites/locations；
- racks；
- manufacturers/device types/devices；
- interfaces；
- prefixes/IP；
- clusters/VMs（按版本能力）；
- tags/tenants minimal。

Truth 仍是 canonical source；NetBox native IDs 进入 mapping。

---

## 15. Fault Backend

M2 使用 Toxiproxy 作为共享 TCP fault backend，减少各 Driver 重复实现网络错误。

典型可评估能力：

- latency/jitter；
- timeout；
- reset peer；
- bandwidth；
- slow close；
- limit/slice；
- packet loss（仅当**实际 pin 版本**支持且测试通过）；
- proxy disable/down behavior。

原则：

- transport fault 走共享 Fault Controller；
- protocol/application fault（如 HTTP 429、SNMP error）由 Driver/backend 原生能力处理；
- capability registry 只暴露已验证能力；
- 不因为上游 main 出现文件就自动扩展发行能力。

---

## 16. Record/Replay 安全 — M4B / M5 Import

Capture 必须经过：

1. credential/header redaction；
2. cookie/token/session 清理；
3. hostname/IP/serial/MAC 可选脱敏；
4. body rule scan；
5. 用户预览；
6. 才允许成为 sanitized replay/import artifact。

Raw capture 默认 gitignored，不自动进入 AI。

M4B 建 runtime replay backend；M5 建完整 Importer/attachment UX，两者共享 sanitization contract。

---

## 17. 高保真网络后置

containerlab/GNS3/vrnetlab 很强，但资源、Linux 环境和 vendor license 成本高。

M3 的 FakeNOS/SNMP，加 M4A 的 NETCONF，已经覆盖大量 CMDB/DLR 采集开发。只有真实 Adapter 明确依赖厂商行为时再进入 L4。

---

## 18. 新 Driver 引入 Gate

每个 Driver 在进入正式默认包前回答：

- 是否有更成熟现成工具？
- 为什么不用真实服务？
- exact version/source/license/image 是什么？
- ARM64/amd64 支持是否实测？
- capability 是否由该 pin 版本真实测试？
- deterministic seed/data 如何保证？
- canonical ↔ native identity 如何保存？
- timeline 哪些 action 真支持？
- fault 哪些真支持？
- endpoint 默认是否 local/isolated？
- secret/log/capture 风险？
- start/health/stop/cleanup/reconcile 是否幂等可测？
- 最小真实外部 client E2E 是什么？

没有证据的 capability 不进入默认发行声明。