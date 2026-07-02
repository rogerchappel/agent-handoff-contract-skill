#!/usr/bin/env bash
set -euo pipefail

npm run check
npm test
npm run smoke >/tmp/handoff-contract-smoke.md
grep -q "Status: pass" /tmp/handoff-contract-smoke.md
npm run package:smoke
