"""管理接口：AI 模型配置。仅管理员登录会话可用。"""

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..auth.token import require_admin_session

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
