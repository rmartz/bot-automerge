/**
 * Bot-automerge classification predicate — "should GitHub-native auto-merge be
 * turned on for this bot PR?"
 *
 * This is the eligibility enabler's decision, lifted into a pure, side-effect-free
 * function so it is trivially testable and the `ai-bot-automerge` bin stays a thin
 * arg-parse + `gh` shim. It knows nothing about `gh`, auto-merge enablement, or
 * exit codes — it maps a gathered PR view (author, head branch, labels, state) and
 * a caller-supplied Dependabot update-type to a {@link BotAutomergeVerdict}, and
 * the caller owns the action.
 *
 * The rules (see docs/bot-automerge-contract.md):
 *   1. A non-OPEN PR (closed/merged) is a no-op skip — never eligible.
 *   2. Author is Dependabot (`dependabot[bot]` via the API, or `app/dependabot`
 *      via the `gh` CLI) → the Dependabot path: eligible iff the
 *      caller-supplied update-type is patch or minor; major is held for manual
 *      review; a missing/unrecognized update-type is fail-safe not-eligible (we
 *      never enable on an unconfirmed update-type).
 *   3. Head branch `release-please--…` OR label `autorelease: pending` → the
 *      release-please path: always eligible (the release PR merges once its
 *      required checks pass; it has no update-type of its own).
 *   4. Anything else (an unknown bot or a human author) → not eligible.
 *
 * FAIL-SAFE: every uncertain or unrecognized case resolves to `eligible: false`,
 * so a caller that trusts the verdict never enables auto-merge on a PR it could
 * not positively classify.
 */
import {
  RELEASE_PLEASE_BRANCH_PREFIX,
  RELEASE_PLEASE_PENDING_LABEL,
  isDependabotAuthor,
  isDependabotUpdateType,
  isEligibleDependabotUpdateType,
  type BotAutomergeVerdict,
  type BotPrType,
  type DependabotUpdateType,
} from './index.js';

/**
 * The PR facts classification reads, as gathered from `gh pr view`. `author` is
 * the PR author's login as `gh` reports it — bot logins take `app/<slug>` form
 * (e.g. `app/dependabot`), not the API's `<slug>[bot]`; `state` is `OPEN` /
 * `CLOSED` / `MERGED`.
 */
export interface BotPrView {
  author: string;
  headRefName: string;
  labels: readonly string[];
  state: string;
}

/**
 * True when a PR's state warrants an auto-merge action. Only an OPEN PR can still
 * merge, so only an OPEN PR is evaluated; a closed or merged PR is a deliberate
 * no-op skip. Mirrors merge-safety's `isEvaluablePrState`.
 */
export function isEvaluablePrState(state: string): boolean {
  return state === 'OPEN';
}

/**
 * Detect which trusted-bot path a PR takes, or `null` when it is neither. The
 * Dependabot check (by author) is tried first; release-please is detected by its
 * head-branch prefix or its pending label.
 */
export function detectBotPrType(view: BotPrView): BotPrType | null {
  if (isDependabotAuthor(view.author)) return 'dependabot';
  if (
    view.headRefName.startsWith(RELEASE_PLEASE_BRANCH_PREFIX) ||
    view.labels.includes(RELEASE_PLEASE_PENDING_LABEL)
  ) {
    return 'release-please';
  }
  return null;
}

/** The short semver word (`patch`/`minor`/`major`) behind a full update-type, for reasons. */
function semverWord(updateType: DependabotUpdateType): string {
  return updateType.slice('version-update:semver-'.length);
}

function verdict(
  eligible: boolean,
  reason: string,
  prType: BotPrType | null,
  updateType: DependabotUpdateType | null,
): BotAutomergeVerdict {
  return { eligible, reason, prType, updateType };
}

/**
 * Classify a bot PR into an auto-merge {@link BotAutomergeVerdict}. Pure: the same
 * inputs always yield the same verdict. `updateType` is the caller-supplied
 * Dependabot semver update-type (from `dependabot/fetch-metadata`); it is only
 * consulted on the Dependabot path and is ignored elsewhere.
 */
export function classifyBotPr(view: BotPrView, updateType?: string): BotAutomergeVerdict {
  const prType = detectBotPrType(view);

  // A settled PR earns no action regardless of who authored it.
  if (!isEvaluablePrState(view.state)) {
    return verdict(false, `PR is ${view.state.toLowerCase()} — no auto-merge action`, prType, null);
  }

  if (prType === null) {
    return verdict(false, 'not a recognized bot PR (unknown or human author)', null, null);
  }

  if (prType === 'release-please') {
    return verdict(
      true,
      'release-please release PR — eligible once its required checks pass',
      'release-please',
      null,
    );
  }

  // Dependabot path — eligibility turns on the caller-supplied update-type.
  if (!isDependabotUpdateType(updateType)) {
    const reason =
      updateType === undefined || updateType === ''
        ? 'Dependabot PR but update-type unavailable — not enabling auto-merge'
        : `Dependabot PR with unrecognized update-type "${updateType}" — not enabling auto-merge`;
    return verdict(false, reason, 'dependabot', null);
  }

  if (isEligibleDependabotUpdateType(updateType)) {
    return verdict(
      true,
      `Dependabot ${semverWord(updateType)} update — eligible`,
      'dependabot',
      updateType,
    );
  }

  return verdict(
    false,
    `Dependabot ${semverWord(updateType)} update — held for manual review`,
    'dependabot',
    updateType,
  );
}

/**
 * The verdict for a PR whose facts could not be gathered (an unreadable PR, a
 * `gh` failure). Fail-safe: `eligible: false`, so a caller never enables
 * auto-merge on a PR it could not classify. The caller pairs this with exit 1 to
 * distinguish "could not evaluate" from an ordinary negative verdict.
 */
export function errorBotAutomergeVerdict(message: string): BotAutomergeVerdict {
  return verdict(false, `could not evaluate: ${message}`, null, null);
}
