# POINTER — backend handoff

For the two backend developers. This file says what the frontend expects from the PHP backend.
It is updated after every frontend milestone. The scope document of 2026-11-12 is the source of
truth for features. **Status: phase 1 (find, view, save) is done on mock data — landing, explore map
with category filter, place page, login, My account and "Add your business". Next: phase 2 (shop
owners, posts, deals and tickets, home page), then phase 3 (admin, reports, messages, notifications).**

## How the frontend talks to the backend

- Every request goes through [src/api/api.js](src/api/api.js). Nothing else in the frontend fetches data.
- While `USE_MOCK = true` in [src/api/config.js](src/api/config.js), functions return mock data from
  [src/data/](src/data/). When your endpoints are ready, set `USE_MOCK = false` (on your own machine
  to test) and keep `API_BASE` as `/api`.
- Requests and responses are **JSON**, UTF-8 (MariaDB: `utf8mb4` tables and connection). File
  uploads (the shop-front photo) are `multipart/form-data`.
- Dates are ISO 8601 strings with the Yangon offset, e.g. `2026-11-10T17:20:00+06:30`.
- Errors: return a non-2xx status with `{ "error": "message" }`. The page shows its own text for
  401 / 403 / 404 / 409 and your message as-is for 422.
- **Language:** the interface is English by default with a Burmese switch (frontend only, saved in
  the browser). Data is shown exactly as stored — place names, descriptions and reviews can be in
  either language. Category names are translated by the frontend from the category `icon` key.

## Backend tasks

Two self-contained tasks, one per backend developer, with every endpoint, validation rule and a
"done when" checklist:

- [docs/tasks/backend-1-auth-places.md](docs/tasks/backend-1-auth-places.md) — session, register,
  login, logout, categories, places list and place detail.
- [docs/tasks/backend-2-passport.md](docs/tasks/backend-2-passport.md) — saves, reviews (write,
  edit, delete), My account and the "Add your business" request.

Local setup: run PHP from the repo root with `php -S localhost:8000`; `npm run dev` forwards every
`/api/...` request to it (see `vite.config.js`), so page and API share one origin and the session
cookie works. Every POST / PUT / DELETE sends the CSRF token from `session.php` in an
`X-CSRF-Token` header.

## Database

The team's own schema (dbdiagram, 13 tables): `users`, `categories`, `places`, `place_images`,
`operating_hours`, `reviews`, `favourites`, `history`, `promotions`, `user_redeems`, `place_posts`,
`messages`, `audit_logs`. The frontend uses them like this:

| Frontend | Table |
|---|---|
| Places, the map, search, place card / page | `places` + `categories` + `operating_hours` + `place_images`; rating from `reviews` |
| Category filter, business form | `categories` — the **7 groups** below |
| Log in / register / session | `users` (`password_hash`, `role` = `user` or `admin`) |
| Reviews | `reviews` (`comment` is the review text) |
| Save button, saved places | `favourites` |
| "Add your business" request | suggestion: a `places` row with `owner_id` = the user and `status` = `pending` / `approved` / `rejected` (+ `operating_hours`, the photo in `place_images`) — no new table needed |
| Posts, deals, tickets, admin (phases 2–3) | `place_posts`, `promotions`, `audit_logs`, … |
| No longer used | `history` — check-ins were dropped by the scope document |

**Categories** (`categories` rows; `icon` is the key the frontend uses for colour and translation):

| id | name | icon |
|---|---|---|
| 1 | Food & drink | `food` |
| 2 | Stay | `stay` |
| 3 | Places to visit | `visit` |
| 4 | Shopping | `shop` |
| 5 | Health | `health` |
| 6 | Beauty & wellness | `beauty` |
| 7 | Other | `other` |

## Roles

| Role | Can |
|---|---|
| Visitor (not logged in) | View places, the map and deals. A user action opens the "Log in to continue" dialog. |
| User | Save places, write / edit / delete their own review, send one "Add your business" request. All free. |
| Owner (a user whose request is approved) | Everything a user can, plus (phase 2) posts, discounts, review replies and editing the shop. Can't review their own shop. One business per user. |
| Admin | (phase 3) Business requests, places without an owner, reports, users, Premium records, audit log. |

## Pages

| Page | File | Status |
|---|---|---|
| Landing | `index.html` | done (v2): 10-section scroll story — static, no backend data |
| Explore map | `explore.html` | done: pastel map, place bubbles (dot = group, ring = open / closed), **7-group filter**, search, place card, routes, YBS stops |
| Place detail | `place.html?id=<id>` | done: map hero, about, opening hours, address, YBS lines, facilities, **Call**, directions, save, reviews (write, **edit / delete your own**) |
| Login / register | `login.html` | done: log in, create account, validation, `?next=` return |
| My account | `account.html` | done: saved places, my reviews, **my business** (request status or "Add your business"). Tickets come in phase 2 |
| Add your business | `business.html` | done: request form (name, group, description, phone, hours per day, map pin, shop-front photo) → "Waiting for review" |
| Home | `home.html` | phase 2: categories, deals, latest posts |
| Admin dashboard | `admin.html` | phase 3 |

## Endpoints

### `GET /api/categories.php` → `Category[]`

`[{ id, name, icon }]` — the 7 rows above. Used by the explore filter and the business form.

### `GET /api/places.php` → `Place[]` · `GET /api/places.php?id=1` → `Place`

Used by the explore map (bubbles, search, card) and the place page. Only approved / active
places (not pending requests). A missing id returns `404 { "error": "Place not found" }`. Mock
data: [src/data/places.js](src/data/places.js) + [src/data/categories.js](src/data/categories.js).

| Field | Type | From |
|---|---|---|
| `id` | int | `places.id` (also the URL: `place.html?id=1`) |
| `name` | string | `places.name` |
| `category` | `{ id, name, icon }` or `null` | join `categories` on `places.category_id` |
| `ownerId` | int or `null` | `places.owner_id` (`null` for places the admin manages, e.g. pagodas) |
| `address` | string | `places.address` |
| `description` | string or `null` | `places.description` |
| `phone` | string or `null` | `places.phone` — the place page shows a **Call** button when set |
| `location` | `{ lat, lng }` (numbers) | `places.latitude`, `places.longitude` |
| `ybsLines` | string[] | `places.ybs_lines`, comma-separated text → array (`[]` when empty) |
| `facilities` | string[] | `places.facilities`, comma-separated text → array |
| `openingHours` | `[{ days, open, close }]` | `operating_hours` rows grouped: days with the same times become a range (`mon-fri`), a single day stays `mon`; times `HH:MM`; a `close` before `open` runs past midnight. **No rows → `[]`** (hours unknown) |
| `photos` | `[{ url }]` | `place_images.image_url` (real photos only) |
| `rating` | `{ average, count }` | `AVG(rating)` rounded to 1 decimal and `COUNT(*)` from `reviews` |

Search and the category filter run in the browser over this list.

### Accounts, reviews, saves, My account, business request

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
| `addReview(placeId, { rating, text })` | `POST /api/reviews.php` `{ placeId, rating, text }` | → `201 Review` · 409 already reviewed · **403 the user owns this place** |
| `updateReview(id, { rating, text })` | `PUT /api/reviews.php?id=12` `{ rating, text }` | → `Review` (with `updatedAt`) · 403 not your review |
| `deleteReview(id)` | `DELETE /api/reviews.php?id=12` | → `{ deleted: true }` · 403 not your review |
| `getMyPlace(placeId)` | `GET /api/my-place.php?place_id=1` | → `{ saved: bool, reviewId: int \| null }` (visitor: `false`, `null`) |
| `setSaved(placeId, saved)` | `POST /api/saves.php` `{ placeId }` / `DELETE /api/saves.php?place_id=1` | → `{ saved }` |
| `getMySaves()` | `GET /api/my-saves.php` | → `[{ place: PlaceSummary }]`, newest first |
| `getMyReviews()` | `GET /api/my-reviews.php` | → `[Review & { place: PlaceSummary }]`, newest first |
| `submitBusinessRequest(fields)` | `POST /api/business-requests.php` (multipart) | → `201 BusinessRequest` · 409 already has a business or a pending request · 422 invalid |
| `getMyBusinessRequest()` | `GET /api/my-business-request.php` | → `BusinessRequest \| null` |

**Review shape:** `{ id, placeId, user: { id, name }, rating: 1–5, text, createdAt, updatedAt? }`
— `text` is `reviews.comment`, the user's own words (max 600 chars; escape it when you output
HTML). Mock data: [src/data/reviews.js](src/data/reviews.js). One review and one save per user
per place.

**Business request** — multipart fields: `name` (2–100), `categoryId` (1–7), `description`
(10–600), `phone`, `openingHours` (JSON text: `[{ "day": "mon", "open": "06:00", "close": "11:00" }]`,
open days only), `lat`, `lng` (inside Yangon), `photo` (JPEG / PNG / WebP, max 5 MB — check the
real type with `finfo`, store under a random file name). Response / `BusinessRequest` =
`{ id, status: 'pending' | 'approved' | 'rejected', name, categoryId, description, phone,
openingHours, lat, lng, photoUrl, createdAt }`. One business per user; a rejected user may send a
new request. No licence or documents — only the shop-front photo (privacy, scope doc §4).

### Routes (frontend only; optional PHP proxy later)

The place card has "Route here": pick a start (my location or another place) and Walk / Car,
and the map draws the line with distance, time and steps. `getRoute(from, to, mode)` returns
`{ mode, source, distance (m), duration (s), coordinates: [[lng, lat]…], steps: [{ instruction, distance, duration }] }`.

- With `VITE_ORS_API_KEY` in `.env` (free key from https://account.heigit.org → Tokens) it calls
  OpenRouteService at `https://api.heigit.org/openrouteservice/v2/directions` from the browser.
- Without a key it returns a straight-line preview (dashed line, labelled as an estimate).
- Optional: `GET /api/route.php?from=lng,lat&to=lng,lat&mode=walk|car` forwarding to
  OpenRouteService with the key kept on the server, same response shape. No table needed.
- The user's location is only used for the route and never sent to our backend.

## Map (frontend only — no backend work)

The map style is ours ([src/map/style.js](src/map/style.js)) on OpenStreetMap vector tiles from
OpenFreeMap (free, no key): a flat pastel map, slightly tilted. Street and bus-stop names come
from OpenStreetMap, like on Google Maps. YBS bus stops come straight from the map tiles
([src/map/bus-stops.js](src/map/bus-stops.js)). Correct place coordinates matter — check them on
https://www.openstreetmap.org.
