import { describe, it, expect } from 'vitest';
import { classifyGhFailure, describeGhFailure, tokenSource } from '../src/lib/gh-failure.js';

// Stderr shapes as `gh` actually prints them (GraphQL for `gh pr view`).
const BAD_CREDENTIALS =
  'HTTP 401: Bad credentials (https://api.github.com/graphql)\nTry authenticating with:  gh auth login';
const SAML =
  'GraphQL: Resource protected by organization SAML enforcement. You must grant your Personal Access token access to this organization.';
const RATE_LIMITED = 'GraphQL: API rate limit exceeded for user ID 1032849.';
const SECONDARY_RATE_LIMITED =
  'HTTP 403: You have exceeded a secondary rate limit. Please wait a few minutes before you try again.';
const NOT_ACCESSIBLE =
  'GraphQL: Resource not accessible by personal access token (enablePullRequestAutoMerge)';
const PR_MISSING =
  'GraphQL: Could not resolve to a PullRequest with the number of 999. (repository.pullRequest)';
const REPO_MISSING =
  "GraphQL: Could not resolve to a Repository with the name 'rmartz/nope'. (repository)";

describe('classifyGhFailure', () => {
  it.each([
    [BAD_CREDENTIALS, 'token-rejected'],
    [SAML, 'token-rejected'],
    [RATE_LIMITED, 'rate-limited'],
    [SECONDARY_RATE_LIMITED, 'rate-limited'],
    ['HTTP 429: Too Many Requests', 'rate-limited'],
    [NOT_ACCESSIBLE, 'permission-denied'],
    ['HTTP 403: Forbidden', 'permission-denied'],
    [PR_MISSING, 'pr-not-found'],
    [REPO_MISSING, 'repo-not-found'],
    ['HTTP 502: Bad Gateway', 'unknown'],
    ['', 'unknown'],
  ])('classifies %j as %s', (stderr, kind) => {
    expect(classifyGhFailure(stderr)).toBe(kind);
  });

  it('treats a 403 rate limit as a rate limit, not a permission problem', () => {
    expect(classifyGhFailure('HTTP 403: API rate limit exceeded for installation')).toBe(
      'rate-limited',
    );
  });
});

describe('tokenSource', () => {
  it('follows gh precedence: GH_TOKEN, then GITHUB_TOKEN, then the stored login', () => {
    expect(tokenSource({ GH_TOKEN: 'a', GITHUB_TOKEN: 'b' })).toBe('GH_TOKEN');
    expect(tokenSource({ GITHUB_TOKEN: 'b' })).toBe('GITHUB_TOKEN');
    expect(tokenSource({ GH_TOKEN: '' })).toBe("gh's stored login");
  });
});

describe('describeGhFailure', () => {
  const env = { GH_TOKEN: 'ghp_secretvalue' };

  it('names a rejected token and its source, with the evidence', () => {
    const msg = describeGhFailure({ code: 1, stderr: BAD_CREDENTIALS }, env);
    expect(msg).toContain('token rejected (from GH_TOKEN)');
    expect(msg).toContain(
      'gh exited 1: HTTP 401: Bad credentials (https://api.github.com/graphql)',
    );
    // Only the first stderr line is echoed.
    expect(msg).not.toContain('Try authenticating');
  });

  it('never leaks the token value', () => {
    expect(describeGhFailure({ code: 1, stderr: BAD_CREDENTIALS }, env)).not.toContain(
      'ghp_secretvalue',
    );
  });

  it('describes a missing PR as not found', () => {
    expect(describeGhFailure({ code: 1, stderr: PR_MISSING }, env)).toMatch(/^PR not found/);
  });

  it('describes a rate limit', () => {
    expect(describeGhFailure({ code: 1, stderr: RATE_LIMITED }, env)).toMatch(/^rate limited/);
  });

  it('still shows the raw evidence for an unrecognized failure', () => {
    expect(describeGhFailure({ code: 1, stderr: 'HTTP 502: Bad Gateway\n' }, env)).toBe(
      'gh failed (gh exited 1: HTTP 502: Bad Gateway)',
    );
  });

  it('reports a process that never exited cleanly', () => {
    expect(describeGhFailure({ code: null, stderr: 'timed out after 30000ms' }, env)).toBe(
      'gh failed (gh did not exit cleanly: timed out after 30000ms)',
    );
  });

  it('caps a very long stderr line', () => {
    const msg = describeGhFailure({ code: 1, stderr: 'x'.repeat(500) }, env);
    expect(msg).toContain(`${'x'.repeat(200)}…`);
    expect(msg).not.toContain('x'.repeat(201));
  });

  it('handles empty stderr', () => {
    expect(describeGhFailure({ code: 4, stderr: '' }, env)).toBe(
      'gh failed (gh exited 4: (no stderr))',
    );
  });
});
