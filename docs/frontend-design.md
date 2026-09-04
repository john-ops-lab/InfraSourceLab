# InfraSourceLab 前端设计

> **状态：现役前端设计基线。**
>
> 本文描述当前界面边界和验收方式；具体实现与验证状态见 [`status.md`](status.md)。

## 1. 前端目标

前端只需要帮助用户完成：

```text
创建数据集
→ 查看 CI 与关系
→ 复制 API 调用方式
→ 导出数据
```

不要把简单工具做成复杂运维平台、数据治理后台、低代码编辑器或聊天产品。

## 2. 必须使用的设计与组件组合

Issue #1 以及后续前端功能必须遵循 [`qoder-frontend-tooling.md`](qoder-frontend-tooling.md)。

### Issue #1 必须实际使用

1. **UI Skills**  
   https://github.com/ibelick/ui-skills

   用于编码前确认页面主任务、信息层级、组件排布、尺寸、状态和响应式策略。

2. **shadcn/ui**  
   https://github.com/shadcn-ui/ui

   作为组件和视觉体系的基础，并与 Tailwind CSS v4 配合使用。常见控件必须先查询和复用 shadcn/ui，再考虑自定义基础组件。

3. **Chrome DevTools MCP**  
   https://github.com/ChromeDevTools/chrome-devtools-mcp

   用于让兼容开发代理直接操作真实 Chrome，完成点击、输入、截图、Console、Network、性能和响应式检查。该步骤不能被构建结果或 Playwright 替代。

4. **Playwright**

   用于将已经通过真实浏览器检查的稳定主路径固化为自动化回归。

### assistant-ui 的定位

**Issue #1 不要求引入 assistant-ui。**

首版交互固定为：

```text
一次提示词
→ 一次结构化 GenerationSpec 建议
→ 用户调整
→ 创建数据集
```

这不是多轮聊天，因此使用 shadcn/ui 的 `Textarea`、`Button`、`Card`、`Alert`、`Skeleton` 等轻量组件即可。

assistant-ui（https://github.com/assistant-ui/assistant-ui）保留为未来出现以下真实需求时的首选：

- 用户需要连续多轮修改规格；
- 需要保留同一轮中的用户和助手消息上下文；
- 需要标准化取消、重试和消息运行状态。

不得在同一个产品版本中同时维护轻量创建表单和另一套聊天创建入口。

## 3. 运行时计划

```text
React + TypeScript + Vite
Tailwind CSS v4
shadcn/ui
Vitest + Testing Library
Playwright
```

首版界面只做中文，不引入 i18next 或其他多语言框架。

明确不使用：

- Ant Design；
- 其他项目的 CSS、应用外壳或组件体系；
- Monaco 作为产品依赖；
- 第二套通用组件库；
- 大型仪表盘模板；
- assistant-ui 或其他聊天框架作为 Issue #1 的必需依赖。

首版不需要 YAML 编辑器。

## 4. 信息架构

只保留四个区域：

```text
创建
数据集
数据集详情
API 使用与设置
```

导航可以采用轻量顶部导航或简单侧栏，由 UI Skills 和真实页面效果决定。

不要预留未实现的运行、来源、时间线、故障、验证、代理或驱动入口。

## 5. 创建页面

创建页是第一主页面。

### 主任务

```text
描述你需要的 CMDB 配置数据
[ 提示词输入区 ]
[ 生成规格建议 ]
[ 示例提示词 ]
```

示例提示词：

- 生成两个数据中心、100 台服务器和 500 台虚拟机；
- 生成 50 个应用、10 个数据库以及依赖关系；
- 生成一个 Kubernetes 集群、20 个节点和 200 个工作负载。

### 固定交互

```text
输入提示词
→ POST /api/v1/specs/from-prompt
→ 返回结构化规格、中文说明和 warnings
→ 用户调整名称、seed、类型数量、关系 strategy/coverage/min_links/max_links
→ POST /api/v1/datasets
→ 进入数据集详情
```

不在创建数据集前自动持久化 AI 候选规格。

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
contained_in：rack → data_center，coverage=from
mounted_in：physical_server → rack，coverage=from
runs_on：virtual_machine → physical_server，coverage=from

Seed
20260825
```

用户可直接调整：

- 数据集名称；
- seed；
- 每个类型的数量；
- 内置 CI 类型；
- 关系类型；
- 关系策略；
- 关系覆盖方向。
- 每个被覆盖对象的最少/最多关系数（1～10）。

创建页还支持导入以前下载的 `GenerationSpec` JSON。导入先调用服务端校验接口，只把合法规格放入编辑器，不会跳过用户确认或直接创建数据集。规格编辑区可下载当前 JSON，也可一键换 seed。

主操作：

```text
[生成数据集]
```

### 需要覆盖的状态

- 空提示词；
- 规格生成中；
- 用户取消；
- AI 超时；
- Provider 未配置；
- AI 返回无效规格；
- 规格 warning；
- 数据集生成中；
- 数据集生成失败；
- 重试。

### AI 未配置

显示清晰中文提示：

```text
当前没有配置 AI Provider。
你仍然可以从内置模板开始。
```

并提供少量模板，不能让页面变成错误死路。

## 6. 数据集页面

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

## 7. 数据集详情

推荐顶部摘要加页签：

```text
概览
CI 数据
关系
API 与导出
拓扑
```

### 7.1 概览

显示：

- 名称和描述；
- 原始提示词；
- seed；
- 生成器版本；
- CI 和关系总数；
- 生成 warning；
- 各类型数量；
- `GenerationSpec` 的结构化摘要。
- 精确质量报告（缺陷、字段、请求/实际条数和受影响 CI ID）；
- 下载规格、复制规格回创建页、下载完整质量报告。

原始规格可以在高级抽屉中以 JSON 查看，但不作为主视觉，也不要求直接编辑。

### 7.2 CI 数据

使用 shadcn 表格组合：

- 类型筛选；
- `q` 关键字搜索；
- 服务端分页；
- ID、类型、名称和常用字段摘要；
- 点击行后在侧边抽屉展示完整属性和标签。

不得一次加载或渲染 10,000 行。

搜索提示应说明只匹配受控字段，例如名称、主机名、IP、序列号和应用编码，不暗示支持任意 JSON 查询。

### 7.3 关系

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

### 7.4 API 与导出

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

## 8. API 使用与设置

MVP 不做账号管理。

页面只需要：

- 当前浏览器会话是否已经录入 API Key；
- 输入或替换 Key；
- 清除 Key；
- AI Provider 已配置或未配置状态；
- OpenAPI 文档入口；
- 本地优先和监听地址提示。

Key 可以放在内存或 `sessionStorage`，不得写入构建产物、URL、日志或普通数据库。

## 9. shadcn/ui 使用规则

优先复用：

| 需求 | 组件 |
|---|---|
| 导航 | `Sidebar` 或 `NavigationMenu` |
| 提示词输入 | `Textarea`、`Button`、`Card` |
| 规格编辑 | `Field`、`Input`、`Select`、`Table` |
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
- AI 规格建议与最终创建动作明确分开；
- 信息密度适中，不堆叠大量统计卡片；
- 数据页以表格和筛选为主；
- 高级 JSON 渐进披露；
- 状态不能只靠颜色表达；
- 中文长文本不能溢出；
- 1024 像素宽桌面仍可完成操作；
- 不为追求移动端形式牺牲桌面数据使用效率。

## 11. 简单拓扑

简单拓扑已实现，保持只读浏览、筛选、聚焦邻居和有界返回，不引入图数据库或拓扑编辑器。

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
→ 输入提示词
→ 查看规格建议
→ 调整数值、关系 coverage 和 seed
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
- 加载、取消、错误、warning 和空状态；
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
→ 获得并确认规格
→ 生成
→ 浏览
→ 使用 API 或导出
```

不得因为页面数量少，就增加仪表盘、日志中心、主题市场、复杂设置、聊天历史、拓扑编辑器或已关闭 Issue 的入口。
