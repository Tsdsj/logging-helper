import { ERROR_LEVELS, springBootFailureSummary } from "./parser.mjs";

const SEVERITIES = {
  critical: { key: "critical", label: "Critical" },
  high: { key: "high", label: "High" },
  medium: { key: "medium", label: "Medium" },
  low: { key: "low", label: "Low" },
};

export function getSeverity(row) {
  if (!row || !ERROR_LEVELS.has(row.level)) return null;
  const raw = row.raw || "";

  if (row.level === "FATAL" || isStartupFailure(raw)) {
    return SEVERITIES.critical;
  }

  if (/OutOfMemoryError|Java heap space|GC overhead limit exceeded|Metaspace|heap exhausted/i.test(raw)) {
    return SEVERITIES.high;
  }

  if (
    /Connection refused|SQLNonTransientConnectionException|Communications link failure|database .*unavailable|ECONNREFUSED/i.test(
      raw
    )
  ) {
    return SEVERITIES.medium;
  }

  return SEVERITIES.low;
}

export function countSeverities(rows) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
  for (const row of rows || []) {
    const severity = getSeverity(row);
    if (!severity) continue;
    counts[severity.key] += row.count || 1;
    counts.total += row.count || 1;
  }
  return counts;
}

function isStartupFailure(raw) {
  return /APPLICATION FAILED TO START/i.test(raw) || Boolean(springBootFailureSummary(raw));
}
