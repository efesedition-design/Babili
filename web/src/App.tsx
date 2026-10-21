import { useCallback, useEffect, useState } from 'react';
import { useStore } from './lib/store';
import { demoData } from './lib/demo';
import { Dashboard } from './pages/Dashboard';
import { Trades } from './pages/Trades';
import { Calendar } from './pages/Calendar';
import { Reports } from './pages/Reports';
import { Playbooks } from './pages/Playbooks';
import { Journal } from './pages/Journal';
import { Settings } from './pages/Settings';
import { TradeForm } from './components/TradeForm';
import { CompanionSprite, Icon } from './pixel/Sprite';
import { companionMood } from './lib/companion';
import type { Trade } from './lib/types';

const PAGES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'trades', label: 'Trades' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'journal', label: 'Journal' },
  { id: 'reports', label: 'Reports' },
  { id: 'playbooks', label: 'Playbooks' },
  { id: 'settings', label: 'Settings' },
] as const;
type PageId = (typeof PAGES)[number]['id'];

function readHash(): PageId {
  const h = window.location.hash.replace('#/', '');
  return (PAGES.find((p) => p.id === h)?.id ?? 'dashboard') as PageId;
}

export function App() {
  const { state, dispatch } = useStore();
  const [page, setPage] = useState<PageId>(readHash);
  const [editing, setEditing] = useState<Trade | 'new' | null>(null);

  useEffect(() => {
    const on = () => setPage(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (editing || /input|textarea|select/i.test(target.tagName)) return;
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setEditing('new'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  const go = (id: PageId) => { window.location.hash = `/${id}`; setPage(id); };
  const openTrade = useCallback((t: Trade) => setEditing(t), []);
  const newTrade = useCallback(() => setEditing('new'), []);
  const loadDemo = useCallback(() => {
    const d = demoData();
    const existing = new Set(state.trades.map((t) => t.id));
    dispatch({ type: 'trade/add-many', trades: d.trades.filter((t) => !existing.has(t.id)) });
    for (const n of Object.values(d.notes)) if (!state.notes[n.date]) dispatch({ type: 'note/upsert', note: n });
  }, [state.trades, state.notes, dispatch]);

  const mood = companionMood(state).mood;

  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <div className="brand">
          <CompanionSprite id={state.settings.companion} mood={mood} size={28} />
          <span className="pixel">babili</span>
        </div>
        {PAGES.map((p) => (
          <a
            key={p.id}
            href={`#/${p.id}`}
            className={`nav-item${page === p.id ? ' on' : ''}`}
            onClick={(e) => { e.preventDefault(); go(p.id); }}
            aria-current={page === p.id ? 'page' : undefined}
          >
            <Icon name={p.id} size={14} />
            <span>{p.label}</span>
          </a>
        ))}
        <button className="btn primary nav-new" onClick={newTrade} title="Shortcut: N">
          <Icon name="plus" size={10} /> <span>New trade</span>
        </button>
      </nav>

      <main className="main">
        {page === 'dashboard' && <Dashboard onNewTrade={newTrade} onOpenTrade={openTrade} onLoadDemo={loadDemo} />}
        {page === 'trades' && <Trades onOpenTrade={openTrade} onNewTrade={newTrade} />}
        {page === 'calendar' && <Calendar onOpenTrade={openTrade} />}
        {page === 'journal' && <Journal onOpenTrade={openTrade} />}
        {page === 'reports' && <Reports />}
        {page === 'playbooks' && <Playbooks />}
        {page === 'settings' && <Settings onLoadDemo={loadDemo} />}
      </main>

      {editing && <TradeForm key={editing === 'new' ? 'new' : editing.id} trade={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
