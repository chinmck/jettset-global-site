import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const load = (l) => JSON.parse(readFileSync(new URL(`../public/i18n/${l}.json`, import.meta.url), "utf8"));
const dicts = { fr: load("fr"), es: load("es"), ar: load("ar") };

test("all three dictionaries cover exactly the same English keys", () => {
  const fr = Object.keys(dicts.fr.strings).sort();
  assert.deepEqual(Object.keys(dicts.es.strings).sort(), fr);
  assert.deepEqual(Object.keys(dicts.ar.strings).sort(), fr);
  assert.ok(fr.length > 1500, "full-site coverage expected");
});

test("no empty translations", () => {
  for (const [l, d] of Object.entries(dicts)) {
    for (const [k, v] of Object.entries(d.strings)) assert.ok(v && v.trim(), `${l}: empty translation for ${k.slice(0, 60)}`);
  }
});

test("HTML units keep the same tags as their English source", () => {
  const tags = (s) => (s.match(/<\/?[a-z][^>]*>/gi) || []).map((t) => t.replace(/\s+/g, " "));
  for (const [l, d] of Object.entries(dicts)) {
    for (const [k, v] of Object.entries(d.strings)) {
      if (!/<[a-z]/i.test(k)) continue;
      const strip = (arr) => arr.map((t) => t.replace(/>.*/, "").replace(/\s.*/, ""));   // compare tag names only
      assert.deepEqual(strip(tags(v)), strip(tags(k)), `${l}: tag structure differs for ${k.slice(0, 70)}`);
    }
  }
});

test("patterns compile and use the same capture groups in every language", () => {
  const n = dicts.fr.patterns.length;
  assert.equal(dicts.es.patterns.length, n); assert.equal(dicts.ar.patterns.length, n);
  for (let i = 0; i < n; i++) {
    const re = new RegExp(dicts.fr.patterns[i][0]);
    assert.equal(dicts.es.patterns[i][0], dicts.fr.patterns[i][0]);
    const groups = new RegExp(re.source + "|").exec("").length - 1;
    for (const l of ["fr", "es", "ar"]) {
      const refs = [...dicts[l].patterns[i][1].matchAll(/\$(\d)/g)].map((m) => +m[1]);
      for (const r of refs) assert.ok(r <= groups, `${l} pattern ${i} references $${r} but has ${groups} groups`);
    }
  }
});

test("calendar and airport-list strings are translated", () => {
  for (const k of ["The Global Culture Calendar", "Discover", "No matching airports found.", "Start typing a city or airport", "Previous event", "Pause automatic rotation"]) {
    for (const d of Object.values(dicts)) assert.ok(d.strings[k], `missing: ${k}`);
  }
});
