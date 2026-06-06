import { ERROR_LEVELS, extractRootCause, springBootFailureSummary } from "./parser.mjs";
import { findDiagnostic } from "./diagnostics.mjs";
import { buildIssueReport } from "./report.mjs";
import { getSeverity } from "./severity.mjs";
import { escapeHtml } from "./utils.mjs";

export function paginatePreviewRows(rows, { page = 1, pageSize = 500 } = {}) {
  const safePageSize = Math.max(1, Number(pageSize) || 500);
  const pageCount = Math.max(1, Math.ceil((rows?.length || 0) / safePageSize));
  const safePage = Math.min(Math.max(1, Number(page) || 1), pageCount);
  const startIndex = (safePage - 1) * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, rows?.length || 0);
  return {
    page: safePage,
    pageCount,
    startIndex,
    endIndex,
    shown: (rows || []).slice(startIndex, endIndex),
  };
}

export function pageForFocusedLine(rows, lineNo, pageSize = 500) {
  const index = (rows || []).findIndex((row) => row.lineNo === lineNo);
  if (index === -1) return null;
  const safePageSize = Math.max(1, Number(pageSize) || 500);
  return Math.floor(index / safePageSize) + 1;
}

export function renderPreviewRow(row, matcher, opts = {}) {
  const key = row.lineNo;
  const diagnostic = findDiagnostic(row, opts.diagnosticRules || []);
  const hasStack = row.lineSpan > 1;
  const hasContext = ERROR_LEVELS.has(row.level) && Array.isArray(opts.contextRows);
  const dup = row.count > 1 ? `<span class="dup-badge">×${row.count}</span>` : "";
  const summary = opts.expandedStack ? row.raw : previewSummary(row.raw);
  const severity = renderSeverityBadge(getSeverity(row));
  const identifierChips = renderIdentifierChips(row.identifiers);
  const stack = hasStack
    ? `<button class="stack-badge detail-toggle" type="button" data-action="toggle-stack" data-line-no="${key}">${
        opts.expandedStack ? "收起" : "堆栈"
      } ${row.lineSpan} 行</button>`
    : "";
  const diagnosticButton = diagnostic
    ? `<button class="diagnostic-badge detail-toggle" type="button" data-action="toggle-diagnostic" data-line-no="${key}">诊断建议</button>`
    : "";
  const contextButton = hasContext
    ? `<button class="context-badge detail-toggle" type="button" data-action="toggle-context" data-line-no="${key}">上下文</button>`
    : "";
  const reportButton = ERROR_LEVELS.has(row.level)
    ? `<button class="report-badge detail-toggle" type="button" data-action="toggle-report" data-line-no="${key}">报告</button>`
    : "";
  const detailRows = [];

  if (opts.expandedStack && hasStack) {
    const rootCause = extractRootCause(row.raw);
    detailRows.push(`
      <tr class="preview-detail-row">
        <td></td>
        <td colspan="2">
          ${rootCause ? renderRootCause(rootCause) : ""}
          <pre class="stack-detail">${highlight(row.raw, matcher)}</pre>
        </td>
      </tr>`);
  }

  if (opts.expandedDiagnostic && diagnostic) {
    detailRows.push(renderDiagnosticDetail(diagnostic));
  }

  if (opts.expandedContext && hasContext) {
    detailRows.push(renderContextDetail(row, opts.contextRows));
  }

  if (opts.expandedReport && ERROR_LEVELS.has(row.level)) {
    detailRows.push(renderReportDetail(row, opts));
  }

  const focusedClass = opts.focused ? ' class="preview-row-focused"' : "";
  return `
      <tr data-preview-line-no="${key}"${focusedClass}>
        <td class="num">${row.lineNo}</td>
        <td class="lvl"><span class="badge badge-${row.level}">${row.level}</span>${dup}</td>
        <td class="line-content">${highlight(summary, matcher)}${severity}${identifierChips}${stack}${diagnosticButton}${contextButton}${reportButton}</td>
      </tr>${detailRows.join("")}`;
}

export function previewSummary(raw) {
  const summary = springBootFailureSummary(raw);
  if (summary) return summary;
  return raw.split(/\r?\n/)[0];
}

export function buildSearchMatcher(query, mode, logic, onError = () => {}) {
  if (!query) return null;

  if (mode === "regex") {
    try {
      const re = new RegExp(query, "i");
      return { test: (raw) => re.test(raw), regex: re };
    } catch (err) {
      onError(err);
      return null;
    }
  }

  const terms = query.split(/\s+/).filter(Boolean);
  const lowered = terms.map((t) => t.toLowerCase());
  const test = (raw) => {
    const hay = raw.toLowerCase();
    return logic === "or"
      ? lowered.some((t) => hay.includes(t))
      : lowered.every((t) => hay.includes(t));
  };
  return { test, terms };
}

export function rowHasDiagnostic(row, rules) {
  return ERROR_LEVELS.has(row.level) && Boolean(findDiagnostic(row, rules));
}

function renderIdentifierChips(identifiers = {}) {
  const chips = Object.entries(identifiers);
  if (!chips.length) return "";
  return `<span class="identifier-chips">${chips
    .map(
      ([key, value]) =>
        `<button class="identifier-chip" type="button" title="筛选 ${escapeHtml(
          key
        )}" data-action="filter-identifier" data-identifier-key="${escapeHtml(
          key
        )}" data-identifier-value="${escapeHtml(value)}">${escapeHtml(key)}=${escapeHtml(value)}</button>`
    )
    .join("")}</span>`;
}

function renderSeverityBadge(severity) {
  if (!severity) return "";
  return `<span class="severity-badge severity-${escapeHtml(severity.key)}">${escapeHtml(
    severity.label
  )}</span>`;
}

function renderRootCause(rootCause) {
  return `
    <div class="root-cause-detail">
      <span>根因</span>
      <strong>${escapeHtml(rootCause.message)}</strong>
    </div>`;
}

function renderDiagnosticDetail(diagnostic) {
  return `
      <tr class="preview-detail-row">
        <td></td>
        <td colspan="2">
          <div class="diagnostic-detail">
            <strong>${escapeHtml(diagnostic.title)}</strong>
            ${renderMatchEvidence(diagnostic.matchEvidence)}
            <p>${escapeHtml(diagnostic.reason)}</p>
            ${renderDiagnosticList("常见原因", diagnostic.details)}
            ${renderDiagnosticList("解决方案", diagnostic.solutions)}
          </div>
        </td>
      </tr>`;
}

function renderMatchEvidence(evidence) {
  if (!evidence) return "";
  return `<p class="diagnostic-match">匹配依据：规则 <code>${escapeHtml(
    evidence.ruleId
  )}</code> 命中 <code>${escapeHtml(evidence.pattern)}</code></p>`;
}

function renderContextDetail(row, rows) {
  const index = rows.findIndex((item) => item.lineNo === row.lineNo);
  if (index === -1) return "";
  const before = rows.slice(Math.max(0, index - 3), index);
  const after = rows.slice(index + 1, index + 4);
  const items = before.concat(after);
  if (!items.length) return "";
  return `
      <tr class="preview-detail-row">
        <td></td>
        <td colspan="2">
          <div class="context-detail">
            <span>附近事件</span>
            <ul>${items.map(renderContextItem).join("")}</ul>
          </div>
        </td>
      </tr>`;
}

function renderContextItem(row) {
  return `<li><span class="context-line">#${row.lineNo}</span><span class="badge badge-${row.level}">${row.level}</span><code>${escapeHtml(previewSummary(row.raw))}</code></li>`;
}

function renderReportDetail(row, opts) {
  const report = buildIssueReport(row, {
    diagnosticRules: opts.diagnosticRules || [],
    contextRows: opts.contextRows || [],
  });
  return `
      <tr class="preview-detail-row">
        <td></td>
        <td colspan="2">
          <div class="report-detail">
            <div class="report-head">
              <span>Markdown 报告</span>
              <button class="ghost-btn small" type="button" data-action="copy-report" data-report-line-no="${row.lineNo}">复制</button>
            </div>
            <div class="markdown-body">${renderMarkdown(report)}</div>
            <textarea class="report-source" data-report-line-no="${row.lineNo}" readonly>${escapeHtml(report)}</textarea>
            <p class="report-copy-status" data-report-status="${row.lineNo}" hidden></p>
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

function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let inList = false;
  let inCode = false;
  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    if (/^```/.test(line)) {
      closeList();
      if (inCode) html.push("</code></pre>");
      else html.push("<pre><code>");
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      html.push(`${escapeHtml(line)}\n`);
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }
    if (line.startsWith("# ")) {
      closeList();
      html.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("## ")) {
      closeList();
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("### ")) {
      closeList();
      html.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("- ")) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      continue;
    }
    closeList();
    html.push(`<p>${escapeHtml(line)}</p>`);
  }
  closeList();
  if (inCode) html.push("</code></pre>");
  return html.join("");
}

function highlight(text, matcher) {
  if (!matcher) return escapeHtml(text);

  // Find matches in the raw text BEFORE escaping
  const matches = [];

  if (matcher.regex) {
    const re = new RegExp(matcher.regex.source, "gi");
    let match;
    while ((match = re.exec(text)) !== null) {
      if (!match[0]) {
        re.lastIndex += 1;
        continue;
      }
      matches.push({ start: match.index, end: match.index + match[0].length });
    }
  } else if (matcher.terms && matcher.terms.length) {
    const alt = matcher.terms
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .filter(Boolean)
      .join("|");
    if (alt) {
      const re = new RegExp(alt, "gi");
      let match;
      while ((match = re.exec(text)) !== null) {
        if (!match[0]) {
          re.lastIndex += 1;
          continue;
        }
        matches.push({ start: match.index, end: match.index + match[0].length });
      }
    }
  }

  if (!matches.length) return escapeHtml(text);

  // Sort matches by start position and merge overlapping ranges
  matches.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const match of matches) {
    if (merged.length && match.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, match.end);
    } else {
      merged.push(match);
    }
  }

  // Build the highlighted HTML by escaping each segment and wrapping matches
  let result = "";
  let lastIndex = 0;
  for (const match of merged) {
    if (match.start > lastIndex) {
      result += escapeHtml(text.slice(lastIndex, match.start));
    }
    result += `<mark>${escapeHtml(text.slice(match.start, match.end))}</mark>`;
    lastIndex = match.end;
  }
  if (lastIndex < text.length) {
    result += escapeHtml(text.slice(lastIndex));
  }
  return result;
}
