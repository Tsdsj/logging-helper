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
const levelFiltersEl = document.getElementById("levelFilters");
const previewBody = document.getElementById("previewBody");
const previewMeta = document.getElementById("previewMeta");

const exportJsonBtn = document.getElementById("exportJsonBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");

const optMergeStack = document.getElementById("optMergeStack");
const optCollapseDup = document.getElementById("optCollapseDup");

const levelRuleList = document.getElementById("levelRuleList");
const addLevelRuleBtn = document.getElementById("addLevelRule");
const tsRuleInput = document.getElementById("tsRuleInput");
const tsRuleError = document.getElementById("tsRuleError");
const errorTypeRuleInput = document.getElementById("errorTypeRuleInput");
const errorTypeRuleError = document.getElementById("errorTypeRuleError");
const resetRulesBtn = document.getElementById("resetRules");

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
  lastInput: null, // { text, fileCount, label } — for re-analysis on option change
};

// A physical line is a continuation of the previous log event (stack frame,
// "Caused by", indented traceback, etc.) rather than a new event.
function isContinuation(line, prev) {
  if (!prev) return false;
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
  searchInput.value = "";

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
  if (hasActiveRules()) note += ` 已应用自定义规则。`;
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

// ---------- Custom parse rules ----------
// User-defined regex that override the built-in level / timestamp / error-type
// detection. Persisted to localStorage so they survive reloads.
const CUSTOM_RULES_KEY = "lh-custom-rules";
let customRules = loadCustomRules();
// Compiled forms (RegExp objects) used by the detect* functions; recompiled
// whenever the rules change. Invalid patterns are skipped (kept out of here).
let compiledRules = { levelRules: [], tsRe: null, errorTypeRe: null };

function defaultCustomRules() {
  return { levelRules: [], tsPattern: "", errorTypePattern: "" };
}

function loadCustomRules() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_RULES_KEY) || "");
    return {
      levelRules: Array.isArray(parsed.levelRules)
        ? parsed.levelRules
            .filter((r) => r && typeof r.pattern === "string")
            .map((r) => ({
              pattern: r.pattern,
              level: LEVELS.includes(r.level) ? r.level : "ERROR",
            }))
        : [],
      tsPattern: typeof parsed.tsPattern === "string" ? parsed.tsPattern : "",
      errorTypePattern:
        typeof parsed.errorTypePattern === "string"
          ? parsed.errorTypePattern
          : "",
    };
  } catch {
    return defaultCustomRules();
  }
}

function saveCustomRules() {
  localStorage.setItem(CUSTOM_RULES_KEY, JSON.stringify(customRules));
}

function hasActiveRules() {
  return (
    compiledRules.levelRules.length > 0 ||
    compiledRules.tsRe !== null ||
    compiledRules.errorTypeRe !== null
  );
}

// Compile rules into RegExp objects, returning per-field error messages so the
// UI can flag invalid patterns. Invalid patterns are simply not applied.
function compileRules() {
  const errors = { levels: [], ts: "", errorType: "" };
  compiledRules.levelRules = [];
  customRules.levelRules.forEach((r, i) => {
    errors.levels[i] = "";
    if (!r.pattern) return;
    try {
      compiledRules.levelRules.push({ re: new RegExp(r.pattern), level: r.level });
    } catch (e) {
      errors.levels[i] = e.message;
    }
  });

  compiledRules.tsRe = null;
  if (customRules.tsPattern) {
    try {
      compiledRules.tsRe = new RegExp(customRules.tsPattern);
    } catch (e) {
      errors.ts = e.message;
    }
  }

  compiledRules.errorTypeRe = null;
  if (customRules.errorTypePattern) {
    try {
      compiledRules.errorTypeRe = new RegExp(customRules.errorTypePattern);
    } catch (e) {
      errors.errorType = e.message;
    }
  }
  return errors;
}

// Build hour/day keys from a custom timestamp regex's named capture groups.
function customTimeKeys(line) {
  const m = line.match(compiledRules.tsRe);
  if (!m || !m.groups) return null;
  const g = m.groups;
  if (!g.h) return null; // need at least an hour to bucket
  let date;
  if (g.y && g.mo && g.d) {
    date = `${g.y}-${pad2(g.mo)}-${pad2(g.d)}`;
  } else if (g.mo && g.d) {
    date = `${pad2(g.mo)}-${pad2(g.d)}`;
  } else {
    return null;
  }
  return { hourKey: `${date} ${pad2(g.h)}:00`, dayKey: date };
}

function pad2(v) {
  return String(v).padStart(2, "0");
}

// ----- Custom-rules UI -----
function renderLevelRules() {
  if (!customRules.levelRules.length) {
    levelRuleList.innerHTML =
      '<p class="muted small cr-empty">尚无级别规则。</p>';
    return;
  }
  levelRuleList.innerHTML = customRules.levelRules
    .map(
      (r, i) => `
      <div class="cr-rule" data-idx="${i}">
        <input type="text" class="cr-input lr-pattern" spellcheck="false"
          value="${escapeHtml(r.pattern)}" placeholder="正则，如 \\bDENIED\\b" />
        <select class="lr-level">
          ${LEVELS.map(
            (l) => `<option value="${l}"${l === r.level ? " selected" : ""}>${l}</option>`
          ).join("")}
        </select>
        <button type="button" class="ghost-btn small lr-remove" title="删除规则">✕</button>
        <p class="cr-error lr-error" hidden></p>
      </div>`
    )
    .join("");

  levelRuleList.querySelectorAll(".cr-rule").forEach((row) => {
    const idx = Number(row.dataset.idx);
    row.querySelector(".lr-pattern").addEventListener("input", (e) => {
      customRules.levelRules[idx].pattern = e.target.value;
      refreshRules();
    });
    row.querySelector(".lr-level").addEventListener("change", (e) => {
      customRules.levelRules[idx].level = e.target.value;
      refreshRules();
    });
    row.querySelector(".lr-remove").addEventListener("click", () => {
      customRules.levelRules.splice(idx, 1);
      renderLevelRules();
      refreshRules();
    });
  });
}

// Recompile, surface validation errors, persist, and re-analyse if data loaded.
function refreshRules() {
  const errors = compileRules();

  setFieldError(tsRuleInput, tsRuleError, errors.ts);
  setFieldError(errorTypeRuleInput, errorTypeRuleError, errors.errorType);
  levelRuleList.querySelectorAll(".cr-rule").forEach((row) => {
    const idx = Number(row.dataset.idx);
    setFieldError(
      row.querySelector(".lr-pattern"),
      row.querySelector(".lr-error"),
      errors.levels[idx] || ""
    );
  });

  saveCustomRules();
  if (state.lastInput) {
    const { text, fileCount, label } = state.lastInput;
    runAnalysis(text, fileCount, label);
  }
}

function setFieldError(inputEl, errorEl, message) {
  const invalid = Boolean(message);
  inputEl.classList.toggle("invalid", invalid);
  errorEl.hidden = !invalid;
  errorEl.textContent = invalid ? `正则无效：${message}` : "";
}

addLevelRuleBtn.addEventListener("click", () => {
  customRules.levelRules.push({ pattern: "", level: "ERROR" });
  renderLevelRules();
});

tsRuleInput.addEventListener("input", () => {
  customRules.tsPattern = tsRuleInput.value;
  refreshRules();
});

errorTypeRuleInput.addEventListener("input", () => {
  customRules.errorTypePattern = errorTypeRuleInput.value;
  refreshRules();
});

resetRulesBtn.addEventListener("click", () => {
  customRules = defaultCustomRules();
  tsRuleInput.value = "";
  errorTypeRuleInput.value = "";
  renderLevelRules();
  refreshRules();
});

(function initCustomRules() {
  tsRuleInput.value = customRules.tsPattern;
  errorTypeRuleInput.value = customRules.errorTypePattern;
  renderLevelRules();
  compileRules();
})();

function parseLines(text, opts = { mergeStack: true, collapseDup: true }) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let physicalNo = 0;

  // Pass 1: build events, merging multi-line stack continuations.
  for (const raw of lines) {
    if (raw.trim() === "") continue;
    physicalNo += 1;
    const prev = entries[entries.length - 1];
    if (opts.mergeStack && isContinuation(raw, prev)) {
      prev.raw += `\n${raw}`;
      prev.lineSpan += 1;
      prev.merged = true;
      continue;
    }
    entries.push({
      lineNo: physicalNo,
      raw,
      level: detectLevel(raw),
      ...extractTimeKeys(raw),
      count: 1,
      lineSpan: 1,
      merged: false,
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
  // 0. User-defined level rules take precedence over everything else.
  for (const { re, level } of compiledRules.levelRules) {
    if (re.test(line)) return level;
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
  let s = raw.split("\n")[0];
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
  // 0. User-defined error-type rule: capture group "type" or group 1.
  if (compiledRules.errorTypeRe) {
    const m = line.match(compiledRules.errorTypeRe);
    if (m) {
      const captured = (m.groups && m.groups.type) || m[1] || m[0];
      if (captured) {
        const value = captured.trim();
        return value.length > MAX_ERROR_TYPE_PREVIEW_LENGTH
          ? `${value.slice(0, MAX_ERROR_TYPE_PREVIEW_LENGTH)}...`
          : value;
      }
    }
  }

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

function firstToken(text) {
  const trimmed = text.trim();
  const token = trimmed.split(/[\s:,]+/)[0];
  return token || trimmed;
}

function extractTimeKeys(line) {
  // 0. User-defined timestamp rule (named groups y/mo/d/h) takes precedence.
  if (compiledRules.tsRe) {
    const custom = customTimeKeys(line);
    if (custom) return custom;
  }

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
  const maxCount = Math.max(...trend.map(([, count]) => count), 1);
  trendChart.innerHTML = trend
    .map(([label, count]) => {
      const width = Math.max((count / maxCount) * 100, MIN_BAR_WIDTH_PERCENT);
      return `
        <div class="bar-row">
          <div class="bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
          <div class="bar-track"><div class="bar" style="width:${width}%"></div></div>
          <div class="bar-value">${count}</div>
        </div>`;
    })
    .join("");
}

document.querySelectorAll(".seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".seg-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.granularity = btn.dataset.granularity;
    renderTrend();
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
  state.search = searchInput.value.trim().toLowerCase();
  renderPreview();
});

function renderPreview() {
  const search = state.search;
  const filtered = state.rows.filter(
    (row) =>
      state.activeLevels.has(row.level) &&
      (search === "" || row.raw.toLowerCase().includes(search))
  );

  const shown = filtered.slice(0, PREVIEW_LIMIT);
  previewBody.innerHTML = shown
    .map((row) => {
      const dup = row.count > 1 ? `<span class="dup-badge">×${row.count}</span>` : "";
      const stack =
        row.lineSpan > 1 ? `<span class="stack-badge">堆栈 ${row.lineSpan} 行</span>` : "";
      return `
      <tr>
        <td class="num">${row.lineNo}</td>
        <td class="lvl"><span class="badge badge-${row.level}">${row.level}</span>${dup}</td>
        <td class="line-content">${highlight(row.raw, search)}${stack}</td>
      </tr>`;
    })
    .join("");

  if (!filtered.length) {
    previewBody.innerHTML =
      '<tr><td colspan="3" class="muted">没有匹配的日志行</td></tr>';
  }

  let meta = `显示 ${shown.length} / ${filtered.length} 条`;
  if (filtered.length > PREVIEW_LIMIT) {
    meta += `（仅预览前 ${PREVIEW_LIMIT} 条）`;
  }
  if (state.result) {
    meta += ` · 共 ${state.result.events} 条事件 / ${state.result.totalLines} 行`;
  }
  previewMeta.textContent = meta;
}

function highlight(text, search) {
  const escaped = escapeHtml(text);
  if (!search) return escaped;
  const safe = escapeHtml(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escaped.replace(new RegExp(safe, "gi"), (m) => `<mark>${m}</mark>`);
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
