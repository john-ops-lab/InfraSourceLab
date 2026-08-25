# InfraSourceLab 产品定义

> **状态：设计阶段，尚未开始产品代码开发。**
>
> 本文描述目标产品，不代表功能已经实现。实际状态以 [`status.md`](status.md) 和 GitHub `main` 中真实存在的文件为准。

## 1. 第一性原理

用户真正需要的不是“模拟整个企业基础设施”，而是：

> 在没有真实测试环境时，快速得到一批数量可控、字段合理、关系一致的 CMDB 配置数据，并让 DLR、CMDB 或测试脚本通过一个带认证的接口读取。

因此首版只计划完成四件事：

1. 把自然语言转换成结构化生成规格；
2. 根据规格稳定生成 CI 与关系；
3. 通过 Bearer Token REST API 和文件导出提供数据；
4. 给用户一个能创建、预览和使用数据集的简单界面。

任何不直接服务这四件事的能力都不进入 MVP。

## 2. 目标用户

- 正在开发 DataLinkRuntime 适配器的个人开发者；
- 正在开发或学习 CMDB 的个人开发者；
- 需要基础设施配置测试数据的后端、测试或数据治理人员；
- 没有 vCenter、SNMP、云平台、资产系统等真实环境，但需要验证采集和导入的人。

第一阶段默认部署条件：本地或可信内网、单用户、自托管。

## 3. 核心用户任务

用户应当能够在几分钟内完成：

```text
描述数据需求
  ↓
确认 AI 生成的规格
  ↓
生成数据集
  ↓
复制带认证的 API 示例
  ↓
让 DLR、CMDB 或脚本读取
```

成功标准不是“支持了多少协议”，而是：

- 用户不用手工编写几百行 JSON 或 YAML；
- 数据不是互不关联的随机记录；
- API 可以立即被程序调用；
- 同一 seed 可以重复生成相同数据；
- 数据规模能够覆盖日常开发测试。

## 4. 产品价值

### 4.1 AI 降低配置成本

用户可以输入：

> 生成两个数据中心、20 个机柜、100 台物理服务器、500 台虚拟机、50 个应用、15 个数据库和一个 Kubernetes 集群。

AI 计划输出小型 `GenerationSpec`，而不是直接输出数百或数千条记录。

### 4.2 本地生成保证速度与重复性

```text
GenerationSpec + seed
        ↓
CI 记录 + CI 关系
```

同一规格、seed 和生成器版本应得到相同结果。

### 4.3 通用接口先解决主要测试需求

首版计划提供统一 REST API、JSON、CSV；XLSX 在不拖慢核心闭环时实现。

这些能力已经足以验证：

- DLR HTTP 或文件适配器；
- CMDB 批量导入；
- 分页、筛选和字段映射；
- CI 关系处理；
- 万级数据的基本性能。

真实 vCenter、SNMP、Redfish 等协议，只有出现明确且反复发生的适配器测试需求后才单独评估。

## 5. 主要用户流程

### 流程一：通过 AI 创建数据集

```text
用户输入自然语言
  ↓
AI 返回结构化规格和数量摘要
  ↓
用户修改少量数量、关系或 seed
  ↓
点击生成
  ↓
进入数据集详情
```

### 流程二：无 AI 创建

AI 未配置时，用户仍可：

- 选择内置模板；
- 设置各 CI 类型数量；
- 设置 seed；
- 生成数据。

AI 是加速器，不是系统唯一入口。

### 流程三：程序读取

```text
Bearer Token
  ↓
GET /datasets/{id}/cis
GET /datasets/{id}/relations
  ↓
DLR / CMDB / 脚本
```

### 流程四：文件导出

用户下载 JSON、CSV 或可选 XLSX，用于适配器、导入或人工检查。

### 流程五：简单拓扑

简单拓扑属于 Issue #2 的可选增强。它只从已有 CI 和关系中抽样或筛选后绘图，不引入图数据库或拓扑编辑器。

## 6. MVP 数据范围

### 内置 CI 类型

```text
data_center
rack
physical_server
virtual_machine
network_device
ip_address
application
database
middleware
kubernetes_cluster
kubernetes_node
kubernetes_workload
```

每种类型只提供一组开发测试真正需要的字段，例如：

- 通用：`name`、`status`、`environment`、`owner`、`tags`；
- 服务器：`hostname`、`serial_number`、`vendor`、`model`、`cpu`、`memory`、`management_ip`；
- 虚拟机：`uuid`、`hostname`、`cpu`、`memory`、`ip`、`power_state`；
- 网络设备：`hostname`、`serial_number`、`vendor`、`model`、`management_ip`；
- 应用：`code`、`name`、`owner`、`environment`、`criticality`；
- 数据库和中间件：`engine/type`、`version`、`host`、`port`、`environment`；
- Kubernetes：集群、节点、工作负载的基础配置字段。

不追求复制任何厂商完整 API。

### 核心关系

```text
contains
mounted_in
runs_on
hosted_on
belongs_to
depends_on
uses
has_ip
```

### 自定义类型

自定义类型不属于核心 P0。只有不影响 MVP 进度时，才允许支持简单的 JSON 兼容字段定义；不得为此建设脚本、表达式语言或插件系统。

## 7. MVP 成功判据

Issue #1 实现完成后，用户应当能够：

1. 通过一条自然语言获得有效规格；
2. 在无 AI 时从模板生成；
3. 生成至少 10,000 条记录并通过分页查看；
4. 获得关系完整、引用不悬空的数据；
5. 使用 Bearer Token 查询 CI 与关系；
6. 按类型、关键字和分页读取；
7. 下载 JSON、CSV，以及实现成本可控时的 XLSX；
8. 把 API 地址直接交给 DLR 使用。

这些目前都是验收目标，尚未完成。

## 8. 明确不做

MVP 不建设：

- 基础设施协议模拟；
- 真实服务容器编排；
- Lab Agent；
- Truth Graph、版本、编译和运行平台；
- 生命周期、故障注入和网络混沌；
- 采集结果自动验证平台；
- 远程执行和分布式调度；
- 通用导入器和插件市场；
- 完整身份系统、组织、租户和 RBAC；
- 任意脚本或自定义代码执行；
- 拖拽式拓扑建模；
- 生产数字孪生。

这些能力必须由真实使用证明价值后再单独立项。

## 9. 产品约束

- 一个 Docker 服务即可启动；
- 默认使用 SQLite；
- 使用一个环境变量 API Key；
- AI Provider 采用 OpenAI-compatible 配置；
- UI 页面少、主路径短；
- 代码优先可读和可改，不为未来假设提前抽象；
- 完成 MVP 后先实际接入 DLR，再决定下一步。

## 10. 当前路线

- [Issue #1](https://github.com/john-ops-lab/InfraSourceLab/issues/1)：MVP 设计已整理，**尚未开始开发**；
- [Issue #2](https://github.com/john-ops-lab/InfraSourceLab/issues/2)：可选增强设计，**必须等待 #1 真正实现和验证后再决定是否开发**；
- Issues #3～#8：已关闭为“不计划实施”。
