# 日志分析助手（logging-helper）

一个轻量级、零依赖的静态 Web 应用，可在浏览器本地上传日志文件并进行分析，数据不会上传到任何服务器。

## 功能

- **拖拽 / 多文件上传**：拖入或点击选择，可一次分析多个文件并合并统计。
- **概览指标**：总行数、错误行数、错误率、文件数。
- **日志级别分布**：TRACE / DEBUG / INFO / WARN / ERROR / FATAL 分级计数与占比（彩色标签）。
- **多语言 / 多框架适配**：自动识别 Java/Spring Boot(logback)、Python logging、FastAPI/uvicorn/gunicorn、Node(winston/pino/bunyan，含数字级别)、Go(logrus/zap)、syslog、Android logcat 等常见日志格式的级别与时间戳。
- **多行堆栈合并**：自动把 Java 异常栈（`at ...` / `Caused by:`）、Python `Traceback` 等跨多行的堆栈并入上一条日志，统计与预览不再被拆散（可在「解析选项」中关闭）。
- **重复行折叠**：连续完全相同的日志折叠为一条并标注重复次数（`×N`），统计仍按真实出现次数计（可关闭）。
- **消息模式聚类（Top 10）**：把数字 / UUID / IP / 0x 地址 / 引号字符串等变量模板化（替换为 `<NUM>`/`<UUID>`/`<IP>` 等）后归并相似消息，快速定位高频日志模式；点击查看样例。
- **错误类型频次（Top 10）**：点击任意错误类型可查看对应原始行样例。
- **错误知识库诊断**：内置 `diagnostics.json` 规则库，命中常见 Java/Spring、Python、Node、Go、.NET、PHP、数据库、容器等错误时，在预览中提供原因与排查建议。
- **自定义知识库**：可导入本地自定义 diagnostics JSON，并可下载模板文件；规则仅在当前浏览器会话内合并使用。
- **根因、上下文与报告**：ERROR/FATAL 行可展开根因、附近事件上下文，并生成可复制的 Markdown 问题报告。
- **链路标识过滤**：自动识别 `traceId` / `requestId` / `correlationId` / `spanId`，点击标识 chip 可筛选同一链路事件。
- **严重度与关键时间线**：对启动失败、内存溢出、数据库不可用、FATAL 和普通错误标记 Critical/High/Medium/Low，并汇总关键事件时间线。
- **错误趋势**：按小时 / 按天聚合切换。
- **日志预览**：行号 + 级别彩色标签 + 内容，支持关键字实时搜索与级别过滤、关键字高亮。
- **导出报告**：一键导出分析结果为 JSON / 错误类型为 CSV。
- **深色模式**：明 / 暗主题切换，自动记忆选择。
- **使用引导**：空状态步骤提示 + 「加载示例日志」一键体验。

## 使用方式

1. 进入项目目录并启动本地静态服务（任选其一）：
   - `python -m http.server 8000`
   - 或其他你常用的静态文件服务器
2. 浏览器访问 `http://localhost:8000`。
3. 拖入或选择日志文件（`.log`、`.txt` 等），点击「开始分析」。
   - 没有日志时，可点击「加载示例日志」先体验。

## 日志智能工作流

上传日志并分析后，可以从概览逐步下钻：

1. 查看严重度概览和关键事件时间线，优先定位 Critical / High 事件。
2. 点击时间线事件可聚焦到对应预览行；若当前筛选隐藏了该行，页面会提示清除筛选后查看。
3. 展开 ERROR/FATAL 行的堆栈，查看 Java/Spring 或 Python traceback 的根因摘要。
4. 使用 Context 查看错误前后的附近事件，结合 `traceId` 等链路标识 chip 过滤同一请求链路。
5. 打开诊断建议查看知识库命中的原因、匹配依据和解决方案。
6. 使用 Report 生成 Markdown 问题报告并复制到 issue、工单或排障记录中。

所有日志、诊断匹配、自定义知识库导入和 Markdown 报告生成都在本地浏览器内完成；应用不会把日志或报告上传到远端服务。

## 日志识别规则（默认）

### 级别识别（按优先级）

1. **结构化字段**（最优先）：JSON / logfmt 的 `level` / `levelname` / `levelno` / `severity` / `lvl` 字段，支持字符串值（如 `"level":"error"`、`level=ERROR`）与 pino/bunyan 的**数字级别**（`10/20/30/40/50/60` → TRACE/DEBUG/INFO/WARN/ERROR/FATAL）。
2. **Android logcat 定位优先级字母**：`MM-DD HH:MM:SS.sss PID TID <V/D/I/W/E/F> Tag:` 中的单字母级别（优先于正文关键字，避免正文里的 “fatal” 等词误判）。
3. **正文关键字**（不区分大小写）：`TRACE`、`DEBUG`、`INFO`/`INFORMATION`、`NOTICE`、`WARN`/`WARNING`、`ERROR`/`SEVERE`、`FATAL`/`CRITICAL`/`PANIC`/`ALERT`/`EMERGENCY`。

未匹配的归为 `OTHER`。错误行：级别为 `ERROR` 或 `FATAL` 的行计入错误统计。

### 时间戳识别（按优先级）

1. ISO / 常见格式：`YYYY-MM-DD HH:mm:ss`、`YYYY-MM-DDTHH:mm:ss`（兼容毫秒、时区、方括号包裹）。
2. **Epoch 时间戳**：JSON / logfmt 的 `time` / `ts` / `timestamp` 字段中的 10 位（秒）或 13 位（毫秒）时间（pino/bunyan）。
3. **syslog 月份名**：`MMM DD HH:mm:ss`（如 `May 21 08:31:09`，无年份按月-日聚合）。
4. **MM-DD 格式**：`MM-DD HH:mm:ss(.sss)`（Android logcat，无年份按月-日聚合）。

趋势可按“小时”或“天”聚合；无法识别时间戳的行归入“未识别时间”。

## 文件说明

- `index.html`：页面结构
- `styles.css`：样式（含设计令牌与深色模式）
- `app.js`：页面状态、DOM 事件与模块编排
- `diagnostics.json`：本地错误知识库规则，可按 JSON 结构继续扩展
- `js/custom-diagnostics.mjs`：自定义知识库模板生成
- `js/parser.mjs`：日志解析、级别识别、统计与模式聚类
- `js/diagnostics.mjs`：知识库规则加载、正则编译与诊断匹配
- `js/preview.mjs`：日志预览行、堆栈展开与诊断建议渲染
- `js/renderers.mjs`：级别、频次、趋势、过滤器、严重度概览、时间线等 HTML 片段渲染
- `js/report.mjs`：单条错误事件的 Markdown 报告生成
- `js/severity.mjs`：错误严重度识别与计数
- `js/timeline.mjs`：关键事件时间线选择
- `js/utils.mjs`：通用格式化与 HTML 转义工具
