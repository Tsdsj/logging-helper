import assert from "node:assert/strict";

const elements = new Map();
const radios = [
  fakeElement({ name: "searchMode", value: "plain", checked: true }),
  fakeElement({ name: "searchMode", value: "regex", checked: false }),
];
const granularityButtons = [
  fakeElement({ dataset: { granularity: "hour" } }),
  fakeElement({ dataset: { granularity: "day" } }),
];
const workerInstances = [];

function fakeElement(overrides = {}) {
  const el = {
    hidden: false,
    innerHTML: "",
    textContent: "",
    value: "",
    checked: true,
    files: null,
    dataset: {},
    style: {},
    children: [],
    listeners: {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    appendChild(child) {
      this.children.push(child);
    },
    remove() {},
    click() {
      this.listeners.click?.({ preventDefault() {} });
    },
    querySelector() {
      return fakeElement();
    },
    querySelectorAll() {
      return [];
    },
  };
  return Object.assign(el, overrides);
}

function byId(id) {
  if (!elements.has(id)) elements.set(id, fakeElement());
  return elements.get(id);
}

class FakeWorker {
  constructor() {
    this.messages = [];
    this.onmessage = null;
    this.onerror = null;
    workerInstances.push(this);
  }

  postMessage(message) {
    this.messages.push(message);
  }

  send(message) {
    this.onmessage?.({ data: message });
  }

  terminate() {}
}

byId("optMergeStack").checked = true;
byId("optCollapseDup").checked = true;
byId("sampleSelect").value = "spring-boot";

globalThis.Worker = FakeWorker;
globalThis.document = {
  body: fakeElement(),
  createElement() {
    return fakeElement();
  },
  getElementById(id) {
    return byId(id);
  },
  querySelectorAll(selector) {
    if (selector === 'input[name="searchMode"]') return radios;
    if (selector === ".seg-btn[data-granularity]") return granularityButtons;
    return [];
  },
  documentElement: {
    setAttribute() {},
    getAttribute() {
      return "dark";
    },
  },
};
globalThis.localStorage = {
  getItem() {
    return null;
  },
  setItem() {},
};
globalThis.window = {
  matchMedia() {
    return { matches: false };
  },
};
globalThis.fetch = async () => ({
  ok: true,
  async json() {
    return { rules: [] };
  },
});

await import(`../app.js?worker-state=${Date.now()}`);

const staleLargeLog = [
  "2026-06-06 10:00:00 INFO stale run started",
  ...Array.from({ length: 6000 }, (_, i) => `2026-06-06 10:00:${String(i % 60).padStart(2, "0")} ERROR stale worker row ${i}`),
].join("\n");

byId("logFile").files = [
  {
    name: "large-stale.log",
    size: staleLargeLog.length,
    async text() {
      return staleLargeLog;
    },
  },
];

const analyzePromise = byId("analyzeBtn").listeners.click();
await Promise.resolve();
assert.equal(workerInstances.length, 1, "large input should use a Worker");
const staleJob = workerInstances[0].messages[0];
assert.ok(staleJob?.id, "Worker analysis should post a job id");

byId("sampleBtn").click();
const sampleStatus = byId("status").textContent;
const sampleTotal = byId("totalLines").textContent;

workerInstances[0].send({
  id: staleJob.id,
  type: "done",
  rows: [
    {
      lineNo: 1,
      lineSpan: 1,
      level: "ERROR",
      raw: "2026-06-06 10:00:00 ERROR stale worker result",
      hourKey: "2026-06-06 10:00",
      dayKey: "2026-06-06",
      count: 1,
    },
  ],
  result: {
    totalLines: 1,
    errorLines: 1,
    errorRate: 100,
    fileCount: 1,
    events: 1,
    levels: new Map([["ERROR", 1]]),
    errorTypes: [["stale", 1]],
    hourTrend: [["2026-06-06 10:00", 1]],
    dayTrend: [["2026-06-06", 1]],
    mergedStacks: 0,
    collapsedGroups: 0,
    patternGroups: [],
  },
});
await analyzePromise;

assert.equal(
  byId("totalLines").textContent,
  sampleTotal,
  "stale Worker result must not replace the newer sample metrics"
);
assert.equal(
  byId("status").textContent,
  sampleStatus,
  "stale Worker result must not replace the newer sample status"
);
assert.notEqual(byId("totalLines").textContent, "1");

byId("logFile").files = [
  {
    name: "large-stale-after-clear.log",
    size: staleLargeLog.length,
    async text() {
      return staleLargeLog;
    },
  },
];

const clearAnalyzePromise = byId("analyzeBtn").listeners.click();
await Promise.resolve();
const clearWorker = workerInstances.at(-1);
const clearJob = clearWorker.messages.at(-1);
assert.ok(clearJob?.id, "second large input should post another Worker job id");

byId("clearBtn").click();
clearWorker.send({
  id: clearJob.id,
  type: "done",
  rows: [
    {
      lineNo: 1,
      lineSpan: 1,
      level: "ERROR",
      raw: "2026-06-06 10:00:00 ERROR stale worker result after clear",
      hourKey: "2026-06-06 10:00",
      dayKey: "2026-06-06",
      count: 1,
    },
  ],
  result: {
    totalLines: 1,
    errorLines: 1,
    errorRate: 100,
    fileCount: 1,
    events: 1,
    levels: new Map([["ERROR", 1]]),
    errorTypes: [["stale", 1]],
    hourTrend: [["2026-06-06 10:00", 1]],
    dayTrend: [["2026-06-06", 1]],
    mergedStacks: 0,
    collapsedGroups: 0,
    patternGroups: [],
  },
});
await clearAnalyzePromise;

assert.equal(byId("results").hidden, true, "stale Worker result must not reopen results after clear");
assert.equal(byId("emptyState").hidden, false);
assert.equal(byId("totalLines").textContent, "0");

console.log("App Worker state regression passed");
