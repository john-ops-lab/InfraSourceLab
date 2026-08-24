# InfraSourceLab 前端产品与设计工程方案

## 1. 决策摘要

InfraSourceLab 前端不再以 DataLinkRuntime 的视觉体系、Ant Design 组件体系或页面布局作为实现基线。

新的前端基线由四部分组成：

1. **UI Skills** — `ibelick/ui-skills`：给设计/编码 Agent 使用的设计工程方法、playbook 与技能库；
2. **shadcn/ui** — `shadcn-ui/ui`：主要 UI 组件与可维护的源码级组件体系；
3. **assistant-ui** — `assistant-ui/assistant-ui`：AI 对话、Composer、Message、Tool UI、附件与流式交互等 AI UX 基础；
4. **Chrome DevTools MCP** — `ChromeDevTools/chrome-devtools-mcp`：让编码 Agent 在真实 Chrome 中点击、截图、检查 Console/Network、分析性能与响应式结果。

这四者职责不同：

```text
UI Skills             → 设计方法 / Agent 设计约束
shadcn/ui              → 产品 UI 组件与设计系统
assistant-ui           → AI 交互组件与 runtime primitives
Chrome DevTools MCP    → 真实浏览器实现检查与迭代闭环
```

**UI Skills 和 Chrome DevTools MCP 是开发/验收工具，不是产品运行时依赖。**

---

## 2. 产品交互原则：AI-first，不把 YAML 暴露成主流程

InfraSourceLab 的底层资产仍然是版本化 Scenario，但普通用户不应该先学习 Scenario DSL。

正式交互分三层：

```text
A. AI Create / Describe Lab        默认入口，覆盖大多数创建需求
B. Visual Scenario Builder         可视化精调常用能力
C. YAML Expert Mode                Monaco 专家模式 / 精确控制 / 排障
                  ↓
             Scenario Working Copy
                  ↓
        Validate / Estimate / Preview
                  ↓
              Save Revision
                  ↓
             Compile / Start
```

### 2.1 A — AI Create 是默认入口

首页/新建场景的第一主操作应是：

> “描述你想模拟的 IT 环境”

示例：

```text
模拟一家中型企业，上海和苏州两个数据中心，
400 台物理机、1500 台 VM、3 个 Kubernetes 集群、200 个应用。
数据来自 vCenter、SNMP、Redfish 和 Excel，
Excel 比真实状态晚一个版本，并制造少量 IP/hostname 冲突。
```

平台返回的是**结构化可确认摘要**，而不是先把 200 行 YAML 丢给用户：

```text
基础设施
2 sites · 50 racks · 400 servers · 1500 VMs · 3 K8s clusters · 200 apps

Sources
2 vCenter · 120 SNMP agents · 400 Redfish endpoints · 1 Excel artifact

Data quality
3% hostname case drift · 2% wrong IP · Excel stale by 1 version

Estimated runtime
7 services · ~1.3 GiB memory
```

主操作：

```text
[创建场景] [可视化调整] [查看高级 YAML]
```

### 2.2 B — Visual Builder 是第二入口

Visual Builder 不是低代码 Workflow 编辑器，而是 Scenario 常用语义的可视化表单。

第一版建议分为：

```text
Environment
  ├─ Sites / racks / servers / VMs / applications
  ├─ Kubernetes scale
  └─ IP/address ranges

Sources
  ├─ source type / driver
  ├─ quantity / scope
  └─ authentication test profile

Data Quality
  ├─ missing fields
  ├─ aliases / case drift
  ├─ duplicate records
  ├─ stale source
  └─ wrong relationships

Timeline & Faults
  ├─ lifecycle steps
  ├─ source refresh/freeze
  └─ latency / timeout / protocol faults
```

Visual Builder 与 YAML 必须是**同一个 Working Copy 的两个视图**，不能维护两份互相漂移的数据模型。

### 2.3 C — YAML Expert Mode

Monaco 只用于：

- 专家精确编辑；
- 查看 AI/Visual Builder 生成结果；
- 复制/分享 Scenario；
- 高级字段；
- 调试 validation；
- Diff / revision history。

普通用户不需要读 YAML 才能完成核心流程。

---

## 3. Runtime 前端技术栈

建议第一阶段：

| 层 | 选型 |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 7 |
| Styling | Tailwind CSS v4 |
| UI components | shadcn/ui |
| Icons | shadcn 项目 preset 对应 icon library；默认优先 Lucide，如 preset 不同则遵循项目配置 |
| AI UX | assistant-ui |
| Expert editor | Monaco Editor |
| i18n | i18next + react-i18next |
| Unit/component test | Vitest + Testing Library |
| Browser regression | Playwright |
| Agent browser inspection | Chrome DevTools MCP |

### 明确不使用

- Ant Design；
- Ant Design Pro Components；
- DLR Design System；
- 从 DLR 复制 CSS / Shell / Catalog；
- 为常规控件自建第二套 Button/Dialog/Table/Form。

---

## 4. shadcn/ui 使用规则

shadcn/ui 是源码级组件体系，不是“安装后不可改的黑盒组件库”。但必须遵循组件优先和一致性原则。

### 4.1 先找现成组件，再写自定义 UI

开发时顺序：

```text
npx shadcn@latest info
        ↓
search / docs / view
        ↓
复用已有 shadcn component/block
        ↓
组合现有组件
        ↓
确实没有合适抽象时才写自定义组件
```

### 4.2 主要组件映射

| ISL 需求 | 优先组件 |
|---|---|
| App navigation | Sidebar / NavigationMenu / Breadcrumb |
| Builder forms | Field / FieldGroup / Input / Select / Checkbox / Slider / ToggleGroup |
| Scenario summary | Card / Badge / Separator |
| Source list / findings | Table / Pagination / ScrollArea |
| Secondary details | Sheet / Drawer / Dialog |
| Confirmation | AlertDialog |
| Tabs | Tabs |
| Search / command | Command / Combobox |
| Empty state | Empty |
| Loading | Skeleton / Spinner |
| Feedback | Alert / sonner |
| Layout resizing | Resizable |
| Metrics | Chart when a chart actually improves understanding |

### 4.3 设计系统规则

- 使用 semantic tokens，不在业务组件里到处写任意颜色；
- `className` 主要用于布局、spacing 与响应式组合，不重复覆盖组件本身颜色/字体；
- form 使用规范的 Field 组合与 aria-invalid；
- destructive action 使用明确 confirmation；
- Dialog/Sheet/Drawer 必须有可访问 Title；
- 状态不能只靠颜色表达；
- Loading/Empty/Error 都必须有正式状态；
- 大列表必须分页/虚拟化，禁止 10k/100k DOM 一次渲染。

---

## 5. UI Skills 的角色

`ui-skills` 作为**设计工程 Agent 的强制参考层**，而不是 npm runtime dependency。

涉及新页面或明显视觉改版时，Qoder/Codex/Claude 应先使用 UI Skills 查对应能力，而不是只凭模型默认审美直接写 JSX。

推荐工作方式：

```text
产品任务 / 页面目标
      ↓
UI Skills playbook / relevant skill
      ↓
信息架构与交互草图
      ↓
shadcn 组件搜索与组合
      ↓
实现
      ↓
真实 Chrome 检查
      ↓
视觉 / 交互 / 响应式迭代
```

### 前端实现前的设计自检

至少回答：

1. 用户在这个页面最主要完成什么？
2. 页面第一视觉焦点是什么？
3. 主操作是否一眼可见？
4. 是否把高级能力过早暴露给普通用户？
5. 是否出现没有信息价值的 Card/图表/装饰？
6. 是否可以用现成 shadcn 组件而不是自造控件？
7. 空/错/慢/长文本/窄屏状态是什么？
8. 真实 Chrome 中是否与设计意图一致？

---

## 6. 信息架构：围绕“创建实验环境”而不是“编辑文件”

推荐一级信息架构：

```text
Create Lab / Home
Scenarios
Runs
Sources / Drivers
Verification
Settings
```

### Scenario detail

一个 Scenario 内部建议：

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

其中：

- **Overview / Builder** 是普通用户主路径；
- **Expert YAML** 是高级入口，不能默认抢占主视觉；
- World/Sources/Timeline/Verify 是运行与验证能力。

### 新建场景

不直接进入空 Monaco。

应该优先出现：

```text
What do you want to simulate?
[ AI prompt / examples ]

or

Start from
[ Guided Builder ] [ Template ] [ Import ] [ Expert YAML ]
```

---

## 7. Visual Builder 设计边界

Builder 解决高频 80% 场景，不追求映射 Scenario DSL 的每一个字段。

### 应该可视化

- 数量、规模、范围；
- Sources 选择；
- 数据质量/脏数据比例；
- 简单拓扑/关系模板；
- Timeline 常用动作；
- Fault 常用动作；
- 资源估算；
- capability validation。

### 不应该可视化成复杂低代码系统

- 任意表达式编辑器；
- 通用 DAG；
- 任意关系图拖拽建模；
- 每个 Driver 私有参数都做永久专属大页面；
- 为了避免 YAML 而把高级 DSL 完整复制成 200 个表单字段。

无法被 Builder 表达的高级配置进入 Expert YAML。

---

## 8. AI Assistant 设计

assistant-ui 是 AI UX 的正式基础，不自己写简化聊天框。

assistant-ui 提供的能力按需要组合：

- Thread / Message / Composer；
- streaming；
- retry / regenerate；
- attachments；
- markdown / code；
- tool-call / generative UI；
- accessibility / keyboard；
- custom runtime。

### 8.1 AI 在产品里的两种形态

#### Create AI — 主入口

用于“从一句话创建/大改 Scenario”。

界面不是右侧边栏优先，而可以是页面中心主任务：

```text
Describe your lab
[ large composer ]
[ example chips ]
       ↓
structured proposal
       ↓
review / visual adjust / create
```

#### Context Assistant — 工作区助手

用户进入某个 Scenario 后，再提供随上下文工作的 Assistant：

- 修改当前 Scenario；
- 解释 compile diagnostics；
- 解释 Source capability；
- 分析 verification findings；
- 根据选中对象建议 Timeline/Fault。

它可以使用 Sheet / resizable panel / focused AI workspace，具体布局通过真实浏览器迭代决定，不继承 DLR 固定 360–448px 侧栏规则。

### 8.2 Human-in-the-loop

AI 输出：

```text
Prompt + current model + capabilities
        ↓
Scenario Candidate
        ↓
server validation + resource estimate
        ↓
structured summary / visual changes / diff
        ↓
user Apply
        ↓
Working Copy
        ↓
user Save / Compile / Start
```

AI 不自动：

```text
Save Revision
Start / Stop Run
Step Timeline
Enable destructive Fault
Install Driver
Pull arbitrary image
Execute shell
Read secrets
```

---

## 9. Monaco / Diff / Revision UX

Monaco 仍然重要，但定位改变为 Expert Mode。

需要：

- YAML schema completion；
- syntax diagnostics；
- semantic diagnostics；
- capability diagnostics；
- quick links from error to Builder/Source capability；
- Working Copy dirty state；
- Candidate Diff；
- Revision Diff；
- revision history；
- light/dark/system editor theme if useful。

Diff 不应该只给 YAML 专家看。AI/Builder 发生较大变化时，应先展示结构化摘要：

```text
+ 1 site
+ 200 servers
+ 1 vCenter source
~ Excel refresh: every step → frozen
+ 2% wrong-IP defect
```

再允许“查看 YAML Diff”。

---

## 10. Chrome DevTools MCP：前端完成定义的一部分

前端不能以：

```text
npm run build = PASS
```

作为 UI 完成。

涉及 UI 的每个 Wave 必须让 Agent 使用真实 Chrome 检查。

### 必查

- 实际点击主流程；
- screenshot / visual hierarchy；
- Console error/warning；
- Network failure / duplicate requests / 4xx/5xx UX；
- loading / empty / error；
- keyboard/focus；
- long Chinese/English labels；
- 1280 / 1440 / 1920 desktop；
- 1024 窄桌面；
- 需要支持移动场景时再加入手机尺寸，不为实验平台强行做 mobile-first；
- performance trace for明显重页面；
- 大表/Truth Graph/Verification finding 页面是否卡顿。

### Chrome DevTools MCP 与 Playwright 的关系

```text
Chrome DevTools MCP
    → Agent 在开发阶段探索、调试、看 Console/Network/性能、截图评审

Playwright
    → 把稳定的核心浏览器行为固化成 CI regression
```

两者都保留，职责不同。

### 隐私

Chrome DevTools MCP 能读取浏览器页面和 DevTools 数据；浏览器验收不得在页面中加载真实生产密码、Token 或个人敏感数据。

---

## 11. 前端视觉方向

不继承 DLR 风格，也不把“现代 SaaS Dashboard”当模板。

InfraSourceLab 应该呈现：

- 专业的 design-engineering 工具；
- 清晰、安静、有层级；
- 创建实验环境是主任务；
- 复杂信息渐进披露；
- 大量数据时仍高信息密度；
- 使用图形/拓扑只有在能帮助理解关系时；
- 不为了“高级感”堆渐变、玻璃拟态、大面积指标 Card；
- icon 使用标准 icon library，不使用中文文字模拟图标；
- status / health / warning 语义统一；
- light/dark 可后续根据 shadcn token 低成本支持，但 M0 不应因主题拖慢核心流程。

视觉最终以 **UI Skills 指导 + shadcn 组合 + Chrome 实机迭代** 得到，而不是把某个旧产品截图当硬规范。

---

## 12. M0 前端完成基线

M0 不要求把最终所有页面做完，但必须建立正确方向：

### Create

- AI-first 新建入口（M0 使用 deterministic fake assistant 即可）；
- Visual Builder skeleton 能创建一个基础 Scenario Working Copy；
- Templates / Expert YAML 作为次入口。

### Scenario

- Scenario list；
- Overview；
- Builder；
- Expert YAML；
- immutable Revision save/history；
- Control / Agent health。

### AI

- assistant-ui 正式 primitives；
- fake Prompt → structured Scenario Candidate；
- candidate summary；
- Apply only changes Working Copy；
- no implicit Save/Run。

### Browser quality

- Chrome DevTools MCP 完整走一遍创建流程；
- Console/Network 无异常；
- 1280/1440/1920 主布局通过；
- Playwright 固化关键路径。

---

## 13. M1 前端完成基线

M1 Scenario Schema/Compiler 成型后，产品就应真正进入 AI-first：

- OpenAI-compatible basic provider；
- prompt → Scenario Candidate；
- server schema/semantic/capability/resource validation；
- Visual Builder 与 AI 输出双向使用同一 Working Copy；
- compile preview；
- World/Sources preview；
- structured change summary；
- Apply → Save → Compile → Start 的清晰边界。

因此**基础 AI authoring 不等到 M5**。

M5 再做高级能力：attachments/importers、tool calls、context snippets、Regenerate/frozen snapshots、复杂 verification explain 等。

---

## 14. 禁止回退的前端红线

- 不把 Monaco YAML 重新变成默认首页；
- 不引入 Ant Design 作为第二套组件系统；
- 不从 DLR 大量复制 CSS/布局；
- 不为 shadcn 已有组件再造 Button/Dialog/Select/Table 等基础件；
- 不做“AI 聊天框只是 textarea + fetch”的临时实现后永久遗留；
- 不让 AI 直接执行 Lab 高权限动作；
- 不把所有高级参数一次性暴露在表单上；
- 不以 build 通过代替真实浏览器 UX 验收；
- 不允许没有 Chrome 截图/Console/Network 检查就宣布一个大 UI Wave 完成。

---

## 15. 参考项目

- UI Skills: https://github.com/ibelick/ui-skills
- shadcn/ui: https://github.com/shadcn-ui/ui
- assistant-ui: https://github.com/assistant-ui/assistant-ui
- Chrome DevTools MCP: https://github.com/ChromeDevTools/chrome-devtools-mcp

这些是当前前端开发的正式基线；DataLinkRuntime 只作为业务经验来源，不再作为视觉、组件或页面实现参考。