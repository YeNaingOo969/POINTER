# POINTER (formerly YangonGo)

A cinematic, map-based city guide to Yangon — find real places to visit by category,
get routes, save places, collect Food Passport stamps and read reviews.

School group project (Group 1). This repository is the **frontend**: static UI with mock data.
The PHP backend is built separately; see [HANDOFF.md](HANDOFF.md) for what it needs to provide.

## Run it on your own computer

**Once:** install [Node.js](https://nodejs.org) LTS (version 22 or newer). On Windows you can
also run `winget install OpenJS.NodeJS.LTS` in a terminal.

**Every time:**

- **Windows:** open the `frontend` folder and double-click **`start-windows.bat`**.
- **Mac / Linux:** open a terminal in the `frontend` folder and run `npm start`.

The first run installs the packages (about a minute, needs internet). Then the site opens in
your default browser at http://localhost:5173. Keep the black window open while you use the
site; close it to stop. After a `git pull` just start it again — new packages are installed
automatically when needed.

Good to know:

- The demo account is `demo@pointer.test` / `pointer-demo`. Everything you do (log in, save,
  check in, review) is kept in your own browser only.
- The map needs internet (map tiles). Routes are straight-line previews unless you put a free
  OpenRouteService key in `.env` (copy `.env.example`).
- To open the site on your phone on the same Wi-Fi: `npm start -- --host`, then open the
  "Network" address it prints.

For developers: `npm run dev` (dev server without opening a browser), `npm run build`.

## Structure

```
index.html, explore.html, ...   one HTML file per page
src/pages/        entry script for each page
src/components/   reusable UI pieces
src/map/          MapLibre setup, pastel style, markers, routes, 3D layer
src/scene/        WebGL hero (Three.js) and performance helpers
src/api/          the only place that fetches data (mock now, PHP later)
src/data/         all mock data, one file per entity
src/i18n/         UI text (English)
src/state/        simulated session, saved places, passport (localStorage)
src/lib/          small utilities
src/styles/       tokens.css (colors, fonts), base.css, component and page styles
public/           optimised assets served as-is
assets/raw/       original source files (never edited)
scripts/          asset pipeline scripts
docs/             decision log, kickoff brief, prompts
```
