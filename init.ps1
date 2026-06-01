$ErrorActionPreference = "Stop"

node --check app.js
node --check js/parser.mjs
node --check js/diagnostics.mjs
node --check js/preview.mjs
node --check js/renderers.mjs
node --check js/utils.mjs
node tests/diagnostics-json.test.mjs
node tests/custom-diagnostics-import.test.mjs
node tests/issue-report.test.mjs
node tests/parse-spring-boot-failure.test.mjs
node tests/preview-diagnostics.test.mjs
node tests/preview-context.test.mjs
node tests/root-cause.test.mjs
node tests/trace-id.test.mjs
node tests/app-entry-smoke.test.mjs

Write-Host "logging-helper init checks passed."
