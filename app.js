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

const themeToggle = document.getElementById("themeToggle");

// ---------- Constants ----------
const LEVELS = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"];
const LEVEL_REGEX = /\b(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|CRITICAL)\b/i;
const ERROR_LEVELS = new Set(["ERROR", "FATAL"]);
// Matches a broad set of timestamp formats and captures date + hour.
const TS_REGEX =
  /(\d{4}-\d{2}-\d{2})[ T](\d{2}):\d{2}:\d{2}|\[(\d{4}-\d{2}-\d{2})[ T](\d{2}):\d{2}:\d{2}/;
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
  rows: [], // { lineNo, raw, level, hourKey, dayKey }
  result: null,
  granularity: "hour",
  activeLevels: new Set(LEVELS.concat(["OTHER"])),
  search: "",
};

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
  const rows = parseLines(text);
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
  renderLevelFilters();
  renderPreview();
  hideSample();

  const suffix = label ? `（${label}）` : "";
  statusEl.textContent = `分析完成${suffix}：共 ${state.result.totalLines} 行，错误 ${state.result.errorLines} 行。`;
}

function parseLines(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  let lineNo = 0;
  for (const raw of lines) {
    if (raw.trim() === "") continue;
    lineNo += 1;
    const level = detectLevel(raw);
    const { hourKey, dayKey } = extractTimeKeys(raw);
    rows.push({ lineNo, raw, level, hourKey, dayKey });
  }
  return rows;
}

function detectLevel(line) {
  const m = line.match(LEVEL_REGEX);
  if (!m) return "OTHER";
  let lvl = m[1].toUpperCase();
  if (lvl === "WARNING") lvl = "WARN";
  if (lvl === "CRITICAL") lvl = "FATAL";
  return lvl;
}

function summarize(rows, fileCount) {
  const totalLines = rows.length;
  const levelCounter = new Map();
  const errorTypeCounter = new Map();
  const errorSamples = new Map();
  const hourCounter = new Map();
  const dayCounter = new Map();
  let errorLines = 0;

  for (const row of rows) {
    levelCounter.set(row.level, (levelCounter.get(row.level) || 0) + 1);
    if (!ERROR_LEVELS.has(row.level)) continue;

    errorLines += 1;
    const type = extractErrorType(row.raw);
    errorTypeCounter.set(type, (errorTypeCounter.get(type) || 0) + 1);
    if (!errorSamples.has(type)) errorSamples.set(type, []);
    const samples = errorSamples.get(type);
    if (samples.length < 5) samples.push(row.raw);

    hourCounter.set(row.hourKey, (hourCounter.get(row.hourKey) || 0) + 1);
    dayCounter.set(row.dayKey, (dayCounter.get(row.dayKey) || 0) + 1);
  }

  const frequencies = Array.from(errorTypeCounter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    totalLines,
    errorLines,
    errorRate: totalLines ? (errorLines / totalLines) * 100 : 0,
    fileCount,
    levels: levelCounter,
    frequencies,
    errorSamples,
    hourTrend: sortTrend(hourCounter),
    dayTrend: sortTrend(dayCounter),
  };
}

function sortTrend(counter) {
  return Array.from(counter.entries()).sort((a, b) => {
    if (a[0] === "未识别时间") return 1;
    if (b[0] === "未识别时间") return -1;
    return a[0].localeCompare(b[0]);
  });
}

function extractErrorType(line) {
  const keywordMatch = line.match(
    /\b(?:ERROR|FATAL|CRITICAL)\b[\[\]:\s-]*([A-Za-z0-9_.-]+)/i
  );
  if (keywordMatch?.[1]) return keywordMatch[1];

  const cleaned = line.replace(/\s+/g, " ").trim();
  return cleaned.length > MAX_ERROR_TYPE_PREVIEW_LENGTH
    ? `${cleaned.slice(0, MAX_ERROR_TYPE_PREVIEW_LENGTH)}...`
    : cleaned;
}

function extractTimeKeys(line) {
  const match = line.match(TS_REGEX);
  if (!match) return { hourKey: "未识别时间", dayKey: "未识别时间" };
  const date = match[1] || match[3];
  const hour = match[2] || match[4];
  return { hourKey: `${date} ${hour}:00`, dayKey: date };
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
    .map(
      (row) => `
      <tr>
        <td class="num">${row.lineNo}</td>
        <td class="lvl"><span class="badge badge-${row.level}">${row.level}</span></td>
        <td class="line-content">${highlight(row.raw, search)}</td>
      </tr>`
    )
    .join("");

  if (!filtered.length) {
    previewBody.innerHTML =
      '<tr><td colspan="3" class="muted">没有匹配的日志行</td></tr>';
  }

  let meta = `显示 ${shown.length} / ${filtered.length} 行`;
  if (filtered.length > PREVIEW_LIMIT) {
    meta += `（仅预览前 ${PREVIEW_LIMIT} 行）`;
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
    levels: Object.fromEntries(r.levels),
    errorTypes: r.frequencies.map(([type, count]) => ({ type, count })),
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
