import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { dailyPnl, dayKey } from '../lib/stats';
import { money, tone } from '../lib/format';
import { Icon } from '../pixel/Sprite';
import { DayPanel } from './Journal';
import type { Trade } from '../lib/types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Calendar({ onOpenTrade }: { onOpenTrade: (t: Trade) => void }) {
  const { state } = useStore();
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [picked, setPicked] = useState<string | null>(null);
  const byDay = useMemo(() => new Map(dailyPnl(state.trades).map((d) => [d.date, d])), [state.trades]);

  const cells = useMemo(() => {
    const first = new Date(cursor);
    const lead = (first.getDay() + 6) % 7; // Monday-first
    const start = new Date(first);
    start.setDate(1 - lead);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const monthRows = [...byDay.values()].filter((d) => d.date.startsWith(dayKey(cursor.toISOString()).slice(0, 7)));
  const monthPnl = monthRows.reduce((a, d) => a + d.pnl, 0);
  const maxAbs = Math.max(1, ...monthRows.map((d) => Math.abs(d.pnl)));
  const weeks = Array.from({ length: 6 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const todayKey = dayKey(new Date().toISOString());
  const move = (n: number) => setCursor((c) => { const d = new Date(c); d.setMonth(c.getMonth() + n); return d; });

  return (
    <div className="page">
      <header className="page-head">
        <h1>Calendar</h1>
        <div className="row gap center-y">
          <button className="icon-btn" onClick={() => move(-1)} aria-label="Previous month"><Icon name="left" size={10} /></button>
          <span className="month-label">{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
          <button className="icon-btn" onClick={() => move(1)} aria-label="Next month"><Icon name="right" size={10} /></button>
          <span className={`month-pnl ${tone(monthPnl)}`}>{money(monthPnl, { sign: true })}</span>
        </div>
      </header>

      <div className="cal">
        <div className="cal-row cal-head">
          {WEEKDAYS.map((d) => <div key={d}>{d}</div>)}
          <div className="hide-sm">Week</div>
        </div>
        {weeks.map((week, wi) => {
          const wk = week.reduce((a, d) => a + (byDay.get(dayKey(d.toISOString()))?.pnl ?? 0), 0);
          const wkTrades = week.reduce((a, d) => a + (byDay.get(dayKey(d.toISOString()))?.count ?? 0), 0);
          return (
            <div className="cal-row" key={wi}>
              {week.map((d) => {
                const k = dayKey(d.toISOString());
                const row = byDay.get(k);
                const inMonth = d.getMonth() === cursor.getMonth();
                const intensity = row ? 0.12 + 0.5 * (Math.abs(row.pnl) / maxAbs) : 0;
                const hasNote = !!state.notes[k]?.review || !!state.notes[k]?.plan;
                return (
                  <button
                    key={k}
                    className={`cal-cell${inMonth ? '' : ' out'}${k === todayKey ? ' today' : ''}${row ? ` has ${tone(row.pnl)}` : ''}`}
                    style={row ? { ['--i' as string]: intensity } : undefined}
                    onClick={() => setPicked(k)}
                  >
                    <span className="cal-date">{d.getDate()}{hasNote && <i className="note-dot" title="Journal entry" />}</span>
                    {row && (
                      <>
                        <span className="cal-pnl">{money(row.pnl, { compact: true, sign: true })}</span>
                        <span className="cal-meta">{row.count}t · {Math.round((row.wins / row.count) * 100)}%</span>
                      </>
                    )}
                  </button>
                );
              })}
              <div className={`cal-week hide-sm ${tone(wk)}`}>
                {wkTrades > 0 && <><b>{money(wk, { compact: true, sign: true })}</b><span className="muted small">{wkTrades} trades</span></>}
              </div>
            </div>
          );
        })}
      </div>

      {picked && (
        <DayPanel
          date={picked}
          onClose={() => setPicked(null)}
          trades={state.trades.filter((t) => dayKey(t.closedAt) === picked).sort((a, b) => a.closedAt.localeCompare(b.closedAt))}
          onOpenTrade={onOpenTrade}
        />
      )}
    </div>
  );
}
