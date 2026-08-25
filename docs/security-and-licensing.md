# 安全与第三方许可证边界

## 1. 威胁模型

InfraSourceLab 第一阶段是：

- 本地/自托管；
- 单个可信管理员或可信开发团队；
- allowlisted Drivers；
- 测试数据与实验环境。

它不是：

- 互联网不可信用户的任意容器平台；
- SaaS multi-tenant sandbox；
- 任意脚本/镜像执行器。

即便可信开发环境，Lab Agent 接触 Docker Engine 后权限依然很高，所以安全边界从 M0 建立。

---

## 2. Docker 权限边界

```text
Web → Control → typed Agent Command → Lab Agent → Docker
```

Control **禁止**直接拥有 Docker socket。

### Typed command

允许：

```json
{
  "operation": "start_source",
  "run_id": "...",
  "driver": "postgresql",
  "manifest_id": "..."
}
```

禁止：

```json
{"command": "docker run ..."}
```

### Image Allowlist

Driver/受控 registry 声明允许的 image repository/tag/digest；Scenario/AI/Builder 不可提供任意 image。

---

## 3. Host Mount

Scenario 不能声明任意 host path：

```text
/Users/...
/etc
/
/var/run/docker.sock
```

Agent 只挂载受控 workspace：

```text
<isl-data>/runs/<run-id>/...
```

archive/import/capture 还要防 path traversal、symlink escape、archive bomb。

---

## 4. Network 默认安全

- source 在 per-run internal network；
- 宿主访问默认 `127.0.0.1`；
- 不默认 bind `0.0.0.0`；
- LAN exposure 必须用户显式开启并看到 bind/risk；
- source credentials 每 Run 生成；
- 不使用生产 password/token。

---

## 5. Outbound / Cloud Fail-closed

Cloud SDK 等可能误访问真实系统。

必须：

- emulator fake credentials；
- endpoint override；
- integration test 断言 endpoint 指向 Lab；
- endpoint 缺失/异常 fail closed；
- AI 不可隐式增加 arbitrary external URL；
- 后续可加 Agent egress policy。

---

## 6. Credentials

### Lab-generated

Postgres/SNMP/SSH/Redfish 等 test credential 仅当前 Run 使用。

### External/capture

- 不写 Scenario；
- secret reference/env/config；
- UI 不永久明文回显；
- logs redaction；
- AI context 不含真值；
- copy/reveal 需要明确用户动作。

InfraSourceLab 自己维护此合同，不复制 DLR Credential UI。

---

## 7. Authoring / Compile / Run 安全边界

产品明确分三层：

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

### Unsaved authoring

validate/estimate 不需要 Scenario ID，也不产生运行权限。

### Compile

Authoritative Compile **只能**引用 immutable Revision，不能接受浏览器任意草稿直接变成运行 manifest。

### Run

Start **只能**引用成功 Compile Manifest。

这能防止 AI/Builder 一次未审查变更直接进入 Docker runtime。

---

## 8. Working Copy / AI Staleness

Working Copy 使用：

```text
source_digest
semantic_digest
```

AI Candidate 携带 `base_semantic_digest`。

Apply 前必须确认 base digest 仍等于当前 Working Copy semantic digest；不相等时禁止 blind overwrite。

M1 提供最小阻断，M5 再提供 frozen snapshot / richer 3-way rebase UX。

---

## 9. AI 输入与权限

AI 默认只获得：

- current Working Copy；
- user prompt；
- Scenario schema；
- Driver capability summary；
- resource policy；
- bounded diagnostics；
- M5 后用户显式 context + sanitized attachment。

默认不获得：

- Docker socket/internal details；
- host filesystem；
- secrets；
- raw capture；
- arbitrary env；
- hidden reasoning。

### Human-in-the-loop

```text
LLM
 ↓ Candidate
strict server validation
 ↓
User Apply
 ↓ Working Copy
User Save
 ↓ Revision
User Compile
 ↓ Manifest
User Start
```

AI 不自动：

- Save Revision；
- authoritative Compile；
- Start/Stop/Delete Run；
- Step Timeline；
- Enable destructive Fault；
- Install Driver / pull arbitrary image；
- shell/Docker；
- read secret。

### Provider 未配置

AI 是 optional enhancement。Provider 未配置/故障不能阻塞 Builder、Expert YAML、validate/estimate、save/compile/run。

Provider key 只在 server-side；Web 只能看到 configured/unconfigured/health-like state。

---

## 10. Prompt Injection / Import

OpenAPI/HAR/log/text/YANG/capture 都是不可信数据。

- attachment/import 标记为 data/context，不是 system instruction；
- 内容不能扩大 tool permission；
- raw capture 不默认进入 AI；
- HAR/Postman/common token/header redaction；
- sanitization 有预览/确认；
- import parser 有 size/count/recursion limits。

完整 Importer/Attachment pipeline 从 M5 正式成为用户功能；M5 前不通过假 UI 入口绕过这些安全边界。

---

## 11. Frontend / Browser Tool 安全

UI Skills 与 Chrome DevTools MCP 是开发工具，不进入 runtime。

Chrome DevTools MCP 可以读取页面、Console、Network，因此：

- 开发浏览器只使用 test/fake credentials；
- 不加载真实生产 secret 后交给 Agent；
- screenshot/evidence 不含 token/password；
- Playwright CI 使用 test data；
- 工具连接失败不能用 `npm build` 替代安全/浏览器验收。

---

## 12. Scenario 执行安全

`v1alpha1` 禁止：

- arbitrary shell；
- arbitrary Python/JS/Jinja execution；
- arbitrary Docker image；
- arbitrary host mount；
- arbitrary privileged/host networking。

Projection 只使用 allowlisted pure transforms（或未来受控表达式子集）。

AI/Builder/Expert YAML 都经过同一 validation，没有 UI 特权通道。

---

## 13. Resource Limits

Authoring Estimate / Compile Preview 至少估算：

- node/edge；
- source/container；
- published ports；
- disk/artifact；
- memory/cpu hints。

平台 hard limits：

```text
max_containers_per_run
max_truth_nodes
max_truth_edges
max_artifact_bytes
max_capture_bytes
max_observation_bytes
max_concurrent_runs
max_published_ports
```

超过 hard limit 禁止 Compile/Start；AI/Builder 不能绕过。

---

## 14. Third-party Version / Capability Security

第三方 backend 的 capability 必须基于：

```text
exact pinned version/image
        ↓
actual integration test
        ↓
Driver/Fault capability registry
```

不能因为上游 `main` 或 README 有功能就让 UI/Compiler 宣称支持。

这对 fault backend 尤其重要：packet loss、reset、bandwidth 等只在实际 pin 版本测试通过后暴露。

升级版本必须重跑 compatibility/security tests。

---

## 15. Supply Chain

每个默认 Driver 记录：

- exact source URL；
- version/image tag；
- digest（发布阶段尽量）；
- license；
- architecture；
- redistribution notes；
- verified capabilities。

CI/Release 做 dependency/license/image scan；提交 Python/npm lockfiles；不使用来源不明/长期不维护镜像作为默认。

Scenario 不使用 `latest` 作为可复现条件。

---

## 16. 项目许可证

本仓库使用 **Apache License 2.0**，根目录 `LICENSE` 为项目许可证。

第三方工具/容器不会因为被 ISL 编排就变成 Apache-2.0。

### 集成分类

A. Library/copied code：最严格，确认兼容性并保留 attribution/NOTICE。

B. External process/container：仍记录 project/version/license/source/image/redistribution。

C. User-provided system/image：ISL 只提供 integration，不分发受限内容。

正式 Driver 引入时重新核验目标版本 LICENSE。

---

## 17. Vendor Models / MIB / YANG / Images

- 厂商 MIB 不默认分发；
- 厂商 YANG 不默认复制；
- vendor NOS image 由用户合法提供；
- simulator 开源不代表所有数据模型/镜像可再分发。

---

## 18. Capture / Replay

Raw capture 可能包含 token/cookie/private URL/hostname/IP/serial/customer data。

建议：

```text
var/captures/raw/       # gitignored
var/captures/sanitized/ # reviewed artifact
```

Pipeline：

```text
raw
 ↓ detect/sanitize
 ↓ validation report
 ↓ user preview
sanitized artifact
 ↓ replay/import
```

未经 sanitize 不自动进入 Git/AI/public artifact。

---

## 19. Logging / Redaction

- no plaintext passwords/tokens；
- redact Authorization/Cookie/X-API-Key；
- AI request 不完整 dump；
- attachment body 不 log；
- Agent env 只返回 allowlisted diagnostics；
- Verification expected/actual 有大小上限；
- browser evidence 不含 secret。

---

## 20. Cleanup 安全

只删除：

```text
io.infrasourcelab.managed=true
AND
io.infrasourcelab.run=<target>
```

禁止 `docker system prune` 作为产品 cleanup。

---

## 21. 每个 Wave Security Gate

至少检查：

1. 新 Docker/host 权限？
2. arbitrary input → executable input？
3. 新 secret surface？
4. raw capture/attachment？
5. bind 0.0.0.0？
6. 新第三方 image/library？
7. exact version/license/capability 已验证？
8. cleanup 越界？
9. AI 获得新写/执行能力？
10. failure path 泄密？
11. traversal/SSRF/archive bomb？
12. browser evidence 含 secret？
13. Compile/Run 是否绕过 immutable gate？
14. stale Candidate 是否能覆盖新 Working Copy？

任何一项变化都不能只按普通 CRUD Review。