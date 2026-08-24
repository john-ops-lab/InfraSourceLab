# Qoder Go Mode + 直接 main 开发与 Review 工作流

## 1. 背景

InfraSourceLab 当前采用个人快速开发模式：

- GitHub `main` 是持续备份和阶段结果；
- Qoder Go Mode 可以一次完成一个较大的 Wave；
- 不要求每个小功能提交 PR；
- 开发完成后直接更新 `main`；
- Review 以 **Git commit range + 实际 main 源码** 为依据；
- GitHub Issues 负责记录需求、验收条件和 review follow-up。

这种模式可以成立，但必须保留“从哪里开始、做到哪里结束”的可审计边界，否则一次 Go Mode 改几十个文件后无法高质量 Review。

---

## 2. 一个 Issue = 一个大 Wave

Issue 刻意比传统 Scrum Task 大，例如：

```text
[M1] Deterministic Scenario Compiler + Truth Graph + first source drivers
```

而不是拆成：

```text
加一个表
加一个 API
加一个按钮
写一个 seed helper
```

这是为了匹配 Go Mode 的自主执行特点。

但一个 Wave 仍必须有明确：

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

Qoder 开始前本地：

```bash
git checkout main
git pull --ff-only
```

必须 working tree clean。

### Step 2：记录 Base SHA

```bash
git rev-parse HEAD
```

在对应 GitHub Issue 留言：

```text
Go Mode implementation started.
Base SHA: <sha>
```

这个 SHA 是未来无 PR Review 的“diff base”。

### Step 3：Qoder 先读文档

每次至少要求读：

```text
README.md
docs/product.md
docs/architecture.md
docs/scenario-model.md
docs/backend-strategy.md
docs/security-and-licensing.md
当前 Wave Issue
```

涉及 UI 再读：

```text
docs/dlr-ui-reuse.md
```

涉及 verifier/fault 再读：

```text
docs/verification-and-faults.md
```

---

## 4. Qoder Go Mode 的自由度边界

### 可以自主决定

- 文件组织细节；
- 类/函数命名；
- 测试拆分；
- 普通 CRUD 实现；
- 局部重构；
- 修复开发中发现的明显 bug。

### 不允许静默改变

- 产品定位；
- Truth-first 架构；
- Control/Lab Agent 权限边界；
- Scenario DSL 的核心语义；
- Driver 不重复实现协议原则；
- AI Candidate/Apply/Start 安全边界；
- 第三方许可证策略；
- 公开网络/host mount/任意 image 安全策略。

如果实现发现必须改变这些，Qoder 应停止该方向并在 Issue 记录设计冲突，而不是自行“优化架构”。

---

## 5. 开发期间提交

不要求每个小功能一个 PR，但仍建议 Qoder 自己做**有意义的本地 commits**：

```text
feat(core): add scenario revision model
feat(compiler): build deterministic truth graph
feat(driver): add artifact source
fix(compiler): stabilize deterministic selector
```

最后都可以直接 push main。

原因：

- 出问题容易 bisect；
- Review 可以按 commit 理解；
- GitHub main 不只剩一个“changed 80 files”巨型提交。

但不强制为了形式制造几十个 commit。

---

## 6. Push main 前本地 Gate

Qoder 必须执行并记录实际命令结果。

### Backend

预期最终类似：

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
browser Playwright
reproducibility test
cleanup/orphan test
```

### 禁止

不能因为“时间太长”就把失败测试删掉、skip 掉或降低 assertion 后直接推 main。

---

## 7. Qoder 完成时的 Issue 回报格式

Qoder 在 Issue 留下：

```text
Implementation complete.

Base SHA: <start>
Head SHA: <final>

Implemented:
- ...
- ...

Validation:
- command A: PASS
- command B: PASS
- browser: PASS / evidence

Known limitations:
- ...

Docs updated:
- ...
```

然后把代码 push 到 main。

Issue **先不要关闭**。

---

## 8. 无 PR Review 方法

Reviewer 使用：

```text
Base SHA ... Head/main
```

完整审查：

1. commit range；
2. changed file list；
3. critical file full content；
4. tests；
5. current architecture docs；
6. CI；
7. 必要时真实浏览器/运行验证。

### Review 重点不是只看 diff

大 Wave 里某个新文件可能全是新增，单看 diff 很难理解；Reviewer 必须读完整实现和调用链。

### Review Finding 严重度

```text
Critical
Important
Minor
```

Critical/Important 必须修复后 Wave 才算过审。

---

## 9. Review 结果如何写回 GitHub

没有 PR 时，Review 直接写到 Wave Issue comment：

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

如果 finding 需要跨 Wave 或较大重构，单独创建新的 GitHub Issue，并在当前 Wave 引用。

---

## 10. 修复 Review

优先让同一个 Qoder Go session/context（如果仍可用）或新的 Qoder session 读：

- 原 Issue；
- Review comment；
- 当前 main；

只修 review finding，不顺便开始下一 Wave。

修复完成后记录新 Head SHA，Reviewer 做 incremental review：

```text
previous_head...new_head
```

同时重验原问题。

---

## 11. Wave 关闭条件

Issue 只有在：

- Scope 已实现；
- tests/quality gates 全绿；
- Critical = 0；
- Important = 0；
- 文档与实现一致；
- CI main 通过；
- 必要的 browser/runtime evidence 完成；

之后才关闭。

Minor 可单独记录后关闭当前 Wave，但不能让大量 Minor 变成无人跟踪的技术债。

---

## 12. 为什么仍保留 Issues

即使不使用 PR，Issue 仍是：

```text
需求合同
+ 开发起点 Base SHA
+ Qoder 实现报告
+ Reviewer 审计报告
+ 修复历史
+ 最终完成证据
```

这比在 `BACKLOG.md` 里写一句“做 vCenter 模拟”更适合公开项目，也能让未来社区理解项目演进。

---

## 13. 避免 Direct-main 模式的几个坑

### 坑 1：两个 Wave 同时改 main

不要并发。否则 Review 的 base/head 混入其他需求。

### 坑 2：开发期间手工夹杂大量无关 UI 调整

当前 Wave 只做相关改动。新的想法建 Issue。

### 坑 3：Qoder 自己改需求文档来让代码“符合”

文档可以更新，但如果是**改变需求**而不是补充实现细节，必须在 Issue 明确说明。

### 坑 4：直接 Review `main~1..main`

Go Mode 可能多个 commit，必须用记录的 Base SHA。

### 坑 5：没有测试证据就说完成

Issue 最终需要命令级证据。

---

## 14. 前端 Review 特殊要求

如果 Wave 改 Web：

除了 lint/typecheck/unit/build，必须有真实浏览器验收。

至少检查：

- 1440/1280；
- empty/loading/error；
- long text；
- keyboard/focus；
- console errors；
- AI panel state；
- destructive confirm；
- zh-CN/en（相关页面）。

尽量沿用 DLR 已经建立的 UI 测试习惯。

---

## 15. Driver Review 特殊要求

新增 Driver 除代码质量外必须验证：

```text
start
health
seed/render
client can connect
canonical ↔ native identity map
supported timeline action
fault capability
stop
cleanup
orphan recovery
```

还要核对：

- 第三方版本/许可证；
- Docker image；
- ARM64；
- localhost/network exposure；
- secret logging。

---

## 16. 推荐给 Qoder 的每波起始指令

不在仓库放 Qoder 专属隐藏流程文件，Issue 本身就是执行合同。给 Go Mode 的开场可使用：

```text
Read the repository product/architecture/security documents and the target GitHub Issue first.
Implement the issue end-to-end on current main.
Do not create a PR; this project uses direct-main development for now.
Do not silently change product boundaries or reimplement mature protocols when a selected backend already exists.
Run all required quality gates and integration/browser tests before pushing.
When done, update the issue with Base SHA, Head SHA, implementation summary, exact validation results, known limitations and docs changed.
Do not close the issue; it will be externally reviewed first.
```

这个粒度适合 Go Mode，又保留了最终可审计性。
