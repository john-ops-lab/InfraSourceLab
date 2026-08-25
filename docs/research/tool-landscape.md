# 配置数据生成与数据源模拟工具全景调研

> 调研基线：2026-08-24。
>
> **本文是历史研究材料，不是当前开发清单。** InfraSourceLab 当前仍处于设计阶段，Issue #1 不接入本文中的协议模拟器或真实服务编排。

## 1. 调研结论

目前没有发现一个成熟、开源、真正“万能”的 IT 配置数据源模拟器，可以同时做到：

- 用自然语言描述企业 IT 环境；
- 生成统一且可重复的 CMDB 配置数据；
- 模拟 REST、vCenter、Kubernetes、SNMP、Redfish、云平台、数据库、消息队列等多种来源；
- 保持同一对象在不同来源中的身份和关系一致；
- 对采集结果自动验证。

市场上存在的是很多成熟拼图，而不是一个完整产品。

因此，当前 InfraSourceLab 不应尝试把所有拼图组装成平台。MVP 只做最有价值的公共部分：

```text
自然语言或模板
→ GenerationSpec
→ 确定性 CI 与关系
→ 认证 REST API
→ 文件导出
```

## 2. 通用 HTTP、API 与契约 Mock

### Microcks

特点：

- 支持 OpenAPI、AsyncAPI、GraphQL、gRPC、SOAP、Postman 等契约；
- 可以根据契约生成 Mock；
- 支持异步消息场景；
- 有结构化 AI 生成思路。

适合未来：从已有 API 契约快速生成数据源。

不适合当前直接作为底座的原因：部署和领域模型较重，远超当前简单 CMDB 数据生成目标。

### Mockoon

特点：

- 桌面界面、命令行和 Docker；
- REST 路由和动态模板；
- 延迟、错误、代理等常用能力；
- 上手成本低。

适合未来：快速暴露普通资产 REST API。

### WireMock

特点：

- HTTP Mock、代理和录制；
- 请求匹配能力成熟；
- 支持延迟和故障响应；
- Java 生态成熟。

适合未来：需要较复杂请求匹配和录制回放的 HTTP 适配器测试。

### Prism

特点：

- 从 OpenAPI 直接启动 Mock Server；
- 契约驱动；
- 适合轻量开发测试。

适合未来：已有 OpenAPI 的数据源。

### Hoverfly

特点：

- 服务虚拟化；
- 代理、采集、模拟和差异化响应；
- 适合录制回放。

适合未来：用户能短期访问真实沙箱并进行合法脱敏采集的场景。

### MockForge

特点：

- 自然语言生成 Mock 的理念接近最初设想；
- 涉及 REST、GraphQL、gRPC、WebSocket、消息协议和故障；
- 强调插件和扩展。

风险：社区成熟度和长期维护验证不足，不适合直接成为项目长期底座。

## 3. 假数据与 Schema 驱动生成

### Faker

特点：

- 生态成熟；
- 支持姓名、公司、地址、时间等通用字段；
- 易于通过固定 seed 实现可重复生成。

适合当前 MVP：作为字段生成基础库之一。

### Mimesis

特点：

- Python 生态；
- 数据类型丰富；
- 适合批量生成。

适合当前 MVP：与 Faker 二选一或合理分工，实施时比较性能、字段覆盖和许可证。

### JSON Schema Faker

特点：

- 根据 JSON Schema 生成合规样例；
- 支持 seed；
- 适合契约数据。

适合未来：自定义类型或 OpenAPI Schema 驱动数据生成。

## 4. 虚拟化与容器

### govmomi/vcsim

特点：

- 模拟 vCenter 和 ESXi 对象；
- 使用真实 vSphere API；
- 支持数据中心、集群、主机、虚拟机、存储和网络对象；
- 可以作为客户端集成测试环境。

未来价值很高，但不属于当前 MVP。

### KWOK

特点：

- Kubernetes SIG 项目；
- 可以轻量模拟大量节点和 Pod；
- 客户端仍通过 Kubernetes API；
- 适合规模和状态测试。

未来适合测试 DLR Kubernetes 适配器，不需要现在接入。

### libvirt 测试驱动

特点：

- 官方提供 `test:///default`；
- 不需要真实 Hypervisor；
- 适合 libvirt 客户端测试。

## 5. 硬件与网络协议

### snmpsim

特点：

- 支持 SNMP v1、v2c、v3；
- 可以从真实设备采集数据后回放；
- 支持大量代理；
- 支持动态值、延迟和错误。

未来测试网络设备、服务器和存储采集时优先复用。

### DMTF Redfish Interface Emulator

特点：

- 官方 Redfish 生态工具；
- 支持静态和动态资源；
- 可模拟服务器硬件管理接口。

未来测试 BMC 或 Redfish 适配器时优先复用。

### FakeNOS

特点：

- 模拟网络设备 SSH 命令行；
- 支持多厂商风格；
- 适合常见 `show` 命令测试。

### scrapli-replay

特点：

- 从真实网络设备会话录制并回放；
- 适合授权环境下的脱敏测试。

### Netopeer2 + sysrepo

特点：

- 提供标准 NETCONF 和 YANG 能力；
- 使用真实服务而不是假协议；
- 适合配置管理测试。

## 6. 云与对象存储

### Moto

特点：

- 覆盖大量 AWS API；
- 支持 Python 测试和独立服务；
- 适合 SDK 端点替换。

未来测试 AWS 采集时优先考虑。

### Azurite

特点：

- Azure 官方存储模拟器；
- 覆盖 Blob、Queue、Table 等存储能力。

边界：不能代表完整 Azure 控制面。

### fake-gcs-server

特点：

- 提供 Google Cloud Storage 兼容接口；
- 适合对象存储客户端测试。

边界：不能代表完整 GCP。

## 7. 真实轻量服务

以下服务通常直接启动真实容器比自行编写 Mock 更合理：

```text
PostgreSQL
MySQL / MariaDB
Redis
Apache Kafka
RabbitMQ
Eclipse Mosquitto
OpenSSH SFTP
OpenLDAP
CoreDNS
NetBox
```

理由：

- 协议实现已经成熟；
- 客户端兼容性更真实；
- 部署成本通常可控；
- 自研 Mock 容易长期偏离真实行为。

## 8. 网络故障与混沌

### Toxiproxy

特点：

- 延迟；
- 超时；
- 带宽限制；
- 连接重置；
- 数据包和连接级故障。

未来若需要传输层故障，优先把 Toxiproxy 放在来源服务前面，不让每个来源各自实现网络故障。

当前 MVP 不需要故障注入。

## 9. CMDB、DCIM 与事实来源数据

### NetBox Demo Data

NetBox 社区提供演示数据，可参考：

- 站点；
- 机柜；
- 设备；
- 虚拟机；
- IP；
- 网络关系。

适合借鉴数据结构和真实感，不应直接复制成 InfraSourceLab 的固定模型。

### NetBox

未来若要测试 NetBox 采集，优先启动真实 NetBox 并通过官方接口写入数据。

### ServiceNow、Jira Assets 等商业产品

优先顺序：

1. 官方开发实例或沙箱；
2. OpenAPI 或文档契约；
3. 合法录制和脱敏回放；
4. 只实现被真实测试阻断的极少接口。

不建设完整“假 ServiceNow”。

## 10. 对当前 MVP 可直接采用的轮子

真正适合 Issue #1 的主要是：

| 需求 | 优先工具 |
|---|---|
| Python Web API | FastAPI、Pydantic、SQLAlchemy |
| 默认持久化 | SQLite |
| 通用字段生成 | Faker 或 Mimesis |
| 稳定 UUID 和摘要 | Python 标准库 `uuid`、`hashlib` |
| IP 生成 | Python 标准库 `ipaddress` |
| 前端 | React、TypeScript、Vite |
| 组件 | shadcn/ui、Tailwind CSS |
| AI 创建体验 | assistant-ui |
| 浏览器验证 | Chrome DevTools MCP、Playwright |
| JSON、CSV | Python 标准库和成熟库 |
| XLSX | 低成本时使用成熟 XLSX 库 |

这些轮子足够完成当前产品目标。

## 11. 当前不应接入的轮子

Issue #1 不应接入：

- Microcks 运行平台；
- MockForge 运行平台；
- vcsim；
- KWOK；
- snmpsim；
- Redfish 模拟器；
- Moto；
- Azurite；
- NetBox；
- Toxiproxy；
- containerlab；
- 数据库、消息队列和目录服务编排。

它们可能在未来有价值，但现在接入会明显扩大范围和维护成本。

## 12. 选型原则

未来每次考虑新工具时，按以下顺序判断：

1. 是否解决已经出现的真实问题？
2. 是否比通用 REST 或文件接口更必要？
3. 是否已有成熟项目可直接复用？
4. 能否通过很薄的适配实现？
5. 许可证、维护状态和 ARM64 支持是否可接受？
6. 是否会把项目变成长期运行平台？
7. 是否可以独立关闭或删除而不影响核心生成器？

## 13. 最终结论

当前最合理的产品不是“万能协议模拟器”，而是一个简单、确定、可立即调用的 CMDB 数据生成工具。

先完成：

```text
自然语言或模板
→ 结构化规格
→ CI 与关系
→ 认证 API
→ 文件导出
```

只有真实使用证明某个具体协议不可替代时，才从本文选择一个成熟工具单独接入。
