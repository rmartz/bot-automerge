#!/usr/bin/env node
// Thin CLI over the bot-automerge enabler. One mode today:
//   enable  — classify one bot PR and, when it is an eligible bot bump
//             (Dependabot patch/minor, or a release-please release PR), turn on
//             GitHub-native auto-merge via `gh pr merge --auto --squash`.
//
// STUB: this currently only parses args and logs. The classification + enablement
// logic (and the `gh` calls behind it) land per rmartz/ai-tools#264. All judgment
// will live in the library; this bin stays a thin arg-parse + `gh` shim.
import { isBotAutomergeCommand, type BotAutomergeCommand } from '../index.js';

interface Args {
  mode: BotAutomergeCommand;
  pr?: number;
  repo?: string;
  cwd?: string;
}

function usage(): never {
  console.error('usage: ai-bot-automerge enable --pr <n> [--repo <o/r>] [--cwd <path>]');
  process.exit(2);
}

function parse(argv: string[]): Args {
  const mode = argv[0];
  if (!isBotAutomergeCommand(mode)) usage();
  const args: Args = { mode };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pr') args.pr = Number(argv[++i]);
    else if (a === '--repo') args.repo = argv[++i];
    else if (a === '--cwd') args.cwd = argv[++i];
    else usage();
  }
  if (mode === 'enable' && !args.pr) usage();
  return args;
}

async function runEnable(args: Args): Promise<void> {
  // TODO(teammate) #264: resolve the repo target, read the PR, classify the bot
  // author + update-type (Dependabot patch/minor) or detect a release-please
  // release PR, and — when eligible — run `gh pr merge --auto --squash`.
  console.log(
    `TODO: classification + gh pr merge --auto not yet implemented ` +
      `(enable --pr ${args.pr}${args.repo ? ` --repo ${args.repo}` : ''})`,
  );
}

async function main(): Promise<void> {
  const args = parse(process.argv.slice(2));
  await runEnable(args);
}

void main();
