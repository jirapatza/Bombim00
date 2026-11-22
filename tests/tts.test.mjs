import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

// A fake engine that never fires onend/onerror, which is what Chrome does when
// speak() runs before a user gesture or an utterance is cancelled.
const engine = { utterances: [], cancel() {}, getVoices: () => [], speak(u) { this.utterances.push(u); } };
class FakeUtterance {
  constructor(text) { this.text = text; }
}
globalThis.SpeechSynthesisUtterance = FakeUtterance;
globalThis.window = { speechSynthesis: engine, setTimeout, clearTimeout, SpeechSynthesisUtterance: FakeUtterance };

const bundle = await build({
  entryPoints: ["src/utils/thaiTts.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { ThaiTtsService } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

const finish = () => new Promise((resolve) => {
  ThaiTtsService.speak("ประกาศผลหวย", 1, resolve);
  return undefined;
});

test("a stalled engine reports failure instead of hanging the caller forever", async () => {
  // Keep the real formula but shorten the wait so the test stays fast.
  const original = ThaiTtsService.watchdogMs;
  ThaiTtsService.watchdogMs = () => 20;
  try {
    assert.equal(await finish(), false);
  } finally {
    ThaiTtsService.watchdogMs = original;
  }
});

test("a finished utterance reports success", async () => {
  const done = finish();
  engine.utterances.at(-1).onend();
  assert.equal(await done, true);
});

test("an interrupted utterance reports failure so the warning can be replayed", async () => {
  const done = finish();
  ThaiTtsService.stop();
  engine.utterances.at(-1).onend();
  assert.equal(await done, false);
});

test("the watchdog grows with the sentence but stays bounded", () => {
  assert.ok(ThaiTtsService.watchdogMs("สั้น") < ThaiTtsService.watchdogMs("ประโยคที่ยาวกว่ามาก"));
  assert.ok(ThaiTtsService.watchdogMs("x".repeat(5000)) <= 60_000);
});
