import { describe, expect, it } from 'vitest';
import { CHARACTERS, composeCompanion, ICONS, type Mood } from './sprites';
import type { CompanionId } from '../lib/types';

describe('sprites', () => {
  it('every companion is a 16×16 grid in every mood, with a palette entry per pixel', () => {
    const moods: Mood[] = ['happy', 'neutral', 'sad', 'sleep', 'fire', 'focus'];
    for (const id of Object.keys(CHARACTERS) as CompanionId[]) {
      for (const m of moods) {
        const { grid, palette } = composeCompanion(id, m);
        expect(grid).toHaveLength(16);
        for (const row of grid) {
          expect(row).toHaveLength(16);
          for (const c of row) if (c !== '.') expect(palette[c], `${id}/${m} '${c}'`).toBeDefined();
        }
      }
    }
  });
  it('icons are 7×7', () => {
    for (const [name, g] of Object.entries(ICONS)) {
      expect(g, name).toHaveLength(7);
      for (const r of g) expect(r, name).toHaveLength(7);
    }
  });
});
