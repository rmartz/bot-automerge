/**
 * Side-effecting helper that marks a PR as "handled by bot-automerge" — the
 * signal external processes read to know a PR is already owned by the enabler and
 * need not be routed for manual merge handling. Applied right after native
 * auto-merge is armed.
 *
 * It is kept OUT of the pure `bot-automerge.ts` classifier (which knows nothing of
 * `gh` or side effects) and OUT of the verbatim `@rmartz/github` port in
 * `lib/github.ts`; it simply composes that port's `addLabels` with the public
 * {@link AUTOMERGE_HANDLED_LABEL} constant.
 */
import { addLabels, type GhCallOptions } from './github.js';
import { AUTOMERGE_HANDLED_LABEL } from '../index.js';

/**
 * Apply {@link AUTOMERGE_HANDLED_LABEL} to a PR. Best-effort and additive: returns
 * `true` when the label was applied, `false` on a soft-failed `gh` call (e.g. the
 * label is not yet in the consumer's label roster). Callers treat a `false` as a
 * non-fatal "signal not set" — the auto-merge it accompanies is already armed, so
 * a missing label must never fail the run.
 */
export async function markPrHandled(
  repo: string,
  pr: string | number,
  opts: GhCallOptions = {},
): Promise<boolean> {
  const out = await addLabels(repo, pr, [AUTOMERGE_HANDLED_LABEL], opts);
  return out !== null;
}
