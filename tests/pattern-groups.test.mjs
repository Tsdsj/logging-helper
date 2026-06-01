import assert from "node:assert/strict";

import { parseLines } from "../js/parser.mjs";
import { buildPatternGroups } from "../js/patterns.mjs";

const log = [
  "2024-05-21 08:00:01 ERROR Connection refused to db host 10.0.0.1:5432",
  "2024-05-21 08:05:02 ERROR Connection refused to db host 10.0.0.2:5432",
  "2024-05-21 09:10:03 ERROR Connection refused to db host 10.0.0.3:5432",
  "2024-05-21 08:00:04 INFO  user 123 logged in",
  "2024-05-21 08:01:05 INFO  user 456 logged in",
  "2024-05-21 10:00:06 FATAL java.lang.OutOfMemoryError: Java heap space",
].join("\n");

const rows = parseLines(log);
const groups = buildPatternGroups(rows);

// Variable values (IP / NUM) should collapse into shared templates.
const connGroup = groups.find((g) => /Connection refused/.test(g.template));
assert.ok(connGroup, "connection-refused lines should cluster into one group");
assert.equal(connGroup.count, 3);
assert.equal(connGroup.events, 3);
assert.equal(connGroup.dominantLevel, "ERROR");
assert.equal(connGroup.severity.key, "medium");
assert.equal(connGroup.firstTime, "2024-05-21 08:00:01");
assert.equal(connGroup.lastTime, "2024-05-21 09:10:03");
assert.ok(connGroup.firstLineNo >= 1);
assert.ok(Array.isArray(connGroup.sparkline) && connGroup.sparkline.length >= 1);
assert.ok(connGroup.samples.length >= 1);

const loginGroup = groups.find((g) => /logged in/.test(g.template));
assert.ok(loginGroup, "login lines should cluster too");
assert.equal(loginGroup.count, 2);
assert.equal(loginGroup.dominantLevel, "INFO");
assert.equal(loginGroup.severity, null, "INFO lines have no severity");

const oomGroup = groups.find((g) => /OutOfMemoryError/.test(g.template));
assert.ok(oomGroup);
assert.equal(oomGroup.dominantLevel, "FATAL");
assert.equal(oomGroup.severity.key, "critical");

// Groups are sorted by total count descending.
const counts = groups.map((g) => g.count);
const sorted = [...counts].sort((a, b) => b - a);
assert.deepEqual(counts, sorted);

// Limit option is respected.
assert.ok(buildPatternGroups(rows, { limit: 1 }).length === 1);

console.log("Pattern groups regression passed");
