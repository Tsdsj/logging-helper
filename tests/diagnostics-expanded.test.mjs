import assert from "node:assert/strict";
import fs from "node:fs";

import { findDiagnostic, loadDiagnosticRules } from "../js/diagnostics.mjs";

const rules = loadDiagnosticRules(
  JSON.parse(fs.readFileSync(new URL("../diagnostics.json", import.meta.url), "utf8"))
);

const cases = [
  ["jvm-unsupported-class-version", "java.lang.UnsupportedClassVersionError: com/example/App has been compiled by a more recent version of the Java Runtime"],
  ["spring-placeholder-unresolved", "java.lang.IllegalArgumentException: Could not resolve placeholder 'payment.api-key' in value \"${payment.api-key}\""],
  ["hibernate-lazy-initialization", "org.hibernate.LazyInitializationException: failed to lazily initialize a collection of role: com.example.User.orders, could not initialize proxy - no Session"],
  ["mybatis-invalid-bound-statement", "org.apache.ibatis.binding.BindingException: Invalid bound statement (not found): com.example.UserMapper.selectById"],
  ["python-import-circular", "ImportError: cannot import name 'UserService' from partially initialized module 'app.services' (most likely due to a circular import)"],
  ["django-disallowed-host", "django.core.exceptions.DisallowedHost: Invalid HTTP_HOST header: 'api.example.com'. You may need to add 'api.example.com' to ALLOWED_HOSTS."],
  ["fastapi-response-validation", "fastapi.exceptions.ResponseValidationError: 1 validation errors: {'loc': ('response', 'id'), 'msg': 'field required'}"],
  ["celery-unregistered-task", "Received unregistered task of type 'billing.tasks.charge_user'. The message has been ignored and discarded."],
  ["express-headers-already-sent", "Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client"],
  ["nest-dependency-resolution", "Nest can't resolve dependencies of the UsersService (?, ConfigService). Please make sure that the argument PrismaService at index [0] is available"],
  ["typescript-module-resolution", "error TS2307: Cannot find module '@/lib/api' or its corresponding type declarations."],
  ["prisma-client-not-generated", "Error: @prisma/client did not initialize yet. Please run \"prisma generate\" and try to import it again."],
  ["next-hydration-mismatch", "Error: Hydration failed because the initial UI does not match what was rendered on the server."],
  ["go-all-goroutines-deadlock", "fatal error: all goroutines are asleep - deadlock!\ngoroutine 1 [chan receive]:"],
  ["dotnet-assembly-load-failure", "System.IO.FileNotFoundException: Could not load file or assembly 'Newtonsoft.Json, Version=13.0.0.0'"],
  ["laravel-app-key-missing", "Illuminate\\Encryption\\MissingAppKeyException: No application encryption key has been specified."],
  ["rails-pending-migration", "ActiveRecord::PendingMigrationError: Migrations are pending. To resolve this issue, run: bin/rails db:migrate"],
  ["database-deadlock-detected", "ERROR java.sql.SQLTransactionRollbackException: Deadlock found when trying to get lock; try restarting transaction"],
  ["redis-oom-command-not-allowed", "ERROR redis.clients.jedis.exceptions.JedisDataException: OOM command not allowed when used memory > 'maxmemory'."],
  ["rabbitmq-precondition-failed", "ERROR channel error; reply-code=406, reply-text=PRECONDITION_FAILED - inequivalent arg 'durable' for queue 'jobs'"],
  ["elasticsearch-circuit-breaker", "OpenSearch exception [type=circuit_breaking_exception, reason=[parent] Data too large]"],
  ["container-oom-killed", "Last State: Terminated Reason: OOMKilled Exit Code: 137"],
  ["kubernetes-rbac-forbidden", "pods is forbidden: User \"system:serviceaccount:prod:deployer\" cannot list resource \"pods\" in API group \"\" in the namespace \"prod\""],
  ["tls-hostname-mismatch", "SSLHandshakeException: No subject alternative DNS name matching api.example.com found."],
  ["dns-resolution-failed", "java.net.UnknownHostException: redis.prod.svc.cluster.local"],
];

for (const [id, raw] of cases) {
  const diagnostic = findDiagnostic({ raw, level: "ERROR" }, rules);
  assert.ok(diagnostic, `${id} should match a diagnostic rule`);
  assert.equal(diagnostic.id, id);
  assert.ok(diagnostic.reason.length > 12, `${id} should explain the cause`);
  assert.ok(diagnostic.details.length >= 2, `${id} should include useful details`);
  assert.ok(diagnostic.solutions.length >= 2, `${id} should include actionable solutions`);
}

const ids = rules.map((rule) => rule.id);
assert.equal(new Set(ids).size, ids.length, "diagnostic rule ids should be unique");
assert.ok(rules.length >= 100, "knowledge base should be substantially expanded");

console.log("Expanded diagnostics coverage passed");
