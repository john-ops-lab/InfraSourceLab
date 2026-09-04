# 生成与接口策略

> **状态：现役后端实现策略。**
>
> 本文描述当前模块、接口、测试和部署方式；具体验证状态见 [`status.md`](status.md)。

## 1. 当前决策

MVP 的产品范围和“明确不做”以 [`product.md`](product.md) 为唯一权威，本文不重复。本文只补充一条核心决策：不模拟任何基础设施协议，只生成统一的 CMDB 配置数据，并通过以下方式提供给外部系统：

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
→ 关系覆盖方向
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
- 按覆盖方向建立关系；
- 校验引用完整性并去重；
- 构建受控 `search_text`；
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
coverage=to：确保每个机柜都有一个数据中心

800 台虚拟机运行在 200 台物理服务器上
coverage=from：确保每台虚拟机都有一台宿主机
```

MVP 只保留两个策略和一个覆盖方向：

```text
strategy=balanced       尽量平均分配被选择的一侧
strategy=random_seeded  基于 seed 可重复地选择连接对象
coverage=from           每个起点 CI 生成一条关系
coverage=to             每个终点 CI 生成一条关系
```

不再使用含义重叠或基数不清晰的 `round_robin`、`one_to_many`。MVP 不建设通用基数模型或图规则语言。

生成前和生成后必须检查：

- 起点和终点类型存在且数量大于零；
- `coverage` 合法；
- 相同规范化 RelationSpec 不重复；
- 起点和终点 ID 都存在；
- 默认不产生自环；
- 不存在重复边；
- 数量摘要正确。

重复处理规则：

```text
相同 RelationSpec 重复出现
→ 规格校验失败，要求用户或 AI 修正规格

不同规则偶然生成同一条边
→ 生成阶段去重
→ 在数据集响应 warnings 中说明
→ 数据库唯一约束最终保护
```

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

## 7. 固定 REST API

### 模板和规格

```text
GET  /api/v1/templates
POST /api/v1/specs/from-prompt
```

`POST /api/v1/specs/from-prompt` 只返回经过服务端重新校验和规范化的规格建议：

```json
{
  "message": "我计划生成以下数据……",
  "spec": {},
  "warnings": []
}
```

它不写入数据集。

### 创建数据集

```text
POST /api/v1/datasets
```

只接受用户最终确认的 `GenerationSpec`。AI 规格和内置模板走同一创建接口，不提供 prompt/spec 混合请求。

### 查询资源

```text
GET    /api/v1/datasets
GET    /api/v1/datasets/{id}
DELETE /api/v1/datasets/{id}
GET    /api/v1/datasets/{id}/summary
GET    /api/v1/datasets/{id}/cis
GET    /api/v1/datasets/{id}/cis/{ci_id}
GET    /api/v1/datasets/{id}/relations
GET    /api/v1/datasets/{id}/export?format=json|csv|xlsx
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

## 8. CI 搜索

CI 查询支持：

```text
type
q
page
page_size
```

`q` 只对受控 `search_text` 做不区分大小写的包含搜索。

写入 CI 时，将以下存在的字段规范化为小写文本后聚合：

```text
ci_id
name
hostname
ip_address
management_ip
serial_number
code
```

例如：

```text
vm-0001 vm-prod-001 vm-prod-001.example.internal 10.10.1.20
```

实现要求：

- 不直接对整个 `attributes_json` 做 `LIKE`；
- 不使用 `json_each` 做通用扫描；
- 不引入 SQLite FTS5；
- 对用户输入中的 `%`、`_` 和转义字符进行转义，按普通文字搜索；
- `(dataset_id, type)` 和 `(dataset_id, name)` 保持普通索引；
- 不宣称普通 B-Tree 能优化前置 `%` 的包含查询；
- 若万级规模实测仍慢，再单独优化。

关系查询支持：

```text
type
from_id
to_id
page
page_size
```

FastAPI 自动生成 OpenAPI。产品界面提供基础地址、Bearer 请求头示例、当前数据集 ID、可复制的 curl，以及常用分页和筛选示例。

## 9. 认证策略

认证设计以 [`architecture.md`](architecture.md) 第 7 节为唯一权威：单一环境变量 `ISL_API_KEY`、Bearer Token、安全字符串比较、错误返回 401、日志不打印 Key。首版不建设用户系统、多 Key 或 OAuth，足以覆盖本地或可信内网开发场景。

## 10. 导出策略

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

## 11. 模板与无 AI 入口

AI 未配置时提供少量模板：

```text
小型数据中心
中型企业
应用与数据库
Kubernetes 基础环境
```

模板本质上也是 `GenerationSpec`，由用户确认后提交到 `POST /api/v1/datasets`。

这样可以保证：

- 没有模型也能使用；
- 自动化测试不依赖付费 API；
- 用户能快速理解规格结构。

## 12. 耗时、事务和数据库版本

- AI 规格接口由 `ISL_AI_TIMEOUT_SECONDS` 限时；
- 数据集创建是纯本地计算，不调用外部服务；
- 万级规模目标数秒内完成，首版不增加生成超时参数、队列或 Worker；
- 生成、完整性检查和持久化必须具有清晰事务边界，失败不留下伪成功数据集；
- SQLite 使用 `PRAGMA user_version = 1`；空库自动初始化，未知非零版本明确拒绝启动并提示备份、删除后重建；
- 自动迁移不属于 Issue #2，只有真实版本升级需要保留旧数据时才单独立项。

## 13. 什么时候才增加新数据源形态

MVP 真正实现并通过 CMDB、数据导入程序或测试脚本实际使用后，再逐项回答：

1. 通用 REST 或文件是否已经足够？
2. 具体 CMDB 数据源是否依赖真实协议行为？
3. 是否已有成熟模拟器可以直接利用？
4. 这个需求是否会反复出现？
5. 能否只增加一个很薄的单一能力，而不是平台？

只有答案支持时，才新建一个范围明确的 Issue。

## 14. 历史调研与停止规则

`docs/research/` 只用于未来选型，不属于 Issue #1 验收条件。开发者不得因为看见调研就顺手接入协议模拟器或真实服务。

扩展停止条件以 [`roadmap.md`](roadmap.md) 为唯一权威：Issue #1 完成“自然语言或模板 → 规格 → 数据集 → Bearer Token API → 导出”闭环后停止扩展，进入 CMDB 实际使用和外部审查。
