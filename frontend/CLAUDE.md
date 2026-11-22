# POINTER (formerly YangonGo) — project brief for Claude

Cinematic, map-based city guide for Yangon (school group project, Group 1). Not a game, not open-world:
a Google-Maps-like guide to real places, presented with cinematic, playful visuals.

This folder is the **frontend** of the shared team repo. The repo root also contains the PHP backend
(`api/`, `config/`, `include/`, `pages/`, `sql/`, `database/`, `uploads/`) owned by the backend teammates.

The original brief is in [docs/kickoff-brief.md](docs/kickoff-brief.md). Decisions made since then are
logged in [docs/decisions.md](docs/decisions.md) and **override the brief** where they differ.

## Working rules

- Reply to the user (Win Thant Aung, project leader, sole frontend dev) in **Burmese**; keep code, commands,
  paths and technical terms in English. Notion content is English only.
- **Ask one question at a time**, with 2–3 options, a recommendation and the reason. Never treat an
  undiscussed choice as decided. Criticise weak ideas politely, with reasons.
- Summarise what you'll do before writing code; after each part, say what changed and which files.
- Small commits with plain English messages. **Do not push** until the user says so (local git only by default).
- Install packages only when the current milestone needs them, one at a time, after saying what and why.

## Scope

- Frontend UI with **mock data** by default (`USE_MOCK = true`). The PHP backend already exists in the
  team repo; only switch `USE_MOCK` to `false` when the user asks to run against it.
- Do **not** write backend code, database schema or server logic — two backend teammates own that.
- Login, reviews, check-ins, posts etc. are simulated in the UI (localStorage at most), never really saved
  while `USE_MOCK` is true.
- All data goes through `src/api/` (mock now, PHP JSON endpoints later). All mock data lives in `src/data/`.
- Keep `HANDOFF.md` up to date after every milestone (pages, form fields, data shapes, actions → backend
  behaviour, role permissions).

## Stack

- Vite + plain HTML/CSS/JS (ES modules, no framework), multi-page.
- Map: MapLibre GL with our own pastel style on OpenStreetMap vector tiles; 3D building kit via Three.js
  `InstancedMesh` (later). Routing: OpenRouteService (key in `.env`), mock routes until then.
  "Open in Google Maps" deep link. No live traffic layer.
- Landing: no 3D — cinematic scroll story with GSAP + ScrollTrigger + Lenis (decided 2026-11-04).
- Professional, modular code style (not the user's older repos).

## Design

- Hybrid: **golden-hour cinematic landing** → **pastel 3D map/app pages**, linked by Shwedagon gold.
  Map look reference: `D:\design-refs\refs\001-yangon-social-map-ui.webp` (adapted to places, not friends).
- Tokens live in `src/styles/tokens.css`. Fonts: Fraunces (SOFT 100, headlines) + Onest (UI);
  Noto Sans Myanmar for Burmese.
- Never use gold `#E8B04A` as text on light backgrounds — use `--gold-deep`.
- Name and logo (2026-11-04, chosen by the team): **POINTER**, tagline "Explore · Discover · Enjoy";
  logo = gold stupa in an open arc with a four-point star, serif wordmark, on dark
  (`assets/raw/images/brand/pointer-logo-team.png`). The old YangonGo mascot pin is retired.
  **Don't invent or hand-draw new logos or illustrations in SVG code** — the user rejected that;
  generate with FLUX (`npm run gen:image`) and review every draft.
- Place/detail pages use real photos only (never AI images). Respect `prefers-reduced-motion`.
- **Assets:** prefer free-licence internet resources (icons, photos, 3D models, Lottie) edited with our
  tools over code-drawn graphics. Commercial-use licences only; ask the user (per batch: file, source,
  licence, size) before downloading; originals in `assets/raw/`; record every asset in `docs/credits.md`.
- Performance budget: AMD Radeon 610M + ~5.8 GB RAM. Cap pixel ratio, pause offscreen, dispose Three.js
  resources, stop dev servers when done.

## Pages (approved)

`index.html` landing · `explore.html` map · `place.html` detail · `login.html` · `account.html` (My account) ·
`business.html` (Add your business; owner tools in phase 2) · `home.html` (phase 2) · `admin.html` and
`admin/` portal · `deals.html` · `messages.html` · `owner.html`. Roles: visitor (view only), user, admin.
Business owners are normal users.

## Build order (approved)

M0 setup → M1 explore map → M2 3D asset kit → M3 place detail → M4 landing → M5 other pages →
M6 avatars → M7 polish (i18n, responsive, performance, handoff).

## Team repo notes (added 2026-11-22)

- Work in `frontend/`. Vite runs from `frontend/`; PHP dev server runs from the repo root
  (`php -S localhost:8000`) so `/api/*.php` and `/uploads` share one origin with the page.
- `config/db.example.php` → `config/db.php` (git-ignored). XAMPP MariaDB uses port **3306**.
- `database/pointer.sql` + seeds create `pointer_db`.
- The admin portal uses its own black/gold CDN-based theme and inline i18n, added by the backend team.
  Aligning it with `src/styles/tokens.css` is a M7 polish item.
