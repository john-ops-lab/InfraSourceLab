# InfraSourceLab 项目约定

## 项目定位

InfraSourceLab 是本地或可信内网使用的 CMDB 测试数据生成器。它把自然语言或内置模板转换为经过校验的 `GenerationSpec`，再由本地确定性生成器产生 CI、关系和导出文件。不要把它扩展成基础设施编排、协议模拟或多租户平台。

## 技术栈与目录

- `backend/`：Python 3.13、FastAPI、SQLAlchemy、SQLite、Pydantic、Faker。
- `web/`：React 19、TypeScript、Vite、Tailwind CSS v4、shadcn/ui、React Flow。
- `docs/`：产品、架构、数据模型、安全边界和当前状态。
- `Dockerfile`、`docker-compose.yml`：单镜像本地部署，默认只发布到 `127.0.0.1:8080`。

## 不得破坏的合同

- AI 只提出规格；`POST /api/v1/specs/from-prompt` 不创建数据集。
- 只有用户确认后的 `GenerationSpec` 才提交到 `POST /api/v1/datasets`。
- 相同规范化规格、seed、生成器版本和锁定依赖必须生成相同结果。
- 层级关系统一为 `from=子、to=父`；内置关系类型可改名和方向，但不可删除。
- CI 搜索只使用受控 `search_text`；新增可搜索字段时同时更新生成器与测试。
- 拓扑最多返回 200 个节点；截断必须优先保留完整关系端点，不能只按类型前缀取孤立节点。
- SQLite 使用 `PRAGMA user_version`。任何持久化结构变化都必须有明确版本和兼容策略。

## 开发与验证

```bash
cd backend && uv sync --frozen && uv run pytest
cd web && npm ci && npm test && npm run build
cd web && npx playwright install chromium && npm run e2e
```

- 修 bug 时先增加稳定复现测试，再做最小修改。
- 后端、前端、E2E 和构建结果必须分别报告；未运行的门禁不能写成通过。
- 代码行为变化时同步 `README.md`、`docs/status.md` 及受影响的专题文档。
- 不提交 `.env`、SQLite 数据库、测试证据、构建产物、缓存或真实凭据。
- 提交前检查 `git diff`、`git status` 和暂存文件；通过 PR 与 CI 合入 `main`。

## 当前权威顺序

当前分支代码与测试 > `README.md`、`docs/status.md` > 其他专题文档 > `docs/research/` 历史调研。
