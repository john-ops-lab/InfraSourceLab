# InfraSourceLab 开发路线图

## 1. 路线原则

```text
M0 工程骨架 + AI-first/Builder 前端基线
        ↓
M1 Scenario/Truth/Projection + 首批 Sources + 基础 AI Authoring
        ↓
M2 Lifecycle + Fault + Verification
        ↓
M3 核心基础设施协议包
        ↓
M4A 云/管理协议 → M4B 企业真实服务/Replay
        ↓
M5 高级 AI / Imports / Attachments / Tools
        ↓
M6 Scale / Recovery / Remote Agent / Release
```

顺序遵循：

1. 先建立低成本 authoring；
2. 再证明 Truth/Projection/Verification 独特核心；
3. 再扩协议；
4. 不让“接更多 Simulator”压倒核心产品。

所有大 Wave 在当前 direct-main 流程下串行实现。

---

# M0 — Foundation & Frontend Product Baseline

Issue: [#1](https://github.com/john-ops-lab/InfraSourceLab/issues/1)

## 目标

建立工程骨架、运行权限边界和正确产品入口。

## 主要交付

### Runtime

- Python 3.13 / uv / FastAPI；
- PostgreSQL + SQLAlchemy2 + Alembic；
- Control / Lab Agent 分离；
- Docker Compose；
- Scenario metadata / immutable Revision 基础模型；
- Driver Registry skeleton；
- run labels/network skeleton。

### Authoring / Frontend

- React 19 / TS / Vite；
- Tailwind CSS v4 + shadcn/ui；
- assistant-ui fake AI shell；
- Visual Builder skeleton；
- Expert YAML；
- **unsaved Working Copy validate/estimate skeleton**；
- source/semantic digest skeleton；
- fake Candidate base semantic digest / stale-block interaction；
- Save immutable Revision；
- UI Skills + Chrome DevTools MCP + Playwright Gate。

### 关键边界

```text
Unsaved Working Copy → validate/estimate
Save → immutable Revision
```

M0 不做 authoritative Compiler/Truth Graph，也不暴露未完成 Import CTA。

---

# M1 — Deterministic World & Basic AI Authoring

Issue: [#2](https://github.com/john-ops-lab/InfraSourceLab/issues/2)

## 目标

实现：

> **自然语言 / Builder → validated Working Copy → immutable Revision → deterministic world → runnable sources**

## Core

- Scenario `v1alpha1`；
- normalized typed document；
- `source_digest` + `semantic_digest`；
- parser/schema/semantic diagnostics；
- deterministic IDs/IP/generation；
- TruthNode/TruthEdge；
- Source Projection；
- canonical/native identity map；
- Compile Manifest/provenance；
- Ground Truth API；
- 10k reproducibility smoke。

## First Sources

- Artifact JSON/YAML/CSV/xlsx；
- Mockoon REST；
- real PostgreSQL。

## Basic AI

- OpenAI-compatible provider abstraction；
- provider configured/unconfigured state；
- Prompt → structured Candidate；
- Candidate `base_semantic_digest`；
- stale Candidate blind Apply blocked；
- schema/semantic/capability/resource/security validation；
- AI/Builder/YAML one Working Copy；
- AI unavailable 不阻塞 non-AI core。

## Runtime boundary

```text
Working Copy
  ↓ user Save
Revision
  ↓ POST /api/compiles
Compile Manifest
  ↓ Start
Run
```

Compile 不接受 unsaved Working Copy，Run 不接受未成功 Compile。

---

# M2 — Lifecycle, Faults & Verification

Issue: [#3](https://github.com/john-ops-lab/InfraSourceLab/issues/3)

## 目标

从“确定性 Source Lab”升级成真正 Integration Test Platform。

## 主要交付

- manual virtual clock；
- Truth Versions；
- typed timeline actions；
- source refresh/staleness/freeze；
- semantic defect model；
- shared Toxiproxy Fault Controller；
- protocol/application fault hooks；
- Observation API；
- Verification Profiles；
- indexed identity matching；
- Source Fidelity / Canonical Outcome；
- reports；
- DLR/consumer E2E。

### Fault capability rule

Toxiproxy/其他 backend 的 capability 以**实际 pin 版本 + integration test**为准；不根据上游 main 自动宣称能力。

---

# M3 — Core Infrastructure Simulator Pack

Issue: [#4](https://github.com/john-ops-lab/InfraSourceLab/issues/4)

Mandatory：

- vCenter → govmomi/vcsim；
- Kubernetes → KWOK；
- SNMP → snmpsim；
- Redfish → DMTF Interface Emulator；
- Network CLI → FakeNOS。

每个 Driver 必须有：exact backend version/license/source、真实 external client、canonical↔native identity、timeline/fault capability、ARM64 evidence、clean lifecycle、Source Fidelity fixture。

---

# M4A — Cloud & Management Protocol Pack

Issue: [#5](https://github.com/john-ops-lab/InfraSourceLab/issues/5)

Mandatory：

- Moto；
- Azurite；
- fake-gcs-server；
- Netopeer2 + sysrepo；
- libvirt test driver。

LocalStack 只做 user-provided optional integration，实际集成时重新核对 terms。

---

# M4B — Real-Service & Enterprise Source Packs

Issue: [#6](https://github.com/john-ops-lab/InfraSourceLab/issues/6)

Mandatory：

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

这里正式承接 HTTP/SSH record-replay 与 OpenAPI contract alternate；不要把它们提前做进 M1/M2。

---

# M5 — Advanced AI & Imports

Issue: [#7](https://github.com/john-ops-lab/InfraSourceLab/issues/7)

基础 AI 已在 M1 完成。M5 增加：

- attachments；
- Importer Registry；
- OpenAPI/JSON Schema/JSON/YAML/CSV/xlsx/HAR/Postman；
- context snippets；
- read-only tool calls；
- frozen request snapshot；
- Regenerate；
- richer 3-way stale/rebase UX；
- verification explain；
- generative UI；
- sanitization / prompt-injection hardening。

`Import` 正式用户入口从 M5 才出现。

---

# M6 — Scale, Remote Agent & Release Hardening

Issue: [#8](https://github.com/john-ops-lab/InfraSourceLab/issues/8)

主要：

- 100k benchmark；
- frontend heavy-view performance；
- resource admission；
- crash/reconcile；
- orphan/TTL/GC；
- authenticated remote Agent；
- observability；
- migrations/upgrades；
- amd64/arm64/Apple Silicon matrix；
- SBOM/image/license inventory；
- JUnit/CI verify output；
- release-quality Chrome matrix；
- external contribution/security guidance。

---

# Future — Demand Driven

见 `research/cmdb-source-coverage.md`：

- DNS/CoreDNS；
- DHCP/Kea；
- Samba AD；
- Swordfish/IPMI；
- RESTCONF/gNMI；
- OpenStack；
- SMB/NFS；
- Prometheus/OpenSearch；
- containerlab/GNS3/vendor NOS；
- Proxmox/Ceph；
- scenario marketplace；
- collaboration/SaaS；
- FDE-oriented broader simulation。

这些方向当前不要求重构 Core。

---

# 跨 Wave 不可破坏合同

1. AI-first + Builder + Expert YAML；
2. unsaved Working Copy 可 validate/estimate；
3. Revision immutable；
4. Compile 只接受 Revision；
5. Run 只接受成功 Compile；
6. `semantic_digest` 驱动 AI stale safety；
7. Truth-first + Source Projection；
8. mature protocol 不重造；
9. Control 无 Docker socket；
10. Agent typed/allowlisted；
11. AI 无 Save/Compile/Run/Fault/Docker 自动权限；
12. shadcn/ui 为唯一主要通用 UI 体系；
13. assistant-ui 为 AI UX 基础；
14. UI Skills + Chrome DevTools MCP + Playwright 构成前端闭环；
15. Driver capability = actual pinned version + test evidence；
16. Apache-2.0 项目许可证不由 Go Mode 自行改变。

---

# 优先级判断

新增需求进入路线前问：

1. 是否降低用户创建/验证环境的成本？
2. 是否帮助 DLR/CMDB 测试？
3. 是否证明 Truth/Projection/Verification 核心？
4. 有无成熟工具？
5. 能否跑真实轻量服务？
6. 是否会让我们维护复杂协议？
7. 是否增加高权限/许可成本？
8. 没有它当前闭环是否走不通？

高用户价值、低重复造轮子优先。