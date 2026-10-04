#!/usr/bin/env node
// Writes the browser copy of lib/culture/calendar.cjs to public/culture/culture-lib.js.
//   node scripts/sync-culture-lib.mjs          write
//   node scripts/sync-culture-lib.mjs --check  fail if the committed copy is out of date
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'lib/culture/calendar.cjs'), 'utf8');
const out = '/* GENERATED from lib/culture/calendar.cjs by scripts/sync-culture-lib.mjs. Do not edit by hand. */\n' + src;
const dest = join(root, 'public/culture/culture-lib.js');
if (process.argv.includes('--check')) {
  let cur = ''; try { cur = readFileSync(dest, 'utf8'); } catch {}
  if (cur !== out) { console.error('public/culture/culture-lib.js is out of date: run npm run culture:lib'); process.exit(1); }
  console.log('culture-lib.js up to date.');
} else { writeFileSync(dest, out); console.log('Wrote public/culture/culture-lib.js'); }
