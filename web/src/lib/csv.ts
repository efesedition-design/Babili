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
  // Aliases are matched after normalise(): lowercase, no accents, no punctuation.
  // Turkish names cover spreadsheets exported from Excel with a Turkish locale.
  symbol: ['symbol', 'ticker', 'instrument', 'pair', 'market', 'asset', 'contract', 'sembol', 'parite', 'enstruman'],
  side: ['side', 'direction', 'type', 'position side', 'position', 'long short', 'yon', 'islem yonu', 'pozisyon'],
  openedAt: ['openedat', 'opened', 'open time', 'opentime', 'entry time', 'entrytime', 'entry date', 'open date', 'date', 'time', 'acilis', 'acilis zamani', 'acilis tarihi', 'giris zamani', 'giris tarihi', 'tarih'],
  closedAt: ['closedat', 'closed', 'close time', 'closetime', 'exit time', 'exittime', 'exit date', 'close date', 'kapanis', 'kapanis zamani', 'kapanis tarihi', 'cikis zamani', 'cikis tarihi'],
  entry: ['entry', 'entry price', 'entryprice', 'open price', 'openprice', 'buy price', 'avg entry', 'avg entry price', 'average entry price', 'avg open price', 'giris', 'giris fiyati', 'acilis fiyati', 'alis fiyati'],
  exit: ['exit', 'exit price', 'exitprice', 'close price', 'closeprice', 'sell price', 'avg exit', 'avg exit price', 'avg close price', 'average close price', 'cikis', 'cikis fiyati', 'kapanis fiyati', 'satis fiyati'],
  qty: ['qty', 'quantity', 'size', 'shares', 'contracts', 'closed vol', 'closed volume', 'close vol', 'volume', 'lots', 'amount', 'miktar', 'adet', 'lot', 'hacim', 'buyukluk'],
  fees: ['fees', 'fee', 'commission', 'commissions', 'costs', 'trading fee', 'komisyon', 'ucret'],
  stop: ['stop', 'stop loss', 'stoploss', 'sl', 's l', 'initial stop', 'zarar durdur'],
  target: ['target', 'take profit', 'takeprofit', 'tp', 't p', 'hedef', 'kar al'],
  pnl: ['pnl', 'p&l', 'p l', 'profit', 'net pnl', 'net p&l', 'realized pnl', 'realized p&l', 'realized profit', 'closing pnl', 'closed pnl', 'result', 'net profit', 'kar zarar', 'kar', 'net kar', 'sonuc'],
  tags: ['tags', 'tag', 'labels', 'etiket', 'etiketler'],
  notes: ['notes', 'note', 'comment', 'comments', 'not', 'notlar', 'aciklama', 'yorum'],
  setup: ['setup', 'playbook', 'strategy', 'strateji', 'kurulum'],
  price: ['price', 'fill price', 'avg price', 'average price', 'execution price', 'fiyat'],
};

export function normalise(h: string): string {
  return h
    .replace(/^\ufeff/, '')
    .replace(/\(.*?\)/g, ' ')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-/.:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mapHeaders(headers: string[]): Partial<Record<keyof typeof ALIASES, number>> {
  const out: Partial<Record<string, number>> = {};
  const norm = headers.map(normalise);
  const used = new Set<number>();
  const find = (aliases: string[], from = 0) =>
    norm.findIndex((h, i) => i >= from && !used.has(i) && (aliases.includes(h) || aliases.includes(h.replace(/ /g, ''))));
  // Prefer the earliest alias in each list, so "position side" beats a generic "position" column.
  for (const [field, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      const idx = find([alias]);
      if (idx >= 0) { out[field] = idx; used.add(idx); break; }
    }
  }
  // MetaTrader-style reports repeat "Time" and "Price": the second one is the close.
  if (out.closedAt === undefined && out.openedAt !== undefined) {
    const dup = norm.indexOf(norm[out.openedAt], out.openedAt + 1);
    if (dup >= 0 && !used.has(dup)) { out.closedAt = dup; used.add(dup); }
  }
  if (out.entry === undefined && out.exit === undefined && out.price !== undefined) {
    const dup = norm.indexOf(norm[out.price], out.price + 1);
    if (dup >= 0 && !used.has(dup)) { out.entry = out.price; out.exit = dup; delete out.price; used.add(dup); }
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
  const s = normalise(v || '');
  return /^(short|sell|s\b|bear|sat|kisa)/.test(s) ? 'short' : 'long';
}

function toIso(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = v.trim();
  if (/^\d{10,13}$/.test(s)) {
    const n = Number(s);
    return new Date(s.length === 10 ? n * 1000 : n).toISOString();
  }
  // Day-first dates: 21.10.2026 14:30, 21/10/2026, 2024.05.01 10:00:00 (MetaTrader).
  const dm = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dm && (s.includes('.') || Number(dm[1]) > 12)) {
    const [, d, m, y, hh = '0', mm = '0', ss = '0'] = dm;
    return new Date(+y, +m - 1, +d, +hh, +mm, +ss).toISOString();
  }
  const ym = s.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (ym) {
    const [, y, m, d, hh = '0', mm = '0', ss = '0'] = ym;
    return new Date(+y, +m - 1, +d, +hh, +mm, +ss).toISOString();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export interface ImportResult {
  trades: Trade[];
  skipped: number;
  setupNames: string[];
  /** Why nothing could be imported, in words a person can act on. */
  problem?: string;
}

const FIELD_LABEL: Record<string, string> = { symbol: 'symbol', openedAt: 'date/time', entry: 'entry price', exit: 'exit price', pnl: 'P&L' };

/**
 * Turn a CSV export (broker, exchange, spreadsheet, Babili backtest) into trades.
 * Header names are matched loosely; a P&L column is used when prices are missing.
 */
export function importTrades(text: string, resolveSetup: (name: string) => string | undefined = () => undefined): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return { trades: [], skipped: 0, setupNames: [], problem: 'The file has no data rows.' };
  const map = mapHeaders(rows[0]);
  const hasPrices = map.entry !== undefined && map.exit !== undefined;
  if (map.price !== undefined && !hasPrices) {
    return { trades: [], skipped: rows.length - 1, setupNames: [], problem: 'This looks like a fill-by-fill trade history. Export closed positions instead (on Binance Futures: Orders → Position History).' };
  }
  const missing = ['symbol', 'openedAt'].filter((f) => map[f] === undefined && !(f === 'openedAt' && map.closedAt !== undefined));
  if (!hasPrices && map.pnl === undefined) missing.push(map.entry === undefined ? 'entry' : 'exit', 'pnl');
  if (missing.length) {
    const found = rows[0].map((h) => h.replace(/^\ufeff/, '').trim()).filter(Boolean).join(', ');
    return {
      trades: [], skipped: rows.length - 1, setupNames: [],
      problem: `Couldn't find a column for ${missing.map((f) => FIELD_LABEL[f] ?? f).join(' / ')}. Columns in your file: ${found}.`,
    };
  }
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
