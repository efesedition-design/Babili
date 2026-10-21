import type { Mood } from '../pixel/sprites';
import type { JournalState } from './types';
import { dailyPnl, dayKey, sortByClose, tradePnl } from './stats';

/**
 * The companion levels up on process, not profit: journaling, tagging setups
 * and following the plan earn XP. Green days don't — that's the market's call.
 */
export function companionXp(s: JournalState): number {
  let xp = 0;
  for (const t of s.trades) {
    xp += 5;
    if (t.notes.trim()) xp += 5;
    if (t.playbookId) xp += 3;
    if (t.followedPlan) xp += 6;
    if (t.rating) xp += 1;
  }
  for (const n of Object.values(s.notes)) {
    if (n.plan.trim()) xp += 8;
    if (n.review.trim()) xp += 12;
  }
  return xp;
}

export function levelFromXp(xp: number): { level: number; into: number; span: number } {
  // Level n starts at 40·n² XP.
  const level = Math.floor(Math.sqrt(xp / 40));
  const start = 40 * level * level;
  const next = 40 * (level + 1) * (level + 1);
  return { level: level + 1, into: xp - start, span: next - start };
}

export interface CompanionView { mood: Mood; line: string }

export function companionMood(s: JournalState, now = new Date()): CompanionView {
  if (!s.trades.length) {
    return { mood: 'sleep', line: 'Zzz… log your first trade and I’ll wake up.' };
  }
  const today = dayKey(now.toISOString());
  const days = dailyPnl(s.trades);
  const todayRow = days.find((d) => d.date === today);
  const recent = sortByClose(s.trades).slice(-5);
  const lastTrade = recent[recent.length - 1];
  const streak = (() => {
    let n = 0;
    for (let i = recent.length - 1; i >= 0 && tradePnl(recent[i]) > 0; i--) n++;
    return n;
  })();
  const limit = s.settings.dailyLossLimit;

  if (todayRow && limit > 0 && todayRow.pnl <= -limit) {
    return { mood: 'sad', line: 'Daily loss limit hit. We’re done for today — protect the account, review tomorrow.' };
  }
  if (streak >= 3) {
    return { mood: 'fire', line: `${streak} wins in a row! Stay humble — same size, same rules.` };
  }
  const ref = todayRow ?? days[days.length - 1];
  if (lastTrade && lastTrade.followedPlan === false) {
    return { mood: 'focus', line: 'Last trade broke the plan. What would the A+ version have looked like?' };
  }
  if (ref.pnl > 0) {
    return { mood: 'happy', line: todayRow ? 'Green day. Write down what worked while it’s fresh.' : 'Last session closed green. Nice process.' };
  }
  if (ref.pnl < 0) {
    return { mood: 'sad', line: 'Red day. That’s data, not a verdict — the review is where you win.' };
  }
  return { mood: 'neutral', line: 'Waiting for the A+ setup. No trade is also a position.' };
}
