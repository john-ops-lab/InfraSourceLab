"""AI 模型配置存储：数据库覆盖优先，环境变量作为初始默认值。

管理员在界面保存后立即生效，无需重启。
"""

from typing import Callable

from sqlalchemy.orm import Session

from ..config import Settings
from ..db.models import AppSetting

KEY_BASE_URL = "ai_base_url"
KEY_API_KEY = "ai_api_key"
KEY_MODEL = "ai_model"
KEY_TIMEOUT = "ai_timeout_seconds"


class AIConfig:
    def __init__(self, base_url: str, api_key: str, model: str, timeout_seconds: float):
        self.base_url = base_url.strip()
        self.api_key = api_key.strip()
        self.model = model.strip()
        self.timeout_seconds = timeout_seconds

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.api_key and self.model)


class AIConfigStore:
    def __init__(self, settings: Settings, session_factory: Callable[[], Session]):
        self._settings = settings
        self._session_factory = session_factory

    def effective(self) -> AIConfig:
        """数据库中的非空覆盖优先，其余回退到环境变量。"""
        overrides: dict[str, str] = {}
        with self._session_factory() as session:
            rows = session.query(AppSetting).filter(
                AppSetting.key.in_([KEY_BASE_URL, KEY_API_KEY, KEY_MODEL, KEY_TIMEOUT])
            ).all()
            overrides = {row.key: row.value for row in rows}

        settings = self._settings
        base_url = overrides.get(KEY_BASE_URL) or settings.isl_ai_base_url
        api_key = overrides.get(KEY_API_KEY) or settings.isl_ai_api_key
        model = overrides.get(KEY_MODEL) or settings.isl_ai_model
        raw_timeout = overrides.get(KEY_TIMEOUT)
        try:
            timeout = float(raw_timeout) if raw_timeout else settings.isl_ai_timeout_seconds
        except ValueError:
            timeout = settings.isl_ai_timeout_seconds
        return AIConfig(base_url=base_url, api_key=api_key, model=model, timeout_seconds=timeout)

    def ai_configured(self) -> bool:
        return self.effective().configured

    def update(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
        timeout_seconds: float | None = None,
    ) -> None:
        """None 表示保持原值；空字符串表示清空该项。"""
        updates: dict[str, str] = {}
        if base_url is not None:
            updates[KEY_BASE_URL] = base_url.strip()
        if api_key is not None:
            updates[KEY_API_KEY] = api_key.strip()
        if model is not None:
            updates[KEY_MODEL] = model.strip()
        if timeout_seconds is not None:
            updates[KEY_TIMEOUT] = str(timeout_seconds)

        with self._session_factory() as session:
            for key, value in updates.items():
                row = session.get(AppSetting, key)
                if row is None:
                    session.add(AppSetting(key=key, value=value))
                else:
                    row.value = value
            session.commit()
