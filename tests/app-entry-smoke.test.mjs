import assert from "node:assert/strict";

function fakeElement() {
  return {
    hidden: false,
    innerHTML: "",
    textContent: "",
    value: "",
    checked: true,
    files: null,
    dataset: {},
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

globalThis.document = {
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

assert.ok(true);
console.log("App entry smoke passed");
