#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"
/usr/local/bin/npm run snapshot:funnel -- \
  --mcp-timeout-ms 120000 \
  --order-timeout-ms 120000 \
  --ga4-timeout-ms 180000 \
  --ga4-realtime-timeout-ms 180000 \
  --distribution-timeout-ms 120000
