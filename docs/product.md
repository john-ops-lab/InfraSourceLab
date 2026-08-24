# InfraSourceLab 产品定义

## 1. 产品定位

InfraSourceLab（ISL）是一个 **IT 基础设施数据源模拟、场景生成与采集结果验证平台**。

它的首要目标不是替代现有 Mock / Simulator，而是解决更上层的问题：

> 在没有真实企业测试环境的情况下，如何低成本构造一个具有一致 Ground Truth、多个异构数据源、生命周期变化、脏数据和故障的“IT 世界”，让 DataLinkRuntime、CMDB、ITOM、资产治理或数据采集程序能够做可重复的端到端验证？

### 1.1 第一目标用户

- 开发 DLR / CMDB / ITOM / 资产管理平台的个人开发者与团队；
- 开发 vCenter、Kubernetes、SNMP、Redfish、云 API、数据库、文件等采集器的人；
- 需要验证多源数据识别、去重、合并、关系构建和质量治理的人；
- 没有完整企业基础设施测试环境，但需要生产形态数据的人。

### 1.2 第一阶段内部使用关系

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

ISL 必须保持独立：即使未来不用 DLR 或换成其他 CMDB，Scenario、模拟数据源和 Ground Truth 仍然有价值。

---

## 2. 要解决的问题

### P1：没有足够真实的数据源

本地开发不可能长期拥有真实的：

- vCenter / ESXi；
- 多集群 Kubernetes；
- 数百台物理服务器 BMC；
- 数千台网络设备；
- AWS / Azure / GCP；
- PostgreSQL / MySQL / Oracle / Redis；
- Kafka / RabbitMQ / MQTT；
- SFTP / 文件系统；
- NetBox / Nautobot / Ralph / ITSM API；
- Excel / CSV / JSON 等人工维护数据。

### P2：普通 Mock 只能验证“能调用”，不能验证 CMDB 的难题

现实数据会出现：

- 同一 CI 的多个不同标识；
- 短 hostname 与 FQDN；
- serial 大小写或格式不一致；
- 同一 IP 被不同来源重复报告；
- 某来源字段为空；
- 旧系统仍报告已迁移/下线对象；
- 关系方向错误、孤立关系、重复关系；
- 采集时间不同导致状态冲突；
- 分页、限流、Token 过期、超时；
- 资产按时间创建、迁移、重命名、删除。

ISL 必须把这些问题变成一等场景，而不是随机制造脏数据。

### P3：没有统一的“预期答案”

多个 Mock 服务各自产生数据，最终很难知道：

- 原本应该有多少 CI；
- 哪些记录其实代表同一个 CI；
- 正确关系是什么；
- 哪些错误是故意注入的；
- DLR 少采了什么；
- CMDB 合并错了什么。

因此 ISL 的核心不是 Mock Server，而是 **Truth Graph + Source Projection + Verification**。

### P4：测试环境本身太难配置

如果用户为了“模拟一个企业”仍然必须先手写数百行 YAML，产品只是把真实环境复杂度换成了 DSL 复杂度。

因此：

> **Scenario YAML 是底层资产，不是普通用户的默认入口。**

---

## 3. 核心价值主张

### 3.1 One World, Many Sources

先生成一个统一真实世界，再投影成多个来源，而不是让每个数据源独立随机生成。

例如 Truth Graph 中存在：

```text
physical-server-001
serial: CZ123456
hostname: server01
mgmt_ip: 10.1.1.20
```

不同来源可有意暴露：

```text
Redfish: serial=CZ123456, hostname=server01, ip=10.1.1.20
SNMP:    serial=cz123456, sysName=server01
vCenter: hostname=server01.example.com
Excel:   hostname=SERVER01, ip=10.1.1.21   # stale/wrong
```

它们仍指向同一个 canonical entity。

### 3.2 Reproducible by Default

同一 Scenario、同一 seed、同一编译器和生成器版本必须尽量生成同一 Truth Graph 和同一 source manifests。

AI 不能成为每次 API 请求的随机响应引擎。

### 3.3 AI-first Authoring, Structured Runtime

自然语言用于降低“创建实验世界”的成本；运行时仍然依赖结构化 Scenario、验证后的 Driver Plan 和确定性数据。

```text
Natural language / Visual Builder / Expert YAML
                  ↓
            Scenario model
                  ↓
       strict deterministic compile
```

AI 不绕过 Schema、Capability、Resource 或 Security Validation。

### 3.4 Use Real Protocols Without Reimplementing Them

按以下顺序选择后端：

1. 成熟专用模拟器；
2. 可直接运行的真实开源服务；
3. 契约驱动 Mock；
4. 录制回放；
5. 用户提供的合法虚拟设备/厂商镜像；
6. 最后才考虑自研薄协议层。

### 3.5 Test the Failure, Not Only the Happy Path

一等支持：

- 数据错误；
- 数据漂移；
- 生命周期；
- 认证异常；
- 分页异常；
- 网络延迟/断连/丢包；
- 协议错误；
- 限流；
- 来源陈旧。

### 3.6 Ground Truth Is a Product Feature

每次运行必须可查询：

- canonical nodes；
- canonical edges；
- 每个 source 的投影视图；
- 故意注入的偏差；
- 当前 virtual clock；
- scenario/compiler/generator version；
- source endpoint 和 capabilities；
- verification report。

---

## 4. 关键用户流程

## Flow A：AI 创建实验环境（默认主流程）

用户首先看到的不是空 YAML 编辑器，而是：

> **What do you want to simulate? / 描述你想模拟的 IT 环境**

例如：

```text
模拟一家中型企业：上海和苏州两个数据中心，
400 台服务器、1500 台 VM、3 个 K8s 集群、200 个应用。
数据来自 vCenter、SNMP、Redfish 和 Excel。
Excel 比真实状态晚一个版本，并制造少量 IP 与 hostname 冲突。
```

流程：

```text
用户描述
   ↓
AI Scenario Assistant
   ↓
Structured Scenario Candidate
   ↓
Schema + Semantic + Capability + Resource Validation
   ↓
结构化场景摘要 / 资源估算 / 变化说明
   ↓
[创建] [可视化调整] [高级 YAML]
   ↓
Working Copy
   ↓
Save Revision
   ↓
Compile
   ↓
Start Lab
```

用户不需要先看 YAML。

AI 只提出 Candidate，不能自动保存或启动环境。

## Flow B：Visual Scenario Builder（普通用户精调）

用户通过可视化 Builder 调整 Scenario 高频能力：

```text
Environment
- sites / racks / servers / VMs / applications
- Kubernetes scale
- IP ranges

Sources
- vCenter / SNMP / Redfish / REST / DB / files
- count / scope

Data Quality
- missing fields
- alias / case drift
- duplicate
- stale source
- wrong relation

Timeline & Faults
- create / move / delete
- source freeze / refresh
- latency / timeout / protocol errors
```

Builder 修改的仍然是同一个 Scenario Working Copy，不产生第二套独立数据模型。

核心体验：

```text
可视化调整
   ↓
实时 Validate / Estimate / Preview
   ↓
结构化变化摘要
   ↓
Save Revision
```

Visual Builder 只覆盖高频 80% 场景，不追求把所有高级 DSL 字段都做成表单。

## Flow C：YAML Expert Mode（专家模式）

Monaco YAML 用于：

- 精确控制；
- 高级字段；
- 查看 AI/Builder 生成结果；
- schema completion / diagnostics；
- semantic/capability diagnostics；
- deterministic compile preview；
- resource estimate；
- YAML Diff 与 revision history。

它是高级入口，而不是默认首页。

## Flow D：用 DLR 验证采集

```text
Start Lab
   ↓
取得 vCenter / SNMP / REST / DB endpoint
   ↓
DLR Adapter 采集
   ↓
把 normalized observation 提交 ISL
   ↓
Verifier
   ↓
Missing / Extra / Conflict / Wrong Relation Report
```

## Flow E：CMDB 多源治理测试

同一 Scenario 同时启动多个 source views，故意制造别名、错误和陈旧数据，随后将 CMDB 导出的统一结果提交 Verifier，检查去重和关系是否符合 Ground Truth。

## Flow F：时间与故障测试

用户执行确定性的 timeline step：

```text
T0: server01 on host-a
T1: vm-007 migrate host-a -> host-b
T2: source_excel stays stale
T3: vCenter reports new relation
T4: SNMP timeout 30s
T5: server02 removed
```

每一步都有可查询的 Truth version。

---

## 5. 产品对象

### Scenario

用户定义的实验世界声明，是可版本化的源码。用户可以通过 AI、Visual Builder 或 Expert YAML 创建/修改它。

### Scenario Working Copy

当前尚未保存的统一编辑状态。AI、Builder、Expert YAML 必须共同操作这一份状态。

### Scenario Revision

不可变版本。运行必须引用某个 revision，而不是一个随时变化的草稿。

### Compiled World

Scenario 编译后的确定性结果：Truth Graph + source projections + driver plans + manifest。

### Truth Graph

全局 canonical nodes / edges。它是验证依据，不等于任何一个 source 的数据模型。

### Source

一个对外数据源实例，例如：

- `vcenter-primary`；
- `snmp-network-east`；
- `assets-excel`；
- `postgres-inventory`。

### Source Projection

Truth Graph 到某个 Source 的确定性映射，可修改字段名、身份标识、遗漏、重复、陈旧度与脏数据。

### Driver

将 source projection 落到真实服务/模拟器/文件/Mock 系统的运行适配层。

### Lab Run

某个 Scenario Revision 的一次启动实例，拥有自己的网络、容器、端口、运行状态和 manifest。

### Timeline / Step

可重复的世界状态变化序列。

### Observation

下游系统提交的“它观察到的世界”。统一成 ISL observation schema 后才能与 Truth 比较。

### Verification Report

Expected 与 Actual 的结构化差异。

---

## 6. 前端产品原则

### 6.1 不再参考 DLR 视觉与组件体系

DataLinkRuntime 仍然是重要的业务使用对象，但不再作为 InfraSourceLab 前端视觉/组件/布局实现基线。

正式前端基线：

- `ibelick/ui-skills` — 设计工程方法；
- `shadcn-ui/ui` — UI 组件与设计系统；
- `assistant-ui/assistant-ui` — AI UX；
- `ChromeDevTools/chrome-devtools-mcp` — 真实浏览器 Agent 验收。

运行时：React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui + assistant-ui；Monaco 只用于 Expert Mode。

详见 `docs/frontend-design.md`。

### 6.2 渐进披露

普通用户首先看到：

```text
AI Create / Templates / Visual Builder
```

而不是：

```text
YAML / Driver 私有参数 / Docker / 复杂系统字段
```

### 6.3 变化优先结构化表达

AI 或 Builder 大改场景时，用户先看到：

```text
+ 1 site
+ 200 servers
+ 1 vCenter
~ Excel refresh → frozen
+ 2% wrong-IP defect
```

需要时再查看 YAML Diff。

---

## 7. MVP（M0–M2）范围

### M0：产品骨架 + 正确前端方向

- React / Vite / Tailwind CSS v4 / shadcn/ui；
- assistant-ui fake AI shell；
- UI Skills 作为 Agent 设计流程；
- Chrome DevTools MCP 作为前端验收流程；
- Visual Scenario Builder skeleton；
- Expert YAML Monaco；
- Scenario list / Overview / immutable revision；
- FastAPI Control；
- PostgreSQL；
- 独立 Lab Agent；
- Docker Compose；
- Driver Registry / capability API；
- health / logs / runtime skeleton。

M0 的 AI 使用 deterministic fake provider，重点先固化交互与安全边界。

### M1：确定性世界 + 基础 AI authoring

- Scenario v1alpha1；
- deterministic compiler；
- Truth Graph；
- source projection；
- JSON / YAML / CSV / Excel artifact driver；
- Mockoon REST driver；
- PostgreSQL real-service driver；
- stable manifest + fingerprints；
- Ground Truth API；
- OpenAI-compatible 基础 AI provider；
- Prompt → validated Scenario Candidate；
- AI / Builder / Expert YAML 共用 Working Copy；
- compile/resource preview；
- World/Sources preview。

**基础 AI 创建能力从 M1 就可真实使用，不等到 M5。**

### M2：真正成为测试平台

- manual virtual clock / timeline steps；
- semantic dirty data；
- Toxiproxy 网络 fault；
- HTTP/auth/pagination fault hooks；
- Observation API；
- Verifier；
- deterministic report；
- DLR 示例端到端测试。

完成 M2 后，即使尚未接入 vCenter/SNMP，也应已经证明产品核心价值。

---

## 8. 后续范围

### M3：核心基础设施协议包

- vcsim；
- KWOK；
- snmpsim；
- DMTF Redfish；
- FakeNOS。

### M4：云与企业数据源包

- Moto；
- Azurite；
- fake-gcs-server；
- Netopeer2/sysrepo；
- libvirt test driver；
- NetBox；
- 真实 Redis / Kafka / MQTT / SFTP / LDAP；
- record/replay。

### M5：高级 AI 与 Imports

M1 已有基础 AI authoring；M5 聚焦高级能力：

- attachments/import；
- OpenAPI/JSON Schema/CSV/xlsx/HAR/Postman 等 importer；
- context snippets；
- read-only tool calls；
- Regenerate / frozen request snapshot；
- advanced stale-candidate conflict UX；
- verification explain；
- richer generative UI。

### M6：规模与发布

- 10k/100k entity scale tests；
- remote Agent；
- observability；
- cleanup/recovery；
- security hardening；
- release packaging；
- reusable test packs。

---

## 9. 明确不做

### 不做万能 Mock 引擎

不会自己重新实现一整套 HTTP/gRPC/Kafka/SNMP/vSphere/K8s mock engine。

### 不做通用 Workflow 平台

Timeline 只描述实验世界状态变化，不演化成业务 DAG / 审批 / ETL 编排。

### 不做不可信 SaaS Sandbox

第一阶段是本地/可信管理员使用。Lab Agent 的容器能力不是安全多租户沙箱。

### 不绑定 DLR 或某个 CMDB

验证入口使用通用 Observation schema；DLR/未来 CMDB 只提供 adapter/exporter。

### 不绑定某个 AI 模型或会员

Qoder 可以开发本项目，但项目运行时不能依赖 Qoder。AI Provider 必须抽象。

### 不捆绑厂商受限镜像

高保真虚拟网络/设备只编排用户自行提供且有合法授权的镜像。

### 不做 YAML-first 产品

YAML 永远保留，但普通用户不应该被迫通过 Expert Mode 才能创建场景。

---

## 10. 成功判据

第一阶段真正成功，不是“UI 做出来”，而是用户能低成本完成以下闭环：

1. 用自然语言或 Visual Builder 创建 Scenario，而无需手写大段 YAML；
2. 一次编译得到确定性的 Truth Graph；
3. 启动至少三种不同形态的 source；
4. DLR 从 source 采集数据；
5. ISL 接收 observation；
6. Verifier 能准确指出缺失、冗余、字段冲突和错误关系；
7. 执行 timeline step 后可以再次验证；
8. 重建同一 revision 时 Ground Truth 与 source fingerprint 保持一致；
9. 整个环境一条命令启动、一条命令清理，不污染其他 Lab Run；
10. AI/Builder/Expert YAML 始终操作同一个结构化 Scenario，不产生三套互相漂移的配置。

这套闭环比“支持了多少协议”优先级更高。