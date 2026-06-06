import assert from "node:assert/strict";

import { parseLines, summarize } from "../js/parser.mjs";
import { renderPreviewRow } from "../js/preview.mjs";
import { renderActiveFilterHtml } from "../js/renderers.mjs";

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
assert.match(rendered, /data-action="filter-identifier"/);
assert.match(rendered, /data-identifier-key="traceId"/);
assert.match(rendered, /data-identifier-value="abc123"/);
assert.match(rendered, /traceId=abc123/);
assert.match(rendered, /requestId=req-9/);

const activeFilter = renderActiveFilterHtml({
  timeWindow: null,
  inactiveLevels: [],
  search: "",
  searchMode: "plain",
  identifierFilter: { key: "traceId", value: "abc123" },
  matchCount: 2,
});

assert.match(activeFilter, /命中 2 条/);
assert.match(activeFilter, /data-clear="identifier"/);
assert.match(activeFilter, /链路：traceId=abc123/);
const traceparentLog = [
  "2026-06-01 10:00:03 INFO traceparent=00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01 otel request",
  '{"time":"2026-06-01T10:00:04Z","level":"ERROR","traceparent":"00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01","message":"json otel failure"}',
  "2026-06-01 10:00:05 INFO traceparent=00-00000000000000000000000000000000-00f067aa0ba902b7-01 ignored zero trace",
  "2026-06-01 10:00:06 INFO traceparent=00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01 ignored zero span",
].join("\n");

const traceparentRows = parseLines(traceparentLog, { mergeStack: true, collapseDup: true });
assert.deepEqual(traceparentRows[0].identifiers, {
  traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  spanId: "00f067aa0ba902b7",
});
assert.deepEqual(traceparentRows[1].identifiers, {
  traceparent: "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
  traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  spanId: "bbbbbbbbbbbbbbbb",
});
assert.deepEqual(traceparentRows[2].identifiers, {});
assert.deepEqual(traceparentRows[3].identifiers, {});

const traceparentRendered = renderPreviewRow(traceparentRows[0], null, { diagnosticRules: [] });
assert.match(
  traceparentRendered,
  /traceparent=00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01/
);
assert.match(traceparentRendered, /traceId=4bf92f3577b34da6a3ce929d0e0e4736/);
assert.match(traceparentRendered, /spanId=00f067aa0ba902b7/);

console.log("Trace identifier regression passed");
