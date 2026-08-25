# InfraSourceLab 前端产品与设计工程方案

## 1. 决策摘要

InfraSourceLab 前端不以 DataLinkRuntime 的视觉体系、Ant Design 或旧页面布局作为实现基线。

正式组合：

1. **UI Skills** — `ibelick/ui-skills`：设计工程方法、playbook 与 Agent skills；
2. **shadcn/ui** — `shadcn-ui/ui`：主要通用 UI 组件与源码级 design system；
3. **assistant-ui** — `assistant-ui/assistant-ui`：AI Thread/Message/Composer/Tool/Generative UI；
4. **Chrome DevTools MCP** — `ChromeDevTools/chrome-devtools-mcp`：真实 Chrome 点击、截图、Console/Network、Performance、响应式检查；
5. **Playwright**：稳定行为 regression。

```text
UI Skills → design guidance
shadcn/ui → product component/design system
assistant-ui → AI UX/runtime primitives
Chrome DevTools MCP → real-browser inspect/debug
Playwright → regression
```

UI Skills 与 Chrome DevTools MCP 是开发/验收工具，不是产品 runtime dependency。

Qoder 配置见 `docs/qoder-frontend-tooling.md`。

---

## 2. One Design System Rule

M0 必须建立并提交**唯一**的 shadcn project baseline：

```text
components.json
Tailwind v4 global theme/tokens
selected shadcn style/preset
selected primitive base (current shadcn choice: Base UI / Radix etc.)
selected icon library
component aliases / import paths
```

具体 preset/base/icon 不在架构阶段替 Qoder 猜，M0 应先用当前 `shadcn` CLI/info/docs 比较后做一次有意识选择，并在 Issue completion report 记录。

### 一旦 M0 定下

后续 Wave 默认**继承**，不能每个 Go Mode session：

- 重新 `shadcn init` 一套不同 preset；
- 随意切 Base UI/Radix primitive base；
- 换 icon library 导致全项目风格漂移；
- 新建第二份 global theme/tailwind config；
- 引入第二套通用 Button/Dialog/Table/Form 组件库。

真正要切 preset/base/icon library，必须作为显式架构迁移，有 diff、浏览器回归和外部 Review。

### assistant-ui 必须融入同一体系

assistant-ui 提供 AI primitives/runtime，但其 styled/scaffolded components 必须：

- 使用当前项目的 shadcn/Tailwind theme tokens；
- 使用当前项目同一个 primitive base/aliases/icon policy；
- 不初始化第二套 shadcn theme；
- 不形成“普通页面一种视觉、AI 页面另一种视觉”。

assistant-ui 负责 AI UX 能力，不拥有第二套产品 Design System。

---

## 3. 产品交互：AI-first，不把 YAML 当主流程

```text
A. AI Create / Describe Lab        默认入口
B. Visual Scenario Builder         可视化精调
C. YAML Expert Mode                Monaco 专家模式
                  ↓
             Scenario Working Copy
                  ↓
        Validate / Estimate / Preview
                  ↓
              Save Revision
                  ↓
       Authoritative Compile / Start
```

### AI Create

首页/新建主任务：**描述你想模拟的 IT 环境**。

平台先返回 structured proposal：Environment / Sources / Data Quality / Estimate，而不是先展示大段 YAML。

AI Provider 未配置时显示清晰 unavailable/not-configured 状态，Builder/Expert YAML 和 non-AI core 仍可用。

### Visual Builder

覆盖高频 80%：Environment、Sources、Data Quality、M2 起常用 Timeline/Fault。

不是通用低代码 DAG，也不把所有 Driver 私有字段做成大表单。

### Expert YAML

用于高级字段、精确控制、diagnostics、revision/YAML Diff、copy/share/debug；不抢占默认 Create Lab 主视觉。

---

## 4. Working Copy / Round-trip

AI、Builder、Expert YAML 操作同一逻辑 semantic Working Copy。

前端可有局部 form/editor buffer，但提交后收敛到服务端 typed document + `semantic_digest`。

Builder 应：

```text
current typed document
 ↓ patch known paths
preserve untouched valid advanced fields
 ↓ validate/serialize
```

不能只抽取 Builder 字段后重建整份 Scenario。

有 Builder 无法表达的合法 advanced config 时显示提示。

### Raw YAML vs semantic

必须保留语义；不承诺所有 comments/whitespace/key ordering 逐字符 round-trip。详见 `docs/scenario-model.md`。

---

## 5. Authoring / Runtime 用户动作层级

### Unsaved Working Copy

允许 Validate / Estimate / AI Candidate / editing。

不允许 authoritative Compile / Start。

### Immutable Revision

显式 Save 后产生。

### Compile

只接受 immutable Revision。

### Run

只接受成功 Compile Manifest。

UI 要把 Preview / Save / Compile / Start 的层级表达清楚，不做一个语义不透明的万能按钮。

---

## 6. Runtime 前端技术栈

| 层 | 选型 |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 7 |
| Styling | Tailwind CSS v4 |
| UI components | shadcn/ui |
| AI UX | assistant-ui |
| Expert editor | Monaco Editor |
| i18n | i18next + react-i18next |
| Unit/component | Vitest + Testing Library |
| Browser regression | Playwright |
| Agent browser inspection | Chrome DevTools MCP |

明确不使用 Ant Design / Ant Design Pro / DLR Design System / 第二套通用 UI framework。

---

## 7. shadcn/ui 使用规则

```text
shadcn info
 ↓
search / docs / view
 ↓
reuse / compose
 ↓
custom only when actually needed
```

要求：

- semantic theme tokens；
- built-in variants first；
- proper Field/form validation；
- Dialog/Sheet/Drawer accessible Title；
- AlertDialog for destructive action；
- state not color-only；
- Empty/Skeleton/Alert/sonner reuse；
- big tables paged/virtualized；
- registry component 加入后读实际生成源码再 Review。

---

## 8. UI Skills 的角色

新主页面/明显 UI 改版先回答：

1. 页面主要任务是什么？
2. 第一视觉焦点是什么？
3. 主操作是否明显？
4. advanced capability 是否过早暴露？
5. 是否有无价值 Cards/Charts？
6. 是否可复用 shadcn？
7. empty/error/slow/long-text/narrow 状态？
8. 真实 Chrome 是否符合意图？

推荐：Issue → UI Skills → IA/progressive disclosure → shadcn → implementation → Chrome → iterate。

---

## 9. 信息架构

一级入口：

```text
Create Lab / Home
Scenarios
Runs
Sources / Drivers
Verification
Settings
```

Scenario：Overview / Builder / World / Sources / Timeline / Runs / Verify / Expert YAML。

M0/M1 Create：

```text
[ AI prompt + examples ]
Start from [Guided Builder] [Template] [Expert YAML]
```

### Import staging

General Importer/Attachment 属于 M5。M5 前不放 active/disabled fake Import CTA 冒充已完成能力。

M4A NETCONF YANG input、M4B replay capture ingest 是 Driver-specific input，不等同 M5 general Importer。

---

## 10. Visual Builder 边界

可视化：规模/数量、Source 选择、常见脏数据、简单关系、常用 Timeline/Fault、resource estimate/capability diagnostics。

不做：任意表达式、DAG、通用关系拖拽平台、每 Driver 独立大配置页、完整复制 DSL。

---

## 11. AI UX

assistant-ui 是唯一 AI UX 基础，不写第二套聊天框。

### M1 minimum

- Create AI；
- structured Candidate；
- `base_semantic_digest` stale blocking；
- invalid Candidate blocked；
- Apply only Working Copy。

### M5 advanced

- Context Assistant；
- streaming/cancel/retry/Regenerate；
- attachment/import；
- context snippets；
- tool-call/generative UI；
- frozen snapshot；
- richer 3-way conflict/rebase。

具体 Sheet/Resizable/workspace layout 由 UI Skills + Chrome 决定，不继承 DLR fixed sidebar。

---

## 12. Structured Diff First

先显示语义变化：

```text
+ 1 site
+ 200 servers
+ 1 vCenter
~ Excel refresh → frozen
+ 2% wrong-IP
```

需要时再看 YAML Diff。Raw YAML Diff 不是普通用户唯一理解方式。

---

## 13. Error / Capability States

正式设计：

- AI provider not configured/unavailable；
- invalid/stale Candidate；
- validation/resource hard limit；
- Driver unavailable on host；
- transport/fault unsupported（包括 TCP-vs-UDP）；
- Control/Agent unavailable；
- Compile failed；
- Run partial/failed；
- Verify failed；
- Builder advanced config warning。

错误必须可操作，不只“请求失败”。

---

## 14. 大数据 UI

Truth/Source/Verification 10k–100k：server-side paging/filter when suitable、virtualization、bounded detail payload、no massive DOM、long ID/URL overflow/copy、Chrome performance trace。

Run Truth historical-version navigation 也要能在大规模下工作。

---

## 15. Chrome DevTools MCP 完成定义

UI Wave 必须真实检查：

- primary flow clicks；
- 1024 / 1280 / 1440 / 1920；
- screenshot/hierarchy；
- Console；
- Network 4xx/5xx/duplicate/slow；
- loading/empty/error；
- keyboard/focus；
- long zh/en text；
- heavy-page trace；
- Builder↔YAML semantic sync；
- AI stale/provider states；
- fault transport capability UX where relevant。

Chrome MCP 用于探索/调试；稳定路径最终用 Playwright。

---

## 16. 前端安全

- provider secret server-side；
- generated credential not permanently cleartext；
- unsanitized raw capture not sent to AI；
- browser evidence no production secrets；
- Chrome MCP only test data；
- AI approval UI != model execution permission；
- destructive action explicit confirmation。

---

## 17. 跨 Wave 红线

- AI-first / Builder / Expert YAML hierarchy stays；
- Monaco not default home；
- one committed shadcn baseline/components.json；
- no silent preset/base/icon/theme re-init；
- assistant-ui uses same shadcn design system；
- UI Skills for design engineering；
- Chrome MCP for real-browser review；
- Playwright regression；
- no Ant Design / DLR UI；
- Import not faked before M5；
- UI completion requires real Chrome evidence。