# Docker Profiles — SecurityWeb

## Profile Overview

| Profile | Services | Resources | When to Use |
|---------|----------|-----------|-------------|
| (default) | frontend, backend, db | ~7GB RAM | Development, testing |
| `tools` | + sandbox | +2GB RAM | Running security tools |
| `bgp` | + bgp-consumer | +512MB RAM | BGP monitoring |
| `edge` | + nginx | +512MB RAM | Production edge |

## Default Profile

Core application stack without any optional services.

```bash
docker compose up --build
```

**Services:**
- `frontend` — Next.js app (port 3000 via dev override)
- `backend` — Fastify API (port 4000 via dev override)
- `db` — PostgreSQL 15

**Verify:**
```bash
docker compose ps
# Should show: frontend, backend, db
```

## Tools Profile

Adds Kali Linux sandbox for running security tools (nmap, nikto, sqlmap, etc.).

```bash
docker compose --profile tools up --build
```

**Additional Service:**
- `sandbox` — Kali Linux with security tools

**Security Notes:**
- Requires `seccomp=unconfined` and `NET_ADMIN` capabilities
- Only accessible from backend via internal network
- Never expose sandbox ports to host

**Verify:**
```bash
docker compose --profile tools ps
# Should show: frontend, backend, db, sandbox

# Test tool execution
curl -X POST http://localhost:4000/api/tools/execute \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"templateId": "nmap_basic", "params": {"target": "127.0.0.1"}}'
```

## BGP Profile

Adds BGP consumer for real-time BGP update monitoring from RIPE RIS Live.

```bash
docker compose --profile bgp up --build
```

**Additional Service:**
- `bgp-consumer` — Python WebSocket client

**Verify:**
```bash
docker compose --profile bgp ps
# Should show: frontend, backend, db, bgp-consumer

# Check BGP metrics
curl http://localhost:4000/api/bgp/metrics \
  -H "X-API-Key: your-key"
```

## Edge Profile

Adds nginx reverse proxy with WAF for production deployment.

```bash
docker compose --profile edge up --build
```

**Additional Service:**
- `nginx` — OpenResty with WAF rules

**Ports:**
- 80 → HTTP
- 443 → HTTPS

**Verify:**
```bash
docker compose --profile edge ps
# Should show: frontend, backend, db, nginx

curl http://localhost/health
```

## Combining Profiles

```bash
# Tools + BGP
docker compose --profile tools --profile bgp up --build

# Everything
docker compose --profile tools --profile bgp --profile edge up --build
```

## Resource Limits

| Service | CPU Limit | Memory Limit |
|---------|-----------|--------------|
| frontend | 1.0 | 3GB |
| backend | 2.0 | 3GB |
| db | 0.75 | 768MB |
| sandbox | 1.0 | 2GB |
| bgp-consumer | 0.5 | 512MB |
| nginx | 0.5 | 512MB |

## Dev Override

For local development, use `docker-compose.dev.yml` to expose ports:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

**Exposed Ports:**
- Frontend: 3000
- Backend: 4000
- PostgreSQL: 5432

## Validation

Run the secrets-safe validation script:

```bash
bash scripts/validate-compose-safe.sh
# Should pass 18/18 checks
```
