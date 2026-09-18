---
type: Reference
title: Setting up bot-automerge in a consuming repo
description: How to add the thin bot-automerge caller workflow to a repo, why it carries triggers and write scopes rather than being trigger-free, and how the SHA pin stays current via Dependabot.
tags: [consumer, setup, auto-merge]
---

# Setting up bot-automerge in a consuming repo

This is the consumer-facing guide: how a repository adopts `@rmartz/bot-automerge`.
Unlike a read-only hygiene check, bot-automerge's caller is **not** trigger-free —
it carries the event triggers, grants write scopes, and passes secrets through —
because a reusable workflow cannot declare its own `on:` triggers and runs with
the _intersection_ of the caller-granted and workflow-declared permissions.

> **Status: STUB.** The [reusable workflow](../.github/workflows/bot-automerge.yml)
> installs the published CLI and runs `ai-bot-automerge --help` as a placeholder;
> it does not yet classify PRs or enable auto-merge. The classification +
> enablement logic is tracked by
> [rmartz/ai-tools#264](https://github.com/rmartz/ai-tools/issues/264). The
> caller shape below is what a consumer will pin once that logic lands.

## 1. Add the caller workflow

A consuming repo pins one thin caller workflow. Trigger it on the bot PRs you
want auto-merge enabled for:

```yaml
# .github/workflows/bot-automerge.yml
name: bot-automerge
on:
  pull_request:
    types: [opened, synchronize, reopened]
  workflow_dispatch:
    inputs:
      pr:
        description: PR number to classify + enable auto-merge for
        required: true
permissions:
  contents: write # enable GitHub-native auto-merge on the PR
  pull-requests: write # read PR metadata + turn on auto-merge
jobs:
  bot-automerge:
    uses: rmartz/bot-automerge/.github/workflows/bot-automerge.yml@<sha> # vX.Y.Z
    with:
      pr: ${{ github.event.pull_request.number || inputs.pr }}
    secrets: inherit
```

Why each piece is there:

- **The caller carries the triggers.** A reusable workflow can't declare
  `on: pull_request`; the caller does and passes the event context in. The
  classification and enablement logic live inside the
  [reusable workflow](../.github/workflows/bot-automerge.yml), so the caller
  stays thin.
- **Write scopes, not read-only.** Effective permissions are the intersection of
  caller-granted and workflow-declared, so the caller must grant the
  `contents: write` / `pull-requests: write` set that enabling native auto-merge
  requires.
- **`secrets: inherit`** — a safe default; the built-in `GITHUB_TOKEN`
  (via `packages: read` in the reusable workflow) covers the public CLI install.

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
