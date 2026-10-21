export type Side = 'long' | 'short';

export interface Trade {
  id: string;
  symbol: string;
  side: Side;
  /** ISO timestamp the position was opened. */
  openedAt: string;
  /** ISO timestamp the position was closed. */
  closedAt: string;
  entry: number;
  exit: number;
  qty: number;
  fees: number;
  /** Initial stop, used to express the result in R. */
  stop?: number;
  target?: number;
  /** Manual P&L (net of fees) — overrides the price-based calculation, e.g. for CSV imports with only a P&L column. */
  pnlOverride?: number;
  playbookId?: string;
  tags: string[];
  mistakes: string[];
  notes: string;
  /** Self-graded execution quality, 1–5. */
  rating?: number;
  followedPlan?: boolean;
  screenshot?: string;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  rules: string[];
  color: string;
}

export interface DayNote {
  /** YYYY-MM-DD */
  date: string;
  plan: string;
  review: string;
  /** 1 (rough) – 5 (great) */
  mood?: number;
}

export type CompanionId = 'mochi' | 'pip' | 'bolt' | 'boo';
export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  name: string;
  currency: string;
  companion: CompanionId;
  theme: Theme;
  /** Max loss per day you allow yourself; 0 disables the guard. */
  dailyLossLimit: number;
}

export interface JournalState {
  version: 1;
  trades: Trade[];
  playbooks: Playbook[];
  notes: Record<string, DayNote>;
  settings: Settings;
}
