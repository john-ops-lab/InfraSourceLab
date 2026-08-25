"""Bearer Token 依赖：安全字符串比较，缺失或错误时返回 401。

不在日志和错误响应中回显 Key。
"""

import hmac

from fastapi import Depends, HTTPException, Request, status

_SCHEME = "Bearer "


def require_api_key(request: Request) -> None:
    expected = request.app.state.settings.isl_api_key
    if not expected:
        # 服务端未配置 Key 时也拒绝访问，避免匿名暴露数据
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="服务端未配置 ISL_API_KEY，无法验证请求。请在服务端设置 ISL_API_KEY 后重试。",
            headers={"WWW-Authenticate": "Bearer"},
        )

    header = request.headers.get("Authorization", "")
    if not header.startswith(_SCHEME):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少 Bearer Token。请在 Authorization 请求头中提供：Bearer <ISL_API_KEY>。",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = header[len(_SCHEME):].strip()
    if not hmac.compare_digest(token.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key 无效。",
            headers={"WWW-Authenticate": "Bearer"},
        )


ApiKeyId = Depends(require_api_key)
