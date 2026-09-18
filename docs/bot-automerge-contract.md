---
type: Reference
title: The bot-automerge eligibility contract
description: The bot-detection and eligibility classification rules — which bot authors and update types qualify a PR for GitHub-native auto-merge, and what the enable command does with that verdict.
tags: [bot-automerge, auto-merge, contract, classification]
---

# The bot-automerge eligibility contract

bot-automerge enables GitHub-native auto-merge only for **trustworthy bot PRs**.
Eligibility is a pure classification over a PR's author, head branch, labels, and
state, plus — for Dependabot — a caller-supplied semver update-type. The predicate
lives in [`src/bot-automerge.ts`](../src/bot-automerge.ts) (`classifyBotPr`); its
contract constants and the verdict shape live in [`src/index.ts`](../src/index.ts)
and are pinned by a package test the way `@rmartz/merge-safety` pins its check-run
name.

## The verdict

`classifyBotPr` returns a `BotAutomergeVerdict`, the same object the CLI prints in
`--json` / `--dry-run` mode:

```json
{
  "eligible": true,
  "reason": "Dependabot patch update — eligible",
  "prType": "dependabot",
  "updateType": "version-update:semver-patch"
}
```

- `eligible` — `true` iff bot-automerge should turn on native auto-merge.
- `reason` — a one-line human-readable justification (positive or negative).
- `prType` — the detected path (`dependabot` / `release-please`), or `null` when
  the PR is not a recognized bot PR.
- `updateType` — the recognized Dependabot update-type, or `null` (always `null`
  for release-please, non-bot PRs, and an unavailable/unrecognized update-type).

## Bot detection

The PR is classified into one path, or none:

1. **Dependabot** — author is exactly `dependabot[bot]`.
2. **release-please** — the head branch starts with `release-please--` **OR** the
   PR carries the `autorelease: pending` label. (Release-please's PR author varies
   by setup, so detection keys off the branch/label markers, not the author.)
3. **Neither** — any other PR (an unrecognized bot or a human author) is **not a
   bot PR** and is never eligible; bot-automerge leaves it untouched.

## Dependabot update-type gate

For a Dependabot PR, eligibility turns on the **semver update-type**. This value
is **strictly caller-supplied** via `--update-type` — sourced from
`dependabot/fetch-metadata` (`steps.metadata.outputs.update-type`), the canonical,
reliable signal. bot-automerge never re-derives it from the PR title, which would
be brittle and could disagree with fetch-metadata.

| `--update-type`               | Eligible? | Rationale                                              |
| ----------------------------- | --------- | ------------------------------------------------------ |
| `version-update:semver-patch` | yes       | Lowest-risk bump; safe to auto-merge once checks pass. |
| `version-update:semver-minor` | yes       | Backwards-compatible by semver; auto-merge-eligible.   |
| `version-update:semver-major` | **no**    | Potentially breaking; held for human review.           |
| missing / empty               | **no**    | Update-type unavailable — fail-safe, never enabled.    |
| any other string              | **no**    | Unrecognized — fail-safe, never enabled.               |

The last two rows are the **fail-safe** posture: bot-automerge never enables
auto-merge on a Dependabot PR whose update-type it cannot positively confirm. This
is a valid **negative verdict**, not an error — the CLI exits `0`.

## release-please detection

A release-please **release PR** is eligible as a whole — it has no semver
update-type of its own, so `updateType` is `null` and no `--update-type` is
required. The release merges itself once its required checks pass.

## Settled PRs

A closed or merged PR (`state` other than `OPEN`) is a deliberate **no-op skip**:
never eligible, regardless of author or update-type. `isEvaluablePrState` mirrors
merge-safety's guard so a post-merge event can't trigger a spurious action.

## What `enable` does — and does not do

When the verdict is `eligible`, the `ai-bot-automerge enable` command turns on
GitHub-native auto-merge (`gh pr merge --auto --squash <pr>`) and then applies the
**`auto-merge enabled`** label to the PR (the `AUTOMERGE_HANDLED_LABEL` constant,
pinned by a package test). The label is a signal for **external processes** —
triage bots, dashboards, PR coordinators — that the PR is already owned by
bot-automerge and need not be routed for manual merge handling.

Labelling is **best-effort and additive**: it uses the caller's existing
`pull-requests: write` scope, and a soft failure (e.g. the label is not yet in the
consumer's roster) is non-fatal — the auto-merge is already armed, so a missing
label is logged, not fatal. Consumers seed the label through their label roster
(`ai-ensure-labels` / `labels.yml`); see [consuming.md](consuming.md).

`enable` does **not**:

- **Post a check-run.** Unlike [`@rmartz/merge-safety`](overview.md), bot-automerge
  carries no fleet check-run contract. There is no name every consumer must
  require by string. The `auto-merge enabled` label is a plain, human-visible
  issue label — not a required status — so it never gates a merge.
- **Merge immediately.** Native auto-merge still waits on the repo's own required
  status checks (including merge-safety's, where adopted). bot-automerge only
  makes the PR _eligible_ to merge itself once those pass.

### Exit codes

- `0` — a verdict was reached (eligible → auto-merge enabled; not eligible → no
  action), a `--json`/`--dry-run` verdict was printed, or a settled PR was
  skipped. A negative verdict is a success.
- `2` — usage error (bad command, missing `--pr`, unresolvable repo).
- `1` — **only** an ungatherable/`gh` failure (the PR could not be read, or
  `gh pr merge` failed). On any failure, auto-merge is never enabled.
