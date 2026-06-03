#!/usr/bin/env bash
# =============================================================================
# validate-compose-safe.sh — Docker Compose Secrets-Safe Validation
# =============================================================================
# Validates docker-compose.yml structure using ONLY safe subcommands.
# NEVER captures or processes the full `docker compose config` output.
#
# Usage:
#   bash scripts/validate-compose-safe.sh
#
# Safe commands used:
#   - docker compose config --services  (lists service names only)
#   - docker compose config --profiles (lists profile names only)
#   - grep on docker-compose.yml directly (YAML source, not expanded config)
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
# =============================================================================

set -uo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0

pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASS_COUNT++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAIL_COUNT++))
}

info() {
    echo -e "${YELLOW}ℹ INFO${NC}: $1"
}

echo "============================================="
echo " Docker Compose Secrets-Safe Validation"
echo "============================================="
echo ""

# -------------------------------------------
# 1. Denylist check — scan YAML source for hardcoded secrets
# -------------------------------------------
echo "--- Checking for hardcoded secrets in YAML source ---"

# Patterns that indicate hardcoded secrets (NOT environment variable references)
# We exclude lines with ${VAR} syntax as those are safe references
HARDCODED_SECRET_PATTERNS=(
    "POSTGRES_PASSWORD=securityweb123"
    "POSTGRES_PASSWORD=password"
    "MINIMAX_API_KEY=[a-zA-Z0-9]"
    "OTX_API_KEY=[a-zA-Z0-9]"
    "ABUSEIPDB_API_KEY=[a-zA-Z0-9]"
)

DENYLIST_FOUND=0
for pattern in "${HARDCODED_SECRET_PATTERNS[@]}"; do
    # Check YAML source files, exclude lines with ${VAR} or ${VAR:-default} references
    if grep -E "$pattern" docker-compose*.yml 2>/dev/null | grep -v '\${' | grep -v '^\s*#'; then
        fail "Hardcoded secret pattern: $pattern"
        ((DENYLIST_FOUND++))
    fi
done

if [ "$DENYLIST_FOUND" -eq 0 ]; then
    pass "No hardcoded secrets in YAML source files"
fi

echo ""

# -------------------------------------------
# 2. Service structure validation (safe subcommand)
# -------------------------------------------
echo "--- Validating service structure ---"

# --services only outputs service names, no secrets
SERVICES=$(docker compose config --services 2>/dev/null)

# Required core services
for svc in frontend backend db; do
    if echo "$SERVICES" | grep -q "^${svc}$"; then
        pass "Service '$svc' exists"
    else
        fail "Service '$svc' missing"
    fi
done

# Profile-gated services should NOT be in default list
for svc in sandbox bgp-consumer nginx; do
    if echo "$SERVICES" | grep -q "^${svc}$"; then
        fail "Profile-gated service '$svc' in default list (should require --profile)"
    else
        pass "Profile-gated service '$svc' correctly excluded from default list"
    fi
done

echo ""

# -------------------------------------------
# 3. Profile validation (safe subcommand)
# -------------------------------------------
echo "--- Validating profiles ---"

# --profiles only outputs profile names, no secrets
PROFILES=$(docker compose config --profiles 2>/dev/null)

for profile in tools bgp edge; do
    if echo "$PROFILES" | grep -q "^${profile}$"; then
        pass "Profile '$profile' exists"
    else
        fail "Profile '$profile' missing"
    fi
done

echo ""

# -------------------------------------------
# 4. Sandbox validation (grep YAML source)
# -------------------------------------------
echo "--- Validating sandbox service ---"

# Check sandbox has NET_ADMIN capability in YAML source
if grep -A 30 "sandbox:" docker-compose.yml | grep -q "NET_ADMIN"; then
    pass "Sandbox has NET_ADMIN capability"
else
    fail "Sandbox missing NET_ADMIN capability"
fi

# Check sandbox is in tools profile in YAML source
if grep -B 5 -A 30 "sandbox:" docker-compose.yml | grep -q "tools"; then
    pass "Sandbox is in 'tools' profile"
else
    fail "Sandbox not in 'tools' profile"
fi

echo ""

# -------------------------------------------
# 5. BGP consumer validation (grep YAML source)
# -------------------------------------------
echo "--- Validating bgp-consumer service ---"

if grep -B 5 -A 30 "bgp-consumer:" docker-compose.yml | grep -q "bgp"; then
    pass "bgp-consumer is in 'bgp' profile"
else
    fail "bgp-consumer not in 'bgp' profile"
fi

echo ""

# -------------------------------------------
# 6. Port exposure check (grep YAML source)
# -------------------------------------------
echo "--- Checking port exposure ---"

# Main compose should NOT expose backend/db ports to host
if grep -A 50 "^  backend:" docker-compose.yml | grep -m 1 -q "ports:"; then
    fail "Main compose exposes backend ports (should only be in dev override)"
else
    pass "Main compose does not expose backend ports"
fi

if grep -A 50 "^  db:" docker-compose.yml | grep -m 1 -q "ports:"; then
    fail "Main compose exposes db ports (should only be in dev override)"
else
    pass "Main compose does not expose db ports"
fi

echo ""

# -------------------------------------------
# 7. Dev override validation
# -------------------------------------------
echo "--- Checking dev override ---"

if [ -f "docker-compose.dev.yml" ]; then
    # Dev override should expose ports
    if grep -q "ports:" docker-compose.dev.yml; then
        pass "Dev override exposes ports (expected)"
    else
        fail "Dev override missing port exposures"
    fi
else
    info "docker-compose.dev.yml not found (skipped)"
fi

echo ""

# -------------------------------------------
# 8. Environment variable usage validation
# -------------------------------------------
echo "--- Validating environment variable references ---"

# Check that secrets use ${VAR} syntax (not hardcoded)
VARS_TO_CHECK=(
    "POSTGRES_PASSWORD"
    "DATABASE_URL"
    "MINIMAX_API_KEY"
)

for var in "${VARS_TO_CHECK[@]}"; do
    # Check if variable is used as ${VAR} in YAML
    if grep -q "\${${var}}" docker-compose*.yml 2>/dev/null; then
        pass "Variable '$var' uses environment reference syntax"
    else
        info "Variable '$var' not found as \${$var} (may use other pattern)"
    fi
done

echo ""

# -------------------------------------------
# Summary
# -------------------------------------------
echo "============================================="
echo " Results: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"
echo "============================================="

if [ "$FAIL_COUNT" -gt 0 ]; then
    echo ""
    echo -e "${RED}VALIDATION FAILED${NC}"
    exit 1
else
    echo ""
    echo -e "${GREEN}ALL CHECKS PASSED${NC}"
    exit 0
fi
