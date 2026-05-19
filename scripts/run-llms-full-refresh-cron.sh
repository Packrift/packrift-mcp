#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CLOUDFLARE_ENV="/Users/farhan/Downloads/env-cloudflare.txt"

if [[ -f "${CLOUDFLARE_ENV}" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "${CLOUDFLARE_ENV}"
  set +a
fi

cd "${REPO_ROOT}"
/usr/local/bin/npm run refresh:llms-full -- --publish-kv
