import type { NightCounts } from '../digest/counts.js';
import type { Status } from '../status.js';

function countsText(c: NightCounts): string {
  const base = `ok ${c.ok} · retry ${c.retry} · fail ${c.fail}`;
  return c.bad > 0 ? `${base} · ${c.bad} bad line${c.bad === 1 ? '' : 's'}` : base;
}

export function StatusBoard({ status }: { status: Status }) {
  return (
    <>
      <h1>status</h1>
      <table>
        <tbody>
          <tr><th>adapter</th><td>{status.adapter}</td></tr>
          <tr><th>installed</th><td>{status.installed}</td></tr>
          <tr>
            <th>last beat</th>
            <td>{status.lastBeat ? `${status.lastBeat.at} Â· pid ${status.lastBeat.pid}` : <span class="warn">none</span>}</td>
          </tr>
        </tbody>
      </table>
      <h2>nights on disk</h2>
      {status.nights.length === 0 ? (
        <p class="mute">nothing in runs/</p>
      ) : (
        <ul>
          {status.nights.map((n) => (
            <li>
              <a href={`/digest/${n.night}`}>{n.night}</a>{' '}
              {n.counts ? (
                <span class="mute">{countsText(n.counts)}</span>
              ) : (
                '—'
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
