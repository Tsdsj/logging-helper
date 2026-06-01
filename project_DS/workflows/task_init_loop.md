---
description: Task initialization workflow for converting a product requirement into an ordered, executable feature_list.json queue.
---

# Task Initialization Workflow

Use this workflow when a new requirement needs to become an Auto_dev-ready task queue.

1. Read `AGENTS.md`, `agent-state.md`, `feature_list.json`, and `final_feature_list.json` if they exist.
2. Choose a queue update mode:
   - `replace-active`: archive the current active queue and replace it.
   - `rewrite-pending`: preserve completed active tasks and rewrite pending tasks.
   - `append-phase`: keep active tasks and append the new phase.
3. Map the requirement to user-visible outcomes and acceptance checks.
4. Split implementation into very small, ordered tasks with stable `task_id` values.
5. Write all new task text in English.
6. Ensure each task has `task_type`, `description`, `steps`, `budget_minutes`, and `passes: false`.
7. Keep tasks within 10 minutes by default.
8. Refresh `agent-state.md` so the first pending task and recommended reads are accurate.
