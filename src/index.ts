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

// TODO(teammate): the bot-eligibility classification contract (issue #264). The
// intended shape, to be filled in when the enablement logic lands — see
// docs/bot-automerge-contract.md:
//
//   - The trusted bot author set (e.g. `dependabot[bot]`, the release-please bot)
//     that a PR must originate from to be eligible at all.
//       export const TRUSTED_BOT_AUTHORS = [...] as const;
//       export type TrustedBotAuthor = (typeof TRUSTED_BOT_AUTHORS)[number];
//
//   - The Dependabot semver update-type, parsed from the PR (only `patch` / `minor`
//     bumps are auto-merge-eligible; `major` is held for human review).
//       export type DependabotUpdateType = 'patch' | 'minor' | 'major';
//
//   - Release-please detection — whether a PR is a release-please "release PR"
//     (also eligible), distinct from the Dependabot path.
//       export interface BotPrClassification { ... }
//
// These are placeholders only; do not treat them as a shipped contract yet.
