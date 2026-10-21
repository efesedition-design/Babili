import { useMemo } from 'react';
import { useStore } from '../lib/store';
import { companionMood, companionXp, levelFromXp } from '../lib/companion';
import { CHARACTERS } from '../pixel/sprites';
import { CompanionSprite } from '../pixel/Sprite';
import { PixelMeter } from './Charts';

export function CompanionCard() {
  const { state } = useStore();
  const id = state.settings.companion;
  const view = useMemo(() => companionMood(state), [state]);
  const lvl = levelFromXp(companionXp(state));
  return (
    <section className="card companion-card">
      <CompanionSprite id={id} mood={view.mood} size={88} />
      <div className="companion-body">
        <div className="companion-name">
          <span className="pixel">{CHARACTERS[id].name}</span>
          <span className="pixel lvl">LV {lvl.level}</span>
        </div>
        <p className="bubble">{view.line}</p>
        <div className="xp">
          <PixelMeter value={lvl.into / lvl.span} segments={16} />
          <span className="muted small">{lvl.into}/{lvl.span} XP · earned by journaling, not by P&amp;L</span>
        </div>
      </div>
    </section>
  );
}
