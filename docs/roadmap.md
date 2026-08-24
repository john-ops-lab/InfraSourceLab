# InfraSourceLab 开发路线图

## 1. 路线原则

路线按“先证明独特核心，再扩协议”的顺序：

```text
产品骨架
  ↓
Truth + Projection + 可运行 Sources
  ↓
Fault + Verification 闭环
  ↓
基础设施协议包
  ↓
云/企业应用源
  ↓
AI authoring
  ↓
规模/发布
```

不能反过来变成：先接 20 个 Simulator，最后才发现没有统一 Truth 和验证闭环。

---

# M0 — Foundation & DLR UI Parity

## 目标

建立可持续开发骨架和运行权限边界。

## 主要交付

- Python 3.13 / uv backend；
- FastAPI Control；
- PostgreSQL + SQLAlchemy2 + Alembic；
- Lab Agent service；
- Docker Compose；
- React19/TS/Vite/AntD/Monaco/assistant-ui/i18next；
- Scenario Catalog + Editor shell；
- immutable Revision 基础模型；
- Driver Registry / capability API；
- Lab Run 状态模型骨架；
- Control/Agent health；
- run-scoped Docker labels/network abstraction；
- DLR-style AI panel with fake/local deterministic provider path（业务 AI 后置）；
- CI + browser smoke。

## 完成判据

- fresh clone 一条 Compose 流程启动；
- Web 可创建/编辑/保存 Scenario revision；
- Control 不挂 Docker socket；
- Agent 可以创建并安全清理一个 hello/test source container；
- cleanup 不触碰非 ISL 容器；
- main CI 全绿；
- Chrome 基础 UI 验收通过。

---

# M1 — Deterministic World

## 目标

第一次真正构建“同一世界 → 多数据源”。

## 主要交付

- Scenario `v1alpha1` JSON Schema；
- parser/schema/semantic diagnostics；
- deterministic IDs/names/IP allocator；
- Mimesis-based deterministic generation；
- TruthNode/TruthEdge persistence；
- Source Projection engine；
- compile manifest/digest/version；
- Ground Truth API；
- source/native identity map；
- Artifact Driver: JSON/YAML/CSV/xlsx；
- Mockoon HTTP Driver；
- real PostgreSQL Driver；
- SFTP/artifact file exposure 可按复杂度纳入；
- Web World/Sources/Compile preview。

## 核心测试

- same revision + seed + pinned versions → same digest；
- 10k entity compile；
- projection case/omit/duplicate/stale defects；
- HTTP client 能分页获取 projected data；
- PostgreSQL client 能查询 seeded rows；
- cleanup/rebuild 不改变 truth。

---

# M2 — Lifecycle, Faults & Verification

## 目标

从“数据生成器”升级为真正的 DLR/CMDB integration test platform。

## 主要交付

- manual virtual clock；
- Truth Versions；
- timeline typed actions；
- source refresh/staleness；
- semantic defect model；
- Toxiproxy integration；
- application/protocol fault hooks；
- Observation API；
- Verification Profiles；
- identity matching；
- node/edge verifier；
- JSON report + Web findings；
- Source Fidelity 与 Canonical Outcome 两种 verification mode；
- DLR E2E sample/test pack。

## 完成判据

一个测试可：

1. 启动 HTTP + Postgres + Artifact 三个来源；
2. DLR 采集；
3. 报告 intentionally missing/duplicate/stale 数据；
4. 执行 timeline step；
5. 注入 latency/429；
6. 再采集；
7. Verifier 正确解释结果。

这是第一阶段最重要里程碑。

---

# M3 — Core Infrastructure Simulator Pack

## 目标

覆盖 CMDB 最核心、最难本地拥有的基础设施来源。

## Driver

### vCenter

- govmomi/vcsim；
- datacenter/cluster/host/vm/datastore/network；
- MoRef/UUID mapping；
- migration/power/status lifecycle；
- delay/fault。

### Kubernetes

- KWOK；
- cluster/node/pod/workload；
- labels/annotations/owner refs；
- large scale；
- patch/delete/apply timeline。

### SNMP

- snmpsim；
- common host/network profiles；
- v2c first, v3 next；
- changing counters；
- errors/delay；
- capture import groundwork。

### Redfish

- DMTF Redfish Interface Emulator；
- Chassis/System/CPU/Memory/Storage/NIC；
- static/dynamic；
- lifecycle。

### Network CLI

- FakeNOS；
- common inventory commands；
- Truth-driven command output；
- multiple endpoints。

## 完成判据

DLR 在没有真实企业环境的本地机器上，可以分别开发并跑通以上五类采集器。

---

# M4 — Cloud, Network Management & Enterprise Source Packs

## 目标

扩展常见企业数据源，但仍按“真实轮子优先”。

## 候选

- Moto AWS；
- Azurite；
- fake-gcs-server；
- Netopeer2 + sysrepo；
- libvirt test；
- Redis；
- MySQL；
- Kafka；
- RabbitMQ；
- MQTT；
- LDAP；
- NetBox real source pack；
- Hoverfly HTTP capture/replay；
- scrapli-replay；
- Prism contract driver；
- Microcks optional advanced driver。

这一波可能根据 DLR/CMDB 实际 Adapter 需求拆成 M4A/M4B，而不是为了数字把所有工具一次塞进去。

---

# M5 — AI Scenario Assistant & Imports

## 目标

让“告诉平台想模拟什么”真正变成高效入口，但 AI 不进入不可控运行路径。

## 主要交付

- OpenAI-compatible provider；
- provider abstraction；
- DLR assistant-ui UX 复用；
- Prompt → Scenario Candidate；
- strict parse/schema/semantic/capability validation；
- Candidate Diff/Apply；
- frozen round snapshot/Regenerate；
- context snippets；
- read-only tools；
- attachments；
- importer registry。

## 第一批 imports

- OpenAPI；
- JSON Schema；
- JSON/YAML sample；
- CSV/xlsx；
- HAR；
- Postman。

## 后续 imports

- AsyncAPI；
- snmprec/snmpwalk；
- YANG；
- Redfish mockup；
- SSH capture。

---

# M6 — Scale, Remote Agent & Release Hardening

## 目标

把“个人开发工具”打磨成可以公开长期使用的项目。

## 主要交付

- 100k+ Truth node benchmark；
- large artifact streaming；
- verifier performance；
- concurrent runs；
- remote Lab Agent；
- agent auth/mTLS；
- recovery/reconcile；
- orphan GC；
- resource limits；
- Prometheus metrics；
- security scan；
- third-party NOTICE/licensing inventory；
- stable docs/examples；
- versioned migrations；
- upgrade test；
- release images；
- architecture support matrix (amd64/arm64)。

---

# Future — Only If Demand Appears

以下不进入当前承诺：

- containerlab integration；
- GNS3 external lab；
- vendor NOS image orchestration；
- OpenStack high-fidelity lab；
- RESTCONF/gNMI；
- IPMI；
- distributed agents at scale；
- reusable public scenario marketplace；
- collaborative multi-user editing；
- SaaS；
- FDE-oriented broader synthetic enterprise environment。

这些方向可以很有潜力，但当前优先把 DLR/CMDB 测试闭环做扎实。

---

# 波次依赖

```text
M0
 ↓
M1
 ↓
M2 ────────────────┐
 ↓                  │
M3                  │
 ↓                  │
M4                  │
 ↓                  │
M5                  │
 ↓                  │
M6 ◀────────────────┘
```

M3/M4 的 Driver 可以部分并行研究，但真正实现最好在 M2 的 Driver/Truth/Fault/Verification contract 稳定后进行。

---

# 优先级判断规则

新增需求进入路线前问：

1. 它是否直接帮助 DLR/CMDB 测试？
2. 它是否证明 ISL 的独特核心？
3. 有无成熟工具可编排？
4. 是否会导致我们自己维护复杂协议？
5. 是否要求高权限/受限镜像？
6. 没有它，当前用户流程是否真的走不通？

前两项弱、后三项成本高的功能默认后置。
