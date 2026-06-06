import { LEVELS, parseLines, summarize } from "./js/parser.mjs";
import { buildCustomDiagnosticsTemplateDownload } from "./js/custom-diagnostics.mjs";
import { loadDiagnosticRules } from "./js/diagnostics.mjs";
import { countSeverities } from "./js/severity.mjs";
import { selectTimelineEvents } from "./js/timeline.mjs";
import { buildSearchMatcher, renderPreviewRow } from "./js/preview.mjs";
import {
  renderActiveFilterHtml,
  renderFrequencyRows,
  renderLevelBreakdownHtml,
  renderLevelFilterHtml,
  renderPatternGroups,
  renderSeveritySummaryHtml,
  renderTimelineHtml,
  renderTrendChart,
} from "./js/renderers.mjs";
import { buildPatternGroups } from "./js/patterns.mjs";
import { BUILT_IN_SAMPLE_LOGS, combinedSampleLog, findSampleLog } from "./js/sample-logs.mjs";
import { escapeHtml, formatBytes } from "./js/utils.mjs";

// ---------- DOM ----------
const fileInput = document.getElementById("logFile");
const customDiagnosticsFile = document.getElementById("customDiagnosticsFile");
const dropZone = document.getElementById("dropZone");
const analyzeBtn = document.getElementById("analyzeBtn");
const sampleSelect = document.getElementById("sampleSelect");
const sampleBtn = document.getElementById("sampleBtn");
const clearBtn = document.getElementById("clearBtn");
const customDiagnosticsBtn = document.getElementById("customDiagnosticsBtn");
const customDiagnosticsTemplateBtn = document.getElementById("customDiagnosticsTemplateBtn");
const customDiagnosticsStatus = document.getElementById("customDiagnosticsStatus");
const statusEl = document.getElementById("status");
const analyzeProgress = document.getElementById("analyzeProgress");
const analyzeProgressBar = document.getElementById("analyzeProgressBar");
const analyzeProgressLabel = document.getElementById("analyzeProgressLabel");
const fileListEl = document.getElementById("fileList");
const emptyState = document.getElementById("emptyState");
const resultsEl = document.getElementById("results");
const totalLinesEl = document.getElementById("totalLines");
const errorLinesEl = document.getElementById("errorLines");
const errorRateEl = document.getElementById("errorRate");
const fileCountEl = document.getElementById("fileCount");
const severitySummaryCard = document.getElementById("severitySummaryCard");
const severitySummaryEl = document.getElementById("severitySummary");
const timelineCard = document.getElementById("timelineCard");
const eventTimelineEl = document.getElementById("eventTimeline");
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
const patternGroupsEl = document.getElementById("patternGroups");
const themeToggle = document.getElementById("themeToggle");

const WORKER_THRESHOLD = 200_000;
let analysisWorker = null;
let workerBroken = false;
let workerJobSeq = 0;
let pendingJob = null;

const PREVIEW_LIMIT = 500;

const state = {
  rows: [],
  result: null,
  granularity: "hour",
  activeLevels: new Set(LEVELS.concat(["OTHER"])),
  search: "",
  searchMode: "plain",
  searchLogic: "and",
  timeWindow: null,
  lastInput: null,
  expandedRows: new Set(),
  expandedDiagnostics: new Set(),
  expandedContexts: new Set(),
  expandedReports: new Set(),
  expandedGroups: new Set(),
  diagnosticRules: [],
  builtInDiagnosticRules: [],
  customDiagnosticRules: [],
  identifierFilter: null,
  focusedLineNo: null,
  hiddenFocusedLine: false,
};

init();

async function init() {
  applyTheme(savedTheme());
  populateSampleSelect();
  bindEvents();
  state.builtInDiagnosticRules = await loadKnowledgeBase();
  refreshDiagnosticRules();
  if (state.result) renderPreview();
}

function populateSampleSelect() {
  if (!sampleSelect) return;
  sampleSelect.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = `全部内置示例（${BUILT_IN_SAMPLE_LOGS.length} 份）`;
  sampleSelect.appendChild(allOption);

  for (const sample of BUILT_IN_SAMPLE_LOGS) {
    const option = document.createElement("option");
    option.value = sample.id;
    option.textContent = sample.label;
    sampleSelect.appendChild(option);
  }
}

async function loadKnowledgeBase() {
  try {
    const res = await fetch("./diagnostics.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return loadDiagnosticRules(await res.json());
  } catch (err) {
    console.warn("Failed to load diagnostics knowledge base", err);
    statusEl.textContent = "知识库加载失败，日志分析仍可继续。";
    return [];
  }
}

function refreshDiagnosticRules() {
  state.diagnosticRules = state.builtInDiagnosticRules.concat(state.customDiagnosticRules);
}

function bindEvents() {
  themeToggle.addEventListener("click", toggleTheme);
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
  dropZone.addEventListener("drop", handleDrop);
  fileInput.addEventListener("change", handleFileChange);
  analyzeBtn.addEventListener("click", analyzeSelectedFiles);
  sampleBtn.addEventListener("click", loadSample);
  clearBtn.addEventListener("click", clearAll);
  customDiagnosticsBtn.addEventListener("click", () => customDiagnosticsFile.click());
  customDiagnosticsFile.addEventListener("change", importCustomDiagnostics);
  customDiagnosticsTemplateBtn.addEventListener("click", exportCustomDiagnosticsTemplate);
  sampleClose.addEventListener("click", hideSample);
  [optMergeStack, optCollapseDup].forEach((cb) =>
    cb.addEventListener("change", rerunAnalysis)
  );
  searchInput.addEventListener("input", () => {
    state.search = searchInput.value.trim();
    renderPreview();
  });
  document.querySelectorAll('input[name="searchMode"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state.searchMode = radio.value;
      logicSeg.classList.toggle("disabled", state.searchMode !== "plain");
      renderPreview();
    });
  });
  logicSeg.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      logicSeg.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.searchLogic = btn.dataset.logic;
      renderPreview();
    });
  });
  document.querySelectorAll(".seg-btn[data-granularity]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".seg-btn[data-granularity]")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.granularity = btn.dataset.granularity;
      if (state.timeWindow?.granularity !== state.granularity) state.timeWindow = null;
      renderTrend();
      renderPreview();
    });
  });
  exportJsonBtn.addEventListener("click", exportJson);
  exportCsvBtn.addEventListener("click", exportCsv);
}

function savedTheme() {
  const saved = localStorage.getItem("lh-theme");
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return saved || (prefersDark ? "dark" : "light");
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const isDark = theme === "dark";
  themeToggle.querySelector(".theme-icon").textContent = isDark ? "☀️" : "🌙";
  themeToggle.querySelector(".theme-label").textContent = isDark ? "浅色" : "深色";
}

function toggleTheme() {
  const next =
    document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  localStorage.setItem("lh-theme", next);
  applyTheme(next);
}

function handleDrop(e) {
  const files = e.dataTransfer?.files;
  if (!files?.length) return;
  fileInput.files = files;
  renderFileList(files);
  statusEl.textContent = `已选择 ${files.length} 个文件，点击「开始分析」`;
}

function handleFileChange() {
  renderFileList(fileInput.files);
  if (fileInput.files?.length) {
    statusEl.textContent = `已选择 ${fileInput.files.length} 个文件，点击「开始分析」`;
  }
}

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

async function analyzeSelectedFiles() {
  const files = fileInput.files;
  if (!files?.length) {
    statusEl.textContent = "请先选择日志文件。";
    return;
  }
  setAnalyzing(true);
  statusEl.textContent = "正在读取并分析日志…";
  try {
    showProgress(2, "读取文件…");
    const totalBytes = Array.from(files).reduce((sum, f) => sum + f.size, 0) || 1;
    const texts = [];
    let readBytes = 0;
    for (const file of files) {
      const text = await readFileWithProgress(file, (loaded) => {
        const frac = Math.min((readBytes + loaded) / totalBytes, 1);
        showProgress(2 + frac * 48, `读取文件… ${Math.round(frac * 100)}%`);
      });
      texts.push(text);
      readBytes += file.size;
    }
    showProgress(52, "准备分析…");
    await runAnalysis(texts.join("\n"), files.length);
  } catch (err) {
    statusEl.textContent = `读取或分析失败：${err.message}`;
  } finally {
    setAnalyzing(false);
  }
}

function loadSample() {
  const selected = selectedSampleLog();
  renderFileList(null);
  fileInput.value = "";
  runAnalysis(selected.content, selected.fileCount, selected.label);
}

function selectedSampleLog() {
  const selectedId = sampleSelect?.value || "all";
  if (selectedId === "all") return combinedSampleLog();

  const sample = findSampleLog(selectedId);
  if (!sample) return combinedSampleLog();

  return {
    label: sample.label,
    fileCount: 1,
    content: sample.content,
  };
}

function readFileWithProgress(file, onProgress) {
  if (typeof FileReader === "undefined") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded);
    };
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
    reader.readAsText(file);
  });
}

function clearAll() {
  fileInput.value = "";
  renderFileList(null);
  state.rows = [];
  state.result = null;
  state.lastInput = null;
  resetFilters();
  totalLinesEl.textContent = "0";
  errorLinesEl.textContent = "0";
  errorRateEl.textContent = "0%";
  fileCountEl.textContent = "0";
  severitySummaryCard.hidden = true;
  severitySummaryEl.innerHTML = "";
  timelineCard.hidden = true;
  eventTimelineEl.innerHTML = "";
  levelBreakdownEl.innerHTML = "";
  freqTableBody.innerHTML = '<tr><td colspan="2" class="muted">暂无数据</td></tr>';
  trendChart.innerHTML = '<p class="muted">暂无数据</p>';
  patternGroupsEl.innerHTML = '<p class="muted">暂无数据</p>';
  previewBody.innerHTML = "";
  previewMeta.textContent = "";
  activeFiltersEl.hidden = true;
  activeFiltersEl.innerHTML = "";
  hideSample();
  resultsEl.hidden = true;
  emptyState.hidden = false;
  statusEl.textContent = "等待上传文件";
}

async function importCustomDiagnostics() {
  const file = customDiagnosticsFile.files?.[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    const customRules = loadDiagnosticRules(parsed);
    state.customDiagnosticRules = customRules;
    refreshDiagnosticRules();
    customDiagnosticsStatus.textContent = `已导入 ${customRules.length} 条自定义规则：${file.name}`;
    customDiagnosticsStatus.classList.remove("error");
    if (state.result) renderPreview();
  } catch (err) {
    customDiagnosticsStatus.textContent = `自定义知识库无效：${err.message}`;
    customDiagnosticsStatus.classList.add("error");
  } finally {
    customDiagnosticsFile.value = "";
  }
}

function exportCustomDiagnosticsTemplate() {
  const template = buildCustomDiagnosticsTemplateDownload();
  download(template.filename, template.content, template.type);
}

function rerunAnalysis() {
  if (!state.lastInput) return;
  const { text, fileCount, label } = state.lastInput;
  runAnalysis(text, fileCount, label);
}

async function runAnalysis(text, fileCount, label) {
  state.lastInput = { text, fileCount, label };
  const opts = {
    mergeStack: optMergeStack.checked,
    collapseDup: optCollapseDup.checked,
  };
  const useWorker = canUseWorker(text);
  if (useWorker) showProgress(60, "解析日志…");

  let analysis;
  try {
    analysis = useWorker
      ? await analyzeInWorker(text, fileCount, opts)
      : analyzeSync(text, fileCount, opts);
  } catch (err) {
    console.warn("Worker analysis failed; falling back to main thread.", err);
    analysis = analyzeSync(text, fileCount, opts);
  }

  applyAnalysis(analysis.rows, analysis.result, fileCount, label);
  if (useWorker) hideProgress();
}

function analyzeSync(text, fileCount, opts) {
  const rows = parseLines(text, opts);
  const result = summarize(rows, fileCount);
  result.patternGroups = buildPatternGroups(rows);
  return { rows, result };
}

function applyAnalysis(rows, result, fileCount, label) {
  state.rows = rows;
  state.result = result;
  if (!state.result.patternGroups) state.result.patternGroups = buildPatternGroups(rows);
  resetFilters();

  emptyState.hidden = true;
  resultsEl.hidden = false;
  renderMetrics(state.result);
  renderSeveritySummary(rows);
  renderTimeline(rows);
  renderLevelBreakdown();
  renderFrequency();
  renderTrend();
  renderPatterns();
  renderLevelFilters();
  renderPreview();
  hideSample();

  const suffix = label ? `（${label}）` : "";
  const r = state.result;
  let note = `分析完成${suffix}：共 ${r.totalLines} 条，错误 ${r.errorLines} 条。`;
  if (r.mergedStacks) note += ` 合并 ${r.mergedStacks} 段多行堆栈。`;
  if (r.collapsedGroups) note += ` 折叠 ${r.collapsedGroups} 组重复行。`;
  statusEl.textContent = note;
}

function canUseWorker(text) {
  return (
    typeof Worker !== "undefined" &&
    !workerBroken &&
    typeof text === "string" &&
    text.length > WORKER_THRESHOLD
  );
}

function getAnalysisWorker() {
  if (workerBroken) return null;
  if (analysisWorker) return analysisWorker;
  try {
    analysisWorker = new Worker(new URL("./js/analysis-worker.mjs", import.meta.url), {
      type: "module",
    });
    analysisWorker.onmessage = handleWorkerMessage;
    analysisWorker.onerror = handleWorkerError;
  } catch (err) {
    console.warn("Failed to create analysis worker.", err);
    workerBroken = true;
    analysisWorker = null;
  }
  return analysisWorker;
}

function analyzeInWorker(text, fileCount, opts) {
  return new Promise((resolve, reject) => {
    const worker = getAnalysisWorker();
    if (!worker) {
      reject(new Error("Web Worker 不可用"));
      return;
    }
    const id = ++workerJobSeq;
    pendingJob = { id, resolve, reject };
    worker.postMessage({ id, text, fileCount, opts });
  });
}

function handleWorkerMessage(event) {
  const msg = event.data;
  if (!pendingJob || msg.id !== pendingJob.id) return;
  if (msg.type === "progress") {
    showProgress(msg.percent, msg.phase);
    return;
  }
  if (msg.type === "done") {
    const job = pendingJob;
    pendingJob = null;
    job.resolve({ rows: msg.rows, result: msg.result });
    return;
  }
  if (msg.type === "error") {
    const job = pendingJob;
    pendingJob = null;
    job.reject(new Error(msg.message));
  }
}

function handleWorkerError(err) {
  workerBroken = true;
  if (analysisWorker) {
    try {
      analysisWorker.terminate();
    } catch (e) {
      /* ignore */
    }
  }
  analysisWorker = null;
  if (pendingJob) {
    const job = pendingJob;
    pendingJob = null;
    job.reject(new Error(err?.message || "Worker error"));
  }
}

function setAnalyzing(active) {
  if (analyzeBtn) {
    analyzeBtn.disabled = active;
    analyzeBtn.classList.toggle("is-busy", active);
  }
  if (!active) hideProgress();
}

function showProgress(percent, label) {
  if (!analyzeProgress) return;
  analyzeProgress.hidden = false;
  const clamped = Math.max(0, Math.min(100, percent));
  if (analyzeProgressBar?.style) analyzeProgressBar.style.width = `${clamped}%`;
  if (analyzeProgressLabel && typeof label === "string") {
    analyzeProgressLabel.textContent = label;
  }
}

function hideProgress() {
  if (!analyzeProgress) return;
  if (analyzeProgressBar?.style) analyzeProgressBar.style.width = "100%";
  analyzeProgress.hidden = true;
  if (analyzeProgressBar?.style) analyzeProgressBar.style.width = "0%";
}

function resetFilters() {
  state.activeLevels = new Set(LEVELS.concat(["OTHER"]));
  state.search = "";
  state.timeWindow = null;
  state.expandedRows = new Set();
  state.expandedDiagnostics = new Set();
  state.expandedContexts = new Set();
  state.expandedReports = new Set();
  state.expandedGroups = new Set();
  state.identifierFilter = null;
  state.focusedLineNo = null;
  state.hiddenFocusedLine = false;
  searchInput.value = "";
  clearSearchError();
}

function renderMetrics(result) {
  totalLinesEl.textContent = String(result.totalLines);
  errorLinesEl.textContent = String(result.errorLines);
  errorRateEl.textContent = `${result.errorRate.toFixed(2)}%`;
  fileCountEl.textContent = String(result.fileCount);
}

function renderSeveritySummary(rows) {
  const html = renderSeveritySummaryHtml(countSeverities(rows));
  severitySummaryCard.hidden = !html;
  severitySummaryEl.innerHTML = html;
}

function renderTimeline(rows) {
  const html = renderTimelineHtml({
    ...selectTimelineEvents(rows),
    focusedLineNo: state.focusedLineNo,
    hiddenFocusedLine: state.hiddenFocusedLine,
  });
  timelineCard.hidden = !html;
  eventTimelineEl.innerHTML = html;
  eventTimelineEl.querySelectorAll("[data-action='focus-timeline']").forEach((btn) => {
    btn.addEventListener("click", () => focusTimelineLine(Number(btn.dataset.lineNo)));
  });
}

function renderLevelBreakdown() {
  levelBreakdownEl.innerHTML = renderLevelBreakdownHtml(state.result);
}

function renderFrequency() {
  freqTableBody.innerHTML = renderFrequencyRows(state.result.frequencies);
  freqTableBody.querySelectorAll(".freq-row").forEach((tr) => {
    tr.addEventListener("click", () => showSample(tr.dataset.type, tr));
  });
}

function showSample(type, rowEl) {
  const samples = state.result?.errorSamples.get(type) || [];
  freqTableBody.querySelectorAll(".freq-row").forEach((r) => r.classList.remove("active"));
  rowEl.classList.add("active");
  sampleTitle.textContent = `样例：${type}`;
  sampleBody.textContent = samples.join("\n") || "（无样例）";
  samplePanel.hidden = false;

  const firstSample = samples[0];
  if (firstSample) {
    const match = state.rows.find(
      (r) => r.raw === firstSample || r.raw.split("\n")[0] === firstSample
    );
    if (match) focusTimelineLine(match.lineNo);
  }
}

function hideSample() {
  samplePanel.hidden = true;
  freqTableBody.querySelectorAll(".freq-row").forEach((r) => r.classList.remove("active"));
}

function renderPatterns() {
  const groups = state.result.patternGroups || [];
  patternGroupsEl.innerHTML = renderPatternGroups(groups, state.expandedGroups);
  patternGroupsEl.querySelectorAll("[data-action='toggle-group']").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleExpandedSet(state.expandedGroups, Number(btn.dataset.idx));
      renderPatterns();
    });
  });
  patternGroupsEl.querySelectorAll("[data-action='locate-group']").forEach((btn) => {
    btn.addEventListener("click", () => focusTimelineLine(Number(btn.dataset.lineNo)));
  });
}

function renderTrend() {
  const trend = state.granularity === "day" ? state.result.dayTrend : state.result.hourTrend;
  const selectedKey =
    state.timeWindow?.granularity === state.granularity ? state.timeWindow.key : null;
  trendChart.innerHTML = renderTrendChart(trend, selectedKey);
  trendChart.querySelectorAll(".bar-col.clickable").forEach((col) => {
    const toggle = () => toggleTimeWindow(col.dataset.key);
    col.addEventListener("click", toggle);
    col.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });
}

function toggleTimeWindow(key) {
  const gran = state.granularity;
  if (state.timeWindow?.granularity === gran && state.timeWindow.key === key) {
    state.timeWindow = null;
  } else {
    state.timeWindow = { key, granularity: gran };
  }
  renderTrend();
  renderPreview();
}

function renderLevelFilters() {
  levelFiltersEl.innerHTML = renderLevelFilterHtml(state.result);
  levelFiltersEl.querySelectorAll("input").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) state.activeLevels.add(cb.value);
      else state.activeLevels.delete(cb.value);
      renderPreview();
    });
  });
}

function renderPreview() {
  const matcher = createMatcher();
  const filtered = state.rows.filter(
    (row) =>
      state.activeLevels.has(row.level) &&
      rowInTimeWindow(row) &&
      rowMatchesIdentifierFilter(row) &&
      (!matcher || matcher.test(row.raw))
  );
  const shown = filtered.slice(0, PREVIEW_LIMIT);
  state.hiddenFocusedLine = Boolean(
    state.focusedLineNo && !shown.some((row) => row.lineNo === state.focusedLineNo)
  );
  if (state.focusedLineNo && !state.hiddenFocusedLine) {
    state.expandedRows.add(state.focusedLineNo);
  }
  previewBody.innerHTML = shown
    .map((row) =>
      renderPreviewRow(row, matcher, {
        expandedStack: state.expandedRows.has(row.lineNo),
        expandedDiagnostic: state.expandedDiagnostics.has(row.lineNo),
        expandedContext: state.expandedContexts.has(row.lineNo),
        expandedReport: state.expandedReports.has(row.lineNo),
        focused: row.lineNo === state.focusedLineNo,
        contextRows: filtered,
        diagnosticRules: state.diagnosticRules,
      })
    )
    .join("");

  if (!filtered.length) {
    previewBody.innerHTML = '<tr><td colspan="3" class="muted">没有匹配的日志行</td></tr>';
  }

  previewBody.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lineNo = Number(btn.dataset.lineNo);
      if (btn.dataset.action === "toggle-stack") toggleExpandedSet(state.expandedRows, lineNo);
      if (btn.dataset.action === "toggle-diagnostic") {
        toggleExpandedSet(state.expandedDiagnostics, lineNo);
      }
      if (btn.dataset.action === "toggle-context") {
        toggleExpandedSet(state.expandedContexts, lineNo);
      }
      if (btn.dataset.action === "toggle-report") {
        toggleExpandedSet(state.expandedReports, lineNo);
      }
      if (btn.dataset.action === "copy-report") {
        copyReport(Number(btn.dataset.reportLineNo));
        return;
      }
      if (btn.dataset.action === "filter-identifier") {
        state.identifierFilter = {
          key: btn.dataset.identifierKey,
          value: btn.dataset.identifierValue,
        };
      }
      renderPreview();
    });
  });

  renderActiveFilters(filtered.length);
  renderPreviewMeta(shown.length, filtered.length);
  renderTimeline(state.rows);
  scrollFocusedPreviewRow();
}

function createMatcher() {
  clearSearchError();
  return buildSearchMatcher(
    state.search,
    state.searchMode,
    state.searchLogic,
    (err) => showSearchError(`正则表达式无效：${err.message}`)
  );
}

function rowInTimeWindow(row) {
  if (!state.timeWindow) return true;
  const key = state.timeWindow.granularity === "day" ? row.dayKey : row.hourKey;
  return key === state.timeWindow.key;
}

function rowMatchesIdentifierFilter(row) {
  if (!state.identifierFilter) return true;
  return row.identifiers?.[state.identifierFilter.key] === state.identifierFilter.value;
}

function renderActiveFilters(matchCount) {
  const inactiveLevels = LEVELS.concat(["OTHER"]).filter(
    (lvl) => state.result?.levels.get(lvl) && !state.activeLevels.has(lvl)
  );
  const html = renderActiveFilterHtml({
    timeWindow: state.timeWindow,
    inactiveLevels,
    search: state.search,
    searchMode: state.searchMode,
    identifierFilter: state.identifierFilter,
    matchCount,
  });
  activeFiltersEl.hidden = !html;
  activeFiltersEl.innerHTML = html;
  activeFiltersEl.querySelectorAll("[data-clear]").forEach((el) => {
    el.addEventListener("click", () => clearFilter(el.dataset.clear));
  });
}

function renderPreviewMeta(shownCount, filteredCount) {
  let meta = `显示 ${shownCount} / ${filteredCount} 条`;
  if (filteredCount > PREVIEW_LIMIT) meta += `（仅预览前 ${PREVIEW_LIMIT} 条）`;
  if (state.result) meta += ` · 共 ${state.result.events} 条事件 / ${state.result.totalLines} 行`;
  previewMeta.textContent = meta;
}

function focusTimelineLine(lineNo) {
  state.focusedLineNo = lineNo;
  renderPreview();
}

function scrollFocusedPreviewRow() {
  if (!state.focusedLineNo || state.hiddenFocusedLine) return;
  const row = previewBody.querySelector(`[data-preview-line-no="${state.focusedLineNo}"]`);
  row?.scrollIntoView({ block: "center", behavior: "smooth" });
}

function clearFilter(kind) {
  if (kind === "time" || kind === "all") state.timeWindow = null;
  if (kind === "identifier" || kind === "all") state.identifierFilter = null;
  if (kind === "search" || kind === "all") {
    state.search = "";
    searchInput.value = "";
    clearSearchError();
  }
  if (kind === "all") {
    state.activeLevels = new Set(LEVELS.concat(["OTHER"]));
    levelFiltersEl.querySelectorAll("input").forEach((cb) => (cb.checked = true));
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

function toggleExpandedSet(set, value) {
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

async function copyReport(lineNo) {
  const reportEl = previewBody.querySelector(`.report-source[data-report-line-no="${lineNo}"]`);
  const status = previewBody.querySelector(`[data-report-status="${lineNo}"]`);
  if (!reportEl || !status) return;
  const text = reportEl.value ?? reportEl.textContent;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(text);
    showReportStatus(status, "已复制报告。");
  } catch (err) {
    selectReportText(reportEl);
    showReportStatus(status, "无法自动复制，已选中报告文本。");
  }
}

function showReportStatus(el, message) {
  el.textContent = message;
  el.hidden = false;
}

function selectReportText(el) {
  if (typeof el.select === "function") {
    el.select();
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection?.();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
}

function exportJson() {
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
  download("log-report.json", JSON.stringify(payload, null, 2), "application/json");
}

function exportCsv() {
  if (!state.result) return;
  const rows = [["error_type", "count"]];
  state.result.frequencies.forEach(([type, count]) => rows.push([type, String(count)]));
  const csv = rows.map((cols) => cols.map(csvCell).join(",")).join("\n");
  download("log-error-types.csv", csv, "text/csv");
}

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
