import assert from "node:assert/strict";

import { parseLines, summarize, templateOf } from "../js/parser.mjs";

const springBootPortFailure = `2026-06-01T02:36:22.100Z  INFO 12345 --- [main] o.s.b.w.e.tomcat.TomcatWebServer : Tomcat initialized with port 8080 (http)

***************************
APPLICATION FAILED TO START
***************************

Description:

Web server failed to start. Port 8080 was already in use.

Action:

Identify and stop the process that's listening on port 8080 or configure this application to listen on another port.
2026-06-01T02:36:22.570Z  INFO 12345 --- [SpringApplicationShutdownHook] o.s.c.a.AnnotationConfigApplicationContext : Closing`;

const rows = parseLines(springBootPortFailure, {
  mergeStack: true,
  collapseDup: true,
});
const result = summarize(rows, 1);
const failure = rows.find((row) => row.raw.includes("APPLICATION FAILED TO START"));
const unmergedRows = parseLines(springBootPortFailure, {
  mergeStack: false,
  collapseDup: true,
});

assert.equal(rows.length, 3);
assert.ok(failure, "Spring Boot failure analysis block should be present");
assert.equal(failure.level, "ERROR");
assert.equal(failure.lineSpan, 7);
assert.match(failure.raw, /Description:\nWeb server failed to start/);
assert.equal(result.errorLines, 1);
assert.equal(result.frequencies[0][0], "PortAlreadyInUse");
assert.equal(
  templateOf(failure.raw),
  "Web server failed to start. Port <NUM> was already in use."
);
assert.ok(
  unmergedRows.length > rows.length,
  "Disabling multi-line merge should split the Spring Boot failure block"
);

console.log("Spring Boot failure parsing regression passed");
