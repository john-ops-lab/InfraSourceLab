# InfraSourceLab

> 用自然语言快速生成有关系的 CMDB 配置数据，并通过带认证的 REST API 提供给 DLR、CMDB 或其他测试程序。

InfraSourceLab 是一个本地优先、单用户的 **AI CMDB 数据生成工具**。它不会启动 vCenter、Kubernetes、SNMP、Redfish、Kafka 等复杂模拟环境，也没有 Agent、调度、Timeline、Fault 或 Verifier 子系统。

> 当前实现提交正在写入 `main`。完整代码位于 `backend/` 与 `web/`，开发完成后以 GitHub Actions 结果为准。

## 核心流程

```text
自然语言 / 内置模板
        ↓
AI 生成并解释 GenerationSpec
        ↓
用户确认数量、seed 与数据质量规则
        ↓
Python 按 seed 确定性生成 CI 与关系
        ↓
SQLite 持久化
        ↓
Bearer Token REST API
        ├─ DLR 采集
        ├─ CMDB 导入
        ├─ JSON / CSV / XLSX 导出
        └─ 有界简单拓扑
```

AI 只负责把自然语言转换成一个小型结构化规格，不逐条生成记录，也不会在数据接口被调用时再次请求模型。未配置 AI 时，三个内置模板仍可完成全部核心流程。

## 一条命令运行

```bash
cp .env.example .env
# 至少修改 ISL_API_KEY

docker compose up --build
```

打开：Web `http://127.0.0.1:8080`，OpenAPI `http://127.0.0.1:8080/docs`，Health `http://127.0.0.1:8080/health`。

## API 认证

```bash
export ISL_API_KEY=replace-with-a-strong-local-key
curl -H "Authorization: Bearer $ISL_API_KEY" http://127.0.0.1:8080/api/v1/datasets
```

## 核心 API

```text
GET    /api/v1/config
GET    /api/v1/templates
POST   /api/v1/specs/preview
POST   /api/v1/datasets/generate
GET    /api/v1/datasets
GET    /api/v1/datasets/{id}
DELETE /api/v1/datasets/{id}
GET    /api/v1/datasets/{id}/cis
GET    /api/v1/datasets/{id}/relations
GET    /api/v1/datasets/{id}/summary
GET    /api/v1/datasets/{id}/topology
GET    /api/v1/datasets/{id}/export?format=json|csv|xlsx
```

DLR 对接见 [`docs/dlr-http-example.md`](docs/dlr-http-example.md)。

## License

Apache License 2.0，见 [LICENSE](LICENSE)。
