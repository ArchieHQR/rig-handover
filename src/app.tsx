import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestView } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = readNight(config.runsDir, c.req.param('night'));
    if (night === null) {
      return c.html(
        <Layout title={`digest · ${c.req.param('night')}`} lane={lane()}>
          <h1>digest · {c.req.param('night')}</h1>
          <p class="mute">no run log for that night</p>
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest · ${night.night}`} lane={lane()}>
        <DigestView night={night} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const night = readNight(config.runsDir, c.req.param('night'));
    if (night === null) return c.json({ error: `no run log for ${c.req.param('night')}` }, 404);
    return c.json(night);
  });

  return app;
}
