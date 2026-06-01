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

console.log("Root cause regression passed");
