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

关键不是增加流程，而是防止 Go Mode 自行扩张产品范围。

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

## 3. 开发过程中必须遵循的前端工具约束

Issue #1 和后续前端功能开发，必须遵循 [`docs/qoder-frontend-tooling.md`](qoder-frontend-tooling.md) 的工具约束（UI Skills、shadcn/ui、Chrome DevTools MCP、assistant-ui），不得只在文档中声明而不在实际开发和验收中使用。要点：

- UI Skills：编码前完成主任务、信息层级、尺寸和状态的设计判断，不能事后补写；
- shadcn/ui：组件和视觉体系的首选基础，不得引入第二套大型通用组件库；
- Chrome DevTools MCP：真实浏览器验收是必过门槛，构建成功、单元测试或 Playwright 通过都不能替代；
- assistant-ui：多轮对话式 AI 交互的首选实现；若创建页交互只是“一次提示 → 结构化规格建议”，允许用 shadcn/ui 轻量组件实现，同一交互不得重复造两套。

Playwright 仍用于自动化回归，但与 Chrome DevTools MCP 的真实浏览器验收缺一不可。

如果 Qoder 当前环境无法直接调用 Chrome DevTools MCP，必须由能够调用它的 Codex、Claude 或其他兼容代理完成最终浏览器检查。在该证据完成前，前端不能标记为“等待审查”。

## 4. 开始开发前

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
- 已确定创建页 AI 交互的实现方式（assistant-ui 或 shadcn/ui 轻量组件）；
- 已确认 Chrome DevTools MCP 的调用方式；
- 已确认最终 Playwright 回归路径。

## 5. 给 Qoder 的首要指令

建议使用中文：

```text
请在当前 main 上端到端实现 Issue #1。

InfraSourceLab 是一个精简的单体 CMDB 测试数据生成工具，不是基础设施仿真或编排平台。

必须优先完成：
自然语言或模板 → 经过校验的 GenerationSpec → 本地确定性生成 CI 与关系 → SQLite → Bearer Token REST API → JSON/CSV → 简单可用界面。

前端开发必须遵循 docs/qoder-frontend-tooling.md 的工具约束：
UI Skills（https://github.com/ibelick/ui-skills）、shadcn/ui（https://github.com/shadcn-ui/ui）、Chrome DevTools MCP（https://github.com/ChromeDevTools/chrome-devtools-mcp）必须真实使用；创建页 AI 交互优先 assistant-ui（https://github.com/assistant-ui/assistant-ui），若交互形态为一次性规格回显，可用 shadcn/ui 轻量组件实现。

Playwright 用于固化回归，但不能替代 Chrome DevTools MCP 的真实 Chrome 验收。

不要实现已关闭 Issue 或未来平台能力。所有门槛通过前不要更新 main；不需要创建 PR。
```

## 6. Qoder 可以自主决定的内容

在范围内可以自主决定：

- 文件组织；
- 类和函数命名；
- SQLAlchemy 模型细节；
- Pydantic 模型组织；
- shadcn 组件组合；
- 测试拆分；
- 普通错误处理；
- 局部重构；
- 导出库选择；
- Faker 或 Mimesis 的合理分工。

## 7. 不允许自行增加

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
```

也不要为“未来扩展”创建大量空接口、空目录、抽象工厂或占位页面。

如果实现中发现 Issue #1 无法完成，应报告真实阻塞，不能用新平台掩盖问题。

## 8. 前端开发闭环

```text
读取 UI Skills
→ 明确主用户任务和页面层级
→ 查询并复用 shadcn/ui 组件
→ 按工具约束实现创建页 AI 交互（assistant-ui 或 shadcn/ui 轻量组件）
→ 在真实 Chrome 中通过 Chrome DevTools MCP 操作
→ 检查截图、Console、Network、性能和响应式
→ 修复问题
→ 用 Playwright 固化稳定主路径
```

只通过 `npm run build` 不等于前端完成。

前端完成报告必须能够回答：

- UI Skills 的哪些判断真实改变了布局或交互；
- 使用了哪些 shadcn/ui 组件，哪些控件必须自定义以及原因；
- 创建页 AI 交互的实现方式（assistant-ui 或 shadcn/ui 轻量组件）及原因；
- Chrome DevTools MCP 由哪个代理执行，检查了哪些视口和流程；
- Console、Network、性能和响应式结果；
- 哪些主路径已经进入 Playwright。

## 9. 后端门槛

至少需要：

- 规格模型和语义校验；
- 相同规格和 seed 的确定性测试；
- 关系引用完整性测试；
- Bearer Token 正确和错误路径；
- 分页、筛选和搜索；
- JSON 与 CSV 导出一致性；
- 万级数据冒烟测试；
- 生成失败时的事务回滚；
- AI 未配置时的模板路径。

XLSX、自定义类型和额外模板不得阻塞核心闭环。

## 10. 更新主分支前的门槛

在直接更新 `main` 前必须确认：

1. 当前提交范围内没有未解释的严重或重要问题；
2. 后端测试通过；
3. 前端类型检查、单元测试和构建通过；
4. Playwright 主路径通过；
5. 已实际使用 UI Skills、shadcn/ui，并按工具约束完成创建页 AI 交互；
6. Chrome DevTools MCP 已完成真实 Chrome 主流程、截图、Console、Network、性能和响应式检查；
7. Docker 或文档规定的本地启动方式可复现；
8. README 和状态文档与真实代码一致；
9. Issue 完成报告准确，不夸大未验证能力。

如果任何门槛未通过，代码可以保留在本地或工作分支，不能声称已经完成。

## 11. 完成报告格式

Issue #1 真正实现后，使用中文记录：

```text
Issue #1 实现完成，等待外部审查。

起始提交：<sha>
结束提交：<sha>

已实现：
- ...

未实现或明确延期：
- ...

前端必用工具证据：
- UI Skills 关键决定：...
- shadcn/ui 初始化与组件：...
- AI 创建交互的实现方式（assistant-ui 或 shadcn/ui 轻量组件）及选择原因；
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

## 12. 外部审查

审查者应从 GitHub `main` 重新读取：

```text
起始提交...结束提交
```

重点检查：

- 产品范围是否收敛；
- 认证是否覆盖全部数据和导出接口；
- 确定性是否真实；
- 关系引用是否完整；
- API 是否方便 CMDB、数据导入程序和测试脚本使用；
- 大数据是否采用分页；
- AI 和 API Key 是否泄露；
- UI Skills、shadcn/ui 是否真实使用而非仅写入文档，创建页 AI 交互是否符合工具约束；
- Chrome DevTools MCP 的真实浏览器证据是否完整；
- 前端是否存在 Console、Network、性能或响应式问题；
- README、Issue 和代码是否一致。

外部审查只针对 GitHub 上真实存在的代码，不审查未提交临时目录或未关联 Git 对象。

## 13. Issue #2 的启动条件

只有同时满足以下条件，才启动 Issue #2：

1. Issue #1 已实现；
2. 外部审查通过；
3. 严重和重要问题已修复；
4. 至少完成一次 CMDB 或 CMDB 测试程序的实际使用；
5. 真实使用仍证明拓扑或数据质量开关有价值。

不得把 Issue #2 与 Issue #1 并行实现。

Issue #2 如果启动，仍然必须遵循同一套前端工具约束（见 [`qoder-frontend-tooling.md`](qoder-frontend-tooling.md)）；其中 assistant-ui 只在确有多轮 AI 交互时使用，不为拓扑页强行增加聊天入口。

## 14. 状态真实性规则

项目状态只能由 GitHub 事实支持：

```text
设计阶段      只有文档和待开发 Issue
开发中        已记录起始提交并出现产品代码提交
等待审查      有结束提交和可复现验证报告
已完成        外部审查通过且 Issue 已关闭
```

未提交代码、临时工作目录、未关联到分支的 Git 对象或聊天中的描述，都不能改变项目状态。