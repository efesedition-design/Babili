import { useRef, useState } from 'react';
import { emptyState, normaliseState, useStore } from '../lib/store';
import { companionXp, levelFromXp } from '../lib/companion';
import { CHARACTERS } from '../pixel/sprites';
import { CompanionSprite } from '../pixel/Sprite';
import { Card, Segmented, download } from '../components/ui';
import type { CompanionId, Theme } from '../lib/types';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY', 'JPY', 'AUD', 'CAD', 'CHF', 'USDT'];

export function Settings({ onLoadDemo }: { onLoadDemo: () => void }) {
  const { state, dispatch } = useStore();
  const s = state.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const lvl = levelFromXp(companionXp(state));

  const restore = async (f: File) => {
    try {
      const parsed = JSON.parse(await f.text());
      dispatch({ type: 'replace', state: normaliseState(parsed) });
      setMsg('Backup restored.');
    } catch {
      setMsg('That file is not a valid Babili backup.');
    }
  };

  return (
    <div className="page">
      <header className="page-head"><h1>Settings</h1></header>
      {msg && <div className="notice" onClick={() => setMsg('')}>{msg}</div>}

      <Card title="Companion">
        <p className="muted small">Your companion reacts to your sessions and levels up as you journal (LV {lvl.level}).</p>
        <div className="companion-pick">
          {(Object.keys(CHARACTERS) as CompanionId[]).map((id) => (
            <button key={id} className={s.companion === id ? 'on' : ''} onClick={() => dispatch({ type: 'settings', patch: { companion: id } })}>
              <CompanionSprite id={id} mood={s.companion === id ? 'happy' : 'neutral'} size={64} animate={s.companion === id} />
              <b className="pixel">{CHARACTERS[id].name}</b>
              <span className="small muted">{CHARACTERS[id].blurb}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Preferences">
        <div className="grid-2">
          <label className="field"><span>Your name</span><input value={s.name} onChange={(e) => dispatch({ type: 'settings', patch: { name: e.target.value } })} placeholder="Optional" /></label>
          <label className="field">
            <span>Currency</span>
            <select value={s.currency} onChange={(e) => dispatch({ type: 'settings', patch: { currency: e.target.value } })}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Daily loss limit (0 = off)</span>
            <input type="number" min={0} step="any" value={s.dailyLossLimit} onChange={(e) => dispatch({ type: 'settings', patch: { dailyLossLimit: Math.max(0, Number(e.target.value) || 0) } })} />
          </label>
          <div className="field">
            <span>Theme</span>
            <Segmented<Theme> value={s.theme} onChange={(v) => dispatch({ type: 'settings', patch: { theme: v } })} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
          </div>
        </div>
      </Card>

      <Card title="Data">
        <p className="muted small">Everything lives in this browser’s local storage. Export a backup regularly — clearing site data deletes your journal.</p>
        <div className="row gap wrap">
          <button className="btn" onClick={() => download(`babili-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), 'application/json')}>Download backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ''; }} />
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>Restore backup</button>
          <button className="btn ghost" onClick={onLoadDemo}>Load demo data</button>
          <button
            className="btn danger ghost"
            onClick={() => { if (confirm('Delete all trades, notes and playbooks? This cannot be undone.')) dispatch({ type: 'replace', state: { ...emptyState(), settings: s } }); }}
          >
            Erase everything
          </button>
        </div>
      </Card>
    </div>
  );
}
