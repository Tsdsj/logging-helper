import assert from "node:assert/strict";

import { BUILT_IN_SAMPLE_LOGS, combinedSampleLog } from "../js/sample-logs.mjs";
import { parseLines, summarize } from "../js/parser.mjs";

assert.ok(
  BUILT_IN_SAMPLE_LOGS.length >= 6,
  "should ship several built-in samples across languages and frameworks"
);

const requiredIds = [
  "spring-boot",
  "fastapi",
  "node-pino",
  "go-zap",
  "dotnet",
  "android-logcat",
];
for (const id of requiredIds) {
  assert.ok(
    BUILT_IN_SAMPLE_LOGS.some((sample) => sample.id === id),
    `missing built-in sample ${id}`
  );
}

for (const sample of BUILT_IN_SAMPLE_LOGS) {
  assert.match(sample.label, /\S/);
  assert.match(sample.framework, /\S/);
  assert.ok(
    sample.content.split(/\r?\n/).filter(Boolean).length >= 18,
    `${sample.id} should be long enough to exercise the UI`
  );

  const rows = parseLines(sample.content, { mergeStack: true, collapseDup: true });
  const result = summarize(rows, 1);

  assert.ok(result.events >= 12, `${sample.id} should parse multiple events after stack merge`);
  assert.ok(result.errorLines >= 2, `${sample.id} should include multiple failures`);
  assert.ok(result.levels.size >= 3, `${sample.id} should include varied log levels`);
  assert.ok(
    result.dayTrend.some(([key]) => /^\d{4}-\d{2}-\d{2}|^\d{2}-\d{2}/.test(key)),
    `${sample.id} should include recognizable timestamps`
  );
}

const combined = combinedSampleLog();
const combinedRows = parseLines(combined.content, { mergeStack: true, collapseDup: true });
const combinedResult = summarize(combinedRows, combined.fileCount);

assert.equal(combined.fileCount, BUILT_IN_SAMPLE_LOGS.length);
assert.ok(combined.content.includes("Application failed"));
assert.ok(combined.content.includes("uvicorn.error"));
assert.ok(combined.content.includes('"service":"checkout-api"'));
assert.ok(combined.content.includes("ShoppingCartService"));
assert.ok(combined.content.includes("ActivityTaskManager"));
assert.ok(combinedResult.errorLines >= BUILT_IN_SAMPLE_LOGS.length * 2);

console.log("Built-in sample logs regression passed");
