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

const springBootPortFailure = `2026-06-01T02:36:22.100Z  INFO 12345 --- [main] o.s.b.w.e.tomcat.TomcatWebServer : Tomcat initialized with port 8080 (http)

***************************
APPLICATION FAILED TO START
***************************

Description:

Web server failed to start. Port 8080 was already in use.

Action:

Identify and stop the process that's listening on port 8080 or configure this application to listen on another port.
2026-06-01T02:36:22.570Z  INFO 12345 --- [SpringApplicationShutdownHook] o.s.c.a.AnnotationConfigApplicationContext : Closing`;

const rows = app.parseLines(springBootPortFailure, {
  mergeStack: true,
  collapseDup: true,
});
const result = app.summarize(rows, 1);
const failure = rows.find((row) => row.raw.includes("APPLICATION FAILED TO START"));
const unmergedRows = app.parseLines(springBootPortFailure, {
  mergeStack: false,
  collapseDup: true,
});

assert.equal(rows.length, 3);
assert.ok(failure, "Spring Boot failure analysis block should be present");
assert.equal(failure.level, "ERROR");
assert.equal(failure.lineSpan, 7);
assert.match(failure.raw, /Description:\nWeb server failed to start/);
assert.equal(result.errorLines, 1);
assert.equal(result.frequencies[0][0], "PortAlreadyInUse");
assert.equal(
  app.templateOf(failure.raw),
  "Web server failed to start. Port <NUM> was already in use."
);
assert.ok(
  unmergedRows.length > rows.length,
  "Disabling multi-line merge should split the Spring Boot failure block"
);

console.log("Spring Boot failure parsing regression passed");
