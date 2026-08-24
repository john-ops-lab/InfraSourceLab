# InfraSourceLab 开发路线图

## 1. 路线原则

路线按“先建立正确产品入口，再证明独特核心，再扩协议”的顺序：

```text
M0 工程骨架 + 新前端设计系统 + Visual Builder
        ↓
M1 Scenario/Truth/Projection + 首批 Sources + 基础 AI Authoring
        ↓
M2 Lifecycle + Fault + Verification 闭环
        ↓
M3 核心基础设施协议包
        ↓
M4A 云与标准管理协议    M4B 企业真实服务与 Record/Replay
        └──────────┬──────────┘
                   ↓
M5 高级 AI / Imports / Attachments / Tools
                   ↓
M6 Scale / Recovery / Remote Agent / Release
```

不能反过来变成：先接 20 个 Simulator，最后才发现没有统一 Truth 和验证闭环；也不能把 YAML 编辑器做成产品主入口后再补易用性。

当前每个阶段都是较大的 GitHub Issue，匹配 Qoder Go Mode 的“整波实现 + direct main + 外部 Review”工作流。

---

# M0 — Foundation & Frontend Product Baseline

Issue: [#1](https://github.com/john-ops-lab/InfraSourceLab/issues/1)

## 目标

建立可持续工程骨架、运行权限边界和正确的产品交互方向。

## 主要交付

### Backend / Runtime

- Python 3.13 / uv / FastAPI；
- PostgreSQL + SQLAlchemy2 + Alembic；
- 独立 Lab Agent，Control 不持有 Docker socket；
- Docker Compose；
- Scenario / immutable Revision 基础模型；
- Driver Registry / capability API；
- Run 状态骨架和 run-scoped labels/network。

### Frontend

- React 19 + TypeScript + Vite 7；
- Tailwind CSS v4 + shadcn/ui；
- assistant-ui；
- Monaco 仅作为 Expert YAML；
- UI Skills 作为设计工程流程；
- Chrome DevTools MCP 作为真实浏览器 Agent 验收；
- Create Lab / AI-first 首页；
- Visual Builder skeleton；
- Scenario Overview / list / revision；
- Expert YAML；
- deterministic fake AI Candidate → structured preview → Apply；
- CI + Playwright regression。

## 完成判据

fresh clone 可启动；Scenario revision 不可变；普通用户可以不写 YAML 创建基础场景 Working Copy；Agent 能安全启动/清理 allowlisted test source；cleanup 不碰无关 Docker 资源；真实 Chrome 完成 Create→Builder→Expert→Save 主流程，无 Console/Network 异常。

---

# M1 — Deterministic World & Basic AI Authoring

Issue: [#2](https://github.com/john-ops-lab/InfraSourceLab/issues/2)

## 目标

第一次真正实现：

> **自然语言 / Builder → validated Scenario → deterministic canonical world → multiple runnable sources。**

## 主要交付

### Core

- Scenario `v1alpha1`；
- parser/schema/semantic diagnostics；
- deterministic IDs/names/IP allocator；
- Mimesis-based deterministic generation；
- TruthNode/TruthEdge；
- Source Projection + semantic defects；
- canonical/native identity map；
- compile manifest/digests/version provenance；
- Ground Truth API。

### First Sources

- Artifact Driver：JSON/YAML/CSV/xlsx；
- Mockoon REST Driver；
- real PostgreSQL Driver；
- 10k scale/reproducibility tests。

### Product / AI

- OpenAI-compatible basic provider abstraction；
- prompt → structured Scenario Candidate；
- schema/semantic/capability/resource validation；
- AI / Visual Builder / Expert YAML 共用同一个 Working Copy；
- compile preview / resource estimate；
- World / Sources preview；
- structured change summary；
- clear Apply → Save → Compile → Start boundary。

## 完成判据

相同 revision/seed/pinned versions 稳定产生相同 Truth/source digests；HTTP/PostgreSQL 由普通真实 client 连接；自然语言能生成一个经过服务端验证的 Scenario Candidate；用户不需要写 YAML 即可完成创建、调整、保存、编译和启动首批 Sources。

---

# M2 — Lifecycle, Faults & Verification

Issue: [#3](https://github.com/john-ops-lab/InfraSourceLab/issues/3)

## 目标

从“确定性数据源实验室”升级为真正的 DLR/CMDB Integration Test Platform。

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

## 前端

- Timeline 与 Fault 用 Guided UI，避免要求用户手写 action YAML；
- Verification 使用高信息密度 shadcn Table/Filter/Detail 组合；
- finding 可进入 AI 上下文的高级能力可在 M5 完成；
- Chrome DevTools MCP 验证 fault/verify 主流程与大列表性能。

## 完成判据

一个测试能完成：Source 启动 → DLR/consumer 采集 → Observation → Verify → Timeline 变化 → latency/429 等故障 → 再次采集与解释结果。

---

# M3 — Core Infrastructure Simulator Pack

Issue: [#4](https://github.com/john-ops-lab/InfraSourceLab/issues/4)

## Mandatory Drivers

- vCenter → govmomi/vcsim；
- Kubernetes → KWOK；
- SNMP → snmpsim；
- Redfish → DMTF Redfish Interface Emulator；
- Network CLI → FakeNOS。

每个 Driver 必须有真实外部 client、canonical↔native identity map、meaningful timeline action、fault、Source Fidelity fixture、ARM64/版本/许可证证据和无泄漏 cleanup。

### 前端

Sources 页面保持 capability-driven shared UI，不为五个 Driver 各做一套风格。特殊协议信息按渐进披露显示。

---

# M4A — Cloud & Management Protocol Pack

Issue: [#5](https://github.com/john-ops-lab/InfraSourceLab/issues/5)

Mandatory：

- AWS → Moto standalone；
- Azure Storage → Azurite；
- GCS → fake-gcs-server；
- NETCONF/YANG → Netopeer2 + sysrepo；
- libvirt → official test driver。

LocalStack 仅 optional user-provided integration，不作为默认依赖。

---

# M4B — Real-Service & Enterprise Source Packs

Issue: [#6](https://github.com/john-ops-lab/InfraSourceLab/issues/6)

对于真实服务很容易启动的协议，直接跑真的：

- MySQL/MariaDB；
- Redis；
- Apache Kafka；
- RabbitMQ；
- Eclipse Mosquitto；
- SFTP/OpenSSH；
- OpenLDAP；
- real NetBox；
- Hoverfly；
- scrapli-replay；
- Prism。

M4A/M4B 在 direct-main 下不要并发实施。

---

# M5 — Advanced AI & Imports

Issue: [#7](https://github.com/john-ops-lab/InfraSourceLab/issues/7)

## 定位变化

**基础 AI authoring 已在 M1 完成。** M5 不再是“第一次接 AI”，而是把 AI 变成成熟的上下文助手与导入助手。

## 主要交付

- assistant-ui advanced runtime UX；
- attachments；
- importer registry；
- OpenAPI / JSON Schema / JSON/YAML / CSV/xlsx / HAR / Postman；
- context snippets；
- read-only tool calls；
- Regenerate / frozen request snapshot；
- stale candidate / rebase conflict UX；
- verification explain；
- richer generative UI / approval UI；
- sanitization / prompt-injection hardening。

AI 永远不能直接 Save/Start/Stop/Delete/Fault/Docker。

---

# M6 — Scale, Remote Agent & Release Hardening

Issue: [#8](https://github.com/john-ops-lab/InfraSourceLab/issues/8)

主要交付：

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
- thin CLI if needed；
- release-quality examples/docs；
- public contributor/security guidance。

前端 release gate 加入真实 Chrome performance trace 与重点页面响应式证据。

---

# Future — Only If Demand Appears

Gap Map：[`research/cmdb-source-coverage.md`](research/cmdb-source-coverage.md)。可能方向：

- DNS/CoreDNS；
- DHCP/Kea；
- Samba AD；
- Swordfish storage；
- IPMI；
- RESTCONF/gNMI；
- OpenStack DevStack + Nova FakeDriver；
- SMB/NFS；
- Prometheus/OpenSearch；
- containerlab/GNS3/user-provided vendor NOS；
- Proxmox/Ceph contract/capture/real-lab；
- scenario marketplace；
- collaborative editing；
- SaaS；
- FDE-oriented broader synthetic enterprise environment。

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
#5 M4A → #6 M4B   (direct-main 下串行)
   ↓
#7 M5
   ↓
#8 M6
```

研究可以并行，main 上的大 Wave 实现不要并行。

---

# 前端跨 Wave 红线

从 M0 到 M6 始终保持：

- UI Skills 指导设计；
- shadcn/ui 为唯一主要通用组件体系；
- assistant-ui 为 AI UX 基础；
- Chrome DevTools MCP 为 Agent 浏览器检查工具；
- Playwright 固化稳定回归；
- Monaco 是 Expert YAML，不是普通用户默认入口；
- 不引入 Ant Design；
- 不复制 DLR CSS/Design System/Shell；
- UI 完成必须有真实 Chrome 证据。

---

# 优先级判断规则

新增需求进入路线前问：

1. 是否直接降低用户创建/验证实验环境的成本？
2. 是否帮助 DLR/CMDB 测试？
3. 是否证明 ISL 独特核心？
4. 有无成熟工具可编排？
5. 能否直接跑真实轻量服务？
6. 是否会导致自己维护复杂协议？
7. 是否要求高权限/受限镜像？
8. 没有它，当前用户流程是否真的走不通？

高用户价值、低重复造轮子优先。