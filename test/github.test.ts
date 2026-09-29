import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the subprocess boundary so the transport's retry/failure bookkeeping is
// asserted without spawning `gh`.
const { boundedRun } = vi.hoisted(() => ({ boundedRun: vi.fn() }));
vi.mock('../src/lib/bounded-subprocess.js', () => ({ boundedRun }));

import { ghCall, ghCallDetailed } from '../src/lib/github.js';

const noSleep = async (): Promise<void> => {};
const ok = (stdout: string) => ({ stdout, stderr: '', code: 0, timedOut: false });
const fail = (stderr: string, code = 1) => ({ stdout: '', stderr, code, timedOut: false });

describe('ghCallDetailed', () => {
  // Braces matter: a function returned from beforeEach runs as teardown, which
  // would call the (possibly throwing) mock once more after the test.
  beforeEach(() => {
    boundedRun.mockReset();
  });

  it('returns stdout and no failure on success', async () => {
    boundedRun.mockResolvedValue(ok('{"number":1}'));

    const result = await ghCallDetailed({ argv: ['gh', 'pr', 'view'] }, null, { sleep: noSleep });

    expect(result).toEqual({ stdout: '{"number":1}', failure: null });
  });

  it('returns the last attempt’s exit code and stderr after exhausting retries', async () => {
    boundedRun.mockResolvedValue(fail('HTTP 401: Bad credentials'));

    const result = await ghCallDetailed({ argv: ['gh', 'pr', 'view'] }, null, { sleep: noSleep });

    expect(result).toEqual({
      stdout: null,
      failure: { code: 1, stderr: 'HTTP 401: Bad credentials' },
    });
    expect(boundedRun).toHaveBeenCalledTimes(3); // 1 try + 2 retries
  });

  it('stops retrying a rate-limited transport and keeps its failure', async () => {
    boundedRun.mockResolvedValue(fail('GraphQL: API rate limit exceeded'));

    const result = await ghCallDetailed({ argv: ['gh', 'pr', 'view'] }, null, { sleep: noSleep });

    expect(boundedRun).toHaveBeenCalledTimes(1);
    expect(result.failure?.stderr).toBe('GraphQL: API rate limit exceeded');
  });

  it('reports a timeout as a null exit code', async () => {
    boundedRun.mockResolvedValue({ stdout: '', stderr: '', code: null, timedOut: true });

    const result = await ghCallDetailed({ argv: ['gh', 'pr', 'view'] }, null, { sleep: noSleep });

    expect(result.failure).toEqual({ code: null, stderr: 'timed out after 30000ms' });
  });

  it('reports a spawn error as a null exit code with its message', async () => {
    boundedRun.mockRejectedValue(new Error('spawn gh ENOENT'));

    const result = await ghCallDetailed({ argv: ['gh', 'pr', 'view'] }, null, { sleep: noSleep });

    expect(result.failure).toEqual({ code: null, stderr: 'spawn gh ENOENT' });
  });
});

describe('ghCall', () => {
  // Braces matter: a function returned from beforeEach runs as teardown, which
  // would call the (possibly throwing) mock once more after the test.
  beforeEach(() => {
    boundedRun.mockReset();
  });

  it('keeps its soft-fail contract: stdout on success, null on failure', async () => {
    boundedRun.mockResolvedValueOnce(ok('out'));
    expect(await ghCall({ argv: ['gh'] }, null, { sleep: noSleep })).toBe('out');

    boundedRun.mockResolvedValue(fail('boom'));
    expect(await ghCall({ argv: ['gh'] }, null, { sleep: noSleep })).toBeNull();
  });
});
