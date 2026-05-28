const fileInput = document.getElementById("logFile");
const analyzeBtn = document.getElementById("analyzeBtn");
const statusEl = document.getElementById("status");

const totalLinesEl = document.getElementById("totalLines");
const errorLinesEl = document.getElementById("errorLines");
const errorRateEl = document.getElementById("errorRate");
const freqTableBody = document.getElementById("freqTableBody");
const trendChart = document.getElementById("trendChart");

const ERROR_KEYWORD = /\b(ERROR|FATAL)\b/i;
const TS_REGEX = /(\d{4}-\d{2}-\d{2})[ T](\d{2}):\d{2}:\d{2}/;
const MAX_ERROR_TYPE_LENGTH = 70;

analyzeBtn.addEventListener("click", async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    statusEl.textContent = "请先选择日志文件。";
    return;
  }

  statusEl.textContent = "正在读取并分析日志...";
  const text = await file.text();
  const result = analyzeLogs(text);
  renderResult(result);
  statusEl.textContent = `分析完成：共 ${result.totalLines} 行，错误 ${result.errorLines} 行。`;
});

function analyzeLogs(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const totalLines = lines.length;

  const errorTypeCounter = new Map();
  const trendCounter = new Map();
  let errorLines = 0;

  for (const line of lines) {
    if (!ERROR_KEYWORD.test(line)) continue;
    errorLines += 1;

    const errorType = extractErrorType(line);
    errorTypeCounter.set(errorType, (errorTypeCounter.get(errorType) || 0) + 1);

    const trendKey = extractHourKey(line);
    trendCounter.set(trendKey, (trendCounter.get(trendKey) || 0) + 1);
  }

  const frequencies = Array.from(errorTypeCounter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const trend = Array.from(trendCounter.entries()).sort((a, b) => {
    if (a[0] === "未识别时间") return 1;
    if (b[0] === "未识别时间") return -1;
    return a[0].localeCompare(b[0]);
  });

  return {
    totalLines,
    errorLines,
    errorRate: totalLines ? (errorLines / totalLines) * 100 : 0,
    frequencies,
    trend,
  };
}

function extractErrorType(line) {
  const keywordMatch = line.match(/\b(?:ERROR|FATAL)\b[]:\s-]*([A-Za-z0-9_.-]+)/i);
  if (keywordMatch?.[1]) return keywordMatch[1];

  const cleaned = line.replace(/\s+/g, " ").trim();
  return cleaned.length > MAX_ERROR_TYPE_LENGTH
    ? `${cleaned.slice(0, MAX_ERROR_TYPE_LENGTH)}...`
    : cleaned;
}

function extractHourKey(line) {
  const match = line.match(TS_REGEX);
  if (!match) return "未识别时间";
  return `${match[1]} ${match[2]}:00`;
}

function renderResult(result) {
  totalLinesEl.textContent = String(result.totalLines);
  errorLinesEl.textContent = String(result.errorLines);
  errorRateEl.textContent = `${result.errorRate.toFixed(2)}%`;
  renderFrequency(result.frequencies);
  renderTrend(result.trend);
}

function renderFrequency(frequencies) {
  if (!frequencies.length) {
    freqTableBody.innerHTML = '<tr><td colspan="2" class="muted">未检测到错误行</td></tr>';
    return;
  }

  freqTableBody.innerHTML = frequencies
    .map(
      ([type, count]) =>
        `<tr><td title="${escapeHtml(type)}">${escapeHtml(type)}</td><td>${count}</td></tr>`
    )
    .join("");
}

function renderTrend(trend) {
  if (!trend.length) {
    trendChart.innerHTML = '<p class="muted">未检测到错误趋势数据</p>';
    return;
  }

  const maxCount = Math.max(...trend.map(([, count]) => count), 1);
  trendChart.innerHTML = trend
    .map(([label, count]) => {
      const width = Math.max((count / maxCount) * 100, 2);
      return `
        <div class="bar-row">
          <div class="bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
          <div class="bar-track"><div class="bar" style="width:${width}%"></div></div>
          <div class="bar-value">${count}</div>
        </div>
      `;
    })
    .join("");
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
