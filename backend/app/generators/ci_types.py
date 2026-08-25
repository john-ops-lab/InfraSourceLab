"""各内置 CI 类型的字段生成器。

每个生成器只负责：
- 该类型的记录字段（真实感来自受 seed 控制的伪随机数和 Faker）；
- 不决定 ID（由生成引擎统一分配）；
- 不读写数据库。
"""

import random
import uuid
from dataclasses import dataclass, field

from faker import Faker

VENDORS = ["Dell", "HPE", "Lenovo", "Inspur", "Huawei", "Supermicro"]
SERVER_MODELS = ["PowerEdge R750", "ProLiant DL380", "ThinkSystem SR650", "NF5280M6", "2288H V6"]
NETWORK_VENDORS = ["Cisco", "Huawei", "Arista", "Juniper", "H3C"]
NETWORK_MODELS = ["Catalyst 9300", "CE6860", "7280R3", "QFX5120", "S6850"]
DEVICE_ROLES = ["core-switch", "access-switch", "router", "firewall", "load-balancer"]
OS_NAMES = ["Ubuntu 22.04 LTS", "Rocky Linux 9.4", "Debian 12", "Windows Server 2022", "CentOS Stream 9"]
DB_ENGINES = ["PostgreSQL", "MySQL", "Oracle", "SQLServer", "MongoDB"]
MIDDLEWARE_TYPES = ["Nginx", "Kafka", "RabbitMQ", "Tomcat", "Elasticsearch", "ZooKeeper"]
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

    def pick(self, values: list) -> str:
        return self.rng.choice(values)

    def deterministic_uuid(self, ci_id: str) -> str:
        return str(uuid.uuid5(_UUID_NAMESPACE, f"isl:{self.seed}:{ci_id}"))

    def hostname(self, ci_id: str, kind: str) -> str:
        env = ENV_SHORT[self.pick(ENVIRONMENTS)]
        return f"{env}-{kind}-{ci_id.split('-', 1)[-1]}.example.internal"


def _environment(ctx: GeneratorContext) -> str:
    return ctx.pick(ENVIRONMENTS)


def _status(ctx: GeneratorContext) -> str:
    return ctx.pick(STATUSES)


def generate_data_center(ctx: GeneratorContext, ci_id: str) -> dict:
    return {
        "location": f"{ctx.fake.city()} 数据中心",
        "country": ctx.fake.country(),
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
    hostname = ctx.hostname(ci_id, "srv")
    return {
        "hostname": hostname,
        "serial_number": f"SN{ctx.seed % 1000:03d}{ci_id.split('-', 1)[-1]}{ctx.rng.randrange(100, 999)}",
        "vendor": ctx.pick(VENDORS),
        "model": ctx.pick(SERVER_MODELS),
        "cpu_cores": ctx.rng.choice([16, 32, 48, 64, 96, 128]),
        "memory_gib": ctx.rng.choice([64, 128, 256, 512, 1024]),
        "management_ip": ctx.next_ip(),
        "os_name": ctx.pick(OS_NAMES),
        "os_version": f"{ctx.rng.randrange(1, 9)}.{ctx.rng.randrange(0, 9)}",
        "status": _status(ctx),
        "environment": _environment(ctx),
    }


def generate_virtual_machine(ctx: GeneratorContext, ci_id: str) -> dict:
    hostname = ctx.hostname(ci_id, "vm")
    return {
        "hostname": hostname,
        "uuid": ctx.deterministic_uuid(ci_id),
        "cpu_cores": ctx.rng.choice([2, 4, 8, 16, 32]),
        "memory_gib": ctx.rng.choice([4, 8, 16, 32, 64]),
        "ip_address": ctx.next_ip(),
        "power_state": ctx.rng.choice(["poweredOn", "poweredOn", "poweredOn", "poweredOff"]),
        "os_name": ctx.pick(OS_NAMES),
        "status": _status(ctx),
        "environment": _environment(ctx),
    }


def generate_network_device(ctx: GeneratorContext, ci_id: str) -> dict:
    hostname = ctx.hostname(ci_id, "net")
    return {
        "hostname": hostname,
        "serial_number": f"ND{ctx.seed % 1000:03d}{ci_id.split('-', 1)[-1]}{ctx.rng.randrange(100, 999)}",
        "vendor": ctx.pick(NETWORK_VENDORS),
        "model": ctx.pick(NETWORK_MODELS),
        "device_role": ctx.pick(DEVICE_ROLES),
        "management_ip": ctx.next_ip(),
        "software_version": f"V{ctx.rng.randrange(5, 12)}.{ctx.rng.randrange(0, 9)}.{ctx.rng.randrange(0, 9)}",
        "status": _status(ctx),
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
    return {
        "engine": ctx.pick(DB_ENGINES),
        "version": f"{ctx.rng.randrange(5, 17)}.{ctx.rng.randrange(0, 9)}",
        "host": ctx.hostname(ci_id, "db"),
        "port": ctx.rng.randrange(1024, 65000),
        "environment": _environment(ctx),
        "status": _status(ctx),
    }


def generate_middleware(ctx: GeneratorContext, ci_id: str) -> dict:
    return {
        "type": ctx.pick(MIDDLEWARE_TYPES),
        "version": f"{ctx.rng.randrange(1, 10)}.{ctx.rng.randrange(0, 20)}.{ctx.rng.randrange(0, 20)}",
        "host": ctx.hostname(ci_id, "mw"),
        "port": ctx.rng.randrange(1024, 65000),
        "environment": _environment(ctx),
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
