import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

function appFor(dir: string) {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir: dir,
  });
}

function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

const night = [
  '{"at":"2026-10-28T01:00:00+01:00","job":"zeta","status":"ok","owner":"lane-07"}',
  '{"at":"2026-10-28T02:00:00+01:00","job":"alpha","status":"fail","owner":"rook","error":"nope"}',
  '{"at":"2026-10-28T03:00:00+01:00","job":"alpha","status":"retry","owner":"rook","error":"nope"}',
  '{"at":"2026-10-28T04:00:00+01:00","job":"alpha","status":"retry","owner":"rook","error":"nope"}',
  '{"at":"2026-10-28T05:00:00+01:00","job":"alpha","status":"retry","owner":null}',
  'not json',
].join('\n');

describe('digest routes', () => {
  it('returns 200 for the page and the JSON, in the same job order', async () => {
    const dir = tempRuns({ '2026-10-28.jsonl': night });
    const app = appFor(dir);
    const page = await app.request('/digest/2026-10-28');
    const json = await app.request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    const html = await page.text();
    const body = (await json.json()) as NightDigest;
    expect(body.rows.map((r) => r.job)).toEqual(['alpha', 'zeta']);
    const alphaAt = html.indexOf('alpha');
    const zetaAt = html.indexOf('zeta');
    expect(alphaAt).toBeGreaterThan(-1);
    expect(zetaAt).toBeGreaterThan(alphaAt);
    expect(html).not.toContain('nothing ran');
    expect(html).toContain('class="warn"');
    expect(body.badLines).toBe(1);
    expect(body.rows[0].owner).toBeNull();
  });

  it('returns 404 when the night file is missing', async () => {
    const dir = tempRuns({});
    const app = appFor(dir);
    expect((await app.request('/digest/2026-10-28')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-28')).status).toBe(404);
  });

  it('renders nothing ran for an empty file', async () => {
    const dir = tempRuns({ '2026-10-28.jsonl': '' });
    const page = await appFor(dir).request('/digest/2026-10-28');
    const json = await appFor(dir).request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(((await json.json()) as NightDigest).rows).toEqual([]);
  });

  it('still renders a night that contains a bad line', async () => {
    const dir = tempRuns({
      '2026-10-28.jsonl':
        '{"at":"2026-10-28T01:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}\n{truncated',
    });
    const page = await appFor(dir).request('/digest/2026-10-28');
    const json = await appFor(dir).request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('lane/sync');
    const body = (await json.json()) as NightDigest;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['lane/sync']);
  });
});
