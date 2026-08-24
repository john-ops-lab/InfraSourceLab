# InfraSourceLab 开发路线图

## 1. 路线原则

路线按“先证明独特核心，再扩协议”的顺序：

```text
M0 产品骨架 / DLR UI 复用
        ↓
M1 Truth + Projection + 首批可运行 Sources
        ↓
M2 Lifecycle + Fault + Verification 闭环
        ↓
M3 核心基础设施协议包
        ↓
M4A 云与标准管理协议    M4B 企业真实服务与 Record/Replay
        └──────────┬──────────┘
                   ↓
M5 AI Scenario Assistant / Imports
                   ↓
M6 Scale / Recovery / Remote Agent / Release
```

不能反过来变成：先接 20 个 Simulator，最后才发现没有统一 Truth 和验证闭环。

当前每个阶段都已经建立成一个较大的 GitHub Issue，用于匹配 Qoder Go Mode 的“整波实现 + direct main + 外部 Review”工作流。

---

# M0 — Foundation & DLR UI Parity

Issue: [#1](https://github.com/john-ops-lab/InfraSourceLab/issues/1)

## 目标

建立可持续工程骨架和运行权限边界。

## 主要交付

- Python 3.13 / uv / FastAPI；
- PostgreSQL + SQLAlchemy2 + Alembic；
- 独立 Lab Agent，Control 不持有 Docker socket；
- Docker Compose；
- React19/TS/Vite/AntD/Monaco/assistant-ui/i18next；
- Scenario Catalog + Workbench + Revision；
- Driver Registry / capability API；
- Run 状态骨架和 run-scoped labels/network；
- 复用 DLR AI 面板交互的 deterministic fake Candidate→Diff→Apply；
- CI + real-browser smoke。

## 完成判据

fresh clone 可启动；Scenario revision 不可变；Agent 能安全启动/清理一个 allowlisted test source；cleanup 不碰无关 Docker 资源；DLR-style UI 与 AI layout contract 通过浏览器验收。

---

# M1 — Deterministic World

Issue: [#2](https://github.com/john-ops-lab/InfraSourceLab/issues/2)

## 目标

第一次真正构建“同一世界 → 多数据源”。

## 主要交付

- Scenario `v1alpha1`；
- parser/schema/semantic diagnostics；
- deterministic IDs/names/IP allocator；
- Mimesis-based deterministic generation；
- TruthNode/TruthEdge；
- Source Projection + semantic defects；
- canonical/native identity map；
- compile manifest/digests/version provenance；
- Ground Truth API；
- Artifact Driver：JSON/YAML/CSV/xlsx；
- Mockoon REST Driver；
- real PostgreSQL Driver；
- 10k scale/reproducibility tests；
- Web World/Sources/Compile preview。

## 完成判据

相同 revision/seed/pinned versions 能稳定产生相同 Truth/source digests；HTTP 与 PostgreSQL 都由普通真实 client 连接；ISL 内部没有重新实现 HTTP/PostgreSQL 协议。

---

# M2 — Lifecycle, Faults & Verification

Issue: [#3](https://github.com/john-ops-lab/InfraSourceLab/issues/3)

## 目标

从“数据生成器”升级为真正的 DLR/CMDB Integration Test Platform。

## 主要交付

- manual virtual clock；
- Truth Versions；
- typed timeline actions；
- source refresh/staleness/freeze；
- semantic defect model；
- Toxiproxy；
- application/protocol fault hooks；
- Observation API；
- Verification Profiles；
- indexed identity matching；
- node/edge verifier；
- Source Fidelity 与 Canonical Outcome 两种 verification mode；
- JSON report + Web findings；
- DLR E2E sample/test pack。

## 完成判据

一个测试能完成：Source 启动 → DLR/consumer 采集 → Observation → Verify → Timeline 变化 → latency/429 等故障 → 再次采集与解释结果。

这是第一阶段最重要里程碑。

---

# M3 — Core Infrastructure Simulator Pack

Issue: [#4](https://github.com/john-ops-lab/InfraSourceLab/issues/4)

## 目标

覆盖 CMDB 最核心、最难本地长期拥有的基础设施来源，而且不重新实现协议。

## Mandatory Drivers

### vCenter

- govmomi/vcsim；
- Datacenter/Cluster/Host/VM/Datastore/Network；
- MoRef/UUID/native path mapping；
- migration/power/status lifecycle。

### Kubernetes

- KWOK；
- Cluster/Node/Pod/Workload/owner relationships；
- 大规模 fixture；
- patch/delete/reschedule timeline。

### SNMP

- snmpsim；
- common inventory profiles；
- v2c first, v3 capability；
- changing counters/protocol errors/delay。

### Redfish

- DMTF Redfish Interface Emulator；
- Chassis/System/CPU/Memory/Storage/NIC；
- dynamic lifecycle。

### Network CLI

- FakeNOS；
- common inventory commands；
- Truth-driven CLI output；
- multiple logical devices。

## 完成判据

每个 Driver 都有真实外部 client、canonical↔native identity map、至少一个 meaningful timeline action、fault、Source Fidelity fixture、ARM64/版本/许可证证据以及无泄漏 cleanup。

---

# M4A — Cloud & Management Protocol Pack

Issue: [#5](https://github.com/john-ops-lab/InfraSourceLab/issues/5)

## Mandatory Drivers

- AWS → Moto standalone；
- Azure Storage → Azurite；
- GCS → fake-gcs-server；
- NETCONF/YANG → Netopeer2 + sysrepo；
- libvirt → official test driver。

LocalStack 只允许 optional user-provided integration，不作为默认 AWS 依赖。

## 完成判据

每个 mandatory Driver 通过标准 SDK/client 访问、支持 Truth-driven seed 与 timeline mutation，并进入统一 Fault/Verifier 体系；云 SDK 必须 fail-closed，避免误打真实云。

---

# M4B — Real-Service & Enterprise Source Packs

Issue: [#6](https://github.com/john-ops-lab/InfraSourceLab/issues/6)

## 目标

对于“真实服务很容易启动”的协议，直接跑真的，不做 fake wire protocol。

## Mandatory Packs

- MySQL/MariaDB；
- Redis；
- Apache Kafka；
- RabbitMQ；
- Eclipse Mosquitto；
- SFTP/OpenSSH；
- OpenLDAP；
- real NetBox seeded from Truth；
- Hoverfly HTTP capture/replay；
- scrapli-replay SSH capture/replay；
- Prism contract mode。

M4A/M4B 在当前 direct-main 流程下**不要并发实施**，避免共享 Driver/Core 文件交叉污染 Review base/head。

---

# M5 — AI Scenario Assistant & Imports

Issue: [#7](https://github.com/john-ops-lab/InfraSourceLab/issues/7)

## 目标

实现“告诉平台想模拟什么 → AI 生成/修改 Scenario → Diff → Apply”，但 AI 不进入不可控运行路径。

## 主要交付

- OpenAI-compatible provider + provider abstraction；
- 直接复用 DLR assistant-ui UX/External Store 交互模式；
- frozen round snapshot / Regenerate；
- structured Scenario Candidate；
- schema/semantic/capability/resource/security validation；
- Candidate Diff/Apply；
- context snippets；
- read-only tools；
- attachment/import registry；
- OpenAPI/JSON Schema/JSON/YAML/CSV/xlsx/HAR/Postman 第一批 importer；
- raw capture sanitization；
- stale candidate protection。

AI 永远不能直接 Save/Start/Stop/Delete/Fault/Docker。

---

# M6 — Scale, Remote Agent & Release Hardening

Issue: [#8](https://github.com/john-ops-lab/InfraSourceLab/issues/8)

## 目标

把个人开发工具打磨成可长期公开维护、可升级、可恢复、可审计的开源项目。

## 主要交付

- 100k Truth/Observation benchmark；
- streaming artifacts / verifier performance；
- resource admission limits；
- Control/Agent/source crash reconciliation；
- orphan/TTL/GC；
- authenticated remote Lab Agent；
- Prometheus-compatible observability；
- migration/upgrade tests；
- amd64/arm64/Apple Silicon support matrix；
- SBOM/image scan/third-party license inventory；
- JUnit/CI verification output；
- thin API client CLI if still needed；
- release-quality examples/docs；
- public contributor/security guidance。

仓库 LICENSE 必须由 owner 在首个稳定公开发布前明确决定，Go Mode 不能自行添加/修改。

---

# Future — Only If Demand Appears

当前 Gap Map 见 [`research/cmdb-source-coverage.md`](research/cmdb-source-coverage.md)。目前确认未来可按现有 Driver/Fidelity 架构加入、但不进入当前承诺的方向包括：

- DNS/CoreDNS；
- DHCP/Kea；
- Samba AD；
- Swordfish storage；
- IPMI；
- RESTCONF/gNMI；
- OpenStack DevStack + Nova FakeDriver；
- SMB/NFS；
- Prometheus/OpenSearch 等运维数据源；
- containerlab/GNS3/user-provided vendor NOS；
- Proxmox/Ceph 的 contract/capture/real-lab integrations；
- scenario marketplace；
- collaborative editing；
- SaaS；
- FDE-oriented broader synthetic enterprise environment。

这些方向没有一个要求现在重构 Core。

---

# 波次依赖

```text
#1 M0
   ↓
#2 M1
   ↓
#3 M2
   ↓
#4 M3
   ↓
#5 M4A → #6 M4B   (direct-main 下串行实现)
   ↓
#7 M5
   ↓
#8 M6
```

研究可以并行，main 上的大 Wave 实现不要并行。

---

# 优先级判断规则

新增需求进入路线前问：

1. 它是否直接帮助 DLR/CMDB 测试？
2. 它是否证明 ISL 的独特核心？
3. 有无成熟工具可编排？
4. 能否直接跑真实轻量服务？
5. 是否会导致我们自己维护复杂协议？
6. 是否要求高权限/受限镜像？
7. 没有它，当前用户流程是否真的走不通？

前两项弱、后几项成本高的功能默认后置。
