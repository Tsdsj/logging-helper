import { parseLines, summarize } from "./parser.mjs";
import { buildPatternGroups } from "./patterns.mjs";

// Off-main-thread log analysis so the UI stays responsive on large files.
// Posts coarse-grained progress between phases, then the final payload.
self.onmessage = (event) => {
  const { id, text, fileCount, opts } = event.data || {};
  try {
    self.postMessage({ id, type: "progress", phase: "解析日志…", percent: 65 });
    const rows = parseLines(text, opts);

    self.postMessage({ id, type: "progress", phase: "汇总统计…", percent: 82 });
    const result = summarize(rows, fileCount);
    result.patternGroups = buildPatternGroups(rows);

    self.postMessage({ id, type: "progress", phase: "渲染结果…", percent: 96 });
    self.postMessage({ id, type: "done", rows, result });
  } catch (err) {
    self.postMessage({ id, type: "error", message: err?.message || String(err) });
  }
};
