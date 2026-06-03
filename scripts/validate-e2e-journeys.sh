#!/usr/bin/env bash
# =============================================================================
# validate-e2e-journeys.sh — End-to-End Journey Validation
# =============================================================================
# Validates each user journey (SOC, Threat, Pentest) via API calls.
#
# Prerequisites:
#   - Backend running on localhost:4000
#   - Valid API key in X-API-Key header
#
# Usage:
#   API_KEY=your-key bash scripts/validate-e2e-journeys.sh
# =============================================================================

set -uo pipefail

API_BASE="${API_BASE:-http://localhost:4000}"
API_KEY="${API_KEY:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; ((PASS_COUNT++)); }
fail() { echo -e "${RED}✗ FAIL${NC}: $1"; ((FAIL_COUNT++)); }
info() { echo -e "${YELLOW}ℹ INFO${NC}: $1"; }

# Check API key
if [ -z "$API_KEY" ]; then
    echo "ERROR: Set API_KEY environment variable"
    echo "Usage: API_KEY=your-key bash scripts/validate-e2e-journeys.sh"
    exit 1
fi

curl_api() {
    local method=$1
    local path=$2
    local data=${3:-}

    if [ -n "$data" ]; then
        curl -s -X "$method" "${API_BASE}${path}" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "$data"
    else
        curl -s -X "$method" "${API_BASE}${path}" \
            -H "X-API-Key: $API_KEY"
    fi
}

echo "============================================="
echo " E2E Journey Validation"
echo "============================================="
echo ""

# -------------------------------------------
# 0. Health Check
# -------------------------------------------
echo "--- 0. Health Check ---"

HEALTH=$(curl_api GET "/health")
if echo "$HEALTH" | grep -q "ok\|healthy"; then
    pass "Backend is healthy"
else
    fail "Backend health check failed"
    echo "Response: $HEALTH"
fi

echo ""

# -------------------------------------------
# 1. SOC Analysis Journey
# -------------------------------------------
echo "--- 1. SOC Analysis Journey ---"

# 1.1 Import alert
ALERT_IMPORT=$(curl_api POST "/api/alerts/import" '{
    "source": "e2e-test",
    "title": "E2E Test Alert - SQL Injection",
    "severity": "high",
    "rawContent": "{\"test\": true, \"source_ip\": \"10.0.0.1\"}"
}')

if echo "$ALERT_IMPORT" | grep -q "id\|alert"; then
    pass "1.1 Alert imported"
    ALERT_ID=$(echo "$ALERT_IMPORT" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
else
    fail "1.1 Alert import failed"
fi

# 1.2 List alerts
ALERTS=$(curl_api GET "/api/alerts")
if echo "$ALERTS" | grep -q "alerts\|data"; then
    pass "1.2 Alerts list retrieved"
else
    fail "1.2 Alerts list failed"
fi

echo ""

# -------------------------------------------
# 2. Threat Investigation Journey
# -------------------------------------------
echo "--- 2. Threat Investigation Journey ---"

# 2.1 Investigate IP
THREAT_IP=$(curl_api POST "/api/threat/investigate" '{
    "type": "ip",
    "value": "8.8.8.8"
}')

if echo "$THREAT_IP" | grep -q "session\|id"; then
    pass "2.1 IP investigation started"
else
    fail "2.1 IP investigation failed"
fi

# 2.2 Investigate domain
THREAT_DOMAIN=$(curl_api POST "/api/threat/investigate" '{
    "type": "domain",
    "value": "example.com"
}')

if echo "$THREAT_DOMAIN" | grep -q "session\|id"; then
    pass "2.2 Domain investigation started"
else
    fail "2.2 Domain investigation failed"
fi

echo ""

# -------------------------------------------
# 3. Pentest Assist Journey
# -------------------------------------------
echo "--- 3. Pentest Assist Journey ---"

# 3.1 Start pentest session
PENTEST=$(curl_api POST "/api/pentest/assist" '{
    "target": "127.0.0.1"
}')

if echo "$PENTEST" | grep -q "session\|id"; then
    pass "3.1 Pentest session started"
    SESSION_ID=$(echo "$PENTEST" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
    fail "3.1 Pentest session failed"
fi

echo ""

# -------------------------------------------
# 4. BGP Journey
# -------------------------------------------
echo "--- 4. BGP Journey ---"

# 4.1 Query BGP
BGP_QUERY=$(curl_api GET "/api/bgp/query?prefix=8.8.8.0/24")
if echo "$BGP_QUERY" | grep -q "data\|pagination"; then
    pass "4.1 BGP query succeeded"
else
    fail "4.1 BGP query failed"
fi

# 4.2 Get BGP stats
BGP_STATS=$(curl_api GET "/api/bgp/stats")
if echo "$BGP_STATS" | grep -q "totalUpdates"; then
    pass "4.2 BGP stats retrieved"
else
    fail "4.2 BGP stats failed"
fi

# 4.3 Get BGP metrics
BGP_METRICS=$(curl_api GET "/api/bgp/metrics")
if echo "$BGP_METRICS" | grep -q "totalUpdates\|oldestTimestamp"; then
    pass "4.3 BGP metrics retrieved"
else
    fail "4.3 BGP metrics failed"
fi

echo ""

# -------------------------------------------
# 5. Dashboard Journey
# -------------------------------------------
echo "--- 5. Dashboard Journey ---"

# 5.1 Get dashboard stats
DASHBOARD=$(curl_api GET "/api/dashboard/stats")
if echo "$DASHBOARD" | grep -q "metrics\|alerts"; then
    pass "5.1 Dashboard stats retrieved"
else
    fail "5.1 Dashboard stats failed"
fi

# 5.2 Get timeline
TIMELINE=$(curl_api GET "/api/dashboard/stats/timeline")
if echo "$TIMELINE" | grep -q "timeline\|data"; then
    pass "5.2 Dashboard timeline retrieved"
else
    fail "5.2 Dashboard timeline failed"
fi

echo ""

# -------------------------------------------
# 6. Admin Journey
# -------------------------------------------
echo "--- 6. Admin Journey ---"

# 6.1 List tool templates
TEMPLATES=$(curl_api GET "/api/tools/templates")
if echo "$TEMPLATES" | grep -q "templates\|data"; then
    pass "6.1 Tool templates listed"
else
    fail "6.1 Tool templates failed"
fi

# 6.2 Get audit log
AUDIT=$(curl_api GET "/api/admin/audit-log")
if echo "$AUDIT" | grep -q "logs"; then
    pass "6.2 Audit log retrieved"
else
    fail "6.2 Audit log failed"
fi

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
