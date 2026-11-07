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
const { shareCanvasImage, copyText } = await import(
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
