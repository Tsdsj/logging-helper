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
- `app.js`：日志解析、统计、过滤与导出逻辑
