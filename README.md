# @rmartz/bot-automerge

The **eligibility enabler** for trustworthy bot pull requests, packaged so a repo
can turn on GitHub's native auto-merge for the bot PRs it trusts. bot-automerge
classifies a bot PR — Dependabot `patch`/`minor` bumps and release-please release
PRs — and, when the PR is eligible, runs `gh pr merge --auto --squash` to enable
native auto-merge. It is the counterpart to
[`@rmartz/merge-safety`](https://github.com/rmartz/merge-safety), which computes
the pre-auto-merge safety verdict: where merge-safety answers "is it safe to
merge?", bot-automerge answers "is this a bot PR we trust enough to enable
auto-merge on?". Unlike merge-safety, it posts **no check-run**.

It is distributed the same way [`@rmartz/repo-hygiene`](https://github.com/rmartz/repo-hygiene)
and `@rmartz/merge-safety` are:

1. **Updates propagate automatically.** Consuming repos pin one reusable workflow
   by SHA; Dependabot's `github-actions` ecosystem opens PRs to bump that pin.
2. **No check-run contract.** bot-automerge is purely an eligibility enabler — it
   requires no fleet-wide status-check name. See
   [docs/bot-automerge-contract.md](docs/bot-automerge-contract.md).

> **Status: implemented.** The `enable` classification — Dependabot `patch`/`minor`
> bumps and release-please release PRs — and the reusable workflow are complete and
> ship in `v0.1.0`, the first release to GitHub Packages. It was built per
> [ai-tools#264](https://github.com/rmartz/ai-tools/issues/264); see
> [docs/bot-automerge-contract.md](docs/bot-automerge-contract.md) for the
> eligibility contract.

## Using it in a consuming repo

Add one caller workflow (this is what Dependabot keeps current). Unlike a
read-only hygiene check, this caller carries the triggers, grants write scopes,
and passes secrets through — because a reusable workflow can't declare its own
triggers and runs with the intersection of granted and declared permissions:

```yaml
# .github/workflows/bot-automerge.yml
name: bot-automerge
on:
  pull_request_target:
    types: [opened, reopened, synchronize, labeled]
permissions:
  contents: write
  pull-requests: write
  packages: read # install the CLI from GitHub Packages
jobs:
  bot-automerge:
    uses: rmartz/bot-automerge/.github/workflows/bot-automerge.yml@<sha> # vX.Y.Z
    with:
      pr: ${{ github.event.pull_request.number }}
    secrets: inherit
```

It uses `pull_request_target` (not `pull_request`) because Dependabot PRs run with
a read-only token, and enabling auto-merge needs base-context write.

> **Require `merge-safety` + your CI checks on the default branch _before_ adopting
> this.** `gh pr merge --auto` merges a PR immediately if the repo has no required
> status checks — bot-automerge only makes a bot PR _eligible_ to auto-merge; the
> repo's required checks are what it waits on. See the
> [consumer setup guide](docs/consuming.md) for the full prerequisite.

The public `@rmartz/bot-automerge` package on GitHub Packages is readable with the
built-in `GITHUB_TOKEN`, so no consumer PAT is required.

> For the full walkthrough — the caller's permissions, why it isn't trigger-free,
> and how the pin stays current — see the
> [consumer setup guide](docs/consuming.md).

## Requirements

- Node.js >= 20.11
- pnpm 9 (pinned via `packageManager`)

Consuming repos need neither — the reusable workflow runs the published CLI on a
GitHub-hosted runner.

## Local development

```bash
pnpm install
pnpm run build        # tsup → dist (ESM + d.ts)
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm run test         # vitest
```

## Releases

Versioned by release-please. Merging its release PR tags the release and
publishes the package to GitHub Packages (public); the version installed by the
reusable workflow is bumped in lockstep via release-please `extra-files`.

---

🤖 Created by Claude Opus 4.8
