# InfraSourceLab 前端视觉参考

> 这组图用于给 Qoder / Reviewer 提供 **布局、信息层级和 DLR 风格复用** 的视觉基线，不是像素级最终稿。

![InfraSourceLab frontend demo](./frontend-demo-overview.svg)

## 参考图覆盖的 8 个主要界面

1. **Scenario Workbench / 场景工作台**
   - 左侧高密度 Scenario Catalog；
   - 中央 Monaco YAML 编辑器；
   - 顶部只保留当前场景上下文与 Save Revision / Compile 等主操作；
   - 右侧 Compile Preview 是次级信息，不抢 Monaco 主视觉。

2. **World / Truth Graph**
   - 不强制做复杂拓扑画布；
   - 默认以高密度 Nodes / Relationships / Identity Map / Truth Versions 为主；
   - 大数据量必须分页或虚拟化；
   - 关系可用选中行的上下文条解释。

3. **Sources / 数据源**
   - 左侧 Sources 列表；
   - 右侧统一 capability-driven Source Detail；
   - 所有 Driver 尽量共用同一套信息结构：backend/version、endpoint、health、freshness、capabilities、projection、identity map、logs；
   - 不给每个 Driver 重做一套完全不同的页面。

4. **Timeline & Faults / 生命周期与故障**
   - Timeline 是明确的步骤列表，不做花哨流程图；
   - 当前 Truth Version、Source freshness 和 step 影响必须清晰；
   - Fault 与 Timeline 同屏可理解，但故障启用仍是明确操作；
   - Transport fault 与 protocol/application fault 要区分。

5. **Runs / Runtime Console**
   - 展示 Lab Run 权威状态、Source health、Truth Version、Active Faults；
   - 日志使用与 DLR 类似的深色终端表面；
   - 运行状态来自真实 Control/Agent reconcile，不只依赖前端乐观状态。

6. **Verification / 自动验证**
   - Source Fidelity / Canonical Outcome 两种模式必须明显区分；
   - Findings 使用高密度表格和详情，而不是图表优先；
   - finding 可以加入 AI 上下文，但 AI 不能修改 Truth/Report 来消除失败。

7. **AI Assistant / 右侧助手**
   - 直接复用 DLR 的右侧可展开布局思想；
   - assistant-ui、Context、Candidate、Diff、Apply；
   - Candidate → Diff → Apply 只修改浏览器 Working Copy；
   - 不自动 Save / Compile / Start。

8. **AI Assistant Maximized / 最大化生成与 Diff**
   - 最大化只是同一个 Assistant Runtime 的布局切换，不能 remount；
   - draft/messages/attachments/in-flight request/Candidate 保持；
   - Diff 重点展示 Current Working Copy 与 Candidate；
   - Save Revision / Compile / Start 仍属于正常 Workbench 流程。

## DLR 风格必须保留的基线

视觉优先复用 `john-ops-lab/DataLinkRuntime@main` 已验证的设计语言：

```text
48px compact TopBar
#f5f6f8 shell background
white workspace surfaces
#1677ff primary accent
thin #e5e7eb borders
left dense row catalog
central workbench
right floating/expanded AI assistant
Monaco as code/scenario authoring primary surface
Ant Design / Pro Components controls
```

重点参考 DLR：

- `web/src/design-system.tsx`
- `web/src/components/ApplicationShell.tsx`
- `web/src/components/AiAssistantPanel.tsx`
- `web/src/index.css`
- Monaco / Diff / assistant-ui / i18n / Vitest / Playwright 实现

## 不要从参考图误解出的东西

- **不要增加独立 Dashboard 首页。** 当前产品主入口应直接是 Scenario Catalog + Workbench；参考图没有把 Dashboard 作为产品主流程。
- 图中的示例数字、名称、版本号只用于表达信息层级，不是 API 合同。
- 参考图不覆盖全部 loading/error/empty/permission 状态，实现必须按 Issues 和产品文档补齐。
- 图中控件尺寸可根据真实浏览器验收微调，但不要重新设计完全不同的视觉语言。
- 不要为了与图一致而绕过 Ant Design / DLR 已有组件。

## 规范优先级

发生冲突时按以下优先级：

```text
当前 GitHub Issue / 验收合同
  > docs/product.md / docs/architecture.md / docs/scenario-model.md
  > docs/dlr-ui-reuse.md
  > 本目录视觉参考图
```

视觉图帮助理解“应该长什么样”，产品和架构文档决定“必须怎么工作”。
