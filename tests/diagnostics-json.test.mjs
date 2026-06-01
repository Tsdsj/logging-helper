import assert from "node:assert/strict";
import fs from "node:fs";

import {
  findDiagnostic,
  loadDiagnosticRules,
} from "../js/diagnostics.mjs";

const rules = loadDiagnosticRules(
  JSON.parse(fs.readFileSync(new URL("../diagnostics.json", import.meta.url), "utf8"))
);

const cases = [
  {
    name: "Spring Boot port conflict",
    raw: "Web server failed to start. Port 8080 was already in use.",
    id: "port-already-in-use",
    reason: /端口 8080/,
  },
  {
    name: "Spring bean missing",
    raw: "org.springframework.beans.factory.NoSuchBeanDefinitionException: No qualifying bean of type 'com.example.UserService' available",
    id: "spring-no-such-bean",
    reason: /Spring 容器/,
  },
  {
    name: "Python missing module",
    raw: "ModuleNotFoundError: No module named 'requests'",
    id: "python-module-not-found",
    reason: /Python 模块 requests/,
  },
  {
    name: "Node missing module",
    raw: "Error: Cannot find module 'express'",
    id: "node-module-not-found",
    reason: /Node.js 模块 express/,
  },
  {
    name: "Database access denied",
    raw: "java.sql.SQLException: Access denied for user 'root'@'localhost' (using password: YES)",
    id: "database-access-denied",
    reason: /数据库拒绝用户 root/,
  },
  {
    name: "Go nil pointer",
    raw: "panic: runtime error: invalid memory address or nil pointer dereference",
    id: "go-nil-pointer",
    reason: /Go 程序访问了 nil/,
  },
];

for (const item of cases) {
  const diagnostic = findDiagnostic({ raw: item.raw, level: "ERROR" }, rules);
  assert.ok(diagnostic, `${item.name} should match a diagnostic rule`);
  assert.equal(diagnostic.id, item.id);
  assert.match(diagnostic.reason, item.reason);
  assert.ok(diagnostic.solutions.length >= 2);
}

assert.ok(rules.length >= 20, "knowledge base should include broad framework coverage");

console.log("Diagnostics JSON regression passed");
