import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Temp runs dir only: runs/ is read-only real nights and is never touched here.
let runsDir: string;
let app: ReturnType<typeof createApp>;

const line = (at: string, job: string, status: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ at, job, status, owner: 'lane', ...extra });

// Normal night: 3 jobs, one retried 3 times then ok, one that fails. CRLF line ends (Windows checkout).
const NORMAL_JOBS = ['digest/render', 'lane/sync', 'notes/backup', 'rig/rotate-logs'];
const NORMAL = [
  line('2026-10-27T02:00:01+01:00', 'rig/rotate-logs', 'ok'),
  line('2026-10-27T02:00:05+01:00', 'notes/backup', 'retry', { error: 'timeout' }),
  line('2026-10-27T02:00:20+01:00', 'notes/backup', 'retry', { error: 'timeout' }),
  line('2026-10-27T02:00:50+01:00', 'notes/backup', 'retry', { error: 'timeout' }),
  line('2026-10-27T02:01:30+01:00', 'notes/backup', 'ok'),
  line('2026-10-27T02:03:00+01:00', 'lane/sync', 'fail', { error: 'remote rejected' }),
  line('2026-10-27T02:04:00+01:00', 'digest/render', 'ok'),
].join('\r\n');

// Bad line: one good job plus one line that is not JSON.
const BAD = [
  line('2026-10-25T03:00:00+01:00', 'digest/render', 'ok'),
  '{not json',
  line('2026-10-25T03:01:00+01:00', 'lane/sync', 'ok'),
].join('\n');

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  writeFileSync(join(runsDir, '2026-10-27.jsonl'), NORMAL + '\r\n');
  writeFileSync(join(runsDir, '2026-10-26.jsonl'), '');
  writeFileSync(join(runsDir, '2026-10-25.jsonl'), BAD + '\n');
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('GET /digest/:night (page)', () => {
  it('200: renders the jobs in row order, retries and fail flagged', async () => {
    const res = await app.request('/digest/2026-10-27');
    const html = await res.text();
    expect(res.status).toBe(200);
    let from = 0;
    for (const job of NORMAL_JOBS) {
      const at = html.indexOf(job, from);
      expect(at, `${job} in page`).toBeGreaterThan(-1);
      from = at;
    }
    expect(html).toMatch(/<tr class="warn"><td>!<\/td><td>notes\/backup/);
    expect(html).toMatch(/<tr class="warn"><td>!<\/td><td>lane\/sync/);
  });

  it('404: a night with no file', async () => {
    const res = await app.request('/digest/2026-10-20');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for that night');
  });

  it('200: the empty night says nothing ran', async () => {
    const res = await app.request('/digest/2026-10-26');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('200: a bad line does not hide the good rows and is counted', async () => {
    const res = await app.request('/digest/2026-10-25');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest/render');
    expect(html).toContain('lane/sync');
    expect(html).toContain('1 line did not parse');
  });
});

describe('GET /api/digest/:night (JSON)', () => {
  it('200: rows in the same job order as the page, with run and retry counts', async () => {
    const res = await app.request('/api/digest/2026-10-27');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      night: string;
      rows: { job: string; runs: number; retries: number; lastStatus: string }[];
      badLines: number;
    };
    expect(body.night).toBe('2026-10-27');
    expect(body.rows.map((r) => r.job)).toEqual(NORMAL_JOBS);
    const backup = body.rows.find((r) => r.job === 'notes/backup');
    expect(backup).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok' });
    expect(body.rows.find((r) => r.job === 'lane/sync')?.lastStatus).toBe('fail');
    expect(body.badLines).toBe(0);
  });

  it('404: a night with no file', async () => {
    const res = await app.request('/api/digest/2026-10-20');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for 2026-10-20' });
  });

  it('200: the empty night has no rows and no bad lines', async () => {
    const res = await app.request('/api/digest/2026-10-26');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-10-26', rows: [], badLines: 0 });
  });

  it('200: a bad line is counted and the good rows are kept', async () => {
    const res = await app.request('/api/digest/2026-10-25');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: { job: string }[]; badLines: number };
    expect(body.rows.map((r) => r.job)).toEqual(['digest/render', 'lane/sync']);
    expect(body.badLines).toBe(1);
  });
});
