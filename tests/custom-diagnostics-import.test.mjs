import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildCustomDiagnosticsTemplate,
  buildCustomDiagnosticsTemplateDownload,
} from "../js/custom-diagnostics.mjs";
import { findDiagnostic, loadDiagnosticRules } from "../js/diagnostics.mjs";

const indexHtml = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.match(indexHtml, /id="customDiagnosticsFile"/);
assert.match(indexHtml, /id="customDiagnosticsBtn"/);
assert.match(indexHtml, /id="customDiagnosticsTemplateBtn"/);
assert.match(indexHtml, /id="customDiagnosticsStatus"/);

const customRules = loadDiagnosticRules({
  rules: [
    {
      id: "custom-disk-pressure",
      title: "Custom disk pressure",
      tags: ["custom"],
      match: { any: ["DiskPressureCritical"] },
      reason: "Disk pressure crossed a custom threshold.",
      details: ["The local custom diagnostics file matched this event."],
      solutions: ["Free disk space or move the workload to a larger volume."],
    },
  ],
});

const diagnostic = findDiagnostic(
  { level: "ERROR", raw: "DiskPressureCritical: node volume /data is full" },
  customRules
);
assert.equal(diagnostic.id, "custom-disk-pressure");
assert.match(diagnostic.reason, /custom threshold/);
assert.match(diagnostic.matchEvidence.pattern, /DiskPressureCritical/);

assert.throws(
  () => loadDiagnosticRules({ rules: [{ id: "broken", match: { any: ["("] } }] }),
  /Invalid regular expression/
);

const template = buildCustomDiagnosticsTemplate();
assert.equal(template.rules.length, 1);
assert.equal(template.rules[0].id, "custom-example-rule");
assert.ok(template.rules[0].match.any.length);
assert.ok(template.rules[0].reason);
assert.ok(template.rules[0].details.length);
assert.ok(template.rules[0].solutions.length);
assert.equal(loadDiagnosticRules(template).length, 1);

const templateDownload = buildCustomDiagnosticsTemplateDownload();
assert.equal(templateDownload.filename, "diagnostics-custom-template.json");
assert.equal(templateDownload.type, "application/json");
assert.equal(loadDiagnosticRules(JSON.parse(templateDownload.content)).length, 1);

console.log("Custom diagnostics import regression passed");
