# Backend task 3 — Shop Owner Portal APIs

**Owner / Assignee:** `@ht3th5612-cell`  
**Frontend Pages:** `owner.html` (`src/pages/owner.js`), `business.html` (`src/pages/business.js`)  
**Frontend API Module:** `src/api/owner.js`  
**Database Tables:** `places`, `owner_upgrades`, `posts`, `tickets`, `reviews`, `users`

---

## 1. Overview & Context

This task covers the complete backend implementation for POINTER's **Shop Owner Portal** (flowcharts 3, 3a–3c in `docs/flows/`).
A user whose shop application has been approved by an administrator gets access to Owner Mode via **My Account → Owner Mode** (`/owner.html`).

In Owner Mode, merchants can:
1. View real-time shop performance metrics and subscription countdown.
2. Publish regular announcements or discount deals with customer ticket quotas.
3. Validate and redeem customer discount tickets at the counter (or via camera QR scanner).
4. Reply directly to customer reviews on their shop profile.
5. Update shop operational details (description, contact phone, operating hours).
6. Submit subscription renewal payments when their plan is nearing expiration or has lapsed.

---

## 2. API Endpoints Specification

### 2.1 Owner Dashboard Overview
* **Endpoint:** `GET /api/owner/dashboard.php`
* **Access Control:** Logged-in user who owns an approved shop (`places.owner_id = $_SESSION['user_id']`).
* **Success Response (`200 OK`):**
  ```json
  {
    "place": {
      "id": 20,
      "name": "Golden Bean Café",
      "address": "No. 45, Kandawgyi Ring Road, Bahan, Yangon",
      "category": { "id": 1, "name": "Food & drink", "nameMy": "စားသောက်ဆိုင်", "group": "food" },
      "phone": "09 5123 4567",
      "description": "Demo shop: a cosy café near Kandawgyi...",
      "openingHours": [
        { "day": "mon", "open": "08:00", "close": "21:00" }
      ]
    },
    "subscription": {
      "months": 3,
      "startsAt": "2026-11-15T09:00:00+06:30",
      "expiresAt": "2027-02-15T23:59:59+06:30",
      "active": true,
      "daysLeft": 88
    },
    "pending": false,
    "stats": {
      "posts": 4,
      "activeDeals": 2,
      "ticketsTaken": 15,
      "ticketsUsed": 10,
      "rating": { "average": 4.7, "count": 3 }
    },
    "posts": [ /* Post objects */ ],
    "reviews": [ /* Review objects with owner_reply */ ]
  }
  ```
* **Error Responses:**
  - `401 Unauthorized`: Not logged in.
  - `403 Forbidden`: User has no approved shop (`{ "error": "You have no shop yet" }`).

---

### 2.2 Posts & Discount Deals Management
* **Create Post:** `POST /api/owner/posts.php` (`multipart/form-data`)
  - **Required Subscription:** Must have `owner_upgrades.expires_at > NOW()`. If expired, return `403 { "error": "Your subscription is not active" }`.
  - **Parameters:**
    - `type`: `'normal'` (announcement) or `'discount'` (deal with tickets).
    - `content`: Text content (max 1000 characters).
    - `image`: Optional cover image upload (saved to `uploads/posts/`).
    - *For discounts:* `discountText` (varchar 255), `ticketLimit` (integer 1–500), `expiresAt` (ISO future datetime).
  - **Response (`201 Created`):** Returns the created Post object.
* **Update Post:** `PUT /api/owner/posts.php?id={id}`
  - Edit `content`, `discountText`, `ticketLimit`, `expiresAt`, or `isPinned`.
  - Verify that `posts.place_id` belongs to the logged-in owner.
* **Delete Post:** `DELETE /api/owner/posts.php?id={id}`
  - Soft or hard delete the post. Note: Customer tickets already claimed remain valid until their 2-hour expiration window lapses.

---

### 2.3 Ticket Validation & Redemption at Store Counter
* **Check Ticket (Inspection without using):** `GET /api/owner/ticket.php?code={code}`
  - Used by cashiers when typing a code (e.g. `GB-8X2M`) or scanning a QR code with the camera.
  - **Lookup Logic:**
    - `ok`: Valid ticket for this shop, status is `'unused'`, and `created_at + 2 hours > NOW()`.
    - `not_found`: Code does not exist in `tickets` table.
    - `other_shop`: Ticket belongs to another establishment.
    - `used`: Already redeemed at `tickets.used_at`.
    - `expired`: More than 2 hours have passed since creation.
  - **Response (`200 OK`):**
    ```json
    {
      "result": "ok",
      "ticket": { "id": 1, "code": "GB-8X2M", "status": "active", "userName": "Demo user" },
      "post": { "id": 2, "discountText": "20% off all iced espresso" }
    }
    ```
* **Confirm / Redeem Ticket:** `POST /api/owner/ticket.php`
  - Body: `{ "code": "GB-8X2M" }`
  - Executes atomic redemption query:
    ```sql
    UPDATE tickets 
    SET status = 'used', used_at = NOW() 
    WHERE ticket_code = :code AND status = 'unused' AND created_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR);
    ```
  - Returns `200 { "result": "used", "ticket": { ... } }`.

---

### 2.4 Review Replies
* **Endpoint:** `PUT /api/owner/review-reply.php?id={reviewId}`
* **Body:** `{ "reply": "Thank you for visiting! We look forward to seeing you again." }`
* **Rules:**
  - Updates `reviews.owner_reply = :reply`.
  - Ensure the review belongs to the owner's place.
  - Max 600 characters. Owners cannot delete customer reviews or alter ratings.

---

### 2.5 Operational Place Details Update
* **Endpoint:** `PUT /api/owner/place.php`
* **Body:** `{ "description": "...", "phone": "09...", "address": "...", "openingHours": [...] }`
* **Rules:**
  - Updates `places.description`, `places.phone`, `places.address`, `places.open_hours`.
  - Place Name, Category, and Map GPS coordinates remain protected and can only be altered by an Administrator.

---

### 2.6 Subscription Renewal Submission
* **Endpoint:** `POST /api/owner/renew.php` (`multipart/form-data`)
* **Parameters:**
  - `months`: `1`, `3`, or `12`.
  - `amount`: `15000`, `40000`, or `150000`.
  - `paymentMethod`: `'KBZPay'`, `'Wave Pay'`, or `'AYA Pay'`.
  - `paymentRef`: Transaction / Slip reference ID.
  - `proof`: Screenshot of the payment transaction.
* **Database Action:**
  - Inserts into `owner_upgrades` with `status = 'pending'`, `user_id = $_SESSION['user_id']`.
  - Admin will review and approve via `admin/application.html`.

---

## 3. Definition of Done & Verification Checklist
- [ ] All endpoints enforce session verification and reject unauthorized requests with `401` or `403`.
- [ ] Every query uses PDO prepared statements with `utf8mb4`.
- [ ] Switching `USE_MOCK = false` in `src/api/config.js` allows `owner.html` to load live data seamlessly.
- [ ] Ticket code input and QR code scanner validate valid/used/expired states accurately.
- [ ] Owner replies appear immediately under customer reviews on `place.html`.
