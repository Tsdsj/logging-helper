import assert from "node:assert/strict";
import fs from "node:fs";

import { loadDiagnosticRules } from "../js/diagnostics.mjs";
import { buildIssueReport } from "../js/report.mjs";
import { renderPreviewRow } from "../js/preview.mjs";

const rules = loadDiagnosticRules(
  JSON.parse(fs.readFileSync(new URL("../diagnostics.json", import.meta.url), "utf8"))
);
const appJs = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const row = {
  lineNo: 35,
  raw: `***************************
APPLICATION FAILED TO START
***************************
Description:
Web server failed to start. Port 8080 was already in use.
Action:
Identify and stop the process that's listening on port 8080 or configure this application to listen on another port.`,
  level: "ERROR",
  lineSpan: 7,
  count: 1,
};
const contextRows = [
  { lineNo: 34, raw: "2026-06-01 INFO Tomcat initialized with port 8080", level: "INFO", lineSpan: 1, count: 1 },
  row,
  { lineNo: 42, raw: "2026-06-01 INFO Stopping configuration", level: "INFO", lineSpan: 1, count: 1 },
];

const report = buildIssueReport(row, {
  diagnosticRules: rules,
  contextRows,
});
assert.match(report, /# 日志问题报告/);
assert.match(report, /## 摘要/);
assert.match(report, /- 级别：ERROR/);
assert.match(report, /- 行号：35/);
assert.match(report, /Web server failed to start\. Port 8080 was already in use\./);
assert.match(report, /## 诊断建议/);
assert.match(report, /端口被占用/);
assert.match(report, /## 原始片段/);
assert.match(report, /APPLICATION FAILED TO START/);
assert.match(report, /## 附近上下文/);
assert.match(report, /Tomcat initialized/);

const collapsed = renderPreviewRow(row, null, {
  expandedReport: false,
  diagnosticRules: rules,
  contextRows,
});
assert.match(collapsed, /data-action="toggle-report"/);
assert.match(collapsed, /报告/);
assert.doesNotMatch(collapsed, />Report</);

const expanded = renderPreviewRow(row, null, {
  expandedReport: true,
  diagnosticRules: rules,
  contextRows,
});
assert.match(expanded, /report-detail/);
assert.match(expanded, /data-action="copy-report"/);
assert.match(expanded, /data-report-line-no="35"/);
assert.match(expanded, /markdown-body/);
assert.match(expanded, /<h1>日志问题报告<\/h1>/);
assert.match(expanded, /<h2>摘要<\/h2>/);
assert.match(expanded, /APPLICATION FAILED TO START/);
assert.doesNotMatch(expanded, /<pre data-report-line-no="35"># 日志问题报告/);
assert.match(
  appJs,
  /querySelector\(`\.report-source\[data-report-line-no="\$\{lineNo\}"\]`\)/
);

console.log("Issue report regression passed");
