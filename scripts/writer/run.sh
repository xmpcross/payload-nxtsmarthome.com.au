#!/usr/bin/env bash
# Run the NXT Smart Home article generator.
# Usage: bash run.sh [options]   or   ./run.sh [options]
# AI_PROVIDER defaults to openrouter (OPENROUTER_API_KEY in .env.local; the
# Gemini account has no credit). Set AI_PROVIDER=gemini|anthropic|openai to override.
# Research then uses OpenRouter web search (OPENROUTER_RESEARCH_MODEL).
# All flags are passed through to generate-post.ts.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="/kspellman/sites/nxtsmarthome.com.au/app"
OWN_MODS="$SCRIPT_DIR/node_modules"
APP_MODS="$APP_DIR/node_modules"

if [[ ! -d "$OWN_MODS" ]]; then
  echo "node_modules not found — running npm install in $SCRIPT_DIR" >&2
  (cd "$SCRIPT_DIR" && npm install --silent)
fi

# NODE_PATH is ignored by the ESM loader. Symlink each app-side package scope
# (payload, @payloadcms, @fal-ai, next, …) into our own node_modules so that
# the standard ancestor-directory walk finds them. We only create a link if the
# source exists and the target does not — idempotent across re-runs.
symlink_pkg() {
  local src="$APP_MODS/$1" dst="$OWN_MODS/$1"
  if [[ -e "$src" && ! -e "$dst" ]]; then ln -sf "$src" "$dst"; fi
}

symlink_pkg payload
symlink_pkg next
symlink_pkg react
symlink_pkg "@payloadcms"
symlink_pkg "@fal-ai"
symlink_pkg "@lexical"
symlink_pkg "@types"

export AI_PROVIDER="${AI_PROVIDER:-openrouter}"

exec "$APP_MODS/.bin/tsx" \
  --env-file="$APP_DIR/.env.local" \
  "$SCRIPT_DIR/generate-post.ts" \
  "$@"
