-- Sample data enrichment for User Account and Owner Account
USE pointer_db;

-- 1. Ensure owner_upgrades has months and amount
UPDATE owner_upgrades u 
JOIN plans p ON p.id = u.plan_id 
SET u.months = p.months, u.amount = p.amount;

-- 2. Ensure User 1 (Ye Naing Oo) has active VIP subscription
INSERT INTO owner_upgrades (user_id, plan_id, months, amount, payment_method, payment_ref, status, starts_at, expires_at, admin_id, reviewed_at, created_at)
VALUES (1, 3, 6, 55000.00, 'KBZPay', 'KPAY-YNO-GOLD', 'approved', '2026-11-15 09:00:00', '2027-05-15 23:59:59', 18, '2026-11-15 10:00:00', '2026-11-15 09:00:00')
ON DUPLICATE KEY UPDATE status = 'approved', expires_at = '2027-05-15 23:59:59';

-- 3. Ensure User 6 (Demo User) has an active boutique shop (Place 36) and active VIP subscription
UPDATE places SET owner_id = 6, status = 'active' WHERE id = 36;

INSERT INTO owner_upgrades (user_id, plan_id, months, amount, payment_method, payment_ref, status, starts_at, expires_at, admin_id, reviewed_at, created_at)
VALUES (6, 2, 3, 30000.00, 'KBZPay', 'KPAY-DEMO-VIP', 'approved', '2026-11-16 09:00:00', '2027-03-16 23:59:59', 18, '2026-11-16 10:00:00', '2026-11-16 09:00:00')
ON DUPLICATE KEY UPDATE status = 'approved', expires_at = '2027-03-16 23:59:59';

-- 4. Favorites (Saved Places) for User 1 (Ye Naing Oo)
INSERT IGNORE INTO favorites (user_id, place_id, created_at) VALUES
  (1, 1, '2026-11-15 10:00:00'),
  (1, 15, '2026-11-15 11:30:00'),
  (1, 17, '2026-11-16 09:15:00'),
  (1, 25, '2026-11-16 14:20:00'),
  (1, 28, '2026-11-17 16:45:00'),
  (1, 8, '2026-11-18 08:30:00'),
  (1, 12, '2026-11-18 13:00:00');

-- 5. Favorites for User 7 (Mya Aung)
INSERT IGNORE INTO favorites (user_id, place_id, created_at) VALUES
  (7, 1, '2026-11-15 10:00:00'),
  (7, 20, '2026-11-15 11:30:00'),
  (7, 12, '2026-11-16 09:15:00'),
  (7, 6, '2026-11-16 14:20:00'),
  (7, 21, '2026-11-17 16:45:00'),
  (7, 18, '2026-11-18 08:30:00');

-- 6. Reviews written by User 1 (Ye Naing Oo)
INSERT INTO reviews (place_id, user_id, rating, comment, owner_reply, created_at) VALUES
  (1, 1, 5, 'Majestic spiritual sanctuary. The evening atmosphere around the stupa during sunset is unforgettable.', NULL, '2026-11-15 17:30:00'),
  (15, 1, 5, 'Classic colonial elegance. Their afternoon high tea and heritage architecture are world-class.', 'Thank you for your visit! We look forward to welcoming you back to The Strand.', '2026-11-16 15:45:00'),
  (17, 1, 4, 'Great modern twist on traditional Burmese tea shop culture. The samosa salad and signature tea are excellent.', NULL, '2026-11-17 12:00:00'),
  (25, 1, 5, 'Authentic traditional tea and mohinga. Friendly service and cozy ambiance.', 'Kyei-zu-tin-ba-de Ko Ye Naing Oo! Glad you enjoyed our tea and mohinga.', '2026-11-17 16:20:00'),
  (28, 1, 5, 'Incredible collection of vintage Yangon books, historical maps, and handcrafted lacquerware. A hidden gem!', NULL, '2026-11-18 14:10:00')
ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), owner_reply = VALUES(owner_reply);

-- 7. Reviews written by User 7 (Mya Aung)
INSERT INTO reviews (place_id, user_id, rating, comment, owner_reply, created_at) VALUES
  (20, 7, 5, 'Top notch espresso and cozy atmosphere. Love their pour-over single origins and fresh croissants!', 'Thanks Ko Mya Aung! Always happy to serve fellow neighborhood foodies.', '2026-11-16 10:15:00'),
  (12, 7, 5, 'Best place in Yangon for traditional souvenirs, tapestries, and lacquerware.', NULL, '2026-11-16 14:30:00'),
  (6, 7, 4, 'Peaceful park right next to Yangon City Hall. Great for a morning stroll.', NULL, '2026-11-17 07:45:00'),
  (21, 7, 5, 'Very relaxing herbal foot spa treatment and organic nail care. Professional staff.', NULL, '2026-11-18 11:30:00')
ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), owner_reply = VALUES(owner_reply);

-- 8. Customer reviews ON Golden Bean Café (Place 20, owned by User 1) with owner replies
INSERT INTO reviews (place_id, user_id, rating, comment, owner_reply, created_at) VALUES
  (20, 6, 5, 'The best cold brew in Bahan. Fast Wi-Fi and quiet second floor make it great for remote work.', 'Thank you so much! Glad you enjoy our cold brew and quiet co-working space. See you again soon!', '2026-11-17 10:00:00'),
  (20, 9, 5, 'Lovely ambiance and delicious homemade croissants. Will definitely come back!', 'Thank you Thiri! We bake fresh pastries every morning.', '2026-11-17 15:30:00'),
  (20, 10, 4, 'Great pour-over coffee. Slightly crowded on Saturday afternoons but well worth the wait.', 'Thanks Min Khant! Weekday mornings are much quieter if you need extra focus time.', '2026-11-18 11:20:00')
ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), owner_reply = VALUES(owner_reply);

-- 9. Posts and customer reviews for Place 36 (Old Downtown Barber Club, owned by User 6)
INSERT IGNORE INTO posts (place_id, type, content, discount_text, ticket_limit, expires_at, is_pinned, created_at) VALUES
  (36, 'discount', 'Classic gentleman\'s haircut & hot towel beard trim: 20% off with POINTER ticket!', '20% off Haircut & Beard Trim', 30, '2026-12-05 23:59:59', 1, '2026-11-16 10:00:00'),
  (36, 'normal', 'Imported sandalwood grooming oils, vintage straight razors, and organic pomades are now in stock.', NULL, NULL, NULL, 0, '2026-11-17 11:00:00');

INSERT INTO reviews (place_id, user_id, rating, comment, owner_reply, created_at) VALUES
  (36, 9, 5, 'Classic vintage interior and impeccable vintage barber cut. Top tier craftsmanship.', 'Thanks for the review! Glad you enjoyed the classic cut.', '2026-11-17 14:00:00'),
  (36, 10, 5, 'The hot towel shave is an absolute must-try. Very relaxing and skilled barbers.', 'Thank you! We take pride in traditional grooming techniques.', '2026-11-18 16:30:00')
ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), owner_reply = VALUES(owner_reply);

-- 10. Tickets for User 1 (Ye Naing Oo)
INSERT IGNORE INTO tickets (user_id, post_id, ticket_code, status, created_at) VALUES
  (1, 1, 'MT-9K2L', 'unused', '2026-11-17 10:30:00'),
  (1, 7, 'SM-8P3Q', 'unused', '2026-11-17 12:15:00'),
  (1, 9, 'LN-4V5W', 'unused', '2026-11-18 09:45:00'),
  (1, 19, 'YB-7X1Y', 'used', '2026-11-16 14:20:00');

UPDATE tickets SET used_at = '2026-11-16 15:30:00' WHERE ticket_code = 'YB-7X1Y';

-- 11. Tickets for User 7 (Mya Aung)
INSERT IGNORE INTO tickets (user_id, post_id, ticket_code, status, created_at) VALUES
  (7, 4, 'GB-3A4B', 'unused', '2026-11-17 11:00:00'),
  (7, 9, 'LN-5C6D', 'unused', '2026-11-17 15:30:00'),
  (7, 12, 'KL-7E8F', 'used', '2026-11-16 10:00:00');

UPDATE tickets SET used_at = '2026-11-16 11:15:00' WHERE ticket_code = 'KL-7E8F';

-- 12. Tickets for User 6 (Demo User)
INSERT IGNORE INTO tickets (user_id, post_id, ticket_code, status, created_at) VALUES
  (6, 4, 'GB-8X2M', 'unused', '2026-11-17 09:30:00'),
  (6, 1, 'MT-7Q4K', 'unused', '2026-11-17 11:15:00'),
  (6, 7, 'SM-5R6T', 'unused', '2026-11-18 08:45:00'),
  (6, 12, 'KL-2M3N', 'used', '2026-11-16 12:30:00');

UPDATE tickets SET used_at = '2026-11-16 13:45:00' WHERE ticket_code = 'KL-2M3N';

-- 13. Blocks for users
INSERT IGNORE INTO blocks (blocker_id, blocked_id) VALUES
  (1, 25),
  (6, 26),
  (7, 25);
