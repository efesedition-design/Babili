import type { Side, Trade } from './types';
import { tradePnl, tradeR } from './stats';
import { uid } from './format';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const delim = detectDelimiter(text);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] || '';
  const counts = [',', ';', '\t'].map((d) => [d, first.split(d).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

const ALIASES: Record<string, string[]> = {
  symbol: ['symbol', 'ticker', 'instrument', 'pair', 'market', 'asset'],
  side: ['side', 'direction', 'type', 'position', 'long/short'],
  openedAt: ['openedat', 'opened', 'open time', 'opentime', 'entry time', 'entrytime', 'entry date', 'date', 'open date', 'time'],
  closedAt: ['closedat', 'closed', 'close time', 'closetime', 'exit time', 'exittime', 'exit date', 'close date'],
  entry: ['entry', 'entry price', 'entryprice', 'open price', 'openprice', 'buy price', 'avg entry'],
  exit: ['exit', 'exit price', 'exitprice', 'close price', 'closeprice', 'sell price', 'avg exit'],
  qty: ['qty', 'quantity', 'size', 'shares', 'contracts', 'amount', 'volume', 'lots'],
  fees: ['fees', 'fee', 'commission', 'commissions', 'costs'],
  stop: ['stop', 'stop loss', 'stoploss', 'sl', 'initial stop'],
  target: ['target', 'take profit', 'takeprofit', 'tp'],
  pnl: ['pnl', 'p&l', 'profit', 'net pnl', 'net p&l', 'realized pnl', 'realized p&l', 'result', 'net profit'],
  tags: ['tags', 'tag', 'labels'],
  notes: ['notes', 'note', 'comment', 'comments'],
  setup: ['setup', 'playbook', 'strategy'],
};

function normalise(h: string): string {
  return h.trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ');
}

export function mapHeaders(headers: string[]): Partial<Record<keyof typeof ALIASES, number>> {
  const out: Partial<Record<string, number>> = {};
  const norm = headers.map(normalise);
  for (const [field, aliases] of Object.entries(ALIASES)) {
    const idx = norm.findIndex((h) => aliases.includes(h) || aliases.includes(h.replace(/ /g, '')));
    if (idx >= 0) out[field] = idx;
  }
  return out;
}

function toNum(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const cleaned = v.replace(/[^0-9.\-eE,]/g, '');
  if (cleaned === '') return undefined;
  // "1.234,56" → 1234.56 ; "1,234.56" → 1234.56
  const normalised = /,\d{1,2}$/.test(cleaned) && cleaned.includes('.')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : /,\d{1,2}$/.test(cleaned) ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '');
  const n = parseFloat(normalised);
  return Number.isFinite(n) ? n : undefined;
}

function toSide(v: string | undefined): Side {
  const s = (v || '').trim().toLowerCase();
  return /^(short|sell|s|bear)/.test(s) ? 'short' : 'long';
}

function toIso(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = v.trim();
  if (/^\d{10,13}$/.test(s)) {
    const n = Number(s);
    return new Date(s.length === 10 ? n * 1000 : n).toISOString();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export interface ImportResult { trades: Trade[]; skipped: number; setupNames: string[] }

/**
 * Turn a CSV export (broker, exchange, spreadsheet, Babili backtest) into trades.
 * Header names are matched loosely; a P&L column is used when prices are missing.
 */
export function importTrades(text: string, resolveSetup: (name: string) => string | undefined = () => undefined): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return { trades: [], skipped: 0, setupNames: [] };
  const map = mapHeaders(rows[0]);
  const get = (r: string[], f: keyof typeof ALIASES) => (map[f] !== undefined ? r[map[f]!] : undefined);
  const trades: Trade[] = [];
  const setupNames = new Set<string>();
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const symbol = (get(r, 'symbol') || '').trim().toUpperCase();
    const openedAt = toIso(get(r, 'openedAt')) || toIso(get(r, 'closedAt'));
    const closedAt = toIso(get(r, 'closedAt')) || openedAt;
    const entry = toNum(get(r, 'entry'));
    const exit = toNum(get(r, 'exit'));
    const pnl = toNum(get(r, 'pnl'));
    if (!symbol || !openedAt || !closedAt || ((entry === undefined || exit === undefined) && pnl === undefined)) {
      skipped++;
      continue;
    }
    const setup = (get(r, 'setup') || '').trim();
    if (setup) setupNames.add(setup);
    const t: Trade = {
      id: uid(),
      symbol,
      side: toSide(get(r, 'side')),
      openedAt,
      closedAt,
      entry: entry ?? 0,
      exit: exit ?? 0,
      qty: Math.abs(toNum(get(r, 'qty')) ?? 1),
      fees: Math.abs(toNum(get(r, 'fees')) ?? 0),
      stop: toNum(get(r, 'stop')),
      target: toNum(get(r, 'target')),
      tags: (get(r, 'tags') || '').split(/[|;,]/).map((x) => x.trim()).filter(Boolean),
      mistakes: [],
      notes: (get(r, 'notes') || '').trim(),
      playbookId: setup ? resolveSetup(setup) : undefined,
    };
    if (entry === undefined || exit === undefined) t.pnlOverride = pnl;
    trades.push(t);
  }
  return { trades, skipped, setupNames: [...setupNames] };
}

function esc(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportTrades(trades: Trade[], setupName: (id?: string) => string = () => ''): string {
  const head = ['symbol', 'side', 'opened_at', 'closed_at', 'entry', 'exit', 'qty', 'fees', 'stop', 'target', 'pnl', 'r', 'setup', 'tags', 'mistakes', 'rating', 'followed_plan', 'notes'];
  const lines = trades.map((t) => [
    t.symbol, t.side, t.openedAt, t.closedAt, t.entry, t.exit, t.qty, t.fees, t.stop, t.target,
    tradePnl(t).toFixed(2), tradeR(t)?.toFixed(3), setupName(t.playbookId), t.tags.join('|'), t.mistakes.join('|'),
    t.rating, t.followedPlan === undefined ? '' : t.followedPlan ? 'yes' : 'no', t.notes,
  ].map(esc).join(','));
  return [head.join(','), ...lines].join('\n');
}
