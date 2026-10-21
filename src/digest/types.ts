// Plan morning-digest § 1. Types only: the reader (src/digest/read.ts) and every part of § 2
// (page, JSON, board link, route tests) build against these.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One parsed line of runs/<night>.jsonl. `at` keeps the log's own offset, never UTC.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job. owner null is kept (views show —); first/last are `at` exactly as logged.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  first: string;
  last: string;
};

// A night read from disk. badLines = lines that did not parse (counted, never thrown).
// An empty file is a Night with no rows ("nothing ran").
export type Night = {
  night: string;
  rows: DigestRow[];
  badLines: number;
};

// null = no file for that night (route returns 404). Implemented in src/digest/read.ts.
export type ReadNight = (runsDir: string, night: string) => Night | null;
