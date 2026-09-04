# InfraSourceLab 项目状态

## 当前阶段

**v0.1.0 已发布；当前处于维护与正确性修复阶段。**

当前代码与验证基线：

- 后端：121 个 pytest；
- 前端：27 个 Vitest；
- 端到端：15 个 Playwright；
- GitHub Actions：PR 与 `main` 推送均运行后端、前端和端到端三组检查；
- 数据库格式：SQLite `PRAGMA user_version = 2`；v1 启动时执行保留数据的单步迁移。

当前 `main` 分支已包含：

```text
LICENSE
README.md
docs/
backend/              FastAPI + SQLAlchemy + SQLite + Faker 数据生成引擎与 121 个 pytest
web/                  React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui 前端
Dockerfile            单镜像：后端 + 内置前端静态产物
docker-compose.yml    只向 127.0.0.1:8080 发布
```

Issue #1 的 MVP 闭环已可运行：

```text
自然语言或模板
→ 经过校验的 GenerationSpec
→ 本地确定性生成 CI 与关系
→ SQLite（PRAGMA user_version = 2）
→ Bearer Token REST API
→ JSON / CSV / XLSX 导出
→ 创建、数据集列表、详情、设置界面（管理员登录 + AI 模型配置页）
```

### 2026-09-04：真实度、复用、质量明细和一对多关系（已实现）

- 物理服务器、网络设备、数据库与中间件改用成套目录项，厂商/型号/角色/版本/默认端口不再独立乱配；主机名环境前缀与 `environment` 保持一致；
- 关系规则增加 `min_links` / `max_links`（每个被覆盖 CI 为 1～10 条唯一关系），内置应用模板会生成一个应用到多个数据库、中间件或运行节点的关系；
- 数据质量规则在生成前校验字段是否存在及是否支持大小写变换，不再把 0 次实际修改报成成功；生成器版本升至 `1.2.0`；
- 每条缺陷保存 `kind`、CI 类型、字段、请求数、实际数和全部受影响 CI ID；重复记录还保存新旧 ID 对照，错误值保存实际写入值；
- 数据集详情支持下载规格、复制规格回创建页、换 seed、下载完整质量报告；创建页可导入 JSON，并通过 `POST /api/v1/specs/validate` 先校验、后确认；
- CSV ZIP 额外包含 `spec.json` 和 `quality_report.csv`，JSON/XLSX 同步包含质量报告；
- SQLite v2 为 `datasets` 增加 `quality_report_json`；v1 自动执行幂等的加列迁移，旧数据保留并使用空报告。

当前验证基线：后端 121 passed；Vitest 27 passed；Playwright Chromium 15 passed。GitHub PR/CI 与合并状态以对应 PR 为准，不能由本地结果代替。

### 2026-09-04：拓扑节点详情布局修复

- 右侧详情面板加宽为桌面 576px、手机接近全宽，字段在窄屏自动改为上下排布；
- 基础信息、全部属性、全部标签分别显示项目总数，并逐项完整渲染接口返回值，不截断长文本或结构化值；
- 标题与“聚焦邻居”操作固定，正文使用常驻纵向滚动条，内容过高时只滚动面板内部；
- 新增 Playwright 用例，核对基础字段数量、每个属性值、标签数量、面板宽度与真实滚动溢出。

### 2026-09-04：内置 CI 默认属性扩充

- 12 种内置 CI 的清洁生成结果默认包含 10～12 个业务属性，顶层 `id`、`type`、`name` 和 `tags` 不计入数量；
- 新字段围绕机房容量、机柜供电、应用技术栈、数据库容量、中间件协议、IP 分配和 Kubernetes 运行配置生成，不使用空占位字段凑数；
- `CI_ATTRIBUTE_KINDS` 作为字段合同，生成引擎写入前强制检查至少 10 个属性；默认 AI 系统提示词同步声明该保证，并禁止生成规格虚构 `fields` / `attributes` 配置；
- 生成器版本升至 `1.3.0`：已有数据集原样保留，新创建的数据集使用扩充后的字段；显式 `missing_field` 缺陷仍可按设计减少目标记录的属性数；
- 新增后端测试，逐类核对最小属性数、字段合同、生成器版本和默认提示词约束。

### 后续特性：管理员登录与 AI 配置页（已实现）

- 认证双通道：管理员登录会话令牌为主（PBKDF2 密码哈希、12 小时会话、令牌只存哈希），环境变量 `ISL_API_KEY` 作为备用；
- 默认账户 `admin` / `admin123` 首次启动自动创建，不强制改密，设置页可自行修改；
- `/api/v1/admin/ai-config` 仅管理员会话可用（API Key 访问返回 403），AI 配置持久化到 SQLite 并即时生效；
- `/api/v1/status` 为公开接口，只返回配置状态与默认 API Key 标志，供登录页与设置页在未认证时读取。

## 历史实现证据

以下内容是 Issue #1 实现当时的验证记录，不代表当前测试数量；当前基线以上文为准。

- 起始提交：`893a1e2`（实现开始前的 `main` 最新提交，已记录在 Issue #1）；
- 结束提交：本次实现系列的最后一次提交，准确哈希记录在 Issue #1 完成报告中；
- 后端测试：`cd backend && uv run pytest` → 60 passed；
- 前端单测：`cd web && npm test`（Vitest）→ 7 passed；
- 端到端：`cd web && npx playwright test`（Playwright + Chromium，uvicorn 生产形态）→ 7 passed；
- 浏览器验收：真实浏览器完成设置密钥 → 模板 → 生成 → CI/关系/API 与导出全流程，截图保存在本地验证目录，关键结果记录在 Issue #1；
- 容器验证：镜像构建后以 `docker run` 验证 /health、SPA 深链、401 认证、两步 API、search_text 查询、三种导出与 `user_version=1`。

## 历史工作记录

以下按时间保留 Issue #1、Issue #2 及后续反馈修复的过程记录，不作为当前待办清单。

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

### Issue #2：拓扑视图与数据质量缺陷，已实现，已同步 GitHub（用户测试通过）

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

### 用户测试反馈修复（已同步 GitHub）

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

### 拓扑视图修复：真实关系分层、深层折叠与全屏（已同步 GitHub）

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

### 拓扑钻取式交互重构（已同步 GitHub）

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

### 拓扑连线视觉修复：边锚点按布局就近接入（已同步 GitHub）

第四轮试用反馈（连线丑、突然出现的箭头、叶子节点下探出无用线、是否换库）排查：
根因是边锚点方向固定为「source 在节点底部 / target 在节点顶部」，而
`runs_on`/`mounted_in`/`hosted_on` 等子→父方向的边（如 vm→宿主机）被迫从
子节点底部探出再绕到父节点顶部，产生无用探线与突兀箭头。框架选型本身没问题
（@xyflow/react 是 React 生态主流开源图库，问题在任何图库中都是锚点配置问题）。
已修复：

- 节点渲染 8 方向隐式锚点（上下左右 × source/target），边生成时按两端节点
  布局位置就近接入：上节点从底部出线、下节点从顶部入线（同层平级用左右），
  所有连线均为父底→子顶的短正交折线，箭头统一指向下方节点；
- 连线改 10px 圆角 smoothstep，箭头缩小至 12px，边标签灰化并加淡色背景。

验证：Vitest 19 passed；Playwright 11 passed（含 runs_on 边断言）；容器（8093）
重建后量化取证：展开 dc→rack→server 后 10 条可见边全部位于「父底~子顶」
带状区间（越界 0 条），runs_on 箭头 3/3 指向宿主机底部锚点
（证据见 `.verify-evidence/anchor-*.png`）。

### 拓扑关系方向统一 + 中英对照 + 关系类型配全（已同步 GitHub）

第五轮试用反馈（关系方向不统一、要中英对照可选、关系类型配全）三项修复：

- **方向统一为叶→根**：新增 `unifiedEdgeEndpoints`（导出供单测）：层级关系中
  from 是父的类型（contains）交换 source/target，其余保持原方向；配合
  按布局就近选锚点，箭头一律自下而上指向根/父节点，消除「contains 向下、
  mounted_in 向上」的方向混杂；
- **关系中英对照三态**：`spec.ts` 新增 `relationTypeLabel(type, mode)`
  （zh/en/both，如 `runs_on(运行于)`）与纯中文对照表；拓扑工具栏新增
  「关系标签语言」选择器（中英对照/中文/英文），作用于边标签与关系筛选下拉；
  SpecEditor 关系下拉与关系页签 Badge 同步改用中英对照；
- **关系类型配全**（参照维易 CMDB/ManageEngine/CI 关系图业界清单）：
  `BUILTIN_RELATION_TYPES` 8→15 种，新增 deployed_on（部署于）、
  connected_to（连接至）、owned_by（归属于）、manages（管理）、
  provides（提供服务）、consumes（消费服务）、backup_of（备份于）；
  拓扑分层同步（deployed_on 参与分层，其余新类型为平级）；AI 提示词的
  类型清单动态引用自动生效并补充常见搭配示例。

验证：后端 96 passed（新增全类型校验用例）；Vitest 22 passed（新增方向归一
与三态标签单测）；Playwright 11 passed；容器（8093）重建后取证 8 项全过：
默认中英对照标签、三态切换、无探线、contains 箭头向上 3/3、
关系下拉对照名、新关系类型 spec 生成
（证据见 `.verify-evidence/label-*.png`）。

### 关系类型注册表：contained_in 语义修正 + 设置页关系管理（已同步 GitHub）

第六轮试用反馈（机柜到数据中心应是「包含于」、英文也不对、AI 提示词同步修正；
设置页增加关系管理）两项修复。核心决策：contains 的语义与数据显示方向
（rack→dc，即「机柜包含于数据中心」）矛盾，不是改文案而是彻底统一约定——
**所有层级关系统一 from=子、to=父**，contains 整体替换为 contained_in，
关系类型从硬编码升级为数据库注册表：

- **后端注册表与迁移**：新增 `RelationType` 表（type 主键/name_zh/name_en/
  direction/is_builtin），启动时种入 15 种内置关系（首项 contained_in 替代 contains，
  `AppSetting` 标记防删后重种）；`migrate_contains_to_contained_in` 幂等迁移两处存量：
  关系实例表（type 改写 + from/to 互换，撞唯一约束时丢弃源行）与数据集规格 JSON
  （type/from_type/to_type 互换 + coverage 翻转，端点互换后覆盖语义随之反转）；
- **动态校验与提示词**：`parse_and_validate` 新增 `allowed_relation_types` 参数，
  RelationSpec 字段只校验格式，是否注册由调用方传注册表清单；
  `build_default_system_prompt(relation_types)` 动态构建 AI 系统提示词
  （关系清单格式 `type=中文名（direction）`，常见搭配改为
  `rack contained_in data_center（coverage=from）`），改名后提示词同步变化；
- **关系类型 API**：`GET /api/v1/relation-types` 登录会话可读；
  `POST/PUT/DELETE /api/v1/admin/relation-types` 仅管理员会话
  （删除被数据集规格引用的类型返回 409）；
- **前端动态化**：`useRelationTypes` 共享 hook（模块级缓存 + 增删改后失效）；
  `relationTypeLabel` 支持注册表覆盖中英文名称；TopologyView 分层集合改由注册表
  direction 动态构建（自定义层级类型自动参与分层），删除 `unifiedEdgeEndpoints`
  （数据方向已统一，边直接 from→to 绘制）；SpecEditor 关系下拉、
  数据集详情页关系列表/筛选/规格展示全部接注册表；
- **设置页「关系类型管理」卡片**：表格列出类型标识/中文名/英文名/方向/内置标记，
  行内编辑改名改方向、新增自定义类型（格式校验与后端一致）、
  删除带确认弹窗（被引用时展示 409 详情）。

验证：后端 103 passed（新增 7 条：种子/CRUD 回路/删除引用保护/自定义类型
spec 接受/迁移幂等/动态提示词/回退）；Vitest 24 passed（unifiedEdgeEndpoints
测试删除，新增注册表覆盖与自定义分层类型测试）；Playwright 12 passed
（新增管理员维护关系类型闭环，旧用例改精确断言）；容器（8093）重建验证：
isl-i2-data 卷中 3 个旧数据集的 12 条 contains 关系实例与 3 条规格条目
启动时自动迁移（rack contained_in data_center，coverage from，幂等重
启零改动），浏览器取证 13 项全过（证据见 `/tmp/isl-relation-evidence/`）。
排查中发现迁移首版遗漏 coverage 翻转（to 未变 from，覆盖语义从「每个机柜
都有归属」退化为「每个数据中心至少被包含一次」），已修复并补断言。

### 设置页功能区折叠化（已同步 GitHub）

第七轮试用反馈（设置页各功能默认折叠、点开展开、页面简洁）已实现：

- **`CollapsibleCard` 共享组件**（`web/src/components/CollapsibleCard.tsx` + 新增
  `ui/collapsible.tsx` radix 封装）：卡片头部（标题 + 摘要 + chevron）始终可见、
  整行点击展开/收起，功能区默认折叠，展开时内容区以分隔线区隔；
- **状态摘要上移**：折叠态头部直接呈现关键状态——API Key 配置徽标、关系类型
  计数（“共 N 种”）、AI 已配置/未配置徽标、未登录时的 403 权限提示
  （“修改 AI 配置与提示词需要管理员登录”），无需展开即可判断是否需要操作；
- **覆盖范围**：账户与密码、API Key（备用通道）、关系类型管理、AI 建议服务、
  接口文档五张卡全部折叠；未登录引导卡保持展开（本身就是登录入口）。

验证：tsc 无错；Vitest 24 passed；Playwright 12 passed（`login` helper 与
设置页用例先展开卡片再操作，新增“默认收起 → 展开后可见”断言）；容器 8093
重建后用户浏览器实测通过。

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

发布或修复只能按实际证据描述为本地验证、PR CI、合并或发布；这些状态不能互相替代。

## 当前权威顺序

发生冲突时，按以下顺序判断：

1. GitHub `main` 中实际存在的代码、测试与配置；
2. 本状态文档中的“当前阶段”和验证基线；
3. 各专题文档对具体机制的说明；
4. Issue 与提交记录中的历史过程；
5. `docs/research/` 中的历史调研。

历史聊天记录、未关联到分支的 Git 对象、临时工作目录或未提交代码都不代表仓库当前状态。
