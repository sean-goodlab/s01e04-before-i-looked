import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const night = process.argv[2] ?? '2026-10-28';
const out = process.argv[3] ?? 'var/preview/index.html';

const res = await createApp(loadConfig()).request(`/digest/${night}`);
if (res.status !== 200) throw new Error(`/digest/${night} returned ${res.status}`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, await res.text());
console.log(`saved /digest/${night} to ${out}`);
