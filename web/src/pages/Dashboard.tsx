import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { babiliScore, computeStats, dailyPnl, dayKey, equityCurve, tradePnl, tradeR } from '../lib/stats';
import { dateTime, money, num, pct, rMult, tone } from '../lib/format';
import { BarChart, EquityChart, PixelMeter } from '../components/Charts';
import { Card, Kpi, Segmented } from '../components/ui';
import { CompanionCard } from '../components/CompanionCard';
import { Icon } from '../pixel/Sprite';
import type { Trade } from '../lib/types';

type Range = '7' | '30' | '90' | 'all';

export function inRange(trades: Trade[], range: Range): Trade[] {
  if (range === 'all') return trades;
  const since = Date.now() - Number(range) * 86400000;
  return trades.filter((t) => new Date(t.closedAt).getTime() >= since);
}

export function Dashboard({ onNewTrade, onOpenTrade, onLoadDemo }: { onNewTrade: () => void; onOpenTrade: (t: Trade) => void; onLoadDemo: () => void }) {
  const { state } = useStore();
  const [range, setRange] = useState<Range>('30');
  const trades = useMemo(() => inRange(state.trades, range), [state.trades, range]);
  const s = useMemo(() => computeStats(trades), [trades]);
  const score = useMemo(() => babiliScore(s), [s]);
  const days = useMemo(() => dailyPnl(trades), [trades]);
  const curve = useMemo(() => equityCurve(trades), [trades]);
  const recent = useMemo(() => [...state.trades].sort((a, b) => b.closedAt.localeCompare(a.closedAt)).slice(0, 6), [state.trades]);
  const today = dailyPnl(state.trades).find((d) => d.date === dayKey(new Date().toISOString()));
  const limit = state.settings.dailyLossLimit;
  const hello = state.settings.name ? `Hey, ${state.settings.name}` : 'Overview';

  if (!state.trades.length) {
    return (
      <div className="page">
        <header className="page-head"><h1>Welcome to Babili</h1></header>
        <CompanionCard />
        <div className="empty-cta">
          <p>A calm, local-first trading journal. Your data never leaves this browser.</p>
          <div className="row gap">
            <button className="btn primary" onClick={onNewTrade}><Icon name="plus" size={10} /> Log first trade</button>
            <button className="btn ghost" onClick={onLoadDemo}>Explore with demo data</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>{hello}</h1>
        <Segmented<Range>
          value={range}
          onChange={setRange}
          options={[{ value: '7', label: '7D' }, { value: '30', label: '30D' }, { value: '90', label: '90D' }, { value: 'all', label: 'All' }]}
        />
      </header>

      <div className="dash-top">
        <CompanionCard />
        <Card title="Today" className="today-card">
          <div className={`today-pnl ${tone(today?.pnl ?? 0)}`}>{money(today?.pnl ?? 0, { sign: true })}</div>
          <div className="muted small">{today ? `${today.count} trade${today.count > 1 ? 's' : ''} · ${today.wins} won` : 'No trades yet today'}</div>
          {limit > 0 && (
            <div className="guard">
              <span className="small"><Icon name="shield" size={10} /> Loss limit {money(limit)}</span>
              <PixelMeter value={Math.max(0, -(today?.pnl ?? 0)) / limit} segments={12} tone="neg" />
            </div>
          )}
        </Card>
      </div>

      <div className="kpis">
        <Kpi label="Net P&L" value={money(s.net, { sign: true })} tone={tone(s.net)} hint={`${s.count} trades, fees ${money(s.fees)}`}>
          <span className="muted small">{s.count} trades</span>
        </Kpi>
        <Kpi label="Win rate" value={pct(s.winRate, 0)}>
          <PixelMeter value={s.winRate} tone={s.winRate >= 0.5 ? 'pos' : 'neg'} />
        </Kpi>
        <Kpi label="Profit factor" value={num(s.profitFactor)} tone={s.profitFactor >= 1 ? 'pos' : 'neg'} hint="Gross profit ÷ gross loss">
          <span className="muted small">{money(s.grossWin, { compact: true })} / {money(s.grossLoss, { compact: true })}</span>
        </Kpi>
        <Kpi label="Expectancy" value={money(s.expectancy, { sign: true })} tone={tone(s.expectancy)} hint="Average P&L per trade">
          <span className="muted small">avg {rMult(s.avgR)}</span>
        </Kpi>
        <Kpi label="Avg win / loss" value={num(s.payoff)} hint="Average win ÷ average loss">
          <span className="muted small"><span className="pos">{money(s.avgWin, { compact: true })}</span> / <span className="neg">{money(s.avgLoss, { compact: true })}</span></span>
        </Kpi>
        <Kpi label="Max drawdown" value={money(-s.maxDrawdown)} tone={s.maxDrawdown ? 'neg' : 'flat'}>
          <span className="muted small">streaks {s.maxWinStreak}W / {s.maxLossStreak}L</span>
        </Kpi>
      </div>

      <div className="grid-main">
        <Card title="Equity curve">
          {curve.length ? <EquityChart points={curve} /> : <p className="muted small">No trades in this range.</p>}
        </Card>
        <Card title={<>Babili score <span className="pixel score">{score.total}</span></>}>
          <div className="score-parts">
            {score.parts.map((p) => (
              <div key={p.label} className="score-row">
                <span className="small">{p.label}</span>
                <PixelMeter value={p.value} segments={10} />
              </div>
            ))}
          </div>
          <p className="muted small">Weighted toward consistency and plan adherence — the things you control.</p>
        </Card>
      </div>

      <div className="grid-main">
        <Card title="Daily P&L">
          {days.length ? (
            <BarChart bars={days.map((d) => ({ label: d.date.slice(5), value: d.pnl, sub: `${d.date} · ${d.count} trades` }))} />
          ) : <p className="muted small">No trades in this range.</p>}
        </Card>
        <Card title="Recent trades">
          <ul className="recent">
            {recent.map((t) => {
              const p = tradePnl(t);
              return (
                <li key={t.id}>
                  <button onClick={() => onOpenTrade(t)}>
                    <span className={`side-pill ${t.side}`}>{t.side === 'long' ? 'L' : 'S'}</span>
                    <span className="sym">{t.symbol}</span>
                    <span className="muted small">{dateTime(t.closedAt)}</span>
                    <span className={`amt ${tone(p)}`}>{money(p, { sign: true })}</span>
                    <span className="muted small r">{rMult(tradeR(t))}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
