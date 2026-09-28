/** Vitest setup — load Matter.js onto globalThis before game modules import it. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.Matter = require('matter-js');
