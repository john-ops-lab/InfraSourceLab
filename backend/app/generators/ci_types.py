"""各内置 CI 类型的字段生成器。

每个生成器只负责：
- 该类型的记录字段（真实感来自受 seed 控制的伪随机数和 Faker）；
- 不决定 ID（由生成引擎统一分配）；
- 不读写数据库。
"""

import random
import uuid
from dataclasses import dataclass, field
from typing import TypeVar

from faker import Faker

SERVER_CATALOG = [
    ("Dell", "PowerEdge R750"),
    ("HPE", "ProLiant DL380 Gen11"),
    ("Lenovo", "ThinkSystem SR650 V3"),
    ("Inspur", "NF5280M6"),
    ("Huawei", "FusionServer Pro 2288H V6"),
    ("Supermicro", "SuperServer SYS-620U-TNR"),
]
NETWORK_CATALOG = [
    ("Cisco", "Catalyst 9300", "access-switch", "IOS XE 17.12.4"),
    ("Huawei", "CloudEngine CE6860", "access-switch", "VRP V200R023C00"),
    ("Arista", "7280R3", "core-switch", "EOS 4.32.1F"),
    ("Juniper", "QFX5120", "core-switch", "Junos 23.4R2"),
    ("H3C", "S6850", "access-switch", "Comware 7.1"),
    ("Cisco", "ISR 4451", "router", "IOS XE 17.12.4"),
    ("Fortinet", "FortiGate 200F", "firewall", "FortiOS 7.4.5"),
    ("F5", "BIG-IP i5800", "load-balancer", "BIG-IP 17.1.1"),
]
OS_CATALOG = [
    ("Ubuntu 22.04 LTS", "22.04"),
    ("Rocky Linux 9.4", "9.4"),
    ("Debian 12", "12"),
    ("Windows Server 2022", "2022"),
    ("CentOS Stream 9", "9"),
]
DATABASE_CATALOG = [
    ("PostgreSQL", ("14.12", "15.7", "16.3"), 5432),
    ("MySQL", ("8.0.37", "8.4.0"), 3306),
    ("Oracle", ("19c", "21c"), 1521),
    ("SQLServer", ("2019", "2022"), 1433),
    ("MongoDB", ("6.0.15", "7.0.11"), 27017),
]
MIDDLEWARE_CATALOG = [
    ("Nginx", ("1.24.0", "1.26.1"), 80),
    ("Kafka", ("3.6.2", "3.7.0"), 9092),
    ("RabbitMQ", ("3.12.14", "3.13.3"), 5672),
    ("Tomcat", ("9.0.89", "10.1.24"), 8080),
    ("Elasticsearch", ("8.13.4", "8.14.1"), 9200),
    ("ZooKeeper", ("3.8.4", "3.9.2"), 2181),
]
DATA_CENTER_CATALOG = [
    ("北京亦庄数据中心", "中国"),
    ("上海临港数据中心", "中国"),
    ("深圳光明数据中心", "中国"),
    ("Singapore Central Data Center", "Singapore"),
    ("Frankfurt West Data Center", "Germany"),
]
ENVIRONMENTS = ["production", "staging", "development", "test"]
STATUSES = ["active", "active", "active", "maintenance", "inactive"]
CRITICALITIES = ["high", "medium", "low"]
APP_WORDS = [
    "order", "payment", "user", "inventory", "billing", "search", "report",
    "gateway", "message", "auth", "catalog", "logistics", "risk", "notify",
]
WORKLOAD_KINDS = ["Deployment", "StatefulSet", "DaemonSet"]
NAMESPACES = ["default", "prod", "staging", "monitoring"]
K8S_VERSIONS = ["1.28.9", "1.29.6", "1.30.3"]

_UUID_NAMESPACE = uuid.NAMESPACE_DNS

ENV_SHORT = {"production": "prod", "staging": "stg", "development": "dev", "test": "test"}
T = TypeVar("T")


@dataclass
class GeneratorContext:
    """单个类型生成期间的确定性上下文。"""

    seed: int
    ci_type: str
    rng: random.Random = field(init=False)
    fake: Faker = field(init=False)
    ip_cursor: int  # 全局 IP 顺序分配器，保证唯一且可重复

    def __post_init__(self) -> None:
        self.rng = random.Random(f"{self.seed}:ci:{self.ci_type}")
        self.fake = Faker()
        self.fake.seed_instance(f"{self.seed}:faker:{self.ci_type}")

    def next_ip(self) -> str:
        self.ip_cursor += 1
        value = self.ip_cursor
        return f"10.{(value >> 16) & 255}.{(value >> 8) & 255}.{value & 255}"

    def pick(self, values: list[T] | tuple[T, ...]) -> T:
        return self.rng.choice(values)

    def deterministic_uuid(self, ci_id: str) -> str:
        return str(uuid.uuid5(_UUID_NAMESPACE, f"isl:{self.seed}:{ci_id}"))

    def hostname(self, ci_id: str, kind: str, environment: str) -> str:
        env = ENV_SHORT[environment]
        return f"{env}-{kind}-{ci_id.split('-', 1)[-1]}.example.internal"


def _environment(ctx: GeneratorContext) -> str:
    return ctx.pick(ENVIRONMENTS)


def _status(ctx: GeneratorContext) -> str:
    return ctx.pick(STATUSES)


def generate_data_center(ctx: GeneratorContext, ci_id: str) -> dict:
    location, country = ctx.pick(DATA_CENTER_CATALOG)
    return {
        "location": location,
        "country": country,
        "status": _status(ctx),
        "environment": _environment(ctx),
        "owner": ctx.fake.name(),
    }


def generate_rack(ctx: GeneratorContext, ci_id: str) -> dict:
    return {
        "u_height": ctx.rng.choice([42, 45, 47]),
        "status": _status(ctx),
        "environment": _environment(ctx),
    }


def generate_physical_server(ctx: GeneratorContext, ci_id: str) -> dict:
    environment = _environment(ctx)
    hostname = ctx.hostname(ci_id, "srv", environment)
    vendor, model = ctx.pick(SERVER_CATALOG)
    os_name, os_version = ctx.pick(OS_CATALOG)
    return {
        "hostname": hostname,
        "serial_number": f"SN{ctx.seed % 1000:03d}{ci_id.split('-', 1)[-1]}{ctx.rng.randrange(100, 999)}",
        "vendor": vendor,
        "model": model,
        "cpu_cores": ctx.rng.choice([16, 32, 48, 64, 96, 128]),
        "memory_gib": ctx.rng.choice([64, 128, 256, 512, 1024]),
        "management_ip": ctx.next_ip(),
        "os_name": os_name,
        "os_version": os_version,
        "status": _status(ctx),
        "environment": environment,
    }


def generate_virtual_machine(ctx: GeneratorContext, ci_id: str) -> dict:
    environment = _environment(ctx)
    hostname = ctx.hostname(ci_id, "vm", environment)
    return {
        "hostname": hostname,
        "uuid": ctx.deterministic_uuid(ci_id),
        "cpu_cores": ctx.rng.choice([2, 4, 8, 16, 32]),
        "memory_gib": ctx.rng.choice([4, 8, 16, 32, 64]),
        "ip_address": ctx.next_ip(),
        "power_state": ctx.rng.choice(["poweredOn", "poweredOn", "poweredOn", "poweredOff"]),
        "os_name": ctx.pick(OS_CATALOG)[0],
        "status": _status(ctx),
        "environment": environment,
    }


def generate_network_device(ctx: GeneratorContext, ci_id: str) -> dict:
    environment = _environment(ctx)
    hostname = ctx.hostname(ci_id, "net", environment)
    vendor, model, device_role, software_version = ctx.pick(NETWORK_CATALOG)
    return {
        "hostname": hostname,
        "serial_number": f"ND{ctx.seed % 1000:03d}{ci_id.split('-', 1)[-1]}{ctx.rng.randrange(100, 999)}",
        "vendor": vendor,
        "model": model,
        "device_role": device_role,
        "management_ip": ctx.next_ip(),
        "software_version": software_version,
        "status": _status(ctx),
        "environment": environment,
    }


def generate_ip_address(ctx: GeneratorContext, ci_id: str) -> dict:
    return {
        "address": ctx.next_ip(),
        "prefix_length": ctx.rng.choice([24, 24, 26, 28]),
        "status": ctx.rng.choice(["assigned", "reserved", "free"]),
        "environment": _environment(ctx),
    }


def generate_application(ctx: GeneratorContext, ci_id: str) -> dict:
    index = ci_id.split("-", 1)[-1]
    word = ctx.pick(APP_WORDS)
    return {
        "code": f"APP{index}",
        "name": f"{word}-service",
        "owner": ctx.fake.name(),
        "environment": _environment(ctx),
        "criticality": ctx.pick(CRITICALITIES),
        "lifecycle_status": ctx.rng.choice(["production", "production", "development", "retired"]),
    }


def generate_database(ctx: GeneratorContext, ci_id: str) -> dict:
    environment = _environment(ctx)
    engine, versions, port = ctx.pick(DATABASE_CATALOG)
    return {
        "engine": engine,
        "version": ctx.pick(versions),
        "host": ctx.hostname(ci_id, "db", environment),
        "port": port,
        "environment": environment,
        "status": _status(ctx),
    }


def generate_middleware(ctx: GeneratorContext, ci_id: str) -> dict:
    environment = _environment(ctx)
    middleware_type, versions, port = ctx.pick(MIDDLEWARE_CATALOG)
    return {
        "type": middleware_type,
        "version": ctx.pick(versions),
        "host": ctx.hostname(ci_id, "mw", environment),
        "port": port,
        "environment": environment,
        "status": _status(ctx),
    }


def generate_kubernetes_cluster(ctx: GeneratorContext, ci_id: str) -> dict:
    return {
        "version": ctx.pick(K8S_VERSIONS),
        "environment": _environment(ctx),
        "status": _status(ctx),
        "cni": ctx.rng.choice(["calico", "cilium", "flannel"]),
    }


def generate_kubernetes_node(ctx: GeneratorContext, ci_id: str) -> dict:
    return {
        "role": ctx.rng.choice(["control-plane", "worker", "worker", "worker"]),
        "version": ctx.pick(K8S_VERSIONS),
        "status": ctx.rng.choice(["Ready", "Ready", "Ready", "NotReady"]),
    }


def generate_kubernetes_workload(ctx: GeneratorContext, ci_id: str) -> dict:
    index = ci_id.split("-", 1)[-1]
    word = ctx.pick(APP_WORDS)
    name = f"{word}-{index}"
    return {
        "kind": ctx.pick(WORKLOAD_KINDS),
        "namespace": ctx.pick(NAMESPACES),
        "replicas": ctx.rng.randrange(1, 6),
        "image": f"registry.example.local/{word}:{ctx.rng.randrange(1, 4)}.{ctx.rng.randrange(0, 20)}.{ctx.rng.randrange(0, 20)}",
        "status": _status(ctx),
    }


# 简单注册表：类型 → 字段生成函数
GENERATORS = {
    "data_center": generate_data_center,
    "rack": generate_rack,
    "physical_server": generate_physical_server,
    "virtual_machine": generate_virtual_machine,
    "network_device": generate_network_device,
    "ip_address": generate_ip_address,
    "application": generate_application,
    "database": generate_database,
    "middleware": generate_middleware,
    "kubernetes_cluster": generate_kubernetes_cluster,
    "kubernetes_node": generate_kubernetes_node,
    "kubernetes_workload": generate_kubernetes_workload,
}
