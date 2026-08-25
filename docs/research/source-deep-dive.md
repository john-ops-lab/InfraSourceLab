# 重点项目源码拆解与可借鉴设计

> **本文是历史设计研究，不是当前实现清单。**
>
> InfraSourceLab 当前仍处于设计阶段，Issue #1 不要求接入本文中的任何模拟器、驱动、代理或运行平台。只有未来出现具体需求时，才重新核对对应项目的最新源码、版本和许可证。

## 1. Microcks：契约导入与结构化 AI

项目：`microcks/microcks`

可借鉴的思路：

```text
输入契约
→ 格式解析
→ 统一中间模型
→ 样例或候选配置
→ 校验
→ 用户确认
```

Microcks 支持 OpenAPI、AsyncAPI、Postman、Protobuf、GraphQL、SOAP 等多种契约，说明不同格式的解析不应堆进一个巨大条件分支。

对 InfraSourceLab 当前最有价值的经验是：

- 提示词约束结构化输出；
- AI 输出必须再次解析到正式领域模型；
- 自由文本不能直接成为可执行配置；
- 用户确认后才生成数据。

当前不复制 Microcks 的 Spring Boot、MongoDB、Keycloak 或异步运行体系。

## 2. MockForge：核心领域与具体实现分离

项目：`SaaSy-Solutions/mockforge`

可借鉴：

```text
核心领域
  ↑
能力契约
  ↑
具体实现
```

未来如果真的加入一种数据源模拟能力，不应把大量：

```python
if source == "vcsim": ...
elif source == "kwok": ...
```

散落在核心逻辑中。

但当前不复制其 Rust 技术栈、WASM 插件系统、多协议实现或市场化插件体系。

## 3. govmomi/vcsim：小型规格生成真实语义对象

项目：`vmware/govmomi`

`vcsim` 的价值在于：

- 可以用数量参数建立数据中心、集群、主机、虚拟机、存储和网络对象；
- 客户端仍通过 vSphere API 访问；
- 对象拥有原生标识；
- 可用于测试部分属性变化和延迟场景。

可借鉴原则：

> 大规模环境应由小型数量规格生成，而不是让 AI 展开数千条对象。

如果未来接入，InfraSourceLab 只做很薄的配置和映射，不重写 vSphere API。

## 4. KWOK：大量 Kubernetes 对象的轻量模拟

项目：`kubernetes-sigs/kwok`

KWOK 可以在不运行真实工作负载的情况下模拟大量节点和 Pod，并保留 Kubernetes API 使用方式。

可借鉴：

- 状态变化应声明式、可重复；
- 使用选择器、延迟和有序动作；
- 不使用后台随机线程制造不可复现变化。

当前 MVP 不需要 KWOK，因为 Issue #1 只生成 Kubernetes 配置数据，不模拟 Kubernetes API。

## 5. snmpsim：使用成熟工具模拟 SNMP

项目：`etingof/snmpsim`

snmpsim 说明未来需要 SNMP 时，不应自行实现协议数据单元。

可利用的能力包括：

- 从真实授权设备采集后回放；
- `.snmprec` 数据；
- 动态值变化；
- 延迟和错误；
- Trap 和 Inform；
- 多设备模拟。

只有 CMDB 的 SNMP 数据采集明确需要协议级测试时才评估接入。

## 6. DMTF Redfish 模拟器：官方协议模拟优先

项目：`DMTF/Redfish-Interface-Emulator`

可利用：

- 静态样例；
- 动态资源；
- GET、PATCH、POST、DELETE；
- 按数量和层级创建资源。

未来如需测试 BMC 或服务器硬件采集，优先调用该模拟器，不在 InfraSourceLab 中自行编写 Redfish 路由。

## 7. Mockoon、Prism 和 WireMock：HTTP Mock 不必重写

这些项目已经覆盖：

- OpenAPI 驱动的接口 Mock；
- 路由、模板和动态响应；
- 延迟、错误和代理；
- 桌面、命令行或容器运行方式。

未来若需要模拟某个普通资产 REST API，InfraSourceLab 应生成它们的配置或契约，而不是自行建设通用 HTTP Mock Server。

## 8. Toxiproxy：传输层故障复用

项目：`Shopify/toxiproxy`

如果未来确实需要延迟、超时、带宽限制、连接重置等网络故障，应优先在来源服务前放 Toxiproxy，而不是让每种数据源各自实现一套网络故障逻辑。

任何具体能力都必须以最终锁定版本的集成测试为准，不能把上游 `main` 中看到的功能直接宣称为 InfraSourceLab 已支持。

## 9. FakeNOS 与 scrapli-replay：网络命令行的两条路线

### FakeNOS

适合合成网络设备命令行响应，例如：

```text
show version
show inventory
show interfaces
show ip interface brief
```

### scrapli-replay

适合从真实授权设备录制、脱敏后回放。

未来可以按需求选择：

```text
合成命令行 → FakeNOS
真实录制回放 → scrapli-replay
高保真设备行为 → 用户提供的网络实验环境
```

## 10. Netopeer2 与 sysrepo：标准协议使用标准服务

未来需要 NETCONF 或 YANG 时，优先采用：

```text
YANG 模型
→ sysrepo 数据存储
→ Netopeer2
→ NETCONF SSH 接口
```

InfraSourceLab 只负责准备测试数据，不实现 NETCONF 报文、RPC 或 YANG 引擎。

## 11. Moto、Azurite 与 fake-gcs-server

- Moto：用于 AWS API 测试；
- Azurite：只模拟 Azure Storage；
- fake-gcs-server：只模拟 Google Cloud Storage。

可借鉴的重要原则：

> 能力描述必须精确，不能因为使用一个项目名，就暗示整个云平台都被模拟。

## 12. 真实轻量服务通常优于假协议

PostgreSQL、MySQL、Redis、Kafka、RabbitMQ、MQTT、SFTP、LDAP 等服务可以直接启动真实容器。

未来确实需要这些数据源时，应优先：

```text
生成测试数据
→ 通过官方接口写入真实服务
→ 让 CMDB、数据导入程序或测试脚本使用真实客户端读取
```

自行重写协议通常更贵、真实性更低、维护成本更高。

## 13. NetBox：真实应用比假路由更有价值

NetBox 本身就是成熟的基础设施事实来源。

如果未来需要测试 NetBox 采集，优先启动真实 NetBox 并通过官方接口写入测试数据，而不是模仿其 REST 路由。

## 14. 从源码调研中抽取的通用原则

### 原则一：小型规格驱动生成

自然语言先变成小型结构化规格，再由确定性代码生成大量对象。

### 原则二：成熟协议工具优先

已有模拟器或真实服务时不重写协议。

### 原则三：能力必须由锁定版本和测试证明

研究文档中的上游能力不能直接等价为产品能力。

### 原则四：AI 只提出结构化候选

AI 输出必须经过严格校验和用户确认，不能直接操作运行环境。

### 原则五：避免平台化抽象

只有多个真实需求反复证明需要时，才抽象注册表、驱动或导入器；不能为了未来假设提前建设。

## 15. 当前明确不复制

- 任一模拟器的完整协议实现；
- Microcks 或 MockForge 的整套运行平台；
- 其他项目的前端代码；
- 厂商专有模型或镜像；
- 未经锁定版本测试的推测能力；
- 通用插件市场和远程 Agent。

本轮源码研究的目标是：未来出现真实需求时少写代码、优先复用成熟轮子；它不改变当前精简 MVP 的范围。
