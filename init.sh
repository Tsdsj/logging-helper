#!/usr/bin/env sh
set -eu

if [ -z "${SHLVL:-}" ]; then
  echo "Run init.ps1 on Windows PowerShell environments."
  exit 1
fi

node --check app.js
node --check js/parser.mjs
node --check js/diagnostics.mjs
node --check js/preview.mjs
node --check js/renderers.mjs
node --check js/utils.mjs
node tests/diagnostics-json.test.mjs
node tests/parse-spring-boot-failure.test.mjs
node tests/preview-diagnostics.test.mjs
node tests/app-entry-smoke.test.mjs

echo "logging-helper init checks passed."
