-- Demo seed data for POINTER (useful for checking task 2: saves, reviews, account, business).
--
-- Run it with:
--   mysql -u root -p -P 3307 pointer_db < database/seed_demo.sql
-- or paste it into the phpMyAdmin SQL tab.
--
-- Demo accounts (all use the password: pointer-demo)
--   demo@pointer.app     regular user: 3 saves + 2 reviews, no business request
--   owner@pointer.app    owner: 2 active shops + an approved 12-month plan
--   pending@pointer.app  regular user: a pending business request (+ a review of place 1)
--
-- The script is safe to run more than once: users are upserted, places are inserted only when
-- missing, and saves/reviews use INSERT IGNORE (favorites PK / uq_user_place_review).

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
-- To remove everything this script added (run manually, it is NOT active):
--
-- DELETE FROM favorites       WHERE user_id IN (SELECT id FROM users WHERE email IN ('demo@pointer.app','owner@pointer.app','pending@pointer.app'));
-- DELETE FROM reviews         WHERE user_id IN (SELECT id FROM users WHERE email IN ('demo@pointer.app','owner@pointer.app','pending@pointer.app'));
-- DELETE FROM owner_upgrades  WHERE user_id IN (SELECT id FROM users WHERE email IN ('demo@pointer.app','owner@pointer.app','pending@pointer.app'));
-- DELETE FROM places          WHERE owner_id IN (SELECT id FROM users WHERE email IN ('demo@pointer.app','owner@pointer.app','pending@pointer.app'));
-- DELETE FROM users           WHERE email IN ('demo@pointer.app','owner@pointer.app','pending@pointer.app');
-- ---------------------------------------------------------------------------
