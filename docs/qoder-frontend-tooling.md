# Qoder 前端设计与真实浏览器工具链

## 1. 目的

InfraSourceLab 当前主要由 Qoder Go Mode 进行大 Wave 开发。前端质量不能只依赖模型默认审美或 `npm run build`，因此项目把以下四种能力组合成固定开发闭环：

```text
UI Skills
  ↓ design engineering guidance
shadcn/ui
  ↓ component composition
assistant-ui
  ↓ AI UX primitives
Chrome DevTools MCP
  ↓ real Chrome inspect / debug / performance
Playwright
  ↓ regression
```

其中 UI Skills 与 Chrome DevTools MCP 是**开发/验收工具**，不是 InfraSourceLab 产品运行时依赖。

---

## 2. Qoder 侧能力前提

Qoder CLI / Qoder CN CLI 支持：

- Skills；
- MCP Server；
- stdio MCP；
- HTTP / Streamable HTTP MCP；
- 项目级与用户级配置。

每个涉及前端的 Wave 开始前，先确认当前 Qoder 运行环境真的能看到所需 Skill/MCP，而不是在 Issue 里写了名字就默认已经生效。

建议在 Wave 开始报告里记录：

```text
UI Skills: available / version or source
Chrome DevTools MCP: connected / version
Chrome: version
shadcn CLI: version
assistant-ui: project package version (after scaffold)
```

第三方工具版本会变化，**实际使用版本必须以本 Wave 的验证结果为准**。

---

## 3. UI Skills

项目采用：

- Repo: `ibelick/ui-skills`
- MCP: `https://www.ui-skills.com/mcp`

用途：

- 页面主任务与信息架构；
- visual hierarchy；
- form / table / dense-data design；
- progressive disclosure；
- empty/loading/error；
- responsive / motion / accessibility；
- 避免模型随手生成“后台管理系统模板”。

### 推荐工作方式

```text
读目标 Issue
  ↓
明确用户主任务
  ↓
从 UI Skills 获取相关原则/skill
  ↓
写短设计说明
  ↓
再进入 shadcn 组件搜索和实现
```

不要把 UI Skills 当成“生成一张漂亮图”的工具；它是实现前的设计约束层。

---

## 4. shadcn/ui

项目以 shadcn/ui 作为唯一主要通用 UI 组件体系。

开发顺序：

```text
npx shadcn@latest info
        ↓
search / docs / view
        ↓
复用已有组件或 block
        ↓
组合
        ↓
确实没有合适能力时再自定义
```

关键规则：

- 不引入 Ant Design / Ant Design Pro；
- 不为 Button/Dialog/Table/Form/Empty/Skeleton 等基础件重复造轮子；
- 使用 semantic theme tokens；
- Dialog/Sheet/Drawer 保持 accessible title；
- Form 使用正确 Field/validation 语义；
- destructive action 明确确认；
- 状态不只靠颜色；
- 大数据表格分页/虚拟化。

shadcn 组件是复制到项目中的源码，加入后仍需读实际生成文件并 Review，不能因为来自 registry 就默认正确。

---

## 5. assistant-ui

AI 界面使用 `assistant-ui/assistant-ui` 的正式 primitives/runtime，不再自行写第二套 textarea + fetch 聊天框。

第一阶段重点：

- Thread / Message / Composer；
- structured Candidate UI；
- Apply approval；
- keyboard/accessibility；
- error/retry state。

后续 M5 增加：

- streaming；
- attachments；
- context snippets；
- tool-call / generative UI；
- cancel / retry / Regenerate；
- frozen snapshot；
- stale/rebase UX。

assistant-ui 只负责 AI UX/runtime primitives；Scenario/Working Copy/Candidate/权限等业务状态仍由 InfraSourceLab 自己定义。

---

## 6. Chrome DevTools MCP

项目采用 `ChromeDevTools/chrome-devtools-mcp` 给 Coding Agent 一双真实“浏览器眼睛”。

它用于：

- 点击真实页面；
- 截图检查 visual hierarchy；
- Console errors/warnings；
- Network 请求、失败、重复请求、慢请求；
- responsive widths；
- performance trace/insights；
- interaction debugging。

### Qoder MCP 配置示意

Qoder 支持 stdio 和 HTTP MCP。可以按 Qoder 当前版本文档配置，例如概念上：

```json
{
  "mcpServers": {
    "ui-skills": {
      "type": "http",
      "url": "https://www.ui-skills.com/mcp"
    },
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

这只是**配置形状示例**。实际配置位置、transport 字段和版本以当时 Qoder CLI 文档与 `/mcp` 实际连接结果为准。

### 版本策略

开发机首次安装可用 `@latest` 试用，但一个正式 Wave 开始后应：

1. 记录实际工作版本；
2. 在完成报告中记录版本；
3. 如果升级工具导致行为变化，重新执行浏览器 Gate；
4. 不把“上游 main 支持”当成“当前安装版本支持”。

---

## 7. Browser Gate

任何明显改 UI 的 Wave，完成前必须真实检查：

```text
1024
1280
1440
1920
```

至少：

- 主任务全路径点击；
- empty/loading/error；
- long Chinese/English text；
- keyboard/focus；
- Console；
- Network；
- screenshot；
- heavy page performance when applicable。

问题发现后要修复再验，不是把截图当作“完成证据”。

Chrome DevTools MCP 是探索/调试层；稳定路径最终用 Playwright 固化。

---

## 8. 浏览器安全

Chrome DevTools MCP 可以读取被调试页面及网络内容，因此：

- 开发/验收浏览器只使用 fake/test credentials；
- 不打开含真实生产 secret 的页面再交给 Agent；
- screenshot/evidence 不保留 token/password；
- raw capture/import 不在未脱敏时进入 AI/浏览器证据；
- CI Playwright 也只使用测试数据。

---

## 9. Qoder 无法使用某个工具时

工具连接失败**不能自动降低验收标准**。

处理顺序：

1. 修复 Qoder MCP/Skill 配置；
2. 如果当前 Qoder surface 确实不支持该能力，改用支持 MCP 的 Qoder CLI 或其他兼容 Coding Agent 完成同一浏览器 Gate；
3. 在 Issue completion report 明确记录实际使用的 Agent/工具/version；
4. 不允许以“build 通过”替代真实浏览器检查。

---

## 10. 每个前端 Wave 的最小证据

Issue 完成报告至少包含：

```text
Design
- UI Skills / playbook used
- key IA / interaction decisions

Components
- shadcn components reused
- custom components and why existing components were insufficient

Browser
- Chrome DevTools MCP/version
- widths checked
- flows checked
- Console result
- Network result
- performance result if applicable
- screenshots/evidence summary

Regression
- Playwright cases added/updated
```

这套证据是后续无 PR 外部 Review 的重要输入。