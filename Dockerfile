# InfraSourceLab：单镜像 = 后端 + 内置前端静态产物 + SQLite 数据卷
# 阶段一：构建前端
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# 阶段二：Python 运行时
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim
WORKDIR /app

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/app ./app
COPY --from=web /web/dist /srv/web-dist

ENV ISL_WEB_DIR=/srv/web-dist \
    ISL_DATA_DIR=/data \
    ISL_HOST=0.0.0.0 \
    ISL_PORT=8080 \
    PATH="/app/.venv/bin:$PATH"

RUN useradd -m appuser && mkdir -p /data && chown -R appuser:appuser /data /app
USER appuser

VOLUME /data
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8080/health')" || exit 1

CMD ["python", "-m", "app.main"]
