# GenerationSpec 与数据模型

> 文件名保留为 `scenario-model.md`，但首版不再建设复杂 Scenario DSL。唯一目标是定义 AI 和生成器之间的小型结构化合同。

## 1. 为什么需要 GenerationSpec

不能让大模型直接生成数千条 CI：

- 慢；
- 费用高；
- 容易漏关系和重复 ID；
- 难以重复生成；
- 很难严格校验。

正确流程：

```text
自然语言
  ↓ AI
GenerationSpec
  ↓ local deterministic generator
CI Records + Relations
```

普通用户主要通过 AI 或简单表单创建规格，不需要手写 JSON/YAML。

---

## 2. 最小结构

建议 JSON 结构：

```json
{
  "name": "medium-enterprise",
  "description": "Two data centers with compute and applications",
  "seed": 20260825,
  "ci_types": [
    {
      "type": "data_center",
      "count": 2
    },
    {
      "type": "rack",
      "count": 30
    },
    {
      "type": "physical_server",
      "count": 200,
      "overrides": {
        "environment_weights": {
          "production": 70,
          "test": 20,
          "development": 10
        }
      }
    },
    {
      "type": "virtual_machine",
      "count": 800
    },
    {
      "type": "application",
      "count": 80
    }
  ],
  "relations": [
    {
      "type": "contains",
      "from_type": "data_center",
      "to_type": "rack",
      "strategy": "balanced"
    },
    {
      "type": "mounted_in",
      "from_type": "physical_server",
      "to_type": "rack",
      "strategy": "balanced"
    },
    {
      "type": "runs_on",
      "from_type": "virtual_machine",
      "to_type": "physical_server",
      "strategy": "balanced"
    }
  ]
}
```

---

## 3. 顶层字段

| 字段 | 必填 | 说明 |
|---|---:|---|
| `name` | 是 | 数据集名称 |
| `description` | 否 | 简短说明 |
| `seed` | 是 | 确定性生成种子 |
| `ci_types` | 是 | 需要生成的 CI 类型和数量 |
| `relations` | 否 | 类型间关系规则 |
| `metadata` | 否 | 非执行性的备注信息 |

不加入：

```text
Docker image
shell command
host mount
workflow DAG
timeline
fault
runtime endpoint
```

---

## 4. CITypeSpec

```json
{
  "type": "physical_server",
  "count": 200,
  "overrides": {}
}
```

规则：

- `type` 必须是内置类型或合法 custom type；
- `count >= 0`；
- 每类型和总数量有可配置上限；
- `overrides` 只接受该模板明确支持的简单参数；
- 未知 override 返回诊断，不静默忽略。

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

---

## 5. 内置字段建议

## 通用字段

```text
name
status
environment
owner
description
tags
created_at_like_test_value
```

时间字段是生成的业务测试值，不使用真实系统创建时间来影响确定性。

## physical_server

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

## virtual_machine

```text
hostname
uuid
cpu_cores
memory_gib
ip_address
power_state
os_name
```

## network_device

```text
hostname
serial_number
vendor
model
device_role
management_ip
software_version
```

## application

```text
code
name
owner
environment
criticality
lifecycle_status
```

## database

```text
name
engine
version
host
port
environment
```

## middleware

```text
name
type
version
host
port
environment
```

## Kubernetes

只提供配置数据需要的简单字段，不复制完整 Kubernetes API 对象。

---

## 6. Custom type

简单 custom type 示例：

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

首版只支持有限字段生成器：

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

禁止任意 Python、JavaScript、Jinja 或表达式执行。

如果 custom type 会明显拖慢 MVP，可以先实现内置类型并把 custom type 标为后续小增强，但不得为它建设插件系统。

---

## 7. RelationSpec

```json
{
  "type": "runs_on",
  "from_type": "virtual_machine",
  "to_type": "physical_server",
  "strategy": "balanced"
}
```

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

### 简单策略

```text
balanced          尽量平均分配
round_robin       按顺序轮转
random_seeded     基于 seed 的随机连接
one_to_many       一个 from 对多个 to，数量由简单参数控制
```

不要建立通用图规则语言。

### 关系校验

- from/to 类型必须存在；
- 目标 count 为 0 时拒绝不可能关系；
- from_id/to_id 必须引用当前数据集记录；
- relation ID 稳定；
- 默认不生成自环，除非关系明确允许；
- 同一规则是否允许重复边要明确。

---

## 8. 确定性

同一：

```text
normalized GenerationSpec
+ seed
+ generator version
```

必须产生相同：

- CI ID；
- 主要字段值；
- 关系端点；
- 排序和导出内容（不含导出时间等非确定 metadata）。

推荐 ID：

```text
dc-0001
rack-0001
server-0001
vm-0001
app-0001
relation-000001
```

不使用随机 UUID 作为唯一可复现 ID；需要 UUID 字段时使用 seed/namespace 派生。

---

## 9. AI 输出合同

AI Response 最好包含：

```json
{
  "message": "我将生成……",
  "spec": {},
  "warnings": []
}
```

服务端必须重新：

```text
parse
→ Pydantic/schema validation
→ count limit
→ type validation
→ relation validation
→ normalized spec
```

模型声称“有效”不代表有效。

但校验保持针对当前风险，不建设复杂审批、Revision 或三方合并系统。

---

## 10. 数据记录格式

### CI

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

### Relation

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

---

## 11. 第二阶段数据质量

Issue #2 可增加四种简单 deterministic defect：

```text
missing_field
case_drift
duplicate_record
wrong_value
```

MVP #1 不因这些能力延迟交付。

---

## 12. 明确不进入模型

- canonical Truth 与 Source Projection 双层世界；
- Truth Version；
- Compile/Run Manifest；
- Timeline/Fault；
- Protocol Driver config；
- Observation/Verifier；
- arbitrary scripts；
- runtime containers/endpoints；
- multi-tenant ownership。

GenerationSpec 是“生成一份数据集”的小合同，不是基础设施描述语言。