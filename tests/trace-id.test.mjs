import assert from "node:assert/strict";

import { parseLines, summarize } from "../js/parser.mjs";
import { renderPreviewRow } from "../js/preview.mjs";

const log = [
  "2026-06-01 10:00:00 INFO traceId=abc123 requestId=req-9 boot ok",
  "2026-06-01 10:00:01 ERROR correlationId=corr-7 spanId=span-3 failed",
  "2026-06-01 10:00:02 INFO no identifiers here",
].join("\n");

const rows = parseLines(log, { mergeStack: true, collapseDup: true });
const result = summarize(rows, 1);

assert.equal(rows.length, 3);
assert.equal(result.totalLines, 3);
assert.deepEqual(rows[0].identifiers, {
  traceId: "abc123",
  requestId: "req-9",
});
assert.deepEqual(rows[1].identifiers, {
  correlationId: "corr-7",
  spanId: "span-3",
});
assert.deepEqual(rows[2].identifiers, {});

const rendered = renderPreviewRow(rows[0], null, { diagnosticRules: [] });
assert.match(rendered, /identifier-chip/);
assert.match(rendered, /traceId=abc123/);
assert.match(rendered, /requestId=req-9/);

console.log("Trace identifier regression passed");
