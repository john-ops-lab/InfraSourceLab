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

但即使是可信开发环境，Lab Agent 触碰 Docker Engine 后权限依然很高，因此安全边界必须从 M0 建立。

---

## 2. Docker 权限边界

### 禁止 Control 直接拥有 Docker socket

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

Driver 代码内声明允许的 image repository/tag/digest。用户 Scenario 不可直接提供任意 image 名称。

后期 External/Custom Driver 能力如要开放，必须单独权限 Gate。

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

---

## 4. Network 默认安全

默认：

- Control/Web 按本地部署配置暴露；
- source containers 在 per-run internal bridge；
- 需要宿主机测试时只 bind `127.0.0.1`；
- 不默认 bind `0.0.0.0`；
- source 自动生成测试 credentials；
- 不使用生产 password/token。

如果用户显式选择 LAN exposure，UI 要显示明显提示。

---

## 5. Outbound Network

部分 Driver 理论上可意外访问真实云/生产 API。

优先措施：

- Moto 等 emulator 使用测试 credential；
- 自动生成 endpoint override；
- integration test 断言 endpoint 指向 Lab；
- Scenario 不允许 arbitrary URL 被 AI 隐式添加；
- 后期 Agent 支持 egress policy 时可默认隔离。

特别是 cloud SDK 测试，必须防止“mock 配错后真的调用 AWS/Azure/GCP”。

---

## 6. Credentials

Lab credential 与外部 credential 分开：

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

- 不写 scenario.yaml；
- secret store/env/config reference；
- UI 不回显真值；
- logs redaction；
- AI context 不包含真值。

可以借鉴 DLR Credential 的安全边界，但 M0 不必把 DLR 整套账号/secret subsystem复制过来。

---

## 7. Capture / Replay 是高风险输入

HAR、Postman、HTTP capture、snmpwalk、CLI session、Redfish mockup 都可能包含：

- tokens；
- cookies；
- Basic/Bearer auth；
- hostname/IP；
- serial/MAC；
- customer/business data；
- private URLs；
- usernames。

### Raw Capture Policy

建议目录：

```text
var/captures/raw/       # gitignored
var/captures/sanitized/ # 可选择导出
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

没有经过 sanitize 的 raw capture 不应自动加入 Git。

---

## 8. AI 输入安全

AI Scenario Assistant 默认只获得：

- 当前 scenario working copy；
- 用户文字；
- 用户显式加入的 context；
- server-sanitized attachment；
- Scenario schema；
- Driver capability summary；
- bounded diagnostics/report summary。

默认不获得：

- Docker socket/details；
- host filesystem；
- secrets；
- raw capture；
- arbitrary environment variables；
- hidden reasoning。

### Prompt Injection

导入的 OpenAPI/HAR/log/text 都属于不可信数据。

服务端应把 attachment 标记为 data/context，而不是系统指令；工具权限不因 attachment 内容扩大。

即使 LLM 被注入，也只能返回 Scenario Candidate，不能直接执行 Agent command，因此 Human-in-the-loop 是主要安全边界之一。

---

## 9. Scenario 执行安全

v1alpha1 禁止：

- arbitrary shell；
- arbitrary Python/JS；
- arbitrary Jinja expression execution；
- arbitrary Docker image；
- arbitrary host mount；
- arbitrary privileged flag；
- arbitrary host networking。

Projection expression 只实现 allowlisted pure transforms，或后期采用 sandboxed CEL/JQ 子集。

---

## 10. Resource Limits

AI/Scenario 很容易生成“10 万设备 + 50 个重容器”的不可运行环境。

Compiler Preview 必须估算：

- node/edge count；
- source count；
- container count；
- ports；
- projected disk；
- memory hint。

平台设置有 local limits：

```text
max_containers_per_run
max_truth_nodes
max_truth_edges
max_artifact_bytes
max_concurrent_runs
max_published_ports
```

超过 hard limit 禁止 Start，AI 不能绕过。

---

# 11. Supply Chain

每个默认 Driver：

- 固定 image tag；
- 发布版尽量记录 digest；
- Dependabot/Renovate 可后期启用；
- CI 做 dependency/license scan；
- 不使用来源不明、长期不维护的 Docker Hub image；
- 核心 Python/npm lockfile 必须提交。

不要在 Scenario 里使用 `latest` 作为可复现运行条件。

---

# 12. 第三方许可证策略

ISL 自己尚未选择 LICENSE。首个公开可发布版本前建议仓库所有者在 **Apache-2.0 / MIT** 中明确选择。

第三方集成分三类：

### A. Library / copied code

最严格。必须确认许可证兼容并保留 attribution/NOTICE。

### B. External process / container

ISL 通过 CLI/API/网络调用，不把对方源码合入本项目。仍要记录：

- project；
- version；
- license；
- source URL；
- image license；
- redistribution 条件。

### C. User-provided external system/image

例如厂商 NOS、LocalStack 商业 image。ISL 只提供 integration 配置，不分发其内容。

---

## 13. 当前主要候选许可证分类

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
- snmpsim — BSD 系许可（集成时核对目标版本）；
- Toxiproxy — MIT（集成时核对目标版本）。

### 需要特别审查/只做外部集成

- GPL/AGPL 项目；
- BSL/商业 dual-license；
- vendor images；
- 商业 SaaS sandbox；
- license 在 2026 年发生变化的项目。

---

## 14. LocalStack 特殊说明

截至 2026-08：

- 原 Community GitHub repo 已在 2026-03-23 archived；
- 新统一 image 要求 LocalStack account/auth token；
- Hobby 是 non-commercial；
- 商业使用有相应计划。

所以设计结论：

- 默认 AWS emulator = Moto；
- LocalStack = optional external Driver；
- 用户自己提供 token/许可；
- ISL 不宣称 LocalStack 是无条件免费开源默认组件。

---

## 15. Vendor 模型/MIB/YANG/Images

不要因为 simulator 本身开源，就默认所有数据模型都可再分发。

### MIB

标准 MIB 与厂商 MIB 许可不同。项目只提交明确允许分发的内容；厂商文件由用户提供。

### YANG

同理。标准 IETF/OpenConfig 等也要按实际许可保留声明；厂商 YANG 不默认复制。

### NOS Images

containerlab/vrnetlab 只是工具，不代表 Cisco/Juniper/Arista 等 image 可以公开分发。

ISL repo 只存模板/说明，不存用户受限镜像。

---

# 16. Logging / Redaction

所有平台日志：

- 不记录 plaintext password/token；
- HTTP Authorization/Cookie/X-API-Key redaction；
- source endpoint 可以记录 host/port，但 credential 分开；
- AI request 不完整 dump；
- attachment body 不 log；
- capture raw path 不暴露给普通 UI；
- Agent Docker env 在错误中只返回 allowlisted diagnostics。

---

## 17. Cleanup 安全

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

## 18. 安全 Gate

进入每个开发 Wave Review 时检查：

- 是否新引入 Docker/host 权限？
- 是否允许 arbitrary input 变 executable input？
- 是否有新的 secret surface？
- 是否有 raw capture/attachment？
- 是否 bind 0.0.0.0？
- 是否新增第三方 image？
- license 是否已记录？
- cleanup 是否可能越界？
- AI 是否获得新的写/执行能力？
- 失败路径是否会泄露 sensitive values？

这十项任何一项变化，都不能只按普通 CRUD Review。
