import { useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { computeStats, holdMinutes, tradePnl, tradeR } from '../lib/stats';
import { dateTime, duration, money, pct, rMult, tone, uid } from '../lib/format';
import { exportTrades, importTrades } from '../lib/csv';
import { ConfirmButton, download } from '../components/ui';
import { Icon } from '../pixel/Sprite';
import type { Trade } from '../lib/types';

type SortKey = 'closedAt' | 'symbol' | 'pnl' | 'r' | 'hold';
type Outcome = 'all' | 'win' | 'loss';

export function Trades({ onOpenTrade, onNewTrade }: { onOpenTrade: (t: Trade) => void; onNewTrade: () => void }) {
  const { state, dispatch } = useStore();
  const [q, setQ] = useState('');
  const [outcome, setOutcome] = useState<Outcome>('all');
  const [playbook, setPlaybook] = useState('');
  const [side, setSide] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'closedAt', dir: -1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const pbName = (id?: string) => state.playbooks.find((p) => p.id === id)?.name ?? '';

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = state.trades.filter((t) => {
      const p = tradePnl(t);
      if (outcome === 'win' && p <= 0) return false;
      if (outcome === 'loss' && p >= 0) return false;
      if (playbook && t.playbookId !== playbook) return false;
      if (side && t.side !== side) return false;
      if (!needle) return true;
      return [t.symbol, t.notes, ...t.tags, ...t.mistakes].some((x) => x.toLowerCase().includes(needle));
    });
    const val = (t: Trade): number | string => {
      switch (sort.key) {
        case 'symbol': return t.symbol;
        case 'pnl': return tradePnl(t);
        case 'r': return tradeR(t) ?? -Infinity;
        case 'hold': return holdMinutes(t);
        default: return t.closedAt;
      }
    };
    return list.sort((a, b) => {
      const va = val(a), vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [state.trades, q, outcome, playbook, side, sort]);

  const s = useMemo(() => computeStats(rows), [rows]);

  const head = (key: SortKey, label: string, cls = '') => (
    <th className={cls}>
      <button className="th-btn" onClick={() => setSort((p) => ({ key, dir: p.key === key ? (p.dir === 1 ? -1 : 1) : -1 }))}>
        {label}{sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  const onImport = async (file: File) => {
    let text: string;
    try {
      text = await file.text();
    } catch {
      setMsg('That file could not be read. Make sure it is a .csv file.');
      return;
    }
    const newBooks = new Map<string, string>();
    const resolve = (name: string) => {
      const existing = state.playbooks.find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (existing) return existing.id;
      if (!newBooks.has(name)) newBooks.set(name, uid());
      return newBooks.get(name);
    };
    const res = importTrades(text, resolve);
    if (res.problem) {
      setMsg(`Nothing imported. ${res.problem}`);
      return;
    }
    // Re-importing the same export should not double your trades.
    const key = (t: Trade) => `${t.symbol}|${t.side}|${t.openedAt}|${t.closedAt}|${t.entry}|${t.exit}|${t.qty}`;
    const seen = new Set(state.trades.map(key));
    const fresh = res.trades.filter((t) => !seen.has(key(t)));
    const usedBooks = new Set(fresh.map((t) => t.playbookId));
    for (const [name, id] of newBooks) {
      if (usedBooks.has(id)) dispatch({ type: 'playbook/upsert', playbook: { id, name, description: 'Imported from CSV', rules: [], color: '#8b8b99' } });
    }
    dispatch({ type: 'trade/add-many', trades: fresh });
    const dupes = res.trades.length - fresh.length;
    const parts = [`Imported ${fresh.length} trade${fresh.length === 1 ? '' : 's'}`];
    if (dupes) parts.push(`${dupes} already in your journal`);
    if (res.skipped) parts.push(`skipped ${res.skipped} row${res.skipped === 1 ? '' : 's'} missing a symbol, date or price`);
    setMsg(`${parts.join(', ')}.`);
  };

  const allChecked = rows.length > 0 && rows.every((t) => selected.has(t.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((t) => t.id)));
  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="page">
      <header className="page-head">
        <h1>Trades</h1>
        <div className="row gap">
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
          <button className="btn ghost" onClick={() => fileRef.current?.click()}><Icon name="upload" size={10} /> Import CSV</button>
          <button className="btn ghost" onClick={() => download('babili-trades.csv', exportTrades(rows, pbName), 'text/csv')} disabled={!rows.length}><Icon name="download" size={10} /> Export</button>
          <button className="btn primary" onClick={onNewTrade}><Icon name="plus" size={10} /> New trade</button>
        </div>
      </header>

      {msg && <div className="notice" onClick={() => setMsg('')}>{msg}</div>}

      <div className="filters">
        <input className="search" placeholder="Search symbol, tag, mistake, note…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)}>
          <option value="all">All outcomes</option>
          <option value="win">Winners</option>
          <option value="loss">Losers</option>
        </select>
        <select value={side} onChange={(e) => setSide(e.target.value)}>
          <option value="">Long &amp; short</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
        <select value={playbook} onChange={(e) => setPlaybook(e.target.value)}>
          <option value="">All playbooks</option>
          {state.playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="summary-strip">
        <span>{s.count} trades</span>
        <span className={tone(s.net)}>{money(s.net, { sign: true })}</span>
        <span>{pct(s.winRate, 0)} win</span>
        <span>avg {rMult(s.avgR)}</span>
        {selected.size > 0 && (
          <ConfirmButton className="btn danger ghost small" onConfirm={() => { dispatch({ type: 'trade/delete', ids: [...selected] }); setSelected(new Set()); }} confirmLabel={`Delete ${selected.size}? Click again`}>
            <Icon name="trash" size={10} /> Delete {selected.size}
          </ConfirmButton>
        )}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="check"><input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" /></th>
              {head('closedAt', 'Closed')}
              {head('symbol', 'Symbol')}
              <th>Side</th>
              <th className="hide-sm">Setup</th>
              <th className="num hide-sm">Entry</th>
              <th className="num hide-sm">Exit</th>
              {head('hold', 'Hold', 'num hide-sm')}
              {head('r', 'R', 'num')}
              {head('pnl', 'Net P&L', 'num')}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const p = tradePnl(t);
              const pb = state.playbooks.find((x) => x.id === t.playbookId);
              return (
                <tr key={t.id} onClick={() => onOpenTrade(t)}>
                  <td className="check" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Select ${t.symbol}`} />
                  </td>
                  <td className="muted">{dateTime(t.closedAt)}</td>
                  <td>
                    <b>{t.symbol}</b>
                    {t.mistakes.length > 0 && <span className="flag" title={t.mistakes.join(', ')}>!</span>}
                  </td>
                  <td><span className={`side-pill ${t.side}`}>{t.side}</span></td>
                  <td className="hide-sm">{pb ? <span className="tag"><i className="dot" style={{ background: pb.color }} />{pb.name}</span> : <span className="muted">—</span>}</td>
                  <td className="num hide-sm">{t.pnlOverride !== undefined ? '—' : t.entry}</td>
                  <td className="num hide-sm">{t.pnlOverride !== undefined ? '—' : t.exit}</td>
                  <td className="num hide-sm muted">{duration(holdMinutes(t))}</td>
                  <td className="num">{rMult(tradeR(t))}</td>
                  <td className={`num ${tone(p)}`}><b>{money(p, { sign: true })}</b></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="muted center pad">No trades match. Try clearing filters, or import a CSV from your broker.</p>}
      </div>
      <p className="muted small">Works with Binance Futures Position History and most broker exports. CSV import auto-detects columns like <code>symbol, side, entry, exit, qty, fees, stop, opened_at, closed_at, pnl, setup, tags, notes</code>.</p>
    </div>
  );
}
