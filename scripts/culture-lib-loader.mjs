// public/culture/culture-lib.js is a browser/UMD script, and this package is "type":"module",
// so Node can't require() it directly. Evaluate it with a CommonJS-style `module` instead.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function loadCultureLib() {
  const file = join(dirname(fileURLToPath(import.meta.url)), '../public/culture/culture-lib.js');
  const mod = { exports: {} };
  new Function('module', readFileSync(file, 'utf8'))(mod);
  return mod.exports;
}
