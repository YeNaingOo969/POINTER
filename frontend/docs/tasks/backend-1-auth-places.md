# Backend task 1 — Accounts (log in / register) and places

**Owner:** backend developer 1 · **Frontend pages:** `login.html`, `explore.html`, `place.html`
**Database:** `docs/database/pointer.dbml` (tables `users`, `places`, `categories`,
`operating_hours`, `place_images`, `reviews`, `crowd_reports`)

Task 2 (My Passport) needs the login session from this task, so please finish the
**Accounts** part first.

## 1. Run the frontend

```bash
cd frontend
npm install
npm run dev
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
  translated text for 401 / 403 / 409, and shows your message as-is for **422**.
- **CSRF:** `session.php` creates `$_SESSION['csrf']` (random, `bin2hex(random_bytes(32))`) and
  returns it. Every POST / DELETE must send the same value in the `X-CSRF-Token` header
  (the frontend already does this). Compare with `hash_equals()`; reply 403
  `{ "error": "Invalid request" }` if it's wrong.
- PDO with **prepared statements** only; connection charset `utf8mb4`.
- Dates go out as ISO 8601 with the Yangon offset: `2026-11-10T17:20:00+06:30`.

## 4. Accounts

| Function in `api.js` | Endpoint | Request | Success | Errors |
|---|---|---|---|---|
| `getSession()` | `GET /api/session.php` | — | `200 { "user": { "id": 1, "name": "Aung Aung", "role": "user" } \| null, "csrfToken": "..." }` | — |
| `register()` | `POST /api/register.php` | `{ "name", "email", "password" }` | `201 { "user": {...} }` and the user is logged in | `422` invalid input · `409 { "error": "Email already registered" }` |
| `login()` | `POST /api/login.php` | `{ "email", "password" }` | `200 { "user": {...} }` | `401 { "error": "Wrong email or password" }` · `403 { "error": "This account is suspended" }` |
| `logout()` | `POST /api/logout.php` | — | `200 { "user": null }` | — |

**Validation (check again on the server, never trust the page):**

- `name`: trimmed, 2–100 characters.
- `email`: `filter_var(..., FILTER_VALIDATE_EMAIL)`, stored lower-case, max 191 characters,
  unique.
- `password`: 8–72 characters. Store only `password_hash($password, PASSWORD_DEFAULT)`; check
  with `password_verify()`. Never log or return a password or hash.

**Session:** after a successful register or login call `session_regenerate_id(true)` and keep
only `$_SESSION['user_id']`. Session cookie `HttpOnly`, `SameSite=Lax`. Logout clears the
session (`$_SESSION = []`, `session_destroy()`). A suspended user (`users.status = 'suspended'`)
cannot log in and is logged out on their next request.

**Same message for wrong email and wrong password** ("Wrong email or password"), so nobody can
find out which emails are registered.

## 5. Places

| Function in `api.js` | Endpoint | Success | Errors |
|---|---|---|---|
| `getPlaces()` | `GET /api/places.php` | `200 Place[]` (only `status = 'active'`) | — |
| `getPlace(slug)` | `GET /api/places.php?slug=shwedagon-pagoda` | `200 Place` | `404 { "error": "Place not found" }` |

The exact `Place` shape is in `frontend/src/data/places.js` (21 examples you can also use as
seed data) and the field table in `frontend/HANDOFF.md`. How the database columns map to it:

| JSON | From |
|---|---|
| `name`, `township`, `address`, `description` | `{ "en": name_en, "my": name_my }` … |
| `location` | `{ "lat": latitude, "lng": longitude }` (numbers) |
| `categoryId` | `categories.slug` |
| `entryFee` | `{ "local", "foreigner", "currency" }`, or `null` when both fees are NULL |
| `contact` | `{ "phone", "website", "facebook" }` |
| `tags`, `moods` | comma-separated TEXT → JSON array |
| `openingHours` | `operating_hours` rows grouped back into `[{ "days": "mon-sun", "open": "04:00", "close": "22:00" }]`; days in a row with the same times become a range (`mon-fri`), a single day stays `mon`; no rows → `[]` |
| `rating` | `{ "average": AVG(rating) rounded to 1 decimal, "count": COUNT(*) }` from visible reviews |
| `crowd` | latest `crowd_reports` row of today: `{ "level", "reportedAt", "reports": count today }`, or `null` |
| `isFeatured` | boolean |
| `photos` | `place_images` → `[{ "url", "credit" }]` |

## Done when

- [ ] Register → logged in → reload the page → still logged in (`session.php` returns the user).
- [ ] Wrong password shows "Wrong email or password"; a used email shows the "already
      registered" message; a suspended account can't log in.
- [ ] Log out works; POST without the right `X-CSRF-Token` gets 403.
- [ ] Passwords in the database are `password_hash` strings, never plain text.
- [ ] With `USE_MOCK = false` the Explore map shows all places from MariaDB, and
      `place.html?id=<slug>` shows hours, fees, rating and crowd; a wrong slug shows "We couldn't
      find this place."
- [ ] Every query uses prepared statements.
