// Plan morning-digest § 2c: ok / retry / fail line counts for one night.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './read.js';

export type NightCounts = { ok: number; retry: number; fail: number; bad: number };

// null = no readable file for that night.
export function countNight(runsDir: string, night: string): NightCounts | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0, bad: 0 };
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line === null) counts.bad++;
    else counts[line.status]++;
  }
  return counts;
}
