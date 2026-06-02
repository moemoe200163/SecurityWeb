#!/bin/bash
# Run bats tests. Installs bats if not present (apt-based).
set -euo pipefail

if ! command -v bats >/dev/null 2>&1; then
  echo "[run_bats] bats not found; attempting install via apt"
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y bats
  else
    echo "bats not installed and apt-get unavailable. Install manually: https://github.com/bats-core/bats-core"
    exit 1
  fi
fi

exec bats "$(dirname "$0")/test_egress_policy.bats"
