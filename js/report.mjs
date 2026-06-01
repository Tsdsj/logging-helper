import { findDiagnostic } from "./diagnostics.mjs";
import { extractRootCause, springBootFailureSummary } from "./parser.mjs";

export function buildIssueReport(row, opts = {}) {
  const diagnostic = findDiagnostic(row, opts.diagnosticRules || []);
  const rootCause = extractRootCause(row.raw);
  const context = nearbyContext(row, opts.contextRows || []);
  const lines = [
    "# Log Issue Report",
    "",
    "## Summary",
    `- Level: ${row.level}`,
    `- Line: ${row.lineNo}`,
    `- Message: ${summaryOf(row.raw)}`,
  ];

  if (rootCause) {
    lines.push(`- Root cause: ${rootCause.message}`);
  }

  if (diagnostic) {
    lines.push(
      "",
      "## Diagnostic",
      `- ${diagnostic.title}`,
      `- ${diagnostic.reason}`,
      "",
      "### Suggested Actions",
      ...diagnostic.solutions.map((item) => `- ${item}`)
    );
  }

  if (context.length) {
    lines.push(
      "",
      "## Nearby Context",
      ...context.map((item) => `- #${item.lineNo} ${item.level}: ${summaryOf(item.raw)}`)
    );
  }

  lines.push("", "## Raw Snippet", "```text", row.raw, "```");
  return lines.join("\n");
}

function nearbyContext(row, rows) {
  const index = rows.findIndex((item) => item.lineNo === row.lineNo);
  if (index === -1) return [];
  return rows.slice(Math.max(0, index - 3), index).concat(rows.slice(index + 1, index + 4));
}

function summaryOf(raw) {
  return springBootFailureSummary(raw) || raw.split(/\r?\n/)[0];
}
