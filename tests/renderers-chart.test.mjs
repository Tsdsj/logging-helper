import assert from "node:assert/strict";

import {
  renderPatternGroups,
  renderSparkline,
  renderTrendChart,
} from "../js/renderers.mjs";

// ----- Trend SVG -----
const emptyTrend = renderTrendChart([], null);
assert.match(emptyTrend, /未检测到错误趋势数据/);

const trend = [
  ["2024-05-21 08:00", 3],
  ["2024-05-21 09:00", 7],
  ["2024-05-21 10:00", 1],
];
const svg = renderTrendChart(trend, "2024-05-21 09:00");
assert.match(svg, /<svg class="trend-svg"/);
assert.match(svg, /class="bar-col clickable"/);
// Selected bucket gets the highlight class.
assert.match(svg, /class="bar-col clickable is-selected"[\s\S]*?data-key="2024-05-21 09:00"/);
// Each bar exposes a data-key for click filtering and a native tooltip.
for (const [label, count] of trend) {
  assert.ok(svg.includes(`data-key="${label}"`), `bar for ${label}`);
  assert.ok(svg.includes(`${label} · ${count} 次`), `tooltip for ${label}`);
}

// ----- Sparkline -----
assert.match(renderSparkline([]), /pg-spark-empty/);
const spark = renderSparkline([1, 4, 2]);
assert.match(spark, /<svg class="sparkline"/);
assert.equal((spark.match(/<rect/g) || []).length, 3);

// ----- Pattern groups -----
assert.match(renderPatternGroups([]), /暂无数据/);

const groups = [
  {
    template: "Connection refused to db host <IP>",
    count: 12,
    events: 12,
    levels: { ERROR: 12 },
    dominantLevel: "ERROR",
    severity: { key: "medium", label: "Medium" },
    severityRank: 2,
    firstTime: "2024-05-21 08:00:01",
    lastTime: "2024-05-21 09:10:03",
    firstLineNo: 5,
    sparkline: [3, 7, 2],
    samples: ["Connection refused to db host 10.0.0.1:5432"],
  },
];

const collapsed = renderPatternGroups(groups, new Set());
assert.match(collapsed, /data-action="toggle-group" data-idx="0"/);
assert.match(collapsed, /aria-expanded="false"/);
assert.match(collapsed, /×12/);
assert.match(collapsed, /severity-medium/);
// Detail (samples / locate button) is hidden until expanded.
assert.ok(!/pattern-group-detail/.test(collapsed));

const expanded = renderPatternGroups(groups, new Set([0]));
assert.match(expanded, /aria-expanded="true"/);
assert.match(expanded, /pattern-group-detail/);
assert.match(expanded, /data-action="locate-group" data-line-no="5"/);
assert.match(expanded, /首次 2024-05-21 08:00:01/);
assert.match(expanded, /末次 2024-05-21 09:10:03/);
assert.match(expanded, /10\.0\.0\.1/);

console.log("Renderer chart/group regression passed");
