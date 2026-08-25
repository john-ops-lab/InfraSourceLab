# 安全与许可证边界

## 1. 威胁模型

InfraSourceLab MVP 是：

- 本地或可信内网；
- 单用户；
- 生成测试数据；
- 一个普通 Web/API 应用；
- 默认监听 localhost。

它不是：

- 公网 SaaS；
- 多租户系统；
- 容器执行平台；
- 任意脚本平台；
- 企业身份管理系统。

安全措施必须覆盖真实风险，但不能把首版拖成安全平台建设。

---

## 2. API 认证

配置：

```text
ISL_API_KEY=<secret>
```

所有 `/api/v1/*` 数据、生成、删除和导出接口要求：

```http
Authorization: Bearer <ISL_API_KEY>
```

要求：

- 使用安全字符串比较；
- 缺失/错误返回 401；
- 日志不记录完整 key；
- 错误响应不回显 key；
- `.env` 不提交 Git；
- `.env.example` 只放占位符；
- 默认 bind `127.0.0.1`。

`GET /health` 可以无认证。

FastAPI `/docs` 是否需要认证可以按实现成本选择，但必须文档说明；本地默认下不因此建设复杂中间件体系。

---

## 3. 前端中的 API Key

前端可以让用户录入 Key，随后附加到请求头。

允许：

- 内存；
- sessionStorage。

不允许：

- 写入源码或构建产物；
- 放在 URL query；
- 发送到 AI；
- 打印 Console；
- 回显服务端环境变量真值；
- 默认长期 localStorage 明文保存。

---

## 4. AI Provider 凭据

```text
ISL_AI_BASE_URL
ISL_AI_API_KEY
ISL_AI_MODEL
```

要求：

- 只在后端读取；
- 不返回浏览器；
- 不写普通日志；
- provider 错误做简化和脱敏；
- 请求有 timeout、输入长度和响应大小限制；
- 测试使用 fake provider。

AI 只返回 GenerationSpec，不获得数据库、文件系统、shell 或运行权限。

---

## 5. 输入安全

MVP 的外部输入：

- prompt；
- GenerationSpec JSON；
- query parameters；
- dataset name；
- export format。

必须：

- Pydantic 权威校验；
- prompt/request 字节上限；
- CI 类型 count 和总 count 上限；
- 字符串长度上限；
- custom field 数量/深度上限；
- page_size 上限；
- export format allowlist；
- 稳定、有限的错误响应。

首版不需要接受 YAML、压缩包、HAR、任意文件上传或 URL import，因此无需为这些未实现能力建设复杂清洗管道。

---

## 6. 禁止任意执行

GenerationSpec 不允许：

```text
shell command
Python/JavaScript
Jinja expression
Docker image
host path
SQL fragment
arbitrary URL callback
plugin package
```

Custom type 只允许有限、安全、JSON-compatible 字段生成规则。

---

## 7. 数据库与事务

SQLite 文件放在受控数据目录。

要求：

- 不把 API/AI key 写入 dataset；
- dataset 删除只删除对应 records/relations；
- 生成失败不留下伪成功数据集；
- relation foreign reference 在发布前校验；
- SQLAlchemy 参数化查询；
- API 不暴露任意 SQL/JSON path 查询。

本地工具不需要数据库加密集群、HA 或复杂备份系统。文档说明用户可备份 SQLite 文件即可。

---

## 8. 导出安全

- 文件名由 dataset ID/安全 slug 生成；
- format allowlist；
- 不接受任意输出路径；
- 临时文件放受控目录并清理；
- CSV/XLSX 对以 `=`, `+`, `-`, `@` 开头的用户可控单元格考虑公式注入转义；
- 导出不包含 API Key 或 AI Key。

---

## 9. 网络

默认：

```text
127.0.0.1
```

用户显式改成 `0.0.0.0` 时，文档提示：

- 必须使用强 API Key；
- 最好放在受控网络或反向代理后；
- MVP 不承诺公网多用户安全。

不需要 Docker socket、privileged container、host network 或远程 Agent。

---

## 10. 日志

可以记录：

- endpoint；
- dataset ID；
- count；
- duration；
- provider status/error category。

不要记录：

- Bearer token；
- AI API Key；
- 完整 prompt（默认）；
- 完整大数据集；
- Authorization header；
- browser session key。

---

## 11. 依赖与许可证

InfraSourceLab 自有代码采用根目录 **Apache License 2.0**。

第三方依赖：

- 使用正常包管理 lockfile；
- 记录主要依赖版本；
- 不复制未知许可证源码；
- shadcn/ui 组件按其正常使用方式进入项目；
- Mimesis/Faker、xlsx 库、assistant-ui 等在实施时核对当前许可证。

首版不需要建立大型 SBOM/供应链平台；基础依赖扫描和许可证检查放入 CI 即可。

---

## 12. 不建设的安全系统

MVP 明确不做：

- 用户注册/登录；
- RBAC；
- OAuth/OIDC/SSO；
- API Key 数据库和权限 Scope；
- mTLS Agent；
- Docker sandbox；
- 多租户隔离；
- 审批工作流；
- 企业审计平台；
- WAF/公网防护方案。

如果未来部署模式变化，再按真实威胁模型新增 focused Issue。

---

## 13. MVP Security Gate

Review 时只需重点证明：

1. 无 Key 的数据接口返回 401；
2. 正确 Key 可调用；
3. Key 不出现在日志、URL、导出和 AI 请求；
4. AI Key 只在后端；
5. Spec/count/page/request 有上限；
6. 无任意执行字段；
7. SQLite 操作和删除不越界；
8. 导出路径/格式安全；
9. 默认只监听 localhost；
10. 不出现 Docker socket/privileged runtime。

通过这十项即可，不因“未来可能公网化”阻塞本地 MVP。