import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { computeStats, dailyPnl, dayKey, tradePnl, tradeR } from '../lib/stats';
import { dateTime, money, pct, rMult, tone } from '../lib/format';
import { Card, Modal } from '../components/ui';
import { CompanionSprite } from '../pixel/Sprite';
import type { Mood } from '../pixel/sprites';
import type { DayNote, Trade } from '../lib/types';

const MOOD_SCALE: Mood[] = ['sad', 'focus', 'neutral', 'happy', 'fire'];
const MOOD_LABEL = ['Rough', 'Off', 'Okay', 'Good', 'Great'];

function longDate(k: string) {
  return new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function NoteEditor({ date }: { date: string }) {
  const { state, dispatch } = useStore();
  const note: DayNote = state.notes[date] ?? { date, plan: '', review: '' };
  const save = (patch: Partial<DayNote>) => dispatch({ type: 'note/upsert', note: { ...note, ...patch } });
  return (
    <div className="note-editor">
      <div className="field">
        <span>How did the session feel?</span>
        <div className="mood-picker">
          {MOOD_SCALE.map((m, i) => (
            <button key={m} className={note.mood === i + 1 ? 'on' : ''} onClick={() => save({ mood: note.mood === i + 1 ? undefined : i + 1 })} title={MOOD_LABEL[i]}>
              <CompanionSprite id={state.settings.companion} mood={m} size={32} animate={false} />
              <span className="small">{MOOD_LABEL[i]}</span>
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>Pre-market plan</span>
        <textarea rows={3} value={note.plan} onChange={(e) => save({ plan: e.target.value })} placeholder="Bias, key levels, news, max trades, what you will NOT do…" />
      </label>
      <label className="field">
        <span>Post-session review</span>
        <textarea rows={4} value={note.review} onChange={(e) => save({ review: e.target.value })} placeholder="What went well? What will you repeat? One thing to fix tomorrow." />
      </label>
    </div>
  );
}

export function DayPanel({ date, trades, onClose, onOpenTrade }: { date: string; trades: Trade[]; onClose: () => void; onOpenTrade: (t: Trade) => void }) {
  const s = computeStats(trades);
  return (
    <Modal title={longDate(date)} onClose={onClose} wide>
      {trades.length > 0 && (
        <>
          <div className="summary-strip">
            <span className={tone(s.net)}><b>{money(s.net, { sign: true })}</b></span>
            <span>{s.count} trades</span>
            <span>{pct(s.winRate, 0)} win</span>
            <span>fees {money(s.fees)}</span>
          </div>
          <ul className="recent">
            {trades.map((t) => {
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
        </>
      )}
      <NoteEditor date={date} />
    </Modal>
  );
}

export function Journal({ onOpenTrade }: { onOpenTrade: (t: Trade) => void }) {
  const { state } = useStore();
  const today = dayKey(new Date().toISOString());
  const [picked, setPicked] = useState<string | null>(null);
  const pnlByDay = useMemo(() => new Map(dailyPnl(state.trades).map((d) => [d.date, d])), [state.trades]);
  const days = useMemo(() => {
    const keys = new Set([...pnlByDay.keys(), ...Object.keys(state.notes)]);
    keys.delete(today);
    return [...keys].sort().reverse();
  }, [pnlByDay, state.notes, today]);

  return (
    <div className="page">
      <header className="page-head"><h1>Journal</h1></header>
      <Card title={<>Today · <span className="muted">{longDate(today)}</span></>}>
        <NoteEditor date={today} />
      </Card>

      <h2 className="section-title">Past sessions</h2>
      <div className="journal-list">
        {days.map((k) => {
          const row = pnlByDay.get(k);
          const n = state.notes[k];
          return (
            <button key={k} className="journal-item" onClick={() => setPicked(k)}>
              <div className="ji-head">
                {n?.mood && <CompanionSprite id={state.settings.companion} mood={MOOD_SCALE[n.mood - 1]} size={24} animate={false} />}
                <b>{longDate(k)}</b>
                {row && <span className={`ji-pnl ${tone(row.pnl)}`}>{money(row.pnl, { sign: true })}</span>}
              </div>
              {n?.review ? <p className="ji-text">{n.review}</p> : n?.plan ? <p className="ji-text muted">Plan: {n.plan}</p> : <p className="ji-text muted">No review yet — tap to write one.</p>}
            </button>
          );
        })}
        {!days.length && <p className="muted">Your reviews will stack up here.</p>}
      </div>

      {picked && (
        <DayPanel
          date={picked}
          onClose={() => setPicked(null)}
          trades={state.trades.filter((t) => dayKey(t.closedAt) === picked)}
          onOpenTrade={onOpenTrade}
        />
      )}
    </div>
  );
}
