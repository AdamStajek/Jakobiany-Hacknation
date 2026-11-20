FROM ghcr.io/astral-sh/uv:0.13.9 AS uv
FROM python:3.13-slim
COPY --from=uv /uv /bin/uv
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev
COPY backend/main.py ./
CMD ["/app/.venv/bin/uvicorn", "main:app", "--host", "0.0.0.0"]
