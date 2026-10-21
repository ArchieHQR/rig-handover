import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 5 jobs, sorted by name, and 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.night).toBe('2026-10-28');
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  const row = (job: string) => night?.rows.find((r) => r.job === job);

  it('counts retries and keeps the last status and error', () => {
    expect(row('fixtures/refresh')).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
    });
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a null owner', () => {
    expect(row('digest/render')?.owner).toBeNull();
  });

  it('keeps the offset on first and last', () => {
    expect(row('fixtures/refresh')?.first).toBe('2026-10-29T01:30:00+01:00');
    expect(row('fixtures/refresh')?.last).toBe('2026-10-29T01:37:00+01:00');
    for (const r of night?.rows ?? []) {
      expect(r.first.endsWith('+01:00')).toBe(true);
      expect(r.last.endsWith('+01:00')).toBe(true);
    }
  });
});

describe('readNight on a temp runs dir', () => {
  let dir = '';
  const tmp = () => (dir = mkdtempSync(join(tmpdir(), 'rig-runs-')));
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  it('returns null when there is no file for the night', () => {
    expect(readNight(tmp(), '2026-01-01')).toBeNull();
  });

  it('returns null for a night that is not YYYY-MM-DD', () => {
    expect(readNight('runs', '../2026-10-28')).toBeNull();
    expect(readNight('runs', '2026-10-28.jsonl')).toBeNull();
  });

  it('reads an empty file as a night with no rows', () => {
    writeFileSync(join(tmp(), '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('counts bad lines (bad JSON and invalid fields), ignores blank lines', () => {
    const lines = [
      '{"at":"2026-01-01T23:00:00+01:00","job":"a","status":"ok","owner":"x"}',
      '',
      'not json',
      '{"at":"2026-01-01T23:01:00+01:00","job":"a","status":"maybe","owner":"x"}',
      '{"at":"2026-01-01T23:02:00+01:00","job":"b","status":"ok"}',
      '',
    ];
    writeFileSync(join(tmp(), '2026-01-01.jsonl'), lines.join('\r\n'));
    const night = readNight(dir, '2026-01-01');
    expect(night?.badLines).toBe(3);
    expect(night?.rows).toHaveLength(1);
    expect(night?.rows[0]).toMatchObject({ job: 'a', runs: 1, owner: 'x', lastError: null });
  });
});
