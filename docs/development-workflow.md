# Qoder Go Mode 直接更新主分支的开发与审查流程

> **状态：流程设计，尚未启动开发。**
>
> 当前 `main` 没有产品代码，也没有可供审查的实现范围。只有开发者真正开始 Issue #1 后，本流程才进入执行状态。

## 1. 计划采用的开发方式

InfraSourceLab 计划采用个人快速开发方式：

- 使用一个较大的 MVP Issue；
- 由 Qoder Go Mode 端到端实现；
- 不强制创建 PR；
- 所有验收门槛通过后直接更新 `main`；
- 外部审查使用 `起始提交...结束提交`；
- 严重和重要问题修复后再关闭 Issue。

关键不是增加流程，而是防止 Go Mode 自行扩张产品范围或自行改动已经固定的产品语义。

## 2. 当前权威范围

开发前只读取：

```text
README.md
docs/status.md
docs/product.md
docs/architecture.md
docs/scenario-model.md
docs/backend-strategy.md
docs/frontend-design.md
docs/qoder-frontend-tooling.md
docs/security-and-licensing.md
docs/development-workflow.md
目标 Issue
```

`docs/research/` 是历史调研，不是实现要求。

已关闭的 Issues #3～#8 不得作为待开发清单。

## 3. 不得自行改变的五项实现决策

### 3.1 两步 API

```text
POST /api/v1/specs/from-prompt
→ 只生成并校验 GenerationSpec 建议

POST /api/v1/datasets
→ 只根据用户确认后的 GenerationSpec 创建数据集
```

不得合并为 prompt/spec 混合接口，也不得使用 `POST /api/v1/datasets/generate` 绕过用户确认。

### 3.2 关系覆盖方向

```text
strategy = balanced | random_seeded
coverage = from | to
```

不得自行恢复 `round_robin`、`one_to_many` 或引入复杂基数语言。

### 3.3 CI 搜索

使用白名单字段聚合的 `search_text`，不直接对整个 `attributes_json` 做模糊匹配，不引入 FTS5。用户搜索中的 `%`、`_` 和转义字符必须按普通文字处理。

### 3.4 创建页交互

Issue #1 固定为一次性：

```text
提示词
→ 结构化规格建议
→ 用户调整
→ 创建数据集
```

使用 shadcn/ui 轻量组件，不引入多轮聊天、聊天历史或 assistant-ui。assistant-ui 只在未来真实多轮需求出现后再评估。

### 3.5 SQLite 模式版本

使用 `PRAGMA user_version = 1`。空库自动初始化；未知非零版本明确拒绝启动并提示备份、删除后重建。Issue #1 不建设 Alembic 或自动迁移链，Issue #2 也不承担数据库迁移。

## 4. 前端工具约束

Issue #1 和后续前端功能开发必须遵循 [`docs/qoder-frontend-tooling.md`](qoder-frontend-tooling.md)。

Issue #1 必须真实使用：

- UI Skills：编码前完成主任务、信息层级、尺寸和状态的设计判断；
- shadcn/ui：组件和视觉体系的基础，不引入第二套大型通用组件库；
- Chrome DevTools MCP：真实浏览器验收必过，构建或 Playwright 不能替代；
- Playwright：固化已经验证的稳定主路径。

Issue #1 不引入 assistant-ui。完成报告必须说明未引入的原因是“首版为一次性规格建议，不是多轮对话”，而不是遗漏依赖。

如果 Qoder 当前环境无法直接调用 Chrome DevTools MCP，必须由能够调用它的 Codex、Claude 或其他兼容代理完成最终浏览器检查。在该证据完成前，前端不能标记为“等待审查”。

## 5. 开始开发前

```bash
git checkout main
git pull --ff-only
git status --short
git rev-parse HEAD
```

确认工作区干净后，在 Issue #1 留言：

```text
Issue #1 开始实现。
起始提交：<sha>
```

只有出现这条真实留言，并且随后出现代码提交，项目状态才从“设计阶段”进入“开发中”。

同时确认：

- 已读取 UI Skills；
- 已确定 shadcn/ui 初始化方案；
- 已确认一次性 AI 创建页实现方式；
- 已确认 Chrome DevTools MCP 的调用方式；
- 已确认最终 Playwright 回归路径；
- 已理解两步 API、关系 coverage、search_text 和 `PRAGMA user_version` 的固定语义。

## 6. 给 Qoder 的首要指令

建议使用中文：

```text
请在当前 main 上端到端实现 Issue #1。

InfraSourceLab 是一个精简的单体 CMDB 测试数据生成工具，不是基础设施仿真或编排平台。

必须优先完成：
自然语言或模板 → 经过校验的 GenerationSpec → 用户确认 → 本地确定性生成 CI 与关系 → SQLite → Bearer Token REST API → JSON/CSV → 简单可用界面。

固定接口：
POST /api/v1/specs/from-prompt
POST /api/v1/datasets

固定关系语义：
strategy=balanced|random_seeded
coverage=from|to

固定搜索：
受控 search_text，不直接模糊搜索整个 attributes_json。

固定数据库版本策略：
PRAGMA user_version=1；未知版本提示备份和重建，不做自动迁移。

前端遵循 docs/qoder-frontend-tooling.md：
实际使用 UI Skills、shadcn/ui、Chrome DevTools MCP 和 Playwright。
Issue #1 是一次性提示词到规格建议，不引入 assistant-ui 或多轮聊天。

不要实现已关闭 Issue 或未来平台能力。所有门槛通过前不要更新 main；不需要创建 PR。
```

## 7. Qoder 可以自主决定的内容

在固定产品语义内可以自主决定：

- 文件组织；
- 类和函数命名；
- SQLAlchemy 模型的普通实现细节；
- Pydantic 模型组织；
- shadcn 组件组合；
- 测试拆分；
- 普通错误处理；
- 局部重构；
- 导出库选择；
- Faker 或 Mimesis 的合理分工。

## 8. 不允许自行增加

```text
Lab Agent
Docker socket
强制 PostgreSQL 部署
Redis / Celery / 队列
微服务
编译 / 运行 / 真值版本平台
时间线 / 故障 / Toxiproxy
观察 / 验证平台
协议模拟器
真实服务编排
远程 Agent
RBAC / OAuth / SSO
附件和通用导入框架
图数据库
插件系统
十万级平台优化
多轮聊天和会话管理
自动数据库迁移链
复杂关系基数语言
```

也不要为“未来扩展”创建大量空接口、空目录、抽象工厂或占位页面。

如果实现中发现 Issue #1 无法完成，应报告真实阻塞，不能用新平台掩盖问题。

## 9. 前端开发闭环

```text
读取 UI Skills
→ 明确主用户任务和页面层级
→ 查询并复用 shadcn/ui 组件
→ 实现一次性提示词到规格建议
→ 在真实 Chrome 中通过 Chrome DevTools MCP 操作
→ 检查截图、Console、Network、性能和响应式
→ 修复问题
→ 用 Playwright 固化稳定主路径
```

只通过 `npm run build` 不等于前端完成。

前端完成报告必须能够回答：

- UI Skills 的哪些判断真实改变了布局或交互；
- 使用了哪些 shadcn/ui 组件，哪些控件必须自定义以及原因；
- 为什么 Issue #1 不引入 assistant-ui；
- Chrome DevTools MCP 由哪个代理执行，检查了哪些视口和流程；
- Console、Network、性能和响应式结果；
- 哪些主路径已经进入 Playwright。

## 10. 后端门槛

至少需要：

- `POST /specs/from-prompt` 与 `POST /datasets` 职责分离测试；
- 规格模型和语义校验；
- `coverage=from|to` 的关系数量和覆盖测试；
- 重复 RelationSpec 拒绝测试；
- 偶然重复边去重和 warning 测试；
- 相同规格和 seed 的确定性测试；
- 关系引用完整性测试；
- Bearer Token 正确和错误路径；
- 分页、筛选和 `search_text` 搜索；
- 搜索通配符转义测试；
- JSON 与 CSV 导出一致性；
- 万级数据冒烟测试；
- 生成失败时的事务回滚；
- AI 未配置时的模板路径；
- `PRAGMA user_version` 的空库、版本 1 和未知版本测试。

XLSX、自定义类型和额外模板不得阻塞核心闭环。

## 11. 更新主分支前的门槛

在直接更新 `main` 前必须确认：

1. 当前提交范围内没有未解释的严重或重要问题；
2. 后端测试通过；
3. 前端类型检查、单元测试和构建通过；
4. Playwright 主路径通过；
5. 已实际使用 UI Skills 和 shadcn/ui；
6. Chrome DevTools MCP 已完成真实 Chrome 主流程、截图、Console、Network、性能和响应式检查；
7. 两步 API、coverage、search_text 和数据库版本策略已按文档实现；
8. Docker 或文档规定的本地启动方式可复现；
9. README 和状态文档与真实代码一致；
10. Issue 完成报告准确，不夸大未验证能力。

如果任何门槛未通过，代码可以保留在本地或工作分支，不能声称已经完成。

## 12. 完成报告格式

Issue #1 真正实现后，使用中文记录：

```text
Issue #1 实现完成，等待外部审查。

起始提交：<sha>
结束提交：<sha>

已实现：
- ...

未实现或明确延期：
- ...

关键语义证据：
- 两步 API：...
- Relation coverage：...
- 重复边处理：...
- search_text：...
- PRAGMA user_version：...

前端工具证据：
- UI Skills 关键决定：...
- shadcn/ui 初始化与组件：...
- assistant-ui 未引入及原因：...
- Chrome DevTools MCP 执行代理、版本、视口和结果：...

测试命令与结果：
- ...

浏览器验证：
- 视口：...
- 截图：...
- Console：...
- Network：...
- 性能：...
- 主流程：...

示例数据：
- 提示词：...
- 规格摘要：...
- CI 数量：...
- 关系数量：...

已知限制：
- ...
```

不得在没有真实结束提交和可复现证据时填写“完成”。

## 13. 外部审查

审查者应从 GitHub `main` 重新读取：

```text
起始提交...结束提交
```

重点检查：

- 产品范围是否收敛；
- 两步 API 是否真正解耦；
- `coverage` 是否产生正确关系数量；
- 重复边是否按约定处理；
- 确定性是否真实；
- 关系引用是否完整；
- `search_text` 是否只包含白名单字段并正确转义；
- 数据库版本检查是否明确且不伪装成迁移；
- 认证是否覆盖全部规格、数据和导出接口；
- API 是否方便 CMDB、数据导入程序和测试脚本使用；
- 大数据是否采用分页；
- AI 和 API Key 是否泄露；
- UI Skills、shadcn/ui 是否真实使用；
- Chrome DevTools MCP 的真实浏览器证据是否完整；
- 前端是否存在 Console、Network、性能或响应式问题；
- README、Issue 和代码是否一致。

外部审查只针对 GitHub 上真实存在的代码，不审查未提交临时目录或未关联 Git 对象。

## 14. Issue #2 的启动条件

只有同时满足以下条件，才启动 Issue #2：

1. Issue #1 已实现；
2. 外部审查通过；
3. 严重和重要问题已修复；
4. 至少完成一次 CMDB 或 CMDB 测试程序的实际使用；
5. 真实使用仍证明拓扑或数据质量开关有价值。

不得把 Issue #2 与 Issue #1 并行实现。Issue #2 不包含数据库迁移或多轮聊天。

## 15. 状态真实性规则

项目状态只能由 GitHub 事实支持：

```text
设计阶段      只有文档和待开发 Issue
开发中        已记录起始提交并出现产品代码提交
等待审查      有结束提交和可复现验证报告
已完成        外部审查通过且 Issue 已关闭
```

未提交代码、临时工作目录、未关联到分支的 Git 对象或聊天中的描述，都不能改变项目状态。
