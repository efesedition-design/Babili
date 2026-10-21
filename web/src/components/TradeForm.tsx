import { useMemo, useState } from 'react';
import type { Trade } from '../lib/types';
import { useStore } from '../lib/store';
import { fromLocalInput, money, rMult, toLocalInput, uid } from '../lib/format';
import { tradePnl, tradeR } from '../lib/stats';
import { ChipInput, Modal, Stars } from './ui';

const COMMON_MISTAKES = ['FOMO entry', 'moved stop', 'oversized', 'early exit', 'revenge trade', 'no plan', 'chased', 'ignored HTF bias'];

function blank(): Trade {
  const now = new Date();
  const open = new Date(now.getTime() - 30 * 60000);
  return {
    id: uid(), symbol: '', side: 'long', openedAt: open.toISOString(), closedAt: now.toISOString(),
    entry: NaN, exit: NaN, qty: 1, fees: 0, tags: [], mistakes: [], notes: '',
  };
}

const numOrUndef = (v: string) => (v.trim() === '' ? undefined : Number(v));

export function TradeForm({ trade, onClose }: { trade?: Trade; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [t, setT] = useState<Trade>(() => trade ?? blank());
  const set = <K extends keyof Trade>(k: K, v: Trade[K]) => setT((p) => ({ ...p, [k]: v }));

  const allTags = useMemo(() => [...new Set(state.trades.flatMap((x) => x.tags))].sort(), [state.trades]);
  const allMistakes = useMemo(() => [...new Set([...COMMON_MISTAKES, ...state.trades.flatMap((x) => x.mistakes)])], [state.trades]);
  const symbols = useMemo(() => [...new Set(state.trades.map((x) => x.symbol))].sort(), [state.trades]);
  const playbook = state.playbooks.find((p) => p.id === t.playbookId);

  const valid = t.symbol.trim() && Number.isFinite(t.entry) && Number.isFinite(t.exit) && t.qty > 0;
  const pnl = valid ? tradePnl(t) : 0;
  const r = valid ? tradeR(t) : undefined;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    dispatch({ type: 'trade/upsert', trade: { ...t, symbol: t.symbol.trim().toUpperCase() } });
    onClose();
  };

  const numField = (k: 'entry' | 'exit' | 'qty' | 'fees' | 'stop' | 'target', label: string, required = false) => (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        step="any"
        inputMode="decimal"
        required={required}
        value={t[k] === undefined || Number.isNaN(t[k]) ? '' : String(t[k])}
        onChange={(e) => {
          const v = numOrUndef(e.target.value);
          set(k, (required ? v ?? NaN : v) as never);
          // Editing prices means the user wants a price-based P&L again.
          if (k === 'entry' || k === 'exit') set('pnlOverride', undefined);
        }}
      />
    </label>
  );

  return (
    <Modal title={trade ? `Edit ${trade.symbol}` : 'Log a trade'} onClose={onClose} wide>
      <form onSubmit={save} className="trade-form">
        <div className="grid-4">
          <label className="field">
            <span>Symbol</span>
            <input list="symbols" required value={t.symbol} onChange={(e) => set('symbol', e.target.value)} placeholder="BTCUSDT" autoFocus />
            <datalist id="symbols">{symbols.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
          <div className="field">
            <span>Side</span>
            <div className="side-toggle">
              <button type="button" className={t.side === 'long' ? 'on pos' : ''} onClick={() => set('side', 'long')}>Long</button>
              <button type="button" className={t.side === 'short' ? 'on neg' : ''} onClick={() => set('side', 'short')}>Short</button>
            </div>
          </div>
          <label className="field">
            <span>Opened</span>
            <input type="datetime-local" required value={toLocalInput(t.openedAt)} onChange={(e) => e.target.value && set('openedAt', fromLocalInput(e.target.value))} />
          </label>
          <label className="field">
            <span>Closed</span>
            <input type="datetime-local" required value={toLocalInput(t.closedAt)} onChange={(e) => e.target.value && set('closedAt', fromLocalInput(e.target.value))} />
          </label>
        </div>
        <div className="grid-6">
          {numField('entry', 'Entry', true)}
          {numField('exit', 'Exit', true)}
          {numField('qty', 'Quantity', true)}
          {numField('stop', 'Stop')}
          {numField('target', 'Target')}
          {numField('fees', 'Fees')}
        </div>

        <div className="preview">
          <div><span className="muted">Net P&amp;L</span><b className={pnl > 0 ? 'pos' : pnl < 0 ? 'neg' : ''}>{valid ? money(pnl, { sign: true }) : '—'}</b></div>
          <div><span className="muted">R multiple</span><b>{rMult(r)}</b></div>
          {t.pnlOverride !== undefined && <div className="muted small">P&amp;L imported manually</div>}
        </div>

        <div className="grid-2">
          <label className="field">
            <span>Playbook</span>
            <select value={t.playbookId ?? ''} onChange={(e) => set('playbookId', e.target.value || undefined)}>
              <option value="">No setup</option>
              {state.playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <div className="field">
            <span>Did you follow your plan?</span>
            <div className="side-toggle">
              <button type="button" className={t.followedPlan === true ? 'on pos' : ''} onClick={() => set('followedPlan', t.followedPlan === true ? undefined : true)}>Yes</button>
              <button type="button" className={t.followedPlan === false ? 'on neg' : ''} onClick={() => set('followedPlan', t.followedPlan === false ? undefined : false)}>No</button>
            </div>
          </div>
        </div>

        {playbook && playbook.rules.length > 0 && (
          <div className="rules-hint">
            <span className="muted small">{playbook.name} rules</span>
            <ul>{playbook.rules.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        )}

        <div className="grid-2">
          <div className="field">
            <span>Tags</span>
            <ChipInput value={t.tags} onChange={(v) => set('tags', v)} suggestions={allTags} placeholder="session, catalyst…" />
          </div>
          <div className="field">
            <span>Mistakes</span>
            <ChipInput value={t.mistakes} onChange={(v) => set('mistakes', v)} suggestions={allMistakes} placeholder="none, hopefully" />
          </div>
        </div>

        <label className="field">
          <span>Notes</span>
          <textarea rows={3} value={t.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Why did you take it? What did you see? How did you feel?" />
        </label>

        <div className="grid-2">
          <label className="field">
            <span>Chart link</span>
            <input type="url" value={t.screenshot ?? ''} onChange={(e) => set('screenshot', e.target.value || undefined)} placeholder="https://www.tradingview.com/x/…" />
          </label>
          <div className="field">
            <span>Execution</span>
            <Stars value={t.rating} onChange={(v) => set('rating', v)} />
          </div>
        </div>

        <footer className="form-actions">
          {trade && (
            <button type="button" className="btn danger ghost" onClick={() => { dispatch({ type: 'trade/delete', ids: [trade.id] }); onClose(); }}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!valid}>Save trade</button>
        </footer>
      </form>
    </Modal>
  );
}
