import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { computeStats } from '../lib/stats';
import { money, num, pct, rMult, tone, uid } from '../lib/format';
import { Modal } from '../components/ui';
import { PixelMeter } from '../components/Charts';
import { Icon } from '../pixel/Sprite';
import type { Playbook } from '../lib/types';

const COLORS = ['#7c6cff', '#22a3c4', '#e0a526', '#e8576b', '#3fb27f', '#c86bd6', '#8b8b99'];

function PlaybookForm({ pb, onClose }: { pb?: Playbook; onClose: () => void }) {
  const { dispatch } = useStore();
  const [p, setP] = useState<Playbook>(pb ?? { id: uid(), name: '', description: '', rules: [], color: COLORS[0] });
  const [rules, setRules] = useState((pb?.rules ?? []).join('\n'));
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'playbook/upsert', playbook: { ...p, name: p.name.trim(), rules: rules.split('\n').map((r) => r.trim()).filter(Boolean) } });
    onClose();
  };
  return (
    <Modal title={pb ? 'Edit playbook' : 'New playbook'} onClose={onClose}>
      <form onSubmit={save} className="trade-form">
        <label className="field"><span>Name</span><input required value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="Opening range breakout" /></label>
        <label className="field"><span>Description</span><textarea rows={2} value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} /></label>
        <label className="field"><span>Entry checklist — one rule per line</span><textarea rows={5} value={rules} onChange={(e) => setRules(e.target.value)} placeholder={'Trend aligned on HTF\nClear invalidation level\n≥ 2R to target'} /></label>
        <div className="field">
          <span>Colour</span>
          <div className="swatches">
            {COLORS.map((c) => (
              <button type="button" key={c} className={`swatch${p.color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setP({ ...p, color: c })} aria-label={c} />
            ))}
          </div>
        </div>
        <footer className="form-actions">
          {pb && <button type="button" className="btn danger ghost" onClick={() => { if (confirm('Delete this playbook? Trades keep their data but lose the setup link.')) { dispatch({ type: 'playbook/delete', id: pb.id }); onClose(); } }}>Delete</button>}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Save</button>
        </footer>
      </form>
    </Modal>
  );
}

export function Playbooks() {
  const { state } = useStore();
  const [editing, setEditing] = useState<Playbook | 'new' | null>(null);
  const stats = useMemo(
    () => new Map(state.playbooks.map((p) => [p.id, computeStats(state.trades.filter((t) => t.playbookId === p.id))])),
    [state.playbooks, state.trades],
  );

  return (
    <div className="page">
      <header className="page-head">
        <h1>Playbooks</h1>
        <button className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" size={10} /> New playbook</button>
      </header>
      <p className="muted">Define your setups once. Tag trades with them, and see which edges are real.</p>
      <div className="pb-grid">
        {state.playbooks.map((p) => {
          const s = stats.get(p.id)!;
          return (
            <button key={p.id} className="card pb-card" onClick={() => setEditing(p)} style={{ ['--pb' as string]: p.color }}>
              <div className="pb-head">
                <i className="dot" style={{ background: p.color }} />
                <b>{p.name}</b>
                <span className={`pb-net ${tone(s.net)}`}>{money(s.net, { sign: true, compact: true })}</span>
              </div>
              {p.description && <p className="small muted">{p.description}</p>}
              <div className="pb-stats">
                <div><span className="muted small">Trades</span><b>{s.count}</b></div>
                <div><span className="muted small">Win</span><b>{pct(s.winRate, 0)}</b></div>
                <div><span className="muted small">PF</span><b>{num(s.profitFactor)}</b></div>
                <div><span className="muted small">Avg R</span><b>{rMult(s.avgR)}</b></div>
              </div>
              <PixelMeter value={s.winRate} segments={20} tone={s.net >= 0 ? 'pos' : 'neg'} />
              {p.rules.length > 0 && (
                <ul className="pb-rules">
                  {p.rules.slice(0, 5).map((r) => <li key={r}>{r}</li>)}
                </ul>
              )}
            </button>
          );
        })}
      </div>
      {editing && <PlaybookForm pb={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
