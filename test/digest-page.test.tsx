import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest page', () => {
  it('renders the night', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of ['rig/rotate-logs', 'lane/sync', 'fixtures/refresh', 'notes/backup', 'digest/render']) {
      expect(html).toContain(job);
    }
    expect(html).toContain('<title>rig · digest · 2026-10-28</title>');
    expect(html).not.toContain('<td></td>');
    expect(html).toMatch(/<tr><td>—<\/td><td>digest\/render/);
    expect(html).toMatch(/digest\/render<\/td><td>—<\/td>/);
    expect(html).toMatch(/<tr class="warn"><td>!<\/td><td>fixtures\/refresh/);
    expect(html).toMatch(/<tr class="warn"><td>!<\/td><td>notes\/backup/);
  });

  it('404 without a file', async () => {
    const res = await createApp(config).request('/digest/2020-01-01');
    expect(res.status).toBe(404);
  });
});
