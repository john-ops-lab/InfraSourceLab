# Qoder 前端工具使用约束

## 1. 目的

这些工具用于帮助 Qoder 快速做出一个可用、清晰的简单界面，不是为了建立复杂设计流程。

```text
UI Skills             → 先确认页面主任务和层级
shadcn/ui              → 复用基础组件
assistant-ui           → Create 页自然语言输入
Chrome DevTools MCP    → 真浏览器检查
Playwright             → 固化核心路径
```

---

## 2. 唯一产品主流程

```text
API key
→ prompt / template
→ review GenerationSpec summary
→ adjust counts/seed
→ generate dataset
→ browse CI/relations
→ copy API / export
```

所有前端设计都围绕这条链路。

不要设计：

- Runs/Sources/Agents dashboard；
- Timeline/Fault/Verifier；
- Monaco/YAML editor；
- fake future navigation；
- 多会话 AI 产品；
- 拖拽式建模平台。

---

## 3. UI Skills

新页面实现前，只需要回答：

1. 用户在这里要完成哪一个主任务？
2. 主操作是否一眼可见？
3. 是否有不必要的 Card、图表或高级配置？
4. 空/错/慢状态如何显示？
5. 1024 宽度是否还能完成操作？

把关键决定记录在 #1 completion comment 即可，不需要长篇设计报告。

---

## 4. shadcn/ui

MVP 第一次初始化时固定：

- `components.json`；
- Tailwind v4 theme/tokens；
- style/base/icon choice；
- import aliases。

后续不重新初始化第二套 preset。

优先组件：

```text
Button
Card
Field/Input/Select
Table/Pagination
Tabs
Sheet
Alert/Empty/Skeleton
AlertDialog
Sonner
DropdownMenu
Badge
```

先查询当前 shadcn registry/docs。只有现成组件无法解决时才自定义基础控件。

---

## 5. assistant-ui

只用于 Create 页面：

- Composer；
- Message；
- loading/cancel/error；
- structured GenerationSpec proposal；
- retry。

不做：

- attachment；
- tool calls；
- long-term conversation management；
- Context Assistant；
- Agent execution。

assistant-ui 的外观必须使用同一套 shadcn/Tailwind tokens，不能形成第二套 AI 视觉系统。

---

## 6. 数据表格

CI 和关系数据必须：

- 后端分页；
- type filter；
- keyword filter；
- 明确 total/page/page_size；
- row detail Sheet；
- loading/error/empty。

禁止一次请求并渲染整个 10k 数据集。

---

## 7. Chrome DevTools MCP

完成后真实操作：

```text
录入正确 API Key
生成数据集
查看 CI 分页/筛选
查看关系
复制 curl
下载 export
```

错误路径：

- wrong key → 401 UX；
- AI unconfigured → template fallback；
- provider error；
- generation validation error；
- empty dataset list；
- long prompt/name。

宽度：

```text
1024
1280
1440
1920
```

检查：

- Console error/warning；
- failed/duplicate Network requests；
- overflow；
- focus/keyboard；
- 10k paginated table responsiveness。

截图只需覆盖核心页面和关键错误，不做无意义截图矩阵。

---

## 8. Playwright

至少固定一条主路径：

```text
set API key
→ use fake/template spec
→ generate
→ open dataset
→ filter CI
→ open relation tab
→ copy API or trigger export
```

以及一个 auth failure 测试。

---

## 9. 完成回报

在 #1 记录：

- UI Skills 的 3～5 条关键决定；
- shadcn preset/base/icon 与主要组件；
- assistant-ui 集成方式；
- Chrome DevTools MCP 版本；
- 检查流程、宽度、Console、Network；
- Playwright 结果；
- 截图位置；
- 已知 UI 限制。

---

## 10. 停止规则

当 `Prompt → Generate → Browse → API/Export` 顺畅可用，就停止 UI 扩展。

不要因为页面显得“太少”而增加 dashboard、统计中心、拓扑编辑器、设置中心或其他平台页面。