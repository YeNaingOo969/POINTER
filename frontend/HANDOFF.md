# POINTER — backend handoff

For the two backend developers. This file says what the frontend expects from the PHP backend.
It is updated after every frontend milestone. The scope document of 2026-11-12 is the source of
truth for features. **Status (2026-11-15): phase 1 (find, view, save) and phase 2 (customer Home, Deals and tickets,
Messages, reports and blocking; shop-owner mode) are done on mock data. The map shows the whole
city in 3D (frontend only). Next: phase 3 (admin).** Backend tasks 1 and 2 (phase 1) can start now;
phase 2 endpoints are listed below and get their own task files after the team's flowchart fixes.

## How the frontend talks to the backend

- Every request goes through [src/api/api.js](src/api/api.js). Nothing else in the frontend fetches data.
- While `USE_MOCK = true` in [src/api/config.js](src/api/config.js), functions return mock data from
  [src/data/](src/data/). When your endpoints are ready, set `USE_MOCK = false` (on your own machine
  to test) and keep `API_BASE` as `/api`.
- Requests and responses are **JSON**, UTF-8 (MySQL: `utf8mb4` tables and connection). File
  uploads (the shop-front photo) are `multipart/form-data`.
- Dates are ISO 8601 strings with the Yangon offset, e.g. `2026-11-10T17:20:00+06:30`.
- Errors: return a non-2xx status with `{ "error": "message" }`. The page shows its own text for
  401 / 403 / 404 / 409 and your message as-is for 422.
- **Language:** the interface is English by default with a Burmese switch (frontend only, saved in
  the browser). Data is shown exactly as stored — place names, descriptions and reviews can be in
  either language. Category names come from `categories.name_en` / `name_my`.

## Backend tasks

Two self-contained tasks, one per backend developer, with every endpoint, validation rule and a
"done when" checklist:

- [docs/tasks/backend-1-auth-places.md](docs/tasks/backend-1-auth-places.md) — session, register,
  login, logout, categories, places list and place detail.
- [docs/tasks/backend-2-passport.md](docs/tasks/backend-2-passport.md) — saves, reviews (write,
  edit, delete), My account and the "Add your business" request.

Frontend: [docs/tasks/frontend-admin.md](docs/tasks/frontend-admin.md) — the admin dashboard
(`admin.html`, phase 3) on mock data; its `src/api/admin.js` lists the admin endpoints for later
(Burmese version: [frontend-admin.my.md](docs/tasks/frontend-admin.my.md)).

Local setup: run PHP from the repo root with `php -S localhost:8000`; `npm run dev` forwards every
`/api/...` request to it (see `vite.config.js`), so page and API share one origin and the session
cookie works. Every POST / PUT / DELETE sends the CSRF token from `session.php` in an
`X-CSRF-Token` header.

## Database

`places.status` (team ER): `pending` (request waiting for the admin) · `active` (approved, on the map) · `rejected` (request refused; the user may send a new one) · `hidden` (hidden by the admin, or the plan ended). (`owner_upgrades.status` is separate: `pending` / `approved` / `rejected` for the payment.)

The team's schema (dbdiagram, 15 tables, updated 2026-11-14): `users`, `categories`, `places`,
`place_photos`, `reviews`, `favorites`, `posts`, `tickets`, `owner_upgrades`, `messages`, `blocks`,
`notifications`, `reports`, `search_history`, `audit_log`. The frontend uses them like this:

| Frontend | Table |
|---|---|
| Places, the map, search, place card / page | `places` + `categories` + `place_photos`; rating from `reviews` |
| Opening hours | `places.open_hours` — JSON text, format below |
| Category filter, business form | `categories` — the **7 groups** below |
| Log in / register / session | `users` (`password_hash`, `role` = `user` or `admin`, `status` = `active` or `banned`) |
| Reviews | `reviews` (`comment` is the review text, `owner_reply` the shop's answer, `updated_at` set on edit) |
| Save button, saved places | `favorites` |
| "Add your business" request | a `places` row with `owner_id` = the user, `status` = `pending` / `active` / `rejected` / `hidden`, `open_hours` and the photo in `storefront_photo` |
| Phase 2: posts, deals, tickets | `posts` (`type`, `discount_text`, `ticket_limit`, `expires_at`, `is_pinned`), `tickets` (`ticket_code`, `status`, `used_at`) |
| Phase 2: owner payment | `owner_upgrades` (`months`, `amount`, payment method / reference / proof, `status`, `starts_at`, `expires_at`, reviewed by an admin) |
| Phase 3 | `messages`, `blocks`, `notifications`, `reports`, `audit_log` |
| Later: recent searches on the map | `search_history` |

Please also add a **unique key on `reviews (user_id, place_id)`** — one review per user per place
(not visible in the diagram).

**Categories** (`categories` rows; `group_name` is the key the frontend uses for the group's colour):

| id | name_en | name_my | group_name |
|---|---|---|---|
| 1 | Food & drink | စားသောက်ဆိုင် | `food` |
| 2 | Stay | တည်းခိုရန် | `stay` |
| 3 | Places to visit | လည်ပတ်စရာ | `visit` |
| 4 | Shopping | စျေးဝယ်ရန် | `shop` |
| 5 | Health | ကျန်းမာရေး | `health` |
| 6 | Beauty & wellness | အလှအပ | `beauty` |
| 7 | Other | အခြား | `other` |

**Opening hours** (`places.open_hours`, TEXT): a JSON array with one row per open day, exactly
what the business form sends and what `places.php` returns as `openingHours`:

```json
[{ "day": "mon", "open": "06:00", "close": "11:00" }, { "day": "mon", "open": "17:00", "close": "22:00" },
 { "day": "sat", "open": "20:00", "close": "02:00" }]
```

`day` is `mon`…`sun`; times are `HH:MM`. A day can have two rows (a lunch break). A day with no row
is closed. A `close` before `open` runs past midnight. `NULL` or `[]` means the hours are not known.

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
| Place detail | `place.html?id=<id>` | done: map hero, about, opening hours, address, **Call**, directions, save, reviews (write, **edit / delete your own**, owner's reply shown) |
| Login / register | `login.html` | done: log in, create account, validation, `?next=` return |
| My account | `account.html` | done: saved places, my reviews, **my business** (request status or "Add your business"). Tickets come in phase 2 |
| Add your business | `business.html` | done: request form (name, group, description, phone, hours per day, map pin, shop-front photo) → "Waiting for review" |
| Home | `home.html` | done (mock): greeting, category groups, deals ending soon, latest posts |
| Deals | `deals.html` | done (mock): active deals by ending soon / newest and group, tickets (2 h) |
| Messages | `messages.html` | done (mock): conversations, message requests (accept), blocked state |
| Owner mode | `owner.html` | done (mock): subscription check + renew, ticket check, posts, review replies, place edit |
| Admin dashboard | `admin.html` | phase 3 |

## Endpoints

### `GET /api/categories.php` → `Category[]`

`[{ id, name, nameMy, group }]` — the 7 rows above (`name_en`, `name_my`, `group_name`). Used by the
explore filter and the business form.

### `GET /api/places.php` → `Place[]` · `GET /api/places.php?id=1` → `Place`

Used by the explore map (bubbles, search, card) and the place page. Only `places.status = 'active'`
places (not pending requests). A missing id returns `404 { "error": "Place not found" }`. Mock
data: [src/data/places.js](src/data/places.js) + [src/data/categories.js](src/data/categories.js).

| Field | Type | From |
|---|---|---|
| `id` | int | `places.id` (also the URL: `place.html?id=1`) |
| `name` | string | `places.name` |
| `category` | `{ id, name, nameMy, group }` or `null` | join `categories` on `places.category_id` |
| `ownerId` | int or `null` | `places.owner_id` (`null` for places the admin manages, e.g. pagodas) |
| `address` | string | `places.address` |
| `description` | string or `null` | `places.description` |
| `phone` | string or `null` | `places.phone` — the place page shows a **Call** button when set |
| `location` | `{ lat, lng }` (numbers, not strings) | `places.lat`, `places.lng` |
| `openingHours` | `[{ day, open, close }]` | `json_decode(places.open_hours)` — format above; `NULL` → `[]` (hours unknown) |
| `coverPhoto` | string or `null` | `places.cover_photo` (real photo, set by the owner or admin) |
| `photos` | `[{ url }]` | `place_photos.url` (real photos only) |
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
| `login(…)` | `POST /api/login.php` `{ email, password }` | → `{ user }` · 401 wrong email or password · 403 `users.status` = `banned` |
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

**Review shape:** `{ id, placeId, user: { id, name }, rating: 1–5, text, createdAt, updatedAt, ownerReply }`
— `text` is `reviews.comment`, `updatedAt` is `reviews.updated_at` (`null` if never edited),
`ownerReply` is `reviews.owner_reply` (`null` until the owner answers; owners write it in phase 2).
`text` is the user's own words (max 600 chars; escape it when you output HTML). Mock data:
[src/data/reviews.js](src/data/reviews.js). One review and one save per user per place.

**Business request** — multipart fields: `name` (2–100), `categoryId` (1–7), `description`
(10–600), `phone`, `openingHours` (JSON text: `[{ "day": "mon", "open": "06:00", "close": "11:00" }]`,
open days only), `lat`, `lng` (inside Yangon), `photo` (JPEG / PNG / WebP, max 5 MB — check the
real type with `finfo`, store under a random file name). Response / `BusinessRequest` =
`{ id, status: 'pending' | 'active' | 'rejected' | 'hidden', name, categoryId, description, phone, address,
openingHours, lat, lng, photoUrl, createdAt }` (`photoUrl` = `places.storefront_photo`; the request is
the `places` row itself, see the Database table). One business per user; a rejected user may send a
new request. No licence or documents — only the shop-front photo (privacy, scope doc §4).

### Phase 2 — customer pages (Home, Deals and tickets, Messages, reports, blocking)

Built on mock data (2026-11-14) following `docs/flows/` 2, 2a–2e. Functions are in
[src/api/community.js](src/api/community.js) (re-exported by `api.js`); mock rows in
[src/data/community.js](src/data/community.js). Pages: `home.html`, `deals.html`, `messages.html`,
plus new parts of `place.html` (shop posts, Message, Report, Block), `account.html` (My tickets,
Blocked list) and `business.html` (plan + payment). Logged-in only unless marked.

| Function | Endpoint | Request → response | Tables |
|---|---|---|---|
| `getHome()` (visitors too) | `GET /api/home.php` | → `{ posts: Post[6], deals: Post[4] }` | posts, places |
| `getDeals({ sort, group })` (visitors too) | `GET /api/deals.php?sort=ending\|newest&group=food` | → `Post[]` active discount posts | posts, places, categories, blocks |
| `getPost(id)` (visitors too) | `GET /api/posts.php?id=101` | → `Post` · 404 | posts |
| `getPlacePosts(placeId)` (visitors too) | `GET /api/posts.php?place_id=20` | → `Post[]` pinned first, ended deals left out | posts |
| `getMyTicket(postId)` | `GET /api/my-ticket.php?post_id=101` | → `Ticket \| null` (visitor: `null`) | tickets |
| `takeTicket(postId)` | `POST /api/tickets.php { postId }` | → `201 Ticket` · 409 already has one · 410 ended / none left | tickets |
| `getMyTickets()` | `GET /api/my-tickets.php` | → `[Ticket & { post: Post }]` newest first | tickets, posts |
| `getConversations()` | `GET /api/conversations.php` | → `[{ other: { id, name, placeId }, last: Message, unread, status, blocked }]` | messages, blocks |
| `getMessages(userId)` | `GET /api/messages.php?with=1` | → `{ other, status: accepted\|request\|new, blocked, messages: Message[] }`, marks theirs read | messages |
| `sendMessage(to, body)` | `POST /api/messages.php { to, body }` | → `201 Message` · 403 blocked (either side) · 422 empty / > 1000 chars | messages, blocks |
| `getMyBlocks()` | `GET /api/blocks.php` | → `[{ user: { id, name, placeId } }]` | blocks |
| `setBlocked(userId, on)` | `POST /api/blocks.php { userId }` · `DELETE /api/blocks.php?user_id=1` | → `{ blocked }` | blocks |
| `submitReport({ targetType, targetId, reason })` | `POST /api/reports.php` | → `201 { id, status: 'open' }` · 422 no reason | reports |
| `getNotifications()` | `GET /api/notifications.php` | → `[{ id, type, refId, isRead, createdAt }]` (visitor: `[]`) | notifications |
| `markNotificationsRead()` | `POST /api/notifications.php { read: 'all' }` | → `{ ok: true }` | notifications |

**Post** = `{ id, placeId, type: 'normal'|'discount', content, imageUrl, discountText, ticketLimit, expiresAt,
isPinned, createdAt, place: { id, name, address, ownerId, category }, ticketsTaken, ticketsLeft, ended }`
(`ticketsTaken` / `ticketsLeft` / `ended` only matter for discounts; `ended` = expired or limit reached).

**Ticket** = `{ id, postId, code, status: 'active'|'used'|'expired', createdAt, expiresAt, usedAt }` —
`expiresAt` is `tickets.created_at + 2 h` (no column needed); `code` is unique (`tickets.ticket_code`),
e.g. `GB-8X2M` (shop initials + 4 characters). One ticket per user per post.

**Message** = `{ id, senderId, receiverId, body, status: 'request'|'accepted', isRead, createdAt }`. The first
message between two people is a `request` until the receiver replies or accepts (owner side, phase 2b).

**Blocking a shop** = blocking its owner (`blocks.blocked_id = places.owner_id`). For that user, the
owner's place leaves `places.php`, its posts leave Home and Deals, and messages in either direction
get 403. **Notification types:** `new_deal` (ref = post id), `message` (ref = message id),
`review_reply` (ref = review id), `request_approved` / `request_rejected` (ref = place id),
`renewal_reminder` (ref = owner_upgrades id).

**Business request payment** — `submitBusinessRequest` now also sends `months` (1/3/12), `amount`,
`paymentMethod` (KBZPay / Wave Pay / AYA Pay), `paymentRef` and `proof` (image, same checks as the
photo). Save them as an `owner_upgrades` row with `status = 'pending'` next to the pending `places` row.
Prices on the form match the database `plans` table (12,000 / 30,000 / 55,000 / 100,000 Ks for 1 / 3 / 6 / 12 months). With `USE_MOCK = true` payment is still simulated.

### Phase 2 — shop owner (`owner.html`, flowcharts 3, 3a–3c)

Functions in [src/api/owner.js](src/api/owner.js). Only for a user whose place is approved; otherwise
403 and the page offers "Add your business". When the subscription has ended the page shows only the
renewal form; within 7 days of the end it shows a reminder and the form above the dashboard.
Way in: My account → My business → **Owner mode** (shown when the request is approved).

| Function | Endpoint | Request → response | Tables |
|---|---|---|---|
| `getOwnerDashboard()` | `GET /api/owner/dashboard.php` | → `{ place, subscription: { months, startsAt, expiresAt, active, daysLeft } \| null, pending, stats: { posts, activeDeals, ticketsTaken, ticketsUsed, rating }, posts: Post[] (ended ones too), reviews: Review[] }` · 403 no shop | places, owner_upgrades, posts, tickets, reviews |
| `createPost(fields)` | `POST /api/owner/posts.php` (multipart) | `type`, `content`, `image?`; discount: `discountText`, `ticketLimit` (1–500), `expiresAt` (future) → `201 Post` · 403 subscription not active · 422 | posts |
| `updatePost(id, fields)` / `setPostPinned(id, on)` | `PUT /api/owner/posts.php?id=101` | `{ content?, discountText?, ticketLimit?, expiresAt?, isPinned? }` → `Post` · 403 not yours | posts |
| `deletePost(id)` | `DELETE /api/owner/posts.php?id=101` | → `{ deleted: true }` (tickets already taken stay valid until they expire) | posts |
| `checkTicket(code)` | `GET /api/owner/ticket.php?code=GB-8X2M` | → `{ result: ok\|not_found\|other_shop\|used\|expired, ticket?: Ticket & { userName }, post? }` (does not use it). The ticket shows its code as a QR code too; scanning it (phone camera) just types the same code here, so no backend change | tickets, posts |
| `confirmTicket(code)` | `POST /api/owner/ticket.php { code }` | → `{ result: 'used', ticket }` (`status = used`, `used_at = now`) · 404 · 403 other shop · 409 used / expired | tickets |
| `replyToReview(id, reply)` | `PUT /api/owner/review-reply.php?id=12 { reply }` | → `{ id, ownerReply }` · 403 not my place · 422 empty / > 600 | reviews.owner_reply |
| `updateMyPlace(fields)` | `PUT /api/owner/place.php { description, phone, address }` (address 5–200) | → `Place` (name, group and pin stay with the admin) · 422 | places |
| `renewSubscription(fields)` | `POST /api/owner/renew.php` (multipart) | `months, amount, paymentMethod, paymentRef, proof` → `201 { id, status: 'pending', … }` (admin approves in 4a) | owner_upgrades |
| `acceptMessageRequest(userId)` | `POST /api/messages.php { accept: userId }` | → `{ status: 'accepted' }` (both sides of that chat) | messages |

Rules: a ticket is valid only for one of the owner's own posts, while `status = active` and
`created_at + 2 h > now`. Owners can reply to reviews but not delete them, and can't review their own
place. While `USE_MOCK` is true the "Log in to continue" dialog has **Try as a demo shop owner**
(Golden Bean Café, user 1); demo shops 2–5 cover the other cases (2 ends in 5 days, 3 has ended).
Test ticket codes for shop 1: `GB-8X2M` (valid, seeded as the demo user's ticket), `GB-4Y5Z` (used), `GB-R8XT` (expired). Owner mock reads the same seeded customer tickets as the customer pages, and a code used at the counter stays `used`.

### Routes (frontend only; optional PHP proxy later)

The place card has "Route here": pick a start (my location or another place) and Walk / Car,
and the map draws the line with distance, time and steps. `getRoute(from, to, mode)` returns
`{ mode, source, distance (m), duration (s), coordinates: [[lng, lat]…], steps: [{ instruction, distance, duration }] }`.

- With `VITE_ORS_API_KEY` in `.env` (optional free key from https://account.heigit.org → Tokens)
  it calls OpenRouteService at `https://api.heigit.org/openrouteservice/v2/directions` first.
- Without a key — or if ORS fails — it calls the keyless FOSSGIS OSRM demo at
  `https://routing.openstreetmap.de/routed-{foot|car}/route/v1/driving` (CORS enabled, no secret).
  So every user gets real road routes and turn-by-turn steps after a fresh clone; no `.env` needed.
  `source` is `ors` or `osrm`, and both draw a solid gold line.
- Only if both services are unreachable it returns a dashed straight-line preview, labelled as an
  estimate. This is a fallback, not the default.
- The public OSRM service is a small demo instance; if usage grows, move the key to a PHP proxy:
  `GET /api/route.php?from=lng,lat&to=lng,lat&mode=walk|car`, same response shape. No table needed.
- The user's location is only used for the route and never sent to our backend.

## Map (frontend only — no backend work)

The map style is ours ([src/map/style.js](src/map/style.js)) on OpenStreetMap vector tiles from
OpenFreeMap (free, no key): a flat pastel map, slightly tilted. Street and bus-stop names come
from OpenStreetMap, like on Google Maps. YBS bus stops come straight from the map tiles
([src/map/bus-stops.js](src/map/bus-stops.js)). Correct place coordinates matter — check them on
https://www.openstreetmap.org.

Landmarks (Shwedagon on its hill, City Hall, Secretariat, Bogyoke Market, Sule, Botataung, Karaweik, the
Strand, the bridges and every road flyover) are 3D models built in Blender by `npm run build:landmarks`
(`scripts/blender/landmarks/`) and drawn by [src/map/landmarks-3d.js](src/map/landmarks-3d.js). Static files
only — nothing for the backend. Place ids 1, 2, 3, 5, 7, 11, 12, 15 sit on landmarks, so their bubbles float
above the models.

### Resilience (2026-11-22)

`createMap()` resolves after a 4s timeout even if MapLibre never fires `'load'` (slow/blocked tile
servers, GPU context reset). `explore.js` keeps the category filter, search and place list outside
the map-layer setup; decorative layers (3D landmarks, POI labels, bus stops, route line) are skipped
with a `console.warn` if the style isn't ready, and `routeLayer` falls back to a no-op. The UI stays
usable without tiles. Verified with `USE_MOCK = true`: 27 pins, 8 category chips, "Food & drink"
filters to 6 pins, no error status.

### Pin bubbles never overlap (2026-11-24)

HTML markers don't get MapLibre's label collision, so neighbouring bubbles used to cover each other
(e.g. `Sule Pagoda` / `Yangon City Hall`, `Kandawgyi` / `Kandaw Lake Guesthouse`). After every camera
move (`moveend`, `resize`, filter, selection) [src/map/place-markers.js](src/map/place-markers.js) runs a
declutter pass: full bubbles are measured in priority order (selected → featured → open now → rest) and a
bubble that would intersect a kept one collapses to its dot (`is-collided`). If even the dot is still
covered, the pin is hidden completely (`is-collided-dot`, `visibility: hidden` — also out of the tab order)
instead of leaving an invisible, unclickable target. Hover or keyboard focus still opens a collapsed
bubble above its neighbours ([map-ui.css](src/styles/components/map-ui.css)).

Measured with `USE_MOCK = true` at 1600×732: initial view 0 overlapping bubbles; after opening Sule
(zoom 15.5) 18 named bubbles, 9 collapsed, **0 overlaps**; two zoom steps in, 25 names with only 2
collapsed. Hover on a 24×24 dot expands it to 167×48, focus-visible works, clicking a dot opens the
right place card, console errors 0. At 390 px the existing mobile rule already keeps names on the
selected pin only, so no declutter is needed there and `scrollWidth` stays 390.

The admin portal (`admin/`) still fetches `/api/session.php` and `/api/admin/dashboard.php` directly
from `admin-auth.js`; those return 502 under Vite alone (PHP backend not running). This is expected —
run the PHP server from the repo root (`php -S localhost:8000`) to exercise the real admin dashboard.

### M7 polish (2026-11-22)

- Owner counter demo now reads the same seeded customer tickets as the customer pages
  (`SEED_USER_TICKETS` from `src/api/community.js`), and a code used at the counter keeps `status = used`.
  Test codes for Golden Bean Café: `GB-8X2M` valid, `GB-4Y5Z` used, `GB-R8XT` expired.
- `fee()` labels (`card.free`, `card.local`, `card.foreigner`) were missing from both dictionaries;
  added in `en.json` / `my.json` so entry fees no longer print raw key names.
- Restored asset scripts from the old source repo: `gen-image.mjs`, `build-brand.mjs`,
  `build-reveal-layers.mjs`, `export-reveal-video.mjs` with `gen:image`, `build:brand`, `build:reveal`
  and `export:reveal` npm scripts. No new packages were needed.
- Admin portal: the static placeholder amounts in `admin/application.html` now follow the database
  plans (12,000 / 30,000 / 100,000 MMK), and `admin/mobile-fixes.css` stops horizontal scrolling on
  phones (all admin pages measured `scrollWidth = 390` at a 390 px viewport). The black/gold theme
  stays with the backend team; wide tables are still desktop-first.

### Local backend run (2026-11-22)

- Verified with `php -S localhost:8000` from the repo root and Vite preview on port 4173:
  `/api/session.php` 200, admin login (`admin@pointer.app` / `pointer-demo`) 200,
  `/api/admin/dashboard.php` 200 with real DB values (users 7, shops 0, total shops 3, places 19),
  and users / places / categories / reports / audit-log all 200. The dashboard count-up animation
  reaches the API values; the earlier static-looking numbers were mid-animation, not placeholders.
- The machine's local DB was a test database with no admin. Only the demo admin row from
  `database/seed_demo.sql` and the `plans` table from `database/pointer.sql` (1/3/6/12 months =
  12,000 / 30,000 / 55,000 / 100,000 MMK) were added locally. No other rows were changed, and no
  backend file was edited.

**Open backend schema gap:** `api/admin/applications.php:48` selects `u.plan_id` from
`owner_upgrades`, but the local `owner_upgrades` table has no `plan_id` column (it stores `months`
and `amount` directly), so `/api/admin/applications.php` returns 500. Please align the local schema
with `database/pointer.sql` (add `plan_id` and backfill plan ids by months). The frontend left this
to the backend team and did not patch the column.
