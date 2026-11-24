#!/usr/bin/env bash
# Laptop fallback (cron, 05:15 IST): produce, build, deploy and commit today's edition, but only
# if GitHub Actions hasn't already put it live.
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
  # GitHub Actions produces the edition at 03:37 IST. This laptop run (05:15 IST) is only the
  # fallback: it does nothing if today's edition is already live.
  TODAY="${TODAY:-$(TZ=Asia/Kolkata date +%F)}"
  # Read each page into a variable before grepping. `curl | grep -q` under pipefail reports a
  # failure when grep matches early (curl then can't finish writing), which made a live edition
  # look missing and started a duplicate paid run on 2026-11-24.
  live() {
    local html
    html="$(curl -fsS --max-time 30 "https://meridian-news.aadarsh-mehndiratta.workers.dev/")" || return 1
    grep -q "/e/${TODAY}-am/" <<<"$html"
  }
  # A GitHub run waiting on a slow half-price batch can still be going at 05:15. Making the
  # edition here as well would pay for it twice, so wait (up to 2.5 hours) for that run to end.
  gh_running() {
    local runs
    runs="$(curl -fsS --max-time 20 "https://api.github.com/repos/aaddymehndi94/newsapp/actions/workflows/edition.yml/runs?per_page=5")" || return 1
    grep -Eq '"status": *"(queued|in_progress|waiting|pending|requested)"' <<<"$runs"
  }
  for _ in $(seq 1 30); do
    live && { echo "Today's edition is live (GitHub Actions); nothing to do."; exit 0; }
    gh_running || break
    echo "$(date +%T) a GitHub edition run is still going; checking again in 5 minutes."
    sleep 300
  done
  live && { echo "Today's edition is live (GitHub Actions); nothing to do."; exit 0; }
  if gh_running; then
    echo "The GitHub run is still going after 2.5 hours; not starting a second edition."
    exit 0
  fi
  echo "Today's edition is not live; producing it here."
  if [ -n "${DRY_RUN:-}" ]; then echo "DRY_RUN: stopping before any paid work."; exit 0; fi
  # Start from the editions and market history GitHub has committed.
  git pull -q --rebase --autostash origin main || echo "git pull failed; using local data"
  node pipeline/run.ts ${SLOT:+--slot "$SLOT"} --fresh --batch
  status=$?
  echo "=== exit $status at $(date) ==="
  if [ "$status" -eq 0 ]; then
    git add data/editions data/markets
    git commit -q -m "Edition ${TODAY} (laptop fallback)" && git pull -q --rebase --autostash origin main && git push -q origin main \
      || echo "Could not push the edition to GitHub"
  fi
  # Keep a week of intermediate work and a month of logs.
  find data/work -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} + 2>/dev/null
  find logs -type f -mtime +30 -delete 2>/dev/null
} >>"$LOG" 2>&1
