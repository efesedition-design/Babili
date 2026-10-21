import type { CompanionId } from '../lib/types';

/**
 * Sprites are 16×16 character grids. Each character maps to a palette entry;
 * '.' is transparent. Faces are composed on top of the base from mood overlays,
 * so every companion gets every mood without redrawing it.
 */
export type Grid = string[];
export type Palette = Record<string, string>;

export type Mood = 'happy' | 'neutral' | 'sad' | 'sleep' | 'fire' | 'focus';

interface Character {
  name: string;
  blurb: string;
  base: Grid;
  palette: Palette;
  /** Top-left of the left eye (row, col). The right eye mirrors it. */
  eye: [number, number];
  /** Top-left of the 4×2 mouth. */
  mouth: [number, number];
}

const OUTLINE = '#1d1b26';

export const CHARACTERS: Record<CompanionId, Character> = {
  mochi: {
    name: 'Mochi',
    blurb: 'A patient cat. Waits for the A+ setup.',
    base: [
      '................',
      '..kk........kk..',
      '..kpk......kpk..',
      '..kbpk....kpbk..',
      '..kbbbkkkkbbbk..',
      '.kbbbbbbbbbbbbk.',
      '.kbbbbbbbbbbbbk.',
      'kbbbbbbbbbbbbbbk',
      'kbbbbbbbbbbbbbbk',
      'kbbpbbbbbbbbpbbk',
      'kbbbbbbbbbbbbbbk',
      '.kbbbbbbbbbbbbk.',
      '.ksbbbbbbbbbbsk.',
      '..kbbkbbbbkbbk..',
      '..kkk.kkkk.kkk..',
      '................',
    ],
    palette: { k: OUTLINE, b: '#f4a259', s: '#d9823b', p: '#f7b5b5' },
    eye: [7, 3],
    mouth: [9, 6],
  },
  pip: {
    name: 'Pip',
    blurb: 'A calm frog. Sits on hands between trades.',
    base: [
      '................',
      '..kkkk....kkkk..',
      '.kwwwwk..kwwwwk.',
      '.kwwwwkkkkwwwwk.',
      '.kbbbbbbbbbbbbk.',
      'kbbbbbbbbbbbbbbk',
      'kbbbbbbbbbbbbbbk',
      'kbbbbbbbbbbbbbbk',
      'kbpbbbbbbbbbbpbk',
      'kbbbbbbbbbbbbbbk',
      '.kbbbbbbbbbbbbk.',
      '.ksbbbbbbbbbbsk.',
      '..kssbbbbbbssk..',
      '.kbbkkkkkkkkbbk.',
      '.kkkk......kkkk.',
      '................',
    ],
    palette: { k: OUTLINE, b: '#7bc96f', s: '#58a64d', p: '#f7b5b5', w: '#f2f2ee' },
    eye: [2, 2],
    mouth: [7, 6],
  },
  bolt: {
    name: 'Bolt',
    blurb: 'A systematic robot. Runs the checklist every time.',
    base: [
      '.......kk.......',
      '......kaak......',
      '...kkkkkkkkkk...',
      '..kbbbbbbbbbbk..',
      '..kbllllllllbk..',
      '..kbllllllllbk..',
      '..kbllllllllbk..',
      '..kbllllllllbk..',
      '..kbllllllllbk..',
      '..kbbbbbbbbbbk..',
      '..ksbbbbbbbbsk..',
      '...kkkkkkkkkk...',
      '....kbbbbbbk....',
      '...kbsbbbbsbk...',
      '...kkkkkkkkkk...',
      '................',
    ],
    palette: { k: OUTLINE, b: '#a7b4c8', s: '#7f8ca3', l: '#d8f5e4', a: '#ff6b6b' },
    eye: [5, 4],
    mouth: [7, 6],
  },
  boo: {
    name: 'Boo',
    blurb: 'A quiet ghost. Haunts revenge trades away.',
    base: [
      '................',
      '.....kkkkkk.....',
      '...kkbbbbbbkk...',
      '..kbbbbbbbbbbk..',
      '.kbbbbbbbbbbbbk.',
      '.kbbbbbbbbbbbbk.',
      '.kbbbbbbbbbbbbk.',
      '.kbbbbbbbbbbbbk.',
      '.kbpbbbbbbbbpbk.',
      '.kbbbbbbbbbbbbk.',
      '.kbbbbbbbbbbbbk.',
      '.kbbbbbbbbbbbbk.',
      '.ksbbbbbbbbbbsk.',
      '.kbbbkbbbbkbbbk.',
      '.kbk.kbkkbk.kbk.',
      '..k...k..k...k..',
    ],
    palette: { k: OUTLINE, b: '#ecebff', s: '#c9c6f2', p: '#f7b5b5' },
    eye: [6, 3],
    mouth: [9, 6],
  },
};

// '_' keeps whatever the base has at that pixel.
const EYES: Record<string, Grid> = {
  open: ['_k_', '_k_'],
  happy: ['_k_', 'k_k'],
  closed: ['___', 'kkk'],
  sad: ['kk_', '__k'],
  focus: ['kkk', '_k_'],
};

const MOUTHS: Record<string, Grid> = {
  smile: ['k__k', '_kk_'],
  grin: ['kkkk', '_rr_'],
  flat: ['____', '_kk_'],
  frown: ['_kk_', 'k__k'],
  tiny: ['____', '_k__'],
};

const MOOD_FACE: Record<Mood, { eyes: string; mouth: string }> = {
  happy: { eyes: 'happy', mouth: 'smile' },
  fire: { eyes: 'happy', mouth: 'grin' },
  neutral: { eyes: 'open', mouth: 'flat' },
  focus: { eyes: 'focus', mouth: 'flat' },
  sad: { eyes: 'sad', mouth: 'frown' },
  sleep: { eyes: 'closed', mouth: 'tiny' },
};

const SHARED: Palette = { r: '#e8576b', t: '#5fb8ff', f: '#ffb02e', y: '#ffe066' };

function stamp(grid: string[][], over: Grid, row: number, col: number, mirror = false) {
  over.forEach((line, r) => {
    const chars = mirror ? [...line].reverse() : [...line];
    chars.forEach((c, i) => {
      const y = row + r, x = col + i;
      if (c !== '_' && grid[y] && grid[y][x] !== undefined) grid[y][x] = c;
    });
  });
}

export function composeCompanion(id: CompanionId, mood: Mood, blink = false): { grid: Grid; palette: Palette } {
  const ch = CHARACTERS[id];
  const g = ch.base.map((row) => [...row]);
  const face = MOOD_FACE[mood];
  const eyes = EYES[blink && mood !== 'sleep' ? 'closed' : face.eyes];
  const [er, ec] = ch.eye;
  const width = g[0].length;
  stamp(g, eyes, er, ec);
  stamp(g, eyes, er, width - ec - eyes[0].length, true);
  stamp(g, MOUTHS[face.mouth], ch.mouth[0], ch.mouth[1]);
  if (mood === 'sad') {
    // a single tear under the left eye
    const y = er + 2, x = ec;
    if (g[y]?.[x] && g[y][x] !== '.' && g[y][x] !== 'k') g[y][x] = 't';
  }
  return { grid: g.map((r) => r.join('')), palette: { ...SHARED, ...ch.palette } };
}

/** Tiny 7×7 one-colour icons; 'k' renders as currentColor. */
export const ICONS: Record<string, Grid> = {
  dashboard: ['kkk.kkk', 'k.k.k.k', 'kkk.kkk', '.......', 'kkk.kkk', 'k.k.k.k', 'kkk.kkk'],
  trades: ['k.kkkkk', '.......', 'k.kkkkk', '.......', 'k.kkkkk', '.......', 'k.kkk..'],
  calendar: ['.k...k.', 'kkkkkkk', 'k.....k', 'kkkkkkk', 'k.k.k.k', 'k.....k', 'kkkkkkk'],
  reports: ['.....k.', '.....k.', '...k.k.', '...k.k.', '.k.k.k.', '.k.k.k.', 'kkkkkkk'],
  playbooks: ['kkkkk..', 'kkkkkkk', 'kkkkkk.', 'kkkkkkk', 'k......', 'k......', 'k......'],
  journal: ['.....kk', '....k.k', '...k.k.', '..k.k..', '.k.k...', 'kkk....', 'kk.....'],
  settings: ['..k.k..', '.kkkkk.', 'kkk.kkk', 'kk...kk', 'kkk.kkk', '.kkkkk.', '..k.k..'],
  plus: ['...k...', '...k...', '...k...', 'kkkkkkk', '...k...', '...k...', '...k...'],
  close: ['k.....k', '.k...k.', '..k.k..', '...k...', '..k.k..', '.k...k.', 'k.....k'],
  left: ['....k..', '...k...', '..k....', '.k.....', '..k....', '...k...', '....k..'],
  right: ['..k....', '...k...', '....k..', '.....k.', '....k..', '...k...', '..k....'],
  upload: ['...k...', '..kkk..', '.k.k.k.', '...k...', '...k...', '.......', 'kkkkkkk'],
  download: ['...k...', '...k...', '.k.k.k.', '..kkk..', '...k...', '.......', 'kkkkkkk'],
  trash: ['..kkk..', 'kkkkkkk', '.k...k.', '.k.k.k.', '.k.k.k.', '.k...k.', '.kkkkk.'],
  star: ['...k...', '..kkk..', 'kkkkkkk', '.kkkkk.', '..kkk..', '.kk.kk.', '.k...k.'],
  heart: ['.kk.kk.', 'kkkkkkk', 'kkkkkkk', 'kkkkkkk', '.kkkkk.', '..kkk..', '...k...'],
  flame: ['...k...', '..kk...', '..kkk.k', '.kkkkkk', 'kkk.kkk', 'kk...kk', '.kkkkk.'],
  shield: ['kkkkkkk', 'k.....k', 'k..k..k', 'k.kkk.k', '.k.k.k.', '..k.k..', '...k...'],
  coin: ['..kkk..', '.k...k.', 'k..k..k', 'k.kkk.k', 'k..k..k', '.k...k.', '..kkk..'],
};
