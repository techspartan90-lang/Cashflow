# Deployment Guide & Production Operations

## 1. Architecture & Deployment Targets
The platform operates as a modern containerized microservices architecture:
1. **Frontend & Application Server:** Node.js 20 LTS / Vite SPA with Express API Middlewares.
2. **Database & Auth:** Managed Supabase PostgreSQL with Row Level Security (RLS).
3. **AI Prediction Service:** Python 3.11+ FastAPI microservice.

---

## 2. Docker Container Deployment

### 2.1 Building the Web Container
The application utilizes a multi-stage Docker build for minimal image footprint and non-root security compliance:
```bash
docker build -t cashflow-web:latest -f Dockerfile .
```

### 2.2 Orchestrating with Docker Compose
To run the full stack locally or on a single virtual host:
```bash
docker compose up -d --build
```
This starts:
- `cashflow-web` on port `3000`
- `cashflow-ai-service` on port `8001`
- Internal bridge network `cashflow-net` with health checks.

---

## 3. Health Checks & Observability Endpoints

The application server exposes dedicated health endpoints:
- `GET /health`: Comprehensive subsystem health (DB latency, AI status, memory usage).
- `GET /ready`: Readiness probe for Kubernetes / Cloud Run / ECS traffic routing.
- `GET /version`: Semantic version, environment mode, and Git commit identifier.

### Sample `/health` Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptimeSeconds": 1840,
  "timestamp": "2026-09-23T06:15:00.000Z",
  "checks": {
    "database": {
      "status": "healthy",
      "latencyMs": 1.2
    },
    "aiService": {
      "status": "healthy",
      "mode": "deterministic-fallback-enabled"
    },
    "memory": {
      "heapUsedMb": 42.15,
      "heapTotalMb": 68.5,
      "rssMb": 98.4
    }
  }
}
```

---

## 4. Production Release Checklist
- [x] Run `npm run lint` and verify zero TypeScript compiler errors.
- [x] Run `npm test` and verify all 85 unit and integration tests pass.
- [x] Run `npm run build` to compile optimized production assets.
- [x] Ensure `SUPABASE_SERVICE_ROLE_KEY` is restricted strictly to the backend environment and never exposed in client bundles.
- [x] Verify rate limiting and OWASP security headers are active.
- [x] Confirm PostgreSQL Row Level Security (RLS) policies are active on all tenant tables.
