# InfraSourceLab 项目状态

## 当前阶段

**MVP 已实现，等待外部审查。**

当前 `main` 分支已包含：

```text
LICENSE
README.md
docs/
backend/              FastAPI + SQLAlchemy + SQLite + Faker 数据生成引擎与 60 个 pytest
web/                  React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui 前端
Dockerfile            单镜像：后端 + 内置前端静态产物
docker-compose.yml    只向 127.0.0.1:8080 发布
```

Issue #1 的 MVP 闭环已可运行：

```text
自然语言或模板
→ 经过校验的 GenerationSpec
→ 本地确定性生成 CI 与关系
→ SQLite（PRAGMA user_version = 1）
→ Bearer Token REST API
→ JSON / CSV / XLSX 导出
→ 创建、数据集列表、详情、设置界面（管理员登录 + AI 模型配置页）
```

### 后续特性：管理员登录与 AI 配置页（已实现）

- 认证双通道：管理员登录会话令牌为主（PBKDF2 密码哈希、12 小时会话、令牌只存哈希），环境变量 `ISL_API_KEY` 作为备用；
- 默认账户 `admin` / `admin123` 首次启动自动创建，不强制改密，设置页可自行修改；
- `/api/v1/admin/ai-config` 仅管理员会话可用（API Key 访问返回 403），AI 配置持久化到 SQLite 并即时生效；
- `/api/v1/status` 改为公开接口（仅返回布尔标志），供登录页与设置页在未认证时读取。

## 实现证据

- 起始提交：`893a1e2`（实现开始前的 `main` 最新提交，已记录在 Issue #1）；
- 结束提交：本次实现系列的最后一次提交，准确哈希记录在 Issue #1 完成报告中；
- 后端测试：`cd backend && uv run pytest` → 60 passed；
- 前端单测：`cd web && npm test`（Vitest）→ 7 passed；
- 端到端：`cd web && npx playwright test`（Playwright + Chromium，uvicorn 生产形态）→ 7 passed；
- 浏览器验收：真实浏览器完成设置密钥 → 模板 → 生成 → CI/关系/API 与导出全流程，截图保存在本地验证目录，关键结果记录在 Issue #1；
- 容器验证：镜像构建后以 `docker run` 验证 /health、SPA 深链、401 认证、两步 API、search_text 查询、三种导出与 `user_version=1`。

## 当前工作项

### Issue #1：MVP，已实现，等待审查

已经固定的关键设计（实现与之一致）：

- `POST /api/v1/specs/from-prompt` 只生成并校验规格建议，不创建数据集；
- `POST /api/v1/datasets` 只接收用户确认后的规格并创建数据集；
- 关系使用 `strategy=balanced|random_seeded` 和 `coverage=from|to`；
- CI 搜索使用受控 `search_text` 白名单（`%`、`_` 按字面量转义）；
- 创建页使用一次性提示词到规格建议，不建设多轮聊天；
- SQLite 使用 `PRAGMA user_version = 1`，不兼容版本明确提示备份和重建。

已知限制（详见 Issue #1 完成报告）：

- 验证环境中无 AI 密钥，`from-prompt` 只验证了 503/校验路径与假 Provider 单测；
- 本机 8080 被占用期间，容器验证改用 8091 发布端口，Compose 文件仍为 `127.0.0.1:8080:8080`；
- 管理员登录与 AI 配置特性的试用容器发布在 `127.0.0.1:8092`（容器 `isl-v2`），8091 容器保留 MVP 版本。

### Issue #2：拓扑视图与数据质量缺陷，本地已实现，待用户测试（未同步 GitHub）

起始提交：`a0c0f41`（仅本地记录，不向 Issue 留言、不推送）。已实现：

- 拓扑抽样接口 `GET /api/v1/datasets/{id}/topology`：节点来自 CI、边来自关系，
  支持 `ci_type`/`relation_type`/`q` 筛选与 `center` 聚焦邻居，默认上限 200 节点（有界返回 + `truncated` 标记）；
- 数据集详情页新增“拓扑”页签：@xyflow/react 分层网格布局，类型/关系/文字筛选，
  点击节点侧边抽屉展示详情，支持聚焦邻居与返回全量视图；
- 四种确定性数据质量缺陷（`missing_field`/`case_drift`/`duplicate_record`/`wrong_value`）：
  每条规则独立种子、在关系生成后注入、直接改写记录使 API/导出天然一致，生成器版本升至 1.1.0；
- 创建页规格编辑器新增“数据质量缺陷”开关区（类型/字段/数量或比例）；
- 新增中文文档 `docs/cmdb-usage-example.md`：Bearer Token、数据集 ID、分页、筛选、关系回指与字段映射。

验证：后端 `uv run pytest` 76 passed（含缺陷 8 + 拓扑 8）；Vitest 7 passed；
Playwright 9 passed（新增拓扑路径与脏数据路径）；容器（8093 端口）完成 API 冒烟与浏览器全流程验收。

约定：实现暂不同步到 GitHub，用户测试通过后再决定。

### 用户测试反馈修复（本地，未同步 GitHub）

针对用户试用后的四项反馈，已全部修复并验证：

- 拓扑连线改为 `smoothstep` 正交折线，消除贝塞尔弧线穿越同层节点造成的“虚拟机互连”视觉误读；
- 内置默认测试 Key（`isl-default-api-key`，`/api/v1/status` 下发），设置页直接预填展示，可人工修改；
  环境变量 `ISL_API_KEY` 仍作为备用通道；
- AI 配置从顶层菜单移除，合并到设置页「AI 建议服务」面板：配置表单、拉取模型列表（`GET /models`）、
  测试连接、系统提示词默认/自定义切换（`GET/PUT /api/v1/admin/ai-prompts`，自定义为空时回退默认）；
  管理端点 401/403 不触发全局跳转，未登录也可在设置页看到配置状态徽标与登录引导；
- AI 返回 JSON 解析容错：剥离 markdown 围栏后，扫描每个 `{` 用 raw_decode 提取完整对象，
  优先取思考过程（混合推理模型如 MiniMax-M3 会在 content 开头输出思考与草稿 JSON）之后
  含 spec 字段的最终答案；content 为空、输出被 max_tokens 截断（请求已显式设置 8192）
  均给出针对性错误，解析失败时错误信息附内容开头预览并记录服务端日志。

验证：后端 `uv run pytest` 95 passed（新增 19 条：默认 Key、提示词配置、模型列表/连通性、JSON 容错与思考草稿提取）；
Vitest 7 passed；Playwright 9 passed；容器（8093）完成截图取证，含真实 AI 服务（MiniMax-M3）的
测试连接、模型拉取与建议生成全链路（证据见 `.verify-evidence/fb-*.png`）。

### 拓扑视图修复：真实关系分层、深层折叠与全屏（本地，未同步 GitHub）

第二轮试用反馈排查结论：**关系数据本身正确**（API 抓取 spec 核对 `contains`/`mounted_in`/
`runs_on`/`hosted_on` 方向与 CMDB 语义一致），错乱出在渲染侧——布局原先按 `ci_types`
声明顺序分层，一旦类型顺序与真实层级不符就会画歪。已修复：

- 布局改为按真实关系计算层级：Kahn 最长路径分层（`computeDepths`，父在上、子在下，
  `mounted_in`/`runs_on`/`hosted_on` 归一为父在上），孤岛节点按类型顺序排在层级图下方，
  环上节点兜底至最大深度之下避免重叠；
- 层级超过 6 层时，第 7 层起默认折叠为虚线占位块（顶部提示折叠范围与数量），
  点击占位块展开，展开后提供“折叠第 N 层以下”按钮一键恢复折叠；
- 全屏修复：改用 Fullscreen API（`requestFullscreen`/`exitFullscreen` + `fullscreenchange`
  同步状态），并在画布内 Controls 增加切换按钮（全屏时顶部工具栏会被画布遮挡）；
- 深层折叠由 `MAX_VISIBLE_LAYERS = 6` 常量控制，`computeDepths` 导出供单元测试。

验证：Vitest 13 passed（新增 `computeDepths` 单测 6 条：关系分层归一、声明顺序无关、
孤岛排序、环形兜底）；Playwright 11 passed（新增 7 层数据集默认折叠/展开/重新折叠、
全屏进入与退出两条）；容器（8093）重建后以「七层链路示例」数据集截图取证
（默认折叠、展开、分层正确性、全屏，证据见 `.verify-evidence/topo-*.png`）。

### 拓扑钻取式交互重构（本地，未同步 GitHub）

第三轮试用反馈处理。排查结论：关系数据仍正确（数据集中不存在 VM 互连的边，
涉及 VM 的边仅有 `runs_on`→物理服务器与 `hosted_on`←应用），"VM 互连"是大量节点
平铺时正交折线横向穿越同层节点造成的视觉误读。参照 CMDB 拓扑可视化最佳实践
（华为云/Oracle Sun MC/CA CMDB Visualizer：节点多时默认折叠，从顶层或焦点节点
点击逐层钻取），重构为钻取式交互：

- 默认只显示顶层根节点，页面提示「请点击节点上的 + 逐层展开查看（当前显示 M / N 个
  节点，点击节点主体可查看详情）」，取代原先“第 7 层起折叠”的固定阈值；
- 节点右下角 +N / − 徽标展开/收起子级（N 为隐藏子级数）；工具栏提供「收起全部」；
- 布局改为紧凑树形（tidy tree，`computeDrilldownLayout` 导出供单测）：父节点水平居中于
  子级上方、子树聚簇，宿主机与其虚拟机紧邻，每台 VM 一条 runs_on 短边直连宿主机，
  从根上消除横穿误读；可见性按“父可见且已展开则子可见”传播，收起中间层则仅经由它
  可见的后代随之隐藏；多父共享子归属最早展开且可见的父，另一父画跨区块连线；
- 自定义节点组件（展开/收起徽标）必须渲染隐式 `Handle`——ReactFlow v12 自定义节点
  无 Handle 时边找不到端点会静默不绘制（调试发现连线消失后修复）；
- 聚焦邻居视图保持全量邻域分层网格布局不变。

验证：后端 `uv run pytest` 95 passed（无后端改动，回归确认）；Vitest 19 passed
（新增 `computeDrilldownLayout` 单测 6 条：默认仅顶层、逐层展开、子树聚簇几何、
收起隐藏后代、多父归属、平级关系无关）；Playwright 11 passed（钻取用例重写并新增
runs_on 边渲染断言）；容器（8093）重建后以数据集 #2（96 CI，用户原报"VM 互连"）
截图取证 9 项全过（证据见 `.verify-evidence/drill-*.png`）。

### Issues #3～#8：不计划实施

这些早期平台化方向已经关闭，不属于当前待办：

- 生命周期、故障注入与自动验证；
- 多协议模拟器套件；
- 云与管理协议模拟器套件；
- 真实服务编排与录制回放平台；
- 高级 AI 导入与工具平台；
- 分布式运行、远程代理与大规模发布平台。

## 状态判断规则

只有同时满足以下证据，才能把项目状态改为“已实现”或“待审查”：

1. `main` 中存在实际产品代码；
2. 有明确的实现提交范围；
3. 能从 GitHub 重新拉取并运行；
4. 自动化测试命令和结果可复现；
5. 浏览器主流程有真实验证证据；
6. Issue 中记录了准确的起始提交、结束提交、已知限制和验证结果。

当前阶段声称“待审查”依据的就是上述六项证据；在外部审查确认前，不声称“已验收”。

## 当前权威顺序

发生冲突时，按以下顺序判断：

1. GitHub `main` 中实际存在的文件和提交；
2. 本状态文档；
3. 开放的 Issue #1 和 #2；
4. 其他设计文档；
5. `docs/research/` 中的历史调研。

历史聊天记录、未关联到分支的 Git 对象、临时工作目录或未提交代码都不代表仓库当前状态。
