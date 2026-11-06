# Database changes (from the team diagram to `pointer.dbml`)

The team diagram was a good base; these changes make it match what the frontend already shows
and sends (`HANDOFF.md`, `src/data/places.js`). Open `pointer.dbml` in
[dbdiagram.io](https://dbdiagram.io) (Import → DBML, or paste it) to see the new diagram and
export the SQL.

## Must-have (the frontend needs these)

| Table | Change | Why |
|---|---|---|
| `places` | + `slug` (unique) | Place pages use `place.html?id=<slug>`. |
| `places` | `name`, `address` → `name_en`/`name_my`, `address_en`/`address_my`; + `township_en`/`_my`, `description_en`/`_my` | The site switches between English and Burmese. |
| `places` | + `entry_fee_local`, `entry_fee_foreigner`, `currency`, `price_level`, `phone`, `website`, `facebook`, `tags`, `is_featured`, `custom_category`, `moods` | Shown on the place card / detail page and used by search. |
| `crowd_reports` | new | "Busy · reported 17:10" and the crowd report buttons. |
| `reports` | new | The admin queue: reported reviews, posts and promotions are kept or removed. |
| `users` | + `status` (active / suspended), `avatar_url`, `updated_at` | Admins can suspend a user. |
| all | Unique columns are `VARCHAR(191)` | MariaDB 10.1 + `utf8mb4`: a unique index on `VARCHAR(255)` fails (767-byte limit). |

## Should-have

| Table | Change | Why |
|---|---|---|
| `history` → `check_ins` | renamed, `visited_at` → `checked_in_at`, unique (user, place) | These are the Food Passport stamps. |
| `favourites` | + `created_at`, unique (user, place) | A place can only be saved once. |
| `reviews` | `comment` is `VARCHAR(600)`; + `status`, `updated_at`; unique (user, place) | One review per user per place (they can edit it); admins can remove it. |
| `categories` | `name` → `name_en`/`name_my`; + `slug`, `color`, `sort_order` | Bilingual, and the frontend refers to categories by slug. |
| `place_images` | + `credit`, `source_url`, `sort_order`, `created_at` | Place pages use real photos only, so every photo needs its source. |
| `operating_hours` | `day_of_week` is `mon`…`sun`; rules in the table note | Matches the frontend; covers "closes after midnight" and "open 24 hours". |
| `place_posts` | + `user_id`, `status` | Who posted, and admins can remove a reported post. |
| `promotions` | `status` is active / ended / removed | Promotions go live without approval; removal happens through reports. |
| `places.latitude/longitude` | `DECIMAL(9,6)` | Enough for ~10 cm. |

## Not changed / optional

- `messages` and `user_redeems` are kept, in an **optional** group: chat and promo-code
  redemption are not in the sitemap yet. Decide as a team whether we build them.
- `membership_type` / `membership_expires_at` are kept for a **business premium** tier
  (more posts, gold map bubble, listed first). A user's **Explorer level** is not stored: it is
  counted from `check_ins`.
- Ratings (`average`, `count`) are calculated from `reviews`, not stored on `places`.

## Notes for the PHP code

- PDO with prepared statements everywhere; `password_hash()` / `password_verify()`.
- Connection charset `utf8mb4`; all tables InnoDB with the foreign keys from the diagram.
- Return dates as ISO 8601 with the Yangon offset, e.g. `2026-11-10T17:20:00+06:30`.
- Lists stored as comma-separated `TEXT` (`tags`, `moods`, `ybs_lines`, `facilities`) go out as
  JSON arrays.
