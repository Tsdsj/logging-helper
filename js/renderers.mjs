import { LEVELS } from "./parser.mjs";
import { escapeHtml } from "./utils.mjs";

export const MIN_BAR_WIDTH_PERCENT = 2;

export function renderLevelBreakdownHtml(result) {
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
  return chips || '<p class="muted">未检测到日志级别</p>';
}

export function renderSeveritySummaryHtml(counts) {
  if (!counts?.total) return "";
  const items = [
    ["critical", "Critical", counts.critical],
    ["high", "High", counts.high],
    ["medium", "Medium", counts.medium],
    ["low", "Low", counts.low],
  ];
  return `
    <div class="severity-summary">
      ${items
        .filter(([, , count]) => count)
        .map(
          ([key, label, count]) => `
          <div class="severity-summary-item severity-${key}">
            <span>${escapeHtml(label)}</span>
            <strong>${count}</strong>
          </div>`
        )
        .join("")}
    </div>`;
}

export function levelColor(lvl) {
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

export function renderFrequencyRows(frequencies) {
  if (!frequencies.length) {
    return '<tr><td colspan="2" class="muted">未检测到错误行</td></tr>';
  }
  return frequencies
    .map(
      ([type, count]) => `
        <tr class="freq-row" data-type="${escapeHtml(type)}">
          <td title="${escapeHtml(type)}">${escapeHtml(type)}</td>
          <td class="num">${count}</td>
        </tr>`
    )
    .join("");
}

export function renderPatternRows(patterns) {
  if (!patterns || !patterns.length) {
    return '<tr><td colspan="2" class="muted">暂无数据</td></tr>';
  }
  return patterns
    .map(
      ([tpl, count], i) => `
        <tr class="pattern-row" data-idx="${i}">
          <td title="${escapeHtml(tpl)}"><code>${escapeHtml(tpl)}</code></td>
          <td class="num">${count}</td>
        </tr>`
    )
    .join("");
}

export function renderTrendRows(trend, selectedKey) {
  if (!trend.length) return '<p class="muted">未检测到错误趋势数据</p>';
  const maxCount = Math.max(...trend.map(([, count]) => count), 1);
  return trend
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
}

export function renderLevelFilterHtml(result) {
  return LEVELS.concat(["OTHER"])
    .filter((lvl) => result.levels.get(lvl))
    .map(
      (lvl) => `
      <label class="level-filter">
        <input type="checkbox" value="${lvl}" checked />
        <span class="level-dot" style="background:${levelColor(lvl)}"></span>
        ${lvl}
      </label>`
    )
    .join("");
}

export function renderActiveFilterHtml({
  timeWindow,
  inactiveLevels,
  search,
  searchMode,
  identifierFilter,
  matchCount,
}) {
  const chips = [];
  if (timeWindow) {
    const granLabel = timeWindow.granularity === "day" ? "按天" : "按小时";
    chips.push(
      `<button class="filter-chip" data-clear="time" type="button">时段（${granLabel}）：${escapeHtml(
        timeWindow.key
      )} ✕</button>`
    );
  }
  if (inactiveLevels.length) {
    chips.push(
      `<span class="filter-chip muted-chip">已隐藏级别：${inactiveLevels.join("、")}</span>`
    );
  }
  if (search) {
    const modeLabel = searchMode === "regex" ? "正则" : "关键字";
    chips.push(
      `<button class="filter-chip" data-clear="search" type="button">${modeLabel}：${escapeHtml(
        search
      )} ✕</button>`
    );
  }
  if (identifierFilter) {
    chips.push(
      `<button class="filter-chip" data-clear="identifier" type="button">链路：${escapeHtml(
        identifierFilter.key
      )}=${escapeHtml(identifierFilter.value)} ✕</button>`
    );
  }
  if (!chips.length) return "";
  return (
    `<span class="muted small">命中 ${matchCount} 条 ·</span>` +
    chips.join("") +
    `<button class="filter-chip clear-all" data-clear="all" type="button">清除全部</button>`
  );
}
