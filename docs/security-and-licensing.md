# 安全与第三方许可证边界

## 1. 威胁模型

InfraSourceLab 第一阶段是本地/自托管、可信管理员/开发团队、allowlisted Drivers、测试数据环境。

它不是互联网不可信用户的任意容器平台、SaaS multi-tenant sandbox 或任意脚本/镜像执行器。

但以下输入依然必须视为**不可信数据**：

- 用户手写 Scenario/YAML；
- AI Candidate；
- Visual Builder payload；
- OpenAPI/HAR/Postman/YANG/capture；
- Observation；
- 第三方 Source 返回内容。

“本地可信用户”不是跳过 parser/resource/security limits 的理由。

---

## 2. Docker 权限边界

```text
Web → Control → typed Agent Command → Lab Agent → Docker
```

Control 禁止直接拥有 Docker socket。

Agent 只接受结构化 command，例如：

```json
{
  "operation": "start_source",
  "run_id": "...",
  "driver": "postgresql",
  "manifest_id": "..."
}
```

禁止任意 shell、image、host mount、privileged/host-network flags。

Driver/受控 registry 声明允许的 exact image/version；Scenario/AI/Builder 不能传任意 image。

---

## 3. Host Mount / Workspace

Scenario 不可声明任意 host path（`/`, `/etc`, `/var/run/docker.sock`, user home 等）。

Agent 只挂载受控 run workspace：

```text
<isl-data>/runs/<run-id>/...
```

Import/capture/archive 还要防 path traversal、symlink escape、archive bomb。

---

## 4. Network 默认安全

- Source 在 per-run internal network；
- 宿主访问默认 bind `127.0.0.1`；
- 不默认 `0.0.0.0`；
- LAN exposure 用户显式开启并看到风险；
- Source credential 每 Run 生成；
- 不使用生产 password/token。

---

## 5. Outbound / Cloud Fail-closed

Cloud SDK 等可能误访问真实系统。

必须：

- fake credentials；
- emulator endpoint override；
- tests assert endpoint points to Lab；
- missing/bad override fail closed；
- AI 不可隐式加入 arbitrary external URL；
- 后续可增加 Agent egress policy。

---

## 6. Credentials

### Lab-generated

DB/SNMP/SSH/Redfish 等 test credential 仅当前 Run 使用。

### External/capture

- 不写 Scenario；
- secret reference/env/secure config；
- UI 不永久明文回显；
- logs redaction；
- AI context 不含 secret；
- reveal/copy 要显式用户动作。

---

## 7. Authoring / Compile / Run 权限层级

```text
Unsaved Working Copy
  ├─ Validate
  ├─ Estimate
  └─ AI Candidate
        ↓ user Save
Immutable Revision
        ↓ user Compile
Compile Manifest
        ↓ user Start
Run
```

- unsaved validate/estimate 不需要 Scenario ID，也不产生运行权限；
- authoritative Compile 只能引用 immutable Revision；
- Start 只能引用成功 Compile Manifest；
- AI/Builder 不能把未审查草稿直接送进 Docker runtime。

---

## 8. Scenario / YAML Parser 安全 — M0 起

`/api/authoring/validate` 在保存前就会解析用户/AI 内容，因此 parser 安全从 M0 就是 Gate。

### Required

- 使用 safe YAML parser / safe loader；
- 禁止 YAML custom object construction / Python object tags / arbitrary constructors；
- 默认不接受未知/危险 tags；
- parse 后只得到 JSON-compatible data model；
- Pydantic/schema 是 authoritative shape validation；
- 明确 source size limit；
- 明确 nesting/depth limit 或等价防御；
- 明确 mapping/sequence/item-count limits 或等价 resource guard；
- 防 alias/anchor amplification（billion-laughs-like expansion）；
- 对极端字符串/key 数量有 bounded handling；
- parse/validation timeout/cancellation/resource failure 返回稳定 error，不拖垮 Control。

### Suggested resource settings

具体默认值应通过实现/测试选择，但配置模型至少预留类似：

```text
max_scenario_source_bytes
max_scenario_depth
max_scenario_collection_items
max_scenario_alias_expansion / parser-safe equivalent
max_authoring_request_bytes
```

不要为了避免 DoS 完全禁止 YAML anchor；如果安全 parser 可以有界支持，则 capability/limit 文档化。重点是**不能无限扩张**。

### Tests

至少：

- unsafe object tag rejected；
- oversized source rejected；
- excessive nesting rejected/bounded；
- alias amplification rejected/bounded；
- huge collection rejected/bounded；
- valid ordinary YAML unaffected。

---

## 9. Working Copy / AI Staleness

```text
source_digest   = raw source hash
semantic_digest = canonical normalized document hash
```

AI Candidate 携带 `base_semantic_digest`。Apply 前必须等于 current semantic digest；否则禁止 blind overwrite。

M1 提供最小 stale blocking；M5 扩展 frozen snapshot / 3-way rebase。

---

## 10. AI 输入与权限

AI 默认只获得 current Working Copy、user prompt、Scenario schema、Driver capability summary、resource policy、bounded diagnostics，以及 M5 后用户显式 sanitized context/attachment。

默认不得获得：Docker socket/internal details、host filesystem、secrets、raw capture、arbitrary env、hidden reasoning。

AI 不自动：

- Save Revision；
- authoritative Compile；
- Start/Stop/Delete Run；
- Timeline Step；
- destructive Fault；
- Driver install / arbitrary image；
- shell/Docker；
- read secret。

Provider 未配置/故障不阻塞 Builder/Expert YAML/validate/estimate/save/compile/run。

Provider key server-side only。

---

## 11. Prompt Injection / Import

OpenAPI/HAR/log/text/YANG/capture 都是不可信数据：

- attachment/import 是 data/context，不是 system instruction；
- 内容不能扩大 tool permission；
- raw capture 不默认进 AI；
- token/header/cookie redaction；
- sanitization preview/accept；
- size/count/depth/recursion limits；
- archive path/symlink/bomb defense；
- URL import（若有）防 SSRF/private-network abuse。

通用 Importer/Attachment 从 M5 正式成为产品平台能力；M4A/M4B Driver-specific YANG/replay ingest 不等于通用 Importer。

---

## 12. Frontend / Browser Tool 安全

UI Skills / Chrome DevTools MCP 是开发工具，不进入 runtime。

Chrome DevTools MCP 能读取页面/Console/Network：

- 开发浏览器只用 test/fake credentials；
- 不加载真实生产 secret 再交给 Agent；
- screenshot/evidence 不含 token/password；
- Playwright 使用 test data；
- MCP 不可用不能用 `npm build` 替代真实 browser/security Gate。

---

## 13. Scenario 执行安全

`v1alpha1` 禁止：

- arbitrary shell；
- arbitrary Python/JS/Jinja execution；
- arbitrary Docker image；
- arbitrary host mount；
- arbitrary privileged/host network。

Projection 使用 allowlisted pure transforms（或未来受控表达式子集）。

AI/Builder/Expert YAML 经过同一 validation/security pipeline，没有 UI 特权通道。

---

## 14. Resource Limits

Authoring Estimate / Compile Preview 至少估算 node/edge/source/container/ports/disk/memory hints。

平台配置至少覆盖：

```text
max_scenario_source_bytes
max_authoring_request_bytes
max_truth_nodes
max_truth_edges
max_sources_per_run
max_containers_per_run
max_artifact_bytes
max_capture_bytes
max_observation_bytes
max_concurrent_runs
max_published_ports
```

M6 再完善 Truth-version retention/resource admission。超过 hard limit 禁止 Compile/Start；AI/Builder 不能绕过。

---

## 15. Compile Base / Run 隔离

```text
Compile Base V0 immutable
  ├─────────────┐
  ↓             ↓
Run A           Run B
own Truth       own Truth
own Source      own Source
own faults      own faults
```

Security/Correctness tests 必须防：

- cross-run native data leakage；
- Run A fault affecting B；
- runtime action mutating Compile Base；
- cleanup A deleting B resources；
- recovery assigning A version/state to B。

---

## 16. Third-party Version / Capability Security

```text
exact pinned backend version/image
      ↓
actual integration test
      ↓
Driver/Fault capability registry
```

不能因为 upstream `main`/README 有功能就让 UI/Compiler 宣称支持。升级版本重跑 compatibility/security tests。

---

## 17. Supply Chain

每默认 Driver 记录：source URL、version/image/digest where appropriate、license、architecture、redistribution notes、verified capabilities。

CI/Release 做 dependency/license/image scan；提交 lockfiles；不使用来源不明/长期不维护镜像作为默认；不以 `latest` 作为可复现运行条件。

---

## 18. 项目许可证

本仓库使用 **Apache License 2.0**，根目录 `LICENSE` 为项目许可证。

第三方工具/容器遵循各自许可证。

- Library/copied code：确认兼容并保留 attribution/NOTICE；
- External process/container：仍记录 version/license/source/redistribution；
- User-provided system/image：ISL 不分发受限内容。

正式 Driver 引入时重新核验目标版本 LICENSE。

---

## 19. Vendor Models / MIB / YANG / Images

- vendor MIB/YANG 不默认分发；
- standard model 也保留适用声明；
- vendor NOS image 用户合法提供；
- simulator 开源不等于全部模型/镜像可再分发。

---

## 20. Capture / Replay

Raw capture 可能含 token/cookie/private URL/hostname/IP/serial/customer data。

```text
var/captures/raw/       # gitignored
var/captures/sanitized/ # reviewed artifact
```

```text
raw → detect/sanitize → validation report → user preview → sanitized replay/import
```

未经 sanitize 不自动进入 Git/AI/public artifact。

---

## 21. Logging / Redaction

- no plaintext password/token；
- redact Authorization/Cookie/X-API-Key；
- AI request 不完整 dump；
- attachment body 不 log；
- Agent env only allowlisted diagnostics；
- findings bounded expected/actual；
- browser evidence no secret。

---

## 22. Cleanup

只删除：

```text
io.infrasourcelab.managed=true
AND io.infrasourcelab.run=<target>
```

禁止 `docker system prune` 作为产品 cleanup。

---

## 23. 每 Wave Security Gate

至少检查：

1. 新 Docker/host 权限？
2. arbitrary input → executable input？
3. Scenario/YAML parser limits 是否安全？
4. 新 secret surface？
5. raw capture/attachment？
6. bind 0.0.0.0？
7. 新第三方 image/library exact version/license/capability？
8. cleanup 越界？
9. AI 获得新写/执行能力？
10. failure path 泄密？
11. traversal/SSRF/archive bomb？
12. browser evidence 含 secret？
13. Compile/Run 绕过 immutable gate？
14. stale Candidate 覆盖新 Working Copy？
15. cross-run Truth/Source/native/fault leakage？
16. runtime 修改 Compile Base？

这些变化不能只按普通 CRUD Review。