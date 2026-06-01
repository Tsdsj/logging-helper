const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function fakeElement() {
  return {
    hidden: false,
    innerHTML: "",
    textContent: "",
    value: "",
    checked: true,
    files: null,
    classList: {
      add() {},
      remove() {},
      toggle() {},
    },
    addEventListener() {},
    appendChild() {},
    remove() {},
    click() {},
    querySelector() {
      return fakeElement();
    },
    querySelectorAll() {
      return [];
    },
  };
}

function loadApp() {
  const appPath = path.join(__dirname, "..", "app.js");
  const code = fs.readFileSync(appPath, "utf8");
  const context = {
    console,
    Blob: class Blob {},
    URL: {
      createObjectURL() {
        return "blob:test";
      },
      revokeObjectURL() {},
    },
    document: {
      body: fakeElement(),
      createElement() {
        return fakeElement();
      },
      getElementById() {
        return fakeElement();
      },
      querySelectorAll() {
        return [];
      },
      documentElement: {
        setAttribute() {},
        getAttribute() {
          return "dark";
        },
      },
    },
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
    window: {
      matchMedia() {
        return { matches: false };
      },
    },
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: appPath });
  return context;
}

const app = loadApp();

const raw = `***************************
APPLICATION FAILED TO START
***************************
Description:
Web server failed to start. Port 8080 was already in use.
Action:
Identify and stop the process that's listening on port 8080 or configure this application to listen on another port.`;

const row = {
  lineNo: 35,
  raw,
  level: "ERROR",
  lineSpan: 7,
  count: 1,
};

const diagnostic = app.findDiagnostic(row);
assert.ok(diagnostic, "Port conflict should match a diagnostic rule");
assert.equal(diagnostic.id, "port-already-in-use");
assert.match(diagnostic.reason, /端口 8080 已被其他进程占用/);
assert.ok(diagnostic.solutions.some((item) => item.includes("netstat -ano")));

const collapsed = app.renderPreviewRow(row, null, {
  expandedStack: false,
  expandedDiagnostic: false,
});
assert.match(collapsed, /data-action="toggle-stack"/);
assert.match(collapsed, /堆栈 7 行/);
assert.match(collapsed, /data-action="toggle-diagnostic"/);
assert.match(collapsed, /诊断建议/);
assert.doesNotMatch(collapsed, /Identify and stop the process/);

const expanded = app.renderPreviewRow(row, null, {
  expandedStack: true,
  expandedDiagnostic: true,
});
assert.match(expanded, /preview-detail-row/);
assert.match(expanded, /Identify and stop the process/);
assert.match(expanded, /端口 8080 已被其他进程占用/);
assert.match(expanded, /修改 `server.port`/);

console.log("Preview diagnostics regression passed");
