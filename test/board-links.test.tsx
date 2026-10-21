import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { countNight } from '../src/digest/counts.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('board links', () => {
  it('links each night to its digest with counts', async () => {
    const html = await (await createApp(config).request('/')).text();
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toContain('ok 10 · retry 4 · fail 1 · 1 bad line');
    expect(html).toContain('ok 7 · retry 0 · fail 0');
  });
});

describe('countNight', () => {
  it('counts by status, skips blanks, counts bad lines', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-'));
    const l = (status: string) => JSON.stringify({ at: 'x', job: 'j', status, owner: null });
    writeFileSync(join(dir, '2026-01-01.jsonl'), [l('ok'), l('ok'), '', l('retry'), l('fail'), '{bad'].join('\r\n') + '\r\n');
    expect(countNight(dir, '2026-01-01')).toEqual({ ok: 2, retry: 1, fail: 1, bad: 1 });
    expect(countNight(dir, '2026-01-02')).toBeNull();
  });
});
