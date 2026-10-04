// Canonical calendar helpers live in lib/culture/calendar.cjs (CommonJS) so Node, Next and the
// browser copy all share one implementation.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export function loadCultureLib() { return require('../lib/culture/calendar.cjs'); }
