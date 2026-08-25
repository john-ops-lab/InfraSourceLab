"""运行状态：前端需要知道 AI Provider 是否已配置。"""

from fastapi import APIRouter, Depends, Request

from ..auth.token import require_api_key

router = APIRouter(prefix="/api/v1", tags=["系统"], dependencies=[Depends(require_api_key)])


@router.get("/status")
def status(request: Request) -> dict:
    settings = request.app.state.settings
    return {"ai_configured": settings.ai_configured}
