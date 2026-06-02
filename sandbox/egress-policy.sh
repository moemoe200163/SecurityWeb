#!/bin/bash
# Sandbox egress policy — restrict outbound traffic to authorized scope.
# Run inside the sandbox container at startup.
#
# Configuration sources (precedence: file > env > lockdown default):
#   1. /etc/sandbox/egress.conf (JSON)
#   2. $EGRESS_ALLOW env var (comma-separated cidr:port/proto)
#   3. Lock-down: loopback + ESTABLISHED,RELATED + DNS to /etc/resolv.conf nameservers
#
# Test mode: DRY_RUN=1 prints iptables rules to stdout instead of applying.

set -euo pipefail

EGRESS_CONF="${EGRESS_CONF:-/etc/sandbox/egress.conf}"
EGRESS_ALLOW_ENV="${EGRESS_ALLOW:-}"
DRY_RUN="${DRY_RUN:-0}"
RESOLV_CONF="${RESOLV_CONF:-/etc/resolv.conf}"

# Output buffer of iptables command lines.
RULES=()

log() { echo "[egress-policy] $*" >&2; }
die() { log "ERROR: $*"; exit 1; }

# Validate IPv4 CIDR; reject 0.0.0.0/0.
validate_cidr() {
  local cidr="$1"
  if ! echo "$cidr" | grep -qE '^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/(3[0-2]|[12]?[0-9])$'; then
    die "Invalid CIDR: $cidr"
  fi
  if [ "$cidr" = "0.0.0.0/0" ]; then
    die "0.0.0.0/0 is forbidden in egress whitelist"
  fi
}

validate_port() {
  local port="$1"
  if ! echo "$port" | grep -qE '^[0-9]+$'; then
    die "Invalid port: $port"
  fi
  if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
    die "Port out of range: $port"
  fi
}

# Parse /etc/resolv.conf nameservers
parse_resolv_nameservers() {
  if [ ! -f "$RESOLV_CONF" ]; then
    return
  fi
  grep -E '^nameserver ' "$RESOLV_CONF" 2>/dev/null | awk '{print $2}' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || true
}

# Parse egress.conf into ALLOW_RULES (newline-separated "cidr|port|proto") and ALLOW_ICMP flag.
parse_file_config() {
  local conf="$1"
  if ! command -v jq >/dev/null 2>&1; then
    die "jq is required to parse JSON config but is not installed"
  fi
  if ! jq -e . "$conf" >/dev/null 2>&1; then
    die "Invalid JSON in $conf"
  fi

  local rules_count
  rules_count=$(jq '.allow | length' "$conf")
  local i
  for ((i = 0; i < rules_count; i++)); do
    local cidr proto
    cidr=$(jq -r ".allow[$i].cidr" "$conf")
    proto=$(jq -r ".allow[$i].proto" "$conf")
    validate_cidr "$cidr"
    case "$proto" in
      tcp|udp)
        local ports
        ports=$(jq -r ".allow[$i].ports | join(\" \")" "$conf")
        for p in $ports; do
          validate_port "$p"
          echo "${cidr}|${p}|${proto}"
        done
        ;;
      icmp)
        echo "${cidr}||icmp"
        ;;
      *)
        die "Invalid proto in $conf: $proto (must be tcp/udp/icmp)"
        ;;
    esac
  done

  local icmp
  icmp=$(jq -r '.allowIcmp // false' "$conf")
  [ "$icmp" = "true" ] && echo "__ALLOW_ICMP__"
}

# Parse EGRESS_ALLOW env into the same shape
# Format: comma-separated cidr:port/proto (e.g. "10.0.0.0/8:443/tcp,8.8.8.8/32:53/udp")
parse_env_config() {
  local env="$1"
  IFS=',' read -ra parts <<< "$env"
  for entry in "${parts[@]}"; do
    local cidr rest port proto
    cidr="${entry%%:*}"
    rest="${entry#*:}"
    port="${rest%%/*}"
    proto="${rest#*/}"
    validate_cidr "$cidr"
    case "$proto" in
      tcp|udp)
        validate_port "$port"
        echo "${cidr}|${port}|${proto}"
        ;;
      icmp)
        echo "${cidr}||icmp"
        ;;
      *)
        die "Invalid proto in EGRESS_ALLOW: $proto"
        ;;
    esac
  done
}

# Lock-down default: allow only loopback + ESTABLISHED + DNS to /etc/resolv.conf
parse_lockdown_default() {
  log "No config found; applying lock-down with DNS to /etc/resolv.conf nameservers"
  while IFS= read -r ns; do
    [ -z "$ns" ] && continue
    echo "${ns}/32|53|udp"
    echo "${ns}/32|53|tcp"
  done < <(parse_resolv_nameservers)
}

# Resolve which config to use; populate ALLOW_LINES array.
resolve_config() {
  ALLOW_LINES=()
  if [ -f "$EGRESS_CONF" ]; then
    log "Reading config from $EGRESS_CONF"
    while IFS= read -r line; do
      [ -n "$line" ] && ALLOW_LINES+=("$line")
    done < <(parse_file_config "$EGRESS_CONF")
    ALLOW_ICMP="false"
    for line in "${ALLOW_LINES[@]}"; do
      [ "$line" = "__ALLOW_ICMP__" ] && ALLOW_ICMP="true"
    done
  elif [ -n "$EGRESS_ALLOW_ENV" ]; then
    log "Reading config from EGRESS_ALLOW env"
    while IFS= read -r line; do
      [ -n "$line" ] && ALLOW_LINES+=("$line")
    done < <(parse_env_config "$EGRESS_ALLOW_ENV")
    ALLOW_ICMP="false"
  else
    while IFS= read -r line; do
      [ -n "$line" ] && ALLOW_LINES+=("$line")
    done < <(parse_lockdown_default)
    ALLOW_ICMP="false"
  fi
}

# Build iptables command lines.
emit_rules() {
  RULES=(
    "iptables -F OUTPUT"
    "iptables -A OUTPUT -o lo -j ACCEPT"
    "iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT"
  )
  for line in "${ALLOW_LINES[@]}"; do
    [ "$line" = "__ALLOW_ICMP__" ] && continue
    IFS='|' read -r cidr port proto <<< "$line"
    if [ "$proto" = "icmp" ]; then
      RULES+=("iptables -A OUTPUT -d ${cidr} -p icmp -j ACCEPT")
    else
      RULES+=("iptables -A OUTPUT -d ${cidr} -p ${proto} --dport ${port} -j ACCEPT")
    fi
  done
  if [ "$ALLOW_ICMP" = "true" ]; then
    RULES+=("iptables -A OUTPUT -p icmp -j ACCEPT")
  fi
  RULES+=(
    "iptables -A OUTPUT -j LOG --log-prefix \"[egress-deny] \" --log-level 4"
    "iptables -A OUTPUT -j DROP"
  )
}

apply_rules() {
  emit_rules
  if [ "$DRY_RUN" = "1" ]; then
    printf '%s\n' "${RULES[@]}"
    return
  fi
  if ! command -v iptables >/dev/null 2>&1; then
    die "iptables not found"
  fi
  for r in "${RULES[@]}"; do
    eval "$r"
  done
  iptables -L OUTPUT -v --line-numbers >&2 || true
}

resolve_config
apply_rules
log "Egress rules applied (allow=${#ALLOW_LINES[@]} lines, allowIcmp=$ALLOW_ICMP)"

# Hand off to CMD (e.g. tail -f /dev/null)
exec "$@"
