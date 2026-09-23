#!/usr/bin/env node
// Thin CLI over the bot-automerge enabler. One mode today:
//   enable  — classify one bot PR and, when it is an eligible bot bump
//             (Dependabot patch/minor, or a release-please release PR), turn on
//             GitHub-native auto-merge via `gh pr merge --auto --squash`.
//
// All judgment lives in the library (`bot-automerge.ts`); this bin only parses
// args, reads the PR via `gh`, and — on an eligible verdict — enables auto-merge.
//
// FAIL-SAFE / exit codes:
//   0 — a verdict was reached (eligible → auto-merge enabled; not eligible → no
//       action) OR a `--json`/`--dry-run` verdict was printed OR a settled PR was
//       skipped. A valid negative verdict is a success.
//   2 — usage error (bad command, missing `--pr`, unresolvable repo).
//   1 — ONLY an ungatherable/`gh` failure (PR unreadable, `gh pr merge` failed).
//       On any failure we never enable auto-merge.
import { ghCall, resolveRepoTarget } from '../lib/github.js';
import { markPrHandled } from '../lib/automerge-label.js';
import {
  AUTOMERGE_HANDLED_LABEL,
  isBotAutomergeCommand,
  type BotAutomergeCommand,
  type BotAutomergeVerdict,
} from '../index.js';
import {
  classifyBotPr,
  errorBotAutomergeVerdict,
  isEvaluablePrState,
  type BotPrView,
} from '../bot-automerge.js';

interface Args {
  mode: BotAutomergeCommand;
  pr?: number;
  repo?: string;
  /** The caller-supplied Dependabot semver update-type (from fetch-metadata). */
  updateType?: string;
  cwd?: string;
  /** Decision-only: print the verdict as JSON and perform no side effects. */
  json: boolean;
}

function usage(): never {
  console.error(
    'usage: ai-bot-automerge enable --pr <n> [--repo <o/r>] [--update-type <t>] [--json] [--cwd <path>]',
  );
  process.exit(2);
}

function parse(argv: string[]): Args {
  const mode = argv[0];
  if (!isBotAutomergeCommand(mode)) usage();
  const args: Args = { mode, json: false };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pr') args.pr = Number(argv[++i]);
    else if (a === '--repo') args.repo = argv[++i];
    else if (a === '--update-type') args.updateType = argv[++i];
    else if (a === '--cwd') args.cwd = argv[++i];
    else if (a === '--json' || a === '--dry-run') args.json = true;
    else usage();
  }
  if (mode === 'enable' && !args.pr) usage();
  return args;
}

async function ghJson<T>(argv: string[], cwd?: string): Promise<T | null> {
  const out = await ghCall({ argv }, null, { cwd });
  if (out === null) return null;
  try {
    return JSON.parse(out) as T;
  } catch {
    return null;
  }
}

interface PrView {
  number: number;
  author: { login: string } | null;
  headRefName: string;
  isCrossRepository?: boolean;
  /** `null` when the head repository was deleted. */
  headRepository?: { id: string } | null;
  labels: { name: string }[];
  state: string;
}

/** Read the classification-relevant fields of one PR, or `null` on failure. */
async function fetchPrView(repo: string, pr: number, cwd?: string): Promise<PrView | null> {
  return ghJson<PrView>(
    [
      'gh',
      'pr',
      'view',
      String(pr),
      '--repo',
      repo,
      '--json',
      'number,author,headRefName,headRepository,isCrossRepository,labels,state',
    ],
    cwd,
  );
}

function emitVerdictJson(verdict: BotAutomergeVerdict, isError: boolean): void {
  console.log(JSON.stringify(verdict, null, 2));
  if (isError) process.exitCode = 1;
}

/** Turn on GitHub-native auto-merge (squash). Returns false on a `gh` failure. */
async function enableAutoMerge(repo: string, pr: number, cwd?: string): Promise<boolean> {
  const out = await ghCall(
    { argv: ['gh', 'pr', 'merge', '--auto', '--squash', String(pr), '--repo', repo] },
    null,
    { cwd },
  );
  return out !== null;
}

async function runEnable(repo: string, pr: number, args: Args): Promise<void> {
  const view = await fetchPrView(repo, pr, args.cwd);
  if (!view) {
    // A PR we can't even read is ungatherable — fail safe, never enable.
    const msg = `could not read PR #${pr}`;
    if (args.json) return emitVerdictJson(errorBotAutomergeVerdict(msg), true);
    console.error(`#${pr}: ${msg} — not enabling auto-merge`);
    process.exitCode = 1;
    return;
  }

  const prView: BotPrView = {
    author: view.author?.login ?? '',
    headRefName: view.headRefName,
    // Fail safe: a missing field or a deleted head repository counts as a fork.
    isCrossRepository: view.isCrossRepository !== false || !view.headRepository,
    labels: view.labels.map((l) => l.name),
    state: view.state,
  };
  const verdict = classifyBotPr(prView, args.updateType);

  // Decision-only mode: print the verdict, touch nothing. Exit 0 — a real verdict
  // (even a negative one) is a successful evaluation.
  if (args.json) return emitVerdictJson(verdict, false);

  // A settled PR is a clean no-op skip (distinct message from a live negative).
  if (!isEvaluablePrState(view.state)) {
    console.log(`#${pr}: ${view.state.toLowerCase()} — skipping (no auto-merge action)`);
    return;
  }

  if (!verdict.eligible) {
    console.log(`#${pr}: not eligible — ${verdict.reason}`);
    return;
  }

  const enabled = await enableAutoMerge(repo, pr, args.cwd);
  if (!enabled) {
    console.error(`#${pr}: eligible (${verdict.reason}) but failed to enable auto-merge`);
    process.exitCode = 1;
    return;
  }

  // Auto-merge is armed — mark the PR so external processes know bot-automerge
  // owns it. Best-effort: a missing label (not yet in the repo's roster) is a
  // non-fatal signal-not-set, never a reason to fail a run we already enabled.
  const labeled = await markPrHandled(repo, pr, { cwd: args.cwd });
  const labelNote = labeled
    ? `; labeled "${AUTOMERGE_HANDLED_LABEL}"`
    : `; could not apply "${AUTOMERGE_HANDLED_LABEL}" label (non-fatal)`;
  console.log(`#${pr}: eligible — auto-merge enabled (${verdict.reason})${labelNote}`);
}

async function main(): Promise<void> {
  const args = parse(process.argv.slice(2));
  const repo = await resolveRepoTarget({ repo: args.repo, cwd: args.cwd });
  if (!repo) {
    console.error('error: could not resolve target repo (pass --repo <owner/repo>)');
    process.exit(2);
  }
  await runEnable(repo, args.pr as number, args);
}

void main();
