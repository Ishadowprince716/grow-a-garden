# 🌱 Grow-a-Garden Pro

Cozy browser farming game. Professional layout: frontend / backend / database / shared — all wired together.

## Structure

```
grow-a-garden/
├── frontend/            # Presentation layer (GitHub Pages deploy root)
│   ├── index.html       # markup — HUD, garden grid, toolbar
│   ├── css/style.css    # all styles
│   └── js/
│       ├── data.js      # crops, weather, constants
│       ├── sfx.js       # Web Audio synthesized sounds
│       ├── api.js       # backend client (localStorage fallback)
│       └── game.js      # state, actions, weather, render loop
├── backend/             # Node.js API server
│   ├── server.js        # plain-http API + static file server
│   └── package.json     # better-sqlite3
├── database/            # SQLite persistence
│   ├── schema.sql       # source-of-truth schema (players, plots)
│   └── garden.db        # created at runtime by backend
├── shared/              # code used by both sides
│   ├── state.js         # state shape + validator
│   └── state.test.js    # node:test suite
└── .github/workflows/   # CI: tests + Pages deploy
```

## How the layers connect

- **frontend → backend**: `js/api.js` GETs/POSTs game state at `/api/state?player=<id>`. When the backend serves the page over http, every save syncs to the server; the localStorage mirror always stays as offline fallback.
- **backend → database**: `backend/server.js` auto-creates `database/garden.db` (schema: `players`, `plots`) via better-sqlite3.
- **No backend? Still playable.** On GitHub Pages the API client detects there is no backend and the game runs fully on localStorage — zero behavior change.

## Play

**[Play live on GitHub Pages →](https://ishadowprince716.github.io/grow-a-garden/)**

**Full stack locally:**

```bash
cd backend
npm install
npm start          # -> http://localhost:3000 (serves frontend + API)
```

**Tests:**

```bash
node --test shared/state.test.js
```

## Features

- **20 plots** — first 8 free, unlock the rest with coins (price scales)
- **8 crops** — carrot → dragon fruit, unlocked by level (1–10)
- **4 tools** — hoe, seed, water (2× growth), harvest
- **Weather system** — sunny / rain (auto-water + 2× growth) / heat wave (dry penalty) / storm (lightning can destroy crops)
- **XP & levels** — sell crops to gain XP, unlock better seeds
- **Offline growth** — crops keep growing while you're away (timestamp-based)
- **Sound effects** — synthesized with Web Audio API, zero asset files
- **Save/Load** — automatic: localStorage always + server sync when backend is running

## Gameplay loop

1. Select 🌱 Seed tool → pick a crop → click a plot
2. 💧 Water to double growth speed (rain does it for free)
3. Wait for the timer, then ✋ harvest into your basket
4. Sell the basket → coins + XP → level up → unlock rare crops and more plots
5. Watch out for ⛈️ storms

## Tech

- Vanilla JS, CSS grid, Web Audio API, localStorage
- Backend: plain Node http, better-sqlite3
- No build step, no frameworks

## License

MIT
