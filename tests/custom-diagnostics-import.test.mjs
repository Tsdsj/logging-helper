import assert from "node:assert/strict";
import fs from "node:fs";

import { findDiagnostic, loadDiagnosticRules } from "../js/diagnostics.mjs";

const indexHtml = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.match(indexHtml, /id="customDiagnosticsFile"/);
assert.match(indexHtml, /id="customDiagnosticsBtn"/);
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

console.log("Custom diagnostics import regression passed");
