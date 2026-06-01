import { ERROR_LEVELS, springBootFailureSummary } from "./parser.mjs";

const DEFAULT_TIMELINE_LIMIT = 12;

export function selectTimelineEvents(rows, limit = DEFAULT_TIMELINE_LIMIT) {
  const notable = (rows || []).filter(isNotableEvent).map((row) => ({
    lineNo: row.lineNo,
    level: row.level,
    time: timelineTime(row),
    message: previewSummary(row.raw),
  }));
  return {
    items: notable.slice(0, limit),
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

function timelineTime(row) {
  if (row.hourKey && row.hourKey !== "未识别时间") return row.hourKey;
  if (row.dayKey && row.dayKey !== "未识别时间") return row.dayKey;
  return `#${row.lineNo}`;
}

function previewSummary(raw) {
  return springBootFailureSummary(raw) || raw.split(/\r?\n/)[0];
}
