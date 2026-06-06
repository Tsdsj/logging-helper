import { ERROR_LEVELS, springBootFailureSummary } from "./parser.mjs";
import { getSeverity } from "./severity.mjs";

const DEFAULT_TIMELINE_LIMIT = 12;

export function selectTimelineEvents(rows, limit = DEFAULT_TIMELINE_LIMIT) {
  const notable = (rows || []).filter(isNotableEvent);
  const selected = notable
    .toSorted((a, b) => timelinePriority(a) - timelinePriority(b) || a.lineNo - b.lineNo)
    .slice(0, limit)
    .toSorted((a, b) => a.lineNo - b.lineNo)
    .map((row) => ({
      lineNo: row.lineNo,
      level: row.level,
      time: timelineTime(row),
      message: previewSummary(row.raw),
    }));
  return {
    items: selected,
    omittedCount: Math.max(0, notable.length - limit),
  };
}

function isNotableEvent(row) {
  const raw = row.raw || "";
  return (
    row.level === "WARN" ||
    ERROR_LEVELS.has(row.level) ||
    /APPLICATION FAILED TO START|failed to start|startup failure/i.test(raw) ||
    /\b(shutdown|shutting down|stopped|stopping)\b/i.test(raw) ||
    /\b(retry|retrying|retried)\b/i.test(raw)
  );
}

function timelinePriority(row) {
  const severity = getSeverity(row);
  if (severity?.key === "critical" || row.level === "FATAL") return 1;
  if (severity?.key === "high") return 2;
  if (row.level === "ERROR") return 3;
  if (severity?.key === "medium") return 4;
  if (row.level === "WARN") return 5;
  return 6;
}

function timelineTime(row) {
  if (row.hourKey && row.hourKey !== "未识别时间") return row.hourKey;
  if (row.dayKey && row.dayKey !== "未识别时间") return row.dayKey;
  return `#${row.lineNo}`;
}

function previewSummary(raw) {
  return springBootFailureSummary(raw) || raw.split(/\r?\n/)[0];
}
