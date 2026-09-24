# Agent guide — @rmartz/bot-automerge

This repo is the standalone home of `@rmartz/bot-automerge`: the **eligibility
enabler** that turns on GitHub-native auto-merge for trustworthy bot pull
requests (Dependabot patch/minor bumps and release-please release PRs). Consuming
repos reach it through the separate
[`rmartz/bot-automerge-action`](https://github.com/rmartz/bot-automerge-action)
repo, which pins this package's version and is itself pinned by consumers and
kept current by Dependabot. It is the
counterpart to `@rmartz/merge-safety`'s safety verdict: bot-automerge classifies a
bot PR and, when eligible, runs `gh pr merge --auto --squash`. See
[README.md](README.md) and the [documentation](docs/index.md).

It was built per **rmartz/ai-tools#264**, mirroring the `rmartz/merge-safety`
and `rmartz/repo-hygiene` splits. The `enable` classification (Dependabot
`patch`/`minor` bumps and release-please release PRs) lives in `src/` and first
shipped in `v0.1.0`.
The eligibility contract is in
[docs/bot-automerge-contract.md](docs/bot-automerge-contract.md).

## No check-run contract

Unlike `@rmartz/merge-safety`, bot-automerge posts **no check-run** and carries
**no fleet check-run contract** — there is no name every consumer must require by
string. It is purely an eligibility enabler: it reads a bot PR's metadata and,
when the PR qualifies (a Dependabot patch/minor bump or a release-please release
PR), flips on GitHub-native auto-merge. The classification rules live in
[docs/bot-automerge-contract.md](docs/bot-automerge-contract.md).

When it arms auto-merge it also applies the **`auto-merge enabled`** label
(`AUTOMERGE_HANDLED_LABEL`, pinned by a package test) so external processes know
the PR is already handled. This is a plain, best-effort issue label — **not** the
check-run bot-automerge omits, and it never gates a merge; consumers seed it via
their label roster (`ai-ensure-labels` / `labels.yml`).

## Documentation — update it as part of every task

Treat documentation as part of the change, not an afterthought. On **every**
task:

- **Read first.** Before editing code, read the relevant `docs/` page(s) and this
  file, so your change is consistent with what is already documented.
- **Update and correct in the same PR.** If your change adds, alters, or
  contradicts anything a doc says — a fact bot-automerge classifies, a CLI flag, a
  workflow input, an interface — fix that doc in the same PR. An outdated doc is
  worse than no doc.
- **Correct drift you notice.** If you pass a doc that is stale or wrong while
  doing something else, fix it (or, if out of scope, note it) — do not leave
  known-wrong documentation in place.
- **Docs follow OKF.** Pages under `docs/` use Open Knowledge Format frontmatter
  (`type` required; `title`/`description`/`resource`/`tags` as applicable) and
  stay reachable from [docs/index.md](docs/index.md). The `okf` and `okf-index`
  checks enforce this in CI — see [docs/okf-format.md](docs/okf-format.md).

## Repository conformance

This repo is held to the shared
[repository checklist](https://github.com/rmartz/ai/blob/main/docs/guidance/repository-checklist.md),
and it **self-manages** its own config: fix conformance gaps directly here, in a
PR. Bootstrap (`ai-ensure-*`) is a one-time new-repo **starter**, not an ongoing
manager — do not defer a fix to a bootstrap re-run, and do not treat a `.github/`
file as off-limits just because bootstrap once seeded it.

- **Hygiene arrives the self-updating way:** this repo consumes
  `@rmartz/repo-hygiene` through the [`repo-hygiene.yml`](.github/workflows/repo-hygiene.yml)
  caller, pinned and bumped by Dependabot; it runs conflict-markers, action-pins,
  package-pins, docs-links, md-pairing, okf, okf-index, and file-caps against our
  own tree.
- **Safety verdict via merge-safety:** this repo dogfoods `@rmartz/merge-safety`
  through the [`merge-safety.yml`](.github/workflows/merge-safety.yml) caller,
  pinned and bumped by Dependabot — the `merge-safety` check-run is the gate our
  own GitHub-native auto-merge waits on (enabler vs. verdict).
- **Auto-merge dogfoods bot-automerge itself:** the
  [`automerge.yml`](.github/workflows/automerge.yml) caller pins
  `rmartz/bot-automerge-action`'s reusable workflow (Dependabot-bumped) — exactly
  as any consumer does — and turns on native auto-merge for our own eligible bot
  PRs, which merge once the ruleset's required checks (`merge-safety` + CI) pass.
- **No reusable workflow or version pin lives here.** The in-repo reusable
  workflow was retired in #18 Phase 2; distribution is
  `rmartz/bot-automerge-action`'s job, and the CLI version consumers run is the
  one that repo's `package.json` pins (Dependabot `npm`-bumped). Do not
  reintroduce a workflow here that hardcodes this package's version — nothing
  would update it. A delay between a CLI release here and the action's bump is
  ordinary weekly Dependabot lag, not a bug.
- **CI, releases, and labels are owned here:** typecheck / lint / format / test /
  build + a `Release dry-run` that validates the semantic-release config on PRs
  ([ci.yml](.github/workflows/ci.yml)), the PR-title lint + the
  `commit-convention` tripwire, semantic-release, and the hardened `dependabot.yml`
  are all in place. `ai-ensure-labels` / `ai-verify-squash-setting` remain useful
  one-shot helpers, but this repo owns its `.github/` config going forward.

## Common commands

```bash
pnpm install                 # deps (run in each worktree first)
pnpm run build               # tsup → dist (ESM + d.ts)
pnpm run typecheck           # tsc --noEmit
pnpm run lint                # eslint (incl. max-lines caps)
pnpm run format:check        # prettier --check
pnpm run test                # vitest
```

Before pushing, run `ai-pre-push-verify -C <worktree>` and fix every failure — it
re-runs the actual CI checks locally so a green result predicts CI.

## Code standards

Most are enforced by eslint; the intent:

- **Strict TypeScript.** No `any`, no `@ts-ignore` (use `@ts-expect-error` with a
  reason). Favor type inference; explicit generic args are a smell.
- **Named exports only**; no default exports. No IIFEs. Prefer `async/await` over
  `.then()`.
- **Value sets:** default to a structural string union or `as const` array over an
  `enum` (reserve `enum` for internal-only sets never serialized raw).
- **File caps:** `max-lines` 480 (src) / 720 (tests) via eslint; non-TS files are
  capped by the `file-caps` check per [`.repo-hygiene.yml`](.repo-hygiene.yml).
  The response to a cap is extraction, never terser code.
- **Pin dependencies** to full `major.minor.patch` (keep the `^`), and **SHA-pin**
  every third-party GitHub Action with a `# vX.Y.Z` comment — both dogfooded by
  the `package-pins` / `action-pins` checks the hygiene caller runs.
- **When you shell out**, wrap the subprocess (through the inlined `boundedRun`
  helper in `src/lib/`, mirroring merge-safety) — never call `git` / `gh` ad hoc.

## Worktrees, PRs, and releases

- **Work in a dedicated worktree** under `.git-worktrees/` (`ai-new-worktree`),
  never on `main` in the root checkout. Run `pnpm install` in a fresh worktree
  before building. (The one exception was the genesis scaffold commit, which had
  no prior branch to base a worktree on.)
- **PR titles must be Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`,
  …). The repo squash-merges using the **PR title**, so it is the only
  conventional subject that reaches `main` — a non-conventional title makes
  semantic-release skip the release.
- **Releases are automated** via semantic-release: a push to `main` analyzes the
  Conventional-Commit history since the last `bot-automerge-v*` tag and, when a
  release is warranted, publishes `@rmartz/bot-automerge` to npmjs (public) and
  creates the git tag + GitHub Release — no release PR, no commit-back. npm auth
  is OIDC trusted publishing tied to the `release.yml` filename (no `NPM_TOKEN`;
  renaming that workflow breaks publishing until the trusted publisher on npmjs is
  updated), the built-in `GITHUB_TOKEN` covers tags and releases, and
  `tagFormat` is pinned to `bot-automerge-v${version}` in `.releaserc.json` for
  continuity with the prior release-please tags.

## Agent directive files

- **`AGENTS.md` is the single source of truth** for a directory's agent
  instructions — author directives here, never in `CLAUDE.md`.
- **Every `AGENTS.md` has a companion `CLAUDE.md`** in the same directory (and
  vice versa); the `CLAUDE.md` is a bare wrapper whose only content is
  `@AGENTS.md`. The pairing is enforced by the `md-pairing` check.
