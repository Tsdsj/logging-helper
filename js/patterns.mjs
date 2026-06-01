import { ERROR_LEVELS, LEVELS, templateOf } from "./parser.mjs";
import { getSeverity } from "./severity.mjs";

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

const TS_DISPLAY_REGEXES = [
  /\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?\b/,
  /\b[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\b/,
  /\b\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/,
  /\b\d{2}:\d{2}:\d{2}(?:[.,]\d+)?\b/,
];

// Cluster parsed rows into "problem groups" keyed by their templated message.
// Each group keeps occurrence counts, level mix, severity, time span,
// a per-bucket sparkline and a few raw samples for drill-down.
export function buildPatternGroups(rows, { limit = 12, sampleLimit = 5 } = {}) {
  const groups = new Map();

  for (const row of rows || []) {
    const tpl = templateOf(row.raw);
    let group = groups.get(tpl);
    if (!group) {
      group = {
        template: tpl,
        count: 0,
        events: 0,
        levels: {},
        severity: null,
        severityRank: 0,
        firstTime: "",
        lastTime: "",
        firstLineNo: row.lineNo,
        buckets: new Map(),
        samples: [],
      };
      groups.set(tpl, group);
    }

    const n = row.count || 1;
    group.count += n;
    group.events += 1;
    group.levels[row.level] = (group.levels[row.level] || 0) + n;

    const severity = getSeverity(row);
    if (severity && (SEVERITY_RANK[severity.key] || 0) > group.severityRank) {
      group.severity = severity;
      group.severityRank = SEVERITY_RANK[severity.key] || 0;
    }

    const timeText = displayTime(row);
    if (timeText) {
      if (!group.firstTime) group.firstTime = timeText;
      group.lastTime = timeText;
    }

    const bucket = row.hourKey && row.hourKey !== "未识别时间" ? row.hourKey : null;
    if (bucket) group.buckets.set(bucket, (group.buckets.get(bucket) || 0) + n);

    if (group.samples.length < sampleLimit) {
      group.samples.push(row.raw.split("\n")[0]);
    }
  }

  return Array.from(groups.values())
    .map(finalizeGroup)
    .sort((a, b) => b.count - a.count || b.severityRank - a.severityRank)
    .slice(0, limit);
}

function finalizeGroup(group) {
  const sparkline = Array.from(group.buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, count]) => count);
  return {
    template: group.template,
    count: group.count,
    events: group.events,
    levels: group.levels,
    dominantLevel: dominantLevel(group.levels),
    severity: group.severity,
    severityRank: group.severityRank,
    firstTime: group.firstTime || "未识别时间",
    lastTime: group.lastTime || "未识别时间",
    firstLineNo: group.firstLineNo,
    sparkline,
    samples: group.samples,
  };
}

function dominantLevel(levels) {
  let best = "OTHER";
  let bestCount = -1;
  for (const lvl of LEVELS.concat(["OTHER"])) {
    const count = levels[lvl] || 0;
    if (count > bestCount) {
      best = lvl;
      bestCount = count;
    }
  }
  return best;
}

function displayTime(row) {
  const raw = row.raw || "";
  for (const re of TS_DISPLAY_REGEXES) {
    const match = raw.match(re);
    if (match) return match[0];
  }
  if (row.hourKey && row.hourKey !== "未识别时间") return row.hourKey;
  return "";
}

export function isErrorGroup(group) {
  return Boolean(group?.severity) || (group?.levels?.ERROR || group?.levels?.FATAL);
}

export { ERROR_LEVELS };
