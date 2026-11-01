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

// Signature only in this commit. The reader fills the body.
export function readNight(_runsDir: string, _night: string): NightDigest | null {
  throw new Error('readNight is not implemented');
}
