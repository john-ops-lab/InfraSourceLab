# DLR 前端与 AI 交互复用方案

## 1. 目标

InfraSourceLab 不应该再从零设计一套 Web Console。

DataLinkRuntime 已经经过多轮 UI、真实浏览器验收和 AI Assistant 交互收敛。ISL 与 DLR 都属于开发者/运维工程工具，用户认知也接近，因此优先：

> **复用 DLR 的技术栈、Design System、Shell、工作台布局和 AI 交互模式；只替换业务领域。**

当前参考基线：`john-ops-lab/DataLinkRuntime@main`，调研日期 2026-08-24。

---

## 2. DLR 当前前端基线

`web/package.json`：

| 类别 | DLR 当前 |
|---|---|
| React | 19 |
| TypeScript | ~5.8 |
| Vite | ^7 |
| Ant Design | 5.29.3 |
| Ant Design Pro Components | 2.8.10 |
| icons | @ant-design/icons 5.6.1 |
| Monaco | monaco-editor ^0.56 / @monaco-editor/react ^4.7 |
| AI UI | @assistant-ui/react ^0.15.15 |
| AI Markdown | @assistant-ui/react-markdown ^0.14.11 |
| i18n | i18next + react-i18next |
| Markdown | remark-gfm |
| unit/component tests | Vitest + Testing Library |
| browser tests | Playwright |

ISL M0 建议直接采用同一主栈，不再评估 Tailwind/shadcn/MUI 等另一套基础 UI。

原因：

- 两个项目都由同一开发者维护；
- UI 风格一致比“每个项目追一次新框架”更有价值；
- 能复制已经验证的 interaction contract；
- Qoder 更容易参考现有实现；
- 未来可能抽取真正稳定的共享设计包。

---

## 3. Design System 直接复用

DLR `web/src/design-system.tsx` 当前是很薄的 Ant Design Provider：

```text
colorBgLayout = #f5f6f8
borderRadius = 4
zh-CN / en Ant locale
```

DLR `index.css` root tokens：

```text
shell bg          #f5f6f8
workspace bg      #ffffff
border            #e5e7eb
border strong     #d9dde3
text              #1f2430
text secondary    #5f6672
text weak         #8c939f
header height     48px
mono font         ui-monospace / SFMono / Menlo / Consolas
```

### ISL 要做

复制这些通用 token 和 ConfigProvider 结构，把变量前缀改成 `--isl-*`，不要引入第二套主题系统。

### 不要机械复制

- DLR Adapter 状态颜色语义；
- Worker/Webhook 专属 token；
- DLR logo 文案；
- 只为历史迭代保留的 CSS。

---

## 4. Application Shell 复用

DLR `components/ApplicationShell.tsx` 已有：

- 48px 紧凑 TopBar；
- 产品标识；
- health 状态；
- runtime/worker 状态区域；
- 右上角用户/设置菜单；
- fixed viewport shell。

ISL 改造成：

```text
ISL | InfraSourceLab
Control health
Lab Agent health
Active Run summary
Settings
```

MVP 单人本地使用时不需要一开始复制 DLR 完整账号/用户管理。

---

## 5. Catalog + Workbench 信息架构复用

DLR 当前最重要的布局改进是：

```text
左侧高密度 Catalog
+ 中间主 Workbench
+ 右侧可展开 AI Assistant
```

并且 Catalog 使用**行式高密度列表而不是每项一个 Card**。

ISL 对应映射：

| DLR | InfraSourceLab |
|---|---|
| Adapter Catalog | Scenario Catalog |
| Adapter Workbench | Scenario Workbench |
| Version | Scenario Revision |
| Save | Save Revision |
| Run Adapter | Compile / Start Lab |
| Runtime | Sources / Lab Run |
| History | Run History |
| Live Log | Run / Source Logs |

### ISL Workbench Tabs

建议：

```text
Editor
World
Sources
Timeline
Runs
Verify
```

其中 Monaco 的 YAML Editor 仍然是主创作界面。

---

## 6. Monaco 复用

DLR 已处理：

- dark/light/system theme；
- localStorage preference；
- DiffEditor；
- stale model / reopen 相关回归；
- editor selection → AI context。

ISL 可以复用：

- Monaco theme hook；
- Diff modal pattern；
- selection snapshot pattern；
- editor lifecycle tests。

新增 ISL 特有能力：

- Scenario YAML JSON Schema diagnostics；
- completion；
- semantic diagnostics；
- go-to source/driver capability help；
- compile preview。

不要引入第二个 YAML 编辑器。

---

# 7. AI Assistant：直接复用“交互骨架”，替换业务对象

DLR 当前 `AiAssistantPanel.tsx` 已经做了大量很难一次写对的工作：

- assistant-ui External Store Runtime；
- Browser/业务状态仍由 DLR 自己掌握；
- user/assistant visible messages；
- Markdown/GFM；
- Composer keyboard contract；
- Regenerate；
- attachment adapter；
- context snippets；
- read-only Tool Call UI；
- progress lifecycle；
- maximize/restore **不卸载同一 runtime**；
- Candidate → Diff → Apply；
- stale/late-response isolation；
- 不展示 hidden reasoning；
- attachments 不进日志/历史；
- strict candidate validation。

这些都应该成为 ISL AI UX 的起点，而不是重新写一个 textarea + fetch。

---

## 8. AI 业务映射

### DLR

```text
Working Copy (Adapter code)
  + User Prompt
  + Context
       ↓
Candidate code
       ↓
Diff
       ↓
Apply
```

### ISL

```text
Working Copy (scenario.yaml)
  + User Prompt
  + Context/Attachment
  + Driver Capabilities
  + Scenario Schema
       ↓
Scenario Candidate
       ↓
Parse + Schema + Semantic + Capability Validation
       ↓
Diff
       ↓
Apply to browser Working Copy
```

### 同样的 Human-in-the-loop 合同

AI **不会自动**：

```text
Save Revision
Compile as authoritative revision
Start Lab
Step Timeline
Stop Lab
Delete Run
Install Driver
Pull arbitrary image
```

最终运行始终由用户明确触发。

---

## 9. AI 面板布局复用

DLR 现有模式：

### Collapsed

- 右侧悬浮 40px icon；
- 默认不压缩主工作区；
- 可拖动；
- 不持久化位置。

### Expanded

- `clamp(360px, 30vw, 448px)` 右侧栏；
- neutral workspace surface；
- 顶部 2px 蓝色上下文标记；
- context / snippets / messages / composer。

### Maximized

- 同一个 panel instance `position:absolute; inset:0`；
- **不 remount runtime**；
- 草稿、附件、会话、正在进行的 request 不丢失。

ISL 原样沿用这套行为。

---

## 10. Context Snippets 在 ISL 的语义

DLR context 来自 code/log selection。

ISL 扩展为：

```text
scenario selection
compile diagnostic
truth node/edge selection
source projection sample
run/source log selection
verification finding
```

用户必须显式“加入上下文”。不要偷偷把整个 Truth Graph 或所有日志塞给 AI。

发送后：

- 本轮 snapshot 冻结；
- 本轮成功进入 provider call 后消费待发送 snippet；
- 历史消息仍保留；
- 新 selection 不影响 Regenerate 的旧 snapshot。

沿用 DLR 已经验证的语义。

---

## 11. Attachment 设计

优先支持真正有助于生成 Scenario 的文件：

### M5 第一批

- OpenAPI/Swagger；
- AsyncAPI；
- JSON Schema；
- JSON/YAML sample；
- CSV/xlsx；
- HAR；
- Postman collection。

### 后续

- `.snmprec` / sanitized snmpwalk；
- YANG；
- Redfish mockup snippets；
- scrapli replay capture；
- logs。

继续复用 DLR 的原则：

- client precheck；
- server authoritative validation；
- count/per-file/total size caps；
- body 不渲染、不日志、不持久化到 thread；
- 明确隐私提示；
- 发送 snapshot 冻结。

---

## 12. Tool Calls 复用

DLR 的 Tool Call UI 已限定 read-only/sanitized summary。

ISL AI 可以开放只读工具：

```text
list_drivers
get_driver_capabilities
validate_scenario
estimate_scenario
query_scenario_schema
get_compile_diagnostics
inspect_verification_finding
```

禁止 AI tool：

```text
run_shell
start_container
install_driver
start_lab
stop_lab
delete_run
read_host_file
```

Tool result 给 UI/模型只发 bounded sanitized summary，不把 Docker env/secrets/raw capture 带进去。

---

## 13. Candidate 模型

不要让 AI 直接返回一整个任意 markdown block。

建议 wire response：

```json
{
  "message": "已将场景扩展为两个机房……",
  "candidate": {
    "summary": "增加第二机房与 vCenter source",
    "scenario_yaml": "...",
    "base_revision_id": 12
  }
}
```

服务端校验：

1. YAML 可解析；
2. 顶层 object；
3. schema；
4. semantic；
5. driver capability；
6. resource policy；
7. 不包含 arbitrary executable fields。

失败时 Candidate 不允许 Apply。

---

## 14. 前端复用代码清单

Qoder M0 可以参考/复制后改名的 DLR 通用模块：

### 高复用

```text
web/package.json 依赖组合
web/src/design-system.tsx
ApplicationShell.tsx 的结构
Monaco theme hook
VersionDiffModal 的通用 Diff 结构
AI Assistant assistant-ui primitives / layout
ai-markdown
AI maximize/restore interaction
AI external-store message/composer pattern
i18n bootstrap 与 zh-CN/en 文件组织
user-visible error normalization pattern
Vitest/Playwright setup
```

### 中等复用，需要明显领域重写

```text
AdapterCatalog → ScenarioCatalog
ExecutionHistory → RunHistory
LiveLogWorkspace → RunLogWorkspace
SystemSettings → ISL Settings
AI attachment helpers
AI context snippets
```

### 不复用

```text
Adapter CRUD types/API
Credential binding semantics
Task/Webhook lifecycle
Worker selection
Adapter ACL
Account Console（MVP）
Python/npm/Maven dependency editor
```

---

## 15. 暂不抽共享 npm package

虽然两个项目 UI 会高度相似，但当前不建议立刻创建：

```text
@john-ops-lab/design-system
```

原因：

- DLR 是已有项目，ISL 刚起步；
- 两边领域仍在变化；
- 过早共享会把一个项目的迭代阻塞到另一个；
- DLR 私有/ISL 公共的仓库边界会增加发布管理。

第一阶段做 **copy + adapt + documented parity**。

当至少三个组件在两个项目稳定半年并且改动总是同步时，再抽共享包。

---

## 16. 视觉准则

延续 DLR 现有风格：

- 工具型、紧凑、信息密度高；
- 主要工作区优先，不堆 Dashboard Cards；
- icon 优先于“最大化/缩小”中文文字按钮；
- 标准 Ant Design 交互，不发明特殊控件；
- 状态用 dot/tag + text，不只靠颜色；
- 长 ID/URL/translated labels 必须有 overflow/wrap 策略；
- keyboard/focus 可用；
- destructive action 明确确认；
- 大数据视图做 virtualization/pagination，不直接渲染 100k DOM rows。

---

## 17. M0 浏览器验收基线

至少在真实 Chrome/Playwright 验收：

- 1440px/1280px layout；
- Scenario Catalog 搜索/选中；
- Monaco YAML 编辑；
- revision save；
- tabs 切换；
- Control/Agent health；
- AI panel collapsed/expanded/maximized（可先 fake provider）；
- AI draft 在 maximize/restore 不丢；
- zh-CN/en；
- long scenario/source names；
- empty/loading/error states；
- keyboard focus；
- browser console 无 error。

前端不能只以 `npm run build` 作为 UI 完成标准。
