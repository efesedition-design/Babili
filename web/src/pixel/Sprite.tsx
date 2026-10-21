import { useEffect, useMemo, useState } from 'react';
import type { CompanionId } from '../lib/types';
import { composeCompanion, ICONS, type Grid, type Mood, type Palette } from './sprites';

interface PixelProps {
  grid: Grid;
  palette?: Palette;
  size?: number;
  className?: string;
  title?: string;
}

/** Renders a character grid as merged horizontal runs of crisp SVG rects. */
export function Pixels({ grid, palette = {}, size = 16, className, title }: PixelProps) {
  const rects = useMemo(() => {
    const out: JSX.Element[] = [];
    grid.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        const c = row[x];
        let w = 1;
        while (row[x + w] === c) w++;
        if (c !== '.') {
          out.push(<rect key={`${x}-${y}`} x={x} y={y} width={w} height={1} fill={palette[c] ?? 'currentColor'} />);
        }
        x += w;
      }
    });
    return out;
  }, [grid, palette]);
  const w = grid[0]?.length ?? 0;
  const h = grid.length;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={(size * h) / w}
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {rects}
    </svg>
  );
}

export function Icon({ name, size = 14 }: { name: keyof typeof ICONS | string; size?: number }) {
  const grid = ICONS[name];
  if (!grid) return null;
  return <Pixels grid={grid} size={size} className="icon" />;
}

interface CompanionProps {
  id: CompanionId;
  mood: Mood;
  size?: number;
  animate?: boolean;
}

export function CompanionSprite({ id, mood, size = 96, animate = true }: CompanionProps) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (!animate || mood === 'sleep') return;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 140);
        loop();
      }, 2200 + Math.random() * 2600);
    };
    loop();
    return () => window.clearTimeout(t);
  }, [animate, mood]);

  const { grid, palette } = useMemo(() => composeCompanion(id, mood, blink), [id, mood, blink]);
  return (
    <span className={`companion mood-${mood}${animate ? ' animate' : ''}`} style={{ width: size, height: size }}>
      <Pixels grid={grid} palette={palette} size={size} title={`${id} feeling ${mood}`} />
      {mood === 'sleep' && <span className="zzz" aria-hidden>z</span>}
      {mood === 'fire' && (
        <span className="sparks" aria-hidden>
          <Icon name="star" size={Math.round(size / 8)} />
          <Icon name="star" size={Math.round(size / 10)} />
        </span>
      )}
    </span>
  );
}
