import { LEVELS } from "./parser.mjs";
import { escapeHtml } from "./utils.mjs";

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

export function renderTimelineHtml(timeline) {
  if (!timeline?.items?.length) return "";
  return `
    <ol class="event-timeline">
      ${timeline.items
        .map((item) => {
          const focused = item.lineNo === timeline.focusedLineNo ? " is-focused" : "";
          return `
          <li class="${focused.trim()}">
            <button type="button" data-action="focus-timeline" data-line-no="${item.lineNo}">
              <span class="timeline-time">${escapeHtml(item.time)}</span>
              <span class="badge badge-${escapeHtml(item.level)}">${escapeHtml(item.level)}</span>
              <span class="timeline-message">${escapeHtml(item.message)}</span>
            </button>
          </li>`;
        })
        .join("")}
    </ol>
    ${
      timeline.omittedCount
        ? `<p class="muted small timeline-omitted">另有 ${timeline.omittedCount} 条关键事件未显示</p>`
        : ""
    }
    ${
      timeline.hiddenFocusedLine
        ? `<p class="timeline-focus-message">当前筛选条件隐藏了 #${timeline.focusedLineNo}。清除筛选后可查看该事件。</p>`
        : ""
    }`;
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

export function renderPatternGroups(groups, expandedIdx = new Set()) {
  if (!groups || !groups.length) {
    return '<p class="muted">暂无数据</p>';
  }
  return `<div class="pattern-groups">${groups
    .map((group, i) => renderPatternGroup(group, i, expandedIdx.has(i)))
    .join("")}</div>`;
}

function renderPatternGroup(group, idx, expanded) {
  const sevBadge = group.severity
    ? `<span class="severity-badge severity-${escapeHtml(group.severity.key)}">${escapeHtml(
        group.severity.label
      )}</span>`
    : "";
  const detail = expanded ? renderPatternGroupDetail(group) : "";
  return `
    <div class="pattern-group${expanded ? " is-open" : ""}" data-idx="${idx}">
      <button class="pattern-group-head" type="button" data-action="toggle-group" data-idx="${idx}"
              aria-expanded="${expanded ? "true" : "false"}">
        <span class="pg-caret" aria-hidden="true">${expanded ? "▾" : "▸"}</span>
        <span class="badge badge-${escapeHtml(group.dominantLevel)} pg-level">${escapeHtml(
          group.dominantLevel
        )}</span>
        ${sevBadge}
        <code class="pg-template" title="${escapeHtml(group.template)}">${escapeHtml(
          group.template
        )}</code>
        <span class="pg-spark" title="出现时间分布">${renderSparkline(group.sparkline)}</span>
        <span class="pg-count">×${group.count}</span>
      </button>
      ${detail}
    </div>`;
}

function renderPatternGroupDetail(group) {
  const levelText = Object.entries(group.levels)
    .sort((a, b) => b[1] - a[1])
    .map(([lvl, count]) => `${escapeHtml(lvl)} ${count}`)
    .join(" · ");
  const samples = group.samples.length
    ? escapeHtml(group.samples.join("\n"))
    : "（无样例）";
  return `
    <div class="pattern-group-detail">
      <div class="pg-meta">
        <span>首次 ${escapeHtml(group.firstTime)}</span>
        <span>末次 ${escapeHtml(group.lastTime)}</span>
        <span>事件 ${group.events} 条</span>
        <span>级别 ${levelText}</span>
        <button class="filter-chip pg-locate" type="button" data-action="locate-group" data-line-no="${
          group.firstLineNo
        }">定位首次出现</button>
      </div>
      <pre class="pg-samples">${samples}</pre>
    </div>`;
}

export function renderSparkline(values, { width = 84, height = 22 } = {}) {
  if (!values || !values.length) return '<span class="pg-spark-empty">—</span>';
  const max = Math.max(...values, 1);
  const n = values.length;
  const gap = n > 1 ? 2 : 0;
  const barW = (width - gap * (n - 1)) / n;
  const bars = values
    .map((v, i) => {
      const h = Math.max((v / max) * (height - 2), 1);
      const x = i * (barW + gap);
      const y = height - h;
      return `<rect x="${round(x)}" y="${round(y)}" width="${round(barW)}" height="${round(
        h
      )}" rx="1"></rect>`;
    })
    .join("");
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
}

export function renderTrendChart(trend, selectedKey) {
  if (!trend.length) return '<p class="muted">未检测到错误趋势数据</p>';
  const W = 1000;
  const H = 220;
  const padL = 14;
  const padR = 14;
  const padT = 24;
  const padB = 66;
  const plotH = H - padT - padB;
  const n = trend.length;
  const slot = (W - padL - padR) / n;
  const barW = Math.min(slot * 0.62, 46);
  const maxCount = Math.max(...trend.map(([, count]) => count), 1);
  const labelStep = Math.ceil(n / 18);
  const showValues = n <= 28;

  const bars = trend
    .map(([label, count], i) => {
      const cx = padL + (i + 0.5) * slot;
      const h = count > 0 ? Math.max((count / maxCount) * plotH, 3) : 0;
      const x = cx - barW / 2;
      const y = H - padB - h;
      const selected = label === selectedKey ? " is-selected" : "";
      const valueText = showValues
        ? `<text class="bar-value-text" x="${round(cx)}" y="${round(y - 6)}" text-anchor="middle">${count}</text>`
        : "";
      const labelText =
        i % labelStep === 0
          ? `<text class="bar-label-text" x="${round(cx)}" y="${round(
              H - padB + 12
            )}" text-anchor="end" transform="rotate(-45 ${round(cx)} ${round(
              H - padB + 12
            )})">${escapeHtml(compactLabel(label))}</text>`
          : "";
      return `
        <g class="bar-col clickable${selected}" role="button" tabindex="0"
           data-key="${escapeHtml(label)}">
          <title>${escapeHtml(label)} · ${count} 次</title>
          <rect class="bar-col-hit" x="${round(x - (slot - barW) / 2)}" y="${padT}"
                width="${round(slot)}" height="${plotH + 8}" fill="transparent"></rect>
          <rect class="bar-col-rect" x="${round(x)}" y="${round(y)}" width="${round(
            barW
          )}" height="${round(h)}" rx="4"></rect>
          ${valueText}
          ${labelText}
        </g>`;
    })
    .join("");

  return `<svg class="trend-svg" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="错误趋势柱状图">
      <line class="trend-axis" x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}"></line>
      ${bars}
    </svg>`;
}

function compactLabel(label) {
  if (!label) return "";
  if (label === "未识别时间") return "未识别";
  // "2024-05-21 08:00" -> "05-21 08:00"; "2024-05-21" -> "05-21"
  return label.replace(/^\d{4}-/, "");
}

function round(value) {
  return Math.round(value * 100) / 100;
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
