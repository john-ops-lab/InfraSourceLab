"""FastAPI 应用工厂与本地启动入口。

生产形态：一个应用容器内置前端静态产物 + SQLite 数据目录。
"""

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .ai.config import AIConfigStore
from .ai.provider import OpenAICompatibleProvider
from .api import admin, auth_routes, datasets, health, relation_types, specs, status, templates
from .auth.password import hash_password
from .config import Settings
from .db.models import AppUser
from .db.session import DatabaseVersionError, create_session_factory, init_database
from .specs.relation_types import (
    migrate_contains_to_contained_in,
    seed_relation_types,
)

logger = logging.getLogger("infrasourcelab")

DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin123"


def _seed_default_admin(session_factory) -> None:
    """首次启动创建默认管理员；不强制改密，可在设置页自行修改。"""
    with session_factory() as session:
        if session.query(AppUser).count() == 0:
            session.add(
                AppUser(
                    username=DEFAULT_ADMIN_USERNAME,
                    password_hash=hash_password(DEFAULT_ADMIN_PASSWORD),
                )
            )
            session.commit()


def _load_relation_type_rows(session_factory) -> list[dict]:
    """供 AI 提示词动态生成关系清单（type、中英文名、方向）。"""
    from .specs.relation_types import list_relation_types

    with session_factory() as session:
        return [
            {
                "type": row.type,
                "name_zh": row.name_zh,
                "name_en": row.name_en,
                "direction": row.direction,
            }
            for row in list_relation_types(session)
        ]


def create_app(settings: Settings | None = None, ai_provider=None) -> FastAPI:
    settings = settings or Settings()

    app = FastAPI(
        title="InfraSourceLab",
        description="CMDB 测试数据生成工具：规格 → 数据集 → 带认证的 REST API 与导出。",
        version="0.1.0",
    )
    app.state.settings = settings

    # SQLite 版本检查在启动时完成；未知版本直接拒绝启动
    engine = init_database(settings.database_path)
    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)
    _seed_default_admin(app.state.session_factory)
    with app.state.session_factory() as session:
        # 关系类型注册表：先种入内置清单，再把历史 contains 数据归一为 contained_in
        seed_relation_types(session)
        migrate_contains_to_contained_in(session)
    app.state.ai_config_store = AIConfigStore(settings, app.state.session_factory)
    app.state.ai_provider = ai_provider or OpenAICompatibleProvider(
        settings,
        app.state.ai_config_store,
        relation_types_loader=lambda: _load_relation_type_rows(app.state.session_factory),
    )

    app.include_router(health.router)
    app.include_router(status.router)
    app.include_router(templates.router)
    app.include_router(specs.router)
    app.include_router(datasets.router)
    app.include_router(auth_routes.router)
    app.include_router(admin.router)
    app.include_router(relation_types.router)
    app.include_router(relation_types.admin_router)

    # 前端静态产物：生产镜像内置；开发时可缺省。
    # 先注册 API 路由再挂载，未命中的非 API 路径回退到 index.html 以支持 SPA 深链。
    web_dir = Path(settings.isl_web_dir) if settings.isl_web_dir else Path(__file__).resolve().parents[2] / "web" / "dist"
    if web_dir.is_dir() and (web_dir / "index.html").exists():
        assets_dir = web_dir / "assets"
        if assets_dir.is_dir():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

        index_html = web_dir / "index.html"

        @app.get("/{path:path}", include_in_schema=False)
        async def spa_fallback(path: str) -> FileResponse:
            if path.startswith(("api/", "docs", "openapi", "redoc", "health")):
                raise HTTPException(status_code=404)
            candidate = web_dir / path
            if path and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(index_html)

    return app


def main() -> None:
    import uvicorn

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    settings = Settings()
    try:
        app = create_app(settings)
    except DatabaseVersionError as exc:
        logger.error("数据库启动失败：%s", exc)
        raise SystemExit(1) from exc
    logger.info(
        "InfraSourceLab 启动：http://%s:%s（AI Provider %s）",
        settings.isl_host,
        settings.isl_port,
        "已配置" if settings.ai_configured else "未配置",
    )
    uvicorn.run(app, host=settings.isl_host, port=settings.isl_port, log_level="info")


if __name__ == "__main__":
    main()
