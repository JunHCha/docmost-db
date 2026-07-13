#!/usr/bin/env bash
#
# dev-up.sh — bring up THIS worktree's dev web for QA (single-slot switch).
#
# Why: the dev stack is single-port (client :5173 → proxies /api to server :3000),
# so only ONE worktree's dev web can run at a time. When you QA many worktrees in
# parallel you constantly need to switch which one is "live". This script makes
# that one command: run it from any worktree and that worktree becomes the live
# dev web at http://localhost:5173, tearing down whatever was up before.
#
# Postgres (:5432) + Redis (:6379) are SHARED across worktrees and reused if
# already healthy; only spun up via docker-compose.dev.yml when missing.
#
# Usage:
#   ./dev-up.sh                # make this worktree the live QA dev web
#   ./dev-up.sh --migrate      # also run `migration:latest` (new migrations)
#   ./dev-up.sh --clean        # also wipe Vite cache (stale-serving fix)
#   ./dev-up.sh -m -c          # both
#   ./dev-up.sh --down         # just stop the live dev (free the ports)
#
# After it returns: open http://localhost:5173 . Tail logs at the printed path.
#
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

CLIENT_PORT="${CLIENT_PORT:-5173}"
SERVER_PORT="${PORT:-3000}"
LOG="/tmp/docmost-dev-$(basename "$REPO_ROOT").log"
COMPOSE_FILE="docker-compose.dev.yml"
# Pin the compose project so every worktree shares ONE set of named volumes.
# Without this, compose derives the project from the cwd basename, so each
# worktree spins up its own empty <worktree>_dev_pgdata and the DB looks
# unmigrated ("relation ... does not exist"). Fixed name => shared data.
COMPOSE_PROJECT="docmost-db-dev"

DO_MIGRATE=0
DO_CLEAN=0
DO_DOWN=0
for arg in "$@"; do
  case "$arg" in
    -m|--migrate) DO_MIGRATE=1 ;;
    -c|--clean)   DO_CLEAN=1 ;;
    --down)       DO_DOWN=1 ;;
    -h|--help)
      awk 'NR>1 && /^#/ {sub(/^# ?/,""); print; next} NR>1 {exit}' "${BASH_SOURCE[0]}"
      exit 0 ;;
    *) echo "✗ unknown option: $arg (try --help)"; exit 2 ;;
  esac
done

say()  { printf '\033[36m▶\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m✔\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

port_open() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && exec 3>&- ; }

free_port() {
  local p="$1" pids
  pids="$(lsof -ti "tcp:$p" 2>/dev/null || true)"
  [ -z "$pids" ] && return 0
  warn "freeing port $p (pids: $(echo "$pids" | tr '\n' ' '))"
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true
  for _ in 1 2 3 4 5; do
    sleep 1
    pids="$(lsof -ti "tcp:$p" 2>/dev/null || true)"
    [ -z "$pids" ] && return 0
  done
  # shellcheck disable=SC2086
  kill -9 $pids 2>/dev/null || true
  sleep 1
}

# --- ensure pnpm is on PATH (corepack / nvm in non-interactive shells) ---
if ! command -v pnpm >/dev/null 2>&1; then
  [ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
  command -v corepack >/dev/null 2>&1 && corepack enable >/dev/null 2>&1 || true
fi
command -v pnpm >/dev/null 2>&1 || die "pnpm not found on PATH (enable via: corepack enable)"

# --- --down: stop the live dev and exit ---
if [ "$DO_DOWN" = 1 ]; then
  say "stopping live dev (ports $CLIENT_PORT / $SERVER_PORT)"
  free_port "$CLIENT_PORT"
  free_port "$SERVER_PORT"
  ok "dev stopped. infra (pg/redis) left running."
  exit 0
fi

echo "=== dev up for QA → $(basename "$REPO_ROOT") ==="

# --- 1. shared infra: reuse if healthy, else bring up ---
if port_open 5432 && port_open 6379; then
  ok "infra reachable (pg :5432, redis :6379) — reusing"
else
  say "starting shared infra via $COMPOSE_FILE"
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" up -d || die "docker compose up failed"
  say "waiting for postgres :5432"
  for i in $(seq 1 30); do
    port_open 5432 && break
    [ "$i" = 30 ] && die "postgres did not come up in time"
    sleep 1
  done
  ok "infra ready"
fi

# --- 2. single-slot switch: free the dev ports (kills whatever worktree was live) ---
say "switching live slot — freeing dev ports"
free_port "$CLIENT_PORT"
free_port "$SERVER_PORT"
port_open "$CLIENT_PORT" && die "port $CLIENT_PORT still busy — close it and retry"
port_open "$SERVER_PORT" && die "port $SERVER_PORT still busy — close it and retry"

# --- 3. per-worktree build prerequisite (each worktree needs its own dist) ---
say "building @docmost/editor-ext"
pnpm --filter @docmost/editor-ext build || die "editor-ext build failed"

# --- 4. optional migrations / cache clean ---
if [ "$DO_MIGRATE" = 1 ]; then
  say "applying migrations (migration:latest)"
  pnpm --filter server migration:latest || die "migration failed"
fi
if [ "$DO_CLEAN" = 1 ]; then
  say "wiping Vite cache"
  rm -rf apps/client/node_modules/.vite
fi

# --- 5. start dev detached (survives this shell; nohup since macOS lacks setsid) ---
say "starting dev (client + server) — log: $LOG"
: > "$LOG"
( nohup pnpm dev > "$LOG" 2>&1 & )

# --- 6. wait for readiness: back from log (Nest), front by polling the port ---
#   (front is polled via curl, not log-grep: Vite's banner is wrapped in ANSI
#    color codes that break naive pattern matching.)
say "waiting for dev to come up (≤120s)"
front_ok=0; back_ok=0
for _ in $(seq 1 60); do
  grep -qa "Nest application successfully started" "$LOG" 2>/dev/null && back_ok=1
  curl -fsS "http://localhost:${CLIENT_PORT}/" >/dev/null 2>&1 && front_ok=1
  [ "$front_ok" = 1 ] && [ "$back_ok" = 1 ] && break
  sleep 2
done

if [ "$front_ok" != 1 ] || [ "$back_ok" != 1 ]; then
  warn "dev did not fully come up (front=$front_ok back=$back_ok). Last log lines:"
  tail -n 20 "$LOG" || true
  die "startup incomplete — inspect $LOG"
fi
ok "smoke: client http://localhost:${CLIENT_PORT}/ → 200, server reports started"

echo
ok "QA dev web is LIVE for: $(basename "$REPO_ROOT")"
echo "   URL : http://localhost:${CLIENT_PORT}"
echo "   log : $LOG   (tail -f to watch)"
echo "   stop: ./dev-up.sh --down"
