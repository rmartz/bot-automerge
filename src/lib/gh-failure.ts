/**
 * Turn a failed `gh` call into a cause a human can act on (#30).
 *
 * A bare "could not read PR" can't tell a rejected token from a rate limit from a
 * PR that doesn't exist, yet each needs a different fix: rotate a credential,
 * wait, widen a scope, or fix the caller. This classifies the failure from `gh`'s
 * stderr and always echoes the exit code and first stderr line as evidence, so an
 * unrecognized failure is still diagnosable from the log.
 *
 * Pure: the environment is injected so tests don't depend on the runner's.
 */
import type { GhFailure } from './github.js';

export type GhFailureKind =
  | 'rate-limited'
  | 'token-rejected'
  | 'permission-denied'
  | 'pr-not-found'
  | 'repo-not-found'
  | 'unknown';

/** Longest stderr excerpt echoed back, so a verbose error can't flood the log. */
const MAX_DETAIL_CHARS = 200;

/**
 * Classify a `gh` failure by its stderr. Order matters: a rate limit and a
 * SAML/SSO block both arrive as HTTP 403, so they are matched before the generic
 * 403 that means a missing permission.
 */
export function classifyGhFailure(stderr: string): GhFailureKind {
  if (/rate limit|HTTP 429|abuse detection/i.test(stderr)) return 'rate-limited';
  if (/HTTP 401|Bad credentials|SAML|\bSSO\b|gh auth login/i.test(stderr)) {
    return 'token-rejected';
  }
  if (/Resource not accessible|HTTP 403|scope/i.test(stderr)) return 'permission-denied';
  if (/Could not resolve to a PullRequest/i.test(stderr)) return 'pr-not-found';
  if (/Could not resolve to a Repository/i.test(stderr)) return 'repo-not-found';
  if (/HTTP 404|Not Found/i.test(stderr)) return 'pr-not-found';
  return 'unknown';
}

/**
 * Which credential `gh` authenticated with — the variable NAME, never its value.
 * Mirrors `gh`'s own precedence for github.com: `GH_TOKEN`, then `GITHUB_TOKEN`,
 * then its stored login.
 */
export function tokenSource(env: Record<string, string | undefined> = process.env): string {
  if (env.GH_TOKEN) return 'GH_TOKEN';
  if (env.GITHUB_TOKEN) return 'GITHUB_TOKEN';
  return "gh's stored login";
}

const SUMMARIES: Record<GhFailureKind, (source: string) => string> = {
  'rate-limited': () => 'rate limited by GitHub — wait for the limit to reset, then re-run',
  'token-rejected': (source) =>
    `token rejected (from ${source}) — it is expired, revoked, or SSO-deauthorized; rotate it, or unset it to fall back to the workflow token`,
  'permission-denied': (source) =>
    `token lacks permission (from ${source}) — it needs contents:write and pull-requests:write on this repo`,
  'pr-not-found': () => 'PR not found — check the PR number the caller passed',
  'repo-not-found': (source) =>
    `repository not found or not visible to the token (from ${source}) — check --repo and the token's repo access`,
  unknown: () => 'gh failed',
};

/** The first non-empty stderr line, trimmed and capped. */
function firstLine(stderr: string): string {
  const line = stderr
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l !== '');
  if (!line) return '(no stderr)';
  return line.length > MAX_DETAIL_CHARS ? `${line.slice(0, MAX_DETAIL_CHARS)}…` : line;
}

/**
 * One-line description of a `gh` failure: the classified cause, then the raw
 * evidence (`gh exited <code>: <first stderr line>`).
 */
export function describeGhFailure(
  failure: GhFailure,
  env: Record<string, string | undefined> = process.env,
): string {
  const summary = SUMMARIES[classifyGhFailure(failure.stderr)](tokenSource(env));
  const exit = failure.code === null ? 'gh did not exit cleanly' : `gh exited ${failure.code}`;
  return `${summary} (${exit}: ${firstLine(failure.stderr)})`;
}
