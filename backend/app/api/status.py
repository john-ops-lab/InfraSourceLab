"""运行状态：前端需要知道 AI Provider 是否已配置。

公开接口：不含敏感信息；登录页与设置页需要在未认证时访问。
默认测试令牌属于公开约定（测试数据工具），随状态一起下发供界面展示。
"""

from fastapi import APIRouter, Request

from ..auth.token import DEFAULT_API_KEY

router = APIRouter(prefix="/api/v1", tags=["系统"])


@router.get("/status")
def status(request: Request) -> dict:
    store = getattr(request.app.state, "ai_config_store", None)
    if store is not None:
        configured = store.ai_configured()
    else:
        configured = request.app.state.settings.ai_configured
    return {"ai_configured": configured, "default_api_key": DEFAULT_API_KEY}
