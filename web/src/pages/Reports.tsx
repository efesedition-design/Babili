import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { computeStats, groupBy, holdMinutes, tradeR, type GroupRow } from '../lib/stats';
import { money, num, pct, rMult, tone } from '../lib/format';
import { BarChart, HBars } from '../components/Charts';
import { Card, Segmented } from '../components/ui';
import { inRange } from './Dashboard';
import type { Trade } from '../lib/types';

type Dim = 'playbook' | 'symbol' | 'weekday' | 'hour' | 'side' | 'tag' | 'mistake' | 'hold' | 'plan';
type Range = '30' | '90' | 'all';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOLD_BUCKETS: [number, string][] = [[5, '< 5m'], [15, '5–15m'], [60, '15–60m'], [240, '1–4h'], [1440, '4–24h'], [Infinity, '> 1 day']];

export function Reports() {
  const { state } = useStore();
  const [dim, setDim] = useState<Dim>('playbook');
  const [range, setRange] = useState<Range>('all');
  const trades = useMemo(() => inRange(state.trades, range), [state.trades, range]);
  const pbName = (id?: string) => state.playbooks.find((p) => p.id === id)?.name ?? 'No setup';
  const pbColor = (name: string) => state.playbooks.find((p) => p.name === name)?.color;

  const keyFn = (t: Trade): string | string[] | undefined => {
    switch (dim) {
      case 'playbook': return pbName(t.playbookId);
      case 'symbol': return t.symbol;
      case 'weekday': return DAYS[new Date(t.openedAt).getDay()];
      case 'hour': return `${String(new Date(t.openedAt).getHours()).padStart(2, '0')}:00`;
      case 'side': return t.side === 'long' ? 'Long' : 'Short';
      case 'tag': return t.tags.length ? t.tags : ['untagged'];
      case 'mistake': return t.mistakes.length ? t.mistakes : ['clean'];
      case 'hold': return HOLD_BUCKETS.find(([m]) => holdMinutes(t) < m)![1];
      case 'plan': return t.followedPlan === undefined ? 'Not recorded' : t.followedPlan ? 'Followed plan' : 'Broke plan';
    }
  };

  const groups = useMemo(() => {
    const g = groupBy(trades, keyFn);
    const order = dim === 'weekday' ? DAYS : dim === 'hold' ? HOLD_BUCKETS.map((b) => b[1]) : null;
    if (order) return g.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
    if (dim === 'hour') return g.sort((a, b) => a.key.localeCompare(b.key));
    return g;
  }, [trades, dim, state.playbooks]);

  const rDist = useMemo(() => {
    const rs = trades.map(tradeR).filter((r): r is number => r !== undefined);
    const buckets = new Map<number, number>();
    for (const r of rs) {
      const b = Math.max(-3, Math.min(4, Math.floor(r * 2) / 2));
      buckets.set(b, (buckets.get(b) || 0) + 1);
    }
    const out = [];
    for (let b = -3; b <= 4; b += 0.5) {
      const n = buckets.get(b) || 0;
      out.push({ label: `${b}R`, value: n, tone: b < 0 ? ('neg' as const) : ('pos' as const), sub: `${b === -3 ? '≤ ' : ''}${b}R${b === 4 ? '+' : ` to ${b + 0.5}R`}` });
    }
    return out;
  }, [trades]);

  const mistakeCost = useMemo(() => {
    const m = groupBy(trades.filter((t) => t.mistakes.length), (t) => t.mistakes);
    return m.map((g) => ({ label: g.key, value: g.stats.net, meta: `${g.stats.count}×` })).sort((a, b) => a.value - b.value);
  }, [trades]);

  const planSplit = useMemo(() => {
    const yes = computeStats(trades.filter((t) => t.followedPlan === true));
    const no = computeStats(trades.filter((t) => t.followedPlan === false));
    return { yes, no };
  }, [trades]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Reports</h1>
        <Segmented<Range> value={range} onChange={setRange} options={[{ value: '30', label: '30D' }, { value: '90', label: '90D' }, { value: 'all', label: 'All' }]} />
      </header>

      <div className="grid-2">
        <Card title="Plan vs. no plan">
          <div className="versus">
            <div>
              <span className="muted small">Followed plan · {planSplit.yes.count}</span>
              <b className={tone(planSplit.yes.expectancy)}>{money(planSplit.yes.expectancy, { sign: true })}</b>
              <span className="muted small">per trade · {pct(planSplit.yes.winRate, 0)} win</span>
            </div>
            <div>
              <span className="muted small">Broke plan · {planSplit.no.count}</span>
              <b className={tone(planSplit.no.expectancy)}>{money(planSplit.no.expectancy, { sign: true })}</b>
              <span className="muted small">per trade · {pct(planSplit.no.winRate, 0)} win</span>
            </div>
          </div>
          {planSplit.no.count > 0 && planSplit.yes.expectancy > planSplit.no.expectancy && (
            <p className="small">Breaking your plan cost you <b className="neg">{money(planSplit.yes.expectancy * planSplit.no.count - planSplit.no.net)}</b> versus trading those the way you trade your plan.</p>
          )}
        </Card>
        <Card title="Cost of mistakes">
          <HBars rows={mistakeCost} />
        </Card>
      </div>

      <Card title="R distribution">
        <BarChart bars={rDist} format={(v) => `${v} trade${v === 1 ? '' : 's'}`} axis={(v) => String(v)} height={160} />
      </Card>

      <Card
        title="Breakdown"
        action={
          <select value={dim} onChange={(e) => setDim(e.target.value as Dim)} aria-label="Group by">
            <option value="playbook">by Playbook</option>
            <option value="symbol">by Symbol</option>
            <option value="weekday">by Weekday</option>
            <option value="hour">by Hour opened</option>
            <option value="side">by Side</option>
            <option value="tag">by Tag</option>
            <option value="mistake">by Mistake</option>
            <option value="hold">by Hold time</option>
            <option value="plan">by Plan adherence</option>
          </select>
        }
      >
        <HBars rows={groups.map((g) => ({ label: g.key, value: g.stats.net, color: dim === 'playbook' ? pbColor(g.key) : undefined }))} />
        <BreakdownTable groups={groups} />
      </Card>
    </div>
  );
}

function BreakdownTable({ groups }: { groups: GroupRow[] }) {
  if (!groups.length) return null;
  return (
    <div className="table-wrap">
      <table className="table compact">
        <thead>
          <tr>
            <th>Group</th><th className="num">Trades</th><th className="num">Win %</th><th className="num">PF</th>
            <th className="num hide-sm">Avg win</th><th className="num hide-sm">Avg loss</th><th className="num">Avg R</th><th className="num">Net</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(({ key, stats: s }) => (
            <tr key={key}>
              <td>{key}</td>
              <td className="num">{s.count}</td>
              <td className="num">{pct(s.winRate, 0)}</td>
              <td className="num">{num(s.profitFactor)}</td>
              <td className="num hide-sm pos">{money(s.avgWin)}</td>
              <td className="num hide-sm neg">{money(s.avgLoss)}</td>
              <td className="num">{rMult(s.avgR)}</td>
              <td className={`num ${tone(s.net)}`}><b>{money(s.net, { sign: true })}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

