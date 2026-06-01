import { ERROR_LEVELS, extractRootCause, springBootFailureSummary } from "./parser.mjs";
import { findDiagnostic } from "./diagnostics.mjs";
import { buildIssueReport } from "./report.mjs";
import { escapeHtml } from "./utils.mjs";

export function renderPreviewRow(row, matcher, opts = {}) {
  const key = row.lineNo;
  const diagnostic = findDiagnostic(row, opts.diagnosticRules || []);
  const hasStack = row.lineSpan > 1;
  const hasContext = ERROR_LEVELS.has(row.level) && Array.isArray(opts.contextRows);
  const dup = row.count > 1 ? `<span class="dup-badge">×${row.count}</span>` : "";
  const summary = opts.expandedStack ? row.raw : previewSummary(row.raw);
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
    ? `<button class="context-badge detail-toggle" type="button" data-action="toggle-context" data-line-no="${key}">Context</button>`
    : "";
  const reportButton = ERROR_LEVELS.has(row.level)
    ? `<button class="report-badge detail-toggle" type="button" data-action="toggle-report" data-line-no="${key}">Report</button>`
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

  return `
      <tr>
        <td class="num">${row.lineNo}</td>
        <td class="lvl"><span class="badge badge-${row.level}">${row.level}</span>${dup}</td>
        <td class="line-content">${highlight(summary, matcher)}${identifierChips}${stack}${diagnosticButton}${contextButton}${reportButton}</td>
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

function renderRootCause(rootCause) {
  return `
    <div class="root-cause-detail">
      <span>Root cause</span>
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
            <p>${escapeHtml(diagnostic.reason)}</p>
            ${renderDiagnosticList("常见原因", diagnostic.details)}
            ${renderDiagnosticList("解决方案", diagnostic.solutions)}
          </div>
        </td>
      </tr>`;
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
            <span>Nearby events</span>
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
              <span>Markdown report</span>
              <button class="ghost-btn small" type="button" data-action="copy-report" data-report-line-no="${row.lineNo}">复制</button>
            </div>
            <pre data-report-line-no="${row.lineNo}">${escapeHtml(report)}</pre>
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
