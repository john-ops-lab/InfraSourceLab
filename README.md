# InfraSourceLab

> **Build a reproducible IT infrastructure world, expose it through realistic data sources, and verify what downstream systems actually collected.**
>
> 构造一个可重复的 IT 基础设施世界，通过真实协议、模拟器或轻量服务对外暴露，并验证 DLR、CMDB 等下游系统最终采集到了什么。

InfraSourceLab（ISL）是一个面向 **CMDB / ITOM / 数据采集与集成测试** 的基础设施数据源实验室。

它不是一个“随机 JSON 生成器”，也不准备重新实现 vCenter、Kubernetes、SNMP、Redfish、数据库、消息队列等成熟协议。它的核心职责是：

1. 用 Scenario 描述一个完整、可重复的 IT 世界；
2. 编译出统一的 **Truth Graph（真实配置图谱）**；
3. 把同一份真实世界投影成多个数据源各自“看见”的数据；
4. 编排成熟模拟器或真实轻量服务来暴露这些数据；
5. 注入脏数据、延迟、故障、漂移和生命周期变化；
6. 接收 DLR / CMDB 的采集结果，并与 Ground Truth 自动对比。

项目当前处于 **设计与早期开发阶段**。产品、架构、工具调研和第一轮完整开发 Issues 已建立，代码实现从 [M0 Issue #1](https://github.com/john-ops-lab/InfraSourceLab/issues/1) 开始。

---

## 为什么做它

开发数据采集平台和 CMDB 时，一个长期问题是：测试环境很难同时拥有 vCenter、Kubernetes、服务器 BMC、网络设备、云 API、数据库、消息队列、文件服务器等真实数据源。

更难的是，CMDB 真正需要验证的往往不是“接口能不能返回 JSON”，而是：

- 同一台设备在不同来源里的标识并不完全一致；
- 某个来源的数据比另一个来源晚几分钟；
- serial 大小写不同、hostname 有短名/FQDN、IP 已变更但旧系统尚未同步；
- 存在重复、缺失、错误关系、分页异常、401/429/500、超时和网络抖动；
- 资产会创建、迁移、重命名、下线和删除。

InfraSourceLab 希望把这些现实问题变成 **可描述、可复现、可自动验证的测试场景**。

---

## 核心模型

```text
Natural Language / scenario.yaml
              │
              ▼
      Scenario Compiler
              │
              ▼
          Truth Graph
       (nodes + edges)
              │
      ┌───────┼────────┐
      │       │        │
      ▼       ▼        ▼
 Source A  Source B  Source C
  view      view      view
      │       │        │
      ▼       ▼        ▼
  Simulator / Real Service / Contract Mock
      │       │        │
      └───────┼────────┘
              ▼
             DLR
              │
              ▼
             CMDB
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

**关键原则：AI 负责帮助编写 Scenario，不在每次请求到来时临时生成响应。** 场景一旦编译，运行时必须尽量确定、可复现、可自动测试。

---

## 不重复造轮子

InfraSourceLab 采用“统一控制层 + Driver”的方式复用成熟生态：

| 场景 | 优先方案 |
|---|---|
| vCenter / ESXi | govmomi `vcsim` |
| Kubernetes | Kubernetes SIG `KWOK` |
| SNMP | `snmpsim` |
| Redfish / BMC | DMTF Redfish Interface Emulator |
| 网络设备 CLI / SSH | `FakeNOS`，录制回放使用 `scrapli-replay` |
| AWS API | `Moto` |
| Azure Storage | `Azurite` |
| Google Cloud Storage | `fake-gcs-server` |
| NETCONF / YANG | `Netopeer2 + sysrepo` |
| 通用 REST / OpenAPI | 默认 `Mockoon CLI`，contract 可用 `Prism`，复杂多协议可选 `Microcks` |
| HTTP 录制回放 | `Hoverfly` |
| PostgreSQL / MySQL / Redis / Kafka / MQTT / SFTP / LDAP 等 | **直接启动真实轻量服务并灌入场景数据** |
| DNS | 后期直接使用真实 `CoreDNS` |
| DHCP | 后期直接使用真实 `Kea` |
| Active Directory | 后期可选真实 `Samba AD DC` |
| 网络故障 | `Toxiproxy` |
| 高保真网络拓扑 | 后期可选 `containerlab` / GNS3，用户自行提供合法镜像 |

完整工具调研见 [`docs/research/tool-landscape.md`](docs/research/tool-landscape.md)，CMDB 数据源覆盖与未排期 Gap 见 [`docs/research/cmdb-source-coverage.md`](docs/research/cmdb-source-coverage.md)。

---

## 数据源保真度分层

InfraSourceLab 不追求所有数据源都达到同一种保真度，而是使用满足测试目的的最低成本方案：

- **L0 — Artifact**：JSON / YAML / CSV / Excel 等静态或版本化文件；
- **L1 — Contract Mock**：根据 OpenAPI / JSON Schema 等契约生成接口；
- **L2 — Protocol Emulator**：vcsim、KWOK、snmpsim、Redfish、FakeNOS 等；
- **L3 — Real Service**：真实 PostgreSQL、Redis、Kafka、MQTT、DNS、LDAP 等轻量服务；
- **L4 — Virtual Appliance Lab**：containerlab / GNS3 + 用户提供的厂商镜像，仅用于必须高保真的场景。

选择规则：**能用 L1 证明的问题不要上 L4；已有成熟模拟器的协议不要自己重新实现；真实服务很轻时直接跑真的。**

---

## 与 DataLinkRuntime 的关系

InfraSourceLab 是数据源侧测试环境；[DataLinkRuntime](https://github.com/john-ops-lab/DataLinkRuntime) 是采集、解析、转换与数据适配运行层。二者边界保持独立：

```text
InfraSourceLab  →  DataLinkRuntime  →  CMDB / other targets
   Source Lab       Adapter Runtime      Consumer
```

InfraSourceLab 的 Web 技术栈、视觉语言和 AI 交互尽可能与 DLR 保持一致，以降低维护成本：React 19 + TypeScript + Vite + Ant Design + Monaco + assistant-ui + i18next。

AI 交互继续沿用 DLR 已验证的：

```text
Working Copy + Explicit Context
             ↓
      Scenario Candidate
             ↓
          Diff
             ↓
Apply to browser Working Copy
             ↓
      User Save / Compile / Start
```

AI 不自动 Save、Start、Stop、Delete、Enable Fault，也不能直接向 Lab Agent 发送 Docker/shell 命令。

复用边界见 [`docs/dlr-ui-reuse.md`](docs/dlr-ui-reuse.md)。

---

## 开发路线与 Issues

当前采用“大 Wave + Qoder Go Mode + direct main + 阶段外部 Review”的个人快速开发方式。每个 Wave 开始前在 Issue 记录 Base SHA，完成后记录 Head SHA 和测试证据，Issue 在 Review 通过前不关闭。

| Wave | Issue | 目标 |
|---|---|---|
| M0 | [#1](https://github.com/john-ops-lab/InfraSourceLab/issues/1) | 工程骨架、DLR-style Web、Control/Lab Agent 权限分离 |
| M1 | [#2](https://github.com/john-ops-lab/InfraSourceLab/issues/2) | Scenario Compiler、Truth Graph、Projection、Artifact/Mockoon/Postgres |
| M2 | [#3](https://github.com/john-ops-lab/InfraSourceLab/issues/3) | Timeline、Toxiproxy、Observation、Verifier |
| M3 | [#4](https://github.com/john-ops-lab/InfraSourceLab/issues/4) | vcsim、KWOK、snmpsim、Redfish、FakeNOS |
| M4A | [#5](https://github.com/john-ops-lab/InfraSourceLab/issues/5) | Moto、Azurite、GCS、NETCONF、libvirt |
| M4B | [#6](https://github.com/john-ops-lab/InfraSourceLab/issues/6) | DB/cache/MQ/SFTP/LDAP、NetBox、record/replay |
| M5 | [#7](https://github.com/john-ops-lab/InfraSourceLab/issues/7) | AI Scenario Assistant + Import pipeline |
| M6 | [#8](https://github.com/john-ops-lab/InfraSourceLab/issues/8) | 100k scale、Remote Agent、Recovery/GC、Release hardening |

当前 direct-main 流程下，大 Wave **串行实现，不并发修改 main**。详细规则见 [`docs/development-workflow.md`](docs/development-workflow.md)。

---

## 文档

- [产品定义](docs/product.md)
- [总体架构](docs/architecture.md)
- [Scenario 与 Truth Graph 模型](docs/scenario-model.md)
- [模拟器与数据源后端策略](docs/backend-strategy.md)
- [工具全景调研](docs/research/tool-landscape.md)
- [CMDB 数据源覆盖与 Gap Map](docs/research/cmdb-source-coverage.md)
- [重点项目源码拆解与设计借鉴](docs/research/source-deep-dive.md)
- [DLR 前端与 AI 交互复用方案](docs/dlr-ui-reuse.md)
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

未来如果这些能力自然形成独立价值，再按真实需求扩展，而不是提前做“大而全”。

---

## License

仓库尚未选择开源许可证。由于项目会编排多个不同许可证的外部工具，建议在首个稳定公开发布版本前由仓库所有者明确选择 **Apache-2.0 或 MIT**，并保持第三方组件的许可证与 NOTICE 清单。不要在未确认前复制受限许可证项目的源码进入本仓库。
