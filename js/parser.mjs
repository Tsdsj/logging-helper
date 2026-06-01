export const LEVELS = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"];
export const ERROR_LEVELS = new Set(["ERROR", "FATAL"]);

const LEVEL_ALIASES = {
  TRACE: "TRACE", FINEST: "TRACE", FINER: "TRACE", VERBOSE: "TRACE",
  DEBUG: "DEBUG", FINE: "DEBUG", DBG: "DEBUG",
  INFO: "INFO", INFORMATION: "INFO", NOTICE: "INFO",
  WARN: "WARN", WARNING: "WARN",
  ERROR: "ERROR", ERR: "ERROR", SEVERE: "ERROR",
  FATAL: "FATAL", CRITICAL: "FATAL", CRIT: "FATAL", EMERG: "FATAL",
  EMERGENCY: "FATAL", ALERT: "FATAL", PANIC: "FATAL",
  V: "TRACE", D: "DEBUG", I: "INFO", W: "WARN", E: "ERROR", F: "FATAL",
};

const LEVEL_FIELD_REGEX =
  /["']?(?:level(?:name|no)?|severity|lvl|loglevel)["']?\s*[:=]\s*["']?([A-Za-z]+|\d+)/i;
const LEVEL_WORD_REGEX =
  /\b(TRACE|DEBUG|INFO(?:RMATION)?|NOTICE|WARN(?:ING)?|ERROR|SEVERE|FATAL|CRITICAL|PANIC|ALERT|EMERG(?:ENCY)?)\b/i;
const LOGCAT_REGEX =
  /^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\s+\d+\s+\d+\s+([VDIWEF])\s/;
const SPRING_BOOT_FAILURE_TITLE_REGEX = /^APPLICATION FAILED TO START$/i;
const SPRING_BOOT_FAILURE_SEPARATOR_REGEX = /^\*{3,}$/;
const SPRING_BOOT_PORT_IN_USE_REGEX =
  /\bWeb server failed to start\.\s+Port\s+\d+\s+was already in use\./i;

const TS_ISO_REGEX = /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):\d{2}:\d{2}/;
const TS_EPOCH_REGEX =
  /["']?(?:@?timestamp|time|ts)["']?\s*[:=]\s*["']?(\d{10}|\d{13})\b/i;
const TS_MONTH_REGEX =
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{2}):\d{2}:\d{2}\b/;
const TS_MMDD_REGEX = /\b(\d{2})-(\d{2})\s+(\d{2}):\d{2}:\d{2}(?:\.\d+)?\b/;
const MONTHS = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

const MAX_ERROR_TYPE_PREVIEW_LENGTH = 70;

export function parseLines(text, opts = { mergeStack: true, collapseDup: true }) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let physicalNo = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (raw.trim() === "") continue;
    physicalNo += 1;
    const prev = entries[entries.length - 1];
    if (opts.mergeStack && isContinuation(raw, prev)) {
      prev.raw += `\n${raw}`;
      prev.lineSpan += 1;
      if (isSpringBootPortInUse(prev.raw)) {
        prev.level = "ERROR";
      }
      prev.merged = true;
      continue;
    }
    const isSpringBootFailure = isSpringBootFailureStart(raw, lines[i + 1]);
    entries.push({
      lineNo: physicalNo,
      raw,
      level: isSpringBootFailure ? "ERROR" : detectLevel(raw),
      ...extractTimeKeys(raw),
      count: 1,
      lineSpan: 1,
      merged: false,
      isSpringBootFailure,
    });
  }

  if (!opts.collapseDup) return entries;

  const rows = [];
  for (const entry of entries) {
    const prev = rows[rows.length - 1];
    if (prev && prev.raw === entry.raw && prev.level === entry.level) {
      prev.count += 1;
      continue;
    }
    rows.push(entry);
  }
  return rows;
}

export function summarize(rows, fileCount) {
  const levelCounter = new Map();
  const errorTypeCounter = new Map();
  const errorSamples = new Map();
  const hourCounter = new Map();
  const dayCounter = new Map();
  const patternCounter = new Map();
  const patternSamples = new Map();
  let totalLines = 0;
  let errorLines = 0;
  let mergedStacks = 0;
  let collapsedGroups = 0;

  for (const row of rows) {
    const n = row.count;
    totalLines += n;
    if (row.merged) mergedStacks += 1;
    if (row.count > 1) collapsedGroups += 1;

    levelCounter.set(row.level, (levelCounter.get(row.level) || 0) + n);

    const tpl = templateOf(row.raw);
    patternCounter.set(tpl, (patternCounter.get(tpl) || 0) + n);
    if (!patternSamples.has(tpl)) patternSamples.set(tpl, []);
    const psamples = patternSamples.get(tpl);
    if (psamples.length < 5) psamples.push(row.raw.split("\n")[0]);

    if (!ERROR_LEVELS.has(row.level)) continue;

    errorLines += n;
    const type = extractErrorType(row.raw);
    errorTypeCounter.set(type, (errorTypeCounter.get(type) || 0) + n);
    if (!errorSamples.has(type)) errorSamples.set(type, []);
    const samples = errorSamples.get(type);
    if (samples.length < 5) samples.push(row.raw);

    hourCounter.set(row.hourKey, (hourCounter.get(row.hourKey) || 0) + n);
    dayCounter.set(row.dayKey, (dayCounter.get(row.dayKey) || 0) + n);
  }

  return {
    totalLines,
    errorLines,
    errorRate: totalLines ? (errorLines / totalLines) * 100 : 0,
    fileCount,
    events: rows.length,
    mergedStacks,
    collapsedGroups,
    levels: levelCounter,
    frequencies: Array.from(errorTypeCounter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    errorSamples,
    patterns: Array.from(patternCounter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    patternSamples,
    hourTrend: sortTrend(hourCounter),
    dayTrend: sortTrend(dayCounter),
  };
}

export function detectLevel(line) {
  if (isSpringBootFailureTitle(line) || isSpringBootPortInUse(line)) {
    return "ERROR";
  }

  const field = line.match(LEVEL_FIELD_REGEX);
  if (field) {
    const value = field[1];
    if (/^\d+$/.test(value)) {
      const numeric = numericLevel(Number(value));
      if (numeric) return numeric;
    } else {
      const mapped = LEVEL_ALIASES[value.toUpperCase()];
      if (mapped) return mapped;
    }
  }

  const logcat = line.match(LOGCAT_REGEX);
  if (logcat) return LEVEL_ALIASES[logcat[1]];

  const word = line.match(LEVEL_WORD_REGEX);
  if (word) {
    const mapped = LEVEL_ALIASES[word[1].toUpperCase()];
    if (mapped) return mapped;
  }

  return "OTHER";
}

export function templateOf(raw) {
  let s = springBootFailureSummary(raw) || raw.split("\n")[0];
  s = s
    .replace(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, "<TIME>")
    .replace(/\b[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\b/g, "<TIME>")
    .replace(/\b\d{2}:\d{2}:\d{2}(?:[.,]\d+)?\b/g, "<TIME>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<UUID>")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, "<IP>")
    .replace(/\b0x[0-9a-f]+\b/gi, "<HEX>")
    .replace(/"[^"]*"|'[^']*'/g, "<STR>")
    .replace(/\d+/g, "<NUM>")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > 120 ? `${s.slice(0, 120)}...` : s || "(空)";
}

export function springBootFailureSummary(raw) {
  const lines = raw.split(/\r?\n/).map((line) => line.trim());
  const descriptionIndex = lines.findIndex((line) => /^Description:$/i.test(line));
  if (descriptionIndex === -1) return "";
  const actionIndex = lines.findIndex(
    (line, index) => index > descriptionIndex && /^Action:$/i.test(line)
  );
  const endIndex = actionIndex === -1 ? lines.length : actionIndex;
  return lines
    .slice(descriptionIndex + 1, endIndex)
    .filter(Boolean)
    .join(" ");
}

export function extractRootCause(raw) {
  const javaCause = deepestJavaCause(raw);
  if (javaCause) return { kind: "java", message: javaCause };
  return null;
}

function deepestJavaCause(raw) {
  const lines = raw.split(/\r?\n/).map((line) => line.trim());
  const causes = lines
    .filter((line) => /^Caused by:\s+/.test(line))
    .map((line) => line.replace(/^Caused by:\s+/, "").trim())
    .filter(Boolean);
  if (causes.length) return causes[causes.length - 1];

  const topLevel = lines.find((line) =>
    /^(?:[\w$]+\.)*[\w$]*(?:Exception|Error|Throwable)\b/.test(line)
  );
  return topLevel || "";
}

function isContinuation(line, prev) {
  if (!prev) return false;
  if (prev.isSpringBootFailure) {
    return !startsWithTimestamp(line) && !startsWithLogLevel(line);
  }
  if (/^\s/.test(line)) return true;
  if (/^(at\s|\.{3}\s?|Caused by:|Suppressed:|Traceback \(most recent)/.test(line)) {
    return true;
  }
  return (
    !startsWithTimestamp(line) &&
    /^(?:[\w$]+\.)*[\w$]*(?:Exception|Error|Throwable)\b/.test(line)
  );
}

function startsWithTimestamp(line) {
  return /^\s*[\[(]?(\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}|[A-Z][a-z]{2}\s+\d)/.test(line);
}

function startsWithLogLevel(line) {
  return /^\s*(?:TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL)\b/i.test(line);
}

function isSpringBootFailureTitle(line) {
  return SPRING_BOOT_FAILURE_TITLE_REGEX.test(line.trim());
}

function isSpringBootFailureStart(line, nextLine = "") {
  const trimmed = line.trim();
  if (isSpringBootFailureTitle(trimmed)) return true;
  return (
    SPRING_BOOT_FAILURE_SEPARATOR_REGEX.test(trimmed) &&
    isSpringBootFailureTitle(nextLine || "")
  );
}

function isSpringBootPortInUse(text) {
  return SPRING_BOOT_PORT_IN_USE_REGEX.test(text);
}

function numericLevel(n) {
  if (n < 10) return null;
  if (n < 20) return "TRACE";
  if (n < 30) return "DEBUG";
  if (n < 40) return "INFO";
  if (n < 50) return "WARN";
  if (n < 60) return "ERROR";
  return "FATAL";
}

function extractErrorType(line) {
  if (isSpringBootPortInUse(line)) return "PortAlreadyInUse";
  if (isSpringBootFailureTitle(line)) return "SpringBootStartupFailure";

  const jsonMsg = line.match(
    /["'](?:msg|message|error|err)["']\s*:\s*["']([^"']{1,80})/i
  );
  if (jsonMsg?.[1]) return firstToken(jsonMsg[1]);

  const keywordMatch = line.match(
    /\b(?:ERROR|FATAL|CRITICAL|SEVERE|PANIC)\b[\[\]:=\s-]*([A-Za-z0-9_.$-]+)/i
  );
  if (keywordMatch?.[1]) return keywordMatch[1];

  const cleaned = line.replace(/\s+/g, " ").trim();
  return cleaned.length > MAX_ERROR_TYPE_PREVIEW_LENGTH
    ? `${cleaned.slice(0, MAX_ERROR_TYPE_PREVIEW_LENGTH)}...`
    : cleaned;
}

function firstToken(text) {
  const trimmed = text.trim();
  const token = trimmed.split(/[\s:,]+/)[0];
  return token || trimmed;
}

function extractTimeKeys(line) {
  let m = line.match(TS_ISO_REGEX);
  if (m) {
    const date = `${m[1]}-${m[2]}-${m[3]}`;
    return { hourKey: `${date} ${m[4]}:00`, dayKey: date };
  }

  m = line.match(TS_EPOCH_REGEX);
  if (m) {
    const ms = m[1].length === 13 ? Number(m[1]) : Number(m[1]) * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) {
      const iso = d.toISOString();
      const date = iso.slice(0, 10);
      return { hourKey: `${date} ${iso.slice(11, 13)}:00`, dayKey: date };
    }
  }

  m = line.match(TS_MONTH_REGEX);
  if (m && MONTHS[m[1]]) {
    const date = `${MONTHS[m[1]]}-${String(m[2]).padStart(2, "0")}`;
    return { hourKey: `${date} ${m[3]}:00`, dayKey: date };
  }

  m = line.match(TS_MMDD_REGEX);
  if (m) {
    const date = `${m[1]}-${m[2]}`;
    return { hourKey: `${date} ${m[3]}:00`, dayKey: date };
  }

  return { hourKey: "未识别时间", dayKey: "未识别时间" };
}

function sortTrend(counter) {
  return Array.from(counter.entries()).sort((a, b) => {
    if (a[0] === "未识别时间") return 1;
    if (b[0] === "未识别时间") return -1;
    return a[0].localeCompare(b[0]);
  });
}
