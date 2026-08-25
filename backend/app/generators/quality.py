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
    "cpu_cores": "-1",
    "memory_gb": "-1",
    "disk_gb": "-1",
}

DEFAULT_WRONG_FIELD = "status"
CASE_TRANSFORMS = ("upper", "lower", "swapcase")


def _target_count(total: int, rule: QualityDefectSpec) -> int:
    if rule.count is not None:
        return min(rule.count, total)
    return max(1, min(total, round(total * (rule.ratio or 0))))


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


def apply_quality_defects(
    spec: GenerationSpec, cis: list[GeneratedCI]
) -> tuple[list[GeneratedCI], list[str]]:
    """按规则顺序注入缺陷，返回（可能追加了重复记录的）CI 列表与警告。"""
    warnings: list[str] = []
    result = list(cis)

    for index, rule in enumerate(spec.quality_defects):
        # 每条规则独立种子，规则间互不影响且整体可复现
        rng = random.Random(f"{spec.seed}:quality:{index}:{rule.kind}:{rule.ci_type}")
        targets = [ci for ci in result if ci.type == rule.ci_type]
        if not targets:
            continue

        kind_label = DEFECT_KIND_LABELS[rule.kind]

        if rule.kind == "duplicate_record":
            amount = _target_count(len(targets), rule)
            sources = rng.sample(targets, amount)
            base_count = len(targets)
            width = max(4, len(str(base_count)))
            prefix = targets[0].id.rsplit("-", 1)[0]
            for offset, source in enumerate(sources, start=1):
                duplicate = GeneratedCI(
                    id=f"{prefix}-{str(base_count + offset).zfill(width)}",
                    type=source.type,
                    name=source.name,
                    attributes=copy.deepcopy(source.attributes),
                    tags=copy.deepcopy(source.tags),
                    search_text=source.search_text,
                )
                result.append(duplicate)
            warnings.append(
                f"数据质量缺陷：已注入 {amount} 条{kind_label}（{rule.ci_type}，"
                "业务字段与源记录相同，便于测试去重）"
            )
            continue

        amount = _target_count(len(targets), rule)
        picked = rng.sample(targets, amount)

        if rule.kind == "missing_field":
            field = rule.field or _default_missing_field(picked[0])
            if not field:
                continue
            for ci in picked:
                ci.attributes.pop(field, None)
                ci.search_text = build_search_text(ci.id, ci.name, ci.attributes)
            warnings.append(f"数据质量缺陷：已注入 {amount} 条{kind_label}（{rule.ci_type}.{field}）")

        elif rule.kind == "case_drift":
            # 默认选含混合大小写的字段：内置类型的 name 全小写，漂移不可见
            field = rule.field or _default_case_drift_field(picked[0])
            for ci in picked:
                transform = rng.choice(CASE_TRANSFORMS)
                if field == "name":
                    ci.name = getattr(ci.name, transform)()
                elif isinstance(ci.attributes.get(field), str):
                    ci.attributes[field] = getattr(ci.attributes[field], transform)()
                else:
                    continue
                ci.search_text = build_search_text(ci.id, ci.name, ci.attributes)
            warnings.append(f"数据质量缺陷：已注入 {amount} 条{kind_label}（{rule.ci_type}.{field}）")

        elif rule.kind == "wrong_value":
            field = rule.field or (
                DEFAULT_WRONG_FIELD
                if DEFAULT_WRONG_FIELD in picked[0].attributes
                else _default_missing_field(picked[0])
            )
            if not field:
                continue
            wrong = WRONG_VALUES.get(field, "INVALID-VALUE")
            for ci in picked:
                ci.attributes[field] = wrong
                ci.search_text = build_search_text(ci.id, ci.name, ci.attributes)
            warnings.append(f"数据质量缺陷：已注入 {amount} 条{kind_label}（{rule.ci_type}.{field}={wrong}）")

    return result, warnings
