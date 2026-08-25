# InfraSourceLab 前端产品与设计工程方案

## 1. 决策摘要

InfraSourceLab 前端不以 DataLinkRuntime 的视觉体系、Ant Design 或旧页面布局作为实现基线。

正式组合：

1. **UI Skills** — `ibelick/ui-skills`：设计工程方法、playbook 与 Agent skills；
2. **shadcn/ui** — `shadcn-ui/ui`：主要 UI 组件与源码级 design system；
3. **assistant-ui** — `assistant-ui/assistant-ui`：AI Thread/Message/Composer/Tool/Generative UI；
4. **Chrome DevTools MCP** — `ChromeDevTools/chrome-devtools-mcp`：真实 Chrome 点击、截图、Console/Network、Performance、响应式检查；
5. **Playwright**：把稳定行为固化成 regression。

```text
UI Skills             → design guidance
shadcn/ui              → product components/design system
assistant-ui           → AI UX/runtime primitives
Chrome DevTools MCP    → real-browser inspect/debug
Playwright             → regression
```

UI Skills 与 Chrome DevTools MCP 是开发/验收工具，不是产品 runtime dependency。

Qoder 配置与实际工具使用见 `docs/qoder-frontend-tooling.md`。

---

## 2. 产品交互：AI-first，不把 YAML 暴露成主流程

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

### 2.1 AI Create

首页/新建主任务：

> **描述你想模拟的 IT 环境**

平台返回结构化 proposal，而不是先展示 200 行 YAML：

```text
Environment
2 sites · 50 racks · 400 servers · 1500 VMs · 3 K8s · 200 apps

Sources
2 vCenter · 120 SNMP · 400 Redfish · 1 Excel

Data quality
3% hostname case drift · 2% wrong IP · Excel stale by 1 version

Estimate
7 runtime services · ~1.3 GiB memory
```

主动作：

```text
[Apply/Create Working Copy] [可视化调整] [查看 Expert YAML]
```

AI Provider 未配置时必须给出可理解状态，Builder/Expert YAML 仍能完成工作。

### 2.2 Visual Builder

Builder 覆盖高频 80%：

```text
Environment
Sources
Data Quality
Timeline & Faults (从 M2)
```

不是通用低代码 DAG，也不把每个 Driver 私有字段都做成永久大表单。

### 2.3 Expert YAML

Monaco 用于：

- 高级字段；
- 精确控制；
- AI/Builder 结果查看；
- diagnostics；
- YAML Diff/revision；
- copy/share/debug。

不抢占 Create Lab 主视觉。

---

## 3. Working Copy 与页面状态

AI、Builder、Expert YAML 操作同一**逻辑 Working Copy**。

前端可有局部 form/editor state，但提交后必须收敛到服务端 typed document 与 `semantic_digest`。

### Builder round-trip

Builder 更新应该是：

```text
current typed document
  ↓
patch known paths
  ↓
preserve untouched valid advanced fields
  ↓
validate/serialize
```

不能：

```text
只读 Builder 认识的字段
  ↓
重新生成整份 Scenario
  ↓
高级字段丢失
```

UI 必须提示：当前场景是否包含 Builder 无法可视化的 advanced configuration。

### 格式与语义

Builder 必须保留语义，不承诺保留所有 YAML comment/whitespace/key-order。详情见 `docs/scenario-model.md`。

---

## 4. Authoring 状态与用户动作

### Unsaved Working Copy

允许：

- Validate；
- Estimate；
- AI Candidate；
- Builder/Expert editing。

不允许：

- authoritative Compile；
- Start Run。

### Immutable Revision

用户显式 Save 后产生。

### Compile

只接受 immutable Revision。

### Run

只接受成功 Compile Manifest。

前端按钮和导航必须表达这个层级，不要把 Preview、Save、Compile、Start 混成一个不透明“大按钮”。

---

## 5. Runtime 前端技术栈

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

明确不使用：

- Ant Design；
- Ant Design Pro；
- DLR Design System/CSS/Shell/Catalog；
- 第二套通用 Button/Dialog/Table/Form 框架。

---

## 6. shadcn/ui 使用规则

开发顺序：

```text
npx shadcn@latest info
        ↓
search / docs / view
        ↓
reuse / compose
        ↓
确实无合适能力时再 custom
```

核心规则：

- semantic tokens；
- component built-in variants first；
- Form 使用规范 Field/validation；
- Dialog/Sheet/Drawer accessible Title；
- destructive action 使用 AlertDialog；
- status 不只靠颜色；
- Empty/Skeleton/Alert/sonner 等现成能力优先；
- 大表分页/虚拟化；
- 新增 registry component 后必须读实际生成源码再 Review。

---

## 7. UI Skills 的角色

涉及新页面或明显 UI 改版，Coding Agent 先回答：

1. 用户在这个页面主要完成什么？
2. 第一视觉焦点是什么？
3. 主操作是否一眼可见？
4. 是否把 advanced capability 过早暴露？
5. 是否出现无信息价值 Card/Chart？
6. 是否可复用 shadcn 而不是造控件？
7. empty/error/slow/long-text/narrow-width 状态是什么？
8. 实际 Chrome 是否符合设计意图？

推荐链：

```text
Issue / user task
  ↓
UI Skills
  ↓
IA + progressive disclosure
  ↓
shadcn search/docs
  ↓
implementation
  ↓
Chrome DevTools MCP
  ↓
iterate
```

---

## 8. 信息架构

一级入口：

```text
Create Lab / Home
Scenarios
Runs
Sources / Drivers
Verification
Settings
```

Scenario detail：

```text
Overview
Builder
World
Sources
Timeline
Runs
Verify
Expert YAML
```

### 新建场景

M0/M1：

```text
What do you want to simulate?
[ AI prompt + examples ]

Start from
[ Guided Builder ] [ Template ] [ Expert YAML ]
```

### Import 的阶段边界

完整 Importer/Attachment pipeline 属于 **M5**。

M5 之前：

- 不放不可用的主 `Import` CTA；
- 不放 disabled fake button 假装产品已有能力；
- 如果仅内部实验 importer scaffold，不能当用户正式功能暴露。

M5 功能完成后再把 `Import` 加入 Create flow。

---

## 9. Visual Builder 设计边界

应该可视化：

- 数量、规模、范围；
- Sources 选择；
- 数据质量/脏数据比例；
- 简单关系模板；
- Timeline 常用动作；
- Fault 常用动作；
- resource estimate；
- capability diagnostics。

不应该变成：

- 任意表达式编辑器；
- DAG；
- 通用关系图拖拽建模；
- 每个 Driver 独立整页配置系统；
- 完整复制 DSL。

无法表达的高级配置进入 Expert YAML。

---

## 10. AI UX

assistant-ui 是正式基础，不写第二套聊天框。

### Create AI

创建/大改 Scenario 的主入口，可是 centered/focused composition，不要求固定右侧栏。

### Context Assistant — M5 完整化

Scenario/World/Sources/Timeline/Verify 中按上下文打开，可使用 Sheet/Resizable/dedicated workspace。布局通过 UI Skills + real Chrome 决定，不继承 DLR 固定侧栏宽度。

### Human-in-the-loop

```text
Prompt
  ↓
Candidate + base_semantic_digest
  ↓
server validation + estimate
  ↓
structured changes
  ↓
User Apply
  ↓
Working Copy
  ↓
User Save
  ↓
User Compile
  ↓
User Start
```

AI 不自动 Save/Compile/Start/Stop/Fault/Docker/Secret。

### Minimum stale protection — M1

如果 current semantic digest != candidate base semantic digest：

- 不允许 blind Apply；
- 明确提示 Working Copy 已变化；
- 最低可选择重新生成/放弃/查看差异。

M5 再做 frozen snapshot、3-way compare、rebase、Regenerate。

---

## 11. Structured Diff First

AI/Builder 大改场景时先显示：

```text
+ 1 site
+ 200 servers
+ 1 vCenter source
~ Excel refresh: every step → frozen
+ 2% wrong-IP defect
```

再提供 “查看 YAML Diff”。

Raw YAML Diff 不应是普通用户理解变化的唯一方式。

---

## 12. Chrome DevTools MCP 完成定义

`npm run build = PASS` 不是 UI 完成。

每个 UI Wave 必须真实检查：

- 主流程实际点击；
- screenshot / visual hierarchy；
- Console；
- Network 4xx/5xx/duplicate/slow requests；
- loading/empty/error；
- keyboard/focus；
- long Chinese/English labels；
- 1024 / 1280 / 1440 / 1920；
- heavy page performance trace；
- large table / Truth / findings 渲染；
- AI Candidate state；
- Builder ↔ Expert YAML semantic synchronization。

Chrome DevTools MCP 用于探索/调试；稳定路径用 Playwright 回归。

---

## 13. Frontend Error States

至少正式设计：

```text
AI provider not configured
AI provider unavailable/timeout
invalid Candidate
stale Candidate
validation error
resource hard-limit exceeded
Driver unavailable on this host
Control unavailable
Agent unavailable
Compile failed
Run partial/failed
Observation/Verify failed
Builder contains advanced fields
```

错误信息要可操作，不只显示“请求失败”。

---

## 14. 大数据 UI

Truth/Source/Verification 可能达到 10k–100k。

要求：

- server-side pagination/filter where suitable；
- virtualization；
- bounded detail payload；
- 不一次渲染 100k DOM rows；
- long ID/URL copy/overflow；
- heavy interaction 在 Chrome performance trace 验收；
- loading 与真实卡顿不能混淆。

---

## 15. 前端安全边界

- provider secret server-side；
- generated credential 不永久明文展示；
- raw capture/import 未脱敏不进 AI；
- screenshot/evidence 不含生产 secret；
- Chrome DevTools MCP 浏览器只加载 test data；
- AI approval UI 不等于模型获得执行权限；
- destructive actions 明确人工确认。

---

## 16. 跨 Wave 红线

从 M0 到 M6：

- AI-first / Builder / Expert YAML 层级不倒退；
- Monaco 不重新成为默认首页；
- shadcn/ui 是唯一主要通用组件体系；
- assistant-ui 是 AI UX 基础；
- UI Skills 用于 design engineering；
- Chrome DevTools MCP 用于 real-browser verification；
- Playwright 固化 regression；
- 不引入 Ant Design；
- 不复制 DLR UI；
- Import 不在 M5 前伪装成已完成产品能力；
- UI 完成必须有真实 Chrome evidence。