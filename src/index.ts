/**
 * @rmartz/bot-automerge — public entry point.
 *
 * Encodes the package's stable public contract: the CLI command surface that
 * enables GitHub-native auto-merge for trustworthy bot pull requests. This is the
 * "eligibility enabler" counterpart to `@rmartz/merge-safety`'s "safety verdict" —
 * it classifies a bot PR and, when eligible, turns on native auto-merge. Unlike
 * merge-safety it posts NO check-run and carries no fleet check-run contract.
 *
 * The classification + enablement implementation (and the `ai-bot-automerge` bin)
 * lives alongside it; this module is intentionally the narrow, frozen surface the
 * reusable workflow and consumers depend on. Extracted per rmartz/ai-tools#264.
 */

/**
 * The operations the `ai-bot-automerge` CLI dispatches:
 * - `enable` — classify one bot PR and, when it is an eligible bot bump, turn on
 *   GitHub-native auto-merge (`gh pr merge --auto --squash`).
 */
export const BOT_AUTOMERGE_COMMANDS = ['enable'] as const;

export type BotAutomergeCommand = (typeof BOT_AUTOMERGE_COMMANDS)[number];

/** Type guard for the CLI command surface. */
export function isBotAutomergeCommand(value: string | undefined): value is BotAutomergeCommand {
  return value !== undefined && (BOT_AUTOMERGE_COMMANDS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Bot-eligibility classification contract (issue #264)
//
// The stable, frozen surface the reusable workflow and consumers build against.
// These constants are the detection signals; a package test pins them the way
// merge-safety pins its check-run name, so a silent edit can't drift the fleet.
// The classification *logic* over them lives in `bot-automerge.ts`.
// ---------------------------------------------------------------------------

/**
 * The GitHub login of the Dependabot app account. A PR authored by this login
 * takes the Dependabot classification path (its eligibility then turns on the
 * caller-supplied semver update-type).
 */
export const DEPENDABOT_AUTHOR = 'dependabot[bot]';

/**
 * The head-branch prefix release-please gives its release PR (e.g.
 * `release-please--branches--main`). Either this prefix OR the pending label
 * below marks a PR as a release-please release PR.
 */
export const RELEASE_PLEASE_BRANCH_PREFIX = 'release-please--';

/** The label release-please applies to its open release PR. */
export const RELEASE_PLEASE_PENDING_LABEL = 'autorelease: pending';

/**
 * The Dependabot semver update-type, as emitted verbatim by
 * `dependabot/fetch-metadata` (`steps.metadata.outputs.update-type`). This is
 * the ONLY source of the update-type — the CLI takes it via `--update-type` and
 * never re-derives it from the PR title (which would be brittle and could
 * disagree with fetch-metadata).
 */
export const DEPENDABOT_UPDATE_TYPES = [
  'version-update:semver-patch',
  'version-update:semver-minor',
  'version-update:semver-major',
] as const;

export type DependabotUpdateType = (typeof DEPENDABOT_UPDATE_TYPES)[number];

/**
 * The Dependabot update-types eligible for auto-merge: patch and minor only.
 * Majors are potentially breaking and stay manual — a deliberate subset of
 * {@link DEPENDABOT_UPDATE_TYPES}.
 */
export const AUTO_MERGE_ELIGIBLE_UPDATE_TYPES = [
  'version-update:semver-patch',
  'version-update:semver-minor',
] as const;

export type EligibleDependabotUpdateType = (typeof AUTO_MERGE_ELIGIBLE_UPDATE_TYPES)[number];

/** Type guard: is `value` one of the three recognized Dependabot update-types? */
export function isDependabotUpdateType(value: string | undefined): value is DependabotUpdateType {
  return value !== undefined && (DEPENDABOT_UPDATE_TYPES as readonly string[]).includes(value);
}

/** Type guard: is `value` an auto-merge-eligible (patch/minor) update-type? */
export function isEligibleDependabotUpdateType(
  value: string | undefined,
): value is EligibleDependabotUpdateType {
  return (
    value !== undefined && (AUTO_MERGE_ELIGIBLE_UPDATE_TYPES as readonly string[]).includes(value)
  );
}

/**
 * The kind of trustworthy bot PR bot-automerge recognizes. `dependabot` PRs are
 * gated on their update-type; `release-please` release PRs are eligible as a
 * whole. A PR matching neither is not a bot PR and is never eligible.
 */
export const BOT_PR_TYPES = ['dependabot', 'release-please'] as const;

export type BotPrType = (typeof BOT_PR_TYPES)[number];

/**
 * The verdict `classifyBotPr` yields and the `--json` / `--dry-run` mode prints.
 * This shape is the frozen decision contract:
 * - `eligible` — true iff bot-automerge should enable native auto-merge.
 * - `reason` — a one-line human-readable justification (positive or negative).
 * - `prType` — the detected bot path, or `null` when the PR is not a bot PR.
 * - `updateType` — the recognized Dependabot update-type, or `null` (always
 *   `null` for release-please, unknown bots, or an unavailable/unrecognized
 *   update-type).
 */
export interface BotAutomergeVerdict {
  eligible: boolean;
  reason: string;
  prType: BotPrType | null;
  updateType: DependabotUpdateType | null;
}

/**
 * The label bot-automerge applies to a PR at the moment it turns on native
 * auto-merge, so external processes (triage bots, dashboards, PR coordinators)
 * can see the PR is already owned by bot-automerge and need not route it for
 * manual merge handling.
 *
 * This is additive and human-visible; unlike `@rmartz/merge-safety`'s check-run
 * it carries NO required-status contract — bot-automerge still posts no check-run.
 * The application is best-effort: it uses the caller's existing
 * `pull-requests: write` scope, and consuming repos seed the label through their
 * label roster (`ai-ensure-labels` / `labels.yml`).
 *
 * PUBLIC CONTRACT: external processes key on this string verbatim, so a package
 * test pins it the way merge-safety pins its check-run name — a silent edit here
 * would break every consumer keying off the label.
 */
export const AUTOMERGE_HANDLED_LABEL = 'auto-merge enabled';
