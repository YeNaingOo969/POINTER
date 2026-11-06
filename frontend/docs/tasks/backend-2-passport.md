# Backend task 2 — My Passport, saves, check-ins and reviews

**Owner:** backend developer 2 · **Frontend pages:** `passport.html`, `place.html`
**Database:** `frontend/docs/database/pointer.dbml` (tables `favourites`, `check_ins`, `reviews`, plus
`users` and `places` from task 1)

Everything here needs a logged-in user. The login comes from **task 1**; until it is merged,
use a test user: in your local `include/` code, if there is no session, set
`$_SESSION['user_id'] = 1` (a row you added by hand) — and remove that line before you commit.

## 1. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173/place.html?id=shwedagon-pagoda: press **Save**, **Check in** and
write a review (log in with `demo@pointer.test` / `pointer-demo`). Then open
http://localhost:5173/passport.html — your saved place, stamp and review are there. This runs
on fake data in the browser now (`USE_MOCK = true`); your job is to make it real.

## 2. Where your code goes

- JSON endpoints in the `api/` folder at the repo root (task 1 creates it; add your files next
  to theirs). Shared helpers in `include/`, DB settings in `config/db.php`.
- Run PHP from the repo root: `php -S localhost:8000`. The frontend dev server forwards
  `/api/...` to it.
- To test, set `USE_MOCK = false` in `frontend/src/api/config.js` **on your own machine**.
  Please don't edit other files in `frontend/` — ask the frontend lead first.

## 3. Common rules

Same as task 1, section 3: JSON in/out, `{ "error": "..." }` with the right status, the
`X-CSRF-Token` header on every POST/DELETE (compare with `$_SESSION['csrf']` using
`hash_equals`), prepared statements, ISO 8601 dates with `+06:30`.
**Not logged in → `401 { "error": "Login required" }`** on every endpoint below.

`PlaceSummary` below means `{ "id", "slug", "name": { "en", "my" }, "township": { "en", "my" }, "categoryId" }`.

## 4. Endpoints

| Function in `api.js` | Endpoint | Request | Success | Errors |
|---|---|---|---|---|
| `getMyPlace(placeId)` | `GET /api/my-place.php?place_id=1` | — | `{ "saved": true, "checkedInAt": "2026-11-05T18:02:00+06:30" \| null }` (visitor: `false`, `null`, status 200) | — |
| `setSaved(id, true)` | `POST /api/saves.php` | `{ "placeId": 1 }` | `{ "saved": true }` | `404` unknown place |
| `setSaved(id, false)` | `DELETE /api/saves.php?place_id=1` | — | `{ "saved": false }` | — |
| `checkIn(placeId)` | `POST /api/checkins.php` | `{ "placeId": 1 }` | `{ "checkedInAt": "..." }` (already checked in → return the first time, 200) | `404` unknown place |
| `getReviews(placeId)` | `GET /api/reviews.php?place_id=1` | — | `Review[]`, newest first, only `status = 'visible'` (no login needed) | — |
| `addReview(placeId, …)` | `POST /api/reviews.php` | `{ "placeId", "rating": 1–5, "text" }` | `201 Review` | `422` bad rating / empty or > 600 chars text · `409 { "error": "You already reviewed this place" }` |
| `deleteReview(id)` | `DELETE /api/reviews.php?id=12` | — | `{ "deleted": true }` | `403 { "error": "Not your review" }` · `404` |
| `getMySaves()` | `GET /api/my-saves.php` | — | `[{ "place": PlaceSummary, "savedAt" }]` newest first | — |
| `getMyCheckIns()` | `GET /api/my-checkins.php` | — | `[{ "place": PlaceSummary, "checkedInAt" }]` newest first | — |
| `getMyReviews()` | `GET /api/my-reviews.php` | — | `[Review + "place": PlaceSummary]` newest first | — |

**Review shape** (also in `frontend/src/data/reviews.js`):
`{ "id", "placeId", "user": { "id", "name" }, "rating", "text", "createdAt" }` — `text` is the
`reviews.comment` column. Store what the user typed; escape it only when printing HTML.

**Rules:**

- One save, one check-in and one review per user per place (the unique keys in the database
  enforce it — catch the duplicate-key error and answer as in the table).
- Deleting a review: only its author can (check `user_id` against the session).
- Adding or deleting a review changes the place's rating, which `places.php` (task 1)
  calculates from `reviews` — nothing extra to store.

## Done when

- [ ] With `USE_MOCK = false`: Save / Unsave and Check in on `place.html` survive a page reload.
- [ ] `passport.html` shows the real saved places, stamps and reviews of the logged-in user,
      newest first, and Unsave / Delete work there.
- [ ] A second review of the same place gets 409; deleting someone else's review gets 403.
- [ ] A visitor (logged out) gets 401 from the `my-*` endpoints and `passport.html` shows
      "Your passport is waiting".
- [ ] Every query uses prepared statements; no test-user code left in the commit.
