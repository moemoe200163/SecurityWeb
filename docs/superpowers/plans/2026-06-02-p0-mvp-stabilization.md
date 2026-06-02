# P0 MVP Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the MVP codebase by cleaning up package configuration, fixing environment-dependent API routing, and establishing consistent test infrastructure.

**Architecture:** This plan addresses four concrete issues: (1) missing test script in backend, (2) empty root package.json causing workspace inference warnings, (3) hardcoded API URL in Next.js config, and (4) ensuring all changes are properly committed as a single stable unit.

**Tech Stack:** Node.js, TypeScript, Next.js, Fastify, Prisma, Vitest

---

## Current State Analysis

| Issue | File | Status |
|-------|------|--------|
| Missing test script | `backend/package.json:6` | No `test` script defined |
| Empty root package | `./package.json` | 0 bytes, causes npm workspace inference |
| Empty lockfile | `./package-lock.json` | 0 bytes, no actual lock |
| Hardcoded API URL | `frontend/next.config.ts:9` | `http://backend:4000` only works in Docker |

---

## Task 1: Add test script to backend/package.json

**Files:**
- Modify: `backend/package.json:6-13`

- [ ] **Step 1: Read current backend package.json**

Verify current scripts section:
```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:push": "prisma db push",
  "db:seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 2: Add test script**

Edit `backend/package.json` to add test script after line 12:

```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "test": "vitest run tests/api.test.ts",
  "test:watch": "vitest",
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:push": "prisma db push",
  "db:seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 3: Verify test script works**

Run from backend directory:
```bash
cd /Users/user/Code/SecurityWeb/backend && npm test
```

Expected: Test runs and fails with "Backend not reachable" (expected - backend must be running)

- [ ] **Step 4: Commit**

```bash
git add backend/package.json
git commit -m "fix: add test script to backend package.json"
```

---

## Task 2: Clean up root package.json and package-lock.json

**Files:**
- Delete: `./package.json`
- Delete: `./package-lock.json`

- [ ] **Step 1: Verify root package.json is empty**

```bash
cat /Users/user/Code/SecurityWeb/package.json
```

Expected: Empty output (file is 0 bytes)

- [ ] **Step 2: Verify root package-lock.json is empty**

```bash
cat /Users/user/Code/SecurityWeb/package-lock.json
```

Expected: Empty output (file is 0 bytes)

- [ ] **Step 3: Remove empty files**

```bash
rm /Users/user/Code/SecurityWeb/package.json /Users/user/Code/SecurityWeb/package-lock.json
```

- [ ] **Step 4: Verify removal**

```bash
ls -la /Users/user/Code/SecurityWeb/package*.json 2>&1 || echo "Files removed successfully"
```

Expected: "Files removed successfully"

- [ ] **Step 5: Verify frontend build still works**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npm run build
```

Expected: Build completes without "workspace root" warnings

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove empty root package files to fix workspace inference"
```

---

## Task 3: Fix frontend/next.config.ts API rewrite for environment flexibility

**Files:**
- Modify: `frontend/next.config.ts`

- [ ] **Step 1: Read current config**

Current hardcoded value at line 9:
```typescript
destination: 'http://backend:4000/api/:path*',
```

- [ ] **Step 2: Update config to use environment variable**

Replace entire file content:

```typescript
import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 3: Verify the change**

```bash
cat /Users/user/Code/SecurityWeb/frontend/next.config.ts
```

Expected: Config uses `process.env.BACKEND_URL` with fallback

- [ ] **Step 4: Test local dev mode**

```bash
cd /Users/user/Code/SecurityWeb/frontend && timeout 10 npm run dev 2>&1 || true
```

Expected: No errors about backend URL resolution

- [ ] **Step 5: Commit**

```bash
git add frontend/next.config.ts
git commit -m "fix: make API backend URL configurable via environment variable"
```

---

## Task 4: Create final stabilization commit

**Files:**
- All changes from Tasks 1-3

- [ ] **Step 1: Verify all changes are committed**

```bash
git status
git log --oneline -5
```

Expected: Working tree clean, commits visible

- [ ] **Step 2: Create stabilization tag**

```bash
git tag -a mvp-stabilization -v "MVP stabilization point: clean package config, test scripts, flexible API routing"
```

- [ ] **Step 3: Verify tag**

```bash
git tag -l "mvp*"
git show mvp-stabilization
```

Expected: Tag exists with annotation

- [ ] **Step 4: Final verification**

Run full test suite to ensure nothing broke:
```bash
cd /Users/user/Code/SecurityWeb/backend && npm test
```

Expected: Tests run (may fail if backend not running, but script itself works)

---

## Verification Checklist

After completing all tasks:

- [ ] `backend/npm test` runs without "command not found" error
- [ ] Root directory has no package.json or package-lock.json
- [ ] `frontend/next.config.ts` uses environment variable for backend URL
- [ ] All changes are committed with descriptive messages
- [ ] `git status` shows clean working tree
- [ ] No Docker-specific hardcoded URLs remain in source code

---

## Notes

**Environment Variables for Deployment:**

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_URL` | `http://localhost:4000` | Backend API URL for Next.js rewrites |

**Docker Compose Updates Needed (separate task):**

If using Docker, ensure `docker-compose.yml` sets:
```yaml
environment:
  - BACKEND_URL=http://backend:4000
```

And `docker-compose.dev.yml` exposes the correct ports.
