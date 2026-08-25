# InfraSourceLab 精简路线图

## 1. 路线原则

先完成一个能用的工具，再根据真实使用补功能。

```text
#1 MVP
Prompt / Template
→ GenerationSpec
→ CI + Relations
→ Bearer REST API
→ Export

          ↓ actual DLR/CMDB use

#2 Optional
Simple Topology
+ Basic Data Quality
```

不再按“先设计完整平台、再逐步实现”的方式推进。

---

# Phase 1 — MVP

Issue: [#1](https://github.com/john-ops-lab/InfraSourceLab/issues/1)

## 必须交付

### 创建

- 自然语言输入；
- OpenAI-compatible provider；
- AI → validated GenerationSpec；
- 内置模板 fallback；
- 简单修改 type count / seed。

### 数据

- 至少 12 个常用 CMDB CI 类型；
- 常用字段；
- 至少 8 类关系；
- 稳定 ID；
- 同 spec + seed 可重复；
- 10k smoke；
- SQLite 持久化。

### 接口

- 一个环境变量 API Key；
- Bearer Token；
- dataset/CI/relation/summary APIs；
- type/search/pagination filters；
- FastAPI OpenAPI；
- copyable curl。

### 导出

- JSON；
- CSV；
- XLSX。

### UI

- Create；
- Datasets；
- Dataset Detail；
- CI Data；
- Relations；
- API & Export；
- Settings/API key。

### 工程

- one Docker service；
- SQLite volume；
- backend/frontend tests；
- Playwright；
- Chrome DevTools MCP。

## 完成后立即做什么

不是继续加功能，而是：

1. 用 curl 调 API；
2. 用 DLR HTTP Adapter 采集；
3. 尝试导入后续 CMDB；
4. 记录真正不够用的地方；
5. 外部 Review。

---

# Phase 2 — 可选增强

Issue: [#2](https://github.com/john-ops-lab/InfraSourceLab/issues/2)

只有 #1 已通过并实际使用后才开始。

## 2.1 简单拓扑

- 从已有 CI/关系绘图；
- 默认限制/抽样可见节点；
- type/relation/search filters；
- node detail；
- zoom/pan/fit；
- 无图数据库；
- 无拖拽编辑；
- 无万级全量图承诺。

## 2.2 基础数据质量

只增加：

```text
missing_field
case_drift
duplicate_record
wrong_value
```

保持 deterministic，不建设规则引擎。

## 2.3 DLR 示例

写一份简明示例：

```text
ISL Bearer API → DLR HTTP Adapter → output
```

不做 Verifier 平台。

---

# Future — 只有真实需求才新建立项

以下不属于当前 backlog：

- 单个具体协议模拟器；
- 单个真实服务 Adapter；
- 单个导入格式；
- PostgreSQL；
- 后台 Job；
- 更大规模；
- 多 API Key；
- 公网认证；
- 更复杂拓扑。

未来新增前必须回答：

1. MVP 已经在用吗？
2. 哪个具体用户流程走不通？
3. 通用 REST/文件为什么不够？
4. 能否用一个小功能解决？
5. 是否已有成熟轮子？
6. 是否会把项目重新变成平台？

---

# 已关闭的平台化方向

Issues #3～#8 已关闭为 `not planned`：

- Lifecycle/Fault/Verifier；
- 多协议模拟器 Pack；
- 云与管理协议 Pack；
- 企业真实服务/Replay Pack；
- 高级 AI Importer/Tools；
- Remote Agent/Scale/GC 平台。

这些关闭不是能力否定，而是优先级纠正。

---

# 时间与范围控制

## #1 允许

```text
AI spec
local generator
SQLite
Bearer API
exports
small UI
tests
```

## #1 不允许

```text
“顺便”做拓扑
“顺便”接 SNMP/vCenter
“顺便”加 Postgres/Redis
“顺便”做用户系统
“顺便”做 jobs/workers
“顺便”做 verifier
“顺便”做 plugin/import framework
```

## 完成判断

只要一个新用户可以在本地：

```text
配置 API Key
→ 输入 prompt
→ 生成数据
→ 通过 REST 读取
→ 下载文件
```

就已达到 MVP 目标。

---

# Review 顺序

```text
#1 implement
→ external review
→ real DLR use
→ fix critical gaps
→ close #1
→ decide whether #2 is still needed
```

不要在 #1 Review 前启动 #2。