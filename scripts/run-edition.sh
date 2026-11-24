#!/usr/bin/env bash
# Scheduled entry point (cron): produce, build and deploy one edition.
#   scripts/run-edition.sh [am|pm]
set -uo pipefail
cd "$(dirname "$0")/.."
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh" >/dev/null
nvm use 24 >/dev/null
mkdir -p logs
SLOT="${1:-}"
LOG="logs/$(date +%F)-${SLOT:-auto}.log"
{
  echo "=== $(date) run-edition ${SLOT} ==="
  # Once GitHub Actions has produced an edition successfully, it owns the schedule: stand down.
  if curl -fsS --max-time 20 "https://api.github.com/repos/aaddymehndi94/newsapp/actions/workflows/edition.yml/runs?status=success&per_page=1" \
      | grep -q '"total_count": *[1-9]'; then
    echo "GitHub Actions is producing editions; skipping the laptop run."
    exit 0
  fi
  node pipeline/run.ts ${SLOT:+--slot "$SLOT"} --fresh --batch
  echo "=== exit $? at $(date) ==="
  # Keep a week of intermediate work and a month of logs.
  find data/work -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} + 2>/dev/null
  find logs -type f -mtime +30 -delete 2>/dev/null
} >>"$LOG" 2>&1
