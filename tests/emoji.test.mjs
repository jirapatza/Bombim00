import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// U+231B HOURGLASS defaults to text presentation, so Android and some desktop
// fonts draw a box instead of a glyph. U+23F3 HOURGLASS WITH FLOWING SAND is
// the emoji-presentation form every emoji font carries.
const TEXT_HOURGLASS = "\u231b";
const EMOJI_HOURGLASS = "\u23f3";

function sources(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sources(path, found);
    else if (/\.(ts|tsx|css)$/.test(entry)) found.push(path);
  }
  return found;
}

test("no source uses the text-presentation hourglass", () => {
  const offenders = sources("src")
    .filter((path) => readFileSync(path, "utf8").includes(TEXT_HOURGLASS));
  assert.deepEqual(offenders, []);
});

test("the waiting slots use the emoji-presentation hourglass", () => {
  const screen = readFileSync("src/screens/LiveResultsScreen.tsx", "utf8");
  assert.equal(screen.split(`${EMOJI_HOURGLASS} รอผล`).length - 1, 2);
});

test("flags name an emoji font so a UI font without them is not tofu", () => {
  const css = readFileSync("src/index.css", "utf8");
  assert.match(css, /\.flag\s*\{[^}]*Noto Color Emoji/);
});
