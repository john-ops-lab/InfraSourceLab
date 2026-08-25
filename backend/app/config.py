"""运行配置：全部来自环境变量，敏感值不落盘、不进日志。"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # 认证：所有 /api/v1/* 接口要求该 Bearer Token
    isl_api_key: str = ""

    # 数据目录与 SQLite 文件
    isl_data_dir: Path = Path("data")

    # OpenAI 兼容 AI Provider（全部配置齐备才视为可用）
    isl_ai_base_url: str = ""
    isl_ai_api_key: str = ""
    isl_ai_model: str = ""
    isl_ai_timeout_seconds: float = 30.0

    # 服务监听；Docker Compose 默认只向宿主机 127.0.0.1 发布
    isl_host: str = "127.0.0.1"
    isl_port: int = 8080

    # 前端静态产物目录（生产镜像内置，开发时可为空）
    isl_web_dir: str = ""

    @property
    def ai_configured(self) -> bool:
        return bool(self.isl_ai_base_url and self.isl_ai_api_key and self.isl_ai_model)

    @property
    def database_path(self) -> Path:
        return self.isl_data_dir / "infrasourcelab.db"
