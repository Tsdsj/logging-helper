# Follow-up Stability and Scale Plan

## Goal

Improve logging-helper's reliability on large logs and make high-signal events easier to reach without changing the local-only, zero-dependency static app model.

## Scope

This document covers three independent follow-up work items:

1. Prevent stale or overlapping large-file Worker jobs from corrupting UI state.
2. Prioritize critical events in the key-event timeline.
3. Add a scalable preview navigation model for logs with more than the current 500 visible rows.

Keep all processing in the browser. Do not add a backend, remote upload path, build system, or runtime dependency.

## Codex Goal-mode Usage

Use this document directly with Codex goal mode. Start one goal per work item, using the work item title as the objective. Do not regenerate `feature_list.json` for this plan unless a later user request explicitly asks for the Auto_dev parent flow.

Recommended goals:

- Goal 1: Fix large-file Worker job safety.
- Goal 2: Prioritize critical events in the key-event timeline.
- Goal 3: Add scalable preview pagination.

Each goal should end with a focused commit after its targeted tests, `init.ps1`, and any relevant browser checks pass.

## Current Context

- App entry and state orchestration live in `app.js`.
- Parsing and summary logic live in `js/parser.mjs`.
- Worker analysis lives in `js/analysis-worker.mjs`.
- Timeline selection lives in `js/timeline.mjs`.
- Preview rendering and filters are coordinated by `app.js` and `js/preview.mjs`.
- Fast validation entrypoint is `powershell -ExecutionPolicy Bypass -File .\init.ps1`.
- Browser-visible changes should be verified through `http://127.0.0.1:<port>/` using a static server such as `python -m http.server 8765 --bind 127.0.0.1`.

## Work Item 1: Large-file Worker Job Safety

### Problem

`app.js` currently keeps one global `pendingJob`. If a large Worker-backed analysis is running and the user starts another analysis path, toggles parser options, or loads a sample, the new job can overwrite the old pending job. A stale Worker response may then update the UI after a newer result, or an old Promise may never settle.

### User Impact

- Analyze button can remain busy after overlapping actions.
- Old large-file results can replace newer sample or option results.
- Progress UI can reflect the wrong job.

### Requirements

- Every analysis request must have a unique job id.
- Only the newest active analysis may call `applyAnalysis`.
- Stale Worker responses must be ignored and must not update progress or results.
- Starting a new analysis must cancel, supersede, or safely detach the previous pending job.
- Main-thread fallback after Worker failure must only apply if the failed job is still current.
- The analyze button and progress bar must return to idle for the current job.

### Proposed Design

Introduce an `activeAnalysisId` counter in `app.js`. `runAnalysis` creates a local id, stores it as current, and checks that id before applying results or hiding progress. Worker message handling should resolve only the matching job, and stale messages should be ignored. Prefer a small helper such as `isCurrentAnalysis(id)` to make guard checks obvious.

Avoid terminating the shared Worker for normal superseded jobs unless needed for cleanup. Ignoring stale responses is enough and keeps the implementation small.

### Development Steps

1. Add an app-level regression test.
   - File: `tests/app-entry-smoke.test.mjs` or a new `tests/app-worker-state.test.mjs`.
   - Simulate two analysis runs where the first Promise resolves after the second.
   - Assert that only the second result is rendered.
   - If direct Worker simulation is too heavy for the current DOM smoke harness, extract the job-currentness logic into a pure helper and test that helper.

2. Add the active job guard in `app.js`.
   - Add `let activeAnalysisId = 0;` near Worker state.
   - Increment in `runAnalysis`.
   - Before `applyAnalysis`, verify the local id is current.
   - In `finally` or completion handling, hide progress only for the current job.

3. Harden Worker fallback.
   - In the Worker `catch`, fall back to `analyzeSync` only if the job id is still current.
   - Do not let a stale Worker failure set visible error status after a newer analysis has started.

4. Verify with tests.
   - Run the targeted test.
   - Run `powershell -ExecutionPolicy Bypass -File .\init.ps1`.

5. Verify in the real page.
   - Prepare a log larger than `WORKER_THRESHOLD`.
   - Start analysis.
   - Immediately load a built-in sample or toggle a parser option.
   - Expected: final metrics and status match the latest action, not the stale large-file job.

### Acceptance Rules

- Stale Worker `done`, `error`, and `progress` messages cannot change the visible UI.
- Latest analysis result always wins.
- Analyze button is enabled after the latest analysis settles.
- Existing Worker fallback behavior still works when Worker creation fails.
- Full `init.ps1` passes.

## Work Item 2: Prioritized Key-event Timeline

### Problem

`js/timeline.mjs` currently selects the first notable events up to the configured limit. In long logs with many early WARN or retry messages, later FATAL, Critical, or ERROR events can be omitted from the timeline.

### User Impact

The section named "关键事件时间线" can hide the most important event, forcing users to search manually even though the app already detects severity and levels.

### Requirements

- Always prefer higher-impact events when the timeline is limited.
- Preserve enough chronological readability that users can still follow the incident sequence.
- Include FATAL and Critical events before WARN/retry/shutdown events.
- Keep the timeline limit readable, defaulting to 12 unless there is a clear reason to change it.
- Keep the existing omitted-count message accurate.

### Proposed Design

Rank notable events by severity and level, then select within the limit, then sort selected items back by original line number for display. Use a rank order like:

1. Critical severity or FATAL
2. High severity
3. ERROR
4. Medium severity
5. WARN
6. startup/shutdown/retry informational events

This keeps the rendered timeline chronological while ensuring important later events survive the limit.

### Development Steps

1. Write a failing timeline regression.
   - File: `tests/timeline.test.mjs`.
   - Build 20 early WARN rows followed by one FATAL or Critical row.
   - Call `selectTimelineEvents(rows, 12)`.
   - Assert the selected items include the FATAL/Critical row.
   - Assert returned items are sorted by `lineNo`.
   - Assert `omittedCount` still equals total notable minus selected count.

2. Implement priority selection.
   - File: `js/timeline.mjs`.
   - Import or reuse `getSeverity` from `js/severity.mjs`.
   - Add a small `timelinePriority(row)` helper.
   - Select top N by priority, breaking ties by `lineNo`.
   - Sort the selected items by `lineNo` before returning.

3. Preserve existing timeline behavior.
   - Existing test with mixed WARN, retry, Spring Boot failure, shutdown, and FATAL should still pass or be updated only where the old order encoded the bug.
   - Keep message generation unchanged.

4. Verify.
   - Run `node tests/timeline.test.mjs`.
   - Run `powershell -ExecutionPolicy Bypass -File .\init.ps1`.

5. Browser acceptance.
   - Load an adversarial log with more than 12 notable events and a late FATAL.
   - Expected: timeline includes the late FATAL and the preview focus button works for it.

### Acceptance Rules

- Late FATAL/Critical events are visible even when earlier low-priority notable events exceed the limit.
- Timeline display remains chronological by line number.
- Omitted count remains accurate.
- Focus behavior for timeline items still expands or flags the matching preview row.

## Work Item 3: Scalable Preview Navigation

### Problem

The preview currently renders only the first 500 filtered rows. This protects performance but makes large logs hard to inspect beyond the first page of matches.

### User Impact

Users can analyze large files but cannot navigate all matching preview rows. Timeline focus or group location can also target a row outside the visible preview window.

### Requirements

- Users must be able to inspect all filtered rows in manageable chunks.
- The app must stay dependency-free.
- Existing filters must compose with the new navigation model.
- Focus actions from timeline and problem groups must bring the target row into the visible preview page or window when possible.
- Rendering should remain fast on large logs.

### Recommended Approach

Start with pagination rather than full virtual scrolling. Pagination is simpler, testable in pure DOM output, and enough to remove the 500-row hard stop. Use a default page size of 500 to preserve current performance behavior.

Add:

- `state.previewPage = 1`
- `const PREVIEW_PAGE_SIZE = 500`
- page controls near `previewMeta`, such as Previous, Next, and current page text
- reset to page 1 when filters/search/time/identifier level filters change
- when focusing a line, compute the filtered index and set `previewPage` to the page containing that line

Virtual scrolling can be a later task if pagination is not enough.

### Development Steps

1. Add renderer support for pagination controls.
   - File: `js/renderers.mjs`.
   - Create `renderPreviewPagerHtml({ page, pageCount, filteredCount })`.
   - Include disabled previous/next buttons when unavailable.
   - Escape any dynamic text even though values are numeric.

2. Add renderer tests.
   - File: `tests/renderers-chart.test.mjs` or a new `tests/preview-pagination.test.mjs`.
   - Assert no pager when `pageCount <= 1`.
   - Assert previous disabled on page 1.
   - Assert next disabled on last page.

3. Add preview state.
   - File: `app.js`.
   - Add `previewPage` to `state`.
   - Replace `PREVIEW_LIMIT` slicing with page slicing:
     - `pageCount = Math.max(1, Math.ceil(filtered.length / PREVIEW_PAGE_SIZE))`
     - clamp `state.previewPage`
     - `start = (page - 1) * PREVIEW_PAGE_SIZE`
     - `shown = filtered.slice(start, start + PREVIEW_PAGE_SIZE)`

4. Add page controls.
   - File: `index.html`.
   - Add a pager container near `previewMeta`, for example `<div id="previewPager" class="preview-pager"></div>`.
   - File: `app.js`.
   - Bind delegated pager click handlers after rendering.
   - File: `styles.css`.
   - Style controls as compact buttons consistent with existing filter chips.

5. Reset pagination on filter changes.
   - Set `state.previewPage = 1` when search, level filters, time window, identifier filter, or clear filters change.
   - Do not reset the page when expanding stack/diagnostic/context/report rows.

6. Make focus actions page-aware.
   - In `focusTimelineLine`, after setting `focusedLineNo`, compute the focused row's index in the current filtered list.
   - Move to the containing page if the row is present.
   - If filters hide the line, keep the existing hidden-focus message.

7. Verify with tests.
   - Add an app smoke or pure helper test for page slicing and focus page selection if possible.
   - Run `powershell -ExecutionPolicy Bypass -File .\init.ps1`.

8. Browser acceptance.
   - Generate or load a log with more than 700 matching rows.
   - Confirm page 1 shows rows 1-500 and page 2 shows rows 501+.
   - Apply a search filter and confirm pager resets to page 1 with the filtered count.
   - Click a timeline or problem-group focus target outside page 1 and confirm the preview navigates to the page containing the target row.

### Acceptance Rules

- No filtered row is unreachable solely because of the 500-row cap.
- Preview remains responsive with thousands of rows.
- Pager state resets when filters change.
- Row expansion state still works by `lineNo`.
- Timeline and group focus work across pages.
- Full `init.ps1` passes.

## Suggested Implementation Order

1. Worker job safety.
2. Prioritized timeline.
3. Preview pagination.

This order fixes correctness risks before adding navigation surface area. In goal mode, treat each item as a separate goal and make a separate commit with its own targeted regression tests.

## Global Verification Checklist

Run these after each work item:

```powershell
node --check app.js
node --check js/parser.mjs
node --check js/renderers.mjs
node --check js/timeline.mjs
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
- Reworking the whole visual design.
- Changing diagnostic rule semantics except where needed for timeline priority.
