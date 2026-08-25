# 生成与接口策略

## 1. 当前决策

InfraSourceLab MVP 不模拟 vCenter、SNMP、Kubernetes、Redfish、云 API 或数据库协议。

它生成统一的 CMDB 配置数据，并通过：

```text
Authenticated REST API
JSON
CSV
XLSX
```

提供给外部系统。

原因：这条路径最快满足 DLR 和后续 CMDB 的主要开发测试需求，同时避免把项目变成长期维护的多协议平台。

---

## 2. AI 与生成器分工

### AI 做什么

```text
用户意图
→ CI 类型
→ 数量
→ 关系
→ 简单字段偏好
→ GenerationSpec
```

### AI 不做什么

- 不逐条生成记录；
- 不直接写数据库；
- 不决定任意 Python/脚本；
- 不执行容器；
- 不为每次查询即时编造响应。

### 本地生成器做什么

- 生成稳定 ID；
- 生成合理字段；
- 分配 IP/序列号/UUID；
- 建立关系；
- 校验引用；
- 批量持久化；
- 导出。

---

## 3. 生成器组织

简单 registry 即可：

```python
GENERATORS = {
    "data_center": DataCenterGenerator(),
    "rack": RackGenerator(),
    "physical_server": PhysicalServerGenerator(),
    "virtual_machine": VirtualMachineGenerator(),
    "application": ApplicationGenerator(),
}
```

每个生成器负责：

```text
supported overrides
record attributes
stable ID prefix
optional validation
```

不要建设动态插件加载、WASM、容器 Driver 或远程 registry。

---

## 4. 字段生成

优先使用成熟库和少量自有规则：

```text
Mimesis/Faker → names, companies, versions, basic values
stdlib ipaddress → IP allocation
uuid5/hashlib → deterministic UUID/digest
small curated lists → vendors/models/status/environments
```

重要约束：

- 依赖 pin 版本；
- 使用局部 seed/PRNG，不依赖全局不可控随机状态；
- 生成顺序稳定；
- 不需要机器学习合成框架。

---

## 5. 关系生成

关系不是后处理随机猜测，而是规格的一部分。

示例：

```text
2 data centers contain 30 racks
200 physical servers mounted in racks
800 VMs run on physical servers
80 applications hosted on VMs
15 databases used by applications
```

简单算法足够：

- balanced；
- round-robin；
- seeded random；
- one-to-many。

生成后运行完整性检查：

- from/to 均存在；
- 关系类型合法；
- 无意外悬空；
- 重复边符合规则；
- 数量摘要正确。

---

## 6. 数据规模

MVP 目标：

```text
常用：100 ～ 5,000 CI
验收：10,000 CI + 合理关系
```

技术措施：

- bulk insert；
- API 分页；
- UI 服务端分页；
- 导出流式或分批写入（实现简单时）；
- 不一次渲染全部记录。

不为 100k/百万级数据提前引入 Worker、队列、分布式存储或图数据库。

---

## 7. REST API 设计

API 目标是让普通客户端立即可用。

### 稳定资源

```text
datasets
cis
relations
summary
export
```

### 分页响应建议

```json
{
  "items": [],
  "page": 1,
  "page_size": 100,
  "total": 1000
}
```

### CI 查询

```text
type
q
page
page_size
```

`q` 可以先匹配 `id/name` 和有限常用属性，不需要通用 JSON 查询语言。

### Relation 查询

```text
type
from_id
to_id
page
page_size
```

### OpenAPI

FastAPI 自动生成 OpenAPI。产品 UI 提供：

- Base URL；
- Bearer Header 示例；
- 当前 dataset ID；
- copyable curl；
- 常用分页/筛选示例。

---

## 8. 认证策略

首版只用：

```text
ISL_API_KEY
Authorization: Bearer ...
```

它足以防止无意的匿名调用，并适合本地/可信内网开发。

不实现：

- API Key CRUD；
- 多用户；
- 权限范围；
- OAuth/OIDC；
- refresh token；
- SSO。

如果未来公开部署，认证另立 Issue，而不是拖慢本地 MVP。

---

## 9. 导出策略

### JSON

一个文件包含：

```json
{
  "dataset": {},
  "cis": [],
  "relations": []
}
```

### CSV

推荐 ZIP 或多个 CSV：

```text
summary.csv
ci_<type>.csv
relations.csv
```

若首版为实现简单使用一个扁平 CI CSV，也必须文档说明 `attributes` 如何编码。

### XLSX

建议 sheets：

```text
Summary
CI_<type>
Relations
```

使用成熟 xlsx 库，不自己实现格式。

---

## 10. 模板与 fallback

AI 未配置时提供几个模板：

```text
Small Data Center
Medium Enterprise
Application + Database
Kubernetes Basics
```

模板本质也是 GenerationSpec。

这保证：

- 本地无模型也能使用；
- CI 测试不依赖付费 API；
- 用户可以快速理解规格结构。

---

## 11. 什么时候才增加新数据源形态

完成 MVP 并实际用 DLR 测试后，按问题判断：

1. 通用 REST/文件是否已经足够？
2. 具体 Adapter 是否依赖真实协议行为？
3. 是否有成熟现成模拟器可直接调用？
4. 这个需求是否会被反复使用？
5. 能否做一个很薄的单一 Adapter，而不是平台？

只有答案支持时才新建 focused Issue。

例如真正需要 SNMP 时，单独评估 `snmpsim`；不要提前恢复“全协议 Driver Pack”。

---

## 12. 历史调研的定位

`docs/research/` 中的 Microcks、vcsim、KWOK、snmpsim 等调研仍有参考价值，但：

- 不属于当前路线；
- 不作为 #1 验收条件；
- Qoder 不应读取后顺手实现；
- 只有出现具体需求时再复查最新版本和许可证。

---

## 13. 停止规则

当 #1 能完成：

```text
Prompt → Spec → Dataset → Bearer API → Export
```

就停止扩展，进入实际 DLR 使用和 Review。

不要在同一 Go Mode Wave 中追加：拓扑、协议模拟、故障、验证、导入器、远程运行或企业认证。