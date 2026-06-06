$ErrorActionPreference = "Stop"

node --check app.js
node --check js/parser.mjs
node --check js/custom-diagnostics.mjs
node --check js/diagnostics.mjs
node --check js/preview.mjs
node --check js/renderers.mjs
node --check js/patterns.mjs
node --check js/sample-logs.mjs
node --check js/analysis-worker.mjs
node --check js/utils.mjs
node --check js/severity.mjs
node --check js/timeline.mjs
node tests/diagnostics-json.test.mjs
node tests/diagnostics-expanded.test.mjs
node tests/custom-diagnostics-import.test.mjs
node tests/issue-report.test.mjs
node tests/parse-spring-boot-failure.test.mjs
node tests/preview-diagnostics.test.mjs
node tests/preview-context.test.mjs
node tests/root-cause.test.mjs
node tests/trace-id.test.mjs
node tests/severity.test.mjs
node tests/timeline.test.mjs
node tests/pattern-groups.test.mjs
node tests/renderers-chart.test.mjs
node tests/sample-logs.test.mjs
node tests/app-entry-smoke.test.mjs
node tests/app-worker-state.test.mjs

Write-Host "logging-helper init checks passed."
