import { ERROR_LEVELS, springBootFailureSummary } from "./parser.mjs";
import { findDiagnostic } from "./diagnostics.mjs";
import { escapeHtml } from "./utils.mjs";

export function renderPreviewRow(row, matcher, opts = {}) {
  const key = row.lineNo;
  const diagnostic = findDiagnostic(row, opts.diagnosticRules || []);
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
