"""健康检查：不要求认证。"""

from fastapi import APIRouter

router = APIRouter(tags=["系统"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}
