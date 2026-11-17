-- Demo seed data for POINTER (task 2 saves/reviews/account/business + task 3 deals, tickets,
-- messages, notifications, blocks and reports).
--
-- Run it with:
--   mysql -u root -p -P 3307 pointer_db < database/seed_demo.sql
-- or paste it into the phpMyAdmin SQL tab.
--
-- Demo accounts (all use the password: pointer-demo)
--   demo@pointer.app     regular user: 3 saves + 3 reviews, 2 tickets, a chat with the owner,
--                        3 notifications, no business request
--   owner@pointer.app    owner: 2 active shops (posts + deals), an approved 12-month plan and
--                        a review reply; the dashboard also has tickets to scan
--   pending@pointer.app  regular user: a pending business request (+ a review of place 1) and a
--                        used grocery ticket
--
-- The script is safe to run more than once: users are upserted, places/posts are inserted only
-- when missing, and favourites/reviews/tickets/blocks use INSERT IGNORE on their unique keys.

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

INSERT INTO users (name, email, password_hash, role, status)
VALUES
  ('Demo User', 'demo@pointer.app',    '$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe', 'user',  'active'),
  ('Mya Aung',  'owner@pointer.app',   '$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe', 'owner', 'active'),
  ('Ko Zaw',    'pending@pointer.app', '$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe', 'user',  'active')
ON DUPLICATE KEY UPDATE
  name          = VALUES(name),
  password_hash = VALUES(password_hash),
  role          = VALUES(role),
  status        = VALUES(status);

SET @demo    = (SELECT id FROM users WHERE email = 'demo@pointer.app');
SET @owner   = (SELECT id FROM users WHERE email = 'owner@pointer.app');
SET @pending = (SELECT id FROM users WHERE email = 'pending@pointer.app');

-- ---------------------------------------------------------------------------
-- Owner's active shops (they show up in places.php / the map right away)
-- ---------------------------------------------------------------------------

INSERT INTO places (category_id, owner_id, name, description, phone, open_hours, address, lat, lng, status)
SELECT 1, @owner, 'Mya Tea House',
       'Family tea shop: mohinga, samosas and milk tea, a short walk from Sule Pagoda.',
       '09 450 123 456',
       '[{"day":"mon","open":"06:30","close":"18:00"},{"day":"tue","open":"06:30","close":"18:00"},{"day":"wed","open":"06:30","close":"18:00"},{"day":"thu","open":"06:30","close":"18:00"},{"day":"fri","open":"06:30","close":"18:00"},{"day":"sat","open":"06:30","close":"18:00"},{"day":"sun","open":"06:30","close":"13:00"}]',
       'No. 12, 31st Street, Kyauktada, Yangon', 16.7794000, 96.1598000, 'active'
WHERE NOT EXISTS (SELECT 1 FROM places WHERE owner_id = @owner AND name = 'Mya Tea House');

INSERT INTO places (category_id, owner_id, name, description, phone, open_hours, address, lat, lng, status)
SELECT 4, @owner, 'Mya Grocery',
       'Neighbourhood grocery: rice, cooking oil, snacks and cold drinks. Open every day.',
       '09 450 123 457',
       '[{"day":"mon","open":"08:00","close":"20:00"},{"day":"tue","open":"08:00","close":"20:00"},{"day":"wed","open":"08:00","close":"20:00"},{"day":"thu","open":"08:00","close":"20:00"},{"day":"fri","open":"08:00","close":"20:00"},{"day":"sat","open":"08:00","close":"20:00"},{"day":"sun","open":"08:00","close":"20:00"}]',
       'No. 48, Anawrahta Road, Latha, Yangon', 16.7749000, 96.1486000, 'active'
WHERE NOT EXISTS (SELECT 1 FROM places WHERE owner_id = @owner AND name = 'Mya Grocery');

-- ---------------------------------------------------------------------------
-- A pending business request (so "My business" shows Waiting for review)
-- ---------------------------------------------------------------------------

INSERT INTO places (category_id, owner_id, name, description, phone, open_hours, address, lat, lng, status)
SELECT 1, @pending, 'Pending Noodle Shop',
       'Shan noodles and sticky rice, opening soon near the market.',
       '09 770 123 456',
       '[{"day":"mon","open":"09:00","close":"18:00"},{"day":"tue","open":"09:00","close":"18:00"},{"day":"wed","open":"09:00","close":"18:00"},{"day":"thu","open":"09:00","close":"18:00"},{"day":"fri","open":"09:00","close":"18:00"},{"day":"sat","open":"09:00","close":"18:00"}]',
       'No. 5, Anawrahta Road, Latha, Yangon', 16.7726000, 96.1512000, 'pending'
WHERE NOT EXISTS (SELECT 1 FROM places WHERE owner_id = @pending AND name = 'Pending Noodle Shop');

-- Payment for the pending request: starts_at / expires_at stay NULL until an admin approves.
INSERT INTO owner_upgrades (user_id, months, amount, payment_method, payment_ref, payment_proof, status)
SELECT @pending, 3, 40000.00, 'KBZPay', 'SEED-PENDING-001', NULL, 'pending'
WHERE NOT EXISTS (
  SELECT 1 FROM owner_upgrades WHERE user_id = @pending AND payment_ref = 'SEED-PENDING-001'
);

-- Approved 12-month plan for the owner (active subscription line on account.html).
INSERT INTO owner_upgrades (user_id, months, amount, payment_method, payment_ref, payment_proof, status, starts_at, expires_at)
SELECT @owner, 12, 150000.00, 'Wave Pay', 'SEED-OWNER-001', NULL, 'approved',
       NOW() - INTERVAL 10 DAY, NOW() + INTERVAL 355 DAY
WHERE NOT EXISTS (
  SELECT 1 FROM owner_upgrades WHERE user_id = @owner AND payment_ref = 'SEED-OWNER-001'
);

-- ---------------------------------------------------------------------------
-- Saves + reviews for the demo user
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO favorites (user_id, place_id)
SELECT @demo, id FROM places
WHERE name IN ('Shwedagon Pagoda', 'Rangoon Tea House', 'Bogyoke Aung San Market');

INSERT IGNORE INTO reviews (user_id, place_id, rating, comment)
SELECT @demo, id, 5, 'Best tea leaf salad in downtown. The staff remembered our order.'
FROM places WHERE name = 'Rangoon Tea House';

INSERT IGNORE INTO reviews (user_id, place_id, rating, comment)
SELECT @demo, id, 4, 'Good place for thanaka and souvenirs. Go early to avoid the crowd.'
FROM places WHERE name = 'Bogyoke Aung San Market';

-- Another user's review, so demo@pointer.app can check that editing it gives 403.
INSERT IGNORE INTO reviews (user_id, place_id, rating, comment)
SELECT @pending, id, 5, 'Went at sunset; the pagoda is beautiful and easy to reach.'
FROM places WHERE name = 'Shwedagon Pagoda';

-- ---------------------------------------------------------------------------
-- Shop posts and deals (posts.type: 'normal' = announcement, 'discount' = deal)
-- Only the owner's two active shops get posts: the Deals page and the owner dashboard
-- read only live shops, so posts on a pending shop would never be shown.
-- ---------------------------------------------------------------------------

SET @tea_house = (SELECT id FROM places WHERE owner_id = @owner AND name = 'Mya Tea House' ORDER BY id LIMIT 1);
SET @grocery   = (SELECT id FROM places WHERE owner_id = @owner AND name = 'Mya Grocery'   ORDER BY id LIMIT 1);

-- Deal 1: the main Mya Tea House offer (pinned, runs for 12 more days).
INSERT INTO posts (place_id, type, content, image_url, discount_text, ticket_limit, expires_at, is_pinned, created_at)
SELECT @tea_house, 'discount',
       'Hot afternoons call for iced milk tea. Show your POINTER ticket for 20% off any iced drink.',
       NULL, '20% off every iced drink', 30, NOW() + INTERVAL 12 DAY, 1, NOW() - INTERVAL 2 DAY
WHERE @tea_house IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM posts
    WHERE place_id = @tea_house
      AND content = 'Hot afternoons call for iced milk tea. Show your POINTER ticket for 20% off any iced drink.'
  );

-- Deal 2: ends in a few hours, so the "Ending soon" sort has something urgent at the top.
INSERT INTO posts (place_id, type, content, image_url, discount_text, ticket_limit, expires_at, is_pinned, created_at)
SELECT @tea_house, 'discount',
       'Thingyan week: a free samosa with every bowl of mohinga before 10 am.',
       NULL, 'Free samosa with mohinga before 10 am', 15, NOW() + INTERVAL 6 HOUR, 0, NOW() - INTERVAL 3 DAY
WHERE @tea_house IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM posts
    WHERE place_id = @tea_house
      AND content = 'Thingyan week: a free samosa with every bowl of mohinga before 10 am.'
  );

-- A normal announcement (no ticket, no expiry) on the same shop.
INSERT INTO posts (place_id, type, content, image_url, discount_text, ticket_limit, expires_at, is_pinned, created_at)
SELECT @tea_house, 'normal',
       'New: palm-sugar latte with a pinch of sea salt. Ask for it at the counter!',
       NULL, NULL, NULL, NULL, 0, NOW() - INTERVAL 5 HOUR
WHERE @tea_house IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM posts
    WHERE place_id = @tea_house
      AND content = 'New: palm-sugar latte with a pinch of sea salt. Ask for it at the counter!'
  );

-- Deal 3 + a pinned announcement for Mya Grocery.
INSERT INTO posts (place_id, type, content, image_url, discount_text, ticket_limit, expires_at, is_pinned, created_at)
SELECT @grocery, 'discount',
       'Stock up for the week: 1,000 Ks off a 5 kg bag of rice with your POINTER ticket.',
       NULL, '1,000 Ks off a 5 kg bag of rice', 25, NOW() + INTERVAL 5 DAY, 0, NOW() - INTERVAL 1 DAY
WHERE @grocery IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM posts
    WHERE place_id = @grocery
      AND content = 'Stock up for the week: 1,000 Ks off a 5 kg bag of rice with your POINTER ticket.'
  );

INSERT INTO posts (place_id, type, content, image_url, discount_text, ticket_limit, expires_at, is_pinned, created_at)
SELECT @grocery, 'normal',
       'Open every day 8:00-20:00, also on public holidays. Cold drinks are restocked every morning.',
       NULL, NULL, NULL, NULL, 1, NOW() - INTERVAL 4 DAY
WHERE @grocery IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM posts
    WHERE place_id = @grocery
      AND content = 'Open every day 8:00-20:00, also on public holidays. Cold drinks are restocked every morning.'
  );

SET @tea_deal     = (SELECT id FROM posts WHERE place_id = @tea_house AND type = 'discount' AND content LIKE 'Hot afternoons call for iced milk tea.%' ORDER BY id LIMIT 1);
SET @samosa_deal  = (SELECT id FROM posts WHERE place_id = @tea_house AND type = 'discount' AND content LIKE 'Thingyan week:%' ORDER BY id LIMIT 1);
SET @grocery_deal = (SELECT id FROM posts WHERE place_id = @grocery AND type = 'discount' AND content LIKE 'Stock up for the week:%' ORDER BY id LIMIT 1);

-- ---------------------------------------------------------------------------
-- Tickets (one per user per post: uq_user_post_ticket)
-- demo has an unused ticket and an old expired one; pending has a used one.
-- The owner therefore has codes to look up with "Scan QR".
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO tickets (user_id, post_id, ticket_code, status, used_at, created_at)
SELECT @demo, @tea_deal, 'MT-7Q4K', 'unused', NULL, NOW() - INTERVAL 30 MINUTE
WHERE @tea_deal IS NOT NULL;

INSERT IGNORE INTO tickets (user_id, post_id, ticket_code, status, used_at, created_at)
SELECT @demo, @grocery_deal, 'MG-3PX8', 'expired', NULL, NOW() - INTERVAL 1 DAY
WHERE @grocery_deal IS NOT NULL;

INSERT IGNORE INTO tickets (user_id, post_id, ticket_code, status, used_at, created_at)
SELECT @pending, @grocery_deal, 'MG-H2NM', 'used', NOW() - INTERVAL 2 HOUR, NOW() - INTERVAL 4 HOUR
WHERE @grocery_deal IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Reviews on the demo shops (with an owner reply on the first one)
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO reviews (user_id, place_id, rating, comment, owner_reply)
SELECT @demo, @tea_house, 5,
       'The mohinga is rich and the tea is strong. Cheap, clean and quick.',
       'Thank you! Tell the counter you came from POINTER and the refill is on us.'
WHERE @tea_house IS NOT NULL;

INSERT IGNORE INTO reviews (user_id, place_id, rating, comment)
SELECT @pending, @grocery, 4,
       'Good prices and the staff helped me carry the rice to the car.'
WHERE @grocery IS NOT NULL;

SET @tea_review = (SELECT id FROM reviews WHERE user_id = @demo AND place_id = @tea_house ORDER BY id LIMIT 1);

-- ---------------------------------------------------------------------------
-- A conversation between demo and the owner (messages.status 'accepted')
-- ---------------------------------------------------------------------------

INSERT INTO messages (sender_id, receiver_id, body, status, is_read, created_at)
SELECT @owner, @demo,
       'Hi! Thanks for saving Mya Tea House. Ask us anything about the menu.',
       'accepted', 0, NOW() - INTERVAL 5 HOUR
WHERE @owner IS NOT NULL AND @demo IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM messages
    WHERE sender_id = @owner AND receiver_id = @demo
      AND body = 'Hi! Thanks for saving Mya Tea House. Ask us anything about the menu.'
  );

INSERT INTO messages (sender_id, receiver_id, body, status, is_read, created_at)
SELECT @demo, @owner,
       'Thanks! Do you still have the palm-sugar latte?',
       'accepted', 1, NOW() - INTERVAL 4 HOUR
WHERE @owner IS NOT NULL AND @demo IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM messages
    WHERE sender_id = @demo AND receiver_id = @owner
      AND body = 'Thanks! Do you still have the palm-sugar latte?'
  );

INSERT INTO messages (sender_id, receiver_id, body, status, is_read, created_at)
SELECT @owner, @demo,
       'Yes, every day until 6 pm. Show your ticket for 20% off.',
       'accepted', 0, NOW() - INTERVAL 3 HOUR
WHERE @owner IS NOT NULL AND @demo IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM messages
    WHERE sender_id = @owner AND receiver_id = @demo
      AND body = 'Yes, every day until 6 pm. Show your ticket for 20% off.'
  );

SET @welcome_message = (SELECT id FROM messages WHERE sender_id = @owner AND receiver_id = @demo ORDER BY id LIMIT 1);

-- ---------------------------------------------------------------------------
-- Notifications for the demo user (new deal, message, review reply)
-- ---------------------------------------------------------------------------

INSERT INTO notifications (user_id, type, ref_id, is_read, created_at)
SELECT @demo, 'new_deal', @tea_deal, 0, NOW() - INTERVAL 2 DAY
WHERE @tea_deal IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM notifications WHERE user_id = @demo AND type = 'new_deal' AND ref_id = @tea_deal
  );

INSERT INTO notifications (user_id, type, ref_id, is_read, created_at)
SELECT @demo, 'message', @welcome_message, 0, NOW() - INTERVAL 5 HOUR
WHERE @welcome_message IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM notifications WHERE user_id = @demo AND type = 'message' AND ref_id = @welcome_message
  );

INSERT INTO notifications (user_id, type, ref_id, is_read, created_at)
SELECT @demo, 'review_reply', @tea_review, 1, NOW() - INTERVAL 1 HOUR
WHERE @tea_review IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM notifications WHERE user_id = @demo AND type = 'review_reply' AND ref_id = @tea_review
  );

-- ---------------------------------------------------------------------------
-- Blocked user + open report, so the customer safety pages have sample rows.
-- demo blocked the pending user (the pending shop disappears for demo).
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO blocks (blocker_id, blocked_id)
SELECT @demo, @pending
WHERE @demo IS NOT NULL AND @pending IS NOT NULL;

SET @spam_review = (
  SELECT r.id FROM reviews r
  JOIN places p ON p.id = r.place_id
  WHERE r.user_id = @pending AND p.name = 'Shwedagon Pagoda'
  ORDER BY r.id LIMIT 1
);

INSERT INTO reports (reporter_id, target_type, target_id, reason, status, created_at)
SELECT @demo, 'review', @spam_review, 'The review is copied from another website.', 'open', NOW() - INTERVAL 6 HOUR
WHERE @spam_review IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM reports WHERE reporter_id = @demo AND target_type = 'review' AND target_id = @spam_review
  );

-- ---------------------------------------------------------------------------
-- To remove everything this script added (run manually, it is NOT active):
--
-- DELETE FROM tickets         WHERE user_id IN (SELECT id FROM users WHERE email IN ('demo@pointer.app','owner@pointer.app','pending@pointer.app'));
-- DELETE FROM notifications   WHERE user_id IN (SELECT id FROM users WHERE email IN ('demo@pointer.app','owner@pointer.app','pending@pointer.app'));
-- DELETE FROM blocks          WHERE blocker_id IN (SELECT id FROM users WHERE email IN ('demo@pointer.app','owner@pointer.app','pending@pointer.app')) OR blocked_id IN (SELECT id FROM users WHERE email IN ('demo@pointer.app','owner@pointer.app','pending@pointer.app'));
-- DELETE FROM reports         WHERE reporter_id IN (SELECT id FROM users WHERE email IN ('demo@pointer.app','owner@pointer.app','pending@pointer.app'));
-- DELETE FROM messages        WHERE sender_id IN (SELECT id FROM users WHERE email IN ('demo@pointer.app','owner@pointer.app','pending@pointer.app')) OR receiver_id IN (SELECT id FROM users WHERE email IN ('demo@pointer.app','owner@pointer.app','pending@pointer.app'));
-- DELETE FROM favorites       WHERE user_id IN (SELECT id FROM users WHERE email IN ('demo@pointer.app','owner@pointer.app','pending@pointer.app'));
-- DELETE FROM reviews         WHERE user_id IN (SELECT id FROM users WHERE email IN ('demo@pointer.app','owner@pointer.app','pending@pointer.app'));
-- DELETE FROM owner_upgrades  WHERE user_id IN (SELECT id FROM users WHERE email IN ('demo@pointer.app','owner@pointer.app','pending@pointer.app'));
-- DELETE FROM places          WHERE owner_id IN (SELECT id FROM users WHERE email IN ('demo@pointer.app','owner@pointer.app','pending@pointer.app')); -- cascades posts + their tickets
-- DELETE FROM users           WHERE email IN ('demo@pointer.app','owner@pointer.app','pending@pointer.app');
-- ---------------------------------------------------------------------------
