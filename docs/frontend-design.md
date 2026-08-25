# InfraSourceLab 前端设计

## 1. 目标

前端只需要帮助用户完成：

```text
创建数据集
→ 查看 CI 与关系
→ 复制 API 调用方式
→ 导出数据
```

不要把简单工具做成复杂运维平台、数据治理后台或低代码编辑器。

---

## 2. 设计工具与组件

正式组合：

```text
UI Skills             → 页面层级与交互方法
shadcn/ui + Tailwind  → UI 组件与视觉体系
assistant-ui          → 创建页自然语言交互
Chrome DevTools MCP   → 真实浏览器检查
Playwright            → 稳定回归
```

运行时建议：

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

```text
Ant Design
DLR CSS / Shell / Catalog
Monaco as a product dependency
第二套通用组件库
大型 dashboard template
```

首版不需要 YAML 编辑器。

---

## 3. 信息架构

只保留四个区域：

```text
Create
Datasets
Dataset Detail
Settings / API Usage
```

导航可以很轻：顶部导航或简单 Sidebar，依据 UI Skills 和真实页面效果决定。

不要预留一排没有实现的：

```text
Runs
Sources
Timeline
Faults
Verification
Agents
Drivers
```

---

## 4. Create 页面

Create 是第一主页面。

### 页面主任务

```text
描述你需要的 CMDB 配置数据
[ assistant-ui composer ]
[ 示例 prompt chips ]
```

示例：

- 两个数据中心、100 台服务器和 500 台虚拟机；
- 50 个应用、10 个数据库以及依赖关系；
- 一个 Kubernetes 集群、20 个节点和 200 个工作负载。

### AI 返回

不要先显示原始 JSON。先显示结构化摘要：

```text
Data set
Medium enterprise

CI types
2 data centers
30 racks
200 physical servers
800 virtual machines
80 applications

Relations
contains / mounted_in / runs_on / hosted_on

Seed
20260825
```

用户可直接修改：

- dataset name；
- seed；
- 每个类型 count；
- 删除/增加内置类型；
- 删除/增加简单关系。

主操作：

```text
[Generate Dataset]
```

### AI 未配置

显示清晰 fallback：

```text
AI provider is not configured.
Start from a template instead.
```

并提供 3～4 个模板，不要把页面变成错误死路。

---

## 5. Datasets 页面

简单列表或表格：

```text
Name
Created at
CI count
Relation count
Seed
Actions
```

需要：

- 搜索名称；
- 打开详情；
- 明确删除确认；
- empty state；
- loading/error。

不需要：

- KPI dashboard；
- 趋势图；
- 多维筛选器；
- 复杂批量操作。

---

## 6. Dataset Detail

推荐顶部 summary + Tabs：

```text
Overview
CI Data
Relations
API & Export
Topology (Issue #2 only)
```

## 6.1 Overview

显示：

- 名称/描述；
- prompt；
- seed；
- generator version；
- CI/关系总数；
- 按类型数量；
- GenerationSpec 的结构化摘要。

原始 spec 可以放在 Advanced/Sheet 中以 JSON 查看，但不是主视觉，也不要求编辑。

## 6.2 CI Data

使用 shadcn Table/Data Table 组合：

- type filter；
- keyword search；
- server pagination；
- ID、type、name、常用字段摘要；
- 点击行后 Sheet 显示完整 attributes/tags。

不要一次加载/渲染 10k 行。

## 6.3 Relations

表格字段：

```text
relation ID
type
from
from type/name
to
to type/name
```

支持 type/from/to filter 和分页。

## 6.4 API & Export

这是产品核心页面之一，不是设置角落。

显示：

- Base URL；
- dataset ID；
- Bearer Token Header 提示；
- CI endpoint；
- Relations endpoint；
- copyable curl；
- JSON/CSV/XLSX download buttons；
- API Key 只显示占位符，不回显环境变量真值。

---

## 7. Settings / API Usage

MVP 不做账号管理。

页面只需要：

- 当前 API Key 是否已在浏览器会话录入；
- 输入/替换 key；
- 清除 key；
- AI Provider configured/unconfigured 状态；
- API docs link；
- local-first / bind address 提示。

Key 可放 sessionStorage 或仅内存。不要写进 bundle、URL、日志或持久化普通数据库。

---

## 8. assistant-ui 使用边界

assistant-ui 只服务 Create 页：

- Composer；
- user/assistant message；
- loading/cancel/error；
- structured proposal card；
- retry。

不建设：

- 长期聊天历史产品；
- 多会话管理；
- attachments；
- tool marketplace；
- coding agent；
-复杂 Context Assistant。

AI 输出最终必须经过后端 `GenerationSpec` 校验。

---

## 9. shadcn 使用规则

优先复用：

| 需求 | 组件 |
|---|---|
| Navigation | Sidebar / NavigationMenu |
| Create form | Card / Field / Input / Button / Select |
| Type counts | Table / Input / Select / Trash action |
| Dataset list | Table / Pagination / DropdownMenu |
| Detail | Tabs / Badge / Sheet / Separator |
| Delete | AlertDialog |
| Feedback | Alert / Sonner |
| Loading | Skeleton / Spinner |
| Empty | Empty |
| API examples | Code block / copy Button |

先查询 shadcn 当前 registry/docs，再写自定义基础控件。

使用统一 semantic tokens，不给每种 CI 类型设计一套彩虹色卡片。

---

## 10. 视觉原则

- 首屏一眼看见“描述你要生成的数据”；
- 主按钮明确；
- 信息密度适中，不堆十几个统计卡片；
- 数据页以表格和筛选为主；
- 高级 JSON 渐进披露；
- 状态不只靠颜色；
- 中英文长文本不溢出；
- 1024 宽桌面仍可操作；
- 不强行 mobile-first。

---

## 11. 简单拓扑（Issue #2）

只有 MVP 完成后才增加。

设计边界：

- 从已有记录/关系绘图；
- 默认限制可见节点数量；
- type/relation/search filters；
- 点击节点查看详情；
- fit/zoom/pan；
- 不编辑拓扑；
- 不引入图数据库；
- 不为 10k 节点强行全量渲染。

---

## 12. Chrome DevTools MCP 完成定义

#1 至少真实检查：

```text
录入 API Key
→ Prompt
→ AI proposal / template fallback
→ 调整 counts/seed
→ Generate
→ CI table filter/page
→ Relation table
→ API curl copy
→ JSON/CSV/XLSX export
```

检查：

- 1024 / 1280 / 1440 / 1920；
- Console；
- Network；
- loading/error/empty；
- AI unconfigured；
- wrong API Key 401；
- long prompt/name；
- 10k paginated data；
- keyboard/focus。

发现阻塞问题要修复，不能用 `npm run build` 替代真实页面验收。

---

## 13. 前端停止规则

当用户可以顺畅完成：

```text
Prompt → Generate → Browse → API/Export
```

就停止首版前端扩展。

不要顺手增加 dashboard、日志中心、主题市场、复杂设置、聊天历史、拓扑编辑器或任何关闭 Issue 的入口。