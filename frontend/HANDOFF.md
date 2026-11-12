# POINTER — backend handoff

For the two backend developers. This file says what the frontend expects from the PHP backend.
It is updated after every frontend milestone. **Status: landing, explore map (search, place card,
routes, YBS stops, 3D city), place detail, login and My Passport are done and run on mock data.
Next: business page, admin dashboard.**

## How the frontend talks to the backend

- Every request goes through [src/api/api.js](src/api/api.js). Nothing else in the frontend fetches data.
- While `USE_MOCK = true` in [src/api/config.js](src/api/config.js), functions return mock data from
  [src/data/](src/data/). When your endpoints are ready, set `USE_MOCK = false` (on your own machine
  to test) and keep `API_BASE` as `/api`.
- Requests and responses are **JSON**, UTF-8 (MariaDB: `utf8mb4` tables and connection).
- Dates are ISO 8601 strings with the Yangon offset, e.g. `2026-11-10T17:20:00+06:30`.
- Errors: return a non-2xx status with `{ "error": "message" }`.
- The site is in English. Place names and addresses are shown exactly as stored in the database.

## Backend tasks

Two self-contained tasks, one per backend developer, with every endpoint, validation rule and a
"done when" checklist:

- [docs/tasks/backend-1-auth-places.md](docs/tasks/backend-1-auth-places.md) — session, register,
  login, logout, places list and place detail.
- [docs/tasks/backend-2-passport.md](docs/tasks/backend-2-passport.md) — saves, check-ins, reviews
  and My Passport.

Local setup: run PHP from the repo root with `php -S localhost:8000`; `npm run dev` forwards every
`/api/...` request to it (see `vite.config.js`), so page and API share one origin and the session
cookie works. Every POST / DELETE sends the CSRF token from `session.php` in an `X-CSRF-Token` header.

## Database

The team's own schema (dbdiagram, 13 tables): `users`, `categories`, `places`, `place_images`,
`operating_hours`, `reviews`, `favourites`, `history`, `promotions`, `user_redeems`, `place_posts`,
`messages`, `audit_logs`. The frontend uses them like this:

| Frontend | Table |
|---|---|
| Places, the map, search, place card / page | `places` + `categories` + `operating_hours` + `place_images`; rating from `reviews` |
| Log in / register / session | `users` (`password_hash`, `role` = `user` or `admin`) |
| Reviews | `reviews` (`comment` is the review text) |
| Save button, saved places | `favourites` |
| Check in, Food Passport stamps | `history` (`visited_at` is the check-in time) |
| Business page, admin (later) | `place_posts`, `promotions`, `audit_logs` |
| Not used by the frontend yet | `messages`, `user_redeems` |

## Roles

| Role | Can |
|---|---|
| Visitor (not logged in) | View pages only. Clicking a user action opens the "Log in to continue" dialog. |
| User | Everything a visitor can, plus review, rate, check in, save places, create a business page and post for it. |
| Admin | Everything a user can, plus the admin dashboard: remove posts and reviews. |

A business owner is a normal user who owns a place (`places.owner_id`) — not a separate role.

## Pages

| Page | File | Status |
|---|---|---|
| Landing | `index.html` | done (v2, 2026-11-12): 10-section scroll story — what POINTER is, map, 7 categories, reviews, deals + tickets, for shop owners, Free vs Premium, why free. Static, no backend data |
| Explore map | `explore.html` | done: map, place bubbles (open / closed now), 3D city, search, place card, routes, YBS stops |
| Place detail | `place.html?id=<id>` | done: 3D map hero, opening hours, address, YBS lines, facilities, reviews (read + write), save, check-in |
| Login / register | `login.html` | done: log in, create account, validation, `?next=` return |
| My passport | `passport.html` | done: saved places, check-in stamps, my reviews (unsave / delete) |
| Business page | `business.html` | not started |
| Admin dashboard | `admin.html` | not started |

## Endpoints

### `GET /api/places.php` → `Place[]` · `GET /api/places.php?id=1` → `Place`

Used by the explore map (bubbles, search, card) and the place page. Only `status = 'active'`
places. A missing id returns `404 { "error": "Place not found" }`. Mock data:
[src/data/places.js](src/data/places.js) + [src/data/categories.js](src/data/categories.js).

| Field | Type | From |
|---|---|---|
| `id` | int | `places.id` (also the URL: `place.html?id=1`) |
| `name` | string | `places.name` |
| `category` | `{ id, name, icon }` or `null` | join `categories` on `places.category_id` |
| `ownerId` | int or `null` | `places.owner_id` |
| `address` | string | `places.address` |
| `location` | `{ lat, lng }` (numbers) | `places.latitude`, `places.longitude` |
| `ybsLines` | string[] | `places.ybs_lines`, comma-separated text → array (`[]` when empty) |
| `facilities` | string[] | `places.facilities`, comma-separated text → array |
| `openingHours` | `[{ days, open, close }]` | `operating_hours` rows grouped: days with the same times become a range (`mon-fri`), a single day stays `mon`; times `HH:MM`; a `close` before `open` runs past midnight. **No rows → `[]`** (hours unknown) |
| `photos` | `[{ url }]` | `place_images.image_url` (real photos only) |
| `rating` | `{ average, count }` | `AVG(rating)` rounded to 1 decimal and `COUNT(*)` from `reviews` |

Search runs in the browser over this list (name, address, category). The places with the most
reviews keep their name visible when the map is zoomed out — the frontend decides that.

### Accounts, reviews, saves, check-ins, My Passport

All functions are in [src/api/api.js](src/api/api.js); while `USE_MOCK` is true they are
simulated in the browser (localStorage key `yg.demo`). Writes and the `my-*` endpoints need a
logged-in user: return `401 { "error": "Login required" }` otherwise — the page then shows its
"Log in to continue" dialog. `PlaceSummary` = `{ id, name, address, category }`.

| Function | Endpoint | Request → response |
|---|---|---|
| `getSession()` | `GET /api/session.php` | → `{ user: { id, name, role: 'user' \| 'admin' } \| null, csrfToken }` |
| `register(…)` | `POST /api/register.php` `{ name, email, password }` | → `201 { user }` · 409 email taken · 422 invalid |
| `login(…)` | `POST /api/login.php` `{ email, password }` | → `{ user }` · 401 wrong email or password |
| `logout()` | `POST /api/logout.php` | → `{ user: null }` |
| `getReviews(placeId)` | `GET /api/reviews.php?place_id=1` | → `Review[]`, newest first |
| `addReview(placeId, { rating, text })` | `POST /api/reviews.php` `{ placeId, rating, text }` | → `201 Review` · 409 already reviewed |
| `deleteReview(id)` | `DELETE /api/reviews.php?id=12` | → `{ deleted: true }` · 403 not your review |
| `getMyPlace(placeId)` | `GET /api/my-place.php?place_id=1` | → `{ saved: bool, checkedInAt: ISO \| null }` (visitor: `false`, `null`) |
| `setSaved(placeId, saved)` | `POST /api/saves.php` `{ placeId }` / `DELETE /api/saves.php?place_id=1` | → `{ saved }` |
| `checkIn(placeId)` | `POST /api/checkins.php` `{ placeId }` | → `{ checkedInAt }` |
| `getMySaves()` | `GET /api/my-saves.php` | → `[{ place: PlaceSummary }]`, newest first |
| `getMyCheckIns()` | `GET /api/my-checkins.php` | → `[{ place: PlaceSummary, checkedInAt }]`, newest first |
| `getMyReviews()` | `GET /api/my-reviews.php` | → `[Review & { place: PlaceSummary }]`, newest first |

**Review shape:** `{ id, placeId, user: { id, name }, rating: 1–5, text, createdAt }` — `text` is
`reviews.comment`, the user's own words (max 600 chars; escape it when you output HTML). Mock data:
[src/data/reviews.js](src/data/reviews.js). One review, one save and one check-in per user per place.

### Routes (frontend only; optional PHP proxy later)

The place card has "Route here": pick a start (my location or another place) and Walk / Car,
and the map draws the line with distance, time and steps. `getRoute(from, to, mode)` returns
`{ mode, source, distance (m), duration (s), coordinates: [[lng, lat]…], steps: [{ instruction, distance, duration }] }`.

- With `VITE_ORS_API_KEY` in `.env` (free key from https://account.heigit.org → Tokens) it calls
  OpenRouteService at `https://api.heigit.org/openrouteservice/v2/directions` from the browser.
- Without a key it returns a straight-line preview (dashed line, labelled as an estimate).
- Optional: `GET /api/route.php?from=lng,lat&to=lng,lat&mode=walk|car` forwarding to
  OpenRouteService with the key kept on the server, same response shape. No table needed.

## Map (frontend only — no backend work)

The map style is ours ([src/map/style.js](src/map/style.js)) on OpenStreetMap vector tiles from
OpenFreeMap (free, no key). Street and bus-stop names come from OpenStreetMap, like on Google Maps.
The 3D city ([src/map/city-3d.js](src/map/city-3d.js)) keeps a small circle around every place's
location free of buildings, so correct coordinates matter (check them on https://www.openstreetmap.org).
YBS bus stops come straight from the map tiles ([src/map/bus-stops.js](src/map/bus-stops.js)).
