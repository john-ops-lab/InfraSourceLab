"""依赖注入：数据库会话与 AI Provider。"""

from typing import Iterator

from fastapi import Request
from sqlalchemy.orm import Session


def get_session(request: Request) -> Iterator[Session]:
    session_factory = request.app.state.session_factory
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


def get_ai_provider(request: Request):
    return request.app.state.ai_provider
