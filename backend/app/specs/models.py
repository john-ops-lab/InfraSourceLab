"""GenerationSpec 的 Pydantic 模型与语义校验。

校验职责：
- 内置类型与数量上限；
- 关系端点类型存在且数量大于零；
- strategy/coverage 固定枚举；
- 相同规范化 RelationSpec 重复直接拒绝；
- 不可能的关系（同类型且只有 1 个 CI）明确拒绝。
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from ..limits import (
    MAX_CI_TYPE_ENTRIES,
    MAX_COUNT_PER_TYPE,
    MAX_DESCRIPTION_LENGTH,
    MAX_NAME_LENGTH,
    MAX_OVERRIDE_PREFIX_LENGTH,
    MAX_QUALITY_ENTRIES,
    MAX_QUALITY_FIELD_LENGTH,
    MAX_RELATION_ENTRIES,
    MAX_TOTAL_CI,
)

# 内置 CI 类型
BUILTIN_CI_TYPES = [
    "data_center",
    "rack",
    "physical_server",
    "virtual_machine",
    "network_device",
    "ip_address",
    "application",
    "database",
    "middleware",
    "kubernetes_cluster",
    "kubernetes_node",
    "kubernetes_workload",
]

# 内置默认关系类型（种子清单的权威定义在 specs/relation_types.py；
# 运行时关系类型存数据库可在设置页维护，此清单仅作校验回退与测试默认值）
BUILTIN_RELATION_TYPES = [
    "contained_in",
    "mounted_in",
    "runs_on",
    "hosted_on",
    "deployed_on",
    "belongs_to",
    "depends_on",
    "uses",
    "has_ip",
    "connected_to",
    "owned_by",
    "manages",
    "provides",
    "consumes",
    "backup_of",
]

RelationStrategy = Literal["balanced", "random_seeded"]
RelationCoverage = Literal["from", "to"]

# 四种确定性数据质量缺陷（Issue #2）：不建通用规则引擎
DefectKind = Literal["missing_field", "case_drift", "duplicate_record", "wrong_value"]


class SpecValidationError(Exception):
    """规格校验失败，携带可读的中文诊断列表。"""

    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


class CITypeSpec(BaseModel):
    type: str
    count: int = Field(ge=0, le=MAX_COUNT_PER_TYPE)
    overrides: dict[str, str] = Field(default_factory=dict)

    @field_validator("type")
    @classmethod
    def _known_type(cls, value: str) -> str:
        if value not in BUILTIN_CI_TYPES:
            raise ValueError(f"未知 CI 类型：{value}")
        return value

    @field_validator("overrides")
    @classmethod
    def _known_overrides(cls, value: dict[str, str]) -> dict[str, str]:
        for key, val in value.items():
            if key != "name_prefix":
                raise ValueError(f"不支持的覆盖参数：{key}")
            if not isinstance(val, str) or len(val) > MAX_OVERRIDE_PREFIX_LENGTH:
                raise ValueError("name_prefix 必须是较短的字符串")
        return value


class RelationSpec(BaseModel):
    type: str
    from_type: str
    to_type: str
    strategy: RelationStrategy
    coverage: RelationCoverage

    @field_validator("type")
    @classmethod
    def _type_format(cls, value: str) -> str:
        # 关系类型可在设置页自定义：这里只做格式约束，
        # 是否存在于注册表由 parse_and_validate 结合数据库清单校验
        if not value or len(value) > 40 or not value.replace("_", "").isalnum() or value != value.lower():
            raise ValueError(f"关系类型格式非法（应为小写字母数字下划线）：{value}")
        return value


class QualityDefectSpec(BaseModel):
    """一条确定性缺陷规则：目标类型 + 可选字段 + 比例或数量二选一。"""

    kind: DefectKind
    ci_type: str
    field: str | None = Field(default=None, max_length=MAX_QUALITY_FIELD_LENGTH)
    ratio: float | None = Field(default=None, gt=0, le=1)
    count: int | None = Field(default=None, ge=1, le=MAX_COUNT_PER_TYPE)

    @model_validator(mode="after")
    def _exactly_one_amount(self) -> "QualityDefectSpec":
        if (self.ratio is None) == (self.count is None):
            raise ValueError("缺陷规则必须在 ratio（0~1）与 count（正整数）中二选一")
        return self


class GenerationSpec(BaseModel):
    name: str = Field(min_length=1, max_length=MAX_NAME_LENGTH)
    description: str = Field(default="", max_length=MAX_DESCRIPTION_LENGTH)
    seed: int = Field(ge=0, le=2**31 - 1)
    ci_types: list[CITypeSpec] = Field(min_length=1, max_length=MAX_CI_TYPE_ENTRIES)
    relations: list[RelationSpec] = Field(default_factory=list, max_length=MAX_RELATION_ENTRIES)
    quality_defects: list[QualityDefectSpec] = Field(
        default_factory=list, max_length=MAX_QUALITY_ENTRIES
    )
    metadata: dict[str, str] = Field(default_factory=dict, max_length=8)

    @model_validator(mode="after")
    def _semantic_checks(self) -> "GenerationSpec":
        errors: list[str] = []

        counts: dict[str, int] = {}
        for entry in self.ci_types:
            if entry.type in counts:
                errors.append(f"CI 类型重复：{entry.type}")
            counts[entry.type] = entry.count

        total = sum(counts.values())
        if total == 0:
            errors.append("至少需要一个数量大于 0 的 CI 类型")
        if total > MAX_TOTAL_CI:
            errors.append(f"CI 总量 {total} 超过上限 {MAX_TOTAL_CI}")

        for rel in self.relations:
            label = f"{rel.type}：{rel.from_type} → {rel.to_type}"
            if rel.from_type not in counts:
                errors.append(f"关系起点类型不存在：{label}")
                continue
            if rel.to_type not in counts:
                errors.append(f"关系终点类型不存在：{label}")
                continue
            if counts[rel.from_type] == 0 or counts[rel.to_type] == 0:
                errors.append(f"关系两侧数量必须大于 0：{label}")
            if rel.from_type == rel.to_type and counts[rel.from_type] < 2:
                errors.append(f"同类型关系至少需要 2 个 CI，否则只能产生自环：{label}")

        seen: set[tuple] = set()
        for rel in self.relations:
            key = (rel.type, rel.from_type, rel.to_type, rel.strategy, rel.coverage)
            if key in seen:
                errors.append(
                    f"重复的关系规格：{rel.type}：{rel.from_type} → {rel.to_type}"
                    f"（{rel.strategy}/{rel.coverage}）"
                )
            seen.add(key)

        seen_defects: set[tuple] = set()
        for defect in self.quality_defects:
            label = f"缺陷规则 {defect.kind}（{defect.ci_type}）"
            if defect.ci_type not in counts:
                errors.append(f"缺陷目标类型不存在：{label}")
                continue
            if counts[defect.ci_type] == 0:
                errors.append(f"缺陷目标类型数量必须大于 0：{label}")
            key = (defect.kind, defect.ci_type, defect.field)
            if key in seen_defects:
                errors.append(f"重复的缺陷规则：{label}")
            seen_defects.add(key)

        if errors:
            raise SpecValidationError(errors)
        return self


def normalize_spec(spec: GenerationSpec) -> GenerationSpec:
    """规范化规格：去除首尾空白、丢弃数量为 0 的类型，保持字段顺序稳定。"""
    kept_types = [entry for entry in spec.ci_types if entry.count > 0]
    kept_type_names = {entry.type for entry in kept_types}
    kept_relations = [
        rel
        for rel in spec.relations
        if rel.from_type in kept_type_names and rel.to_type in kept_type_names
    ]
    return GenerationSpec(
        name=spec.name.strip(),
        description=spec.description.strip(),
        seed=spec.seed,
        ci_types=kept_types,
        relations=kept_relations,
        quality_defects=[d for d in spec.quality_defects if d.ci_type in kept_type_names],
        metadata=spec.metadata,
    )


def parse_and_validate(raw: dict, allowed_relation_types: set[str] | None = None) -> GenerationSpec:
    """把外部（用户或 AI）JSON 转换为经过校验和规范化的 GenerationSpec。

    allowed_relation_types：运行时关系类型注册表（数据库）中的合法类型集合；
    缺省回退到内置清单（测试与无库场景）。
    """
    allowed = allowed_relation_types if allowed_relation_types is not None else set(BUILTIN_RELATION_TYPES)
    try:
        spec = GenerationSpec.model_validate(raw)
    except SpecValidationError:
        raise
    except ValueError as exc:  # Pydantic ValidationError 是 ValueError 子类
        errors: list[str] = []
        detail = getattr(exc, "errors", None)
        if callable(detail):
            for item in detail():
                location = ".".join(str(part) for part in item.get("loc", ()))
                message = item.get("msg", "字段无效")
                errors.append(f"{location}: {message}" if location else message)
        if not errors:
            errors.append(str(exc))
        raise SpecValidationError(errors) from exc
    unknown = [rel.type for rel in spec.relations if rel.type not in allowed]
    if unknown:
        raise SpecValidationError(
            [f"未知关系类型：{value}（可在设置页的关系管理中添加）" for value in unknown]
        )
    return normalize_spec(spec)
