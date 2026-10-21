import type { Trade } from './types';

export function tradePnl(t: Trade): number {
  if (t.pnlOverride !== undefined && Number.isFinite(t.pnlOverride)) return t.pnlOverride;
  const dir = t.side === 'long' ? 1 : -1;
  return (t.exit - t.entry) * t.qty * dir - (t.fees || 0);
}

/** Result in R (multiples of initial risk). Undefined when no stop was recorded. */
export function tradeR(t: Trade): number | undefined {
  if (t.stop === undefined || !Number.isFinite(t.stop)) return undefined;
  const risk = Math.abs(t.entry - t.stop) * t.qty;
  if (risk <= 0) return undefined;
  return tradePnl(t) / risk;
}

export function dayKey(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function holdMinutes(t: Trade): number {
  return Math.max(0, (new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime()) / 60000);
}

export interface Stats {
  count: number;
  wins: number;
  losses: number;
  breakeven: number;
  net: number;
  grossWin: number;
  grossLoss: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  /** avgWin / |avgLoss| */
  payoff: number;
  expectancy: number;
  largestWin: number;
  largestLoss: number;
  avgR: number | undefined;
  maxDrawdown: number;
  maxWinStreak: number;
  maxLossStreak: number;
  /** Positive = current win streak, negative = current loss streak. */
  currentStreak: number;
  fees: number;
  avgHoldMin: number;
  planAdherence: number | undefined;
  tradingDays: number;
  greenDays: number;
}

export function sortByClose(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => a.closedAt.localeCompare(b.closedAt));
}

export function computeStats(input: Trade[]): Stats {
  const trades = sortByClose(input);
  let wins = 0, losses = 0, breakeven = 0, grossWin = 0, grossLoss = 0;
  let largestWin = 0, largestLoss = 0, fees = 0, hold = 0;
  let equity = 0, peak = 0, maxDrawdown = 0;
  let streak = 0, maxWinStreak = 0, maxLossStreak = 0;
  let rSum = 0, rCount = 0, planYes = 0, planKnown = 0;
  const days = new Map<string, number>();

  for (const t of trades) {
    const p = tradePnl(t);
    fees += t.fees || 0;
    hold += holdMinutes(t);
    if (p > 0) {
      wins++; grossWin += p; largestWin = Math.max(largestWin, p);
      streak = streak > 0 ? streak + 1 : 1;
    } else if (p < 0) {
      losses++; grossLoss += -p; largestLoss = Math.min(largestLoss, p);
      streak = streak < 0 ? streak - 1 : -1;
    } else {
      breakeven++;
    }
    maxWinStreak = Math.max(maxWinStreak, streak);
    maxLossStreak = Math.max(maxLossStreak, -streak);
    equity += p;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
    const r = tradeR(t);
    if (r !== undefined) { rSum += r; rCount++; }
    if (t.followedPlan !== undefined) { planKnown++; if (t.followedPlan) planYes++; }
    const k = dayKey(t.closedAt);
    days.set(k, (days.get(k) || 0) + p);
  }

  const count = trades.length;
  const decided = wins + losses;
  const avgWin = wins ? grossWin / wins : 0;
  const avgLoss = losses ? -grossLoss / losses : 0;
  return {
    count, wins, losses, breakeven,
    net: grossWin - grossLoss,
    grossWin, grossLoss,
    winRate: decided ? wins / decided : 0,
    profitFactor: grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    avgWin, avgLoss,
    payoff: avgLoss ? avgWin / -avgLoss : avgWin > 0 ? Infinity : 0,
    expectancy: count ? (grossWin - grossLoss) / count : 0,
    largestWin, largestLoss,
    avgR: rCount ? rSum / rCount : undefined,
    maxDrawdown,
    maxWinStreak, maxLossStreak,
    currentStreak: streak,
    fees,
    avgHoldMin: count ? hold / count : 0,
    planAdherence: planKnown ? planYes / planKnown : undefined,
    tradingDays: days.size,
    greenDays: [...days.values()].filter((v) => v > 0).length,
  };
}

export interface DailyRow { date: string; pnl: number; count: number; wins: number }

export function dailyPnl(trades: Trade[]): DailyRow[] {
  const map = new Map<string, DailyRow>();
  for (const t of trades) {
    const k = dayKey(t.closedAt);
    const row = map.get(k) || { date: k, pnl: 0, count: 0, wins: 0 };
    const p = tradePnl(t);
    row.pnl += p; row.count++; if (p > 0) row.wins++;
    map.set(k, row);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function equityCurve(trades: Trade[]): { t: string; v: number }[] {
  let v = 0;
  return sortByClose(trades).map((t) => ({ t: t.closedAt, v: (v += tradePnl(t)) }));
}

export interface GroupRow { key: string; stats: Stats }

export function groupBy(trades: Trade[], keyFn: (t: Trade) => string | string[] | undefined): GroupRow[] {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    const k = keyFn(t);
    const keys = k === undefined ? [] : Array.isArray(k) ? k : [k];
    for (const key of keys) {
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
  }
  return [...map.entries()]
    .map(([key, ts]) => ({ key, stats: computeStats(ts) }))
    .sort((a, b) => b.stats.net - a.stats.net);
}

/**
 * A 0–100 composite score that rewards consistency and process, not just P&L.
 * Each component is normalised to 0–1 before weighting.
 */
export function babiliScore(s: Stats): { total: number; parts: { label: string; value: number }[] } {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const pf = Number.isFinite(s.profitFactor) ? s.profitFactor : 3;
  const payoff = Number.isFinite(s.payoff) ? s.payoff : 3;
  const ddRatio = s.grossWin > 0 ? s.maxDrawdown / s.grossWin : 1;
  const parts = [
    { label: 'Win rate', value: clamp(s.winRate / 0.6) },
    { label: 'Profit factor', value: clamp((pf - 0.5) / 2) },
    { label: 'Win / loss size', value: clamp(payoff / 2.5) },
    { label: 'Drawdown control', value: clamp(1 - ddRatio) },
    { label: 'Green days', value: s.tradingDays ? clamp(s.greenDays / s.tradingDays / 0.7) : 0 },
    { label: 'Plan adherence', value: s.planAdherence ?? 0.5 },
  ];
  const weights = [0.15, 0.2, 0.15, 0.15, 0.15, 0.2];
  const total = s.count ? Math.round(parts.reduce((acc, p, i) => acc + p.value * weights[i], 0) * 100) : 0;
  return { total, parts };
}
