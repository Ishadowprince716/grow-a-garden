# 🌱 Grow-a-Garden Pro

A cozy browser farming game. Single-file HTML — no build step, no dependencies, no server.

## Play

**[Play live on GitHub Pages →](https://ishadowprince716.github.io/grow-a-garden/)**

Or open `index.html` directly in any browser.

## Features

- **20 plots** — first 8 free, unlock the rest with coins (price scales)
- **8 crops** — carrot → dragon fruit, unlocked by level (1–10)
- **4 tools** — hoe, seed, water (2× growth), harvest
- **Weather system** — sunny / rain (auto-water + 2× growth) / heat wave (dry penalty) / storm (lightning can destroy crops)
- **XP & levels** — sell crops to gain XP, unlock better seeds
- **Offline growth** — crops keep growing while you're away (timestamp-based)
- **Sound effects** — synthesized with Web Audio API, zero asset files
- **Save/Load** — automatic, via `localStorage`
- **Reset** — "reset save" link at the bottom

## Gameplay loop

1. Select 🌱 Seed tool → pick a crop → click a plot
2. 💧 Water to double growth speed (rain does it for free)
3. Wait for the timer, then ✋ harvest into your basket
4. Sell the basket → coins + XP → level up → unlock rare crops and more plots
5. Watch out for ⛈️ storms

## Tech

- One self-contained `index.html` (~13 KB)
- Vanilla JS, CSS grid, Web Audio API, localStorage
- No build step, no frameworks, no external requests

## Deploy history

- Local file: double-click `index.html`
- GitHub Pages: this repo (Settings → Pages → main branch / root)

## License

MIT
