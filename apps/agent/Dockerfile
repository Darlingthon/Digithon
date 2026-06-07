# Build from THIS dir:  docker build -t trustline-agent apps/agent
# Vera agent (Track A) on Cloud Run — ADK FastAPI app via uvicorn.
# syntax=docker/dockerfile:1
FROM python:3.13-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8000
EXPOSE 8000
# Cloud Run sets $PORT; bind 0.0.0.0.
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
