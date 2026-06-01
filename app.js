// ---------- DOM ----------
const fileInput = document.getElementById("logFile");
const dropZone = document.getElementById("dropZone");
const analyzeBtn = document.getElementById("analyzeBtn");
const sampleBtn = document.getElementById("sampleBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");
const fileListEl = document.getElementById("fileList");

const emptyState = document.getElementById("emptyState");
const resultsEl = document.getElementById("results");

const totalLinesEl = document.getElementById("totalLines");
const errorLinesEl = document.getElementById("errorLines");
const errorRateEl = document.getElementById("errorRate");
const fileCountEl = document.getElementById("fileCount");

const levelBreakdownEl = document.getElementById("levelBreakdown");
const freqTableBody = document.getElementById("freqTableBody");
const trendChart = document.getElementById("trendChart");

const samplePanel = document.getElementById("samplePanel");
const sampleTitle = document.getElementById("sampleTitle");
const sampleBody = document.getElementById("sampleBody");
const sampleClose = document.getElementById("sampleClose");

const searchInput = document.getElementById("searchInput");
const searchErrorEl = document.getElementById("searchError");
const logicSeg = document.getElementById("logicSeg");
const levelFiltersEl = document.getElementById("levelFilters");
const activeFiltersEl = document.getElementById("activeFilters");
const previewBody = document.getElementById("previewBody");
const previewMeta = document.getElementById("previewMeta");

const exportJsonBtn = document.getElementById("exportJsonBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");

const optMergeStack = document.getElementById("optMergeStack");
const optCollapseDup = document.getElementById("optCollapseDup");

const patternTableBody = document.getElementById("patternTableBody");
const patternPanel = document.getElementById("patternPanel");
const patternTitle = document.getElementById("patternTitle");
const patternBody = document.getElementById("patternBody");
const patternClose = document.getElementById("patternClose");

const themeToggle = document.getElementById("themeToggle");

// ---------- Constants ----------
const LEVELS = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"];
const ERROR_LEVELS = new Set(["ERROR", "FATAL"]);

// Canonical level for every keyword we recognise across languages/frameworks.
const LEVEL_ALIASES = {
  TRACE: "TRACE", FINEST: "TRACE", FINER: "TRACE", VERBOSE: "TRACE",
  DEBUG: "DEBUG", FINE: "DEBUG", DBG: "DEBUG",
  INFO: "INFO", INFORMATION: "INFO", NOTICE: "INFO",
  WARN: "WARN", WARNING: "WARN",
  ERROR: "ERROR", ERR: "ERROR", SEVERE: "ERROR",
  FATAL: "FATAL", CRITICAL: "FATAL", CRIT: "FATAL", EMERG: "FATAL",
  EMERGENCY: "FATAL", ALERT: "FATAL", PANIC: "FATAL",
  // single-letter priorities only used for Android logcat positional match
  V: "TRACE", D: "DEBUG", I: "INFO", W: "WARN", E: "ERROR", F: "FATAL",
};

// Structured level field: "level":"error", level=ERROR, "severity":"WARN",
// python json "levelname":"INFO", pino/bunyan numeric "level":50.
const LEVEL_FIELD_REGEX =
  /["']?(?:level(?:name|no)?|severity|lvl|loglevel)["']?\s*[:=]\s*["']?([A-Za-z]+|\d+)/i;
// Plain keyword anywhere in the line (multi-char words only, no single letters).
const LEVEL_WORD_REGEX =
  /\b(TRACE|DEBUG|INFO(?:RMATION)?|NOTICE|WARN(?:ING)?|ERROR|SEVERE|FATAL|CRITICAL|PANIC|ALERT|EMERG(?:ENCY)?)\b/i;
// Android logcat: "MM-DD HH:MM:SS.sss  PID  TID L Tag:"
const LOGCAT_REGEX =
  /^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\s+\d+\s+\d+\s+([VDIWEF])\s/;
const SPRING_BOOT_FAILURE_TITLE_REGEX = /^APPLICATION FAILED TO START$/i;
const SPRING_BOOT_FAILURE_SEPARATOR_REGEX = /^\*{3,}$/;
const SPRING_BOOT_PORT_IN_USE_REGEX =
  /\bWeb server failed to start\.\s+Port\s+\d+\s+was already in use\./i;

// Timestamp formats.
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
const MIN_BAR_WIDTH_PERCENT = 2;
const PREVIEW_LIMIT = 500;
const DIAGNOSTIC_RULES = [
  {
    id: "port-already-in-use",
    title: "端口被占用",
    match: (row) => isSpringBootPortInUse(row.raw),
    reason: (row) => {
      const port = extractPort(row.raw) || "目标";
      return `Spring Boot 内置 Web 服务启动失败，端口 ${port} 已被其他进程占用。`;
    },
    details: [
      "常见原因是上一次服务没有停止、IDE 重复启动了同一个应用，或者 Docker/本地中间件占用了同一端口。",
      "如果这是开发环境问题，优先确认占用端口的进程是否就是旧的应用实例。",
    ],
    solutions: [
      "Windows: `netstat -ano | findstr :<端口>` 找到 PID，再执行 `taskkill /PID <PID> /F`。",
      "Linux/macOS: `lsof -i :<端口>` 找到 PID，再执行 `kill -9 <PID>`。",
      "修改 `server.port`，或通过启动参数 `--server.port=<新端口>` 临时换端口。",
    ],
  },
];

const SAMPLE_LOG = `2024-05-21 08:01:12 INFO  service started on port 8080
2024-05-21 08:03:45 DEBUG cache warm-up complete
2024-05-21 08:15:02 WARN  slow query detected (1200ms)
2024-05-21 08:31:09 ERROR DatabaseTimeout while fetching user profile
2024-05-21 08:31:10 ERROR DatabaseTimeout retry failed
2024-05-21 09:05:44 INFO  scheduled job finished
2024-05-21 09:22:18 ERROR NullPointer in OrderService.checkout
2024-05-21 09:48:51 WARN  memory usage at 85%
2024-05-21 10:02:33 FATAL OutOfMemory: heap space exhausted
2024-05-21 10:11:07 ERROR DatabaseTimeout while writing audit log
2024-05-21 11:30:00 INFO  health check ok
2024-05-22 00:14:22 ERROR PaymentGatewayError code=502
2024-05-22 00:15:01 ERROR PaymentGatewayError code=502
2024-05-22 03:40:19 FATAL Unhandled exception in worker thread`;

// ---------- State ----------
let state = {
  rows: [], // { lineNo, raw, level, hourKey, dayKey, count, lineSpan }
  result: null,
  granularity: "hour",
  activeLevels: new Set(LEVELS.concat(["OTHER"])),
  search: "",
  searchMode: "plain", // "plain" (keyword) | "regex"
  searchLogic: "and", // "and" | "or" — how multiple plain keywords combine
  timeWindow: null, // { key, granularity } — selected trend bucket, or null
  lastInput: null, // { text, fileCount, label } — for re-analysis on option change
  expandedRows: new Set(),
  expandedDiagnostics: new Set(),
};

// A physical line is a continuation of the previous log event (stack frame,
// "Caused by", indented traceback, etc.) rather than a new event.
function isContinuation(line, prev) {
  if (!prev) return false;
  if (prev.isSpringBootFailure) {
    return !startsWithTimestamp(line) && !startsWithLogLevel(line);
  }
  if (/^\s/.test(line)) return true; // indented (Java frames, Python "  File")
  if (/^(at\s|\.{3}\s?|Caused by:|Suppressed:|Traceback \(most recent)/.test(line)) {
    return true;
  }
  // Flush-left exception header / summary line (no leading timestamp), e.g.
  // "java.lang.NullPointerException: ..." right after the ERROR log line, or
  // Python's trailing "ValueError: bad input" after the "  File ..." lines.
  if (
    !startsWithTimestamp(line) &&
    /^(?:[\w$]+\.)*[\w$]*(?:Exception|Error|Throwable)\b/.test(line)
  ) {
    return true;
  }
  return false;
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

function extractPort(text) {
  const match = text.match(/\bPort\s+(\d+)\s+was already in use\b/i);
  return match?.[1] || "";
}

// ---------- Theme ----------
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const isDark = theme === "dark";
  themeToggle.querySelector(".theme-icon").textContent = isDark ? "☀️" : "🌙";
  themeToggle.querySelector(".theme-label").textContent = isDark ? "浅色" : "深色";
}

(function initTheme() {
  const saved = localStorage.getItem("lh-theme");
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
})();

themeToggle.addEventListener("click", () => {
  const next =
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "light"
      : "dark";
  localStorage.setItem("lh-theme", next);
  applyTheme(next);
});

// ---------- File selection ----------
dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

["dragenter", "dragover"].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
  })
);
dropZone.addEventListener("drop", (e) => {
  const files = e.dataTransfer?.files;
  if (files && files.length) {
    fileInput.files = files;
    renderFileList(files);
    statusEl.textContent = `已选择 ${files.length} 个文件，点击「开始分析」`;
  }
});

fileInput.addEventListener("change", () => {
  renderFileList(fileInput.files);
  if (fileInput.files?.length) {
    statusEl.textContent = `已选择 ${fileInput.files.length} 个文件，点击「开始分析」`;
  }
});

function renderFileList(files) {
  if (!files || !files.length) {
    fileListEl.hidden = true;
    fileListEl.innerHTML = "";
    return;
  }
  fileListEl.hidden = false;
  fileListEl.innerHTML = Array.from(files)
    .map((f) => `<li>${escapeHtml(f.name)} · ${formatBytes(f.size)}</li>`)
    .join("");
}

// ---------- Buttons ----------
analyzeBtn.addEventListener("click", async () => {
  const files = fileInput.files;
  if (!files || !files.length) {
    statusEl.textContent = "请先选择日志文件。";
    return;
  }
  statusEl.textContent = "正在读取并分析日志...";
  const texts = await Promise.all(Array.from(files).map((f) => f.text()));
  runAnalysis(texts.join("\n"), files.length);
});

sampleBtn.addEventListener("click", () => {
  renderFileList(null);
  fileInput.value = "";
  runAnalysis(SAMPLE_LOG, 1, "示例日志");
});

clearBtn.addEventListener("click", () => {
  fileInput.value = "";
  renderFileList(null);
  resultsEl.hidden = true;
  emptyState.hidden = false;
  statusEl.textContent = "等待上传文件";
});

// ---------- Analysis ----------
function runAnalysis(text, fileCount, label) {
  state.lastInput = { text, fileCount, label };
  const opts = {
    mergeStack: optMergeStack.checked,
    collapseDup: optCollapseDup.checked,
  };
  const rows = parseLines(text, opts);
  state.rows = rows;
  state.result = summarize(rows, fileCount);
  state.activeLevels = new Set(LEVELS.concat(["OTHER"]));
  state.search = "";
  state.timeWindow = null;
  state.expandedRows = new Set();
  state.expandedDiagnostics = new Set();
  searchInput.value = "";
  clearSearchError();

  emptyState.hidden = true;
  resultsEl.hidden = false;
  renderMetrics(state.result);
  renderLevelBreakdown(state.result);
  renderFrequency(state.result.frequencies);
  renderTrend();
  renderPatterns(state.result.patterns);
  renderLevelFilters();
  renderPreview();
  hideSample();
  hidePattern();

  const suffix = label ? `（${label}）` : "";
  const r = state.result;
  let note = `分析完成${suffix}：共 ${r.totalLines} 条，错误 ${r.errorLines} 条。`;
  if (r.mergedStacks) note += ` 合并 ${r.mergedStacks} 段多行堆栈。`;
  if (r.collapsedGroups) note += ` 折叠 ${r.collapsedGroups} 组重复行。`;
  statusEl.textContent = note;
}

// Re-run analysis when parse options change (if something is already loaded).
[optMergeStack, optCollapseDup].forEach((cb) =>
  cb.addEventListener("change", () => {
    if (state.lastInput) {
      const { text, fileCount, label } = state.lastInput;
      runAnalysis(text, fileCount, label);
    }
  })
);

function parseLines(text, opts = { mergeStack: true, collapseDup: true }) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let physicalNo = 0;

  // Pass 1: build events, merging multi-line stack continuations.
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

  // Pass 2: collapse consecutive identical events into one with a count.
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

function detectLevel(line) {
  if (isSpringBootFailureTitle(line) || isSpringBootPortInUse(line)) {
    return "ERROR";
  }

  // 1. Structured level field (JSON / logfmt): most authoritative.
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

  // 2. Android logcat positional priority letter (before keyword search so a
  // word like "fatal" in the message can't override the real priority).
  const logcat = line.match(LOGCAT_REGEX);
  if (logcat) return LEVEL_ALIASES[logcat[1]];

  // 3. Plain keyword anywhere in the line.
  const word = line.match(LEVEL_WORD_REGEX);
  if (word) {
    const mapped = LEVEL_ALIASES[word[1].toUpperCase()];
    if (mapped) return mapped;
  }

  return "OTHER";
}

// pino / bunyan numeric levels (10/20/30/40/50/60), tolerant of in-between
// custom values. Values < 10 are ignored to avoid clashing with syslog
// severities (0-7), which use the opposite ordering.
function numericLevel(n) {
  if (n < 10) return null;
  if (n < 20) return "TRACE";
  if (n < 30) return "DEBUG";
  if (n < 40) return "INFO";
  if (n < 50) return "WARN";
  if (n < 60) return "ERROR";
  return "FATAL";
}

function summarize(rows, fileCount) {
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
    const n = row.count; // duplicate-collapse weight (occurrences)
    totalLines += n;
    if (row.merged) mergedStacks += 1;
    if (row.count > 1) collapsedGroups += 1;

    levelCounter.set(row.level, (levelCounter.get(row.level) || 0) + n);

    // Message-pattern clustering across ALL levels.
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

  const frequencies = Array.from(errorTypeCounter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const patterns = Array.from(patternCounter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    totalLines,
    errorLines,
    errorRate: totalLines ? (errorLines / totalLines) * 100 : 0,
    fileCount,
    events: rows.length,
    mergedStacks,
    collapsedGroups,
    levels: levelCounter,
    frequencies,
    errorSamples,
    patterns,
    patternSamples,
    hourTrend: sortTrend(hourCounter),
    dayTrend: sortTrend(dayCounter),
  };
}

// Normalise a log line into a template by replacing variable tokens with
// placeholders, so structurally-similar messages cluster together.
function templateOf(raw) {
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

function sortTrend(counter) {
  return Array.from(counter.entries()).sort((a, b) => {
    if (a[0] === "未识别时间") return 1;
    if (b[0] === "未识别时间") return -1;
    return a[0].localeCompare(b[0]);
  });
}

function extractErrorType(line) {
  if (isSpringBootPortInUse(line)) return "PortAlreadyInUse";
  if (isSpringBootFailureTitle(line)) return "SpringBootStartupFailure";

  // JSON-style message field (winston/pino/bunyan/zap json, etc.).
  const jsonMsg = line.match(
    /["'](?:msg|message|error|err)["']\s*:\s*["']([^"']{1,80})/i
  );
  if (jsonMsg?.[1]) return firstToken(jsonMsg[1]);

  // Keyword followed by an identifier-like token.
  const keywordMatch = line.match(
    /\b(?:ERROR|FATAL|CRITICAL|SEVERE|PANIC)\b[\[\]:=\s-]*([A-Za-z0-9_.$-]+)/i
  );
  if (keywordMatch?.[1]) return keywordMatch[1];

  const cleaned = line.replace(/\s+/g, " ").trim();
  return cleaned.length > MAX_ERROR_TYPE_PREVIEW_LENGTH
    ? `${cleaned.slice(0, MAX_ERROR_TYPE_PREVIEW_LENGTH)}...`
    : cleaned;
}

function springBootFailureSummary(raw) {
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

function firstToken(text) {
  const trimmed = text.trim();
  const token = trimmed.split(/[\s:,]+/)[0];
  return token || trimmed;
}

function extractTimeKeys(line) {
  // 1. ISO / common: YYYY-MM-DD[ T]HH:MM:SS (handles ms, timezone, brackets).
  let m = line.match(TS_ISO_REGEX);
  if (m) {
    const date = `${m[1]}-${m[2]}-${m[3]}`;
    return { hourKey: `${date} ${m[4]}:00`, dayKey: date };
  }

  // 2. Epoch seconds/milliseconds in a JSON/logfmt time field (pino/bunyan).
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

  // 3. Syslog month-name timestamp "May 21 08:31:09" (no year).
  m = line.match(TS_MONTH_REGEX);
  if (m && MONTHS[m[1]]) {
    const date = `${MONTHS[m[1]]}-${String(m[2]).padStart(2, "0")}`;
    return { hourKey: `${date} ${m[3]}:00`, dayKey: date };
  }

  // 4. Android logcat / "MM-DD HH:MM:SS" (no year).
  m = line.match(TS_MMDD_REGEX);
  if (m) {
    const date = `${m[1]}-${m[2]}`;
    return { hourKey: `${date} ${m[3]}:00`, dayKey: date };
  }

  return { hourKey: "未识别时间", dayKey: "未识别时间" };
}

// ---------- Rendering ----------
function renderMetrics(result) {
  totalLinesEl.textContent = String(result.totalLines);
  errorLinesEl.textContent = String(result.errorLines);
  errorRateEl.textContent = `${result.errorRate.toFixed(2)}%`;
  fileCountEl.textContent = String(result.fileCount);
}

function renderLevelBreakdown(result) {
  const order = LEVELS.concat(["OTHER"]);
  const total = result.totalLines || 1;
  const chips = order
    .filter((lvl) => result.levels.get(lvl))
    .map((lvl) => {
      const count = result.levels.get(lvl);
      const pct = ((count / total) * 100).toFixed(1);
      return `
        <div class="level-chip">
          <span class="level-dot" style="background:${levelColor(lvl)}"></span>
          <span>${lvl}</span>
          <span class="chip-count">${count}</span>
          <span class="chip-pct">${pct}%</span>
        </div>`;
    })
    .join("");
  levelBreakdownEl.innerHTML =
    chips || '<p class="muted">未检测到日志级别</p>';
}

function levelColor(lvl) {
  const map = {
    TRACE: "var(--lvl-trace)",
    DEBUG: "var(--lvl-debug)",
    INFO: "var(--lvl-info)",
    WARN: "var(--lvl-warn)",
    ERROR: "var(--lvl-error)",
    FATAL: "var(--lvl-fatal)",
    OTHER: "var(--lvl-other)",
  };
  return map[lvl] || "var(--lvl-other)";
}

function renderFrequency(frequencies) {
  if (!frequencies.length) {
    freqTableBody.innerHTML =
      '<tr><td colspan="2" class="muted">未检测到错误行</td></tr>';
    return;
  }
  freqTableBody.innerHTML = frequencies
    .map(
      ([type, count]) => `
        <tr class="freq-row" data-type="${escapeHtml(type)}">
          <td title="${escapeHtml(type)}">${escapeHtml(type)}</td>
          <td class="num">${count}</td>
        </tr>`
    )
    .join("");

  freqTableBody.querySelectorAll(".freq-row").forEach((tr) => {
    tr.addEventListener("click", () => showSample(tr.dataset.type, tr));
  });
}

function showSample(type, rowEl) {
  const samples = state.result?.errorSamples.get(type) || [];
  freqTableBody
    .querySelectorAll(".freq-row")
    .forEach((r) => r.classList.remove("active"));
  rowEl.classList.add("active");
  sampleTitle.textContent = `样例：${type}`;
  sampleBody.textContent = samples.join("\n") || "（无样例）";
  samplePanel.hidden = false;
}

function hideSample() {
  samplePanel.hidden = true;
  freqTableBody
    .querySelectorAll(".freq-row")
    .forEach((r) => r.classList.remove("active"));
}

sampleClose.addEventListener("click", hideSample);

function renderPatterns(patterns) {
  if (!patterns || !patterns.length) {
    patternTableBody.innerHTML =
      '<tr><td colspan="2" class="muted">暂无数据</td></tr>';
    return;
  }
  patternTableBody.innerHTML = patterns
    .map(
      ([tpl, count], i) => `
        <tr class="pattern-row" data-idx="${i}">
          <td title="${escapeHtml(tpl)}"><code>${escapeHtml(tpl)}</code></td>
          <td class="num">${count}</td>
        </tr>`
    )
    .join("");

  patternTableBody.querySelectorAll(".pattern-row").forEach((tr) => {
    tr.addEventListener("click", () => {
      const [tpl] = patterns[Number(tr.dataset.idx)];
      showPattern(tpl, tr);
    });
  });
}

function showPattern(tpl, rowEl) {
  const samples = state.result?.patternSamples.get(tpl) || [];
  patternTableBody
    .querySelectorAll(".pattern-row")
    .forEach((r) => r.classList.remove("active"));
  rowEl.classList.add("active");
  patternTitle.textContent = `样例：${tpl}`;
  patternBody.textContent = samples.join("\n") || "（无样例）";
  patternPanel.hidden = false;
}

function hidePattern() {
  patternPanel.hidden = true;
  patternTableBody
    .querySelectorAll(".pattern-row")
    .forEach((r) => r.classList.remove("active"));
}

patternClose.addEventListener("click", hidePattern);

function renderTrend() {
  const trend =
    state.granularity === "day"
      ? state.result.dayTrend
      : state.result.hourTrend;

  if (!trend.length) {
    trendChart.innerHTML = '<p class="muted">未检测到错误趋势数据</p>';
    return;
  }
  const gran = state.granularity;
  const selectedKey =
    state.timeWindow && state.timeWindow.granularity === gran
      ? state.timeWindow.key
      : null;
  const maxCount = Math.max(...trend.map(([, count]) => count), 1);
  trendChart.innerHTML = trend
    .map(([label, count]) => {
      const width = Math.max((count / maxCount) * 100, MIN_BAR_WIDTH_PERCENT);
      const selected = label === selectedKey ? " is-selected" : "";
      return `
        <div class="bar-row clickable${selected}" role="button" tabindex="0"
             data-key="${escapeHtml(label)}" title="点击按「${escapeHtml(label)}」过滤">
          <div class="bar-label">${escapeHtml(label)}</div>
          <div class="bar-track"><div class="bar" style="width:${width}%"></div></div>
          <div class="bar-value">${count}</div>
        </div>`;
    })
    .join("");

  trendChart.querySelectorAll(".bar-row.clickable").forEach((row) => {
    const toggle = () => toggleTimeWindow(row.dataset.key);
    row.addEventListener("click", toggle);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });
}

// Select a trend bucket as a time filter; clicking the selected bucket clears it.
function toggleTimeWindow(key) {
  const gran = state.granularity;
  if (
    state.timeWindow &&
    state.timeWindow.granularity === gran &&
    state.timeWindow.key === key
  ) {
    state.timeWindow = null;
  } else {
    state.timeWindow = { key, granularity: gran };
  }
  renderTrend();
  renderPreview();
}

document.querySelectorAll(".seg-btn").forEach((btn) => {
  if (!btn.dataset.granularity) return; // skip AND/OR logic buttons
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".seg-btn[data-granularity]")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.granularity = btn.dataset.granularity;
    // A bucket selected under the other granularity no longer maps cleanly.
    if (state.timeWindow && state.timeWindow.granularity !== state.granularity) {
      state.timeWindow = null;
    }
    renderTrend();
    renderPreview();
  });
});

// ---------- Filters & preview ----------
function renderLevelFilters() {
  const order = LEVELS.concat(["OTHER"]);
  levelFiltersEl.innerHTML = order
    .filter((lvl) => state.result.levels.get(lvl))
    .map(
      (lvl) => `
      <label class="level-filter">
        <input type="checkbox" value="${lvl}" checked />
        <span class="level-dot" style="background:${levelColor(lvl)}"></span>
        ${lvl}
      </label>`
    )
    .join("");

  levelFiltersEl.querySelectorAll("input").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) state.activeLevels.add(cb.value);
      else state.activeLevels.delete(cb.value);
      renderPreview();
    });
  });
}

searchInput.addEventListener("input", () => {
  state.search = searchInput.value.trim();
  renderPreview();
});

document.querySelectorAll('input[name="searchMode"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    if (!radio.checked) return;
    state.searchMode = radio.value;
    // AND/OR only applies to multi-keyword plain search.
    logicSeg.classList.toggle("disabled", state.searchMode !== "plain");
    renderPreview();
  });
});

logicSeg.querySelectorAll(".seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    logicSeg
      .querySelectorAll(".seg-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.searchLogic = btn.dataset.logic;
    renderPreview();
  });
});

// Build a matcher for the current search query/mode. Returns null when there is
// no active search constraint (empty query or an invalid regex we ignore).
function buildSearchMatcher() {
  const query = state.search;
  if (!query) {
    clearSearchError();
    return null;
  }

  if (state.searchMode === "regex") {
    try {
      const re = new RegExp(query, "i");
      clearSearchError();
      return { test: (raw) => re.test(raw), regex: re };
    } catch (err) {
      showSearchError(`正则表达式无效：${err.message}`);
      return null; // fall back to no-search so the app stays usable
    }
  }

  clearSearchError();
  const terms = query.split(/\s+/).filter(Boolean);
  const lowered = terms.map((t) => t.toLowerCase());
  const test = (raw) => {
    const hay = raw.toLowerCase();
    return state.searchLogic === "or"
      ? lowered.some((t) => hay.includes(t))
      : lowered.every((t) => hay.includes(t));
  };
  return { test, terms };
}

function rowInTimeWindow(row) {
  if (!state.timeWindow) return true;
  const key =
    state.timeWindow.granularity === "day" ? row.dayKey : row.hourKey;
  return key === state.timeWindow.key;
}

function renderPreview() {
  const matcher = buildSearchMatcher();
  const filtered = state.rows.filter(
    (row) =>
      state.activeLevels.has(row.level) &&
      rowInTimeWindow(row) &&
      (!matcher || matcher.test(row.raw))
  );

  const shown = filtered.slice(0, PREVIEW_LIMIT);
  previewBody.innerHTML = shown
    .map((row) =>
      renderPreviewRow(row, matcher, {
        expandedStack: state.expandedRows.has(row.lineNo),
        expandedDiagnostic: state.expandedDiagnostics.has(row.lineNo),
      })
    )
    .join("");

  if (!filtered.length) {
    previewBody.innerHTML =
      '<tr><td colspan="3" class="muted">没有匹配的日志行</td></tr>';
  }

  previewBody.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lineNo = Number(btn.dataset.lineNo);
      if (btn.dataset.action === "toggle-stack") {
        toggleExpandedSet(state.expandedRows, lineNo);
      }
      if (btn.dataset.action === "toggle-diagnostic") {
        toggleExpandedSet(state.expandedDiagnostics, lineNo);
      }
      renderPreview();
    });
  });

  renderActiveFilters(filtered.length);

  let meta = `显示 ${shown.length} / ${filtered.length} 条`;
  if (filtered.length > PREVIEW_LIMIT) {
    meta += `（仅预览前 ${PREVIEW_LIMIT} 条）`;
  }
  if (state.result) {
    meta += ` · 共 ${state.result.events} 条事件 / ${state.result.totalLines} 行`;
  }
  previewMeta.textContent = meta;
}

function renderPreviewRow(row, matcher, opts = {}) {
  const key = row.lineNo;
  const diagnostic = findDiagnostic(row);
  const hasStack = row.lineSpan > 1;
  const dup = row.count > 1 ? `<span class="dup-badge">×${row.count}</span>` : "";
  const summary = opts.expandedStack ? row.raw : previewSummary(row.raw);
  const stack = hasStack
    ? `<button class="stack-badge detail-toggle" type="button" data-action="toggle-stack" data-line-no="${key}">${
        opts.expandedStack ? "收起" : "堆栈"
      } ${row.lineSpan} 行</button>`
    : "";
  const diagnosticButton = diagnostic
    ? `<button class="diagnostic-badge detail-toggle" type="button" data-action="toggle-diagnostic" data-line-no="${key}">诊断建议</button>`
    : "";
  const detailRows = [];

  if (opts.expandedStack && hasStack) {
    detailRows.push(`
      <tr class="preview-detail-row">
        <td></td>
        <td colspan="2">
          <pre class="stack-detail">${highlight(row.raw, matcher)}</pre>
        </td>
      </tr>`);
  }

  if (opts.expandedDiagnostic && diagnostic) {
    detailRows.push(renderDiagnosticDetail(diagnostic));
  }

  return `
      <tr>
        <td class="num">${row.lineNo}</td>
        <td class="lvl"><span class="badge badge-${row.level}">${row.level}</span>${dup}</td>
        <td class="line-content">${highlight(summary, matcher)}${stack}${diagnosticButton}</td>
      </tr>${detailRows.join("")}`;
}

function previewSummary(raw) {
  const summary = springBootFailureSummary(raw);
  if (summary) return summary;
  return raw.split(/\r?\n/)[0];
}

function findDiagnostic(row) {
  if (!row || !ERROR_LEVELS.has(row.level)) return null;
  const rule = DIAGNOSTIC_RULES.find((item) => item.match(row));
  if (!rule) return null;
  return {
    id: rule.id,
    title: rule.title,
    reason: rule.reason(row),
    details: rule.details,
    solutions: rule.solutions,
  };
}

function renderDiagnosticDetail(diagnostic) {
  return `
      <tr class="preview-detail-row">
        <td></td>
        <td colspan="2">
          <div class="diagnostic-detail">
            <strong>${escapeHtml(diagnostic.title)}</strong>
            <p>${escapeHtml(diagnostic.reason)}</p>
            ${renderDiagnosticList("常见原因", diagnostic.details)}
            ${renderDiagnosticList("解决方案", diagnostic.solutions)}
          </div>
        </td>
      </tr>`;
}

function renderDiagnosticList(title, items) {
  if (!items?.length) return "";
  return `
    <div class="diagnostic-section">
      <span>${escapeHtml(title)}</span>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>`;
}

function toggleExpandedSet(set, value) {
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

// Render chips for the currently-active filters plus a clear-all control.
function renderActiveFilters(matchCount) {
  const chips = [];
  if (state.timeWindow) {
    const granLabel = state.timeWindow.granularity === "day" ? "按天" : "按小时";
    chips.push(
      `<button class="filter-chip" data-clear="time" type="button">时段（${granLabel}）：${escapeHtml(
        state.timeWindow.key
      )} ✕</button>`
    );
  }
  const inactiveLevels = LEVELS.concat(["OTHER"]).filter(
    (lvl) => state.result?.levels.get(lvl) && !state.activeLevels.has(lvl)
  );
  if (inactiveLevels.length) {
    chips.push(
      `<span class="filter-chip muted-chip">已隐藏级别：${inactiveLevels.join("、")}</span>`
    );
  }
  if (state.search) {
    const modeLabel = state.searchMode === "regex" ? "正则" : "关键字";
    chips.push(
      `<button class="filter-chip" data-clear="search" type="button">${modeLabel}：${escapeHtml(
        state.search
      )} ✕</button>`
    );
  }

  if (!chips.length) {
    activeFiltersEl.hidden = true;
    activeFiltersEl.innerHTML = "";
    return;
  }

  activeFiltersEl.hidden = false;
  activeFiltersEl.innerHTML =
    `<span class="muted small">命中 ${matchCount} 条 ·</span>` +
    chips.join("") +
    `<button class="filter-chip clear-all" data-clear="all" type="button">清除全部</button>`;

  activeFiltersEl.querySelectorAll("[data-clear]").forEach((el) => {
    el.addEventListener("click", () => clearFilter(el.dataset.clear));
  });
}

function clearFilter(kind) {
  if (kind === "time" || kind === "all") state.timeWindow = null;
  if (kind === "search" || kind === "all") {
    state.search = "";
    searchInput.value = "";
    clearSearchError();
  }
  if (kind === "all") {
    state.activeLevels = new Set(LEVELS.concat(["OTHER"]));
    levelFiltersEl
      .querySelectorAll("input")
      .forEach((cb) => (cb.checked = true));
  }
  renderTrend();
  renderPreview();
}

function showSearchError(msg) {
  searchErrorEl.textContent = msg;
  searchErrorEl.hidden = false;
}

function clearSearchError() {
  searchErrorEl.hidden = true;
  searchErrorEl.textContent = "";
}

function highlight(text, matcher) {
  const escaped = escapeHtml(text);
  if (!matcher) return escaped;

  if (matcher.regex) {
    const re = new RegExp(matcher.regex.source, "gi");
    return escaped.replace(re, (m) => (m ? `<mark>${m}</mark>` : m));
  }

  if (matcher.terms && matcher.terms.length) {
    const alt = matcher.terms
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .filter(Boolean)
      .join("|");
    if (!alt) return escaped;
    return escaped.replace(new RegExp(alt, "gi"), (m) => `<mark>${m}</mark>`);
  }
  return escaped;
}

// ---------- Export ----------
exportJsonBtn.addEventListener("click", () => {
  if (!state.result) return;
  const r = state.result;
  const payload = {
    generatedAt: new Date().toISOString(),
    totalLines: r.totalLines,
    errorLines: r.errorLines,
    errorRate: Number(r.errorRate.toFixed(2)),
    fileCount: r.fileCount,
    events: r.events,
    mergedStacks: r.mergedStacks,
    collapsedGroups: r.collapsedGroups,
    levels: Object.fromEntries(r.levels),
    errorTypes: r.frequencies.map(([type, count]) => ({ type, count })),
    messagePatterns: r.patterns.map(([pattern, count]) => ({ pattern, count })),
    hourTrend: r.hourTrend.map(([time, count]) => ({ time, count })),
    dayTrend: r.dayTrend.map(([date, count]) => ({ date, count })),
  };
  download(
    "log-report.json",
    JSON.stringify(payload, null, 2),
    "application/json"
  );
});

exportCsvBtn.addEventListener("click", () => {
  if (!state.result) return;
  const rows = [["error_type", "count"]];
  state.result.frequencies.forEach(([type, count]) =>
    rows.push([type, String(count)])
  );
  const csv = rows
    .map((cols) => cols.map(csvCell).join(","))
    .join("\n");
  download("log-error-types.csv", csv, "text/csv");
});

function csvCell(value) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Utils ----------
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
