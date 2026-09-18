import { describe, it, expect } from 'vitest';
import {
  classifyBotPr,
  detectBotPrType,
  errorBotAutomergeVerdict,
  isEvaluablePrState,
  type BotPrView,
} from '../src/bot-automerge.js';

const PATCH = 'version-update:semver-patch';
const MINOR = 'version-update:semver-minor';
const MAJOR = 'version-update:semver-major';

/** An OPEN Dependabot PR baseline; override per test. */
function dependabotPr(overrides: Partial<BotPrView> = {}): BotPrView {
  return {
    author: 'dependabot[bot]',
    headRefName: 'dependabot/npm_and_yarn/lodash-4.17.21',
    labels: ['dependencies'],
    state: 'OPEN',
    ...overrides,
  };
}

/** An OPEN release-please PR baseline (branch-detected); override per test. */
function releasePleasePr(overrides: Partial<BotPrView> = {}): BotPrView {
  return {
    author: 'github-actions[bot]',
    headRefName: 'release-please--branches--main',
    labels: ['autorelease: pending'],
    state: 'OPEN',
    ...overrides,
  };
}

describe('isEvaluablePrState', () => {
  it('is true only for OPEN', () => {
    expect(isEvaluablePrState('OPEN')).toBe(true);
    expect(isEvaluablePrState('CLOSED')).toBe(false);
    expect(isEvaluablePrState('MERGED')).toBe(false);
  });
});

describe('detectBotPrType', () => {
  it('detects Dependabot by author', () => {
    expect(detectBotPrType(dependabotPr())).toBe('dependabot');
  });

  it('detects release-please by branch prefix', () => {
    expect(detectBotPrType(releasePleasePr({ labels: [] }))).toBe('release-please');
  });

  it('detects release-please by pending label (any branch name)', () => {
    expect(detectBotPrType(releasePleasePr({ headRefName: 'some-other-branch' }))).toBe(
      'release-please',
    );
  });

  it('is null for an unknown bot or a human author', () => {
    expect(
      detectBotPrType({
        author: 'renovate[bot]',
        headRefName: 'renovate/x',
        labels: [],
        state: 'OPEN',
      }),
    ).toBe(null);
    expect(
      detectBotPrType({ author: 'octocat', headRefName: 'feature/x', labels: [], state: 'OPEN' }),
    ).toBe(null);
  });
});

describe('classifyBotPr — Dependabot path', () => {
  it('is eligible for a patch bump', () => {
    const v = classifyBotPr(dependabotPr(), PATCH);
    expect(v).toEqual({
      eligible: true,
      reason: 'Dependabot patch update — eligible',
      prType: 'dependabot',
      updateType: PATCH,
    });
  });

  it('is eligible for a minor bump', () => {
    const v = classifyBotPr(dependabotPr(), MINOR);
    expect(v.eligible).toBe(true);
    expect(v.prType).toBe('dependabot');
    expect(v.updateType).toBe(MINOR);
  });

  it('is NOT eligible for a major bump (held for manual review)', () => {
    const v = classifyBotPr(dependabotPr(), MAJOR);
    expect(v.eligible).toBe(false);
    expect(v.prType).toBe('dependabot');
    expect(v.updateType).toBe(MAJOR);
    expect(v.reason).toMatch(/major/);
  });

  it('is NOT eligible when the update-type is missing (unavailable) — exit-0 negative', () => {
    const v = classifyBotPr(dependabotPr());
    expect(v).toEqual({
      eligible: false,
      reason: 'Dependabot PR but update-type unavailable — not enabling auto-merge',
      prType: 'dependabot',
      updateType: null,
    });
  });

  it('is NOT eligible when the update-type is empty', () => {
    const v = classifyBotPr(dependabotPr(), '');
    expect(v.eligible).toBe(false);
    expect(v.reason).toMatch(/unavailable/);
  });

  it('is NOT eligible (fail-safe) for an unrecognized update-type string', () => {
    const v = classifyBotPr(dependabotPr(), 'patch');
    expect(v.eligible).toBe(false);
    expect(v.updateType).toBe(null);
    expect(v.reason).toMatch(/unrecognized update-type/);
  });
});

describe('classifyBotPr — release-please path', () => {
  it('is eligible when detected by branch prefix (no update-type needed)', () => {
    const v = classifyBotPr(releasePleasePr({ labels: [] }));
    expect(v).toEqual({
      eligible: true,
      reason: 'release-please release PR — eligible once its required checks pass',
      prType: 'release-please',
      updateType: null,
    });
  });

  it('is eligible when detected by the pending label alone', () => {
    const v = classifyBotPr(releasePleasePr({ headRefName: 'chore/release' }));
    expect(v.eligible).toBe(true);
    expect(v.prType).toBe('release-please');
  });
});

describe('classifyBotPr — non-bot PRs', () => {
  it('is NOT eligible for an unknown bot', () => {
    const v = classifyBotPr({
      author: 'renovate[bot]',
      headRefName: 'renovate/lodash',
      labels: [],
      state: 'OPEN',
    });
    expect(v).toEqual({
      eligible: false,
      reason: 'not a recognized bot PR (unknown or human author)',
      prType: null,
      updateType: null,
    });
  });

  it('is NOT eligible for a human author', () => {
    const v = classifyBotPr({
      author: 'octocat',
      headRefName: 'feature/thing',
      labels: [],
      state: 'OPEN',
    });
    expect(v.eligible).toBe(false);
    expect(v.prType).toBe(null);
  });
});

describe('classifyBotPr — settled PRs are a no-op', () => {
  it('skips a closed Dependabot PR even with an eligible update-type', () => {
    const v = classifyBotPr(dependabotPr({ state: 'CLOSED' }), PATCH);
    expect(v.eligible).toBe(false);
    expect(v.reason).toMatch(/closed/);
  });

  it('skips a merged release-please PR', () => {
    const v = classifyBotPr(releasePleasePr({ state: 'MERGED' }));
    expect(v.eligible).toBe(false);
    expect(v.reason).toMatch(/merged/);
  });
});

describe('errorBotAutomergeVerdict', () => {
  it('is a fail-safe not-eligible verdict carrying the message', () => {
    const v = errorBotAutomergeVerdict('could not read PR #7');
    expect(v).toEqual({
      eligible: false,
      reason: 'could not evaluate: could not read PR #7',
      prType: null,
      updateType: null,
    });
  });
});
