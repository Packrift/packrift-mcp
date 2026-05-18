#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd /Users/farhan/Downloads/packrift-mcp-server
/usr/local/bin/npm run snapshot:funnel
