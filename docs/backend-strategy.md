# 生成与接口策略

> **状态：设计阶段，尚未实现。**
>
> 本文中的模块、接口、测试和部署方式均是 Issue #1 的实现方案，不代表代码已经存在。

## 1. 当前决策

InfraSourceLab MVP 不模拟 vCenter、SNMP、Kubernetes、Redfish、云 API 或数据库协议。

它计划生成统一的 CMDB 配置数据，并通过以下方式提供给外部系统：

```text
带认证的 REST API
JSON
CSV
可选 XLSX
```

这条路径最快满足 CMDB 开发、数据采集、导入和接口测试需求，也能避免项目过早变成多协议运行平台。

## 2. AI 与生成器分工

### AI 负责

```text
用户意图
→ CI 类型
→ 数量
→ 关系
→ 简单字段偏好
→ GenerationSpec
```

### AI 不负责

- 逐条生成完整记录；
- 直接写数据库；
- 决定或执行任意 Python、JavaScript 或命令；
- 操作容器；
- 在每次查询时临时编造响应。

### 本地生成器负责

- 生成稳定 ID；
- 生成合理字段；
- 分配 IP、序列号和 UUID；
- 建立关系；
- 校验引用完整性；
- 批量持久化；
- 导出文件。

## 3. 生成器组织

简单注册表即可：

```python
GENERATORS = {
    "data_center": DataCenterGenerator(),
    "rack": RackGenerator(),
    "physical_server": PhysicalServerGenerator(),
    "virtual_machine": VirtualMachineGenerator(),
    "application": ApplicationGenerator(),
}
```

每个生成器只负责：

- 明确支持的覆盖参数；
- 记录字段；
- 稳定 ID 前缀；
- 必要的局部校验。

不建设动态插件加载、WASM、容器驱动或远程注册中心。

## 4. 字段生成

优先使用成熟库和少量自有规则：

```text
Mimesis 或 Faker   → 名称、公司、版本和基础值
Python ipaddress   → IP 分配
uuid5 / hashlib    → 可重复 UUID 和摘要
小型维护列表       → 厂商、型号、状态和环境
```

约束：

- 固定依赖版本；
- 使用局部 seed 和伪随机数生成器；
- 生成顺序稳定；
- 不引入机器学习合成框架。

## 5. 关系生成

关系必须来自规格，而不是在生成后随机猜测。

示例：

```text
2 个数据中心包含 30 个机柜
200 台物理服务器安装在机柜中
800 台虚拟机运行在物理服务器上
80 个应用部署在虚拟机上
15 个数据库被应用使用
```

内部策略可以保持简单：

```text
balanced       尽量平均分配
round_robin    按顺序轮转
random_seeded  基于 seed 的可重复随机连接
one_to_many    一对多连接
```

生成后必须检查：

- 起点和终点都存在；
- 关系类型合法；
- 没有意外悬空；
- 重复边符合规则；
- 数量摘要正确。

## 6. 数据规模

MVP 目标：

```text
常用规模：100～5,000 个 CI
验收规模：10,000 个 CI 加合理关系
```

计划采用：

- 批量写入；
- API 分页；
- UI 服务端分页；
- 简单可行时采用分批或流式导出；
- 不一次渲染全部记录。

不为十万或百万级数据提前引入 Worker、队列、分布式存储或图数据库。

## 7. REST API 设计

稳定资源：

```text
datasets
cis
relations
summary
export
```

建议分页响应：

```json
{
  "items": [],
  "page": 1,
  "page_size": 100,
  "total": 1000
}
```

CI 查询计划支持：

```text
type
q
page
page_size
```

`q` 首版只匹配 ID、名称和有限常用属性，不建设通用 JSON 查询语言。

关系查询计划支持：

```text
type
from_id
to_id
page
page_size
```

FastAPI 自动生成 OpenAPI。产品界面计划提供：

- 基础地址；
- Bearer 请求头示例；
- 当前数据集 ID；
- 可复制的 curl；
- 常用分页和筛选示例。

## 8. 认证策略

首版只使用：

```text
ISL_API_KEY
Authorization: Bearer <key>
```

它足以覆盖本地或可信内网开发场景。

不实现：

- API Key 增删改查；
- 多用户；
- 权限范围；
- OAuth、OIDC 或 SSO；
- 刷新令牌。

如果未来需要公网部署，再单独设计认证，不拖慢本地 MVP。

## 9. 导出策略

### JSON

```json
{
  "dataset": {},
  "cis": [],
  "relations": []
}
```

### CSV

推荐 ZIP 或多个 CSV：

```text
summary.csv
ci_<type>.csv
relations.csv
```

如果首版采用一个扁平 CI CSV，必须说明 `attributes` 的编码方式。

### XLSX

建议工作表：

```text
摘要
CI_<type>
关系
```

使用成熟库，不自行实现文件格式。XLSX 是低优先级，不能阻塞认证 API、JSON 和 CSV。

## 10. 模板与无 AI 入口

AI 未配置时计划提供少量模板：

```text
小型数据中心
中型企业
应用与数据库
Kubernetes 基础环境
```

模板本质上也是 `GenerationSpec`。

这样可以保证：

- 没有模型也能使用；
- 自动化测试不依赖付费 API；
- 用户能快速理解规格结构。

## 11. 什么时候才增加新数据源形态

MVP 真正实现并通过 CMDB、数据导入程序或测试脚本实际使用后，再逐项回答：

1. 通用 REST 或文件是否已经足够？
2. 具体 CMDB 数据源是否依赖真实协议行为？
3. 是否已有成熟模拟器可以直接利用？
4. 这个需求是否会反复出现？
5. 能否只增加一个很薄的单一能力，而不是平台？

只有答案支持时，才新建一个范围明确的 Issue。

## 12. 历史调研的定位

`docs/research/` 中对 Microcks、vcsim、KWOK、snmpsim 等项目的调研只用于未来选型：

- 不属于当前待开发范围；
- 不作为 Issue #1 的验收条件；
- 开发者不得因为看见调研就顺手接入；
- 只有出现具体需求时才重新核对最新版本、维护状态和许可证。

## 13. 停止规则

当 Issue #1 能真实完成以下闭环时就停止扩展，进入 CMDB 实际使用和外部审查：

```text
自然语言或模板
→ 规格
→ 数据集
→ Bearer Token API
→ 导出
```

不得在同一开发波次中追加拓扑、协议模拟、故障、验证、导入器、远程运行或企业认证。
