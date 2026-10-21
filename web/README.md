# Babili Journal

A minimal, local-first trading journal with pixel-art companions. It's inspired by Tradezella, but it rewards your *process* and not just your P&L.

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (stats, CSV import/export, sprites, demo data)
npm run build    # static build in dist/, which you can host anywhere
```

## What's inside

- **Dashboard**: net P&L, win rate, profit factor, expectancy, average win/loss, max drawdown, an equity curve, daily P&L and recent trades, with 7D/30D/90D/All ranges.
- **Babili score**: a 0–100 score built from win rate, profit factor, win/loss size, drawdown control, green days and plan adherence.
- **Companion**: choose Mochi, Pip, Bolt or Boo. Their mood follows your sessions (sleeping, happy, on fire after a win streak, focused after you break the plan, sad on red days). They earn XP when you journal, tag setups and follow your plan. P&L doesn't earn XP.
- **Trades**: search, filter, sort, bulk delete, CSV import (columns are matched loosely, so most broker exports work) and CSV export. Results are shown in R when a stop is recorded.
- **Calendar**: a monthly heatmap with weekly totals. Click a day to see its trades and its journal entry.
- **Journal**: a pre-market plan, a post-session review and a mood picker for each day.
- **Reports**: plan vs. no-plan expectancy, cost of each mistake, R distribution, and breakdowns by playbook, symbol, weekday, hour, side, tag, mistake, hold time and plan adherence.
- **Playbooks**: your setups with an entry checklist. The checklist is shown while you log a trade. Three SMC playbooks matching the Python strategy come preloaded.
- **Daily loss limit guard**, light/dark/system themes, JSON backup and restore, demo data, and the `N` shortcut for a new trade.

All data stays in your browser's `localStorage`, with no account and no server. Download a backup from Settings regularly.

## Code map

```
src/lib/stats.ts      P&L, R, aggregate stats, grouping, Babili score
src/lib/csv.ts        CSV parse, import with header aliases, export
src/lib/companion.ts  companion mood + XP/levels
src/lib/store.tsx     reducer + localStorage persistence
src/pixel/sprites.ts  16×16 companions (faces composed per mood) + 7×7 icons
src/pixel/Sprite.tsx  crisp SVG pixel renderer, blinking/bobbing companion
src/components/       charts (hand-rolled SVG), trade form, UI primitives
src/pages/            Dashboard, Trades, Calendar, Journal, Reports, Playbooks, Settings
```
