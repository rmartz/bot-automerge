---
type: Reference
title: Setting up bot-automerge in a consuming repo
description: How to add the thin bot-automerge caller workflow to a repo, why it uses pull_request_target and grants write scopes, the required-checks prerequisite that keeps auto-merge safe, the RELEASE_PLEASE_PAT a release-please consumer needs for continuous delivery, and how the SHA pin stays current via Dependabot.
tags: [consumer, setup, auto-merge]
---

# Setting up bot-automerge in a consuming repo

This is the consumer-facing guide: how a repository adopts `@rmartz/bot-automerge`.
Unlike a read-only hygiene check, bot-automerge's caller is **not** trigger-free —
it carries the event trigger, grants write scopes, and passes secrets through —
because a reusable workflow cannot declare its own `on:` triggers and runs with
the _intersection_ of the caller-granted and workflow-declared permissions.

> **‼️ PREREQUISITE — require `merge-safety` + your CI checks on the default branch
> BEFORE adopting this caller.** bot-automerge only turns on GitHub-native
> auto-merge; it does **not** decide whether a PR is _safe_ to merge. And
> `gh pr merge --auto` merges a PR **immediately** if the repo has **no required
> status checks** — auto-merge with nothing to wait for is just a merge. So a repo
> MUST have required status checks configured on its default branch before it
> enables bot-automerge, or an eligible bot PR will merge the instant the caller
> runs, unreviewed and unverified.
>
> The intended safety verdict is [`@rmartz/merge-safety`](https://github.com/rmartz/merge-safety):
> adopt it (its `merge-safety` check-run **plus** your normal CI checks — build,
> lint, test) as **required status checks** on the default branch first. The two
> are complementary: **merge-safety is the safety VERDICT, bot-automerge is the
> eligibility ENABLER.** Enable bot-automerge only once those required checks are
> in place.

## 1. Add the caller workflow

A consuming repo pins one thin caller workflow:

```yaml
# .github/workflows/bot-automerge.yml
name: bot-automerge
on:
  pull_request_target:
    types: [opened, reopened, synchronize, labeled]
permissions:
  contents: write # enable GitHub-native auto-merge on the PR
  pull-requests: write # read PR metadata + turn on auto-merge
jobs:
  bot-automerge:
    uses: rmartz/bot-automerge/.github/workflows/bot-automerge.yml@<sha> # vX.Y.Z
    with:
      pr: ${{ github.event.pull_request.number }}
    secrets: inherit
```

Why each piece is there:

- **`pull_request_target`, not `pull_request`.** Dependabot PRs (and other PRs
  from forks) run the `pull_request` event with a **read-only** `GITHUB_TOKEN`,
  which cannot enable auto-merge. `pull_request_target` runs in the **base
  repository's context** with the write token this needs. The caller carries the
  trigger because a reusable workflow can't declare `on:` itself; it passes the
  event context in, and the Dependabot-vs-other branch and the `fetch-metadata`
  step live inside the
  [reusable workflow](../.github/workflows/bot-automerge.yml), so the caller stays
  thin.
- **Write scopes, not read-only.** Effective permissions are the intersection of
  caller-granted and workflow-declared, so the caller must grant the
  `contents: write` / `pull-requests: write` set that enabling native auto-merge
  requires.
- **`labeled` is included** so that relabeling a held PR (for example, once a
  human clears it) re-triggers the eligibility check.
- **`secrets: inherit`** — the built-in `GITHUB_TOKEN` (via `packages: read` in the
  reusable workflow) covers the public CLI install, and it also passes through
  `RELEASE_PLEASE_PAT` for the release-please continuous-delivery path (see §3).

## 2. Keep the pin current

The `@<sha>` pin is bumped by Dependabot's `github-actions` ecosystem, the same
channel every reusable-workflow consumer uses:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

**Use a plain `# vX.Y.Z` version comment** on the pin — e.g.
`…/bot-automerge.yml@<sha> # v0.1.0` — **not** the component-scoped tag name. That
is the form Dependabot's `github-actions` ecosystem tracks to re-bump the SHA +
comment together, and the form that consumer pin-linters requiring a full
`vMAJOR.MINOR.PATCH` comment accept. This is exactly how this repo pins its own
`@rmartz/repo-hygiene` caller — `hygiene.yml@<sha> # v1.0.1` — a pin Dependabot
keeps current.

**Auth:** the published `@rmartz/bot-automerge` package is **public** on GitHub
Packages, readable with the built-in `GITHUB_TOKEN` — the `packages: read`
permission in the reusable workflow is all the install needs, no per-repo PAT.

## 3. Release-please PRs and continuous delivery (a PAT is required)

For **Dependabot** PRs the built-in `GITHUB_TOKEN` is enough. For **release-please
release PRs**, `GITHUB_TOKEN` is **not** enough if you want continuous delivery: a
release PR merged under `GITHUB_TOKEN` is attributed to `github-actions[bot]`, and
**`GITHUB_TOKEN`-attributed pushes do not trigger workflows**, so your
`release.yml` (`on: push`) never re-fires — the version bump lands but nothing is
tagged or published.

To fix this, provide a PAT as a repo secret named **`RELEASE_PLEASE_PAT`** (the
same PAT release-please itself needs — `repo` + `workflow` scope). On the
release-please path the reusable workflow uses `secrets.RELEASE_PLEASE_PAT` (via
`secrets: inherit`) as the merge actor, so the merge re-triggers `release.yml` and
CD completes. Without the secret it falls back to `GITHUB_TOKEN` — auto-merge still
works, but release-PR CD will not re-trigger. Repos that do not use release-please
(or do not auto-merge release PRs) need no PAT.
