import { describe, expect, it } from 'vitest';
import { demoData } from './demo';
import { computeStats } from './stats';

describe('demoData', () => {
  it('is deterministic and looks like a plausible trader', () => {
    const a = demoData(60, 3);
    expect(demoData(60, 3).trades.map((t) => t.id)).toEqual(a.trades.map((t) => t.id));
    const s = computeStats(a.trades);
    expect(s.count).toBeGreaterThan(40);
    expect(s.profitFactor).toBeGreaterThan(0.8);
    expect(s.profitFactor).toBeLessThan(4);
  });
});
