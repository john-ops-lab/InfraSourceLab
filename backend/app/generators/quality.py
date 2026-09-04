"""确定性数据质量缺陷注入（Issue #2）。

四种简单缺陷：缺失字段、大小写漂移、重复记录、错误值。
相同规格与 seed 产生完全相同的缺陷分布；不建通用规则引擎。
"""

import copy
import random

from ..specs.models import GenerationSpec, QualityDefectSpec
from .engine import GeneratedCI, build_search_text

DEFECT_KIND_LABELS = {
    "missing_field": "缺失字段",
    "case_drift": "大小写漂移",
    "duplicate_record": "重复记录",
    "wrong_value": "错误值",
}

# 常见字段的典型错误值；未列出的字段统一写入 INVALID-VALUE
WRONG_VALUES = {
    "ip_address": "999.999.999.999",
    "management_ip": "999.999.999.999",
    "status": "unknown",
    "environment": "unknown",
    "cpu_cores": -1,
    "memory_gib": -1,
    "port": 0,
    "prefix_length": 129,
    "replicas": -1,
}

DEFAULT_WRONG_FIELD = "status"
CASE_TRANSFORMS = ("upper", "lower", "swapcase")


def _requested_count(total: int, rule: QualityDefectSpec) -> int:
    if rule.count is not None:
        return rule.count
    return max(1, round(total * (rule.ratio or 0)))


def _default_missing_field(sample: GeneratedCI) -> str | None:
    # 取属性中排序后的第一个字段，保证同类型默认字段稳定
    keys = sorted(sample.attributes.keys())
    return keys[0] if keys else None


def _default_case_drift_field(sample: GeneratedCI) -> str:
    # 默认选第一个含混合大小写的字符串字段，保证漂移可见；没有则回退 name
    for key in sorted(sample.attributes.keys()):
        value = sample.attributes[key]
        if isinstance(value, str) and value.lower() != value.upper() and value != value.lower():
            return key
    return "name"


def _warning(kind_label: str, rule: QualityDefectSpec, field: str | None, requested: int, actual: int) -> str:
    target = rule.ci_type if field is None else f"{rule.ci_type}.{field}"
    if actual == requested:
        return f"数据质量缺陷：已注入 {actual} 条{kind_label}（{target}）"
    return f"数据质量缺陷：请求 {requested} 条{kind_label}，实际注入 {actual} 条（{target}）"


def _report(
    rule: QualityDefectSpec,
    field: str | None,
    requested: int,
    affected_ids: list[str],
    **extras,
) -> dict:
    report = {
        "kind": rule.kind,
        "ci_type": rule.ci_type,
        "field": field,
        "requested_count": requested,
        "affected_count": len(affected_ids),
        "affected_ids": sorted(affected_ids),
    }
    report.update(extras)
    return report


def apply_quality_defects(
    spec: GenerationSpec, cis: list[GeneratedCI]
) -> tuple[list[GeneratedCI], list[str], list[dict]]:
    """按规则顺序注入缺陷，并返回逐条可核对的精确报告。"""
    warnings: list[str] = []
    quality_report: list[dict] = []
    result = list(cis)

    for index, rule in enumerate(spec.quality_defects):
        # 每条规则独立种子，规则间互不影响且整体可复现
        rng = random.Random(f"{spec.seed}:quality:{index}:{rule.kind}:{rule.ci_type}")
        targets = [ci for ci in result if ci.type == rule.ci_type]
        if not targets:
            continue

        kind_label = DEFECT_KIND_LABELS[rule.kind]

        if rule.kind == "duplicate_record":
            requested = _requested_count(len(targets), rule)
            sources = rng.sample(targets, min(requested, len(targets)))
            base_count = len(targets)
            width = max(4, len(str(base_count)))
            prefix = targets[0].id.rsplit("-", 1)[0]
            source_by_duplicate_id: dict[str, str] = {}
            for offset, source in enumerate(sources, start=1):
                duplicate = GeneratedCI(
                    id=f"{prefix}-{str(base_count + offset).zfill(width)}",
                    type=source.type,
                    name=source.name,
                    attributes=copy.deepcopy(source.attributes),
                    tags=copy.deepcopy(source.tags),
                )
                duplicate.search_text = build_search_text(
                    duplicate.id, duplicate.name, duplicate.attributes
                )
                result.append(duplicate)
                source_by_duplicate_id[duplicate.id] = source.id
            affected_ids = list(source_by_duplicate_id)
            warnings.append(
                _warning(kind_label, rule, None, requested, len(affected_ids))
                + "，业务字段与源记录相同，便于测试去重"
            )
            quality_report.append(
                _report(
                    rule,
                    None,
                    requested,
                    affected_ids,
                    source_by_duplicate_id=source_by_duplicate_id,
                )
            )
            continue

        requested = _requested_count(len(targets), rule)

        if rule.kind == "missing_field":
            field = rule.field or _default_missing_field(targets[0])
            if not field:
                warnings.append(_warning(kind_label, rule, None, requested, 0))
                quality_report.append(_report(rule, None, requested, []))
                continue
            eligible = [ci for ci in targets if field in ci.attributes]
            picked = rng.sample(eligible, min(requested, len(eligible)))
            for ci in picked:
                ci.attributes.pop(field)
                ci.search_text = build_search_text(ci.id, ci.name, ci.attributes)
            affected_ids = [ci.id for ci in picked]
            warnings.append(_warning(kind_label, rule, field, requested, len(affected_ids)))
            quality_report.append(_report(rule, field, requested, affected_ids))

        elif rule.kind == "case_drift":
            # 默认选含混合大小写的字段：内置类型的 name 全小写，漂移不可见
            field = rule.field or _default_case_drift_field(targets[0])
            eligible = []
            for ci in targets:
                value = ci.name if field == "name" else ci.attributes.get(field)
                if isinstance(value, str) and any(
                    getattr(value, transform)() != value for transform in CASE_TRANSFORMS
                ):
                    eligible.append(ci)
            picked = rng.sample(eligible, min(requested, len(eligible)))
            for ci in picked:
                value = ci.name if field == "name" else ci.attributes[field]
                candidates = [
                    getattr(value, transform)()
                    for transform in CASE_TRANSFORMS
                    if getattr(value, transform)() != value
                ]
                changed = rng.choice(candidates)
                if field == "name":
                    ci.name = changed
                else:
                    ci.attributes[field] = changed
                ci.search_text = build_search_text(ci.id, ci.name, ci.attributes)
            affected_ids = [ci.id for ci in picked]
            warnings.append(_warning(kind_label, rule, field, requested, len(affected_ids)))
            quality_report.append(_report(rule, field, requested, affected_ids))

        elif rule.kind == "wrong_value":
            field = rule.field or (
                DEFAULT_WRONG_FIELD
                if DEFAULT_WRONG_FIELD in targets[0].attributes
                else _default_missing_field(targets[0])
            )
            if not field:
                warnings.append(_warning(kind_label, rule, None, requested, 0))
                quality_report.append(_report(rule, None, requested, []))
                continue
            wrong = WRONG_VALUES.get(field, "INVALID-VALUE")
            eligible = [ci for ci in targets if field in ci.attributes]
            picked = rng.sample(eligible, min(requested, len(eligible)))
            for ci in picked:
                ci.attributes[field] = wrong
                ci.search_text = build_search_text(ci.id, ci.name, ci.attributes)
            affected_ids = [ci.id for ci in picked]
            warnings.append(
                _warning(kind_label, rule, field, requested, len(affected_ids))
                + f"，写入值 {wrong}"
            )
            quality_report.append(
                _report(rule, field, requested, affected_ids, applied_value=wrong)
            )

    return result, warnings, quality_report
