import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AUTOMERGE_HANDLED_LABEL } from '../src/index.js';

// Mock only the `addLabels` transport so the test asserts the composition
// (right repo/pr/label, best-effort result) without touching `gh`.
const { addLabels } = vi.hoisted(() => ({ addLabels: vi.fn() }));
vi.mock('../src/lib/github.js', () => ({ addLabels }));

import { markPrHandled } from '../src/lib/automerge-label.js';

describe('markPrHandled', () => {
  beforeEach(() => addLabels.mockReset());

  it('applies exactly the handled label via addLabels and reports success', async () => {
    addLabels.mockResolvedValue('[{"name":"auto-merge enabled"}]');

    const ok = await markPrHandled('rmartz/bot-automerge', 42, { cwd: '/w' });

    expect(ok).toBe(true);
    expect(addLabels).toHaveBeenCalledTimes(1);
    expect(addLabels).toHaveBeenCalledWith('rmartz/bot-automerge', 42, [AUTOMERGE_HANDLED_LABEL], {
      cwd: '/w',
    });
  });

  it('reports a non-fatal failure when addLabels soft-fails (label not in roster)', async () => {
    addLabels.mockResolvedValue(null);

    const ok = await markPrHandled('rmartz/bot-automerge', 42);

    expect(ok).toBe(false);
    expect(addLabels).toHaveBeenCalledWith(
      'rmartz/bot-automerge',
      42,
      [AUTOMERGE_HANDLED_LABEL],
      {},
    );
  });
});
