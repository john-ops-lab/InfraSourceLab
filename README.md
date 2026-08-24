# InfraSourceLab

> **Build a reproducible IT infrastructure world, expose it through realistic data sources, and verify what downstream systems actually collected.**
>
> 构造一个可重复的 IT 基础设施世界，通过真实协议、模拟器或轻量服务对外暴露，并验证 DLR、CMDB 等下游系统最终采集到了什么。

InfraSourceLab（ISL）是一个面向 **CMDB / ITOM / 数据采集与集成测试** 的基础设施数据源实验室。

它不是随机 JSON 生成器，也不准备重新实现 vCenter、Kubernetes、SNMP、Redfish、数据库、消息队列等成熟协议。核心职责是：

1. 用 Scenario 描述一个完整、可重复的 IT 世界；
2. 编译出统一的 **Truth Graph**；
3. 把同一份真实世界投影成多个数据源各自“看见”的数据；
4. 编排成熟模拟器或真实轻量服务暴露这些数据；
5. 注入脏数据、延迟、故障、漂移和生命周期变化；
6. 接收 DLR / CMDB 的采集结果，并与 Ground Truth 自动对比。

项目当前处于 **设计与早期开发阶段**。完整开发从 [M0 Issue #1](https://github.com/john-ops-lab/InfraSourceLab/issues/1) 开始。

---

## 产品体验：AI-first，不要求普通用户手写 YAML

Scenario YAML 是底层可读、可版本化的资产，不是默认交互入口。

```text
A. AI Create / Describe Lab      ← 默认入口
B. Visual Scenario Builder       ← 可视化精调
C. YAML Expert Mode              ← Monaco 专家模式
               ↓
        Scenario Working Copy
               ↓
 Validate / Estimate / Preview
               ↓
          Save Revision
               ↓
        Compile / Start
```

例如用户可以直接描述：

> 模拟一家中型企业，上海和苏州两个数据中心，400 台物理机、1500 台 VM、3 个 Kubernetes 集群、200 个应用。数据来自 vCenter、SNMP、Redfish 和 Excel，其中 Excel 比真实状态晚一个版本，并制造少量 IP/hostname 冲突。

平台先返回结构化场景摘要、数据源、数据质量设置和资源估算，用户可以直接创建、可视化调整，或进入高级 YAML。

**普通用户不需要阅读 YAML 才能完成核心流程。**

---

## 核心模型

```text
Natural Language / Visual Builder / Expert YAML
                    │
                    ▼
             Scenario Working Copy
                    │
                    ▼
             Scenario Compiler
                    │
                    ▼
                Truth Graph
             (nodes + edges)
                    │
            ┌───────┼────────┐
            ▼       ▼        ▼
        Source A Source B Source C
            │       │        │
            ▼       ▼        ▼
    Simulator / Real Service / Contract Mock
                    │
                    ▼
              DLR / CMDB / Client
                    │
                    ▼
              Observation API
                    │
                    ▼
                 Verifier
                    │
                    ▼
          Expected vs Actual Report
```

AI 负责帮助**编写 Scenario**，不在每次数据请求到来时临时生成随机响应。场景编译后，运行时必须尽量确定、可复现、可自动测试。

---

## 不重复造轮子

InfraSourceLab 采用“统一控制层 + Driver”的方式复用成熟生态：

| 场景 | 优先方案 |
|---|---|
| vCenter / ESXi | govmomi `vcsim` |
| Kubernetes | Kubernetes SIG `KWOK` |
| SNMP | `snmpsim` |
| Redfish / BMC | DMTF Redfish Interface Emulator |
| 网络设备 CLI / SSH | `FakeNOS`；录制回放 `scrapli-replay` |
| AWS API | `Moto` |
| Azure Storage | `Azurite` |
| Google Cloud Storage | `fake-gcs-server` |
| NETCONF / YANG | `Netopeer2 + sysrepo` |
| 通用 REST / OpenAPI | `Mockoon CLI` / `Prism`；复杂多协议可选 `Microcks` |
| HTTP 录制回放 | `Hoverfly` |
| PostgreSQL / MySQL / Redis / Kafka / MQTT / SFTP / LDAP | **直接启动真实轻量服务并灌入场景数据** |
| DNS | 后期直接使用真实 `CoreDNS` |
| DHCP | 后期直接使用真实 `Kea` |
| Active Directory | 后期可选真实 `Samba AD DC` |
| 网络故障 | `Toxiproxy` |
| 高保真网络拓扑 | 后期可选 `containerlab` / GNS3，用户自行提供合法镜像 |

完整工具调研见 [`docs/research/tool-landscape.md`](docs/research/tool-landscape.md)，CMDB 数据源覆盖与 Gap 见 [`docs/research/cmdb-source-coverage.md`](docs/research/cmdb-source-coverage.md)。

### 数据源保真度分层

- **L0 — Artifact**：JSON / YAML / CSV / Excel；
- **L1 — Contract Mock**：OpenAPI / JSON Schema 等契约；
- **L2 — Protocol Emulator**：vcsim、KWOK、snmpsim、Redfish、FakeNOS；
- **L3 — Real Service**：PostgreSQL、Redis、Kafka、MQTT、DNS、LDAP 等；
- **L4 — Virtual Appliance Lab**：containerlab / GNS3 + 用户合法提供的厂商镜像。

选择规则：**已有成熟模拟器就编排它；真实服务很轻就直接跑真的；最后才考虑自研薄协议层。**

---

## 与 DataLinkRuntime 的关系

InfraSourceLab 是数据源侧测试环境；[DataLinkRuntime](https://github.com/john-ops-lab/DataLinkRuntime) 是采集、解析、转换与数据适配运行层。两者业务边界独立：

```text
InfraSourceLab  →  DataLinkRuntime  →  CMDB / other targets
   Source Lab       Adapter Runtime      Consumer
```

**DLR 不再作为 InfraSourceLab 的前端视觉或组件实现基线。** 两个项目可以共享业务经验，但 ISL 使用独立的现代前端设计工程体系。

---

## 前端设计工程基线

InfraSourceLab 前端正式采用：

- **UI Skills** — `ibelick/ui-skills`：设计工程方法与 Agent skills；
- **shadcn/ui** — `shadcn-ui/ui`：主要 UI 组件与设计系统；
- **assistant-ui** — `assistant-ui/assistant-ui`：AI 对话和 Generative UI；
- **Chrome DevTools MCP** — `ChromeDevTools/chrome-devtools-mcp`：真实 Chrome 点击、截图、Console/Network、性能与响应式检查。

运行时建议：

```text
React 19 + TypeScript + Vite 7
Tailwind CSS v4 + shadcn/ui
assistant-ui
Monaco (Expert YAML only)
i18next
Vitest + Testing Library
Playwright
```

明确不使用：

```text
Ant Design
Ant Design Pro Components
DLR Design System / CSS / Shell
```

完整设计见 [`docs/frontend-design.md`](docs/frontend-design.md)。

---

## AI 安全边界

AI 的正常路径：

```text
Prompt + current model + Driver capabilities
        ↓
Scenario Candidate
        ↓
Schema / Semantic / Capability / Resource Validation
        ↓
Structured Summary + Visual Preview + optional YAML Diff
        ↓
User Apply
        ↓
Working Copy
        ↓
User Save / Compile / Start
```

AI 不自动：

- Save Revision；
- Start / Stop Run；
- Step Timeline；
- Enable destructive Fault；
- Install Driver / pull arbitrary image；
- 执行 shell；
- 读取 secret。

---

## 开发路线与 Issues

当前采用“大 Wave + Qoder Go Mode + direct main + 阶段外部 Review”。

| Wave | Issue | 目标 |
|---|---|---|
| M0 | [#1](https://github.com/john-ops-lab/InfraSourceLab/issues/1) | 工程骨架、新前端设计系统、Visual Builder、Control/Lab Agent 分离 |
| M1 | [#2](https://github.com/john-ops-lab/InfraSourceLab/issues/2) | Scenario Compiler、Truth Graph、Projection、首批 Sources、**基础 AI authoring** |
| M2 | [#3](https://github.com/john-ops-lab/InfraSourceLab/issues/3) | Timeline、Toxiproxy、Observation、Verifier |
| M3 | [#4](https://github.com/john-ops-lab/InfraSourceLab/issues/4) | vcsim、KWOK、snmpsim、Redfish、FakeNOS |
| M4A | [#5](https://github.com/john-ops-lab/InfraSourceLab/issues/5) | Moto、Azurite、GCS、NETCONF、libvirt |
| M4B | [#6](https://github.com/john-ops-lab/InfraSourceLab/issues/6) | DB/cache/MQ/SFTP/LDAP、NetBox、record/replay |
| M5 | [#7](https://github.com/john-ops-lab/InfraSourceLab/issues/7) | 高级 AI：Imports、Attachments、Tools、Context、Regenerate |
| M6 | [#8](https://github.com/john-ops-lab/InfraSourceLab/issues/8) | 100k scale、Remote Agent、Recovery/GC、Release hardening |

大 Wave 在 `main` 上串行实现，不并发修改。详细规则见 [`docs/development-workflow.md`](docs/development-workflow.md)。

---

## 文档

- [产品定义](docs/product.md)
- [总体架构](docs/architecture.md)
- [前端产品与设计工程方案](docs/frontend-design.md)
- [Scenario 与 Truth Graph 模型](docs/scenario-model.md)
- [模拟器与数据源后端策略](docs/backend-strategy.md)
- [工具全景调研](docs/research/tool-landscape.md)
- [CMDB 数据源覆盖与 Gap Map](docs/research/cmdb-source-coverage.md)
- [重点项目源码拆解与设计借鉴](docs/research/source-deep-dive.md)
- [故障、时间与自动验证设计](docs/verification-and-faults.md)
- [安全与许可证边界](docs/security-and-licensing.md)
- [Qoder Go Mode + 直接 main 开发与 Review 工作流](docs/development-workflow.md)
- [开发路线图](docs/roadmap.md)

---

## 当前边界

第一阶段优先解决 **DLR 和后续 CMDB 的开发/集成测试**。当前不做：

- 通用网络仿真平台；
- 通用服务虚拟化平台；
- 生产级数字孪生平台；
- 面向不可信多租户的任意容器/任意代码执行平台；
- 对所有厂商私有协议的重新实现；
- 在运行时依赖任何特定 AI 会员或 Coding Agent。

---

## License

InfraSourceLab 使用 **Apache License 2.0**，见根目录 [`LICENSE`](LICENSE)。第三方模拟器、服务、库与容器继续遵循各自许可证与再分发条件；详细边界见 [`docs/security-and-licensing.md`](docs/security-and-licensing.md)。