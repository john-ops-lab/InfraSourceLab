# CMDB 数据源覆盖调研

> 调研基线：2026-08-24。
>
> **本文是历史研究材料，不是当前开发清单。** 当前项目仍处于设计阶段，Issue #1 只计划生成统一 CMDB 数据并提供认证 REST API 和文件导出。

## 1. 调研目的

未来开发 CMDB 时可能遇到很多真实数据源。调研的目的不是现在全部模拟，而是为未来的具体需求准备选型顺序：

```text
能直接启动轻量真实服务
→ 优先使用真实服务

已有成熟专用模拟器
→ 直接复用模拟器

有 OpenAPI、Schema 或明确契约
→ 使用契约 Mock

用户能短期访问真实测试环境
→ 合法采集、脱敏和回放

只有厂商真实行为才有意义
→ 使用用户提供的高保真实验环境
```

最后才考虑编写很薄的自定义模拟接口。

## 2. 计算、虚拟化与容器

| 数据源 | 未来优先路线 | 说明 |
|---|---|---|
| VMware vCenter / ESXi | govmomi `vcsim` | 成熟的 vSphere API 模拟器，优先复用 |
| Kubernetes | KWOK；需要真实控制面时再用 kind 或 k3s | 不自行实现 Kubernetes API |
| Docker Engine | 独立测试 Docker 或契约 Mock | 不直接操作开发者宿主 Docker |
| libvirt | 官方 `test:///default` | 适合虚拟化资源测试 |
| OpenStack Nova | DevStack 加 Nova FakeDriver | 完整 OpenStack 仍较重，不自行复制 API |
| Proxmox、Hyper-V、Nutanix | 契约、录制回放或用户测试环境 | 当前没有与 `vcsim` 同等成熟的通用轻量模拟器 |

## 3. 物理服务器、BMC 与存储

| 数据源 | 未来优先路线 | 说明 |
|---|---|---|
| Redfish / BMC | DMTF Redfish Interface Emulator | 优先复用官方模拟器 |
| Redfish 静态样例 | DMTF Mockup Server | 适合只读测试 |
| IPMI | OpenIPMI `ipmi_sim` | 使用前重新核对构建、架构和许可证 |
| Swordfish 存储管理 | SNIA Swordfish API Emulator | 适合存储资源测试 |
| iDRAC、iLO 等厂商私有 API | Redfish 优先，其余使用契约或回放 | 不复制厂商私有接口 |
| Ceph | 真实小型环境或经过评估的第三方 Mock | 当前没有公认的通用轻量模拟器 |

## 4. 网络设备与网络管理

| 数据源 | 未来优先路线 |
|---|---|
| SSH 命令行 | FakeNOS |
| SSH 录制回放 | scrapli-replay |
| SNMP | snmpsim |
| NETCONF / YANG | Netopeer2 + sysrepo |
| RESTCONF | Netopeer/sysrepo 生态或契约 Mock |
| gNMI | 真实网络实验环境或已有生态工具 |
| 高保真网络操作系统 | containerlab、vrnetlab 或用户镜像 |
| 网络控制器、负载均衡、防火墙 API | 契约、回放或用户测试环境 |

原则：标准协议使用成熟标准服务或模拟器，不在 InfraSourceLab 中重新实现协议栈。

## 5. DNS、DHCP 与 IPAM

### DNS

优先使用 CoreDNS 真实服务。它可以读取生成的区域文件并提供标准 DNS 查询，比编写假 DNS 协议更可靠。

### DHCP

优先评估 ISC Kea。真实 DHCP 报文测试涉及网络命名空间和权限，因此只有明确需要时才引入。

### IPAM

优先使用真实 NetBox。Infoblox 等商业产品采用契约、回放或用户测试环境，不自行实现其管理接口。

## 6. 身份与目录

| 数据源 | 未来优先路线 |
|---|---|
| LDAP | OpenLDAP 真实服务 |
| Active Directory | Samba AD DC，只有明确需要 AD 语义时使用 |
| Microsoft Graph / Entra ID | 契约、回放或开发租户 |
| FreeIPA | 真实服务，按需求启用 |

不能把 OpenLDAP 当成 Entra ID 或完整 Active Directory 的替代品。

## 7. 数据库、缓存、消息与文件

这些服务本身通常可以轻量启动，未来优先使用真实服务：

```text
PostgreSQL
MySQL / MariaDB
Redis
Apache Kafka
RabbitMQ
Eclipse Mosquitto
OpenSSH SFTP
OpenLDAP
```

Oracle、SQL Server 等根据许可证和用户环境选择开发镜像或用户提供的测试环境。

真实服务容易启动时，自行实现假协议反而会降低真实性并增加维护成本。

## 8. 云与对象存储

| 数据源 | 未来优先路线 | 边界 |
|---|---|---|
| AWS | Moto 独立服务 | 只声明 Moto 实际覆盖的 API |
| Azure Storage | Azurite | 不代表整个 Azure 控制面 |
| Google Cloud Storage | fake-gcs-server | 不代表整个 GCP |
| Azure ARM、GCP Compute 等 | 契约、回放或用户沙箱 | 不假装拥有完整云平台模拟器 |
| S3 兼容存储 | Moto 或用户提供的兼容端点 | 按具体测试需求选择 |

## 9. CMDB、DCIM、ITSM 与事实来源

| 产品或类别 | 未来优先路线 |
|---|---|
| NetBox | 启动真实 NetBox 并写入测试数据 |
| Nautobot、Ralph | 按需求启动真实服务 |
| iTop | 按许可证要求使用真实服务 |
| ServiceNow | OpenAPI、契约、回放或开发实例 |
| Jira Assets | 契约、回放或沙箱 |
| 自研资产 API | Mockoon、Prism 或 Microcks |

不应试图在 InfraSourceLab 中实现一个“假的 ServiceNow”。

## 10. 监控、日志与运维平台

CMDB 周边的数据采集或接口测试可能涉及：

```text
Prometheus
Alertmanager
Grafana
OpenSearch
Elasticsearch
Loki
Zabbix
```

能轻量启动真实服务时优先真实服务；只需要固定 API 响应时使用契约数据。

## 11. 没有成熟模拟器时的降级顺序

### 路线一：契约 Mock

适合已有 OpenAPI、Swagger 或 JSON Schema：

```text
契约
→ 生成样例和规则
→ Mockoon / Prism / Microcks
```

### 路线二：录制与回放

适合用户能短期访问真实测试环境：

```text
真实环境
→ 合法采集
→ 脱敏
→ 参数化
→ Hoverfly 或专用回放工具
```

### 路线三：真实轻量服务

适合开源产品可以快速启动：

```text
生成测试数据
→ 通过官方接口写入真实服务
→ CMDB、数据导入程序或测试脚本读取
```

### 路线四：高保真实验环境

只有必须验证产品行为时才使用：

```text
containerlab / GNS3 / 虚拟机 / 用户授权镜像
```

### 路线五：薄自定义实现

只有前四种路线都不成立，而且该来源确实阻断核心用户流程时才考虑。

## 12. 新数据源评审问题

未来任何“能不能模拟某系统”的需求，都先回答：

1. CMDB 真正需要采集哪些对象、字段和关系？
2. 需要的是固定数据、协议兼容还是完整产品行为？
3. 官方或社区是否已有模拟器、假驱动或测试模式？
4. 能否直接启动真实轻量服务？
5. 是否有标准契约？
6. 是否可以合法采集并脱敏回放？
7. 当前版本、维护状态、许可证和 ARM64 支持如何？
8. 使用什么真实客户端做端到端验证？
9. 没有它是否真的阻断当前产品目标？
10. 能否做一个独立小功能，而不是恢复平台化路线？

## 13. 对当前产品的结论

上述来源都没有迫使当前 MVP 改变方向。

Issue #1 仍只需要：

```text
自然语言或模板
→ GenerationSpec
→ CI 与关系
→ Bearer Token REST API
→ JSON / CSV
```

真实协议或服务能力必须等待 MVP 实际使用后，按一个具体问题单独评估。
