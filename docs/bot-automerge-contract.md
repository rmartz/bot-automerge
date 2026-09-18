---
type: Reference
title: The bot-automerge eligibility contract
description: The intended bot-detection and eligibility classification contract — which bot authors and update types qualify a PR for native auto-merge — as a STUB to be filled in when the enablement logic lands.
tags: [bot-automerge, auto-merge, contract, classification]
---

# The bot-automerge eligibility contract

> **STUB — TODO(teammate), tracked by
> [rmartz/ai-tools#264](https://github.com/rmartz/ai-tools/issues/264).** This
> page describes the _intended_ classification contract. The logic does not exist
> yet — `src/index.ts` carries the command surface (`enable`) and a commented
> placeholder for the classification types, and the `ai-bot-automerge` bin only
> logs a TODO. Fill this page in with the real, shipped rules when the enablement
> logic lands, and pin the eligible-author / update-type constants with a package
> test the way merge-safety pins its check-run name.

bot-automerge enables GitHub-native auto-merge only for **trustworthy bot PRs**.
Eligibility is a classification over the PR's author and, for Dependabot, its
semver update-type. The intended contract:

## Trusted bot authors

A PR is eligible **only** if it originates from a known bot author. The intended
trusted set:

- **Dependabot** (`dependabot[bot]`) — dependency-bump PRs.
- **release-please** (the release-please bot) — the automated "release" PR it
  maintains on the default branch.

Any human-authored PR, or a PR from an unrecognized bot, is **never** eligible —
bot-automerge leaves it untouched.

## Dependabot update-type gate

For a Dependabot PR, eligibility further depends on the **semver update-type**
parsed from the PR (title / metadata):

| Update type | Eligible? | Rationale                                              |
| ----------- | --------- | ------------------------------------------------------ |
| `patch`     | yes       | Lowest-risk bump; safe to auto-merge once checks pass. |
| `minor`     | yes       | Backwards-compatible by semver; auto-merge-eligible.   |
| `major`     | **no**    | Potentially breaking; held for human review.           |

## release-please detection

A release-please **release PR** is eligible as a whole (it has no semver
update-type of its own). Detection is by author plus the release-please PR
markers; the exact signal is TODO.

## What "enable" does — and does not do

When a PR is eligible, `enable` turns on GitHub-native auto-merge
(`gh pr merge --auto --squash`). It does **not**:

- **Post a check-run.** Unlike [`@rmartz/merge-safety`](overview.md), bot-automerge
  carries no fleet check-run contract. There is no name every consumer must
  require by string.
- **Merge immediately.** Native auto-merge still waits on the repo's own required
  status checks (including merge-safety's, where adopted). bot-automerge only
  makes the PR _eligible_ to merge itself once those pass.
