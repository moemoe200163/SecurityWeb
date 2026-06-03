# Operations Manual — SecurityWeb

## Quick Start

### 1. Database Setup

```bash
cd backend
cp .env.example .env  # Edit DATABASE_URL if needed
npx prisma db push     # Create tables
npx prisma db seed     # Seed demo data + admin user
```

### 2. Get Admin API Key

After seeding, the admin API key is printed to console. If lost:

```bash
cd backend
npx prisma db execute --stdin <<'SQL'
SELECT id, "keyPrefix" FROM "User" WHERE role = 'admin';
SQL
```

The API key format is: `{prefix}-{64 hex chars}`

### 3. Start Development

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

### 4. Start with Docker

```bash
# Core services (frontend + backend + db)
docker compose up --build

# With sandbox tools
docker compose --profile tools up --build

# With BGP consumer
docker compose --profile bgp up --build

# With nginx edge
docker compose --profile edge up --build
```

## API Key Authentication

All protected endpoints require `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key" http://localhost:4000/api/alerts
```

### Self-Service Key Management

```bash
# Get current key info
curl -H "X-API-Key: your-key" http://localhost:4000/api/me/api-key

# Rotate key (returns new key, old key revoked immediately)
curl -X POST -H "X-API-Key: your-key" http://localhost:4000/api/me/api-key/rotate
```

## User Journeys

### SOC Analysis Journey

1. **Upload Alert** → `POST /api/alerts/import`
2. **Start Investigation** → `POST /api/soc/analyze` (creates session)
3. **Chat with AI** → `POST /api/soc/sessions/:id/messages`
4. **View Report** → `GET /api/dashboard/report/:alertId`

### Threat Investigation Journey

1. **Submit IOC** → `POST /api/threat/investigate` (IP/Domain/Hash)
2. **View Results** → `GET /api/threat/sessions/:id`
3. **Query BGP** → `GET /api/bgp/query?prefix=192.168.0.0/24`
4. **WHOIS Lookup** → `GET /api/bgp/whois/:asn`

### Pentest Assist Journey

1. **Start Pentest** → `POST /api/pentest/assist`
2. **Select Tool** → Frontend UI (nmap, nikto, sqlmap, etc.)
3. **Execute Tool** → `POST /api/tools/execute` (sandboxed)
4. **Add Evidence** → `POST /api/sessions/:sessionId/evidence`

## Docker Profiles

| Profile | Services | Use Case |
|---------|----------|----------|
| (default) | frontend, backend, db | Core app |
| `tools` | + sandbox (Kali) | Security tools |
| `bgp` | + bgp-consumer | BGP monitoring |
| `edge` | + nginx | Production edge |

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker compose exec db pg_isready -U securityweb

# Reset database
docker compose down -v  # Removes volumes!
docker compose up -d db
cd backend && npx prisma db push && npx prisma db seed
```

### API Key Issues

```bash
# Test API key
curl -I -H "X-API-Key: your-key" http://localhost:4000/api/me

# Should return 200, not 401
```

### Sandbox Tools Not Working

```bash
# Ensure sandbox profile is running
docker compose --profile tools ps

# Check sandbox logs
docker compose logs sandbox
```
