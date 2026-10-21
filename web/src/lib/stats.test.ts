import { describe, expect, it } from 'vitest';
import { babiliScore, computeStats, dailyPnl, equityCurve, groupBy, tradePnl, tradeR } from './stats';
import type { Trade } from './types';

const base: Trade = {
  id: 'x', symbol: 'BTCUSDT', side: 'long', openedAt: '2024-05-01T10:00:00Z', closedAt: '2024-05-01T11:00:00Z',
  entry: 100, exit: 110, qty: 2, fees: 1, tags: [], mistakes: [], notes: '',
};
const t = (p: Partial<Trade>): Trade => ({ ...base, ...p });

describe('tradePnl / tradeR', () => {
  it('handles long and short', () => {
    expect(tradePnl(t({}))).toBe(19);
    expect(tradePnl(t({ side: 'short' }))).toBe(-21);
  });
  it('prefers a manual override', () => {
    expect(tradePnl(t({ pnlOverride: -50 }))).toBe(-50);
  });
  it('expresses the result in R', () => {
    expect(tradeR(t({ stop: 95, fees: 0 }))).toBeCloseTo(2);
    expect(tradeR(t({}))).toBeUndefined();
  });
});

describe('computeStats', () => {
  const trades = [
    t({ id: 'a', exit: 110, fees: 0, closedAt: '2024-05-01T11:00:00Z', followedPlan: true }), // +20
    t({ id: 'b', exit: 95, fees: 0, closedAt: '2024-05-02T11:00:00Z', followedPlan: false }), // -10
    t({ id: 'c', exit: 90, fees: 0, closedAt: '2024-05-02T12:00:00Z' }), // -20
    t({ id: 'd', exit: 120, fees: 0, closedAt: '2024-05-03T11:00:00Z', followedPlan: true }), // +40
  ];
  const s = computeStats(trades);
  it('aggregates the basics', () => {
    expect(s.count).toBe(4);
    expect(s.net).toBe(30);
    expect(s.winRate).toBe(0.5);
    expect(s.profitFactor).toBe(2);
    expect(s.avgWin).toBe(30);
    expect(s.avgLoss).toBe(-15);
    expect(s.payoff).toBe(2);
    expect(s.expectancy).toBe(7.5);
  });
  it('tracks drawdown and streaks in close order', () => {
    expect(s.maxDrawdown).toBe(30);
    expect(s.maxLossStreak).toBe(2);
    expect(s.currentStreak).toBe(1);
  });
  it('counts days and plan adherence', () => {
    expect(s.tradingDays).toBe(3);
    expect(s.greenDays).toBe(2);
    expect(s.planAdherence).toBeCloseTo(2 / 3);
  });
  it('builds daily rows and an equity curve', () => {
    expect(dailyPnl(trades).map((d) => d.pnl)).toEqual([20, -30, 40]);
    expect(equityCurve(trades).map((p) => p.v)).toEqual([20, 10, -10, 30]);
  });
  it('groups multi-valued keys', () => {
    const g = groupBy([t({ tags: ['a', 'b'] }), t({ tags: ['a'] })], (x) => x.tags);
    expect(g.find((r) => r.key === 'a')!.stats.count).toBe(2);
    expect(g.find((r) => r.key === 'b')!.stats.count).toBe(1);
  });
  it('scores between 0 and 100', () => {
    const sc = babiliScore(s).total;
    expect(sc).toBeGreaterThan(0);
    expect(sc).toBeLessThanOrEqual(100);
    expect(babiliScore(computeStats([])).total).toBe(0);
  });
});
