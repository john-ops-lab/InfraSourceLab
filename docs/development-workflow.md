# Qoder Go Mode + 直接 main 开发与 Review 工作流

## 1. 背景

InfraSourceLab 当前采用个人快速开发模式：

- GitHub `main` 是持续备份和阶段结果；
- Qoder Go Mode 可以一次完成一个较大的 Wave；
- 不要求每个小功能提交 PR；
- 开发完成后直接更新 `main`；
- Review 以 **Git commit range + 实际 main 源码** 为依据；
- GitHub Issues 负责记录需求、验收条件和 review follow-up。

这种模式可以成立，但必须保留明确 Base/Head 和严格验证证据。

---

## 2. 一个 Issue = 一个大 Wave

Issue 可以比传统 Scrum Task 大，但仍必须有：

- Goal；
- Scope；
- Non-goals；
- architecture constraints；
- acceptance criteria；
- required tests；
- docs to update。

---

## 3. 开始一个 Wave 前

### Step 1：同步 main

```bash
git checkout main
git pull --ff-only
```

working tree 必须 clean。

### Step 2：记录 Base SHA

```bash
git rev-parse HEAD
```

在对应 Issue 留言：

```text
Go Mode implementation started.
Base SHA: <sha>
```

### Step 3：先读产品/架构文档

每次至少读：

```text
README.md
docs/product.md
docs/architecture.md
docs/scenario-model.md
docs/backend-strategy.md
docs/security-and-licensing.md
docs/development-workflow.md
当前 Wave Issue
```

### 涉及前端时必须再读

```text
docs/frontend-design.md
```

并明确当前前端正式基线：

```text
UI Skills
shadcn/ui
assistant-ui
Chrome DevTools MCP
React 19 + TypeScript + Vite
Tailwind CSS v4
Monaco = Expert YAML only
```

**不要参考 DLR 的 CSS、Ant Design、Shell 或页面布局作为实现基线。**

### 涉及 verifier/fault 时再读

```text
docs/verification-and-faults.md
```

---

## 4. Qoder Go Mode 的自由度边界

### 可以自主决定

- 文件组织细节；
- 类/函数命名；
- 测试拆分；
- 普通 CRUD；
- 局部重构；
- 修复开发中发现的明显 bug；
- 在产品/架构约束内选择合适 shadcn 组件组合。

### 不允许静默改变

- 产品定位；
- **AI-first + Visual Builder + Expert YAML** 的 authoring 层级；
- Truth-first 架构；
- Control/Lab Agent 权限边界；
- Scenario DSL 核心语义；
- Driver 不重复实现成熟协议原则；
- AI Candidate/Apply/Start 安全边界；
- 前端唯一主要组件体系为 shadcn/ui；
- 第三方许可证策略；
- 公开网络/host mount/任意 image 安全策略。

若必须改变这些，先在 Issue 记录设计冲突，不自行“优化需求”。

---

## 5. 前端开发必须走 Design Engineering Loop

涉及新页面、主流程或明显视觉改版时，不能直接从 prompt 跳到 JSX。

```text
产品目标
  ↓
UI Skills / relevant design skill
  ↓
信息架构 / 主任务 / progressive disclosure
  ↓
shadcn registry / docs / existing components
  ↓
实现
  ↓
Chrome DevTools MCP 真实浏览器检查
  ↓
修正视觉 / 交互 / Console / Network / Performance
  ↓
Playwright 固化稳定回归
```

### shadcn 规则

- 先 `info/search/docs/view`，再决定是否自定义；
- Button/Dialog/Table/Select/Form/Alert/Empty/Skeleton 等常规组件不得重复造轮子；
- 使用 semantic theme tokens；
- Dialog/Sheet/Drawer 保持可访问标题；
- forms 使用规范 Field/validation 语义；
- 大列表分页/虚拟化。

### UI Skills

是 Agent 的设计工程参考，不是产品 runtime dependency。

### Chrome DevTools MCP

是开发/Review 工具，不是产品 runtime dependency。它用来让 Agent 实际看页面，而不是只读 DOM/代码猜 UI。

---

## 6. 开发期间提交

不要求每个小功能一个 PR，但建议有意义 commits：

```text
feat(core): add scenario revision model
feat(web): add guided scenario builder
feat(compiler): build deterministic truth graph
feat(ai): add validated scenario candidate
fix(web): resolve narrow-width builder overflow
```

最后直接 push main。

---

## 7. Push main 前本地 Gate

### Backend

```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy
uv run pytest
```

### Web

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

### Integration

按 Wave 增加：

```text
compose smoke
driver smoke
reproducibility test
cleanup/orphan test
Playwright browser regression
```

### 涉及 UI 的额外强制 Gate

Qoder/Coding Agent 必须使用 Chrome DevTools MCP 在真实 Chrome 完成实际检查，并在 Issue 记录结果。

至少检查：

- 主任务点击路径；
- screenshot / visual hierarchy；
- Console error/warning；
- Network failed/duplicate/slow requests；
- empty/loading/error；
- long text；
- keyboard/focus；
- 1024 / 1280 / 1440 / 1920 desktop；
- 重页面 Performance trace（有需要时）；
- AI UI 的 draft/message/candidate state；
- Visual Builder 与 Expert YAML 是否保持同一 Working Copy。

不能以 `npm run build` 替代 UI 验收。

---

## 8. Qoder 完成时的 Issue 回报格式

```text
Implementation complete.

Base SHA: <start>
Head SHA: <final>

Implemented:
- ...

Validation:
- backend: ... PASS
- web: ... PASS
- integration: ... PASS
- Playwright: ... PASS

Chrome DevTools MCP review:
- flows checked: ...
- widths: ...
- Console: clean / findings
- Network: clean / findings
- performance: ...
- screenshots/evidence: ...

Known limitations:
- ...

Docs updated:
- ...
```

push main 后 Issue **先不要关闭**。

---

## 9. 无 PR Review 方法

Reviewer 使用：

```text
Base SHA ... Head/main
```

审查：

1. commit range；
2. changed file list；
3. critical file full content；
4. tests；
5. current docs；
6. CI；
7. 真实浏览器/运行验证。

大 Wave 不能只看 diff。

Finding：

```text
Critical
Important
Minor
```

Critical/Important 必须修复后才过审。

---

## 10. 前端 Review 的额外检查

Reviewer 不只问“像不像设计稿”，而是检查：

### Product hierarchy

- 新建是否仍以 AI/Builder 为主，而不是空 Monaco；
- Expert YAML 是否保持高级入口；
- 常见操作是否渐进披露；
- 是否为高级 DSL 创建了大面积低代码表单垃圾场。

### Component discipline

- 是否优先使用 shadcn 组件；
- 是否重新发明基础控件；
- 是否偷偷引入 Ant Design/MUI 第二套体系；
- 是否遵循 semantic token 和 accessibility。

### AI UX

- assistant-ui 是否作为基础；
- Candidate 是否经过 server validation；
- Apply 是否只修改 Working Copy；
- AI 是否不能直接 Save/Run/Fault/Docker；
- stale/late response 是否安全处理（相关 Wave）。

### Browser evidence

- 实际 Chrome screenshots；
- Console/Network；
- 关键宽度；
- heavy view performance；
- Playwright regression。

---

## 11. Review 结果写回 GitHub

没有 PR 时，Review 写到 Wave Issue comment：

```text
Review of <base>...<head>

Verdict: CHANGES REQUIRED

Critical
1. ...

Important
1. ...

Minor
1. ...

Verified
- ...
```

需要跨 Wave 的大问题另建 Issue。

---

## 12. 修复 Review

新的 Qoder session 至少读：

- 原 Issue；
- Review comment；
- 当前 main；
- 相关产品/架构/前端设计文档。

只修 finding，不顺便开始下一 Wave。

修复完成记录新 Head SHA，Reviewer 审：

```text
previous_head...new_head
```

---

## 13. Wave 关闭条件

Issue 只有在：

- Scope 已实现；
- tests/quality gates 全绿；
- Critical = 0；
- Important = 0；
- 文档与实现一致；
- CI main 通过；
- 必要 browser/runtime evidence 完成；

之后才关闭。

---

## 14. Driver Review 特殊要求

新增 Driver 必须验证：

```text
start
health
seed/render
real client can connect
canonical ↔ native identity map
supported timeline action
fault capability
stop
cleanup
orphan recovery
```

还要核对：第三方版本/许可证、Docker image、ARM64、network exposure、secret logging。

---

## 15. 推荐给 Qoder 的每波起始指令

```text
Read README.md, product, architecture, security, frontend-design (when web is touched), and the target GitHub Issue first.
Implement the issue end-to-end on current main.
Do not create a PR; this project currently uses direct-main development.
For UI work, use UI Skills for design guidance, shadcn/ui as the primary component system, assistant-ui for AI UX, and Chrome DevTools MCP for real-browser inspection. Do not copy DLR UI or introduce Ant Design.
Keep AI-first + Visual Builder as the normal authoring path; Monaco/YAML is Expert Mode.
Do not reimplement mature protocols when a selected backend exists.
Run all required quality, integration, Playwright and Chrome DevTools checks before pushing.
When done, update the issue with Base SHA, Head SHA, implementation summary, exact validation results, Chrome evidence, known limitations and docs changed.
Do not close the issue; it will be externally reviewed first.
```

这个粒度适合 Go Mode，也保留完整可审计性。