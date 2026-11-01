import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type DigestStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: DigestStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  night: string;
  rows: DigestRow[];
  badLines: number;
  counts: { ok: number; retry: number; fail: number };
};

const STATUSES = new Set<DigestStatus>(['ok', 'retry', 'fail']);

type ParsedLine = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

function parseLine(raw: string): ParsedLine | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (value === null || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.at !== 'string' || typeof rec.job !== 'string') return null;
  if (typeof rec.status !== 'string' || !STATUSES.has(rec.status as DigestStatus)) return null;
  if (!('owner' in rec) || (rec.owner !== null && typeof rec.owner !== 'string')) return null;
  if (rec.error !== undefined && typeof rec.error !== 'string') return null;
  return {
    at: rec.at,
    job: rec.job,
    status: rec.status as DigestStatus,
    owner: rec.owner,
    error: typeof rec.error === 'string' ? rec.error : undefined,
  };
}

export function readNight(runsDir: string, night: string): NightDigest | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }

  const groups = new Map<string, ParsedLine[]>();
  let badLines = 0;
  const counts = { ok: 0, retry: 0, fail: 0 };

  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines += 1;
      continue;
    }
    counts[line.status] += 1;
    const list = groups.get(line.job);
    if (list) list.push(line);
    else groups.set(line.job, [line]);
  }

  const rows = [...groups.entries()]
    .map(([, lines]) => {
      const ordered = [...lines].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
      const last = ordered[ordered.length - 1];
      const row: DigestRow = {
        job: last.job,
        owner: last.owner,
        runs: ordered.length,
        retries: ordered.filter((l) => l.status === 'retry').length,
        lastStatus: last.status,
        lastError: last.error ?? null,
        firstAt: ordered[0].at,
        lastAt: last.at,
      };
      return row;
    })
    .sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));

  return { night, rows, badLines, counts };
}
