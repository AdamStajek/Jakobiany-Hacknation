FROM ghcr.io/astral-sh/uv:0.13.9 AS uv
FROM python:3.13-slim
COPY --from=uv /uv /bin/uv
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends antiword && rm -rf /var/lib/apt/lists/*
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev
COPY backend/*.py ./
COPY backend/connectors ./connectors
COPY docs/openapi.yaml ./openapi.yaml
ENV RISK_MINER_DB_PATH=/app/data/risk-miner.db
CMD ["/app/.venv/bin/uvicorn", "main:app", "--host", "0.0.0.0"]
