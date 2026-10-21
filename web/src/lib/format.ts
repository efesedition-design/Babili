let currency = 'USD';

export function setCurrency(c: string) {
  currency = c || 'USD';
}

export function money(v: number, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const abs = Math.abs(v);
  let s: string;
  try {
    const nf = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      notation: opts.compact && abs >= 10000 ? 'compact' : 'standard',
      maximumFractionDigits: opts.compact ? (abs >= 10000 ? 1 : 0) : 2,
      minimumFractionDigits: opts.compact ? 0 : 2,
    });
    s = nf.format(abs);
  } catch {
    s = abs.toFixed(2);
  }
  if (v < 0) return `-${s}`;
  return opts.sign && v > 0 ? `+${s}` : s;
}

export function pct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}

export function num(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return '∞';
  return v.toFixed(digits);
}

export function rMult(v: number | undefined): string {
  if (v === undefined) return '—';
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}R`;
}

export function duration(min: number): string {
  if (min < 1) return '<1m';
  if (min < 60) return `${Math.round(min)}m`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
  return `${(min / 60 / 24).toFixed(1)}d`;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function tone(v: number): 'pos' | 'neg' | 'flat' {
  return v > 0 ? 'pos' : v < 0 ? 'neg' : 'flat';
}

/** `<input type="datetime-local">` value from an ISO string, in local time. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function fromLocalInput(v: string): string {
  return new Date(v).toISOString();
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
