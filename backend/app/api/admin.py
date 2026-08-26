"""管理接口：AI 模型配置、模型列表/连通性测试、系统提示词配置。仅管理员登录会话可用。"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ..ai.provider import (
    AINotConfiguredError,
    AIProviderError,
    AITimeoutError,
    DEFAULT_SYSTEM_PROMPT,
)
from ..auth.token import require_admin_session
from .deps import get_ai_provider

router = APIRouter(prefix="/api/v1/admin", tags=["管理"], dependencies=[Depends(require_admin_session)])


class AIConfigResponse(BaseModel):
    base_url: str
    model: str
    timeout_seconds: float
    api_key_configured: bool
    api_key_hint: str
    ai_configured: bool


class AIConfigUpdate(BaseModel):
    base_url: str = Field(default="", max_length=500)
    api_key: str | None = Field(default=None, max_length=500)
    model: str = Field(default="", max_length=200)
    timeout_seconds: float = Field(default=30.0, gt=0, le=600)


def _masked(config) -> AIConfigResponse:
    hint = f"****{config.api_key[-4:]}" if len(config.api_key) >= 4 else ("****" if config.api_key else "")
    return AIConfigResponse(
        base_url=config.base_url,
        model=config.model,
        timeout_seconds=config.timeout_seconds,
        api_key_configured=bool(config.api_key),
        api_key_hint=hint,
        ai_configured=config.configured,
    )


@router.get("/ai-config", response_model=AIConfigResponse)
def get_ai_config(request: Request):
    store = request.app.state.ai_config_store
    return _masked(store.effective())


@router.put("/ai-config", response_model=AIConfigResponse)
def update_ai_config(body: AIConfigUpdate, request: Request):
    store = request.app.state.ai_config_store
    store.update(
        base_url=body.base_url,
        api_key=body.api_key,
        model=body.model,
        timeout_seconds=body.timeout_seconds,
    )
    return _masked(store.effective())


@router.get("/ai-config/models")
async def list_ai_models(provider=Depends(get_ai_provider)):
    """拉取最新模型 ID 列表（需先保存配置）。"""
    try:
        models = await provider.list_models()
    except AINotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AITimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except AIProviderError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"models": models}


@router.post("/ai-config/test")
async def test_ai_connection(provider=Depends(get_ai_provider)):
    """测试当前配置的连通性与凭据状态。"""
    try:
        message = await provider.test_connection()
    except AINotConfiguredError as exc:
        return {"ok": False, "message": str(exc)}
    except AITimeoutError as exc:
        return {"ok": False, "message": str(exc)}
    except AIProviderError as exc:
        return {"ok": False, "message": str(exc)}
    return {"ok": True, "message": message}


class PromptConfigResponse(BaseModel):
    default_prompt: str
    custom_prompt: str
    active: str


class PromptConfigUpdate(BaseModel):
    active: str = Field(default="default", pattern="^(default|custom)$")
    custom_prompt: str | None = Field(default=None, max_length=8000)


@router.get("/ai-prompts", response_model=PromptConfigResponse)
def get_ai_prompts(request: Request):
    store = request.app.state.ai_config_store
    mode, custom = store.prompt_config()
    return PromptConfigResponse(default_prompt=DEFAULT_SYSTEM_PROMPT, custom_prompt=custom, active=mode)


@router.put("/ai-prompts", response_model=PromptConfigResponse)
def update_ai_prompts(body: PromptConfigUpdate, request: Request):
    store = request.app.state.ai_config_store
    store.update_prompt(mode=body.active, custom=body.custom_prompt)
    mode, custom = store.prompt_config()
    return PromptConfigResponse(default_prompt=DEFAULT_SYSTEM_PROMPT, custom_prompt=custom, active=mode)
