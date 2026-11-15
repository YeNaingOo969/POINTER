# Backend task 1 — Accounts (log in / register) and places

**Owner:** backend developer 1 · **Frontend pages:** `login.html`, `explore.html`, `place.html`

> Changed on 2026-11-12 (new scope document): 7 category groups (seed them from HANDOFF.md),
> `description` and `phone` on places, and a `categories.php` endpoint.
>
> Changed on 2026-11-14 (team ER, 15 tables): categories have `name_en` / `name_my` / `group_name`;
> opening hours are JSON text in `places.open_hours`; photos are in `place_photos` and
> `places.cover_photo`; YBS lines and facilities are gone; banned users can't log in.
>
> Changed on 2026-11-15: `places.status` uses the ER words — `pending`, `active`, `rejected`, `hidden`
> (add `rejected` to the ER if it isn't there). Please also make `places.owner_id` **nullable** — public places the admin adds
> (pagodas, parks, landmarks) have no owner.

**Database:** the team's dbdiagram schema — tables `users`, `places`, `categories`,
`place_photos`, `reviews`

Task 2 (My account) needs the login session from this task, so please finish the
**Accounts** part first.

## 1. Run the frontend

```bash
cd frontend
npm start
```

Open http://localhost:5173/login.html. It works now with fake data kept in the browser
(`USE_MOCK = true`). Try it: register, log in, log out. The demo account is
`demo@pointer.test` / `pointer-demo`.

## 2. Where your code goes

- Put the JSON endpoints in a new `api/` folder at the repo root (`api/session.php`,
  `api/login.php`, …). Shared code (DB connection, JSON helpers, session start) goes in
  `include/`, the DB settings in `config/db.php` (already git-ignored).
- Run PHP from the repo root: `php -S localhost:8000`. The frontend dev server forwards every
  `/api/...` request to it (see `frontend/vite.config.js`), so cookies and sessions just work.
- When an endpoint is ready, set `USE_MOCK = false` in `frontend/src/api/config.js` **on your
  own machine** to test against it. Please don't edit other files in `frontend/` — ask the
  frontend lead if something there must change.

## 3. Common rules for every endpoint

- Request and response bodies are JSON, UTF-8. Read the body with
  `json_decode(file_get_contents('php://input'), true)`.
  Always send `Content-Type: application/json; charset=utf-8`.
- Errors: the right HTTP status and `{ "error": "Readable message" }`. The page shows its own
  text for 401 / 403 / 404 / 409, and shows your message as-is for **422**.
- **CSRF:** `session.php` creates `$_SESSION['csrf']` (random, `bin2hex(random_bytes(32))`) and
  returns it. Every POST / DELETE must send the same value in the `X-CSRF-Token` header
  (the frontend already does this). Compare with `hash_equals()`; reply 403
  `{ "error": "Invalid request" }` if it's wrong.
- PDO with **prepared statements** only; connection charset `utf8mb4`.
- Dates go out as ISO 8601 with the Yangon offset: `2026-11-10T17:20:00+06:30`.

## 4. Accounts (`users`)

| Function in `api.js` | Endpoint | Request | Success | Errors |
|---|---|---|---|---|
| `getSession()` | `GET /api/session.php` | — | `200 { "user": { "id": 1, "name": "Aung Aung", "role": "user" } \| null, "csrfToken": "..." }` | — |
| `register()` | `POST /api/register.php` | `{ "name", "email", "password" }` | `201 { "user": {...} }` and the user is logged in | `422` invalid input · `409 { "error": "Email already registered" }` |
| `login()` | `POST /api/login.php` | `{ "email", "password" }` | `200 { "user": {...} }` | `401 { "error": "Wrong email or password" }` · `403 { "error": "This account is suspended" }` when `users.status` = `banned` |
| `logout()` | `POST /api/logout.php` | — | `200 { "user": null }` | — |

`role` is `user` or `admin`. A new account is always `user`.

**Validation (check again on the server, never trust the page):**

- `name`: trimmed, 2–100 characters.
- `email`: `filter_var(..., FILTER_VALIDATE_EMAIL)`, stored lower-case, unique (check with a
  `SELECT` before the `INSERT`).
- `password`: 8–72 characters. Store only `password_hash($password, PASSWORD_DEFAULT)` in
  `users.password_hash`; check with `password_verify()`. Never log or return a password or hash.

**Session:** after a successful register or login call `session_regenerate_id(true)` and keep
only `$_SESSION['user_id']`. Session cookie `HttpOnly`, `SameSite=Lax`. Logout clears the
session (`$_SESSION = []`, `session_destroy()`).

**Same message for wrong email and wrong password** ("Wrong email or password"), so nobody can
find out which emails are registered.

## 5. Places

| Function in `api.js` | Endpoint | Success | Errors |
|---|---|---|---|
| `getCategories()` | `GET /api/categories.php` | `200 [{ "id", "name", "nameMy", "group" }]` — the 7 groups in HANDOFF.md (`name_en`, `name_my`, `group_name`) | — |
| `getPlaces()` | `GET /api/places.php` | `200 Place[]` (`places.status = 'active'` only — not pending, rejected or hidden) | — |
| `getPlace(id)` | `GET /api/places.php?id=1` | `200 Place` | `404 { "error": "Place not found" }` |

The exact `Place` shape is in `frontend/src/data/places.js` (21 examples you can also use as
seed data, with the categories in `frontend/src/data/categories.js`) and the field table in
`frontend/HANDOFF.md`. How the columns map to it:

| JSON | From |
|---|---|
| `id`, `name`, `address`, `ownerId` | `places.id`, `places.name`, `places.address`, `places.owner_id` |
| `category` | `{ "id", "name": name_en, "nameMy": name_my, "group": group_name }` joined from `categories` on `places.category_id`, or `null` |
| `description`, `phone` | `places.description`, `places.phone` (string or `null`; the page shows a Call button when `phone` is set) |
| `location` | `{ "lat": lat, "lng": lng }` (numbers, not strings) |
| `openingHours` | `json_decode(places.open_hours)` — `[{ "day": "mon", "open": "04:00", "close": "22:00" }, …]`, one row per open day (format in HANDOFF.md); `NULL` → `[]` |
| `coverPhoto` | `places.cover_photo` or `null` |
| `photos` | `place_photos` → `[{ "url": url }]` (real photos only) |
| `rating` | `{ "average": AVG(rating) rounded to 1 decimal, "count": COUNT(*) }` from `reviews`; no reviews → `{ "average": 0, "count": 0 }` |

Tip: cast numbers in PHP (`(int)`, `(float)`) before `json_encode`, because PDO returns them
as strings.

## Done when

- [ ] Register → logged in → reload the page → still logged in (`session.php` returns the user).
- [ ] Wrong password shows "Wrong email or password"; a used email shows the "already
      registered" message; a `banned` user gets 403.
- [ ] Log out works; POST without the right `X-CSRF-Token` gets 403.
- [ ] Passwords in the database are `password_hash` strings, never plain text.
- [ ] With `USE_MOCK = false` the Explore map shows all places from MySQL, and
      `place.html?id=1` shows category, about, hours, address and rating, and `place.html?id=20` a Call button;
      `place.html?id=999` shows "We couldn't find this place."
- [ ] Every query uses prepared statements.
