# Follow-up Preview, Tracing, and Export Plan

## Goal

Improve day-to-day investigation ergonomics in logging-helper by making search highlighting accurate for escaped text, recognizing standard distributed tracing fields, and clarifying/exporting the rows users are actually inspecting.

## Scope

This document covers three independent follow-up work items:

1. Fix preview search highlighting for raw text that contains HTML-sensitive characters.
2. Add TraceContext / OpenTelemetry `traceparent` identifier extraction.
3. Add export support for the current filtered preview rows.

Keep the app local-only and dependency-free. Do not add a backend, remote upload path, build system, framework, or runtime dependency.

## Codex Goal-mode Usage

Use this document directly with Codex goal mode. Start one goal per work item, using the work item title as the objective. Do not regenerate `feature_list.json` for this plan unless a later user request explicitly asks for the Auto_dev parent flow.

Recommended goals:

- Goal 1: Fix preview search highlighting for HTML-sensitive characters.
- Goal 2: Extract TraceContext / OpenTelemetry `traceparent` identifiers.
- Goal 3: Export current filtered preview rows.

Each goal should end with a focused commit after its targeted tests, `init.ps1`, and any relevant browser checks pass.

## Current Context

- Preview rendering and search highlighting live in `js/preview.mjs`.
- Search state, filtering, pagination, and export actions are coordinated in `app.js`.
- Identifier extraction lives in `js/parser.mjs`.
- Renderer helpers live in `js/renderers.mjs`.
- Fast validation entrypoint is `powershell -ExecutionPolicy Bypass -File .\init.ps1`.
- Browser-visible changes should be verified through `http://127.0.0.1:<port>/` using a static server such as `python -m http.server 8765 --bind 127.0.0.1`.

## Work Item 1: Preview Search Highlighting for HTML-sensitive Characters

### Problem

`js/preview.mjs` currently escapes preview text with `escapeHtml(text)` and then applies search highlighting against the escaped string. That means a user searching for raw log text such as `<tag>` will match the row but the visible highlight will not appear, because the rendered text has become `&lt;tag&gt;`. Conversely, searching for escaped fragments like `&lt;tag&gt;` can highlight content the user never typed in the original log.

### User Impact

- Search results can show matching rows without the expected `<mark>` highlight.
- Logs containing XML, HTML, JSON snippets with `&`, or angle-bracketed tokens are harder to inspect.
- Regex highlighting can behave differently from row filtering because filtering tests raw text while highlighting tests escaped HTML.

### Requirements

- Filtering must continue to test the original raw row text.
- Highlighting must mark the same raw text spans the user searched for.
- Rendered output must remain HTML-safe.
- Plain keyword mode must support multiple terms and AND/OR filtering as it does today.
- Regex mode must still tolerate invalid regex input through the existing search error behavior.
- Highlighting must not introduce malformed HTML or allow unescaped user/log content into the DOM.

### Proposed Design

Move highlighting to a raw-text tokenization flow:

1. Find match ranges against the original raw text.
2. Merge overlapping ranges.
3. Build the output by escaping non-matching text and wrapping escaped matching text in `<mark>`.

For plain terms, find case-insensitive ranges for each search term. For regex, run a global, case-insensitive regex on the raw text and collect non-empty matches. This keeps the displayed HTML safe while aligning highlights with the same raw input used by filtering.

### Development Steps

1. Add regression coverage.
   - File: `tests/preview-diagnostics.test.mjs`, `tests/preview-context.test.mjs`, or a new `tests/preview-highlight.test.mjs`.
   - Render a row with raw text containing `<tag>`, `&`, and normal words.
   - Assert searching `<tag>` produces `<mark>&lt;tag&gt;</mark>`.
   - Assert searching `&` produces `<mark>&amp;</mark>`.
   - Assert searching `&lt;tag&gt;` does not highlight unless that exact escaped text exists in the raw log.

2. Refactor `highlight(text, matcher)` in `js/preview.mjs`.
   - Add a helper that returns raw-text match ranges.
   - Add a helper that merges overlapping ranges.
   - Escape each output segment before concatenating.
   - Guard zero-length regex matches to avoid infinite loops.

3. Preserve existing search behavior.
   - Keep `buildSearchMatcher` behavior unchanged unless the tests reveal a direct mismatch.
   - Keep row filtering based on `matcher.test(row.raw)`.
   - Keep stack-detail and summary highlighting using the same helper.

4. Verify.
   - Run the targeted preview highlight test.
   - Run `powershell -ExecutionPolicy Bypass -File .\init.ps1`.

5. Browser acceptance.
   - Load a log containing `ERROR payload <tag attr="x"> & retry`.
   - Search `<tag`.
   - Expected: the row remains visible and the visible angle-bracket text is highlighted safely.
   - Search `&`.
   - Expected: the ampersand is highlighted as visible text, not as an HTML entity fragment.

### Acceptance Rules

- Searching raw `<...>` text highlights the visible escaped preview text.
- Searching raw `&` highlights the visible ampersand.
- Highlighting never injects raw HTML from the log or query.
- Existing plain search, regex search, AND/OR logic, and invalid-regex fallback still pass.
- Full `init.ps1` passes.

## Work Item 2: TraceContext / OpenTelemetry `traceparent` Extraction

### Problem

`js/parser.mjs` currently extracts common ad hoc identifiers such as `traceId`, `requestId`, `correlationId`, and `spanId`. Many modern services emit W3C TraceContext fields instead, especially `traceparent=00-<traceId>-<spanId>-<flags>` or JSON variants such as `"traceparent":"00-..."`. Those logs currently do not get clickable trace/span identifier chips unless the service also logs separate `traceId` and `spanId` fields.

### User Impact

- Distributed-tracing logs are harder to filter by request path.
- Users may see a `traceparent` field in the raw log but cannot click a chip to isolate related rows.
- OpenTelemetry-heavy logs feel less supported than custom trace ID formats.

### Requirements

- Extract valid W3C `traceparent` values.
- Derive `traceId` and `spanId` from `traceparent` when separate fields are not already present.
- Preserve explicitly logged `traceId` or `spanId` fields if they differ from `traceparent`.
- Render existing identifier chips without adding new UI dependencies.
- Avoid over-matching arbitrary hyphenated strings.
- Keep parsing local-only and zero-dependency.

### Proposed Design

Extend `extractIdentifiers(raw)` in `js/parser.mjs`:

1. Run the existing field extractors first.
2. Add a TraceContext regex for version, trace id, span id, and flags.
3. If the match is valid, set:
   - `traceparent` to the full matched value.
   - `traceId` from the 32-hex trace id only when `traceId` is not already set.
   - `spanId` from the 16-hex span id only when `spanId` is not already set.

Use W3C shape constraints:

- version: 2 hex chars
- trace id: 32 hex chars and not all zeroes
- span id: 16 hex chars and not all zeroes
- flags: 2 hex chars

### Development Steps

1. Add parser tests.
   - File: `tests/trace-id.test.mjs`.
   - Add a log row with `traceparent=00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`.
   - Assert `traceparent`, `traceId`, and `spanId` are present.
   - Add a JSON-style row with `"traceparent":"00-..."`.
   - Assert invalid all-zero trace id or span id is ignored.

2. Implement `traceparent` extraction.
   - File: `js/parser.mjs`.
   - Add a dedicated regex near the existing identifier patterns.
   - Add small validation helpers for all-zero hex ids.
   - Keep existing identifier extraction order predictable.

3. Verify preview chips.
   - Existing `renderIdentifierChips` should render any keys present in `row.identifiers`.
   - Extend `tests/trace-id.test.mjs` to assert rendered HTML includes `traceparent` or derived `traceId`/`spanId` chips.

4. Verify.
   - Run `node tests/trace-id.test.mjs`.
   - Run `powershell -ExecutionPolicy Bypass -File .\init.ps1`.

5. Browser acceptance.
   - Load a small OpenTelemetry-style log with two rows sharing the same `traceparent` trace id.
   - Click the rendered `traceId` chip.
   - Expected: preview filters to the rows sharing that trace id.

### Acceptance Rules

- Valid `traceparent` values produce stable trace/span identifier chips.
- Derived `traceId` and `spanId` work with existing identifier filtering.
- Invalid all-zero TraceContext IDs are ignored.
- Existing `traceId`, `requestId`, `correlationId`, and `spanId` extraction remains unchanged.
- Full `init.ps1` passes.

## Work Item 3: Export Current Filtered Preview Rows

### Problem

The current export actions focus on summary output: JSON report data and error-type CSV. After preview pagination was added, users can inspect filtered rows across pages, but there is no explicit export for the current filtered result set. It is unclear whether export means the whole analysis, the current page, or the current search/filter view.

### User Impact

- Users cannot easily save the subset of rows they just filtered down to.
- Pagination makes the visible table manageable, but exporting only summaries is not enough for follow-up investigation.
- Users may have to copy rows manually from the preview table.

### Requirements

- Add an export action for the current filtered preview rows.
- Export should include the full filtered set, not only the current page, unless the UI label explicitly says current page.
- Existing summary JSON and error-type CSV exports must keep working.
- Exported rows should include enough context to be useful: line number, level, count, line span, timestamp keys, identifiers, and raw text.
- Export must respect current filters: level filters, time window, search, and identifier filter.
- Export must remain local-only.

### Proposed Design

Add a reusable helper in `app.js` that computes the current filtered preview rows using the same logic as `renderPreview`. Then add a new button near the existing export controls:

- `导出筛选行 CSV` or `Export Filtered Rows CSV`

Use CSV as the first implementation because it is immediately useful in spreadsheets and keeps scope small. Include these columns:

- `line_no`
- `level`
- `count`
- `line_span`
- `hour`
- `day`
- `identifiers`
- `raw`

Keep JSON export unchanged for summaries. A later task can add filtered-row JSON if needed.

### Development Steps

1. Extract filtered-row calculation.
   - File: `app.js`.
   - Add a helper such as `currentFilteredRows()` that uses `createMatcher`, `state.activeLevels`, `rowInTimeWindow`, and `rowMatchesIdentifierFilter`.
   - Reuse it in `renderPreview` to avoid duplicated filter logic.
   - Ensure invalid regex behavior remains the same as today.

2. Add export helper.
   - File: `app.js`.
   - Add `exportFilteredRowsCsv()`.
   - Serialize identifiers as compact JSON or `key=value` pairs.
   - Escape CSV cells with the existing `csvCell` helper.
   - Include multiline raw text safely inside quoted CSV cells.

3. Add UI control.
   - File: `index.html`.
   - Add a compact export button near `exportJsonBtn` and `exportCsvBtn`.
   - File: `app.js`.
   - Bind the click handler in `bindEvents`.
   - File: `styles.css` only if spacing needs a minor adjustment.

4. Add tests.
   - Prefer extracting pure helpers into a module if app DOM harness testing becomes too awkward.
   - Cover CSV escaping for commas, quotes, and multiline raw text.
   - Cover that filters affect exported rows, not just rendered page rows.

5. Verify.
   - Run the targeted export test.
   - Run `powershell -ExecutionPolicy Bypass -File .\init.ps1`.

6. Browser acceptance.
   - Load a log with more than 500 rows.
   - Apply a search filter that matches rows on multiple pages.
   - Click the filtered rows export.
   - Expected: downloaded CSV contains every filtered row, including rows outside the currently visible page.
   - Clear filters and export again.
   - Expected: downloaded CSV row count matches the analysis event count.

### Acceptance Rules

- New export action downloads the current filtered preview rows.
- Export includes rows outside the current preview page.
- Export respects level, time-window, identifier, and search filters.
- Summary JSON and error-type CSV exports are not changed in meaning.
- CSV escaping handles quotes, commas, and multiline stack traces.
- Full `init.ps1` passes.

## Suggested Implementation Order

1. Search highlighting fix.
2. TraceContext / OpenTelemetry extraction.
3. Filtered preview row export.

This order starts with the smallest correctness fix, then improves parsing coverage, then adds a new user-facing export workflow.

## Global Verification Checklist

Run these after each work item:

```powershell
node --check app.js
node --check js/parser.mjs
node --check js/preview.mjs
node --check js/renderers.mjs
powershell -ExecutionPolicy Bypass -File .\init.ps1
```

For browser-visible items, also run:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Then verify the relevant flow in `http://127.0.0.1:8765/`.

## Out of Scope

- Backend services or remote upload.
- External package dependencies.
- Replacing the table with a framework.
- Full virtual scrolling.
- Reworking the whole visual design.
- Changing diagnostic rule semantics.
- Exporting remote traces or calling external observability systems.
