const ERROR_LEVELS = new Set(["ERROR", "FATAL"]);

export function loadDiagnosticRules(data) {
  const rules = Array.isArray(data) ? data : data?.rules;
  if (!Array.isArray(rules)) {
    throw new Error("diagnostics.json must contain a rules array");
  }
  return rules.map((rule) => ({
    ...rule,
    match: {
      any: (rule.match?.any || []).map((pattern) => new RegExp(pattern, "i")),
    },
    variables: Object.fromEntries(
      Object.entries(rule.variables || {}).map(([name, pattern]) => [
        name,
        new RegExp(pattern, "i"),
      ])
    ),
  }));
}

export function findDiagnostic(row, rules = []) {
  if (!row || !ERROR_LEVELS.has(row.level)) return null;
  const raw = row.raw || "";
  const rule = rules.find((item) => item.match.any.some((re) => re.test(raw)));
  if (!rule) return null;
  const vars = extractVariables(raw, rule.variables);
  return {
    id: rule.id,
    title: interpolate(rule.title, vars),
    reason: interpolate(rule.reason, vars),
    details: (rule.details || []).map((item) => interpolate(item, vars)),
    solutions: (rule.solutions || []).map((item) => interpolate(item, vars)),
    tags: rule.tags || [],
  };
}

function extractVariables(raw, variablePatterns) {
  const vars = {};
  for (const [name, re] of Object.entries(variablePatterns || {})) {
    const match = raw.match(re);
    const value = match?.slice(1).find(Boolean);
    if (value) vars[name] = value;
  }
  return vars;
}

function interpolate(template, vars) {
  return String(template || "").replace(/\{\{(\w+)\}\}/g, (_, name) => {
    return vars[name] || `<${name}>`;
  });
}
