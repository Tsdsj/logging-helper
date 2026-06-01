# Project Agent Instructions

- Before developing or reading this project, read this file first.
- This is a zero-dependency static web app for local log analysis.
- Keep logs local in the browser; do not add a backend or remote upload path unless the user explicitly requests it.
- Prefer small, testable slices. Update `feature_list.json`, `agent-state.md`, and `codex-progress.md` through the Auto_dev parent flow.
- Use `node --check` and the `.mjs` tests in `tests/` for fast validation.
- For browser-visible changes, verify through the real static page when possible.
