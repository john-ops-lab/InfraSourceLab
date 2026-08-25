"""认证依赖：Bearer Token 双通道。

- 环境变量 ISL_API_KEY 作为备用令牌（安全字符串比较）；
- 管理员登录产生的会话令牌（只存哈希，带过期时间）。
不在日志和错误响应中回显 Key。
"""

import hashlib
import hmac
from datetime import datetime, timezone

from fastapi import HTTPException, Request, status

_SCHEME = "Bearer "


def _bearer_token(request: Request) -> str:
    header = request.headers.get("Authorization", "")
    if not header.startswith(_SCHEME):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少 Bearer Token。请登录管理员账号，或在 Authorization 请求头中提供：Bearer <ISL_API_KEY>。",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return header[len(_SCHEME):].strip()


def _match_api_key(request: Request, token: str) -> bool:
    expected = request.app.state.settings.isl_api_key
    if not expected:
        return False
    return hmac.compare_digest(token.encode("utf-8"), expected.encode("utf-8"))


def _match_session(request: Request, token: str) -> str | None:
    """命中会话令牌时返回用户名，否则返回 None。"""
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    from ..db.models import AuthToken

    session_factory = request.app.state.session_factory
    with session_factory() as session:
        row = session.query(AuthToken).filter(AuthToken.token_hash == token_hash).first()
        if row is None:
            return None
        # SQLite 存储为 naive UTC，这里统一按 naive UTC 比较
        if row.expires_at <= datetime.now(timezone.utc).replace(tzinfo=None):
            session.delete(row)
            session.commit()
            return None
        return row.username


def require_auth(request: Request) -> dict:
    """所有数据接口：会话令牌或 ISL_API_KEY 二选一。"""
    token = _bearer_token(request)
    if _match_api_key(request, token):
        return {"kind": "api_key", "username": ""}
    username = _match_session(request, token)
    if username is not None:
        return {"kind": "session", "username": username}
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="认证失败：令牌无效或已过期。请重新登录或检查 API Key。",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_admin_session(request: Request) -> dict:
    """管理操作（AI 配置、改密码）：必须来自管理员登录会话。"""
    identity = require_auth(request)
    if identity["kind"] != "session":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="该操作需要管理员登录会话，API Key 不具备管理权限。请先登录。",
        )
    return identity


# 兼容旧名称：数据接口的认证依赖
ApiKeyId = require_auth
