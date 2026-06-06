import assert from "node:assert/strict";

import { renderPreviewPagerHtml } from "../js/renderers.mjs";
import { pageForFocusedLine, paginatePreviewRows } from "../js/preview.mjs";

assert.equal(
  renderPreviewPagerHtml({ page: 1, pageCount: 1, filteredCount: 42 }),
  "",
  "single-page previews should not render pager controls"
);

const firstPagePager = renderPreviewPagerHtml({ page: 1, pageCount: 3, filteredCount: 1200 });
assert.match(firstPagePager, /data-preview-page="prev"/);
assert.match(firstPagePager, /data-preview-page="next"/);
assert.match(firstPagePager, /disabled[^>]*data-preview-page="prev"|data-preview-page="prev"[^>]*disabled/);
assert.doesNotMatch(firstPagePager, /disabled[^>]*data-preview-page="next"|data-preview-page="next"[^>]*disabled/);
assert.match(firstPagePager, /第 1 \/ 3 页/);
assert.match(firstPagePager, /1200 条/);

const lastPagePager = renderPreviewPagerHtml({ page: 3, pageCount: 3, filteredCount: 1200 });
assert.match(lastPagePager, /data-preview-page="prev"/);
assert.match(lastPagePager, /data-preview-page="next"/);
assert.doesNotMatch(lastPagePager, /disabled[^>]*data-preview-page="prev"|data-preview-page="prev"[^>]*disabled/);
assert.match(lastPagePager, /disabled[^>]*data-preview-page="next"|data-preview-page="next"[^>]*disabled/);
assert.match(lastPagePager, /第 3 \/ 3 页/);

const rows = Array.from({ length: 1200 }, (_, i) => ({ lineNo: i + 1 }));
const pageTwo = paginatePreviewRows(rows, { page: 2, pageSize: 500 });
assert.equal(pageTwo.page, 2);
assert.equal(pageTwo.pageCount, 3);
assert.equal(pageTwo.startIndex, 500);
assert.equal(pageTwo.endIndex, 1000);
assert.equal(pageTwo.shown[0].lineNo, 501);
assert.equal(pageTwo.shown.at(-1).lineNo, 1000);

const clamped = paginatePreviewRows(rows, { page: 99, pageSize: 500 });
assert.equal(clamped.page, 3);
assert.equal(clamped.shown[0].lineNo, 1001);
assert.equal(clamped.shown.at(-1).lineNo, 1200);

const empty = paginatePreviewRows([], { page: 3, pageSize: 500 });
assert.equal(empty.page, 1);
assert.equal(empty.pageCount, 1);
assert.equal(empty.startIndex, 0);
assert.equal(empty.endIndex, 0);
assert.deepEqual(empty.shown, []);

assert.equal(pageForFocusedLine(rows, 1001, 500), 3);
assert.equal(pageForFocusedLine(rows, 500, 500), 1);
assert.equal(pageForFocusedLine(rows, 1201, 500), null);

console.log("Preview pagination regression passed");
