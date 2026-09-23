---
type: Reference
title: Consuming bot-automerge
description: Consumers use rmartz/bot-automerge-action, not a workflow in this repo; how a CLI release reaches them through that action's Dependabot-bumped pin, how to migrate a caller off the retired in-repo reusable workflow, and the `auto-merge enabled` label to seed.
tags: [consumer, setup, auto-merge]
---

# Consuming bot-automerge

This repo publishes the `@rmartz/bot-automerge` package (the `ai-bot-automerge`
CLI). It does **not** ship the workflow consumers call. Consumers use
[`rmartz/bot-automerge-action`](https://github.com/rmartz/bot-automerge-action),
and its
[consumer guide](https://github.com/rmartz/bot-automerge-action/blob/main/docs/consuming.md)
is the setup reference: the caller workflow, why it uses `pull_request_target`
and grants write scopes, the `RELEASE_PLEASE_PAT` for release-please CD, and the
prerequisite below.

> **‼️ PREREQUISITE — require `merge-safety` + your CI checks on the default branch
> BEFORE adopting bot-automerge.** It only turns on GitHub-native auto-merge; it
> does **not** decide whether a PR is _safe_ to merge. `gh pr merge --auto` merges
> a PR **immediately** if the repo has no required status checks, so an eligible
> bot PR would merge the instant the caller runs. Require
> [`merge-safety`](https://github.com/rmartz/merge-safety) and your CI first —
> **merge-safety is the safety VERDICT, bot-automerge is the eligibility ENABLER.**

## How a CLI release reaches consumers

Every version pin in the chain is one Dependabot bumps:

1. A release here publishes `@rmartz/bot-automerge` to GitHub Packages.
2. `rmartz/bot-automerge-action` pins that version in its own `package.json`.
   Dependabot's `npm` ecosystem bumps it, and the merged bump cuts an action
   release.
3. Consumers pin the action by SHA with a `# vX.Y.Z` comment. Dependabot's
   `github-actions` ecosystem bumps that pin to the new action release.

So a given action pin always installs one exact CLI version, and nothing in a
consumer's repo names the CLI version directly. Each step waits for Dependabot's
schedule, so a new CLI release takes a few days to reach consumers. That delay is
expected.

## Migrating off the retired reusable workflow

Until #18 Phase 2, this repo shipped a reusable workflow that consumers called as
`rmartz/bot-automerge/.github/workflows/bot-automerge.yml@<sha>`. It is gone
from `main`, but **an existing SHA-pinned caller does not break**: GitHub loads a
reusable workflow from the pinned commit, and release tags keep those commits
reachable. That is the problem. Such a caller stays frozen on the CLI version its
pinned commit hardcoded (0.1.x), never receives a later fix, and gives no signal
that it is stale.

Migrate every such caller explicitly. The smallest change is the action's
reusable-workflow shape: point `uses:` at
`rmartz/bot-automerge-action/.github/workflows/bot-automerge-reusable.yml@<sha> # vX.Y.Z`,
keep `secrets: inherit`, and drop the `with: pr:` input and any `concurrency:`
group. See the action guide's
[migration section](https://github.com/rmartz/bot-automerge-action/blob/main/docs/consuming.md#migrating-from-rmartzbot-automerges-reusable-workflow).

## The `auto-merge enabled` label

When the CLI arms auto-merge on a PR, it also applies an **`auto-merge enabled`**
label, so your other automation (triage, dashboards, a PR coordinator) can tell
the PR is already owned by bot-automerge and skip it for manual merge handling.
It uses the `pull-requests: write` scope the caller already grants — no extra
permission and no check-run.

Labelling is **best-effort**: if the label does not exist in your repo, the `gh`
call soft-fails and bot-automerge logs it and moves on — the auto-merge is already
armed, so a missing label never fails the run. To make the signal reliable, **seed
the label in your repo** so it is present before the first eligible PR:

```bash
ai-ensure-labels   # seeds the standard roster, including `auto-merge enabled`
```

or create it directly:

```bash
gh label create "auto-merge enabled" --color 1F883D \
  --description "bot-automerge has enabled native auto-merge on this PR."
```
