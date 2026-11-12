# Backend task 2 — My account, saves, reviews and "Add your business"

**Owner:** backend developer 2 · **Frontend pages:** `account.html`, `place.html`, `business.html`
**Database:** the team's dbdiagram schema — tables `favourites`, `reviews`, `places`,
`operating_hours`, `place_images`, plus `users` and `categories` from task 1

Everything here needs a logged-in user. The login comes from **task 1**; until it is merged,
use a test user: in your local `include/` code, if there is no session, set
`$_SESSION['user_id'] = 1` (a row you added by hand) — and remove that line before you commit.

> Changed on 2026-11-12 (new scope document): check-ins are gone (no `history`), reviews can be
> edited, owners can't review their own shop, and the "Add your business" request is new.

## 1. Run the frontend

```bash
cd frontend
npm start
```

(Windows: double-click `frontend/start-windows.bat`.) Log in with `demo@pointer.test` /
`pointer-demo`, open http://localhost:5173/place.html?id=1, press **Save** and write a review,
then edit it. Open http://localhost:5173/account.html — your saved place and review are there.
Then open http://localhost:5173/business.html and send a request. This runs on fake data in the
browser now (`USE_MOCK = true`); your job is to make it real.

## 2. Where your code goes

- JSON endpoints in the `api/` folder at the repo root (task 1 creates it; add your files next
  to theirs). Shared helpers in `include/`, DB settings in `config/db.php`, uploads in
  `assets/upload/` (git-ignored).
- Run PHP from the repo root: `php -S localhost:8000`. The frontend dev server forwards
  `/api/...` to it.
- To test, set `USE_MOCK = false` in `frontend/src/api/config.js` **on your own machine**.
  Please don't edit other files in `frontend/` — ask the frontend lead first.

## 3. Common rules

Same as task 1, section 3: JSON in/out, `{ "error": "..." }` with the right status, the
`X-CSRF-Token` header on every POST/PUT/DELETE (compare with `$_SESSION['csrf']` using
`hash_equals`), prepared statements, ISO 8601 dates with `+06:30`.
**Not logged in → `401 { "error": "Login required" }`** on every endpoint below except
`getReviews` and `getMyPlace`.

`PlaceSummary` below means `{ "id", "name", "address", "category": { "id", "name", "icon" } }`.

## 4. Saves and reviews

| Function in `api.js` | Endpoint | Request | Success | Errors |
|---|---|---|---|---|
| `getMyPlace(placeId)` | `GET /api/my-place.php?place_id=1` | — | `{ "saved": true, "reviewId": 12 \| null }` (visitor: `false`, `null`, status 200) | — |
| `setSaved(id, true)` | `POST /api/saves.php` | `{ "placeId": 1 }` | `{ "saved": true }` (already saved → same answer) | `404` unknown place |
| `setSaved(id, false)` | `DELETE /api/saves.php?place_id=1` | — | `{ "saved": false }` | — |
| `getReviews(placeId)` | `GET /api/reviews.php?place_id=1` | — | `Review[]`, newest first (no login needed) | — |
| `addReview(placeId, …)` | `POST /api/reviews.php` | `{ "placeId", "rating": 1–5, "text" }` | `201 Review` | `422` bad rating / empty or > 600 chars · `409 { "error": "You already reviewed this place" }` · `403 { "error": "You can't review your own shop" }` (`places.owner_id` = user) |
| `updateReview(id, …)` | `PUT /api/reviews.php?id=12` | `{ "rating": 1–5, "text" }` | `Review` with `updatedAt` | `403 { "error": "Not your review" }` · `404` · `422` |
| `deleteReview(id)` | `DELETE /api/reviews.php?id=12` | — | `{ "deleted": true }` | `403 { "error": "Not your review" }` · `404` |
| `getMySaves()` | `GET /api/my-saves.php` | — | `[{ "place": PlaceSummary }]` newest first | — |
| `getMyReviews()` | `GET /api/my-reviews.php` | — | `[Review + "place": PlaceSummary]` newest first | — |

**Review shape** (also in `frontend/src/data/reviews.js`):
`{ "id", "placeId", "user": { "id", "name" }, "rating", "text", "createdAt", "updatedAt"? }` —
`text` is the `reviews.comment` column. Store what the user typed; escape it only when printing HTML.

Rules: one save and one review per user per place (`SELECT` first). Only the author can edit or
delete a review. Owners can't review their own place. The rating on `places.php` (task 1) is
calculated from `reviews`, so nothing extra to store.

## 5. "Add your business" request

| Function in `api.js` | Endpoint | Request | Success | Errors |
|---|---|---|---|---|
| `submitBusinessRequest(fields)` | `POST /api/business-requests.php` | `multipart/form-data` (below) | `201 BusinessRequest` | `409 { "error": "You already have a business request" }` · `422` invalid |
| `getMyBusinessRequest()` | `GET /api/my-business-request.php` | — | `BusinessRequest` or `null` | — |

Fields: `name` (2–100), `categoryId` (1–7), `description` (10–600), `phone` (6–20 of `0-9 + ( ) -`),
`openingHours` (JSON text, open days only: `[{ "day": "mon", "open": "06:00", "close": "11:00" }]`),
`lat`, `lng` (numbers inside Yangon: lat 16.65–17.05, lng 95.95–96.35), `photo` (one image).

`BusinessRequest` = `{ "id", "status": "pending" | "approved" | "rejected", "name", "categoryId",
"description", "phone", "openingHours", "lat", "lng", "photoUrl", "createdAt" }`.

How to store it with the team schema (no new table): insert a `places` row with
`owner_id` = the user and `status` = `'pending'`, its `operating_hours` rows, and the photo in
`place_images`. `places.php` only lists approved places. The admin approves or rejects it in
phase 3.

**Photo upload, safely:**
- Check `$_FILES['photo']['error'] === UPLOAD_ERR_OK` and size ≤ 5 MB.
- Check the real type with `finfo_file()` — only `image/jpeg`, `image/png`, `image/webp`.
- Save it under a random name (`bin2hex(random_bytes(16))` + the right extension) in
  `assets/upload/`, never the user's file name. Store the path in `place_images.image_url`.

Rules: one business per user — a user with a pending or approved request gets 409; after a
rejection they may send a new one. Ask for no licence or documents (scope doc §4).

## Done when

- [ ] With `USE_MOCK = false`: Save / Unsave on `place.html` survives a page reload.
- [ ] Writing, editing ("edited" shows) and deleting your own review works; a second review of
      the same place gets 409; editing someone else's gets 403; an owner gets 403 on their own shop.
- [ ] `account.html` shows the real saved places and reviews, newest first, and Unsave / Delete
      work there; "My business" shows the request status.
- [ ] `business.html` sends a request with a photo; the photo is stored under a random name; a
      second request gets 409; a `.txt` renamed to `.jpg` is refused.
- [ ] A visitor (logged out) gets 401 from the `my-*` endpoints and `account.html` shows
      "Your account is waiting".
- [ ] Every query uses prepared statements; no test-user code left in the commit.
