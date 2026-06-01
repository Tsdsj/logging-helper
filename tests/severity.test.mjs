import assert from "node:assert/strict";

import { getSeverity } from "../js/severity.mjs";
import { renderPreviewRow } from "../js/preview.mjs";

const critical = getSeverity({
  level: "ERROR",
  raw: "APPLICATION FAILED TO START\nWeb server failed to start. Port 8080 was already in use.",
});
assert.equal(critical.key, "critical");
assert.equal(critical.label, "Critical");

const high = getSeverity({
  level: "ERROR",
  raw: "java.lang.OutOfMemoryError: Java heap space",
});
assert.equal(high.key, "high");
assert.equal(high.label, "High");

const medium = getSeverity({
  level: "ERROR",
  raw: "java.sql.SQLNonTransientConnectionException: Connection refused",
});
assert.equal(medium.key, "medium");
assert.equal(medium.label, "Medium");

const fatal = getSeverity({ level: "FATAL", raw: "panic: worker stopped" });
assert.equal(fatal.key, "critical");

const low = getSeverity({ level: "ERROR", raw: "GenericError: retry failed" });
assert.equal(low.key, "low");
assert.equal(low.label, "Low");

assert.equal(getSeverity({ level: "WARN", raw: "warn only" }), null);

const rendered = renderPreviewRow(
  { lineNo: 1, level: "ERROR", raw: "GenericError: retry failed", lineSpan: 1, count: 1 },
  null,
  { diagnosticRules: [] }
);
assert.match(rendered, /severity-badge severity-low/);
assert.match(rendered, /Low/);
assert.match(rendered, /badge-ERROR/);

console.log("Severity regression passed");
