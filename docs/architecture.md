# InfraSourceLab 精简架构

## 1. 架构目标

首版架构只为这条链路服务：

```text
Prompt / Template
       ↓
Validated GenerationSpec
       ↓
Deterministic Generator
       ↓
Dataset: CI Records + Relations
       ↓
Authenticated REST API / Export
```

判断标准不是“未来扩展是否完美”，而是：能否快速完成、容易运行、容易 Review，并能立即给 DLR 和 CMDB 使用。

---

## 2. 总体架构

```text
┌───────────────────────────────────────┐
│ React Web                             │
│ shadcn/ui + assistant-ui              │
│                                       │
│ Create / Datasets / Dataset Detail    │
│ API & Export / optional Topology      │
└──────────────────┬────────────────────┘
                   │ HTTP/JSON
                   ▼
┌───────────────────────────────────────┐
│ FastAPI Application                   │
│                                       │
│ AI Spec Service                       │
│ GenerationSpec Validation             │
│ Deterministic Data Generator          │
│ Dataset CRUD / Query                  │
│ Bearer Auth                           │
│ Export                                │
└───────────────┬───────────────────────┘
                │ SQLAlchemy
                ▼
┌───────────────────────────────────────┐
│ SQLite                                │
│ datasets / ci_records / ci_relations  │
└───────────────────────────────────────┘
```

正常部署是一个应用容器和一个持久化目录。

不存在独立 Control、Lab Agent、Worker、消息队列、PostgreSQL 集群或运行时容器编排。

---

## 3. 后端模块

建议保持少量清晰模块：

```text
backend/app/
  api/
  auth/
  ai/
  specs/
  generators/
  datasets/
  exports/
  db/
```

### api

FastAPI routes、分页参数、统一错误响应。

### auth

读取 `ISL_API_KEY`，校验 Bearer Token。

### ai

把自然语言转换为结构化 `GenerationSpec`。

### specs

Pydantic model、字段校验、类型和关系引用校验。

### generators

内置 CI 模板、字段生成、关系生成、seed 管理。

### datasets

持久化与查询 CI/关系。

### exports

JSON、CSV、XLSX。

不要建立没有当前职责的 compiler、agent、truth-version、verification 等空模块。

---

## 4. 数据生成边界

### AI 层

AI 只生成小型规格：

```text
prompt
  ↓
GenerationSpec
```

AI 不生成完整数据集，不保存数据库，不执行代码，不操作 Docker。

### 本地生成层

```text
Validated Spec + Seed + Generator Version
  ↓
CI Records
  ↓
Relations
  ↓
Integrity Check
  ↓
Persist Dataset
```

生成器负责重复性和完整性。

---

## 5. 数据模型

## Dataset

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
created_at
```

## CIRecord

```text
id                 database id
ci_id              stable ID inside dataset
dataset_id
type
name
attributes_json
tags_json
```

唯一约束：

```text
(dataset_id, ci_id)
```

常用索引：

```text
(dataset_id, type)
(dataset_id, name)
```

## CIRelation

```text
id
dataset_id
relation_id
type
from_ci_id
to_ci_id
attributes_json
```

生成完成前校验 from/to 均存在。

MVP 不需要：

```text
ScenarioRevision
CompileManifest
LabRun
TruthVersion
SourceProjection
Observation
VerificationReport
```

---

## 6. API 边界

### Health

```text
GET /health
```

### AI/Spec

可以使用一个合并接口，也可以拆分，但产品行为必须清楚：

```text
POST /api/v1/specs/from-prompt
POST /api/v1/datasets
```

或：

```text
POST /api/v1/datasets/generate
```

如果合并，响应/错误仍应区分 AI 规格失败与本地数据生成失败。

### Dataset

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

查询：

```text
type
q
page
page_size
```

### Relations

```text
GET /api/v1/datasets/{id}/relations
```

查询：

```text
type
from_id
to_id
page
page_size
```

### Export

```text
GET /api/v1/datasets/{id}/export?format=json|csv|xlsx
```

---

## 7. 认证

```text
ISL_API_KEY
```

所有 `/api/v1/*` 数据与变更接口要求：

```http
Authorization: Bearer <key>
```

实现保持简单：

- 环境变量读取；
- 安全字符串比较；
- 401；
- 日志不打印 key；
- 默认仅监听 localhost。

首版不存 API Key 表，不做登录用户、Session、OAuth、RBAC。

前端可以让用户在当前浏览器会话录入 API Key，并附到请求头。

---

## 8. AI Provider

环境变量：

```text
ISL_AI_BASE_URL
ISL_AI_API_KEY
ISL_AI_MODEL
ISL_AI_TIMEOUT_SECONDS
```

Provider 接口保持薄：

```python
class AIProvider(Protocol):
    async def create_generation_spec(self, request: PromptRequest) -> GenerationSpec: ...
```

需要：

- OpenAI-compatible HTTP；
- JSON/structured output；
- timeout；
- response size limit；
- parse/validation diagnostics；
- fake provider for tests。

不需要工具调用、Agent、长期会话、知识库、附件或模型市场。

---

## 9. 数据生成策略

每种内置 CI 类型对应一个简单 provider/template：

```text
physical_server → server generator
virtual_machine → VM generator
application → application generator
...
```

字段使用 seed 控制的 PRNG 和 Mimesis/Faker。

关系生成器读取已有对象 ID，按简单策略连接：

```text
balanced
round_robin
random_seeded
one_to_many
```

生成器不需要通用脚本语言。

---

## 10. 事务与失败

一次数据集生成应当：

```text
validate spec
→ generate in memory/batches
→ validate relations
→ persist in one transaction or clearly bounded batches
→ publish dataset as ready
```

失败时不留下“看起来成功但数据不完整”的数据集。

对 10k 规模，优先 bulk insert，避免逐条 commit。

不需要引入队列；先使用同步/异步 HTTP 请求。如果真实测量发现超时，再增加简单 job 状态，不提前建设 Worker 系统。

---

## 11. 前端架构

页面：

```text
/create
/datasets
/datasets/:id
/settings
```

Dataset detail 通过 API 分页，不把整个数据集加载到浏览器。

前端不维护另一套数据生成规则；后端 `GenerationSpec` 是唯一权威模型。

---

## 12. 部署

用户路径：

```bash
cp .env.example .env
docker compose up --build
```

目标：

```text
one app container
one mounted data directory
SQLite file
no Docker socket
no external database requirement
```

开发模式可以分开运行 Vite 与 FastAPI。

---

## 13. 适度安全

必须做：

- API Key；
- localhost default；
- request/spec/count limits；
- safe JSON/Pydantic validation；
- export filename/path safety；
- AI key server-side；
- no secrets in logs；
- no arbitrary execution。

不做：

- 多租户隔离；
- 企业 SSO；
- Secret Manager 集群；
- Docker sandbox；
- mTLS Agent protocol。

---

## 14. 未来扩展原则

只有真实使用证明需要时再增加：

- 一个具体协议 Adapter；
- 一个具体导入格式；
- PostgreSQL；
- 后台生成 Job；
- 更大规模；
- 更复杂拓扑。

扩展应围绕现有 `GenerationSpec → Dataset → API` 增量添加，而不是重新建设平台。