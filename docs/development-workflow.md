# Qoder Go Mode + 直接 main 开发与 Review 工作流

## 1. 背景

InfraSourceLab 当前采用个人快速开发模式：

- `main` 是阶段结果与持续备份；
- Qoder Go Mode 一次完成一个较大 Wave；
- 不要求每个小功能提 PR；
- 完成后直接更新 `main`；
- Review 使用 **Base SHA ... Head SHA + current main full source**；
- GitHub Issue 负责需求、验收、实现报告、Review 与修复历史。

这种方式可以成立，但必须保留清晰 commit range 与真实验证证据。

---

## 2. 一个 Issue = 一个大 Wave

Issue 可以大，但必须包含：

- Goal；
- Scope；
- Non-goals；
- architecture constraints；
- acceptance criteria；
- required tests；
- browser/runtime evidence；
- docs to update。

大 Wave 不等于“一次随便改遍整个仓库”。

---

## 3. 开始一个 Wave

### 3.1 同步 main

```bash
git checkout main
git pull --ff-only
git status --short
git rev-parse HEAD
```

working tree clean 后，将 SHA 写到目标 Issue：

```text
Go Mode implementation started.
Base SHA: <sha>
```

### 3.2 先读正式文档

每次至少：

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

涉及 Web：

```text
docs/frontend-design.md
docs/qoder-frontend-tooling.md
```

涉及 Fault/Verifier：

```text
docs/verification-and-faults.md
```

涉及具体数据源：

```text
docs/research/source-deep-dive.md
docs/research/tool-landscape.md
```

research 是 dated evidence；正式实施阶段/边界以 current Issues + Roadmap + Architecture 为准。

---

## 4. 不可静默改变的架构合同

Qoder 可以自主决定文件组织、类名、测试拆分、普通 CRUD、局部重构，但不能静默改变：

1. AI-first + Visual Builder + Expert YAML 的 authoring 层级；
2. 未保存 Working Copy 可以 validate/estimate；
3. authoritative Compile **只基于 immutable Scenario Revision**；
4. Run **只基于成功 Compile Manifest**；
5. Builder/AI/Expert YAML 是同一 semantic Working Copy；
6. AI Candidate 使用 semantic digest 防 stale blind overwrite；
7. Truth-first + Source Projection；
8. Core 不重新实现成熟协议；
9. Control 不接 Docker socket；
10. Agent 只接受 typed command / allowlisted runtime；
11. AI 无 Save/Compile/Run/Fault/Docker 自动权限；
12. shadcn/ui 是唯一主要通用组件体系；
13. Driver capability 以 actual pinned backend version + integration test 为准；
14. Apache-2.0 项目许可证不得自行更改。

发现必须改变上述条件时，在 Issue 报告设计冲突，不靠修改文档让代码“变正确”。

---

## 5. 前端 Design Engineering Loop

涉及新页面、主流程或明显视觉改版：

```text
Product task
  ↓
UI Skills / relevant playbook
  ↓
IA / primary task / progressive disclosure
  ↓
shadcn info/search/docs/view
  ↓
implementation
  ↓
Chrome DevTools MCP real Chrome
  ↓
visual / Console / Network / Performance fixes
  ↓
Playwright regression
```

### 强制基线

```text
React 19 + TypeScript + Vite
Tailwind CSS v4
shadcn/ui
assistant-ui
Monaco = Expert YAML only
```

禁止：

- Ant Design / Ant Design Pro；
- DLR CSS/Shell/Design System copy；
- textarea + fetch 第二套 AI UI；
- 普通控件重复造 Button/Dialog/Table/Form；
- M5 前放假的 Import 主 CTA。

Qoder MCP/Skill 实际连接与版本见 `docs/qoder-frontend-tooling.md`。

---

## 6. 开发期间 commits

不要求每个小功能一 PR，但建议有意义 commits：

```text
feat(authoring): add working-copy validation API
feat(web): add guided scenario builder
feat(compiler): persist deterministic truth graph
feat(ai): add validated candidate with semantic base digest
fix(web): preserve advanced fields during builder round-trip
```

避免一个超大“everything”提交，也不要为了形式制造几十个无意义 commit。

---

## 7. Push main 前 Gate

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

按 Wave：

```text
fresh DB migration
compose smoke
driver real-client smoke
reproducibility
authoring round-trip
cleanup/orphan
fault/recovery
Playwright
```

### Authoring 必查

相关 Wave 必须测试：

- unsaved Working Copy validate/estimate；
- Save produces immutable Revision；
- Compile rejects unsaved payload / requires Revision ID；
- Start requires successful Compile ID/Manifest；
- Builder preserves advanced valid fields；
- source_digest vs semantic_digest behavior；
- stale AI Candidate cannot blind Apply。

### UI 必查

Chrome DevTools MCP：

- 主路径实际点击；
- 1024 / 1280 / 1440 / 1920；
- screenshot / visual hierarchy；
- Console；
- Network failed/duplicate/slow；
- empty/loading/error；
- long text；
- keyboard/focus；
- heavy page performance；
- Builder ↔ Expert YAML semantic sync；
- AI provider unconfigured/error states when relevant。

`npm run build` 不能代替 UI 验收。

---

## 8. 第三方 Backend Gate

新增/升级 Driver 前记录：

```text
project
exact version/image tag
digest when appropriate
source URL
license
architecture
capabilities
```

然后使用真实外部 client 测：

```text
start
health
seed/render
client connect
native identity mapping
timeline/fault capability
stop
cleanup
reconcile
```

**上游 main/README 出现功能不等于当前 pin 版本已支持。** Driver registry 只声明实际版本经过 integration test 的 capability。

---

## 9. Qoder 完成时 Issue 报告

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

Third-party versions/capabilities:
- ...

Chrome DevTools MCP review:
- tool/version: ...
- flows checked: ...
- widths: ...
- Console: ...
- Network: ...
- performance: ...
- screenshots/evidence: ...

Known limitations:
- ...

Docs updated:
- ...
```

push main 后 **不要关闭 Issue**。

---

## 10. 无 PR Review

Reviewer 以：

```text
Base SHA ... Head SHA
```

检查：

1. commit range；
2. changed files；
3. critical files full content；
4. tests；
5. current docs；
6. CI；
7. third-party version/capability evidence；
8. real browser/runtime evidence。

Finding：

```text
Critical
Important
Minor
```

Critical/Important 必须修复后才通过。

大 Wave 不能只看 diff。

---

## 11. Review 特别关注

### Product hierarchy

- 新建是否 AI/Builder-first；
- Expert YAML 是否只是高级入口；
- Import 是否在 M5 前假暴露；
- advanced fields 是否渐进披露。

### Authoring correctness

- unsaved Working Copy 可否 validate/estimate；
- Revision 是否 immutable；
- Compile 是否只引用 Revision；
- Run 是否只引用 Compile；
- semantic digest/stale contract 是否正确；
- Builder round-trip 是否丢高级字段。

### Component discipline

- shadcn reuse；
- semantic tokens；
- accessibility；
- no second generic UI framework。

### AI safety

- assistant-ui baseline；
- server validation；
- provider secret server-side；
- AI unavailable 不阻塞 non-AI core；
- AI 不能 Save/Compile/Run/Fault/Docker。

### Driver fidelity

- actual pinned version；
- normal external client；
- no protocol reimplementation；
- truthful capability registry。

---

## 12. Review 结果与修复

Review 写到 Wave Issue：

```text
Review of <base>...<head>
Verdict: CHANGES REQUIRED / PASS

Critical
...

Important
...

Minor
...

Verified
...
```

修复时新的 Qoder session 读原 Issue、Review comment、current main 和相关正式文档，只修 finding，不顺便开始下一 Wave。

修复后记录新 Head SHA，Reviewer 复核：

```text
previous_head...new_head
```

---

## 13. Wave 关闭条件

只有以下都成立才关闭：

- Scope 实现；
- quality/integration/browser gates 通过；
- Critical = 0；
- Important = 0；
- 文档与实现一致；
- CI main 通过；
- required runtime/browser evidence 完整。

---

## 14. 推荐 Qoder 开场指令

```text
Read README.md, product, architecture, scenario-model, backend-strategy, security, development-workflow, frontend-design/qoder-frontend-tooling when Web is touched, and the target GitHub Issue first.

Implement the issue end-to-end on current main. Do not create a PR; this repo currently uses direct-main development.

Preserve these contracts: unsaved Working Copy can validate/estimate; authoritative Compile requires an immutable Revision; Run requires a successful Compile Manifest; AI/Builder/Expert YAML share one semantic model; AI cannot Save/Compile/Run/Fault/Docker automatically.

For UI work use UI Skills, shadcn/ui, assistant-ui, and real Chrome through Chrome DevTools MCP. Do not copy DLR UI or introduce Ant Design.

Do not reimplement mature protocols. Pin and test actual third-party versions before declaring capabilities.

Run all required quality, integration, Playwright and Chrome checks before pushing. Then report Base/Head SHA, exact validation, third-party versions/capabilities, Chrome evidence, known limitations and docs changed in the Issue. Do not close it before external review.
```
