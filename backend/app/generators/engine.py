"""生成引擎：规格 → CI 记录 + 关系 + warnings。

确定性约定：相同规范化规格、seed 和生成器版本产生相同
ID、字段值、关系和排序。不调用外部服务，不使用图数据库。
"""

from dataclasses import dataclass, field

from ..specs.ci_fields import MIN_DEFAULT_ATTRIBUTES
from ..specs.models import GenerationSpec
from .ci_types import GENERATORS, GeneratorContext
from .relations import generate_relations

GENERATOR_VERSION = "1.3.0"

# 稳定 ID 前缀
ID_PREFIXES = {
    "data_center": "dc",
    "rack": "rack",
    "physical_server": "server",
    "virtual_machine": "vm",
    "network_device": "net",
    "ip_address": "ip",
    "application": "app",
    "database": "db",
    "middleware": "mw",
    "kubernetes_cluster": "k8s-cluster",
    "kubernetes_node": "k8s-node",
    "kubernetes_workload": "k8s-wl",
}

# search_text 白名单字段（来自 attributes，另含顶层 ci_id 和 name）
SEARCH_FIELDS = ["hostname", "ip_address", "address", "management_ip", "serial_number", "code"]


@dataclass
class GeneratedCI:
    id: str
    type: str
    name: str
    attributes: dict = field(default_factory=dict)
    tags: dict = field(default_factory=dict)
    search_text: str = ""


@dataclass
class GenerationResult:
    cis: list[GeneratedCI]
    relations: list
    warnings: list[str]
    quality_report: list[dict]
    generator_version: str = GENERATOR_VERSION


def build_ci_id(ci_type: str, index: int, count: int) -> str:
    width = max(4, len(str(count)))
    return f"{ID_PREFIXES[ci_type]}-{str(index).zfill(width)}"


def build_search_text(ci_id: str, name: str, attributes: dict) -> str:
    parts = [ci_id, name]
    for key in SEARCH_FIELDS:
        value = attributes.get(key)
        if value:
            parts.append(str(value))
    return " ".join(parts).lower()


def generate_dataset(spec: GenerationSpec) -> GenerationResult:
    warnings: list[str] = []
    cis: list[GeneratedCI] = []
    cis_by_type: dict[str, list[str]] = {}
    quality_report: list[dict] = []
    ip_cursor = spec.seed % 256  # IP 起点也由 seed 决定，保持确定性

    for entry in spec.ci_types:
        generator = GENERATORS[entry.type]
        ctx = GeneratorContext(seed=spec.seed, ci_type=entry.type, ip_cursor=ip_cursor)
        name_prefix = entry.overrides.get("name_prefix", "")

        type_ids: list[str] = []
        for index in range(1, entry.count + 1):
            ci_id = build_ci_id(entry.type, index, entry.count)
            attributes = generator(ctx, ci_id)
            name = attributes.pop("name", None) or ci_id
            if len(attributes) < MIN_DEFAULT_ATTRIBUTES:
                raise RuntimeError(
                    f"内置 CI 类型 {entry.type} 只生成了 {len(attributes)} 个业务属性，"
                    f"至少需要 {MIN_DEFAULT_ATTRIBUTES} 个"
                )
            if name_prefix:
                name = f"{name_prefix}-{name}"
            environment = attributes.get("environment", "")
            ci = GeneratedCI(
                id=ci_id,
                type=entry.type,
                name=name,
                attributes=attributes,
                tags={"environment": environment} if environment else {},
                search_text=build_search_text(ci_id, name, attributes),
            )
            cis.append(ci)
            type_ids.append(ci_id)
        cis_by_type[entry.type] = type_ids
        # IP 分配器跨类型延续，保证全局唯一且顺序稳定
        ip_cursor = ctx.ip_cursor

    relation_result = generate_relations(spec, cis_by_type)
    warnings.extend(relation_result.warnings)

    # 数据质量缺陷注入（Issue #2）：在关系生成后执行，重复记录不继承关系。
    # 缺陷直接改写记录本身，因此 CI 列表、API 与导出中的脏数据天然一致。
    if spec.quality_defects:
        from .quality import apply_quality_defects

        cis, defect_warnings, quality_report = apply_quality_defects(spec, cis)
        warnings.extend(defect_warnings)

    # 发布前校验：关系引用完整性
    all_ids = {ci.id for ci in cis}
    for rel in relation_result.relations:
        if rel.from_id not in all_ids or rel.to_id not in all_ids:
            raise ValueError(f"关系 {rel.id} 引用了不存在的 CI：{rel.from_id} → {rel.to_id}")

    return GenerationResult(
        cis=cis,
        relations=relation_result.relations,
        warnings=warnings,
        quality_report=quality_report,
    )
