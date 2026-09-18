---
type: Reference
title: What bot-automerge is
description: The eligibility enabler that turns on GitHub-native auto-merge for trustworthy bot pull requests (Dependabot patch/minor bumps and release-please release PRs), the counterpart to merge-safety's safety verdict.
tags: [bot-automerge, auto-merge, ci, overview]
---

# What bot-automerge is

`@rmartz/bot-automerge` is the **eligibility enabler** for trustworthy bot pull
requests: it classifies a bot PR and, when the PR is an eligible bot bump, turns
on GitHub's native auto-merge for it (`gh pr merge --auto --squash`). It is the
counterpart to [`@rmartz/merge-safety`](https://github.com/rmartz/merge-safety),
which computes the pre-auto-merge **safety verdict**. Where merge-safety answers
"is it safe to merge this PR?", bot-automerge answers "is this a bot PR we trust
enough to enable auto-merge on in the first place?".

> **Status: scaffold.** This package is a compiling skeleton — the `enable`
> command surface and the reusable-workflow shape are in place, but the
> classification + enablement logic is a STUB tracked by
> [rmartz/ai-tools#264](https://github.com/rmartz/ai-tools/issues/264). See the
> [eligibility contract](bot-automerge-contract.md) for the intended behavior.

It ships as one CLI, `ai-bot-automerge`, with a single operation that the
[reusable workflow](consuming.md) dispatches:

## `enable` — one bot PR

On a pull-request event for a bot PR (or a `workflow_dispatch` naming a PR),
`enable` classifies the PR and, when it is an eligible bot bump, turns on native
auto-merge. The intended eligible set:

- **Dependabot patch/minor bumps** — a Dependabot PR whose semver update-type is
  `patch` or `minor`. A `major` bump is held for human review.
- **release-please release PRs** — the automated "release" PR release-please
  maintains on the default branch.

## No check-run

Unlike merge-safety, bot-automerge posts **no check-run** and carries **no fleet
check-run contract**. It is purely an eligibility enabler: it reads a PR's
metadata and, when the PR qualifies, flips on native auto-merge. The actual
merge still waits on the repo's own required status checks (including
merge-safety's, where that is adopted).

## How the pieces fit

- **[The eligibility contract](bot-automerge-contract.md)** — the intended
  bot-detection + eligibility classification rules (STUB).
- **[Setting up bot-automerge in a consuming repo](consuming.md)** — the caller
  workflow and its permissions.
