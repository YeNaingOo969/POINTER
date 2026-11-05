# POINTER (formerly YangonGo)

A cinematic, map-based city guide to Yangon — find real places to visit, by category or by mood,
collect Food Passport stamps and see live crowd reports.

School group project (Group 1). This repository is the **frontend**: static UI with mock data.
The PHP backend is built separately; see [HANDOFF.md](HANDOFF.md) for what it needs to provide.

## Run

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Structure

```
index.html, explore.html, ...   one HTML file per page
src/pages/        entry script for each page
src/components/   reusable UI pieces
src/map/          MapLibre setup, pastel style, markers, routes, 3D layer
src/scene/        WebGL hero (Three.js) and performance helpers
src/api/          the only place that fetches data (mock now, PHP later)
src/data/         all mock data, one file per entity
src/i18n/         English / Burmese strings
src/state/        simulated session, saved places, passport (localStorage)
src/lib/          small utilities
src/styles/       tokens.css (colors, fonts), base.css, component and page styles
public/           optimised assets served as-is
assets/raw/       original source files (never edited)
scripts/          asset pipeline scripts
docs/             decision log, kickoff brief, prompts
```
