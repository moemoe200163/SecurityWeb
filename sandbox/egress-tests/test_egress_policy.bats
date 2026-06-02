#!/usr/bin/env bats
# Egress policy shell tests
# Run from repo root: bats sandbox/egress-tests/test_egress_policy.bats
# Or use the runner script: bash sandbox/egress-tests/run_bats.sh

setup() {
  SCRIPT="${BATS_TEST_DIRNAME}/../egress-policy.sh"
  [ -f "$SCRIPT" ] || skip "egress-policy.sh not found"
}

@test "lock-down default does not contain broad NEW tcp ACCEPT" {
  run env -i PATH="$PATH" DRY_RUN=1 EGRESS_CONF=/nonexistent EGRESS_ALLOW="" bash "$SCRIPT"
  [ "$status" -eq 0 ]
  ! echo "$output" | grep -E -- "-p tcp -m state --state NEW -j ACCEPT"
}

@test "lock-down default ends with DROP" {
  run env -i PATH="$PATH" DRY_RUN=1 EGRESS_CONF=/nonexistent EGRESS_ALLOW="" bash "$SCRIPT"
  [ "$status" -eq 0 ]
  # Last iptables rule should be DROP (filter out log messages)
  last_rule=$(echo "$output" | grep '^iptables' | tail -1)
  echo "$last_rule" | grep -q -- "-j DROP"
}

@test "lock-down default includes ESTABLISHED,RELATED" {
  run env -i PATH="$PATH" DRY_RUN=1 EGRESS_CONF=/nonexistent EGRESS_ALLOW="" bash "$SCRIPT"
  [ "$status" -eq 0 ]
  echo "$output" | grep -q "ESTABLISHED,RELATED"
}

@test "EGRESS_ALLOW env emits per-rule ACCEPT lines" {
  run env -i PATH="$PATH" DRY_RUN=1 EGRESS_ALLOW="10.0.0.0/8:443/tcp,8.8.8.8/32:53/udp" bash "$SCRIPT"
  [ "$status" -eq 0 ]
  echo "$output" | grep -q -- "-d 10.0.0.0/8 -p tcp --dport 443 -j ACCEPT"
  echo "$output" | grep -q -- "-d 8.8.8.8/32 -p udp --dport 53 -j ACCEPT"
}

@test "0.0.0.0/0 in EGRESS_ALLOW is rejected" {
  run env -i PATH="$PATH" DRY_RUN=1 EGRESS_ALLOW="0.0.0.0/0:443/tcp" bash "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "invalid CIDR in EGRESS_ALLOW is rejected" {
  run env -i PATH="$PATH" DRY_RUN=1 EGRESS_ALLOW="not-a-cidr:443/tcp" bash "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "out-of-range port in EGRESS_ALLOW is rejected" {
  run env -i PATH="$PATH" DRY_RUN=1 EGRESS_ALLOW="10.0.0.0/8:99999/tcp" bash "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "invalid proto in EGRESS_ALLOW is rejected" {
  run env -i PATH="$PATH" DRY_RUN=1 EGRESS_ALLOW="10.0.0.0/8:443/http" bash "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "no broad NEW tcp ACCEPT rule in any output path" {
  for env_val in "" "10.0.0.0/8:443/tcp" "10.0.0.0/8:53/udp"; do
    run env -i PATH="$PATH" DRY_RUN=1 EGRESS_ALLOW="$env_val" bash "$SCRIPT"
    [ "$status" -eq 0 ]
    ! echo "$output" | grep -E -- "-p tcp -m state --state NEW -j ACCEPT"
  done
}

@test "DROP is the last rule" {
  run env -i PATH="$PATH" DRY_RUN=1 EGRESS_ALLOW="10.0.0.0/8:443/tcp" bash "$SCRIPT"
  [ "$status" -eq 0 ]
  # Last iptables rule should be DROP (filter out log messages)
  last_rule=$(echo "$output" | grep '^iptables' | tail -1)
  echo "$last_rule" | grep -q -- "-j DROP"
}
