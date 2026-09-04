# InfraSourceLab 精简架构设计

> **状态：现役架构基线。**
>
> 本文描述 `main` 当前采用的整体架构。实际实现与验证状态见 [`status.md`](status.md)。

## 1. 架构目标

首版架构只为以下链路服务：

```text
自然语言或模板
       ↓
经过校验的 GenerationSpec
       ↓
确定性本地生成器
       ↓
数据集：CI 记录 + CI 关系
       ↓
带认证的 REST API / 文件导出
```

判断标准不是“未来扩展是否完美”，而是：

- 能否快速实现；
- 是否容易运行和修改；
- 是否方便外部审查；
- 是否能够立即供 CMDB、数据导入程序和测试脚本使用。

## 2. 总体架构

```text
┌───────────────────────────────────────┐
│ React 前端                            │
│ shadcn/ui + Tailwind CSS              │
│                                       │
│ 创建 / 数据集 / 数据集详情            │
│ API 与导出 / 可选简单拓扑             │
└──────────────────┬────────────────────┘
                   │ HTTP / JSON
                   ▼
┌───────────────────────────────────────┐
│ FastAPI 单体应用                      │
│                                       │
│ AI 规格服务                           │
│ GenerationSpec 校验                   │
│ 确定性数据生成器                      │
│ 数据集增删查与分页查询                │
│ Bearer Token 认证                     │
│ 文件导出                              │
└───────────────┬───────────────────────┘
                │ SQLAlchemy
                ▼
┌───────────────────────────────────────┐
│ SQLite                                │
│ datasets / ci_records / ci_relations  │
└───────────────────────────────────────┘
```

正常部署目标是一个应用容器和一个持久化目录。

首版不存在：独立控制节点、Lab Agent、Worker、消息队列、PostgreSQL 集群或运行时容器编排。

## 3. 建议后端模块

```text
backend/app/
  api/          路由、分页和错误响应
  auth/         Bearer Token 校验
  ai/           自然语言转 GenerationSpec
  specs/        Pydantic 模型和语义校验
  generators/   CI 字段与关系生成
  datasets/     持久化和查询
  exports/      JSON、CSV、可选 XLSX
  db/           SQLAlchemy 与 SQLite
```

这是建议结构，不是已经创建的目录。

不得为未来假设提前建立空的编译器、代理、真值版本、验证器或驱动框架。

## 4. AI 与生成器边界

### AI 层

```text
自然语言
  ↓
GenerationSpec 建议
```

AI 不负责：

- 逐条生成完整数据集；
- 直接写数据库；
- 执行代码或命令；
- 操作 Docker；
- 在每次查询时临时生成响应。

### 本地生成层

```text
用户确认的规格 + seed + 生成器版本
  ↓
CI 记录
  ↓
CI 关系
  ↓
完整性校验
  ↓
持久化数据集
```

生成器负责重复性、关系完整性和数量摘要。

## 5. 数据模型

### 数据集

建议字段：

```text
id
name
description
prompt
generation_spec_json
seed
generator_version
record_count
relation_count
warnings_json
created_at
```

### CI 记录

```text
id                  数据库内部主键
ci_id               数据集内稳定标识
dataset_id
type
name
attributes_json
tags_json
search_text          受控搜索字段的小写聚合文本
```

建议唯一约束：

```text
(dataset_id, ci_id)
```

建议索引：

```text
(dataset_id, type)
(dataset_id, name)
```

`search_text` 只聚合以下白名单字段中存在的值：

```text
ci_id
name
hostname
ip_address
management_ip
serial_number
code
```

它用于万级规模下的简单包含搜索，不承诺普通 B-Tree 索引优化 `%关键字%` 查询，也不引入 FTS5。

### CI 关系

```text
id
dataset_id
relation_id
type
from_ci_id
to_ci_id
attributes_json
```

发布数据集前必须校验 `from_ci_id` 和 `to_ci_id` 都存在。

不允许重复边：相同 `(类型, 起点, 终点)` 的关系在同一数据集中只保留一条。

建议唯一约束：

```text
(dataset_id, type, from_ci_id, to_ci_id)
```

MVP 不需要：场景修订、编译清单、运行记录、真值版本、来源投影、观察结果或验证报告。

## 6. 固定 API 边界

### 健康检查

```text
GET /health
```

### 模板与 AI 规格

```text
GET  /api/v1/templates
POST /api/v1/specs/from-prompt
```

`POST /api/v1/specs/from-prompt` 只执行：

```text
自然语言
→ AI 调用
→ JSON 解析
→ GenerationSpec 校验与规范化
→ 返回 spec、中文说明和 warnings
```

它不生成或保存数据集。AI 未配置时返回可操作错误，模板接口仍可正常使用。

### 数据集创建

```text
POST /api/v1/datasets
```

该接口只接收用户最终确认后的 `GenerationSpec`。AI 建议和内置模板都通过同一个接口创建数据集，不提供同时接受 prompt 与 spec 的混合接口，也不使用 `POST /api/v1/datasets/generate`。

### 数据集

```text
GET    /api/v1/datasets
GET    /api/v1/datasets/{id}
DELETE /api/v1/datasets/{id}
GET    /api/v1/datasets/{id}/summary
```

### CI

```text
GET /api/v1/datasets/{id}/cis
GET /api/v1/datasets/{id}/cis/{ci_id}
```

计划支持：类型、`q`、页码、每页数量。

### 关系

```text
GET /api/v1/datasets/{id}/relations
```

计划支持：关系类型、起点、终点、页码、每页数量。

### 导出

```text
GET /api/v1/datasets/{id}/export?format=json|csv|xlsx
```

XLSX 属于低优先级，不得阻塞 JSON、CSV 和认证 API 闭环。

## 7. 认证设计

```text
ISL_API_KEY
```

所有 `/api/v1/*` 数据、规格、模板和变更接口要求：

```http
Authorization: Bearer <key>
```

首版只计划实现：

- 从环境变量读取；
- 安全字符串比较；
- 错误时返回 401；
- 日志不打印 Key；
- 默认只对本机发布端口。

不建设用户系统、Session、OAuth、SSO 或 RBAC。

前端可以让用户在当前浏览器会话录入 API Key，并附加到请求头。

## 8. AI Provider 设计

计划使用：

```text
ISL_AI_BASE_URL
ISL_AI_API_KEY
ISL_AI_MODEL
ISL_AI_TIMEOUT_SECONDS
```

Provider 接口保持很薄：

```python
class AIProvider(Protocol):
    async def create_generation_spec(self, request: PromptRequest) -> GenerationSpecProposal: ...
```

需要：

- OpenAI-compatible HTTP；
- JSON 或结构化输出；
- 超时；
- 输入和响应大小限制；
- 解析和校验诊断；
- 测试用假 Provider。

不需要工具调用、Agent、长期会话、知识库、附件或模型市场。

## 9. 数据生成与关系覆盖

每种内置 CI 类型对应一个小型字段生成器或模板：

```text
physical_server → 服务器字段生成器
virtual_machine → 虚拟机字段生成器
application → 应用字段生成器
```

字段使用受 seed 控制的伪随机数和 Faker/Mimesis 等成熟库。

关系规则固定使用：

```text
strategy = balanced | random_seeded
coverage = from | to
```

- `coverage=from`：每个起点 CI 生成一条出边，目标按策略选择；
- `coverage=to`：每个终点 CI 生成一条入边，起点按策略选择；
- `balanced`：尽量平均分配被选择一侧；
- `random_seeded`：根据 seed 可重复地选择被连接对象。

相同规范化 RelationSpec 在规格校验阶段直接拒绝。不同规则偶然生成相同边时，生成器去重，并在数据集响应的 `warnings` 中说明；数据库唯一约束作为最终保护。

## 10. 事务、耗时与失败

一次数据集生成计划按以下顺序执行：

```text
校验规格
→ 生成记录和关系
→ 校验关系完整性与去重
→ 在一个事务或明确边界的批次中持久化
→ 数据集变为可读取状态
```

失败时不得留下“看起来成功但数据不完整”的数据集。

万级规模优先使用批量插入，避免逐条提交。

接口耗时与超时边界：

- AI 规格接口耗时由 `ISL_AI_TIMEOUT_SECONDS` 约束；
- 数据集生成接口是纯本地计算，不调用外部服务，耗时由规格数量上限约束，万级规模目标数秒内完成；
- 首版不为生成接口单独设置超时参数；若实测耗时超出预期，按后台任务单独设计，不在 MVP 内解决。

首版不引入队列或 Worker。只有真实测量证明同步请求不够用时，才单独设计后台任务。

## 11. SQLite 模式版本边界

MVP 不建设完整数据库迁移链，但必须避免静默打开未知模式：

- 使用 SQLite `PRAGMA user_version = 1` 记录首版模式；
- 新建空数据库时创建表并将版本设置为 1；
- 版本为 1 时正常启动；
- 发现其他非零版本时停止启动，输出明确中文错误，提示用户先备份 SQLite 文件，再删除后重建；
- 不在 Issue #2 中混入数据库迁移；只有未来真实版本升级需要保留旧数据时，才单独建立迁移 Issue。

## 12. 前端架构

当前页面：

```text
/create
/datasets
/datasets/:id
/settings
```

Issue #1 的创建页采用一次性“提示词 → 结构化规格建议 → 用户调整 → 创建数据集”，使用 shadcn/ui 轻量组件，不引入多轮聊天、聊天历史或会话管理。未来真实需求需要多轮交互时再评估 assistant-ui。

数据集详情通过后端分页读取，不把整个数据集一次加载到浏览器。

前端不维护另一套生成规则；后端 `GenerationSpec` 是唯一权威模型。

## 13. 部署目标

计划用户路径：

```bash
cp .env.example .env
docker compose up --build
```

目标形态：

```text
一个应用容器
一个挂载的数据目录
一个 SQLite 文件
不使用 Docker socket
不要求外部数据库
```

开发模式可以分开运行 Vite 和 FastAPI。

## 14. 适度安全

必须覆盖的风险：

- API Key；
- 默认只对本机开放；
- 请求、规格、数量和分页上限；
- Pydantic/JSON 安全校验；
- `q` 中 `%`、`_` 等通配符的转义；
- 导出文件名和路径安全；
- AI Key 只留在服务端；
- 日志不包含秘密；
- 禁止任意代码执行。

不建设多租户隔离、企业 SSO、Secret Manager 集群、Docker 沙箱或 mTLS Agent 协议。

## 15. 未来扩展原则

只有真实使用证明需要时，才单独增加：

- 一个具体协议适配器；
- 一个具体导入格式；
- PostgreSQL；
- 后台生成任务；
- 更大数据规模；
- 更复杂拓扑；
- 数据库自动迁移链；
- 多轮 AI 创建交互。

扩展必须围绕现有的 `GenerationSpec → Dataset → API` 增量增加，不能重新把项目变成平台。
