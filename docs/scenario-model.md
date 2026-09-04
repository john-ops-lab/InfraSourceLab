# GenerationSpec 与数据模型设计

> **状态：现役数据契约。**
>
> 文件名保留为 `scenario-model.md`，项目不建设复杂场景 DSL。本文定义 AI 与本地生成器之间的小型结构化合同。

## 1. 为什么需要 GenerationSpec

不能让大模型直接生成数千条 CI，原因包括：

- 速度慢；
- 成本高；
- 容易遗漏关系或产生重复 ID；
- 难以重复生成；
- 很难严格校验。

当前流程：

```text
自然语言
  ↓ AI
GenerationSpec
  ↓ 本地确定性生成器
CI 记录 + CI 关系
```

普通用户主要通过一次性 AI 规格建议或简单表单创建规格，不需要手写 JSON 或 YAML。

## 2. 最小结构

建议 JSON：

```json
{
  "name": "medium-enterprise",
  "description": "两个数据中心及其计算资源和应用",
  "seed": 20260825,
  "ci_types": [
    {"type": "data_center", "count": 2},
    {"type": "rack", "count": 30},
    {"type": "physical_server", "count": 200},
    {"type": "virtual_machine", "count": 800},
    {"type": "application", "count": 80}
  ],
  "relations": [
    {
      "type": "contains",
      "from_type": "data_center",
      "to_type": "rack",
      "strategy": "balanced",
      "coverage": "to"
    },
    {
      "type": "mounted_in",
      "from_type": "physical_server",
      "to_type": "rack",
      "strategy": "balanced",
      "coverage": "from"
    },
    {
      "type": "runs_on",
      "from_type": "virtual_machine",
      "to_type": "physical_server",
      "strategy": "balanced",
      "coverage": "from"
    }
  ]
}
```

## 3. 顶层字段

| 字段 | 必填 | 说明 |
|---|---:|---|
| `name` | 是 | 数据集名称 |
| `description` | 否 | 简短说明 |
| `seed` | 是 | 确定性生成种子 |
| `ci_types` | 是 | 需要生成的 CI 类型和数量 |
| `relations` | 否 | 类型间关系规则 |
| `metadata` | 否 | 非执行性的备注信息 |

不得加入：

```text
Docker 镜像
命令行指令
宿主机挂载路径
工作流有向图
时间线
故障脚本
运行时接口
```

## 4. CITypeSpec

```json
{
  "type": "physical_server",
  "count": 200,
  "overrides": {}
}
```

规则：

- `type` 必须是内置类型或合法的简单自定义类型；
- `count` 不得为负数；
- 每种类型和总数量都有可配置上限；
- `overrides` 只接受模板明确支持的简单参数；
- 未知覆盖参数必须返回诊断，不能静默忽略。

### 内置类型

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

## 5. 内置字段建议

### 通用字段

```text
name
status
environment
owner
description
tags
created_at_like_test_value
```

时间字段是生成的业务测试值，不能使用真实系统创建时间影响确定性。

### 物理服务器

```text
hostname
serial_number
vendor
model
cpu_cores
memory_gib
management_ip
os_name
os_version
```

### 虚拟机

```text
hostname
uuid
cpu_cores
memory_gib
ip_address
power_state
os_name
```

### 网络设备

```text
hostname
serial_number
vendor
model
device_role
management_ip
software_version
```

### 应用

```text
code
name
owner
environment
criticality
lifecycle_status
```

### 数据库

```text
name
engine
version
host
port
environment
```

### 中间件

```text
name
type
version
host
port
environment
```

### Kubernetes

只提供配置数据测试需要的简单字段，不复制完整 Kubernetes API 对象。

## 6. 自定义类型

自定义类型属于低优先级。简单示例：

```json
{
  "type": "custom",
  "name": "storage_array",
  "count": 10,
  "fields": {
    "vendor": {"kind": "choice", "values": ["A", "B"]},
    "capacity_tib": {"kind": "integer", "min": 50, "max": 500},
    "serial_number": {"kind": "pattern", "value": "ST-{index:05d}"}
  }
}
```

最多只允许有限字段生成器：

```text
constant
pattern
choice
integer
boolean
ipv4
hostname
uuid
```

这些是内部类型标识。不得执行任意 Python、JavaScript、Jinja 或表达式。

如果自定义类型会拖慢 MVP，就先不实现，且不得为它建设插件系统。

## 7. RelationSpec

```json
{
  "type": "runs_on",
  "from_type": "virtual_machine",
  "to_type": "physical_server",
  "strategy": "balanced",
  "coverage": "from"
}
```

字段含义：

| 字段 | 必填 | 说明 |
|---|---:|---|
| `type` | 是 | 关系类型 |
| `from_type` | 是 | 起点 CI 类型 |
| `to_type` | 是 | 终点 CI 类型 |
| `strategy` | 是 | 连接对象的选择策略 |
| `coverage` | 是 | 必须被完整覆盖的一侧 |

### 核心关系类型

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

### 策略

MVP 只保留：

```text
balanced       尽量平均分配被选择的一侧
random_seeded  基于 seed 的可重复随机连接
```

不再使用 `round_robin`、`one_to_many`，因为它们与覆盖方向存在语义重叠，容易造成关系数量歧义。

### 覆盖方向

```text
coverage=from
每个 from_type CI 必须生成一条出边

coverage=to
每个 to_type CI 必须生成一条入边
```

示例：

```text
data_center contains rack
coverage=to
→ 每个 rack 都属于一个 data_center

virtual_machine runs_on physical_server
coverage=from
→ 每个 virtual_machine 都运行在一台 physical_server 上
```

MVP 不表达“每个对象必须连接 2～5 个目标”等复杂基数。未来真实需求出现后再单独扩展。

### 关系校验

- 起点和终点类型必须存在；
- 被连接的两侧数量必须大于零；
- `strategy` 只能是 `balanced` 或 `random_seeded`；
- `coverage` 只能是 `from` 或 `to`；
- 相同规范化 RelationSpec 不允许重复出现；
- `from_id` 和 `to_id` 必须引用当前数据集记录；
- 关系 ID 必须稳定；
- 默认不生成自环；
- 同一数据集中相同的 `(type, from_ci_id, to_ci_id)` 只保留一条。

重复行为：

```text
相同 RelationSpec 重复
→ 规格校验失败

不同规则偶然生成相同边
→ 生成器去重
→ 数据集 warnings 说明
→ 数据库唯一约束最终保护
```

数据库唯一约束：

```text
(dataset_id, type, from_ci_id, to_ci_id)
```

## 8. 确定性

同一组：

```text
规范化 GenerationSpec
+ seed
+ 生成器版本
```

必须产生相同的：

- CI ID；
- 主要字段值；
- 关系端点；
- 排序；
- 不包含导出时间等动态元数据时的导出内容。

推荐 ID：

```text
dc-0001
rack-0001
server-0001
vm-0001
app-0001
relation-000001
```

需要 UUID 字段时，应由 seed 和命名空间派生，而不是使用不可重复的随机 UUID。

## 9. AI 输出合同

建议 AI 响应：

```json
{
  "message": "我计划生成以下数据……",
  "spec": {},
  "warnings": []
}
```

服务端必须重新执行：

```text
解析
→ Pydantic 或 JSON Schema 校验
→ 数量上限校验
→ 类型校验
→ 关系策略和覆盖方向校验
→ 重复 RelationSpec 校验
→ 规格规范化
```

模型声称“有效”不等于规格有效。

校验只覆盖当前风险，不建设复杂审批、修订或三方合并系统。

## 10. 数据记录格式

### CI 记录

```json
{
  "id": "server-0001",
  "type": "physical_server",
  "name": "srv-0001",
  "attributes": {
    "serial_number": "SN00000001",
    "vendor": "ExampleVendor",
    "management_ip": "10.10.0.1"
  },
  "tags": {
    "environment": "production"
  }
}
```

数据库内部可以额外保存 `search_text`，但 API 和导出不必暴露该辅助字段。

### CI 关系

```json
{
  "id": "relation-000001",
  "type": "mounted_in",
  "from_id": "server-0001",
  "to_id": "rack-0004",
  "attributes": {}
}
```

API、数据库和导出围绕这两个简单模型工作。

## 11. 第二阶段数据质量

当前版本支持四种简单、可重复的数据缺陷：

```text
missing_field
case_drift
duplicate_record
wrong_value
```

Issue #1 不得因为这些能力延迟交付。

## 12. 明确不进入模型

- 标准真值与来源投影双层世界；
- 真值版本；
- 编译或运行清单；
- 时间线与故障；
- 协议驱动配置；
- 观察与验证；
- 任意脚本；
- 运行时容器和接口；
- 多租户归属；
- 复杂关系基数语言。

`GenerationSpec` 只是“生成一份数据集”的小合同，不是基础设施描述语言。
