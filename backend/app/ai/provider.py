"""OpenAI 兼容 AI Provider。

AI 唯一任务：自然语言 → GenerationSpec 建议 + 中文说明 + warnings。
模型输出必须经服务端重新校验，不能直接信任。
测试使用假 Provider，不需要付费凭据。
"""

import json
from typing import Protocol

import httpx
from pydantic import BaseModel, Field

from ..config import Settings
from ..limits import MAX_AI_PROMPT_CHARS, MAX_AI_RESPONSE_BYTES
from ..specs.models import BUILTIN_CI_TYPES, BUILTIN_RELATION_TYPES, SpecValidationError, parse_and_validate
from .config import AIConfigStore


class AINotConfiguredError(RuntimeError):
    """AI Provider 未配置。"""


class AITimeoutError(RuntimeError):
    """AI 调用超时。"""


class AIProviderError(RuntimeError):
    """AI 调用或解析失败，消息已脱敏。"""


class SpecProposal(BaseModel):
    message: str
    spec: dict
    warnings: list[str] = Field(default_factory=list)


class AIProvider(Protocol):
    async def create_generation_spec(self, prompt: str) -> SpecProposal: ...


_SYSTEM_PROMPT = f"""你是 CMDB 测试数据生成工具 InfraSourceLab 的规格规划助手。
用户会用自然语言描述需要的 CMDB 配置数据，你只输出一份 JSON，不输出任何其他文字。

JSON 结构：
{{
  "message": "用简短中文说明你计划生成什么数据",
  "spec": {{GenerationSpec}},
  "warnings": ["可选的中文注意事项"]
}}

GenerationSpec 规则：
- name：数据集名称；description：简短说明；seed：整数种子。
- ci_types：数组，每项 {{"type", "count"}}；type 只能从以下选择：
  {", ".join(BUILTIN_CI_TYPES)}
- relations：数组，每项 {{"type", "from_type", "to_type", "strategy", "coverage"}}：
  - type 只能从以下选择：{", ".join(BUILTIN_RELATION_TYPES)}
  - from_type 与 to_type 必须出现在 ci_types 中且数量大于 0
  - strategy 只能是 balanced 或 random_seeded
  - coverage 只能是 from（每个起点生成一条出边）或 to（每个终点生成一条入边）
  - 常见搭配：data_center contains rack（coverage=to）；
    physical_server mounted_in rack（coverage=from）；
    virtual_machine runs_on physical_server（coverage=from）；
    application hosted_on virtual_machine（coverage=from）；
    application uses database（coverage=to）
- 不要重复相同的关系规则；数量保持用户给出的值，未给出时给出合理小值。
- 不要输出任何命令行、脚本、URL 或文件路径。
"""


def _extract_json(content: str) -> dict:
    text = content.strip()
    if text.startswith("```"):
        # 去掉 markdown 代码围栏
        lines = text.splitlines()
        if lines:
            lines = lines[1:]
        while lines and lines[-1].strip().startswith("```"):
            lines.pop()
        text = "\n".join(lines)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise AIProviderError("AI 返回的内容不是有效 JSON，请重试或调整提示词。") from exc
    if not isinstance(data, dict):
        raise AIProviderError("AI 返回的 JSON 顶层必须是对象。")
    return data


class OpenAICompatibleProvider:
    """通过 /chat/completions 调用 OpenAI 兼容服务。配置优先读运行时存储。"""

    def __init__(self, settings: Settings, config_store: "AIConfigStore | None" = None):
        self._settings = settings
        self._config_store = config_store

    def _resolve_config(self):
        if self._config_store is not None:
            return self._config_store.effective()
        settings = self._settings

        class _Static:
            base_url = settings.isl_ai_base_url
            api_key = settings.isl_ai_api_key
            model = settings.isl_ai_model
            timeout_seconds = settings.isl_ai_timeout_seconds
            configured = settings.ai_configured

        return _Static()

    async def create_generation_spec(self, prompt: str) -> SpecProposal:
        config = self._resolve_config()
        if not config.configured:
            raise AINotConfiguredError(
                "AI Provider 未配置。请在「AI 配置」页填写接入地址、密钥与模型，"
                "或设置 ISL_AI_BASE_URL、ISL_AI_API_KEY 和 ISL_AI_MODEL 环境变量，"
                "也可以改用内置模板创建数据集。"
            )
        prompt = prompt.strip()
        if len(prompt) > MAX_AI_PROMPT_CHARS:
            raise AIProviderError(f"提示词超过 {MAX_AI_PROMPT_CHARS} 字符上限，请精简后重试。")

        url = config.base_url.rstrip("/") + "/chat/completions"
        payload = {
            "model": config.model,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        }
        headers = {"Authorization": f"Bearer {config.api_key}"}

        try:
            async with httpx.AsyncClient(timeout=config.timeout_seconds) as client:
                response = await client.post(url, json=payload, headers=headers)
        except httpx.TimeoutException as exc:
            raise AITimeoutError(
                f"AI 调用超时（上限 {config.timeout_seconds:.0f} 秒），请稍后重试。"
            ) from exc
        except httpx.HTTPError as exc:
            raise AIProviderError("AI 服务连接失败：请检查接入地址是否可达。") from exc

        if response.status_code != 200:
            raise AIProviderError(f"AI 服务返回错误状态 {response.status_code}，请检查模型名称和凭据。")
        if len(response.content) > MAX_AI_RESPONSE_BYTES:
            raise AIProviderError("AI 响应超过大小上限，已丢弃。")

        body = response.json()
        try:
            content = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AIProviderError("AI 响应结构不符合预期，无法提取内容。") from exc

        data = _extract_json(content)
        message = data.get("message") or "AI 未提供说明。"
        warnings = data.get("warnings") or []
        if not isinstance(warnings, list):
            warnings = []
        warnings = [str(item) for item in warnings[:8]]

        raw_spec = data.get("spec")
        if not isinstance(raw_spec, dict):
            raise AIProviderError("AI 返回中缺少 spec 字段。")
        try:
            spec = parse_and_validate(raw_spec)
        except SpecValidationError as exc:
            raise AIProviderError("AI 返回的规格未通过服务端校验：" + "；".join(exc.errors)) from exc

        return SpecProposal(
            message=str(message)[:500],
            spec=spec.model_dump(mode="json"),
            warnings=warnings,
        )
