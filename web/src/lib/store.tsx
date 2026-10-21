import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { DayNote, JournalState, Playbook, Settings, Trade } from './types';
import { DEFAULT_PLAYBOOKS } from './demo';
import { setCurrency } from './format';

const KEY = 'babili-journal:v1';

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  currency: 'USD',
  companion: 'mochi',
  theme: 'system',
  dailyLossLimit: 0,
};

export function emptyState(): JournalState {
  return { version: 1, trades: [], playbooks: DEFAULT_PLAYBOOKS, notes: {}, settings: DEFAULT_SETTINGS };
}

export function loadState(): JournalState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    return normaliseState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export function normaliseState(s: Partial<JournalState>): JournalState {
  return {
    version: 1,
    trades: Array.isArray(s.trades) ? s.trades.map((t) => ({ ...t, tags: t.tags || [], mistakes: t.mistakes || [], notes: t.notes || '' })) : [],
    playbooks: Array.isArray(s.playbooks) ? s.playbooks : DEFAULT_PLAYBOOKS,
    notes: s.notes && typeof s.notes === 'object' ? s.notes : {},
    settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) },
  };
}

export type Action =
  | { type: 'trade/upsert'; trade: Trade }
  | { type: 'trade/add-many'; trades: Trade[] }
  | { type: 'trade/delete'; ids: string[] }
  | { type: 'playbook/upsert'; playbook: Playbook }
  | { type: 'playbook/delete'; id: string }
  | { type: 'note/upsert'; note: DayNote }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'replace'; state: JournalState };

export function reducer(s: JournalState, a: Action): JournalState {
  switch (a.type) {
    case 'trade/upsert': {
      const exists = s.trades.some((t) => t.id === a.trade.id);
      return { ...s, trades: exists ? s.trades.map((t) => (t.id === a.trade.id ? a.trade : t)) : [...s.trades, a.trade] };
    }
    case 'trade/add-many':
      return { ...s, trades: [...s.trades, ...a.trades] };
    case 'trade/delete': {
      const ids = new Set(a.ids);
      return { ...s, trades: s.trades.filter((t) => !ids.has(t.id)) };
    }
    case 'playbook/upsert': {
      const exists = s.playbooks.some((p) => p.id === a.playbook.id);
      return { ...s, playbooks: exists ? s.playbooks.map((p) => (p.id === a.playbook.id ? a.playbook : p)) : [...s.playbooks, a.playbook] };
    }
    case 'playbook/delete':
      return {
        ...s,
        playbooks: s.playbooks.filter((p) => p.id !== a.id),
        trades: s.trades.map((t) => (t.playbookId === a.id ? { ...t, playbookId: undefined } : t)),
      };
    case 'note/upsert':
      return { ...s, notes: { ...s.notes, [a.note.date]: a.note } };
    case 'settings':
      return { ...s, settings: { ...s.settings, ...a.patch } };
    case 'replace':
      return a.state;
  }
}

interface Ctx { state: JournalState; dispatch: (a: Action) => void }
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  setCurrency(state.settings.currency);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable — keep working in memory */
    }
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    if (state.settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', state.settings.theme);
  }, [state.settings.theme]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}
