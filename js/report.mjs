import { findDiagnostic } from "./diagnostics.mjs";
import { extractRootCause, springBootFailureSummary } from "./parser.mjs";

export function buildIssueReport(row, opts = {}) {
  const diagnostic = findDiagnostic(row, opts.diagnosticRules || []);
  const rootCause = extractRootCause(row.raw);
  const context = nearbyContext(row, opts.contextRows || []);
  const lines = [
    "# 日志问题报告",
    "",
    "## 摘要",
    `- 级别：${row.level}`,
    `- 行号：${row.lineNo}`,
    `- 消息：${summaryOf(row.raw)}`,
  ];

  if (rootCause) {
    lines.push(`- 根因：${rootCause.message}`);
  }

  if (diagnostic) {
    lines.push(
      "",
      "## 诊断建议",
      `- ${diagnostic.title}`,
      `- ${diagnostic.reason}`,
      "",
      "### 建议操作",
      ...diagnostic.solutions.map((item) => `- ${item}`)
    );
  }

  if (context.length) {
    lines.push(
      "",
      "## 附近上下文",
      ...context.map((item) => `- #${item.lineNo} ${item.level}: ${summaryOf(item.raw)}`)
    );
  }

  lines.push("", "## 原始片段", "```text", row.raw, "```");
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
