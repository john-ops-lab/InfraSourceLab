# CMDB 数据源覆盖与 Gap Map

> 调研基线：2026-08-24。本文从“未来开发 DLR/CMDB 时还会遇到什么来源”反向检查 InfraSourceLab 架构，避免只覆盖最显眼的 vCenter/K8s/SNMP/API。

## 1. 使用方式

每类来源只选择必要保真度：

```text
真实轻量服务可启动        → Real Service
已有成熟专用模拟器        → Protocol Emulator
有规范但没成熟模拟器      → Contract Mock
用户有真实 sandbox        → Sanitized Capture/Replay
必须厂商行为才有意义      → User-provided High-fidelity Lab
```

如果以后出现新工具，只需要替换/新增 Driver，不应改变 Truth Graph、Projection、Timeline、Observation、Verifier 核心。

---

## 2. 计算、虚拟化与容器

| 来源 | 推荐路线 | 状态/说明 |
|---|---|---|
| VMware vCenter/ESXi | govmomi `vcsim` | **M3 DEFAULT** |
| Kubernetes | KWOK | **M3 DEFAULT**；真实 control-plane 行为需求再选 kind/k3s |
| Docker Engine | 真实隔离 Docker daemon / contract mock | 后期；不要让测试直接操作开发者宿主 Docker |
| libvirt | 官方 `test:///default` | **M4A** |
| OpenStack Nova | DevStack + Nova fake virt driver，或 contract | 后期 optional；Nova 自身 FakeDriver 很成熟，但完整 OpenStack API 环境仍明显偏重 |
| OpenStack Neutron/Cinder | real minimal DevStack / contract | 没有发现一个轻量“全 OpenStack 模拟器”；不要自己重写 API |
| Proxmox VE | contract/capture；社区小型 stateful API sim 可参考 | 当前没发现达到 vcsim 成熟度的通用 Proxmox simulator；有项目内置小型 in-memory API simulator，但不足以成为默认依赖 |
| Hyper-V / SCVMM | contract/capture / user sandbox | 商业/Windows 环境，后期 |
| Nutanix | contract/capture / user sandbox | 后期 |

### OpenStack 特别说明

Nova 官方源码存在 `FakeDriver`，DevStack 也明确支持 `VIRT_DRIVER=fake`，可以在没有真实 hypervisor 的情况下运行较真实的 Compute API；但其他服务（尤其网络）并不因此全部变成 fake。因此未来若确实需要 OpenStack Adapter，优先做一个 optional DevStack/FakeNova Source Pack，而不是在 ISL 里复制 Nova/Neutron REST API。

---

## 3. 物理服务器、BMC 与存储硬件

| 来源 | 推荐路线 | 状态/说明 |
|---|---|---|
| Redfish/BMC | DMTF Redfish Interface Emulator | **M3 DEFAULT** |
| Redfish static mockup | DMTF Mockup Server | read-only optional |
| IPMI | OpenIPMI `ipmi_sim` | 后期 candidate；先核验当前构建/ARM64/许可证 |
| Swordfish/存储 Redfish | SNIA Swordfish API Emulator | 后期 optional；与 DMTF emulator 同体系，适合 storage inventory |
| 厂商服务器管理 API | Redfish 优先；专有部分 contract/capture | 不重写 iDRAC/iLO/IMM 私有 API |
| SAN/存储阵列专有 API | Swordfish/Redfish、contract/capture | 厂商差异大，按实际 Adapter 需求做 profile |
| Ceph management API | 真 Ceph mini lab 或特定 mock-mode API 项目 | 当前没有发现一个像 Moto/vcsim 那样公认通用的 Ceph simulator；第三方 `ceph-api` 有 mock mode，可作为未来研究候选，不应现在绑定 |

---

## 4. 网络设备与网络管理

| 来源 | 推荐路线 | 状态/说明 |
|---|---|---|
| SSH CLI | FakeNOS | **M3 DEFAULT** |
| SSH capture/replay | scrapli-replay | **M4B** |
| SNMP | snmpsim | **M3 DEFAULT** |
| NETCONF/YANG | Netopeer2 + sysrepo | **M4A** |
| RESTCONF | Netopeer/sysrepo 生态或 contract | 后期，先验证现成 server 能力 |
| gNMI | gNMI ecosystem / user lab | 后期；当前没有把它当作完整 NOS simulator |
| LLDP/CDP | FakeNOS/SNMP profile/NETCONF projection | 不需要单独协议平台 |
| 高保真 NOS | containerlab + vrnetlab/user image | optional L4 |
| GUI 网络实验室 | GNS3 | optional heavy |
| 网络控制器 API | contract/capture / user sandbox | Cisco/Aruba/Juniper 等按需求处理 |
| Load Balancer / Firewall API | contract/capture / user virtual appliance | 按实际产品需求，不泛化 |

---

## 5. DNS、DHCP、IPAM

这是 CMDB 经常漏掉但很重要的一组来源。

### DNS — CoreDNS

CoreDNS 是 CNCF Graduated、Apache-2.0 的真实 DNS server，支持 UDP/TCP、DoT/DoH/DoQ、zone file、etcd、Kubernetes 等插件。

**推荐：真实服务 Driver，而不是 fake DNS protocol。**

Truth Projection 可以生成 zone：

```text
A/AAAA
PTR
CNAME
SRV
```

Timeline 通过重写 zone/配置再 reload，DLR 用标准 DNS client 查询。

### DHCP — ISC Kea

Kea 是 ISC 维护的真实 DHCPv4/v6 server，2026 年仍有稳定/LTS 发布，同时有 JSON 配置、REST/Control Agent、lease/backend 体系。

它非常适合作为后期 **Real Service Driver**：

- subnet/pool/reservation；
- lease data；
- DHCPv4/v6；
- dynamic update；
- standard client/REST management source。

但测试真实 DHCP packet 时需要更谨慎的 network namespace/privilege，所以不进入早期默认安装。

### IPAM

优先真实 NetBox；商业 Infoblox 等使用 contract/capture/user sandbox，不自研 WAPI server。

---

## 6. 身份与目录

| 来源 | 推荐路线 | 状态/说明 |
|---|---|---|
| LDAP | OpenLDAP real service | **M4B** |
| Active Directory LDAP/Kerberos/DNS | Samba AD DC | 后期 optional L3 |
| Microsoft Graph / Entra ID | contract/capture / developer tenant | 商业云，无需假装 OpenLDAP == Entra |
| FreeIPA | real service optional | 需要 Kerberos/LDAP/host inventory 时 |

### Samba AD

Samba 可以提供真实 AD DC 行为；社区已有 Docker 化实践，但很多镜像/仓库是 GPL 且维护质量不一。因此如果加入，优先基于 Samba 官方软件构建 ISL 自己受控的测试镜像/Compose recipe，完整保留 GPL 义务，而不是随便依赖一个未知第三方 image。

第一阶段 OpenLDAP 足够验证通用 LDAP Adapter；只有 DLR/CMDB 真正需要 AD-specific schema/Kerberos/DNS 时再加 Samba AD。

---

## 7. 数据库、缓存、消息与文件

| 来源 | 推荐路线 |
|---|---|
| PostgreSQL | real service — M1 |
| MySQL/MariaDB | real service — M4B |
| Oracle | user-provided Oracle Free/container where legally appropriate; later |
| SQL Server | user-provided Developer image; later |
| Redis | real service — M4B |
| Kafka | real Apache Kafka — M4B |
| RabbitMQ | real service — M4B |
| MQTT | Eclipse Mosquitto — M4B |
| SFTP | OpenSSH — M4B |
| SMB/CIFS | Samba file server — later real service |
| NFS | real NFS server in Linux Agent — later |
| Local files | Artifact driver |
| CSV/xlsx | Artifact driver |

这里原则很简单：协议服务本身很轻时，mock 反而会降低真实性并增加维护成本。

---

## 8. 云与对象存储

| 来源 | 推荐路线 | 状态 |
|---|---|---|
| AWS | Moto standalone | **M4A DEFAULT** |
| LocalStack | user-provided optional | 2026 商业/授权变化后不做 default |
| Azure Blob/Queue/Table | Azurite | **M4A**，只声称 Storage |
| Azure ARM/VM/VNet | contract/capture / sandbox | 无“Azurite 全 Azure”这种误导 |
| GCS | fake-gcs-server | **M4A** |
| GCP Compute/Resource Manager | contract/capture / sandbox | 后期 |
| S3-compatible storage | Moto / user endpoint | 不额外绑定 MinIO |

---

## 9. CMDB / DCIM / Source of Truth / ITSM

| 产品/类别 | 推荐路线 |
|---|---|
| NetBox | 真实 NetBox + Truth seed — **M4B** |
| Nautobot | 真实服务 optional |
| Ralph | 真实服务 optional |
| iTop | 外部真实服务 optional；AGPL 许可注意 |
| ServiceNow | OpenAPI/contract/capture/developer instance |
| Jira Assets | contract/capture/sandbox |
| 商业 CMDB/ITSM | contract/capture/user sandbox |
| 自研资产 API | Mockoon/Prism/Microcks |

ISL 不应尝试“实现一个假 ServiceNow”。如果用户拥有 developer/sandbox 实例，capture+sanitize/replay 比复制几百个 REST endpoint 有价值得多。

---

## 10. 监控、日志与运维平台

这些不是传统 CMDB 主数据源，但 DLR/FDE 未来可能会接。

| 来源 | 推荐路线 |
|---|---|
| Prometheus HTTP API | 真实 Prometheus 或轻量 contract fixture |
| Alertmanager | real service / API fixture |
| Grafana API | real Grafana if needed, otherwise contract |
| OpenSearch | real container |
| Elasticsearch | user-compatible real image/license-aware |
| Loki | real service later |
| Zabbix | real app/source pack only when required |
| Nagios-like | artifact/API/real service as needed |

原则仍是：如果真实容器很容易启动，就不要自己维护一个长期偏离真实产品的 fake API。

---

## 11. Storage / Backup / Specialized Infrastructure

| 来源 | 路线 |
|---|---|
| Redfish/Swordfish storage | DMTF/SNIA emulators |
| Ceph | real mini cluster or candidate third-party mock API after evaluation |
| S3/object | Moto/Azurite/fake-gcs/user service |
| Backup products | contract/capture/sandbox |
| FC switches | SNMP/SSH/NETCONF/high-fidelity NOS |
| VMware vSAN | vcsim 能覆盖的 inventory + contract/capture for unsupported API |
| NSX | contract/capture / user sandbox |

---

## 12. 没有成熟模拟器时的标准降级路线

以后遇到 `Product X`，不要立刻创建 `ProductXFakeServer`。

### Route A — Contract

适合有 OpenAPI/Swagger/JSON schema：

```text
spec → importer → projection mapping → Mockoon/Prism/Microcks
```

### Route B — Capture/Replay

适合用户能临时访问真实 sandbox：

```text
real sandbox → capture → sanitize → parameterize → Hoverfly/scrapli replay
```

### Route C — Real Service

适合开源产品可轻量启动：

```text
truth projection → seed via supported API → actual product
```

### Route D — High Fidelity

确实必须产品行为：

```text
containerlab/GNS3/VM/user-provided licensed appliance
```

### Route E — Thin custom backend

只有 A-D 都不成立，并且该来源对核心用户足够重要时才做。

---

## 13. Gap 优先级

当前已规划的 M1–M4 已覆盖绝大多数开发价值。未来最值得补的未排期 Gap 是：

```text
DNS (CoreDNS)
DHCP (Kea)
Samba AD
Swordfish storage
IPMI
RESTCONF/gNMI
OpenStack DevStack + Nova FakeDriver
SMB/NFS
Prometheus/OpenSearch ops sources
```

它们都可以通过现有 Driver/Fidelity 架构加入，**目前没有一个 Gap 迫使 Core 改架构。** 这正是本轮调研最重要的验证结果。

---

## 14. 新来源评审模板

以后任何“能不能模拟 X？”先回答：

1. DLR/CMDB 真正要从 X 采什么对象和关系？
2. 需要 L0/L1/L2/L3/L4 哪一级保真度？
3. 官方/社区是否已有 simulator/fake/test driver？
4. 能否直接启动真实服务？
5. 是否有标准契约？
6. 是否能从用户 sandbox 合法 capture？
7. 项目/license/image/ARM64 状态？
8. Truth Projection 如何映射？
9. source-native identity 如何回映？
10. 哪些 lifecycle/fault 真能支持？
11. 使用什么真实 client 做 E2E？
12. 没有它是否真的阻断当前产品目标？

只有回答完这些，才值得建 Driver Issue。
