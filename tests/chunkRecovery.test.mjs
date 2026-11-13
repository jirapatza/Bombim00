import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const result = await build({
  entryPoints: ["src/utils/chunkRecovery.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { ChunkRecovery, CHUNK_RELOAD_KEY } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
);

const memoryStorage = () => {
  const values = new Map();
  return {
    values,
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
};

test("a chunk failure reloads once and marks the session as reloaded", () => {
  const storage = memoryStorage();
  let reloads = 0;
  const recovery = new ChunkRecovery({ storage, isOnline: () => true, reload: () => reloads++ });

  assert.equal(recovery.reloadAfterChunkError(), true);
  assert.equal(reloads, 1);
  assert.equal(storage.getItem(CHUNK_RELOAD_KEY), "1");
  assert.equal(recovery.reloadAfterChunkError(), false);
  assert.equal(reloads, 1);
});

test("blocked storage still allows exactly one reload instead of looping", () => {
  const broken = {
    getItem: () => {
      throw Error("storage blocked");
    },
    setItem: () => {
      throw Error("storage blocked");
    },
    removeItem: () => {
      throw Error("storage blocked");
    },
  };
  let reloads = 0;
  const recovery = new ChunkRecovery({ storage: broken, isOnline: () => true, reload: () => reloads++ });

  assert.equal(recovery.reloadAfterChunkError(), true);
  assert.equal(recovery.reloadAfterChunkError(), false);
  assert.equal(reloads, 1);
});

test("an offline browser keeps the in-app recovery panel and never reloads", () => {
  const storage = memoryStorage();
  let reloads = 0;
  const recovery = new ChunkRecovery({ storage, isOnline: () => false, reload: () => reloads++ });

  assert.equal(recovery.shouldReload(), false);
  assert.equal(recovery.reloadAfterChunkError(), false);
  assert.equal(reloads, 0);
  assert.equal(storage.getItem(CHUNK_RELOAD_KEY), null);
});

test("a loaded chunk clears the guard so a later deploy can recover again", () => {
  const storage = memoryStorage();
  const recovery = new ChunkRecovery({ storage, isOnline: () => true, reload: () => {} });

  recovery.reloadAfterChunkError();
  assert.equal(storage.getItem(CHUNK_RELOAD_KEY), "1");

  recovery.markChunkReady();
  assert.equal(storage.getItem(CHUNK_RELOAD_KEY), null);

  const reloaded = new ChunkRecovery({ storage, isOnline: () => true, reload: () => {} });
  assert.equal(reloaded.shouldReload(), true);
});
