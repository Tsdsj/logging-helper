# Next Phase: Log Intelligence Features

## Goal

Turn logging-helper from a log viewer into a local troubleshooting assistant that summarizes likely root causes, preserves useful context, and produces shareable issue reports without uploading logs.

## Target Outcomes

1. Users can identify the most likely root cause in a multi-line error event.
2. Users can inspect the lines immediately before and after an error without losing their place.
3. Users can generate a concise Markdown issue report for one error.
4. Users can follow trace/request/correlation IDs across the preview.
5. Users can understand why a knowledge-base suggestion matched.
6. Users can import and export custom diagnostic rules.
7. Users can see a severity label for high-impact failures.
8. Users can view startup/runtime events as a simple timeline.

## Constraints

- Keep all processing client-side.
- Keep the app dependency-free unless a later task explicitly justifies a small dependency.
- Preserve existing parser, diagnostics, preview, and export tests.
- Prefer JSON-driven knowledge rules over hard-coded product copy.

## Recommended Phase Order

1. Root-cause extraction and issue report.
2. Context window and trace ID grouping.
3. Knowledge-base explanation and custom rule import/export.
4. Severity labels and timeline.
