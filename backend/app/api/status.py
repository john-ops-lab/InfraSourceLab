"""运行状态：前端需要知道 AI Provider 是否已配置。

公开接口：只返回布尔标志，不含敏感信息；登录页与设置页需要在未认证时访问。
"""

from fastapi import APIRouter, Request

router = APIRouter(prefix="/api/v1", tags=["系统"])


@router.get("/status")
def status(request: Request) -> dict:
    store = getattr(request.app.state, "ai_config_store", None)
    if store is not None:
        configured = store.ai_configured()
    else:
        configured = request.app.state.settings.ai_configured
    return {"ai_configured": configured}
