import { describe, it, expect } from 'vitest';
import { BOT_AUTOMERGE_COMMANDS, isBotAutomergeCommand } from '../src/index.js';

describe('bot-automerge package contract', () => {
  it('exposes the enable command', () => {
    expect(BOT_AUTOMERGE_COMMANDS).toEqual(['enable']);
  });

  it('recognizes the enable command and rejects everything else', () => {
    expect(isBotAutomergeCommand('enable')).toBe(true);
    expect(isBotAutomergeCommand('nope')).toBe(false);
    expect(isBotAutomergeCommand('')).toBe(false);
    expect(isBotAutomergeCommand(undefined)).toBe(false);
  });
});
