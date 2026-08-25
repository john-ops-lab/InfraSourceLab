# Qoder 前端工具使用约束

> **状态：设计阶段，尚未开始前端实现。**
>
> 本文用于约束未来的 Qoder 开发过程，不表示这些工具已经安装、集成或完成验证。

## 1. 必须使用的工具

InfraSourceLab 的前端开发必须使用以下四项工具或项目。它们不是“可参考资料”，而是 Issue #1 和后续前端功能的正式开发要求。

### 1.1 UI Skills

项目地址：

https://github.com/ibelick/ui-skills

职责：

- 在写代码前确认页面主任务；
- 设计信息层级、组件顺序和页面尺寸；
- 避免无意义卡片、仪表盘和高级配置堆叠；
- 设计空状态、错误状态、加载状态和长文本状态；
- 确定 1024～1920 像素桌面宽度下的布局策略；
- 指导实现后的视觉检查和迭代。

使用要求：

- 新页面或较大界面改动开始前，先完成 UI Skills 要求的设计判断；
- 不能先随意堆组件，再把“使用 UI Skills”写进完成报告；
- Issue 完成报告中至少记录 3～5 条真实影响实现的设计决定。

### 1.2 shadcn/ui

项目地址：

https://github.com/shadcn-ui/ui

职责：

- 作为前端组件和视觉体系的首选基础；
- 提供表单、表格、页签、抽屉、对话框、提示、空状态和加载状态等通用组件；
- 保持创建页、数据页和 AI 界面使用同一套语义变量与交互风格。

使用要求：

- 实现常见控件前先查询 shadcn/ui 当前组件和用法；
- 优先组合现有组件，再考虑自定义基础控件；
- 不得同时引入 Ant Design 或第二套大型通用组件库；
- 不复制 DLR 的 CSS、应用外壳或组件体系；
- 首次初始化后固定 `components.json`、Tailwind v4 主题、基础色、图标库和导入别名，不反复重建第二套预设。

### 1.3 Chrome DevTools MCP

项目地址：

https://github.com/ChromeDevTools/chrome-devtools-mcp

职责：

- 让 Codex、Claude 或其他兼容开发代理直接操作真实 Chrome 页面；
- 点击、输入、切换页签和验证主流程；
- 截图并检查页面真实视觉效果；
- 查看 Console 错误和警告；
- 查看 Network 请求、失败请求和重复请求；
- 检查性能、长列表和响应式布局；
- 验证不同宽度、错误状态和边界状态。

使用要求：

- Chrome DevTools MCP 是前端完成门槛，不是可选辅助工具；
- `npm run build`、单元测试或 Playwright 通过，不能替代真实 Chrome 检查；
- 如果 Qoder 当前环境无法直接调用 Chrome DevTools MCP，必须由能够调用它的 Codex、Claude 或其他兼容代理完成最终浏览器验收；
- 没有 Console、Network、截图、主流程和响应式证据时，不得把前端标记为“等待审查”。

### 1.4 assistant-ui

项目地址：

https://github.com/assistant-ui/assistant-ui

职责：

- 用于创建页面的自然语言输入体验；
- 展示用户和助手消息；
- 处理加载、取消、错误和重试；
- 展示结构化 `GenerationSpec` 建议；
- 与 shadcn/ui 和 Tailwind 语义变量保持一致。

使用要求：

- Issue #1 的 AI 创建体验必须基于 assistant-ui；
- 不得重新手写一套通用聊天消息、输入区和运行状态框架；
- 可以围绕产品需要定制结构化建议卡片，但不能把 assistant-ui 扩张成多会话 AI 平台；
- AI 输出必须经过后端 `GenerationSpec` 校验，界面不能直接相信模型文本。

### 1.5 Playwright 的定位

Playwright 继续用于自动化回归：

```text
Chrome DevTools MCP → 真实页面探索、调试、截图、Console、Network、性能和响应式验收
Playwright           → 将稳定的核心路径固化为自动化回归
```

二者缺一不可，Playwright 不能替代 Chrome DevTools MCP。

## 2. 唯一产品主流程

```text
录入 API Key
→ 输入提示词或选择模板
→ 查看 GenerationSpec 摘要
→ 调整数量和 seed
→ 生成数据集
→ 浏览 CI 和关系
→ 复制 API 或导出
```

所有前端设计都围绕这条链路。

不要设计：

- 运行、来源或代理仪表盘；
- 时间线、故障或验证中心；
- Monaco 或 YAML 编辑器；
- 未来功能的假导航；
- 多会话 AI 产品；
- 拖拽式建模平台。

## 3. UI Skills 使用要求

新页面实现前，至少回答：

1. 用户在这里要完成哪一个主任务？
2. 主操作是否一眼可见？
3. 是否存在不必要的卡片、图表或高级配置？
4. 空状态、错误状态和慢响应如何显示？
5. 1024 像素宽度是否还能完成操作？
6. 组件顺序、尺寸和密度是否符合主流程？

关键决定记录在 Issue #1 的完成报告中，不需要长篇设计报告，但必须能对应到真实页面实现。

## 4. shadcn/ui 使用要求

首次初始化时固定：

- `components.json`；
- Tailwind v4 主题和语义变量；
- 组件样式、基础色和图标选择；
- 导入别名。

后续不得重新初始化第二套预设。

优先组件：

```text
Button
Card
Field / Input / Select
Table / Pagination
Tabs
Sheet
Alert / Empty / Skeleton
AlertDialog
Sonner
DropdownMenu
Badge
```

这些是组件名，实施时先查询当前 shadcn registry 和官方文档。只有现成组件不能解决时才自定义基础控件。

## 5. assistant-ui 使用要求

assistant-ui 只用于创建页面：

- 输入区；
- 消息；
- 加载、取消和错误；
- 结构化 `GenerationSpec` 建议；
- 重试。

不做：

- 附件；
- 工具调用；
- 长期会话管理；
- 复杂上下文助手；
- Agent 执行。

assistant-ui 必须使用同一套 shadcn 和 Tailwind 语义变量，不能形成第二套 AI 视觉系统。

## 6. 数据表格要求

CI 和关系数据必须：

- 使用后端分页；
- 支持类型筛选；
- 支持关键字筛选；
- 明确总数、页码和每页数量；
- 通过侧边抽屉展示行详情；
- 有加载、错误和空状态。

禁止一次请求并渲染完整万级数据集。

## 7. Chrome DevTools MCP 检查

实现完成后，必须真实操作：

```text
录入正确 API Key
→ 输入提示词或选择模板
→ 查看并调整 GenerationSpec
→ 生成数据集
→ 查看 CI 分页和筛选
→ 查看关系
→ 复制 curl
→ 下载导出文件
```

错误和边界路径：

- 错误 Key 返回 401；
- AI 未配置时使用模板；
- Provider 错误；
- 规格校验错误；
- 空数据集列表；
- 长提示词和长名称；
- 加载中取消或重复操作；
- 万级数据分页。

桌面宽度：

```text
1024
1280
1440
1920
```

检查：

- 页面身份和目标路由；
- 页面不是空白或错误覆盖层；
- Console 错误和警告；
- 失败或重复的 Network 请求；
- 内容溢出、遮挡和错误换行；
- 焦点和键盘操作；
- 万级分页表格的响应性；
- 主要操作后的真实状态变化；
- 截图是否与 UI Skills 的设计判断一致。

截图只覆盖核心页面和关键错误，不制作无意义的截图矩阵。

## 8. Playwright 回归

至少固定一条主路径：

```text
设置 API Key
→ 使用假 Provider 或模板规格
→ 生成数据集
→ 打开数据集
→ 筛选 CI
→ 打开关系页签
→ 复制 API 或触发导出
```

另外至少包含一个认证失败测试。

## 9. 完成报告

Issue #1 真正实现后，用中文记录：

- UI Skills 的 3～5 条关键决定；
- shadcn/ui 的初始化配置、主要组件和自定义组件原因；
- assistant-ui 的集成方式及其负责的界面范围；
- Chrome DevTools MCP 的版本或提交、执行代理和检查路径；
- 检查宽度、Console、Network、性能和响应式结果；
- Playwright 测试命令和结果；
- 截图位置；
- 已知界面限制。

目前这些项目均未执行，不得提前填写为已完成。

## 10. 停止规则

当以下路径顺畅可用时，就停止首版界面扩展：

```text
描述需求
→ 生成
→ 浏览
→ 使用 API 或导出
```

不要因为页面数量少而增加仪表盘、统计中心、拓扑编辑器、设置中心或其他平台页面。