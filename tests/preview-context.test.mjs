import assert from "node:assert/strict";

import { renderPreviewRow } from "../js/preview.mjs";

const rows = [
  { lineNo: 1, raw: "2026-06-01 10:00:00 INFO booting", level: "INFO", lineSpan: 1, count: 1 },
  { lineNo: 2, raw: "2026-06-01 10:00:01 WARN config fallback", level: "WARN", lineSpan: 1, count: 1 },
  { lineNo: 3, raw: "2026-06-01 10:00:02 INFO connecting db", level: "INFO", lineSpan: 1, count: 1 },
  { lineNo: 4, raw: "2026-06-01 10:00:03 ERROR java.lang.IllegalStateException: failed", level: "ERROR", lineSpan: 1, count: 1 },
  { lineNo: 5, raw: "2026-06-01 10:00:04 INFO cleanup", level: "INFO", lineSpan: 1, count: 1 },
  { lineNo: 6, raw: "2026-06-01 10:00:05 WARN retry skipped", level: "WARN", lineSpan: 1, count: 1 },
  { lineNo: 7, raw: "2026-06-01 10:00:06 INFO stopped", level: "INFO", lineSpan: 1, count: 1 },
  { lineNo: 8, raw: "2026-06-01 10:00:07 INFO after limit", level: "INFO", lineSpan: 1, count: 1 },
];

const collapsed = renderPreviewRow(rows[3], null, {
  expandedContext: false,
  contextRows: rows,
  diagnosticRules: [],
});
assert.match(collapsed, /data-action="toggle-context"/);
assert.match(collapsed, /Context/);
assert.doesNotMatch(collapsed, /config fallback/);

const expanded = renderPreviewRow(rows[3], null, {
  expandedContext: true,
  contextRows: rows,
  diagnosticRules: [],
});
assert.match(expanded, /context-detail/);
assert.match(expanded, /config fallback/);
assert.match(expanded, /connecting db/);
assert.match(expanded, /cleanup/);
assert.match(expanded, /stopped/);
assert.doesNotMatch(expanded, /after limit/);

const infoRow = renderPreviewRow(rows[0], null, {
  expandedContext: false,
  contextRows: rows,
  diagnosticRules: [],
});
assert.doesNotMatch(infoRow, /toggle-context/);

console.log("Preview context regression passed");
