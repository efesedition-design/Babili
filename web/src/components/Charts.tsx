import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { money, shortDate } from '../lib/format';

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceTicks(min: number, max: number, n = 4): number[] {
  if (min === max) { min -= 1; max += 1; }
  const step0 = (max - min) / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
  const out: number[] = [];
  const end = Math.ceil(max / step - 1e-9) * step;
  for (let v = Math.floor(min / step + 1e-9) * step; v <= end + step / 2; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

function Tip({ x, y, children, width }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 60), width - 60);
  return <div className="chart-tip" style={{ left, top: y }}>{children}</div>;
}

interface EquityProps { points: { t: string; v: number }[]; height?: number }

export function EquityChart({ points, height = 220 }: EquityProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 56, r: 12, t: 12, b: 24 };
  const data = [{ t: points[0]?.t ?? '', v: 0 }, ...points];
  const vals = data.map((d) => d.v);
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals));
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const iw = Math.max(1, width - pad.l - pad.r), ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (data.length > 1 ? (i / (data.length - 1)) * iw : iw / 2);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * ih;
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.v).toFixed(1)}`).join('');
  const area = `${line}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const last = vals[vals.length - 1] ?? 0;
  const color = last >= 0 ? 'var(--pos)' : 'var(--neg)';

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - pad.l) / iw) * (data.length - 1));
    setHover(i >= 1 && i < data.length ? i : null);
  };

  return (
    <div ref={ref} className="chart">
      {width > 0 && (
        <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="eq-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.18" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis zero' : 'axis'} />
              <text x={pad.l - 8} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">{money(t, { compact: true })}</text>
            </g>
          ))}
          <path d={area} fill="url(#eq-fill)" />
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
          {data.length > 2 && (
            <>
              <text x={pad.l} y={height - 6} className="tick">{shortDate(data[1].t)}</text>
              <text x={width - pad.r} y={height - 6} className="tick" textAnchor="end">{shortDate(data[data.length - 1].t)}</text>
            </>
          )}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="crosshair" />
              <rect x={x(hover) - 3} y={y(data[hover].v) - 3} width={6} height={6} fill={color} />
            </g>
          )}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <Tip x={x(hover)} y={y(data[hover].v) - 12} width={width}>
          <b>{money(data[hover].v, { sign: true })}</b>
          <span>trade {hover} · {shortDate(data[hover].t)}</span>
        </Tip>
      )}
    </div>
  );
}

interface BarsProps {
  bars: { label: string; value: number; sub?: string; tone?: 'pos' | 'neg' }[];
  height?: number;
  format?: (v: number) => string;
  axis?: (v: number) => string;
}

export function BarChart({ bars, height = 180, format = (v) => money(v, { sign: true }), axis = (v) => money(v, { compact: true }) }: BarsProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 56, r: 8, t: 10, b: 22 };
  const vals = bars.map((b) => b.value);
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals));
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const iw = Math.max(1, width - pad.l - pad.r), ih = height - pad.t - pad.b;
  const slot = iw / Math.max(1, bars.length);
  const bw = Math.max(2, Math.min(28, slot * 0.7));
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * ih;
  const labelEvery = Math.ceil(bars.length / Math.max(1, Math.floor(iw / 48)));

  return (
    <div ref={ref} className="chart">
      {width > 0 && (
        <svg width={width} height={height} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis zero' : 'axis'} />
              <text x={pad.l - 8} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">{axis(t)}</text>
            </g>
          ))}
          {bars.map((b, i) => {
            const cx = pad.l + slot * i + slot / 2;
            const top = y(Math.max(0, b.value)), bot = y(Math.min(0, b.value));
            return (
              <g key={i} onMouseEnter={() => setHover(i)}>
                <rect x={pad.l + slot * i} y={pad.t} width={slot} height={ih} fill="transparent" />
                <rect
                  x={cx - bw / 2}
                  y={top}
                  width={bw}
                  height={Math.max(1, bot - top)}
                  className={`bar ${b.tone ?? (b.value >= 0 ? 'pos' : 'neg')}`}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
                {i % labelEvery === 0 && (
                  <text x={cx} y={height - 6} className="tick" textAnchor="middle">{b.label}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <Tip x={pad.l + slot * hover + slot / 2} y={y(Math.max(0, bars[hover].value)) - 12} width={width}>
          <b>{format(bars[hover].value)}</b>
          <span>{bars[hover].sub ?? bars[hover].label}</span>
        </Tip>
      )}
    </div>
  );
}

interface HBarsProps { rows: { label: string; value: number; meta?: string; color?: string }[]; format?: (v: number) => string }

export function HBars({ rows, format = (v) => money(v, { sign: true }) }: HBarsProps) {
  const max = Math.max(1e-9, ...rows.map((r) => Math.abs(r.value)));
  if (!rows.length) return <p className="muted small">Nothing to show yet.</p>;
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar" key={r.label}>
          <div className="hbar-label">
            {r.color && <i className="dot" style={{ background: r.color }} />}
            <span title={r.label}>{r.label}</span>
          </div>
          <div className="hbar-track">
            <div className="hbar-mid" />
            <div
              className={`hbar-fill ${r.value >= 0 ? 'pos' : 'neg'}`}
              style={{ width: `${(Math.abs(r.value) / max) * 50}%`, [r.value >= 0 ? 'left' : 'right']: '50%' }}
            />
          </div>
          <div className={`hbar-value ${r.value > 0 ? 'pos' : r.value < 0 ? 'neg' : ''}`}>{format(r.value)}</div>
          {r.meta && <div className="hbar-meta">{r.meta}</div>}
        </div>
      ))}
    </div>
  );
}

/** A pixel-segmented meter, 0–1. */
export function PixelMeter({ value, segments = 10, tone = 'accent' }: { value: number; segments?: number; tone?: 'accent' | 'pos' | 'neg' }) {
  const on = Math.round(Math.max(0, Math.min(1, value)) * segments);
  return (
    <span className={`pmeter ${tone}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      {Array.from({ length: segments }, (_, i) => <i key={i} className={i < on ? 'on' : ''} />)}
    </span>
  );
}
