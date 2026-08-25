# InfraSourceLab 前端设计

> **状态：设计阶段，前端代码尚未开始。**
>
> 本文描述目标界面和验收方式，不代表页面、组件或浏览器测试已经存在。

## 1. 前端目标

前端只需要帮助用户完成：

```text
创建数据集
→ 查看 CI 与关系
→ 复制 API 调用方式
→ 导出数据
```

不要把简单工具做成复杂运维平台、数据治理后台或低代码编辑器。

## 2. 必须使用的设计与组件组合

Issue #1 以及后续前端功能必须实际使用以下四项工具或项目：

1. **UI Skills**  
   https://github.com/ibelick/ui-skills

   用于编码前确认页面主任务、信息层级、组件排布、尺寸、状态和响应式策略。不能先堆出页面，再把 UI Skills 作为形式化说明补到报告中。

2. **shadcn/ui**  
   https://github.com/shadcn-ui/ui

   作为组件和视觉体系的首选基础，并与 Tailwind CSS v4 配合使用。常见控件必须先查询和复用 shadcn/ui，再考虑自定义基础组件。

3. **Chrome DevTools MCP**  
   https://github.com/ChromeDevTools/chrome-devtools-mcp

   用于让 Codex、Claude 或其他兼容代理直接操作真实 Chrome，完成点击、输入、截图、Console、Network、性能和响应式检查。该步骤是前端验收门槛，不能被构建结果或 Playwright 替代。

4. **assistant-ui**  
   https://github.com/assistant-ui/assistant-ui

   用于创建页中的自然语言输入、用户和助手消息、加载、取消、错误、重试以及结构化 `GenerationSpec` 建议。不得重新手写一套同类通用聊天界面。

完整分工：

```text
UI Skills             → 页面层级、布局、尺寸、状态与交互方法
shadcn/ui + Tailwind  → 基础组件和统一视觉体系
assistant-ui          → 创建页自然语言交互
Chrome DevTools MCP   → 真实 Chrome 操作与调试验收
Playwright            → 核心路径自动化回归
```

Playwright 和 Chrome DevTools MCP 缺一不可：前者负责稳定回归，后者负责真实浏览器探索、调试和视觉验收。

运行时计划：

```text
React + TypeScript + Vite
Tailwind CSS v4
shadcn/ui
assistant-ui
i18next
Vitest + Testing Library
Playwright
```

明确不使用：

- Ant Design；
- DLR 的 CSS、应用外壳或目录页代码；
- Monaco 作为产品依赖；
- 第二套通用组件库；
- 大型仪表盘模板。

首版不需要 YAML 编辑器。

## 3. 信息架构

只保留四个区域：

```text
创建
数据集
数据集详情
API 使用与设置
```

导航可以采用轻量顶部导航或简单侧栏，由真实页面效果决定。

不要预留未实现的运行、来源、时间线、故障、验证、代理或驱动入口。

## 4. 创建页面

创建页是第一主页面。

### 主任务

```text
描述你需要的 CMDB 配置数据
[ assistant-ui 输入区 ]
[ 示例提示词 ]
```

示例提示词：

- 生成两个数据中心、100 台服务器和 500 台虚拟机；
- 生成 50 个应用、10 个数据库以及依赖关系；
- 生成一个 Kubernetes 集群、20 个节点和 200 个工作负载。

### AI 返回形式

不先展示原始 JSON，而是展示结构化摘要：

```text
数据集：中型企业

CI 类型
2 个数据中心
30 个机柜
200 台物理服务器
800 台虚拟机
80 个应用

关系
contains / mounted_in / runs_on / hosted_on

Seed
20260825
```

用户可直接调整：

- 数据集名称；
- seed；
- 每个类型的数量；
- 内置 CI 类型；
- 简单关系。

主操作：

```text
[生成数据集]
```

### AI 未配置

显示清晰中文提示：

```text
当前没有配置 AI Provider。
你仍然可以从内置模板开始。
```

并提供少量模板，不能让页面变成错误死路。

## 5. 数据集页面

采用简单列表或表格：

```text
名称
创建时间
CI 数量
关系数量
Seed
操作
```

需要：

- 按名称搜索；
- 打开详情；
- 明确的删除确认；
- 空状态；
- 加载和错误状态。

不需要：

- 指标仪表盘；
- 趋势图；
- 多维筛选器；
- 复杂批量操作。

## 6. 数据集详情

推荐顶部摘要加页签：

```text
概览
CI 数据
关系
API 与导出
拓扑（仅 Issue #2）
```

### 6.1 概览

显示：

- 名称和描述；
- 原始提示词；
- seed；
- 生成器版本；
- CI 和关系总数；
- 各类型数量；
- `GenerationSpec` 的结构化摘要。

原始规格可以在高级抽屉中以 JSON 查看，但不作为主视觉，也不要求直接编辑。

### 6.2 CI 数据

使用 shadcn 表格组合：

- 类型筛选；
- 关键字搜索；
- 服务端分页；
- ID、类型、名称和常用字段摘要；
- 点击行后在侧边抽屉展示完整属性和标签。

不得一次加载或渲染 10,000 行。

### 6.3 关系

表格字段：

```text
关系 ID
关系类型
起点
起点类型和名称
终点
终点类型和名称
```

支持关系类型、起点、终点筛选和分页。

### 6.4 API 与导出

这是核心页面，不是隐藏在设置中的附属功能。

显示：

- 基础地址；
- 数据集 ID；
- Bearer Token 请求头说明；
- CI 接口；
- 关系接口；
- 可复制的 curl；
- JSON、CSV 和可选 XLSX 下载按钮；
- API Key 只显示占位符，不回显服务端真值。

## 7. API 使用与设置

MVP 不做账号管理。

页面只需要：

- 当前浏览器会话是否已经录入 API Key；
- 输入或替换 Key；
- 清除 Key；
- AI Provider 已配置或未配置状态；
- OpenAPI 文档入口；
- 本地优先和监听地址提示。

Key 可以放在内存或 `sessionStorage`，不得写入构建产物、URL、日志或普通数据库。

## 8. assistant-ui 使用边界

assistant-ui 只服务创建页：

- 输入区；
- 用户和助手消息；
- 加载、取消和错误；
- 结构化规格建议卡片；
- 重试。

不建设：

- 长期聊天历史；
- 多会话管理；
- 附件；
- 工具市场；
- 编码 Agent；
- 复杂上下文助手。

AI 输出必须经过后端 `GenerationSpec` 校验。

## 9. shadcn/ui 使用规则

优先复用：

| 需求 | 组件 |
|---|---|
| 导航 | `Sidebar` 或 `NavigationMenu` |
| 创建表单 | `Card`、`Field`、`Input`、`Button`、`Select` |
| 类型数量 | `Table`、`Input`、`Select`、删除操作 |
| 数据集列表 | `Table`、`Pagination`、`DropdownMenu` |
| 数据集详情 | `Tabs`、`Badge`、`Sheet`、`Separator` |
| 删除确认 | `AlertDialog` |
| 反馈 | `Alert`、`Sonner` |
| 加载 | `Skeleton`、`Spinner` |
| 空状态 | `Empty` |
| API 示例 | 代码块和复制按钮 |

实施时先查询当前 shadcn registry 和文档，再决定是否自定义基础控件。

使用统一语义变量，不为每种 CI 类型设计一套彩虹色卡片。

## 10. 视觉原则

- 首屏一眼看见“描述你要生成的数据”；
- 主按钮明确；
- 信息密度适中，不堆叠大量统计卡片；
- 数据页以表格和筛选为主；
- 高级 JSON 渐进披露；
- 状态不能只靠颜色表达；
- 中英文长文本不能溢出；
- 1024 像素宽桌面仍可完成操作；
- 不为追求移动端形式牺牲桌面数据使用效率。

## 11. 简单拓扑

简单拓扑只属于 Issue #2，且必须等待 MVP 真正实现和验证后再决定是否开发。

边界：

- 从已有记录和关系绘图；
- 默认限制可见节点数量；
- 支持 CI 类型、关系类型和文字筛选；
- 点击节点查看详情；
- 支持适配视图、缩放和平移；
- 不编辑拓扑；
- 不引入图数据库；
- 不承诺一次渲染 10,000 个节点。

## 12. Chrome DevTools MCP 浏览器验收定义

Issue #1 实现后，必须通过 Chrome DevTools MCP 在真实 Chrome 中检查：

```text
录入 API Key
→ 输入提示词或使用模板
→ 查看规格建议
→ 调整数值和 seed
→ 生成数据集
→ 筛选和分页查看 CI
→ 查看关系
→ 复制 API 示例
→ 下载导出文件
```

检查范围：

- 1024、1280、1440、1920 像素宽度；
- 页面截图；
- Console；
- Network；
- 性能；
- 加载、错误和空状态；
- AI 未配置；
- 错误 API Key 返回 401；
- 长提示词和长名称；
- 万级数据分页；
- 键盘与焦点行为。

通过构建、单元测试或 Playwright 不等于真实页面验收。若主开发工具无法调用 Chrome DevTools MCP，必须由能够调用它的兼容代理完成该门槛。

## 13. 前端停止规则

当用户可以顺畅完成以下路径时，就停止首版扩展：

```text
描述需求
→ 生成
→ 浏览
→ 使用 API 或导出
```

不得因为页面数量少，就增加仪表盘、日志中心、主题市场、复杂设置、聊天历史、拓扑编辑器或已关闭 Issue 的入口。