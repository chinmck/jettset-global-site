// Guards the public copy against em dashes (and decorative en dashes).
// Allowed: en dashes inside number/date ranges and the route-notation / proper-name exceptions listed below.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../public/", import.meta.url).pathname;
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? (/vendor|hero-screenshots|images|videos|assets/.test(p) ? [] : walk(p)) : [p];
});
const files = walk(root).filter((f) => /\.(html|js|css|json)$/.test(f) && !/airports\.json$/.test(f));

const EM = /—|&mdash;|&#8212;|&#x2014;|\\u2014|\\2014/;
// Spaced en dashes that are deliberate: route notation ("London – Nice"), cross-month date ranges and a proper name.
const EN_EXCEPTIONS = [/London (?:–|\\u2013) |(?:New York|Paris|Los Angeles|Dubai|Singapore|Lagos|Nice) (?:–|\\u2013) /, /\+ ' – ' \+ e\.d/, /' – ' \+ e\.d/, /Asia Now – Paris Asian Art Fair/, /London – Ibiza/, /(?:–|\\u2013) (?:Nice|Monaco|Dubai|London|Ibiza|Mykonos|Aspen|Mumbai|Hong Kong|New York|Londres|Niza|Dubaï|Dubái|Ibiza)/];

function codeLines(file, text) {
  let t = text;
  t = t.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ""));
  t = t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
  return t.split("\n").map((l, i) => [i + 1, l.trim().startsWith("//") ? "" : l.replace(/\s\/\/\s.*$/, "")]);
}

test("no em dashes in public copy (HTML, JS strings, CSS content, JSON, translations)", () => {
  const hits = [];
  for (const f of files) {
    for (const [n, l] of codeLines(f, readFileSync(f, "utf8"))) if (EM.test(l)) hits.push(`${f.replace(root, "")}:${n}`);
  }
  assert.deepEqual(hits, []);
});

test("no decorative en dashes (unspaced ranges, route notation and listed names excepted)", () => {
  // Unspaced en dashes are number/date ranges or compound names and are allowed. Spaced ones are checked here;
  // translation dictionaries mirror the route-notation labels, so only HTML, JS and CSS are inspected.
  const SPACED = /\s(?:–|&ndash;|&#8211;)\s|\s\\u2013\s/;
  const hits = [];
  for (const f of files.filter((x) => !/\.json$/.test(x))) {
    for (const [n, l] of codeLines(f, readFileSync(f, "utf8"))) {
      if (SPACED.test(l) && !EN_EXCEPTIONS.some((rx) => rx.test(l))) hits.push(`${f.replace(root, "")}:${n}: ${l.trim().slice(0, 80)}`);
    }
  }
  assert.deepEqual(hits, []);
});
