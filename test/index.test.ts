import { describe, it, expect } from 'vitest';
import {
  BOT_AUTOMERGE_COMMANDS,
  isBotAutomergeCommand,
  DEPENDABOT_AUTHOR,
  RELEASE_PLEASE_BRANCH_PREFIX,
  RELEASE_PLEASE_PENDING_LABEL,
  DEPENDABOT_UPDATE_TYPES,
  AUTO_MERGE_ELIGIBLE_UPDATE_TYPES,
  BOT_PR_TYPES,
  isDependabotUpdateType,
  isEligibleDependabotUpdateType,
} from '../src/index.js';

describe('bot-automerge package contract', () => {
  it('exposes the enable command', () => {
    expect(BOT_AUTOMERGE_COMMANDS).toEqual(['enable']);
  });

  it('recognizes the enable command and rejects everything else', () => {
    expect(isBotAutomergeCommand('enable')).toBe(true);
    expect(isBotAutomergeCommand('nope')).toBe(false);
    expect(isBotAutomergeCommand('')).toBe(false);
    expect(isBotAutomergeCommand(undefined)).toBe(false);
  });
});

// These constants are the fleet detection contract — a silent edit would change
// which PRs auto-merge across every consumer. Pin them exactly, the way
// merge-safety pins its check-run name.
describe('classification contract constants', () => {
  it('pins the Dependabot author login', () => {
    expect(DEPENDABOT_AUTHOR).toBe('dependabot[bot]');
  });

  it('pins the release-please branch prefix and pending label', () => {
    expect(RELEASE_PLEASE_BRANCH_PREFIX).toBe('release-please--');
    expect(RELEASE_PLEASE_PENDING_LABEL).toBe('autorelease: pending');
  });

  it('pins the three Dependabot update-types verbatim (fetch-metadata output)', () => {
    expect(DEPENDABOT_UPDATE_TYPES).toEqual([
      'version-update:semver-patch',
      'version-update:semver-minor',
      'version-update:semver-major',
    ]);
  });

  it('pins the auto-merge-eligible update-types to patch and minor only', () => {
    expect(AUTO_MERGE_ELIGIBLE_UPDATE_TYPES).toEqual([
      'version-update:semver-patch',
      'version-update:semver-minor',
    ]);
  });

  it('pins the recognized bot PR types', () => {
    expect(BOT_PR_TYPES).toEqual(['dependabot', 'release-please']);
  });
});

describe('isDependabotUpdateType', () => {
  it('accepts the three recognized update-types', () => {
    expect(isDependabotUpdateType('version-update:semver-patch')).toBe(true);
    expect(isDependabotUpdateType('version-update:semver-minor')).toBe(true);
    expect(isDependabotUpdateType('version-update:semver-major')).toBe(true);
  });

  it('rejects unrecognized, bare, and undefined values', () => {
    expect(isDependabotUpdateType('patch')).toBe(false);
    expect(isDependabotUpdateType('')).toBe(false);
    expect(isDependabotUpdateType(undefined)).toBe(false);
  });
});

describe('isEligibleDependabotUpdateType', () => {
  it('accepts patch and minor', () => {
    expect(isEligibleDependabotUpdateType('version-update:semver-patch')).toBe(true);
    expect(isEligibleDependabotUpdateType('version-update:semver-minor')).toBe(true);
  });

  it('rejects major and everything else', () => {
    expect(isEligibleDependabotUpdateType('version-update:semver-major')).toBe(false);
    expect(isEligibleDependabotUpdateType('patch')).toBe(false);
    expect(isEligibleDependabotUpdateType(undefined)).toBe(false);
  });
});
