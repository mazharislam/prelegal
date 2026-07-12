#!/usr/bin/env bash
# Stop and remove the Prelegal container. The database goes with it, by design.
set -euo pipefail

docker rm -f prelegal >/dev/null 2>&1 || true

echo "Prelegal stopped"
