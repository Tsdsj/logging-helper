import assert from "node:assert/strict";
import fs from "node:fs";

import { findDiagnostic, loadDiagnosticRules } from "../js/diagnostics.mjs";
import { renderPreviewRow } from "../js/preview.mjs";

const rules = loadDiagnosticRules(
  JSON.parse(fs.readFileSync(new URL("../diagnostics.json", import.meta.url), "utf8"))
);

const raw = `***************************
APPLICATION FAILED TO START
***************************
Description:
Web server failed to start. Port 8080 was already in use.
Action:
Identify and stop the process that's listening on port 8080 or configure this application to listen on another port.`;

const row = {
  lineNo: 35,
  raw,
  level: "ERROR",
  lineSpan: 7,
  count: 1,
};

const diagnostic = findDiagnostic(row, rules);
assert.ok(diagnostic, "Port conflict should match a diagnostic rule");
assert.equal(diagnostic.id, "port-already-in-use");
assert.deepEqual(diagnostic.matchEvidence, {
  ruleId: "port-already-in-use",
  pattern: "\\bWeb server failed to start\\.\\s+Port\\s+\\d+\\s+was already in use\\.",
});
assert.match(diagnostic.reason, /端口 8080/);
assert.ok(diagnostic.solutions.some((item) => item.includes("netstat -ano")));

const collapsed = renderPreviewRow(row, null, {
  expandedStack: false,
  expandedDiagnostic: false,
  diagnosticRules: rules,
});
assert.match(collapsed, /data-action="toggle-stack"/);
assert.match(collapsed, /堆栈 7 行/);
assert.match(collapsed, /data-action="toggle-diagnostic"/);
assert.match(collapsed, /诊断建议/);
assert.doesNotMatch(collapsed, /Identify and stop the process/);

const expanded = renderPreviewRow(row, null, {
  expandedStack: true,
  expandedDiagnostic: true,
  diagnosticRules: rules,
});
assert.match(expanded, /preview-detail-row/);
assert.match(expanded, /Identify and stop the process/);
assert.match(expanded, /端口 8080/);
assert.match(expanded, /匹配依据/);
assert.doesNotMatch(expanded, /Matched because/);
assert.match(expanded, /port-already-in-use/);
assert.match(expanded, /Web server failed to start/);
assert.match(expanded, /修改应用端口/);

console.log("Preview diagnostics regression passed");
