"""账户接口：管理员登录、登出、修改密码。

默认账户 admin / admin123 在首次启动时创建；不强制改密，可在设置页自行修改。
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth.password import hash_password, verify_password
from ..auth.token import require_admin_session
from ..db.models import AppUser, AuthToken
from .deps import get_session

router = APIRouter(prefix="/api/v1/auth", tags=["账户"])

SESSION_TTL_HOURS = 12


def _utcnow() -> datetime:
    # SQLite 存 naive UTC，入库与比较统一去掉时区信息
    return datetime.now(timezone.utc).replace(tzinfo=None)


def token_hash_of(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=200)


class LoginResponse(BaseModel):
    token: str
    username: str
    expires_at: str


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=6, max_length=200)


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, session: Session = Depends(get_session)):
    user = session.query(AppUser).filter(AppUser.username == body.username).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误。")

    token = "isl-" + secrets.token_urlsafe(32)
    expires_at = _utcnow() + timedelta(hours=SESSION_TTL_HOURS)
    session.add(
        AuthToken(
            token_hash=token_hash_of(token),
            username=user.username,
            expires_at=expires_at,
        )
    )
    # 顺带清理过期令牌
    session.query(AuthToken).filter(AuthToken.expires_at <= _utcnow()).delete()
    session.commit()
    return LoginResponse(token=token, username=user.username, expires_at=expires_at.isoformat())


@router.post("/logout", status_code=204)
def logout(request: Request, session: Session = Depends(get_session)):
    identity = require_admin_session(request)
    header = request.headers.get("Authorization", "")
    token = header[len("Bearer "):].strip()
    session.query(AuthToken).filter(AuthToken.token_hash == token_hash_of(token)).delete()
    session.commit()
    _ = identity
    return None


@router.post("/change-password", status_code=204)
def change_password(
    body: ChangePasswordRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    identity = require_admin_session(request)
    user = session.query(AppUser).filter(AppUser.username == identity["username"]).first()
    if user is None or not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="当前密码不正确。")
    user.password_hash = hash_password(body.new_password)
    user.password_changed_at = _utcnow()
    session.commit()
    return None
