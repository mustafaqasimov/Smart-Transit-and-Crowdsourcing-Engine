# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS ui
WORKDIR /ui
COPY frontend/package*.json ./
RUN --mount=type=secret,id=proxy_ca NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci
COPY frontend/ .
RUN npm run build
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN --mount=type=secret,id=system_ca if [ -f /run/secrets/system_ca ]; then PIP_CERT=/run/secrets/system_ca pip install --no-cache-dir -r requirements.txt; else pip install --no-cache-dir -r requirements.txt; fi
COPY backend/ .
COPY --from=ui /ui/dist /app/static
EXPOSE 8000
CMD ["uvicorn","main:app","--host","0.0.0.0","--port","8000"]
