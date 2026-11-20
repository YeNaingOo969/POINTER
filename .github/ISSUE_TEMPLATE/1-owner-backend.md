---
name: "[Backend] Shop Owner Portal APIs"
about: Backend tasks for ht3th5612-cell (Owner Dashboard, Posts, Tickets, Reviews)
title: "[Backend] Implement Shop Owner Portal APIs (Dashboard, Posts, Ticket Validation & Renewals)"
labels: backend, enhancement, owner-portal
assignees: ht3th5612-cell
---

## Task Overview
Implement the complete backend API suite for the **Shop Owner Portal** (`owner.html` and `business.html`), enabling registered shop merchants to manage their stores, publish posts and discount deals, validate customer tickets at the counter, reply to reviews, and renew store subscriptions.

**Assignee:** @ht3th5612-cell
**Frontend Pages:** `owner.html` (`src/pages/owner.js`), `business.html` (`src/pages/business.js`)
**Frontend API Module:** `src/api/owner.js`
**Database Tables:** `places`, `owner_upgrades`, `posts`, `tickets`, `reviews`, `users`

---

## Endpoints to Implement

### 1. `GET /api/owner/dashboard.php`
- **Auth:** Requires logged-in owner (`places.owner_id = $_SESSION['user_id']`).
- **Response `200`:**
  ```json
  {
    "place": { "id": 20, "name": "Golden Bean Café", "address": "...", "category": 1, "phone": "...", "description": "...", "open_hours": [...] },
    "subscription": { "months": 3, "startsAt": "...", "expiresAt": "...", "active": true, "daysLeft": 45 },
    "pending": false,
    "stats": { "posts": 4, "activeDeals": 2, "ticketsTaken": 15, "ticketsUsed": 10, "rating": { "average": 4.7, "count": 3 } },
    "posts": [ ... ],
    "reviews": [ ... ]
  }
  ```
- **Errors:** `401` Unauthorized, `403` No approved shop for this user.

### 2. `POST /api/owner/posts.php` (multipart/form-data)
- **Auth:** Requires owner with active subscription (`expires_at > NOW()`).
- **Input:** `type` ("normal" | "discount"), `content` (text), `image` (optional file upload to `uploads/posts/`).
- **For Discounts:** `discountText` (string), `ticketLimit` (integer 1–500), `expiresAt` (ISO datetime).
- **Database:** Insert into `posts` table (`place_id`, `type`, `content`, `image_url`, `discount_text`, `ticket_limit`, `expires_at`).
- **Response:** `201 Post`

### 3. `PUT /api/owner/posts.php?id={id}` & `DELETE /api/owner/posts.php?id={id}`
- Edit content, discount parameters, or toggle `isPinned`.
- Delete post (existing claimed tickets remain valid until their expiration).
- Verify `posts.place_id` belongs to the authenticated owner.

### 4. `GET /api/owner/ticket.php?code={code}` (Counter / QR Validation)
- Counter lookup without consuming the ticket.
- **Lookup Logic:**
  - `ok`: Valid ticket for this shop, status `unused`, within 2-hour window (`created_at + 2h > NOW()`).
  - `not_found`: Code does not exist in `tickets` table.
  - `other_shop`: Ticket belongs to a deal from another shop.
  - `used`: Already redeemed (`status = "used"`).
  - `expired`: Expired past 2 hours.
- **Response:** `{ "result": "ok" | "not_found" | "other_shop" | "used" | "expired", "ticket": { ... }, "post": { ... } }`

### 5. `POST /api/owner/ticket.php` `{ "code": "..." }` (Redeem Ticket)
- Atomic ticket redemption:
  `UPDATE tickets SET status = 'used', used_at = NOW() WHERE ticket_code = :code AND status = 'unused'`
- **Response:** `200 { "result": "used", "ticket": { ... } }`

### 6. `PUT /api/owner/review-reply.php?id={id}` `{ "reply": "..." }`
- Updates `reviews.owner_reply = :reply`.
- Only for reviews on the owner's shop. Max 600 characters.

### 7. `PUT /api/owner/place.php` `{ "description", "phone", "address", "openingHours" }`
- Updates editable details in `places` table. (Name, category, and map lat/lng remain admin-controlled).

### 8. `POST /api/owner/renew.php` (multipart/form-data)
- Fields: `months` (1, 3, 12), `amount`, `paymentMethod` (KBZPay, Wave Pay, AYA Pay), `paymentRef`, `proof` (screenshot image).
- Inserts new row into `owner_upgrades` with `status = 'pending'` for admin approval.

---

## Acceptance Criteria
- [ ] All endpoints require valid session and CSRF token (`X-CSRF-Token`).
- [ ] All database queries use PDO prepared statements with `utf8mb4`.
- [ ] Setting `USE_MOCK = false` in `src/api/config.js` allows the owner dashboard to fully function.
- [ ] Ticket verification and QR scanning work reliably at the counter.
