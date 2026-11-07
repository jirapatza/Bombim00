import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const result = await build({
  entryPoints: ["src/utils/socialShare.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { shareCanvasImage, copyText, generateSummaryCanvas } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
);
test("image sharing awaits the asynchronous share result and falls back only on failure, not cancellation", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let downloads = 0;
  globalThis.document = { createElement: () => ({ click: () => downloads++ }) };
  const canvas = {
    toBlob: (cb) =>
      setTimeout(() => cb(new Blob(["png"], { type: "image/png" })), 0),
    toDataURL: () => "data:image/png;base64,cG5n",
  };
  try {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        canShare: () => true,
        share: async () => {
          throw new DOMException("cancel", "AbortError");
        },
      },
    });
    await shareCanvasImage(canvas, "summary");
    assert.equal(downloads, 0);
    navigator.share = async () => {
      await Promise.resolve();
      throw Error("share failed");
    };
    await shareCanvasImage(canvas, "summary");
    assert.equal(downloads, 1);
    navigator.canShare = () => false;
    await shareCanvasImage(canvas, "summary");
    assert.equal(downloads, 2);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else delete globalThis.navigator;
    delete globalThis.document;
  }
});
test("clipboard rejection returns failure so callers cannot claim a successful copy", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  try {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        clipboard: {
          writeText: async () => {
            throw new DOMException("denied", "NotAllowedError");
          },
        },
      },
    });
    assert.equal(await copyText("result"), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else delete globalThis.navigator;
  }
});

test("summary image labels full first prize separately from three-digit results", async () => {
  const oldDocument = globalThis.document;
  const labels = [];
  const noop = () => {};
  const ctx = {
    createLinearGradient: () => ({ addColorStop: noop }),
    fillRect: noop, fillText: (value) => labels.push(value),
    save: noop, restore: noop, beginPath: noop, moveTo: noop,
    lineTo: noop, quadraticCurveTo: noop, closePath: noop,
    fill: noop, stroke: noop,
  };
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
  try {
    await generateSummaryCanvas("summary", "today", "all", [
      { name: "Thai", flag: "", closeTimeStr: "15:00", status: "drawn", firstPrize: "123456", top3: "", bottom2: "12" },
      { name: "Other", flag: "", closeTimeStr: "14:00", status: "drawn", firstPrize: "", top3: "789", bottom2: "34" },
    ]);
    assert.ok(labels.includes("รางวัลที่ 1"));
    assert.ok(labels.includes("123456"));
    assert.ok(labels.includes("3 ตัว"));
    assert.ok(labels.includes("789"));
  } finally {
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
});
