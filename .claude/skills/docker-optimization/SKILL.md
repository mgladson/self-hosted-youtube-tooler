---
name: docker-optimization
description: "Docker optimization patterns: multi-stage build optimization, security hardening (distroless/non-root/CVE scanning), Docker Compose for dev/test/prod, and layer caching strategies. Sub-commands: /docker-optimization:build, :security, :compose, :layer-cache. Use when optimizing Dockerfiles, hardening container security, or designing Compose workflows."
---

# Docker Optimization

You are executing the `/docker-optimization` skill. You apply Docker best practices for builds, security, Compose, and layer caching.

Parse the sub-command from the user's invocation:
- `/docker-optimization` → show **menu** and wait for selection
- `/docker-optimization:build` → **Multi-Stage Builds**
- `/docker-optimization:security` → **Security Hardening**
- `/docker-optimization:compose` → **Docker Compose**
- `/docker-optimization:layer-cache` → **Layer Caching**

---

## Menu (no sub-command)

```
Docker Optimization — Choose a topic:

1. build       — Multi-stage builds, base image selection, size reduction
2. security    — Distroless/scratch, non-root, CVE scanning, secrets
3. compose     — Dev/test/prod patterns, networking, volumes, health checks
4. layer-cache — Layer ordering, .dockerignore, BuildKit cache mounts
```

---

## Multi-Stage Builds (`:build`)

### Python
```dockerfile
# Stage 1: Build dependencies
FROM python:3.12-slim AS builder
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-editable

# Stage 2: Runtime (minimal image)
FROM python:3.12-slim AS runtime
WORKDIR /app
RUN groupadd -r app && useradd -r -g app -d /app app
COPY --from=builder /app/.venv /app/.venv
COPY src/ ./src/
ENV PATH="/app/.venv/bin:$PATH"
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Node.js
```dockerfile
# Stage 1: Install dependencies
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Build
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Runtime (distroless)
FROM gcr.io/distroless/nodejs22-debian12
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["dist/server.js"]
```

### Go
```dockerfile
FROM golang:1.22 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

# Scratch: smallest possible image (~5MB)
FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /server /server
EXPOSE 8080
ENTRYPOINT ["/server"]
```

---

## Security Hardening (`:security`)

### Non-Root User
```dockerfile
# Create non-root user in every Dockerfile
RUN groupadd -r app && useradd -r -g app -s /sbin/nologin app
# ... copy files ...
RUN chown -R app:app /app
USER app
```

### Base Image Selection
```
| Image               | Size    | Use Case                        | CVE Surface |
|---------------------|---------|----------------------------------|-------------|
| scratch             | 0 MB    | Static Go binaries               | Minimal     |
| distroless          | ~20 MB  | Go, Node, Java, Python           | Very low    |
| alpine              | ~5 MB   | General purpose, musl libc       | Low         |
| *-slim              | ~80 MB  | Python, Node (needs glibc)       | Medium      |
| ubuntu/debian       | ~130 MB | Need apt packages                | Higher      |
```

### CVE Scanning
```bash
# Scan with Trivy (CI/CD integration)
trivy image --severity HIGH,CRITICAL myapp:latest
trivy image --exit-code 1 --severity CRITICAL myapp:latest  # Fail CI on critical

# Scan with Docker Scout
docker scout cves myapp:latest
docker scout recommendations myapp:latest
```

### Secrets Management
```dockerfile
# ❌ NEVER: secrets in build args or ENV
ARG DB_PASSWORD  # Visible in image history!

# ✅ BuildKit secrets (not persisted in image layers)
RUN --mount=type=secret,id=db_password \
    cat /run/secrets/db_password | setup-db

# Build: docker build --secret id=db_password,src=./db_password.txt .
```

---

## Docker Compose (`:compose`)

### Development Compose
```yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      target: builder  # Use build stage for hot-reload
    volumes:
      - .:/app
      - /app/node_modules  # Anonymous volume: don't overwrite
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://app:secret@db:5432/myapp
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: myapp
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d myapp"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

### Production Override
```yaml
# docker-compose.prod.yml
services:
  app:
    build:
      context: .
      target: runtime  # Use final stage
    volumes: []  # No source mounts in production
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## Layer Caching (`:layer-cache`)

### Optimal Layer Ordering
```dockerfile
# Order: least-changing → most-changing
# 1. Base image (changes rarely)
FROM node:22-slim

# 2. System dependencies (changes rarely)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl && rm -rf /var/lib/apt/lists/*

# 3. Dependency files (changes occasionally)
COPY package.json package-lock.json ./
RUN npm ci

# 4. Application code (changes frequently)
COPY . .
RUN npm run build
```

### .dockerignore
```
# .dockerignore — reduce build context
.git
.github
node_modules
dist
*.md
.env*
.vscode
__pycache__
*.pyc
.pytest_cache
coverage
.nyc_output
```

### BuildKit Cache Mounts
```dockerfile
# Cache pip downloads across builds
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# Cache npm downloads across builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Cache Go modules across builds
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -o /server ./cmd/server
```

---

## Hard Constraints
- Never run containers as root in production
- Never store secrets in image layers (use BuildKit secrets or runtime env)
- Always pin base image versions (node:22-slim, not node:latest)
- Always include .dockerignore to minimize build context
- Always include HEALTHCHECK in production Dockerfiles
- Multi-stage builds are mandatory — never ship build tools in production images
- Scan for CVEs in CI/CD pipeline — fail builds on CRITICAL vulnerabilities
