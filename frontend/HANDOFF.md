# POINTER (formerly YangonGo) — backend handoff

For the two backend developers. This file says what the frontend expects from the PHP backend.
It is updated after every frontend milestone. **Status: M1 map (search, place card, routes, YBS stops) done; M2 3D city and 20 landmarks done;
M3 place detail done; M4 landing done; renamed POINTER. Next: M5 login / passport / business / admin.**

## How the frontend talks to the backend

- Every request goes through [src/api/api.js](src/api/api.js). Nothing else in the frontend fetches data.
- While `USE_MOCK = true` in [src/api/config.js](src/api/config.js), functions return mock data from
  [src/data/](src/data/). When your endpoints are ready, set `USE_MOCK = false` and `API_BASE` to your
  PHP folder (default `/api`).
- Requests and responses are **JSON**, UTF-8. Burmese text must be stored and returned as UTF-8
  (MariaDB: `utf8mb4` tables and connection).
- Dates are ISO 8601 strings with the Yangon offset, e.g. `2026-11-10T17:20:00+06:30`.
- Errors: return a non-2xx status with `{ "error": "message" }`.

## Data shapes

Each file in `src/data/` is one entity and shows the exact JSON shape the frontend expects.
Bilingual text that admins enter (place name, address, description…) is an object `{ "en": "...", "my": "..." }`.
MariaDB 10.1 has no JSON column type, so store these as two columns (`name_en`, `name_my`) and build the
object when you return it. Text users write (reviews, promotion posts) is a plain string.

## Roles

| Role | Can |
|---|---|
| Visitor (not logged in) | View pages only. Clicking a user action opens the login modal. |
| User | Everything a visitor can, plus review, rate, check in, report crowd level, save places, report posts, create a business page and post promotions for it. |
| Admin | Everything a user can, plus the admin dashboard: see reports, remove posts and reviews. |

A business owner is a normal user who created a business page — not a separate role.
Promotion posts go live without approval; reported posts appear in the admin queue.

## Pages

| Page | File | Status |
|---|---|---|
| Landing | `index.html` | done (M4): logo intro, cinematic scroll story with illustrated Yangon scenes — static, no backend data |
| Explore map | `explore.html` | map, place bubbles, 3D city, search, place card and routes working; filters still to come |
| Place detail | `place.html?id=<slug>` | 3D map hero, hours, facts, reviews (read + write), save, check-in, crowd report — actions simulated with a demo login |
| Login / register | `login.html` | not started (M5) |
| My passport | `passport.html` | not started (M5) |
| Business page | `business.html` | not started (M5) |
| Admin dashboard | `admin.html` | not started (M5) |

## Endpoints

### `GET /api/places.php` → `Place[]`

Used by: Explore map (`explore.html`): one bubble per place, the search box and the place card.
Shape: see [src/data/places.js](src/data/places.js). Fields the frontend uses right now:

| Field | Type | Notes |
|---|---|---|
| `id` | int | primary key |
| `slug` | string | unique, URL-safe (`place.html?id=<slug>` later) |
| `name` | `{ en, my }` | bubble, search and card (both languages are searched and shown) |
| `location` | `{ lat, lng }` | decimal degrees (WGS84); also the Google Maps directions link |
| `township` | `{ en, my }` | card header, search |
| `address` | `{ en, my }` | card, search |
| `description` | `{ en, my }` | card, one or two sentences |
| `openingHours` | `[{ days, open, close }]` | `days` = `mon-sun`, `mon-sat`, `tue-sun`… or one day (`mon`); times `HH:MM` in Yangon time; a `close` before `open` runs past midnight. **Empty list = hours unknown** (card hides them); use `mon-sun 00:00–24:00` for always open |
| `entryFee` | `{ local, foreigner, currency }` or `null` | `0` = free; `null` hides the row |
| `rating` | `{ average, count }` | card chip |
| `crowd` | `{ level, reportedAt, reports }` or `null` | `level` is `low` / `medium` / `high`; latest crowd report |
| `tags` | string[] | searched too |
| `isFeatured` | bool | featured places keep their name visible when the map is zoomed out |

Search runs in the browser over this list (it is small). If the list grows into the hundreds,
add `GET /api/places.php?q=<text>` returning the same shape, best matches first (name starts with
the text, then a word in the name, then township/address/tags), at most 8; the UI won't change.
Other mock fields (`photos`, `priceLevel`, `contact`, …) are for the detail page.

### `GET /api/places.php?slug=<slug>` → `Place`

One place, same shape. Return `404` with `{ "error": "Place not found" }` if the slug doesn't exist.

### Routes (frontend now; optional PHP proxy later)

The place card has "Route here": pick a start (my location or another place) and Walk / Car,
and the map draws the line with distance, time and steps. `getRoute(from, to, mode)` in
[src/api/api.js](src/api/api.js) returns `{ mode, source, distance (m), duration (s),
coordinates: [[lng, lat]…], steps: [{ instruction, distance, duration }] }`.

- With `VITE_ORS_API_KEY` in `.env` (free key from https://account.heigit.org → Tokens) it calls OpenRouteService
  directly from the browser at `https://api.heigit.org/openrouteservice/v2/directions` (`foot-walking`,
  `driving-car`); the old `api.openrouteservice.org` host is being shut down.
- Without a key it returns a straight-line preview (dashed line, labelled as an estimate).
- Optional for the backend: `GET /api/route.php?from=lng,lat&to=lng,lat&mode=walk|car` that
  forwards to OpenRouteService with the key kept on the server and returns the same shape. Then
  switch `getRoute` to `request('route.php', …)`. Nothing is saved; no database table needed.

### Place detail page: session, reviews, saves, check-ins, crowd reports

Used by `place.html?id=<slug>`. All functions are in [src/api/api.js](src/api/api.js); while
`USE_MOCK` is true they are simulated in the browser (localStorage key `yg.demo`, never sent
anywhere). Writes need a logged-in user: return `401 { "error": "Login required" }` otherwise —
the page then shows its "Log in to continue" dialog.

| Function | Endpoint | Request → response |
|---|---|---|
| `getSession()` | `GET /api/session.php` | → `{ user: { id, name, role: 'user' \| 'admin' } }` or `{ user: null }` |
| `logout()` | `POST /api/logout.php` | → `{ user: null }` (login itself comes with `login.html`, M5) |
| `getReviews(placeId)` | `GET /api/reviews.php?place_id=1` | → `Review[]`, newest first |
| `addReview(placeId, { rating, text })` | `POST /api/reviews.php` `{ placeId, rating, text }` | → the new `Review` |
| `getMyPlace(placeId)` | `GET /api/my-place.php?place_id=1` | → `{ saved: bool, checkedInAt: ISO \| null }` (visitor: `false`, `null`) |
| `setSaved(placeId, saved)` | `POST /api/saves.php` `{ placeId }` / `DELETE /api/saves.php?place_id=1` | → `{ saved }` |
| `checkIn(placeId)` | `POST /api/checkins.php` `{ placeId }` | → `{ checkedInAt }` |
| `reportCrowd(placeId, level)` | `POST /api/crowd-reports.php` `{ placeId, level: 'low' \| 'medium' \| 'high' }` | → the place's new `crowd` `{ level, reportedAt, reports }` |

**Review shape (proposed — please confirm with the frontend before building the table):**
`{ id, placeId, user: { id, name }, rating: 1–5, text, createdAt }`; `text` is the user's own
words (plain string, any language, max 600 chars; escape it when you output HTML). Mock data:
[src/data/reviews.js](src/data/reviews.js). `place.rating` (`{ average, count }`) should be
recalculated from reviews. Check-in rules for the Food Passport (how a visit is verified) are
still open — for now one check-in per user per place.

_Still to come (after the team agrees categories and moods): categories, moods, auth pages._

## Map (frontend only — no backend work)

The map style is ours ([src/map/style.js](src/map/style.js)) on OpenStreetMap vector tiles from
OpenFreeMap (free, no key). Nothing to build on the backend for the map itself; only the place data
above. Coordinates for new places can be checked on https://www.openstreetmap.org.

The cute 3D city ([src/map/city-3d.js](src/map/city-3d.js), models in `public/models/kit/`) is also
frontend-only. It keeps a small circle around every place's `location` free of buildings (wider for
`isFeatured` places), so correct coordinates matter. 3D landmarks (Shwedagon, Sule, City Hall,
Karaweik, Dala Bridge, Bogyoke Market, Strand Hotel, Secretariat, towers, malls, hotels, airport) are listed in `src/map/config.js`
(`LANDMARKS`); a place within a landmark's grounds gets its bubble lifted above the model.
YBS bus stops come straight from the OpenStreetMap tiles ([src/map/bus-stops.js](src/map/bus-stops.js)),
so no bus-stop table is needed unless the team wants YBS line numbers per stop later.
