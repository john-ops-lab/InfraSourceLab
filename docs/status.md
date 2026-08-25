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
