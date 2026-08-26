"""OpenAI 兼容 AI Provider。

AI 唯一任务：自然语言 → GenerationSpec 建议 + 中文说明 + warnings。
模型输出必须经服务端重新校验，不能直接信任。
测试使用假 Provider，不需要付费凭据。
"""

import json
import logging
from typing import Protocol

import httpx
from pydantic import BaseModel, Field

from ..config import Settings
from ..limits import MAX_AI_PROMPT_CHARS, MAX_AI_RESPONSE_BYTES
from ..specs.models import BUILTIN_CI_TYPES, SpecValidationError, parse_and_validate
from .config import AIConfigStore

logger = logging.getLogger("infrasourcelab.ai")

# 输出 token 上限：规格 JSON 较长，避免兼容服务默认值过小导致截断
AI_MAX_COMPLETION_TOKENS = 8192


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


# 系统默认提示词模板：关系清单与方向约定在运行时由关系类型注册表动态生成，
# 公开导出供管理接口展示，可在 AI 建议服务中选择自定义提示词替换
DEFAULT_SYSTEM_PROMPT_TEMPLATE = """你是 CMDB 测试数据生成工具 InfraSourceLab 的规格规划助手。
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
  {ci_types}
- relations：数组，每项 {{"type", "from_type", "to_type", "strategy", "coverage"}}：
  - type 只能从以下选择（格式为 标识符=中文名，方向 child_to_parent 表示 from=子、to=父，peer 表示平级）：
{relation_types}
  - from_type 与 to_type 必须出现在 ci_types 中且数量大于 0
  - strategy 只能是 balanced 或 random_seeded
  - coverage 只能是 from（每个起点生成一条出边）或 to（每个终点生成一条入边）
  - 常见搭配（注意层级关系一律从子级指向父级）：rack contained_in data_center（coverage=from）；
    physical_server mounted_in rack（coverage=from）；
    virtual_machine runs_on physical_server（coverage=from）；
    application deployed_on 或 hosted_on virtual_machine（coverage=from）；
    application uses database（coverage=to）；
    network_device connected_to network_device（coverage=from）
- 不要重复相同的关系规则；数量保持用户给出的值，未给出时给出合理小值。
- 不要输出任何命令行、脚本、URL 或文件路径。
"""


def build_default_system_prompt(relation_types: list[dict] | None = None) -> str:
    """构建默认系统提示词：关系清单从注册表动态生成，缺省回退内置清单。"""
    from ..specs.relation_types import DEFAULT_RELATION_TYPES

    rows = relation_types or [
        {"type": type_, "name_zh": zh, "name_en": en, "direction": direction}
        for type_, zh, en, direction in DEFAULT_RELATION_TYPES
    ]
    lines = [
        f"    {row['type']}={row.get('name_zh', row['type'])}（{row.get('direction', 'peer')}）"
        for row in rows
    ]
    return DEFAULT_SYSTEM_PROMPT_TEMPLATE.format(
        ci_types=", ".join(BUILTIN_CI_TYPES),
        relation_types="\n".join(lines),
    )


# 兼容旧引用：无关系类型注册表时的静态默认提示词
DEFAULT_SYSTEM_PROMPT = build_default_system_prompt()


def _extract_json(content: str) -> dict:
    text = content.strip()
    if text.startswith("```"):
        # 去掉 markdown 代码围栏（``` 或 ```json）
        lines = text.splitlines()
        if lines:
            lines = lines[1:]
        while lines and lines[-1].strip().startswith("```"):
            lines.pop()
        text = "\n".join(lines).strip()

    # 候选：全文、首尾大括号区间
    candidates = [text]
    first, last = text.find("{"), text.rfind("}")
    if first != -1 and last > first:
        candidates.append(text[first : last + 1])

    # 混合推理模型（如 MiniMax-M3）会把思考过程输出在 content 开头，
    # 思考里可能带草稿 JSON。扫描每个 '{' 用 raw_decode 提取完整对象，
    # 最终答案通常是最后一个含 spec 字段的对象。
    objects: list[dict] = []
    decoder = json.JSONDecoder()
    for position, char in enumerate(text):
        if char != "{":
            continue
        try:
            obj, _end = decoder.raw_decode(text, position)
        except json.JSONDecodeError:
            continue
        if isinstance(obj, dict):
            objects.append(obj)
    for obj in reversed(objects):
        if "spec" in obj:
            return obj

    for candidate in candidates:
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            return data
        raise AIProviderError("AI 返回的 JSON 顶层必须是对象。")
    if objects:
        return objects[-1]
    logger.warning("AI 返回内容无法提取 JSON，前 500 字符：%s", text[:500])
    preview = " ".join(text[:80].split())
    raise AIProviderError(
        f"AI 返回的内容不是有效 JSON，已尝试提取仍失败（内容开头：「{preview}」）。"
        "请重试、检查模型能力或调整提示词。"
    )


class OpenAICompatibleProvider:
    """通过 /chat/completions 调用 OpenAI 兼容服务。配置优先读运行时存储。"""

    def __init__(
        self,
        settings: Settings,
        config_store: "AIConfigStore | None" = None,
        relation_types_loader: "callable | None" = None,
    ):
        self._settings = settings
        self._config_store = config_store
        # 关系类型注册表读取器：返回 [{type, name_zh, name_en, direction}]，
        # 供默认提示词动态生成关系清单与 spec 校验
        self._relation_types_loader = relation_types_loader

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

    def _current_relation_types(self) -> list[dict]:
        """读取关系类型注册表；读取失败时回退内置清单。"""
        if self._relation_types_loader is None:
            return []
        try:
            return list(self._relation_types_loader())
        except Exception:  # 注册表读取失败不应阻断 AI 建议
            logger.exception("读取关系类型注册表失败，提示词回退内置清单。")
            return []

    def _system_prompt(self) -> str:
        """系统提示词：默认用内置模板（关系清单动态生成），可自定义替换。"""
        if self._config_store is None:
            return build_default_system_prompt(self._current_relation_types())
        mode, custom = self._config_store.prompt_config()
        if mode == "custom" and custom.strip():
            return custom.strip()
        return build_default_system_prompt(self._current_relation_types())

    async def _request(self, method: str, path: str, payload: dict | None = None):
        """统一的 OpenAI 兼容请求入口，负责超时/连接/状态码错误归一。"""
        config = self._resolve_config()
        if not config.configured:
            raise AINotConfiguredError(
                "AI Provider 未配置。请在设置页的「AI 建议服务」区域填写接入地址、密钥与模型，"
                "或设置 ISL_AI_BASE_URL、ISL_AI_API_KEY 和 ISL_AI_MODEL 环境变量，"
                "也可以改用内置模板创建数据集。"
            )
        url = config.base_url.rstrip("/") + path
        headers = {"Authorization": f"Bearer {config.api_key}"}
        try:
            async with httpx.AsyncClient(timeout=config.timeout_seconds) as client:
                if method == "GET":
                    response = await client.get(url, headers=headers)
                else:
                    response = await client.post(url, json=payload, headers=headers)
        except httpx.TimeoutException as exc:
            raise AITimeoutError(
                f"AI 调用超时（上限 {config.timeout_seconds:.0f} 秒），请稍后重试。"
            ) from exc
        except httpx.HTTPError as exc:
            raise AIProviderError("AI 服务连接失败：请检查接入地址是否可达。") from exc
        if response.status_code != 200:
            raise AIProviderError(
                f"AI 服务返回错误状态 {response.status_code}，请检查接入地址、模型名称和凭据。"
            )
        return config, response

    async def list_models(self) -> list[str]:
        """拉取服务端可用模型 ID 列表（GET /models）。"""
        _config, response = await self._request("GET", "/models")
        if len(response.content) > MAX_AI_RESPONSE_BYTES:
            raise AIProviderError("AI 响应超过大小上限，已丢弃。")
        try:
            items = response.json().get("data", [])
            models = sorted({str(item["id"]) for item in items if isinstance(item, dict) and item.get("id")})
        except (ValueError, KeyError, TypeError) as exc:
            raise AIProviderError("AI 服务的模型列表响应格式不符合预期。") from exc
        return models

    async def test_connection(self) -> str:
        """测试连通性与凭据：能成功读取模型列表即视为配置可用。"""
        config, response = await self._request("GET", "/models")
        try:
            count = len(response.json().get("data", []))
        except ValueError as exc:
            raise AIProviderError("AI 服务可达，但模型列表响应不是有效 JSON。") from exc
        known = config.model and any(
            isinstance(item, dict) and item.get("id") == config.model
            for item in (response.json().get("data", []) if count else [])
        )
        if known:
            return f"连接成功：服务可用，当前模型 {config.model} 在模型列表中（共 {count} 个）。"
        return f"连接成功：服务可用（模型列表共 {count} 个）。当前模型 {config.model or '未填写'}，请确认名称正确。"

    async def create_generation_spec(self, prompt: str) -> SpecProposal:
        config = self._resolve_config()
        if not config.configured:
            raise AINotConfiguredError(
                "AI Provider 未配置。请在设置页的「AI 建议服务」区域填写接入地址、密钥与模型，"
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
            "max_tokens": AI_MAX_COMPLETION_TOKENS,
            "messages": [
                {"role": "system", "content": self._system_prompt()},
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
            choice = body["choices"][0]
            content = choice["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AIProviderError("AI 响应结构不符合预期，无法提取内容。") from exc
        if not isinstance(content, str) or not content.strip():
            logger.warning("AI 返回 content 为空，响应前 500 字符：%s", str(body)[:500])
            raise AIProviderError(
                "AI 返回内容为空（部分推理模型会输出到思考通道）。请重试或更换模型。"
            )
        if choice.get("finish_reason") == "length":
            logger.warning("AI 输出被截断（finish_reason=length），前 300 字符：%s", content[:300])
            raise AIProviderError(
                "AI 输出因长度上限被截断，无法解析。请精简需求后重试。"
            )

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
            relation_rows = self._current_relation_types()
            allowed = {row["type"] for row in relation_rows} if relation_rows else None
            spec = parse_and_validate(raw_spec, allowed_relation_types=allowed)
        except SpecValidationError as exc:
            raise AIProviderError("AI 返回的规格未通过服务端校验：" + "；".join(exc.errors)) from exc

        return SpecProposal(
            message=str(message)[:500],
            spec=spec.model_dump(mode="json"),
            warnings=warnings,
        )
