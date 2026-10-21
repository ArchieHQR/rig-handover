// Plan morning-digest § 1: read runs/<night>.jsonl into one DigestRow per job.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunLine, RunStatus } from './types.js';

// Only YYYY-MM-DD: a route can never make us read outside runsDir.
const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is RunStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

// Parse one line at the edge. null = bad line (bad JSON or a missing/invalid field).
export function parseLine(text: string): RunLine | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const { at, job, status, owner, error } = value;
  if (typeof at !== 'string' || at === '') return null;
  if (typeof job !== 'string' || job === '') return null;
  if (!isStatus(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;
  const line: RunLine = { at, job, status, owner };
  if (error !== undefined) line.error = error;
  return line;
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8');

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;

  // CRLF on Windows checkouts: split on \r?\n so a stray \r never breaks JSON.parse.
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue; // blank lines are not bad lines
    const line = parseLine(raw);
    if (line === null) {
      badLines++;
      continue;
    }
    const row = byJob.get(line.job);
    if (row === undefined) {
      byJob.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error ?? null,
        first: line.at,
        last: line.at,
      });
      continue;
    }
    row.runs++;
    if (line.status === 'retry') row.retries++;
    // "Latest" = later in the file; `at` strings are kept as logged (offset kept, never UTC).
    row.lastStatus = line.status;
    row.last = line.at;
    // Owner follows the latest line; a null owner never hides a known one.
    if (line.owner !== null) row.owner = line.owner;
    // lastError = the most recent error seen for the job, not just the last line's error:
    // a job that retried and then succeeded still shows why it retried.
    if (line.error !== undefined) row.lastError = line.error;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
};
