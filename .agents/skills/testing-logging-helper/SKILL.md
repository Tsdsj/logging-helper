---
name: testing-logging-helper
description: End-to-end test the logging-helper static web app (log upload → analysis → metrics/preview/patterns). Use when verifying parsing/UI changes such as stack merge, duplicate collapse, message-pattern clustering, level/timestamp detection, filters, search, or export.
---

# Testing logging-helper

纯前端零依赖静态站（`index.html` + `app.js` + `styles.css`）。无后端、无构建、无 CI。

## 本地启动

```bash
cd <repo>
python -m http.server 8000
```
浏览器打开 `http://localhost:8000`。改完代码刷新即可（建议 Ctrl+Shift+R 强刷，避免缓存旧 JS）。

## 核心测试流程（真实 UI）

1. 点拖拽区（dropzone）触发系统文件选择框，选一个日志文件 → 文件名出现在按钮下方。也可直接点「加载示例日志」用内置 SAMPLE_LOG（14 行 / 8 错 / 57.14%）。
2. 点「开始分析」。
3. 验证：
   - 顶部指标卡：总行数 / 错误行数 / 错误率 / 文件数
   - 状态栏文案（如「合并 N 段多行堆栈。折叠 M 组重复行。」）
   - 「日志级别分布」彩色标签占比
   - 「错误类型频次 Top10」「错误趋势（小时/天）」
   - 「消息模式 Top10」卡片，点击行展开原始样例
   - 「日志预览」表的徽标：`堆栈 N 行`（多行合并）、`级别×N`（重复折叠）
4. 「解析选项」两个开关（合并多行堆栈 / 折叠重复行）默认开，切换即就地重算。

## 准备测试数据（重要）

构造一个能区分「功能正常 vs 损坏」的日志，而非随便挑一个文件。例如对解析归并功能，准备含：
- 一段 Java 异常（`ERROR` 行 + `java.lang.XxxException:` + 多行 `at …` + `Caused by:`）
- 一段 Python `Traceback (most recent call last):` + 多行 `File "..."` + 末尾 `ValueError: ...`
- 连续 3 条完全相同的 ERROR 行（验证折叠 ×3）
- 几条可模板化的 INFO（如 `GET /users/123 200 12ms`，数字应被归一为 `<NUM>`）

记下预期值（事件数、错误率、各徽标），写进测试计划。

## 对照（adversarial）测试

关键：证明开关/功能真的改变了输出。例如关闭「合并多行堆栈」后，事件数应从「合并后」跳到「物理行数」，堆栈行散为独立 OTHER 行；重新勾选应还原。若切换前后数字不变，说明开关或解析逻辑没生效。

## 趋势联动过滤 + 高级搜索（PR #8）

「日志预览」卡片上方有：搜索框 + 关键字/正则单选 + AND/OR 段按钮 + 级别勾选。趋势条可点击按时段过滤。多过滤器是叠加（AND）关系：`level ∈ activeLevels` 且 `时段命中` 且 `搜索命中`。活动筛选以可移除 chip + 「清除全部」展示。

对抗判据（用 SAMPLE_LOG）：
- **点趋势条**：趋势只统计错误，但点某桶后预览应显示该时段**全部级别**的行。例：点 `09:00`（趋势计数=1）→ 预览应为 **3 条**（INFO+ERROR+WARN）。若仍 14 条 / 或只 1 条 → 失败。
- **叠加**：在选中时段上加关键字应进一步缩小。例：09:00 + `WARN` → 1 条。若忽略时段命中全部 WARN（3 条）→ 叠加没生效。
- **AND vs OR**：用两个不可能同现于一行的词（如 `NullPointer OutOfMemory`）。OR → 2 条，AND → 0 条。若两者结果相同 → 逻辑没生效。
- **正则**：用带元字符的式子（如 `Database|Payment`）证明非字面匹配 → 5 条；正则模式下 AND/OR 段应变灰禁用。
- **非法正则容错**：输入 `Payment(` 应显示红字 `正则表达式无效：...` 且预览**回退为全部行**、不崩溃。
- **清除全部**：复位预览为 N/N、chip 与红字消失、搜索框清空。
- 命中片段在预览里以 `<mark>` 高亮。

## 用控制台快速验证解析逻辑（可选）

`app.js` 的纯函数（`parseLines`、`templateOf`、`detectLevel`、`isContinuation`、`buildSearchMatcher` 等）可在浏览器控制台直接调用做单测，定位 UI 之外的解析 bug 更快。

## 已知坑

- `templateOf` 数字替换用 `/\d+/g`（不要加 `\b`），否则 `12ms` 这类带单位数字不会被模板化。
- Java 异常头是顶格（无缩进、无时间戳），`isContinuation` 需用类名正则 `/(Exception|Error|Throwable)\b/` 识别，否则不会并入上一条。
- 强刷浏览器（Ctrl+Shift+R）以避免加载到旧的 app.js。
- 录屏前先最大化浏览器窗口（`wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`）。
- 趋势条点击是按当前粒度（小时/天）匹配 `hourKey`/`dayKey`；若切换粒度后时段 chip 仍在，注意 key 不匹配可能导致预览为空——属预期，清除时段即可。

## Devin Secrets Needed

无。纯本地静态站，无需任何凭据。
