# InfraSourceLab 精简路线图

> **当前状态：设计阶段。Issue #1 尚未开始实现，Issue #2 尚未启动。**

## 1. 路线原则

先完成一个真正可用的工具，再根据真实使用补功能。

```text
第一阶段：Issue #1 MVP
自然语言或模板
→ GenerationSpec
→ CI 与关系
→ Bearer Token REST API
→ 文件导出

          ↓ DLR 或 CMDB 实际使用

第二阶段：Issue #2 可选增强
简单拓扑
+ 基础数据质量
```

不再采用“先设计完整平台，再逐步实现”的路线。

## 2. 第一阶段：MVP

对应：[Issue #1](https://github.com/john-ops-lab/InfraSourceLab/issues/1)

当前状态：

```text
需求已整理
架构已设计
验收标准已定义
代码尚未开始
```

### 2.1 创建

计划交付：

- 自然语言输入；
- OpenAI-compatible Provider；
- AI 转经过校验的 `GenerationSpec`；
- 内置模板备用入口；
- 简单修改类型数量和 seed。

### 2.2 数据

计划交付：

- 至少 12 个常用 CMDB CI 类型；
- 常用字段；
- 至少 8 类关系；
- 稳定 ID；
- 相同规格和 seed 可重复；
- 万级数据冒烟测试；
- SQLite 持久化。

### 2.3 接口

计划交付：

- 一个环境变量 API Key；
- Bearer Token；
- 数据集、CI、关系和摘要接口；
- 类型、搜索和分页筛选；
- FastAPI OpenAPI；
- 可复制的 curl。

### 2.4 导出

优先级：

```text
P0：JSON、CSV
P1：XLSX
```

不得为了 XLSX 延迟核心闭环。

### 2.5 界面

计划页面：

- 创建；
- 数据集；
- 数据集详情；
- CI 数据；
- 关系；
- API 与导出；
- API Key 和 Provider 状态。

### 2.6 工程

计划交付：

- 一个 Docker 服务；
- SQLite 数据卷；
- 后端和前端测试；
- Playwright；
- Chrome DevTools MCP 真实浏览器验证。

### 2.7 第一阶段完成后

不是继续追加功能，而是：

1. 使用 curl 调用 API；
2. 使用 DLR HTTP 适配器采集；
3. 尝试导入后续 CMDB；
4. 记录真实缺口；
5. 进行外部代码审查；
6. 修复严重和重要问题。

## 3. 第二阶段：可选增强

对应：[Issue #2](https://github.com/john-ops-lab/InfraSourceLab/issues/2)

只有 Issue #1 已经真正实现、经过外部审查并完成实际使用后，才决定是否启动。

### 3.1 简单拓扑

- 从已有 CI 和关系绘图；
- 默认限制或抽样可见节点；
- 支持类型、关系和文字筛选；
- 支持节点详情；
- 支持适配视图、缩放和平移；
- 不使用图数据库；
- 不提供拖拽编辑；
- 不承诺万级节点全量渲染。

### 3.2 基础数据质量

只考虑：

```text
missing_field
case_drift
duplicate_record
wrong_value
```

这些是内部规则标识。规则必须可重复，不建设通用规则引擎。

### 3.3 DLR 示例

计划编写一份简明示例：

```text
InfraSourceLab Bearer Token API
→ DLR HTTP 适配器
→ 输出结果
```

不建设验证平台。

## 4. 未来方向

以下不属于当前待办。只有出现具体真实需求时才新建立项：

- 单个具体协议模拟器；
- 单个真实服务适配器；
- 单个导入格式；
- PostgreSQL；
- 后台生成任务；
- 更大数据规模；
- 多 API Key；
- 公网认证；
- 更复杂拓扑。

新增前必须回答：

1. MVP 是否已经在实际使用？
2. 哪个具体用户流程走不通？
3. 通用 REST 或文件为什么不够？
4. 能否用一个小功能解决？
5. 是否已有成熟轮子？
6. 是否会把项目重新变成平台？

## 5. 已关闭的平台化方向

Issues #3～#8 已关闭为“不计划实施”：

- 生命周期、故障注入与验证平台；
- 多协议模拟器套件；
- 云与管理协议模拟器套件；
- 企业真实服务与录制回放平台；
- 高级 AI 导入与工具平台；
- 远程 Agent、大规模运行和发布平台。

这些关闭是优先级纠正，不代表相关技术永远没有价值。

## 6. 范围控制

### Issue #1 允许

```text
AI 规格生成
本地数据生成器
SQLite
Bearer Token API
JSON / CSV
小型界面
测试
```

### Issue #1 不允许

```text
顺便做拓扑
顺便接入 SNMP 或 vCenter
顺便加入 PostgreSQL 或 Redis
顺便建设用户系统
顺便建设任务和 Worker
顺便建设验证器
顺便建设插件或通用导入框架
```

## 7. 完成判断

只有新用户可以从 GitHub `main` 重新拉取代码，并真实完成以下路径，才能认为 MVP 已实现：

```text
配置 API Key
→ 输入提示词或选择模板
→ 生成数据
→ 通过 REST 读取
→ 下载文件
```

当前尚未达到这一状态。

## 8. 审查顺序

```text
实现 Issue #1
→ 外部审查
→ DLR 实际使用
→ 修复严重问题
→ 关闭 Issue #1
→ 决定 Issue #2 是否仍有必要
```

不得在 Issue #1 审查前启动 Issue #2。
