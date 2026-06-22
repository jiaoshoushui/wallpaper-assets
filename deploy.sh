#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[[ -d node_modules ]] || npm install
node scripts/deploy.mjs "$@"
