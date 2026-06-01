import assert from "node:assert/strict";

import { selectTimelineEvents } from "../js/timeline.mjs";
import { renderTimelineHtml } from "../js/renderers.mjs";

const rows = [
  { lineNo: 1, level: "INFO", raw: "2026-06-01 10:00:00 INFO service started", hourKey: "2026-06-01 10:00" },
  { lineNo: 2, level: "WARN", raw: "2026-06-01 10:00:01 WARN config fallback", hourKey: "2026-06-01 10:00" },
  { lineNo: 3, level: "INFO", raw: "2026-06-01 10:00:02 INFO retry scheduled", hourKey: "2026-06-01 10:00" },
  { lineNo: 4, level: "ERROR", raw: "APPLICATION FAILED TO START\nDescription:\nWeb server failed to start. Port 8080 was already in use.", hourKey: "未识别时间" },
  { lineNo: 5, level: "INFO", raw: "2026-06-01 10:00:03 INFO shutting down executor", hourKey: "2026-06-01 10:00" },
  { lineNo: 6, level: "FATAL", raw: "2026-06-01 10:00:04 FATAL worker crashed", hourKey: "2026-06-01 10:00" },
  { lineNo: 7, level: "INFO", raw: "2026-06-01 10:00:05 INFO health ok", hourKey: "2026-06-01 10:00" },
];

const timeline = selectTimelineEvents(rows, 3);
assert.equal(timeline.items.length, 3);
assert.equal(timeline.omittedCount, 2);
assert.deepEqual(
  timeline.items.map((item) => item.lineNo),
  [2, 3, 4]
);
assert.match(timeline.items[2].message, /Web server failed to start/);

const html = renderTimelineHtml(timeline);
assert.match(html, /event-timeline/);
assert.match(html, /data-action="focus-timeline"/);
assert.match(html, /data-line-no="4"/);
assert.match(html, /WARN/);
assert.match(html, /APPLICATION FAILED TO START|Web server failed/);
assert.match(html, /另有 2 条关键事件未显示/);
const focusedHtml = renderTimelineHtml({ ...timeline, focusedLineNo: 4, hiddenFocusedLine: true });
assert.match(focusedHtml, /is-focused/);
assert.match(focusedHtml, /当前筛选条件隐藏了 #4/);
assert.equal(renderTimelineHtml({ items: [], omittedCount: 0 }), "");

console.log("Timeline regression passed");
