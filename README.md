# InfraSourceLab

> 用自然语言描述需要的 CMDB 测试环境，生成数量可控、字段合理、关系一致的配置数据，并通过带认证的 REST API 提供给 DLR、CMDB 或测试程序。

## 项目状态：设计阶段

> **当前仓库尚未开始产品代码开发。**

截至当前 `main`：

```text
已有
├─ LICENSE
├─ README.md
└─ docs/                 产品、架构、前端与调研设计文档

尚无
├─ backend/
├─ web/
├─ Dockerfile / docker-compose.yml
├─ 自动化测试
├─ GitHub Actions
└─ 可运行版本或发布版本
```

因此，本文和 `docs/` 中描述的功能均为**目标设计**，不是已经实现的能力。任何“#1/#2 已开发完成、测试通过、可以进行代码审查”的历史表述均不代表 GitHub 当前事实。

当前工作项：

- [Issue #1](https://github.com/john-ops-lab/InfraSourceLab/issues/1)：**MVP 设计完成，尚未开始实现**；
- [Issue #2](https://github.com/john-ops-lab/InfraSourceLab/issues/2)：**可选增强设计，必须等待 #1 真正实现并验证后再决定是否开发**；
- Issues #3～#8：已关闭为“不计划实施”，不属于当前开发范围。

权威状态说明见 [`docs/status.md`](docs/status.md)。

## 计划解决的问题

个人开发 DLR 或 CMDB 时，通常没有真实企业环境，也难以准备大量合理的服务器、虚拟机、网络设备、应用、数据库、Kubernetes 等配置项及关系数据。

InfraSourceLab 计划提供最短闭环：

```text
自然语言 / 内置模板
        ↓
AI 生成小型 GenerationSpec
        ↓
用户确认数量、关系和 seed
        ↓
本地确定性生成 CI 与关系
        ↓
Bearer Token REST API
        ├─ DLR 采集
        ├─ CMDB 导入
        └─ JSON / CSV / 可选 XLSX 导出
```

AI 只负责把自然语言转换成结构化规格，不逐条生成上万条数据，也不在每次 API 请求时调用模型。

## MVP 计划范围

计划包含：

- 常用 CMDB CI 类型和关系；
- 相同 `GenerationSpec + seed + 生成器版本` 产生相同结果；
- SQLite 本地持久化；
- 一个环境变量配置的 Bearer Token；
- 分页、筛选、搜索的 REST API；
- JSON、CSV，以及低成本情况下的 XLSX 导出；
- 简单的创建、数据集、数据集详情、API 使用界面；
- OpenAI 兼容的 AI 服务提供方，同时保留无 AI 模板入口；
- 单应用、单 Docker 服务的本地运行方式。

Issue #2 中的简单拓扑和少量脏数据开关不是 #1 的前置条件。

## 明确不做

当前不建设：

- vCenter、SNMP、Kubernetes、Redfish 等协议模拟器；
- PostgreSQL、Kafka、Redis、NetBox 等真实服务编排；
- Lab Agent、Docker socket 管理、远程 Agent；
- 时间线、故障注入、Toxiproxy、观察和验证平台；
- 多租户、RBAC、SSO；
- 图数据库或生产数字孪生；
- 通用插件、导入器或规则引擎平台。

只有实际使用证明通用 REST 或文件接口不足时，才针对一个具体缺口单独立项。

## 设计文档

- [项目状态](docs/status.md)
- [产品定义](docs/product.md)
- [精简架构](docs/architecture.md)
- [GenerationSpec 与数据模型](docs/scenario-model.md)
- [生成与接口策略](docs/backend-strategy.md)
- [前端设计](docs/frontend-design.md)
- [安全与许可证](docs/security-and-licensing.md)
- [开发与代码审查流程](docs/development-workflow.md)
- [精简路线图](docs/roadmap.md)

`docs/research/` 是早期工具调研，只用于未来选型参考，不是当前实现清单。

## 许可证

InfraSourceLab 使用 [Apache License 2.0](LICENSE)。
