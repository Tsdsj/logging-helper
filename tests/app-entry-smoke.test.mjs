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

byId("optMergeStack").checked = true;
byId("optCollapseDup").checked = true;

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

await import(`../app.js?smoke=${Date.now()}`);

byId("sampleBtn").click();
assert.equal(byId("results").hidden, false);
assert.equal(byId("emptyState").hidden, true);

byId("clearBtn").click();
assert.equal(byId("results").hidden, true);
assert.equal(byId("emptyState").hidden, false);

byId("optMergeStack").checked = false;
byId("optMergeStack").listeners.change?.({});
assert.equal(
  byId("results").hidden,
  true,
  "changing parser options after clearing should not re-analyze the previous input"
);
assert.equal(byId("emptyState").hidden, false);

assert.ok(true);
console.log("App entry smoke passed");
