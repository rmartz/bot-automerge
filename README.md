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
and `@rmartz/merge-safety` are — the package lives here, and consumers reach it
through a separate action repo:

1. **Updates propagate automatically.** Consuming repos pin
   [`rmartz/bot-automerge-action`](https://github.com/rmartz/bot-automerge-action)
   by SHA; Dependabot's `github-actions` ecosystem opens PRs to bump that pin. The
   action pins this package's version in its own `package.json`, bumped by
   Dependabot's `npm` ecosystem, so a new CLI release reaches consumers as an
   action release.
2. **No check-run contract.** bot-automerge is purely an eligibility enabler — it
   requires no fleet-wide status-check name. See
   [docs/bot-automerge-contract.md](docs/bot-automerge-contract.md).

> **Status: implemented.** The `enable` classification — Dependabot `patch`/`minor`
> bumps and release-please release PRs — shipped in `v0.1.0`, the first release to
> GitHub Packages. It was built per
> [ai-tools#264](https://github.com/rmartz/ai-tools/issues/264); see
> [docs/bot-automerge-contract.md](docs/bot-automerge-contract.md) for the
> eligibility contract.

## Using it in a consuming repo

Use [`rmartz/bot-automerge-action`](https://github.com/rmartz/bot-automerge-action)
— its [consumer guide](https://github.com/rmartz/bot-automerge-action/blob/main/docs/consuming.md)
has the caller workflow, its permissions, and the `merge-safety` prerequisite.
This repo no longer ships a reusable workflow; see
[docs/consuming.md](docs/consuming.md) for what that means for existing callers.

> **Require `merge-safety` + your CI checks on the default branch _before_ adopting
> it.** `gh pr merge --auto` merges a PR immediately if the repo has no required
> status checks — bot-automerge only makes a bot PR _eligible_ to auto-merge; the
> repo's required checks are what it waits on.

## Requirements

- Node.js >= 20.11
- pnpm 9 (pinned via `packageManager`)

Consuming repos need neither — `rmartz/bot-automerge-action` runs the published
CLI on a GitHub-hosted runner.

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

Versioned by [semantic-release](.releaserc.json). A push to `main` analyzes the
Conventional-Commit history since the last `bot-automerge-v*` tag and, when a
release is warranted, publishes the package to GitHub Packages (public) and
creates the git tag + GitHub Release — no release PR and no commit-back, so the
built-in `GITHUB_TOKEN` suffices. `tagFormat` stays `bot-automerge-v${version}`
for continuity with the prior release-please tags.

---

🤖 Created by Claude Opus 4.8
