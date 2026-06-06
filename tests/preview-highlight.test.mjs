import assert from "node:assert/strict";

import { buildSearchMatcher, renderPreviewRow } from "../js/preview.mjs";

const row = {
  lineNo: 1,
  raw: '2026-06-06 10:00:00 ERROR payload <tag attr="x"> & retry',
  level: "ERROR",
  lineSpan: 1,
  count: 1,
  identifiers: {},
};

const tagHighlighted = renderPreviewRow(row, buildSearchMatcher("<tag", "plain", "and"), {
  diagnosticRules: [],
});
assert.match(tagHighlighted, /<mark>&lt;tag<\/mark> attr=&quot;x&quot;&gt;/);
assert.doesNotMatch(tagHighlighted, /<tag attr=/, "raw HTML must stay escaped");

const ampHighlighted = renderPreviewRow(row, buildSearchMatcher("&", "plain", "and"), {
  diagnosticRules: [],
});
assert.match(ampHighlighted, /<mark>&amp;<\/mark> retry/);

const escapedQuery = renderPreviewRow(row, buildSearchMatcher("&lt;tag&gt;", "plain", "and"), {
  diagnosticRules: [],
});
assert.doesNotMatch(escapedQuery, /<mark>/);

const regexHighlighted = renderPreviewRow(row, buildSearchMatcher("<tag[^>]*>", "regex", "and"), {
  diagnosticRules: [],
});
assert.match(regexHighlighted, /<mark>&lt;tag attr=&quot;x&quot;&gt;<\/mark>/);

const zeroLengthRegex = renderPreviewRow(row, buildSearchMatcher("(?=payload)", "regex", "and"), {
  diagnosticRules: [],
});
assert.doesNotMatch(zeroLengthRegex, /<mark><\/mark>/);
assert.match(zeroLengthRegex, /payload &lt;tag/);

console.log("Preview highlight regression passed");
