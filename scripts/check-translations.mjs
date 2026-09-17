// Guards the translation table in app/page.tsx against the two ways it has
// drifted before:
//
//   1. A key defined in T.en that nothing ever calls through t(). Those look
//      translated — all eleven languages carry a value — while the UI renders
//      a hardcoded English literal next to them. 45 keys were in this state
//      before Stage 1.
//   2. A language block missing a key another block has, which silently falls
//      back to English mid-screen.
//
// Deliberately dependency-free and read-only: `node scripts/check-translations.mjs`.
// Exits non-zero on a finding so it can move into CI unchanged.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "app", "page.tsx");
const src = readFileSync(SRC, "utf8");

// Keys that are allowed to exist without a t() call. Each needs a reason —
// an empty allowlist is the goal, so anything parked here should be a real
// decision rather than a to-do that went quiet.
const ALLOWED_UNUSED = {};

function fail(msg) {
  console.error(msg);
  process.exitCode = 1;
}

// --- parse the T table ------------------------------------------------------
const tStart = src.indexOf("const T:Record<Lang,Record<string,string>> = {");
if (tStart === -1) fail("Could not find the T table in app/page.tsx.");
const tEnd = src.indexOf("\n};", tStart);
const table = src.slice(tStart, tEnd);

// Each language block starts at two-space indentation: `  en:{`
const blocks = {};
const values = {};
const blockRe = /\n {2}(\w+):\{/g;
const starts = [];
let m;
while ((m = blockRe.exec(table)) !== null) starts.push([m[1], m.index + m[0].length]);
starts.forEach(([code, from], i) => {
  const to = i + 1 < starts.length ? starts[i + 1][1] : table.length;
  const slice = table.slice(from, to);
  blocks[code] = [...slice.matchAll(/(\w+):"/g)].map((x) => x[1]);
  // Per block, not table-wide — a table-wide scan lets the last language
  // overwrite every earlier one and reports Chinese under an English heading.
  values[code] = Object.fromEntries(
    [...slice.matchAll(/(\w+):"((?:[^"\\]|\\.)*)"/g)].map((x) => [x[1], x[2]]),
  );
});

const langs = Object.keys(blocks);
if (!langs.includes("en")) fail("No `en` block found in T.");

// --- 1. key parity across languages ----------------------------------------
const enKeys = blocks.en;
const enSet = new Set(enKeys);
let parityBroken = false;
for (const code of langs) {
  if (code === "en") continue;
  const set = new Set(blocks[code]);
  const missing = enKeys.filter((k) => !set.has(k));
  const extra = blocks[code].filter((k) => !enSet.has(k));
  if (missing.length || extra.length) {
    parityBroken = true;
    fail(`  ${code}: ${missing.length} missing, ${extra.length} extra`);
    if (missing.length) fail(`      missing: ${missing.join(", ")}`);
    if (extra.length) fail(`      extra:   ${extra.join(", ")}`);
  }
}

// --- 2. keys nothing calls --------------------------------------------------
// Counts t("key") anywhere outside the table itself, so a key's own definition
// never counts as a use.
const body = src.slice(0, tStart) + src.slice(tEnd);
const used = new Set([...body.matchAll(/\bt\("(\w+)"\)/g)].map((x) => x[1]));

// Some families are looked up dynamically — catLabel does t("cat_" + key), so
// no literal t("cat_health") exists anywhere. Without this, 59 live keys read
// as dead and the check cries wolf until someone stops believing it. A prefix
// counts as used only when the source actually builds a key from it.
const dynamicPrefixes = [...body.matchAll(/\bt\("(\w+?_)"\s*\+/g)].map((x) => x[1]);
const isDynamic = (k) => dynamicPrefixes.some((p) => k.startsWith(p));

const unused = enKeys.filter(
  (k) => !used.has(k) && !isDynamic(k) && !(k in ALLOWED_UNUSED),
);

// An allowlist entry for a key that no longer exists is stale — it would go on
// silently excusing nothing. Surface it rather than let it rot.
const stale = Object.keys(ALLOWED_UNUSED).filter((k) => !enSet.has(k));
for (const k of stale) fail(`stale allowlist entry: '${k}' is no longer a key in T.en`);

// --- report -----------------------------------------------------------------
console.log(`languages: ${langs.length}   keys per language: ${enKeys.length}`);
console.log(parityBroken ? "key parity:  BROKEN (see above)" : "key parity:  ok");

const allowed = Object.keys(ALLOWED_UNUSED).filter((k) => enSet.has(k) && !used.has(k));
if (allowed.length) {
  console.log(`allowlisted: ${allowed.length} unused on purpose (${allowed.join(", ")})`);
}

if (unused.length === 0) {
  console.log("unused keys: none");
} else {
  console.log(`\nunused keys: ${unused.length} defined in T.en but never passed to t()`);
  console.log("(each is translated into every language and rendered by nothing)\n");
  for (const k of unused) {
    const v = (values.en?.[k] ?? "").slice(0, 56);
    console.log(`  ${k.padEnd(20)} ${JSON.stringify(v)}`);
  }
  fail("");
}
