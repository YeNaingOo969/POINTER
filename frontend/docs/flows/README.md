# POINTER flowcharts

Clean versions of the team's rough flowcharts (2026-11-14), checked step by step against the
database diagram (ER v2, 15 tables) and the frontend. Every box that saves something names the
table and column (the cylinder shapes), so the flowcharts, the ER and the code say the same thing.

Each big flowchart is split into a small **menu** (the main choices) and one page per branch, so every
picture stays readable. Boxes like `→ 2b` say where the flow goes next.

| File | Shows |
|---|---|
| `1a-sign-in` | Guest, "Log in to continue", register, sign in |
| `1b-roles` | Blocked users and appeals, routing by role and mode |
| `2-customer-menu` | Customer main menu → 2a–2e |
| `2a-find-place` | Search, place detail, directions, call, save, review, report, block |
| `2b-deals-tickets` | Deals, getting and showing a ticket |
| `2c-messages` | Blocked check, message requests |
| `2d-my-account` | Saved places, reviews, tickets, business status, blocked list |
| `2e-add-business` | Shop info, plan and payment, waiting for review |
| `3-owner-menu` | Subscription check, renewal, dashboard → 3a–3c |
| `3a-posts` | Normal and discount posts, pin, manage |
| `3b-confirm-ticket` | Checking a customer's ticket |
| `3c-place-reviews-messages` | Edit place, reply to reviews, messages, blocking |
| `4-admin-menu` | Admin dashboard → 4a–4d, audit log on every change |
| `4a-applications` | New shops and renewals: shop check, payment check, refund |
| `4b-shops-categories` | View, edit, hide shops; add public places; categories |
| `4c-reports-appeals` | Reports and appeals |
| `4d-users-log` | Block / unblock users, audit log |
| `5-system` | Automatic checks: what is visible, renewal reminders, ticket expiry |

Each comes as `.mmd` (the source), `.svg` and `.png`. To edit: change the `.mmd` text, or open
draw.io → Arrange → Insert → Advanced → Mermaid and paste it.

## What changed from the rough version

1. **Guest:** can keep browsing and leave; a member action (save, review, ticket, message, add business)
   opens the "Log in to continue" dialog.
2. **Register** logs the user straight in (as the frontend does) instead of asking them to sign in again.
3. **Wrong password** shows an error and lets them try again. There is no "reset password" — it would
   need a password-reset table and email sending, which the ER doesn't have.
4. **Owner mode** only appears for a user whose place is approved and whose subscription is active.
5. **Place detail** also has Directions, Call and Message the shop; reviewing your own shop is blocked;
   **My account** (saved places, reviews, tickets, business status, blocked list) is a branch.
6. **Block a shop** = block its owner (`blocks.blocked_id = places.owner_id`), because `blocks` holds users.
7. **Appeals** are stored in `reports` with `target_type = 'appeal'` (no separate table needed).
8. **Ticket check** (owner): the ticket must belong to one of *my* posts, be `active` and be less than
   2 hours old (`created_at + 2 h`). Tickets have no `expires_at` column — the 2 hours are counted.
9. **Renewal reminder** 7 days before `expires_at`, and a dashboard showing days left.
10. **Admin** checks the shop first (photo vs map pin), then the payment; a rejected new shop is refunded
    outside the app. Renewals skip the shop check.
11. **Every admin action** writes `audit_log`.
12. **Flowchart 5** (new) lists the automatic rules: what is visible, reminders, ticket expiry.

## Rules the backend must follow (one meaning everywhere)

| Rule | Tables / columns |
|---|---|
| Status values | `users.status`: active · blocked — `places.status`: pending · approved · rejected · hidden — `owner_upgrades.status`: pending · approved · rejected — `tickets.status`: active · used · expired — `messages.status`: request · accepted — `reports.status`: open · closed |
| A place is visible when | `places.status = approved` **and** (`owner_id` is NULL **or** the owner's latest approved `owner_upgrades.expires_at > now`) **and** the owner is not blocked |
| Paying | sent **with** the "Add your business" request (team decision, flowchart 2): `owner_upgrades` row with `months` (1 / 3 / 6 / 12), `amount`, `payment_method`, `payment_ref`, `payment_proof` |
| Approving | `owner_upgrades.status = approved`, `admin_id`, `reviewed_at`, `starts_at = now` (renewal: the old `expires_at`), `expires_at = starts_at + months` |
| One business per user | a user with a `pending` or `approved` place can't send another request |
| Reviews | one per user per place (unique `user_id, place_id`); owners can't review their own place and can't delete reviews, only reply (`owner_reply`) |
| Tickets | one per user per discount post; none after `posts.expires_at` or when `ticket_limit` is reached |
| Messages | none between users when either has blocked the other; a first message is a `request` until accepted |
| Owner numbers | "tickets taken vs ticket_limit" (from `tickets`) — there is no table for counting direction clicks |

## ER notes for the team (please decide)

- **`places.owner_id` is NOT NULL in the diagram**, but 19 of our 21 places (pagodas, parks, the hospital…)
  and every "public place" the admin adds have no owner. Please make it **nullable** (NULL = run by the admin).
- `reports.target_type` is `varchar(10)`: values `place`, `post`, `review`, `user`, `message`, `appeal` fit.
