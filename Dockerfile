FROM node:24-slim AS web
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/angular.json frontend/tsconfig.json frontend/.postcssrc.json ./
COPY frontend/src ./src
COPY frontend/public ./public
RUN npm run build

FROM ghcr.io/astral-sh/uv:0.13.9 AS uv
FROM python:3.13-slim
COPY --from=uv /uv /bin/uv
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core tzdata ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --uid 10001 wodo \
  && install -d -o wodo -g wodo /var/lib/wodo /var/lib/wodo-parcels
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
RUN apt-get update && apt-get install -y --no-install-recommends libexpat1 \
  && rm -rf /var/lib/apt/lists/*
COPY backend/main.py ./
COPY backend/wodo ./wodo
COPY docs/paszport_pola_katalog_danych.csv docs/paszport_pola_15_danych_od_rolnika.csv /docs/
COPY --from=web /build/dist/frontend/browser ./site
ENV WODO_CACHE_DIR=/var/lib/wodo WODO_PARCELS_DIR=/var/lib/wodo-parcels WODO_SITE_DIR=/app/site TZ=Europe/Warsaw PYTHONUNBUFFERED=1
USER wodo
EXPOSE 8000
HEALTHCHECK --interval=25s --timeout=3s CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2).read()"]
CMD ["/app/.venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers"]
