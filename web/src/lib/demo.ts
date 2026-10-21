import type { DayNote, Playbook, Trade } from './types';
import { dayKey } from './stats';

export const DEFAULT_PLAYBOOKS: Playbook[] = [
  {
    id: 'pb-choch-ob',
    name: 'CHoCH → Order Block',
    description: 'HTF bias aligned change of character, enter on the order block that caused it.',
    rules: ['HTF bias agrees with direction', 'LTF CHoCH printed', 'OB sits in discount (long) / premium (short)', 'Stop beyond OB with buffer', 'Minimum 2R to target'],
    color: '#7c6cff',
  },
  {
    id: 'pb-sweep',
    name: 'Liquidity Sweep Reversal',
    description: 'Equal highs/lows get swept and price closes back inside the range.',
    rules: ['Clear equal highs/lows', 'Wick through, close back inside', 'Displacement candle after sweep', 'Stop above/below sweep wick'],
    color: '#22a3c4',
  },
  {
    id: 'pb-fvg',
    name: 'FVG Continuation',
    description: 'Trend continuation from a fresh fair value gap after a BOS.',
    rules: ['Fresh BOS in trend direction', 'Unmitigated FVG', 'Entry at 50% of gap', 'Session open volatility'],
    color: '#e0a526',
  },
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const SYMBOLS: [string, number, number][] = [
  ['BTCUSDT', 64000, 0.05],
  ['ETHUSDT', 3200, 1],
  ['SOLUSDT', 150, 20],
  ['NQ', 18500, 1],
  ['AAPL', 210, 50],
  ['EURUSD', 1.08, 50000],
];
const TAGS = ['london', 'new-york', 'asia', 'a+ setup', 'news', 'scaled-out', 'trend-day'];
const MISTAKES = ['FOMO entry', 'moved stop', 'oversized', 'early exit', 'revenge trade', 'no plan'];
const NOTES = [
  'Waited for the CHoCH, clean entry on the OB retest.',
  'Took it a bit early, but structure held.',
  'Chased the move after missing the first entry. Should have let it go.',
  'Textbook sweep of equal lows into the discount zone.',
  'Got stopped by a wick, then it ran to target without me.',
  'Partial at 1R, runner closed at 2.5R.',
  '',
  '',
];

export function demoData(days = 45, seed = 7): { trades: Trade[]; notes: Record<string, DayNote> } {
  const rand = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const trades: Trade[] = [];
  const notes: Record<string, DayNote> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = days; d >= 0; d--) {
    const day = new Date(today);
    day.setDate(today.getDate() - d);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    if (rand() < 0.15) continue;
    const n = 1 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const [symbol, price, lot] = pick(SYMBOLS);
      const side = rand() < 0.55 ? 'long' : 'short';
      const pb = pick(DEFAULT_PLAYBOOKS);
      const followedPlan = rand() < 0.72;
      // Better outcomes when the plan is followed — the lesson the app nudges toward.
      const win = rand() < (followedPlan ? 0.56 : 0.3);
      const riskPct = 0.004 + rand() * 0.006;
      const risk = price * riskPct;
      // Size every trade to roughly the same dollar risk, like a real risk-per-trade rule.
      const qty = Math.max(lot / 50, Math.round((80 + rand() * 60) / risk / (lot / 50)) * (lot / 50));
      const rOut = win ? 0.8 + rand() * 2.2 : -(followedPlan ? 0.7 + rand() * 0.35 : 0.9 + rand() * 1.3);
      const entry = price * (1 + (rand() - 0.5) * 0.04);
      const dir = side === 'long' ? 1 : -1;
      const stop = entry - dir * risk;
      const exit = entry + dir * risk * rOut;
      const open = new Date(day);
      open.setHours(8 + Math.floor(rand() * 8), Math.floor(rand() * 60));
      const close = new Date(open.getTime() + (5 + rand() * 180) * 60000);
      const decimals = price < 10 ? 5 : 2;
      const round = (x: number) => Number(x.toFixed(decimals));
      trades.push({
        id: `demo-${d}-${i}`,
        symbol,
        side,
        openedAt: open.toISOString(),
        closedAt: close.toISOString(),
        entry: round(entry),
        exit: round(exit),
        stop: round(stop),
        target: round(entry + dir * risk * 2),
        qty: Number(qty.toPrecision(6)),
        fees: Number(Math.min(entry * qty * 0.0004, 12).toFixed(2)),
        playbookId: rand() < 0.85 ? pb.id : undefined,
        tags: [pick(TAGS), ...(rand() < 0.3 ? [pick(TAGS)] : [])].filter((x, j, a) => a.indexOf(x) === j),
        mistakes: followedPlan ? [] : [pick(MISTAKES)],
        notes: pick(NOTES),
        rating: followedPlan ? 3 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 3),
        followedPlan,
      });
    }
    if (rand() < 0.6) {
      const key = dayKey(day.toISOString());
      notes[key] = {
        date: key,
        plan: pick(['Bias bullish above weekly open. Only longs from discount.', 'CPI at 8:30 — no trades before the release.', 'Range day expected; fade the extremes.', 'Max 3 trades. Walk away after 2 losses.']),
        review: pick(['Followed the plan. Patient.', 'Overtraded after lunch.', 'Good read on the sweep, sloppy sizing.', 'Clean day. Sat on hands when needed.', '']),
        mood: 2 + Math.floor(rand() * 4),
      };
    }
  }
  return { trades, notes };
}
