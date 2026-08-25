# CMDB 使用示例：如何消费 InfraSourceLab 数据集

本文档面向下游系统（CMDB 同步、巡检脚本、数据分析）集成方，说明如何通过
REST API 读取生成的 CI 数据。所有示例中的变量：

- `$BASE`：服务地址，例如 `http://localhost:8093`
- `$TOKEN`：Bearer Token（管理员登录后获得的会话令牌，或环境变量 `ISL_API_KEY` 备用令牌）
- `$DATASET_ID`：数据集 ID（在页面或 `GET /api/v1/datasets` 中查看）

## 1. 认证：Bearer Token

所有数据接口都需要在请求头携带令牌：

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/datasets"
```

两种令牌来源：

| 方式 | 说明 |
| --- | --- |
| 管理员会话令牌 | `POST /api/v1/auth/login`（用户名 + 密码）返回 `token`，有效期 12 小时 |
| 备用 API Key | 启动时通过 `ISL_API_KEY` 环境变量注入，长期有效，适合脚本 |

登录示例：

```bash
TOKEN=$(curl -s -X POST "$BASE/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | python3 -c 'import sys, json; print(json.load(sys.stdin)["token"])')
```

## 2. 找到数据集

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/datasets?page=1&page_size=20"
```

返回 `items` 列表，其中 `id` 即 `$DATASET_ID`；`ci_counts_by_type` 给出各类型数量，
可用于预估分页规模。

## 3. 分页读取 CI

CI 列表接口支持分页，`page` 从 1 开始，`page_size` 上限 200：

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v1/datasets/$DATASET_ID/cis?page=1&page_size=50"
```

响应结构：

```json
{
  "items": [ { "id": "server-0001", "type": "physical_server", "name": "...", "attributes": {}, "tags": {} } ],
  "page": 1,
  "page_size": 50,
  "total": 128
}
```

遍历全量数据的典型循环：

```bash
PAGE=1
while :; do
  COUNT=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$BASE/api/v1/datasets/$DATASET_ID/cis?page=$PAGE&page_size=100" \
    | tee /tmp/page.json | python3 -c 'import sys, json; print(len(json.load(sys.stdin)["items"]))')
  # 处理 /tmp/page.json ...
  [ "$COUNT" -lt 100 ] && break
  PAGE=$((PAGE + 1))
done
```

## 4. 筛选：类型与关键词

- `type`：只返回某个 CI 类型（如 `physical_server`、`virtual_machine`、`rack`）
- `q`：按名称、主机名、IP、序列号、编码做子串匹配

```bash
# 所有虚拟机
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v1/datasets/$DATASET_ID/cis?type=virtual_machine&page_size=100"

# 关键词筛选（可与 type 组合）
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v1/datasets/$DATASET_ID/cis?type=physical_server&q=prod"
```

单条 CI 详情（按 ID 精确获取）：

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v1/datasets/$DATASET_ID/cis/server-0001"
```

## 5. 关系与回指

关系接口同样支持分页与筛选：

```bash
# 全部关系
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v1/datasets/$DATASET_ID/relations?page=1&page_size=100"

# 按关系类型 / 起点 / 终点筛选（关系回指：查某台服务器挂载了哪些虚拟机）
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v1/datasets/$DATASET_ID/relations?type=runs_on&to_id=server-0001"
```

每条关系含 `from_id/from_type/from_name` 与 `to_id/to_type/to_name`，
无需再次查询即可还原两端信息。常见关系语义：

| 类型 | 含义 | 方向示例 |
| --- | --- | --- |
| `contains` | 包含 | 数据中心 → 机架 |
| `mounted_in` | 安装于 | 物理服务器 → 机架 |
| `runs_on` | 运行于 | 虚拟机 → 物理服务器 |
| `depends_on` | 依赖 | 应用 → 数据库等 |

## 6. 字段映射建议

CI 记录分三层，建议按如下方式映射到目标 CMDB：

| 来源 | 建议映射 |
| --- | --- |
| `id` | 目标系统的外部主键 / 关联键（稳定且确定性生成） |
| `type` | CI 类别（决定目标系统的对象模型） |
| `name` | 显示名 / 主机名 |
| `attributes.*` | 业务属性，如 `ip_address`、`serial_number`、`status`、`cpu_cores`、`memory_gb`、`os_name` |
| `tags.*` | 标签，如 `env`、`region`、`owner` |

注意：

- 数据集可能启用了数据质量缺陷（缺失字段、大小写漂移、重复记录、错误值），
  用于演练数据治理。`GET /api/v1/datasets/$DATASET_ID` 的 `warnings`
  字段会列出注入了哪些缺陷及其数量，接入方可据此决定清洗策略。
- 相同 `seed` + 相同规格生成的数据完全一致，可安全做幂等同步（以 `id` 为键 upsert）。

## 7. 其他常用接口

```bash
# 数据集摘要（含规格与统计）
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/datasets/$DATASET_ID/summary"

# 拓扑抽样（默认最多 200 个节点，支持 ci_type/relation_type/q/center 参数）
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v1/datasets/$DATASET_ID/topology?center=server-0001"

# 导出文件（json / csv / xlsx）
curl -s -O -J -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v1/datasets/$DATASET_ID/export?format=csv"
```
