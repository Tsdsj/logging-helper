export function buildCustomDiagnosticsTemplate() {
  return {
    rules: [
      {
        id: "custom-example-rule",
        title: "自定义错误示例",
        tags: ["custom", "example"],
        match: {
          any: ["CustomExampleError", "ExampleService failed"],
        },
        variables: {
          service: "service=([A-Za-z0-9_-]+)",
        },
        reason: "自定义知识库匹配到了 {{service}} 的示例错误。",
        details: [
          "把 `match.any` 替换成你项目日志中稳定出现的错误关键字或正则。",
          "可选的 `variables` 会从日志中提取值，并替换 reason/details/solutions 中的 {{name}}。",
        ],
        solutions: [
          "确认触发该错误的服务、配置或依赖是否可用。",
          "把你的排查命令或团队 Runbook 链接写在这里。",
        ],
      },
    ],
  };
}

export function buildCustomDiagnosticsTemplateDownload() {
  return {
    filename: "diagnostics-custom-template.json",
    content: JSON.stringify(buildCustomDiagnosticsTemplate(), null, 2),
    type: "application/json",
  };
}
