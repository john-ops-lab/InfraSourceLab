# 安全与第三方许可证边界

## 1. 威胁模型

InfraSourceLab 第一阶段定位为：

- 本地/自托管；
- 单个可信管理员或可信开发团队；
- 运行项目自带的 allowlisted Drivers；
- 生成测试数据。

它**不是**：

- 面向互联网不可信用户的任意容器执行平台；
- SaaS multi-tenant sandbox；
- 任意脚本执行器。

即使是可信开发环境，Lab Agent 接触 Docker Engine 后权限依然很高，因此安全边界必须从 M0 建立。

---

## 2. Docker 权限边界

### Control 禁止直接拥有 Docker socket

```text
Web → Control → typed Agent Command → Lab Agent → Docker
```

Control 被攻击时，攻击者不应直接获得 Docker API。

### Agent command 必须结构化

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
{
  "command": "docker run ..."
}
```

### Image Allowlist

Driver 代码/受控 registry 声明允许的 image repository/tag/digest。用户 Scenario 不可直接提供任意 image。

后期 External/Custom Driver 如要开放，必须单独权限 Gate。

---

## 3. Host Mount 边界

Scenario 不能声明任意：

```text
/Users/...
/etc
/var/run/docker.sock
/
```

可挂载目录由 Agent 创建在受控 workspace：

```text
<isl-data>/runs/<run-id>/...
```

Driver 只能获得当前 Run 下被批准的子目录。

所有 archive/import/capture materialization 都必须防 path traversal / symlink escape。

---

## 4. Network 默认安全

默认：

- Control/Web 按本地部署配置暴露；
- source containers 在 per-run internal bridge；
- 需要宿主机测试时只 bind `127.0.0.1`；
- 不默认 bind `0.0.0.0`；
- source 自动生成测试 credentials；
- 不使用生产 password/token。

用户显式选择 LAN exposure 时，UI 必须显示明显风险提示和实际 bind address。

---

## 5. Outbound Network

部分 Driver/SDK 理论上可能意外访问真实云/生产 API。

优先措施：

- Moto 等 emulator 使用测试 credential；
- 自动生成 endpoint override；
- integration test 断言 endpoint 指向 Lab；
- endpoint 缺失/异常时 fail closed；
- Scenario 不允许 AI 隐式添加任意外部 URL；
- 后期 Agent egress policy 可进一步默认隔离。

特别是 cloud SDK 测试，必须防止“mock 配错后真的调用 AWS/Azure/GCP”。

---

## 6. Credentials

Lab credential 与 External credential 分开。

### Lab-generated credentials

例如：

```text
postgres user/password
SNMP community/user
FakeNOS SSH user/password
Redfish user/password
```

由 Agent/Control 生成，只用于当前 Run。

### External/capture credentials

如果后期连接用户真实 sandbox：

- 不写 Scenario YAML；
- secret store/env/config reference；
- UI 不永久回显真值；
- logs redaction；
- AI context 不包含真值；
- copy/reveal 行为需要明确用户动作。

InfraSourceLab 自己维护这一安全合同，不复制 DLR Credential UI/组件体系。

---

## 7. Capture / Replay 是高风险输入

HAR、Postman、HTTP capture、snmpwalk、CLI session、Redfish mockup 等都可能包含：

- tokens；
- cookies；
- Basic/Bearer auth；
- hostname/IP；
- serial/MAC；
- customer/business data；
- private URLs；
- usernames。

### Raw Capture Policy

建议：

```text
var/captures/raw/       # gitignored
var/captures/sanitized/ # 用户明确导出
```

Pipeline：

```text
raw
 ↓ detect/sanitize
 ↓ validation report
 ↓ user preview
sanitized artifact
 ↓ optional import into Scenario
```

未经 sanitize 的 raw capture 不自动加入 Git、AI 或公开 artifact。

---

## 8. AI 输入安全

AI Scenario Assistant 默认只获得：

- 当前 Scenario Working Copy；
- 用户文字；
- 用户显式加入的 context；
- server-sanitized attachment；
- Scenario schema；
- Driver capability summary；
- resource policy；
- bounded diagnostics/report summary。

默认不获得：

- Docker socket/details；
- host filesystem；
- secrets；
- raw capture；
- arbitrary environment variables；
- hidden reasoning。

### Prompt Injection

导入的 OpenAPI/HAR/log/text/YANG 等都属于不可信数据。

服务端把 attachment/import 内容标记为 data/context，而不是系统指令；工具权限不因 attachment 内容扩大。

即使 LLM 被注入，也只能返回 Scenario Candidate 或调用 allowlisted read-only tools，不能直接执行 Agent command。

### AI Human-in-the-loop

```text
LLM output
  ↓
Candidate
  ↓ strict server validation
User review / Apply
  ↓
Working Copy
  ↓ explicit Save / Compile / Start
```

AI 不能自动 Save、Compile、Start、Stop、Step Timeline、Enable destructive Fault、Install Driver、Pull arbitrary image 或读取 secret。

---

## 9. Frontend / Browser Tool 安全

正式开发工具包括 UI Skills 和 Chrome DevTools MCP。

- UI Skills 是设计工程参考，不是产品 runtime dependency；
- Chrome DevTools MCP 可读取被调试浏览器页面、Console、Network 等数据，因此用于 ISL 开发/验收的浏览器环境不得加载真实生产密码、Token 或个人敏感数据；
- Chrome DevTools MCP 不进入用户部署的 InfraSourceLab runtime；
- Playwright CI 使用 fake/test credentials；
- screenshot/evidence 不应包含 secret 真值。

前端运行时使用 shadcn/ui + assistant-ui；不引入第二套通用 UI 框架来规避既有安全/可访问性约束。

---

## 10. Scenario 执行安全

`v1alpha1` 禁止：

- arbitrary shell；
- arbitrary Python/JS；
- arbitrary Jinja execution；
- arbitrary Docker image；
- arbitrary host mount；
- arbitrary privileged flag；
- arbitrary host networking。

Projection expression 只实现 allowlisted pure transforms，或后期采用受控 CEL/JQ 子集。

Visual Builder、AI Candidate 和 Expert YAML 最终都必须经过同一安全 validation，任何 UI 都没有绕过权限。

---

## 11. Resource Limits

AI/Scenario 很容易生成“10 万设备 + 50 个重容器”的不可运行环境。

Compiler Preview 必须估算：

- node/edge count；
- source count；
- container count；
- ports；
- projected disk；
- memory/cpu hint。

平台配置 local limits：

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

超过 hard limit 禁止 Start，AI/Builder 不能绕过。

---

## 12. Supply Chain

每个默认 Driver：

- 固定 image tag/version；
- 发布版尽量记录 digest；
- CI 做 dependency/license/image scan；
- 不使用来源不明、长期不维护的 Docker Hub image；
- Python/npm lockfile 必须提交；
- Driver backend version/license/source/architecture 进入 registry/manifest/documentation。

不要在 Scenario 里使用 `latest` 作为可复现运行条件。

---

## 13. InfraSourceLab 项目许可证

本仓库已经选择 **Apache License 2.0**，根目录 `LICENSE` 为项目许可证。

对 InfraSourceLab 自有源码的贡献、分发与衍生使用按 Apache-2.0 执行。

第三方工具/容器**不因为被 ISL 编排就自动变成 Apache-2.0**。每个第三方项目继续遵循它自己的许可证、商标和再分发条件。

---

## 14. 第三方许可证策略

第三方集成分三类：

### A. Library / copied code

最严格。必须确认许可证兼容并保留 attribution/NOTICE；不要复制仅仅因为 GitHub 上能看到的源码。

### B. External process / container

ISL 通过 CLI/API/网络调用，不把对方源码合入本项目。仍记录：

- project；
- version；
- license；
- source URL；
- image source/license；
- redistribution 条件。

### C. User-provided external system/image

例如厂商 NOS、商业 LocalStack image。ISL 只提供 integration 配置，不分发其内容。

---

## 15. 当前主要候选许可证分类

> 这里只作为架构选型记录；正式 Driver 引入时必须重新读取目标版本 LICENSE。

### 宽松许可、优先

- govmomi/vcsim — Apache-2.0；
- Microcks — Apache-2.0；
- Hoverfly — Apache-2.0；
- Prism — Apache-2.0；
- Moto — Apache-2.0；
- Mockoon — MIT；
- FakeNOS — MIT；
- DMTF Redfish Interface Emulator — BSD-3-Clause；
- snmpsim — BSD 系许可（目标版本核对）；
- Toxiproxy — MIT（目标版本核对）。

### 需要特别审查/只做外部集成

- GPL/AGPL 项目；
- BSL/商业 dual-license；
- vendor images；
- 商业 SaaS sandbox；
- license/发行模式发生变化的项目。

---

## 16. LocalStack 特殊说明

截至当前设计基线，LocalStack 的发行/授权模型不适合成为本项目无条件默认 AWS 依赖。

设计结论：

- 默认 AWS emulator = Moto；
- LocalStack = optional external Driver；
- 用户自己提供 token/许可；
- ISL 不宣称 LocalStack 是无条件免费开源默认组件。

正式集成前重新核对当时版本、许可与产品条款。

---

## 17. Vendor 模型 / MIB / YANG / Images

Simulator 开源不代表所有数据模型都可再分发。

### MIB

标准 MIB 与厂商 MIB 许可不同。只提交明确允许分发的内容；厂商文件由用户提供。

### YANG

标准 IETF/OpenConfig 等也按实际许可保留声明；厂商 YANG 不默认复制。

### NOS Images

containerlab/vrnetlab 是工具，不代表 Cisco/Juniper/Arista 等 image 可公开分发。

ISL repo 只存模板/说明，不存受限镜像。

---

## 18. Logging / Redaction

所有平台日志：

- 不记录 plaintext password/token；
- HTTP Authorization/Cookie/X-API-Key redaction；
- source endpoint 可记录 host/port，但 credential 分开；
- AI request 不完整 dump；
- attachment body 不 log；
- capture raw path 不暴露给普通 UI；
- Agent Docker env 错误只返回 allowlisted diagnostics；
- Verification finding 的 expected/actual 有大小上限。

---

## 19. Cleanup 安全

Agent cleanup 只能删除：

```text
io.infrasourcelab.managed=true
AND
io.infrasourcelab.run=<target>
```

的资源。

禁止：

```text
docker system prune
```

作为产品 cleanup 实现。

用户机器上可能同时运行 DLR、数据库和其他项目，ISL 不得误删。

---

## 20. 安全 Gate

进入每个开发 Wave Review 时至少检查：

1. 是否新引入 Docker/host 权限？
2. 是否允许 arbitrary input 变 executable input？
3. 是否有新的 secret surface？
4. 是否有 raw capture/attachment？
5. 是否 bind `0.0.0.0`？
6. 是否新增第三方 image/library？
7. license/NOTICE 是否已记录？
8. cleanup 是否可能越界？
9. AI 是否获得新的写/执行能力？
10. 失败路径是否泄露 sensitive values？
11. import/capture 是否引入 traversal/SSRF 风险？
12. Browser/DevTools evidence 是否可能包含真实 secret？

任何一项发生变化，都不能只按普通 CRUD Review。