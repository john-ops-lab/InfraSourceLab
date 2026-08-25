# InfraSourceLab 产品定义

## 1. 产品定位

InfraSourceLab（ISL）是一个 **IT 基础设施数据源模拟、场景生成与采集结果验证平台**。

它解决的不是“再做一个 Mock Server”，而是：

> 在没有真实企业测试环境的情况下，如何低成本构造一个具有统一 Ground Truth、多个异构数据源、生命周期变化、脏数据和故障的 IT 世界，让 DLR、CMDB、ITOM、资产治理或采集程序可以做可重复的端到端验证？

### 第一目标用户

- 开发 DLR / CMDB / ITOM / 资产平台的人；
- 开发 vCenter、Kubernetes、SNMP、Redfish、云 API、数据库、文件等采集器的人；
- 验证多源识别、去重、合并、关系构建和数据治理的人；
- 没有完整企业测试环境但需要生产形态数据的人。

### 与 DLR / CMDB 的关系

```text
InfraSourceLab
  生成/暴露数据源
       ↓
DataLinkRuntime
  采集/解析/转换
       ↓
CMDB
  识别/治理/关系/消费
```

ISL 必须保持独立：即使未来不用 DLR 或换 CMDB，Scenario、Sources、Ground Truth 与 Verifier 仍然成立。

---

## 2. 要解决的问题

### P1：没有足够真实的数据源

个人/小团队不可能长期拥有真实的 vCenter、大型 K8s、数百 BMC、网络设备、云账号、数据库、中间件、文件服务器、NetBox/ITSM 等完整环境。

### P2：普通 Mock 只能验证“能调用”

现实数据会出现：

- 同一 CI 多个标识；
- short hostname / FQDN；
- serial 大小写/格式差异；
- IP 冲突；
- 字段缺失；
- 来源陈旧；
- 重复/错误/孤立关系；
- 分页/限流/Token/超时；
- 资产创建、迁移、重命名、下线、删除。

这些必须是显式、可复现测试场景，而不是随机脏数据。

### P3：没有统一“预期答案”

多个 Mock 各自产生数据，很难知道哪些记录其实代表同一 CI、正确关系是什么、哪些错误是故意注入的、DLR/CMDB 最终错在哪里。

因此核心是：

```text
Truth Graph
+ Source Projection
+ Observation
+ Verification
```

### P4：测试环境本身太难配置

如果用户为了模拟企业仍需先手写几百行 YAML，只是把真实环境复杂度换成 DSL 复杂度。

所以：

> **Scenario YAML 是底层资产，不是普通用户默认入口。**

---

## 3. 核心价值主张

### 3.1 One World, Many Sources

先生成一个统一 canonical world，再投影成多个来源。

```text
Truth:
server-001
serial=CZ123456
hostname=server01
ip=10.1.1.20

Redfish: CZ123456 / server01 / 10.1.1.20
SNMP:    cz123456 / server01
vCenter: server01.example.com
Excel:   SERVER01 / 10.1.1.21   # stale/wrong
```

所有来源仍能映射回同一个 canonical entity。

### 3.2 Reproducible by Default

同一 immutable Scenario Revision、seed、编译器/生成器/Driver 版本应生成同一 Truth 与 source fingerprints。

AI 不成为 runtime 随机数据引擎。

### 3.3 AI-first Authoring, Structured Runtime

```text
Natural language / Visual Builder / Expert YAML
                  ↓
         Scenario Working Copy
                  ↓
       validate / estimate / preview
                  ↓
          immutable Revision
                  ↓
       deterministic Compile
```

AI 负责降低创作成本，但不绕过 Schema、Capability、Resource 或 Security Validation。

### 3.4 Use Real Protocols Without Reimplementing Them

优先顺序：

1. 成熟专用模拟器；
2. 可直接运行的真实开源服务；
3. 契约驱动 Mock；
4. 录制回放；
5. 用户合法提供的高保真设备；
6. 最后才自研薄 Backend。

### 3.5 Failure Is a First-class Scenario

一等支持：数据错误、漂移、生命周期、认证异常、分页异常、延迟/断连、协议错误、限流、来源陈旧。

### 3.6 Ground Truth Is a Product Feature

每次 Compile/Run 必须可追溯：canonical nodes/edges、Source Projection、故意偏差、Truth Version、compiler/generator/driver provenance、endpoint/capabilities、verification report。

---

## 4. 关键用户流程

## Flow A：AI 创建实验环境（默认）

用户首先看到：

> **What do you want to simulate? / 描述你想模拟的 IT 环境**

例如：

```text
模拟一家中型企业：上海和苏州两个数据中心，
400 台服务器、1500 台 VM、3 个 K8s 集群、200 个应用。
数据来自 vCenter、SNMP、Redfish 和 Excel。
Excel 晚一个版本，并制造少量 IP 与 hostname 冲突。
```

流程：

```text
用户描述
   ↓
AI Scenario Assistant
   ↓
Structured Candidate
   ↓
Schema + Semantic + Capability + Resource Validation
   ↓
结构化摘要 / 资源估算 / 变化说明
   ↓
User Apply
   ↓
Working Copy
   ↓
User Save Revision
   ↓
User Compile
   ↓
User Start Run
```

AI 不能自动 Save、authoritative Compile、Start/Stop/Fault/Docker。

### AI Provider 未配置

AI 是默认便利入口，但不是核心 runtime 硬依赖。若 Provider 未配置：

- 明确提示 AI unavailable/not configured；
- Visual Builder 仍可用；
- Expert YAML 仍可用；
- validate/estimate/save/compile/run 仍可用。

---

## Flow B：Visual Scenario Builder

普通用户通过 Builder 精调高频能力：

```text
Environment
- sites / racks / servers / VMs / apps / K8s scale / IP ranges

Sources
- vCenter / SNMP / Redfish / REST / DB / files
- count / scope

Data Quality
- missing fields
- aliases / case drift
- duplicate
- stale source
- wrong relation

Timeline & Faults
- create / move / delete
- source freeze / refresh
- latency / timeout / protocol errors
```

Builder 操作同一个 Working Copy，不产生第二套模型。

```text
可视化调整
   ↓
实时 Validate / Estimate / Preview
   ↓
结构化变化摘要
   ↓
Save Revision
```

Builder 覆盖高频 80%，不复制整个 DSL 成低代码表单系统。

---

## Flow C：YAML Expert Mode

Monaco 用于：

- 精确控制与高级字段；
- 查看 AI/Builder 结果；
- schema/semantic/capability diagnostics；
- resource estimate；
- YAML Diff / revision history；
- copy/share/debug。

它是高级入口，不是默认首页。

产品只承诺**语义 round-trip**：Builder 不能丢合法高级字段；不承诺所有 YAML 注释、key 排版、quote style 永远逐字符保留。

---

## Flow D：保存前验证，保存后才编译

```text
Unsaved Working Copy
   ├─ Validate
   ├─ Estimate
   └─ AI Candidate
        ↓
User Save
        ↓
Immutable Revision
        ↓
Authoritative Compile
        ↓
Compile Manifest
        ↓
Start Run
```

这是重要产品合同：**易用预览不要求先保存，真正运行不接受未保存草稿。**

---

## Flow E：DLR 采集验证

```text
Start Run
   ↓
vCenter / SNMP / REST / DB endpoint
   ↓
DLR Adapter
   ↓
normalized observation
   ↓
ISL Observation API
   ↓
Verifier
   ↓
Missing / Extra / Conflict / Wrong Relation
```

DLR 不硬依赖 ISL；这是测试集成。

---

## Flow F：CMDB 多源治理

同一 Scenario 启动多个 Source Views，故意制造 alias/error/staleness；CMDB 输出统一结果后提交 ISL Verifier，验证去重和关系是否回到 canonical Truth。

---

## Flow G：时间与故障

```text
T0: server01 on host-a
T1: vm-007 migrate host-a -> host-b
T2: Excel stays stale
T3: vCenter reports new relation
T4: SNMP timeout
T5: server02 removed
```

每一步都有 Truth Version，常用动作通过 Guided UI 构建。

---

## 5. 产品对象

### Scenario

实验世界的版本化领域源码。

### Scenario Working Copy

尚未保存的统一编辑状态。AI、Builder、Expert YAML 共用。

### Scenario Revision

不可变版本，是 authoritative Compile 的唯一输入。

### Compile / Compile Manifest

Revision 的确定性编译结果：Truth Graph、Source Projections、Driver Plans、provenance、digests、resource estimates。Run 必须引用成功的 Compile Manifest。

### Truth Graph

全局 canonical nodes / edges，不等于任一来源的数据模型。

### Source / Source Projection

Source 是对外数据源实例；Projection 决定 canonical world 在该 Source 中如何被看到，包括 identity、field mapping、缺失、重复、陈旧、错误关系等。

### Driver

把 Source Projection 落到真实服务/模拟器/文件/Mock 的运行适配层。

### Lab Run

某个 Compile Manifest 的一次启动实例，拥有 network、容器、endpoint、状态、events。

### Timeline / Step

可重放的世界状态变化。

### Observation

下游系统观察到的世界，归一为 ISL Observation Schema。

### Verification Report

Expected vs Actual 的结构化差异。

---

## 6. Working Copy / Digest 产品语义

为支持 Builder/YAML/AI 共存，系统区分：

```text
source_digest   → raw YAML/source artifact hash
semantic_digest → normalized typed document hash
```

AI Candidate 使用 `base_semantic_digest` 判断 staleness。

如果 Candidate 生成期间用户已改了 Builder/YAML：

- M1 起禁止 blind Apply；
- 至少要求重新生成或明确 review；
- M5 再提供 richer 3-way diff/rebase/regenerate。

详见 `docs/scenario-model.md`。

---

## 7. 前端产品原则

### 独立设计体系

DLR 不是 UI 基线。正式组合：

- UI Skills；
- shadcn/ui + Tailwind CSS v4；
- assistant-ui；
- Chrome DevTools MCP；
- Monaco 仅 Expert YAML；
- Playwright regression。

### Progressive Disclosure

普通用户先看到 AI Create / Template / Builder，不先看到 raw Driver config/Docker/YAML。

### Structured Change First

大改场景时先显示：

```text
+ 1 site
+ 200 servers
+ 1 vCenter
~ Excel refresh → frozen
+ 2% wrong-IP defect
```

需要时再查看 YAML Diff。

### Import 不是 M0 假入口

完整 Importer/Attachment pipeline 在 M5。M5 之前不放一个不可用的主 CTA；功能真正可用后再进入 Create flow。

---

## 8. MVP 与路线

### M0：工程骨架 + 产品入口

- React/Vite/Tailwind/shadcn/ui；
- assistant-ui fake AI shell；
- Visual Builder skeleton；
- Expert YAML；
- unsaved validate/estimate skeleton；
- immutable Revision；
- FastAPI/PostgreSQL；
- Control/Lab Agent 分离；
- Driver registry/runtime skeleton；
- Chrome DevTools MCP + Playwright Gate。

### M1：确定性世界 + 基础 AI

- Scenario v1alpha1；
- deterministic compiler；
- Truth Graph；
- Projection；
- Artifact / Mockoon / PostgreSQL；
- Ground Truth API；
- OpenAI-compatible provider；
- Prompt → validated Candidate；
- base semantic digest stale protection；
- Builder/AI/YAML one Working Copy；
- Compile/World/Sources preview。

**基础 AI 从 M1 真正可用，不等 M5。**

### M2：Lifecycle / Fault / Verification

- manual clock；
- Truth Versions；
- typed timeline；
- semantic defects；
- shared transport fault backend；
- Observation；
- two-mode Verifier；
- DLR E2E。

### M3：核心基础设施

vcsim / KWOK / snmpsim / Redfish / FakeNOS。

### M4A：云与管理协议

Moto / Azurite / fake-gcs-server / Netopeer2+sysrepo / libvirt test。

### M4B：企业真实服务与 Replay

MySQL/MariaDB / Redis / Kafka / RabbitMQ / Mosquitto / SFTP / OpenLDAP / NetBox / Hoverfly / scrapli-replay / Prism。

### M5：高级 AI 与 Import

attachments/importers/context/read-only tools/Regenerate/frozen snapshot/richer stale-rebase/generative UI/verification explain。

### M6：规模与发布

100k scale、remote Agent、recovery/GC、observability、security/supply chain、frontend performance、release hardening。

---

## 9. 明确不做

- 自研万能 Mock engine；
- 通用 Workflow/DAG 平台；
- 不可信 SaaS sandbox；
- 绑定某个 AI 模型/会员；
- 运行时 request-per-request LLM fake data；
- 任意 Docker image/shell/host mount；
- 捆绑受限厂商镜像；
- 把 Builder 做成全部 DSL 的低代码复制品；
- 把 DLR UI 复制到 ISL。

---

## 10. 成功判据

第一阶段成功不是“UI 做出来”或“协议数量多”，而是用户可以：

1. 不写 YAML 创建一个有意义 Scenario；
2. 保存前 validate/estimate；
3. 保存 immutable Revision；
4. 确定性编译 Truth Graph；
5. 启动至少多种异构 Source；
6. DLR/consumer 采集并提交 Observation；
7. Verifier 准确指出缺失、冗余、字段和关系错误；
8. Timeline/Fault 后再次验证；
9. 重建同 Revision 得到稳定 fingerprints；
10. 一条明确 cleanup 路径清理 Run，不污染其他资源。

这套闭环优先于“支持了多少协议”。