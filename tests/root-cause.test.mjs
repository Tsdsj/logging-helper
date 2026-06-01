import assert from "node:assert/strict";

import { extractRootCause, parseLines } from "../js/parser.mjs";
import { renderPreviewRow } from "../js/preview.mjs";

const javaStack = `2026-06-01T10:00:00.000Z ERROR 123 --- [main] c.example.Demo : Application failed
org.springframework.beans.factory.BeanCreationException: Error creating bean with name 'orderService'
	at com.example.Demo.main(Demo.java:10)
Caused by: org.springframework.beans.factory.UnsatisfiedDependencyException: Error creating bean with name 'paymentClient'
	at com.example.OrderService.<init>(OrderService.java:18)
Caused by: java.net.ConnectException: Connection refused`;

const rows = parseLines(javaStack, { mergeStack: true, collapseDup: true });
assert.equal(rows.length, 1);

const rootCause = extractRootCause(rows[0].raw);
assert.equal(rootCause?.kind, "java");
assert.equal(rootCause?.message, "java.net.ConnectException: Connection refused");
assert.equal(rows[0].raw.includes("BeanCreationException"), true);

const expanded = renderPreviewRow(rows[0], null, {
  expandedStack: true,
  expandedDiagnostic: false,
  diagnosticRules: [],
});
assert.match(expanded, /root-cause-detail/);
assert.match(expanded, /java\.net\.ConnectException: Connection refused/);

const pythonTraceback = `2026-06-01 10:05:00 ERROR app failed
Traceback (most recent call last):
  File "/srv/app/main.py", line 12, in <module>
    run()
  File "/srv/app/main.py", line 8, in run
    load_config()
ValueError: invalid literal for int() with base 10: 'abc'`;

const pythonRows = parseLines(pythonTraceback, { mergeStack: true, collapseDup: true });
assert.equal(pythonRows.length, 1);

const pythonRootCause = extractRootCause(pythonRows[0].raw);
assert.equal(pythonRootCause?.kind, "python");
assert.equal(
  pythonRootCause?.message,
  "ValueError: invalid literal for int() with base 10: 'abc'"
);

const pythonExpanded = renderPreviewRow(pythonRows[0], null, {
  expandedStack: true,
  expandedDiagnostic: false,
  diagnosticRules: [],
});
assert.match(pythonExpanded, /root-cause-detail/);
assert.match(pythonExpanded, /ValueError: invalid literal for int\(\) with base 10/);

console.log("Root cause regression passed");
