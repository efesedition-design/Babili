import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../pixel/Sprite';

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={12} /></button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          {title && <h3>{title}</h3>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, tone, hint, children }: { label: string; value: ReactNode; tone?: 'pos' | 'neg' | 'flat'; hint?: string; children?: ReactNode }) {
  return (
    <div className="kpi" title={hint}>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone ?? ''}`}>{value}</div>
      {children}
    </div>
  );
}

/** Free-text chip input; Enter or comma commits a chip. */
export function ChipInput({ value, onChange, suggestions = [], placeholder }: { value: string[]; onChange: (v: string[]) => void; suggestions?: string[]; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const v = raw.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft('');
  };
  const open = suggestions.filter((s) => !value.includes(s) && s.toLowerCase().includes(draft.toLowerCase())).slice(0, 6);
  return (
    <div className="chips-input">
      <div className="chips">
        {value.map((v) => (
          <button type="button" key={v} className="chip" onClick={() => onChange(value.filter((x) => x !== v))} title="Remove">
            {v} <span aria-hidden>×</span>
          </button>
        ))}
        <input
          value={draft}
          placeholder={value.length ? '' : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); }
            else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => draft && add(draft)}
        />
      </div>
      {open.length > 0 && (
        <div className="chip-suggest">
          {open.map((s) => (
            <button type="button" key={s} className="chip ghost" onMouseDown={(e) => { e.preventDefault(); add(s); }}>+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Stars({ value, onChange }: { value?: number; onChange?: (v: number | undefined) => void }) {
  return (
    <span className="stars" role={onChange ? 'radiogroup' : undefined} aria-label="Execution rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          className={`star${value && n <= value ? ' on' : ''}`}
          disabled={!onChange}
          onClick={() => onChange?.(value === n ? undefined : n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Icon name="star" size={12} />
        </button>
      ))}
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function download(name: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
