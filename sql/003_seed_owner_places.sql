-- ==========================================================
-- 003_seed_owner_places.sql (Matched with frontend/src/data/places.js)
-- ==========================================================

USE `pointer_db`;

-- 1. Insert 5 Shop Owner Accounts (corresponding to ownerId 1 to 5)
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `status`, `created_at`) VALUES
  (1, 'Golden Bean Owner', 'owner1@pointer.mm', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner', 'active', NOW()),
  (2, 'Lotus Spa Owner',     'owner2@pointer.mm', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner', 'active', NOW()),
  (3, 'Mohinga Corner Owner', 'owner3@pointer.mm', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner', 'active', NOW()),
  (4, 'Guesthouse Owner',    'owner4@pointer.mm', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner', 'active', NOW()),
  (5, 'Pharmacy Owner',      'owner5@pointer.mm', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner', 'active', NOW())
ON DUPLICATE KEY UPDATE
  `role` = VALUES(`role`),
  `status` = VALUES(`status`);

-- 2. Insert Active Subscriptions for Owners 1 to 5
INSERT INTO `owner_upgrades` (
  `user_id`, `months`, `amount`, `payment_method`, `payment_ref`,
  `status`, `starts_at`, `expires_at`, `reviewed_at`, `created_at`
) VALUES
  (1, 3, 30000.00, 'KBZPay', 'KPAY-2026001', 'approved', NOW(), DATE_ADD(NOW(), INTERVAL 3 MONTH), NOW(), NOW()),
  (2, 3, 30000.00, 'WavePay', 'WAVE-2026002', 'approved', NOW(), DATE_ADD(NOW(), INTERVAL 3 MONTH), NOW(), NOW()),
  (3, 6, 55000.00, 'KBZPay', 'KPAY-2026003', 'approved', NOW(), DATE_ADD(NOW(), INTERVAL 6 MONTH), NOW(), NOW()),
  (4, 1, 12000.00, 'KBZPay', 'KPAY-2026004', 'approved', NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH), NOW(), NOW()),
  (5, 12, 100000.00, 'CBPay', 'CBPAY-2026005', 'approved', NOW(), DATE_ADD(NOW(), INTERVAL 12 MONTH), NOW(), NOW());

-- 3. Insert Places (ID 20 to 24 matching places.js)
INSERT INTO `places` (
  `id`, `category_id`, `owner_id`, `name`, `description`, `phone`, `open_hours`,
  `address`, `lat`, `lng`, `cover_photo`, `storefront_photo`, `status`, `created_at`
) VALUES
  (
    20, 1, 1,
    'Golden Bean Café',
    'Demo shop: a cosy café near Kandawgyi with iced coffee and snacks.',
    '09 5123 4567',
    '[{\"day\":\"mon\",\"open\":\"08:00\",\"close\":\"21:00\"},{\"day\":\"tue\",\"open\":\"08:00\",\"close\":\"21:00\"},{\"day\":\"wed\",\"open\":\"08:00\",\"close\":\"21:00\"},{\"day\":\"thu\",\"open\":\"08:00\",\"close\":\"21:00\"},{\"day\":\"fri\",\"open\":\"08:00\",\"close\":\"21:00\"},{\"day\":\"sat\",\"open\":\"08:00\",\"close\":\"21:00\"},{\"day\":\"sun\",\"open\":\"08:00\",\"close\":\"21:00\"}]',
    'Demo business — not a real shop',
    16.8001000, 96.1561000,
    NULL, NULL, 'active', NOW()
  ),
  (
    21, 6, 2,
    'Lotus Nail Spa',
    'Demo shop: nails, massage and thanaka treatments.',
    '09 7788 1234',
    '[{\"day\":\"mon\",\"open\":\"10:00\",\"close\":\"20:00\"},{\"day\":\"tue\",\"open\":\"10:00\",\"close\":\"20:00\"},{\"day\":\"wed\",\"open\":\"10:00\",\"close\":\"20:00\"},{\"day\":\"thu\",\"open\":\"ဒီဖိုင်ထဲက အချက်အလက်တွေ (အထူးသဖြင့် ID 20 ကနေ 24 အထိဆိုင်တွေရဲ့ နာမည်၊ လိပ်စာ၊ ဖုန်းနံပါတ်၊ တည်နေရာနဲ့ ဖွင့်ချိန် JSON တွေ) ကို အခြေခံပြီး Database ထဲမှာ တန်းထည့်လို့ရမယ့် **`sql/003_seed_owner_places.sql`** ဖိုင်အတွက် SQL ကုဒ်အပြည့်အစုံကို အောက်မှာ ရေးပေးလိုက်ပါတယ်။

ဒီကုဒ်ထဲမှာ Owner အကောင့် (၅) ခု၊ ၎င်းတို့အတွက် သက်တမ်းရှိ Subscription တွေ၊ ID 20 ကနေ 24 အထိ ဆိုင် (၅) ဆိုင်နဲ့ ဆိုင်ဓာတ်ပုံတွေ အားလုံး အတိအကျ ပါဝင်ပါတယ်။

```sql
-- ==========================================================
-- 003_seed_owner_places.sql
-- Seed 5 Owner Users + 5 Active Subscriptions + Places (ID 20 to 24)
-- Based on frontend/src/data/places.js
-- ==========================================================

USE `pointer_db`;

-- 1. Insert 5 Shop Owner Accounts (Default Password: "password123")
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `status`, `created_at`) VALUES
  (1, 'Owner One (Golden Bean)', 'owner1@pointer.mm', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner', 'active', NOW()),
  (2, 'Owner Two (Lotus Nail)', 'owner2@pointer.mm', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner', 'active', NOW()),
  (3, 'Owner Three (Shwe Mohinga)', 'owner3@pointer.mm', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner', 'active', NOW()),
  (4, 'Owner Four (Kandaw Lake)', 'owner4@pointer.mm', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner', 'active', NOW()),
  (5, 'Owner Five (Pyay Road)', 'owner5@pointer.mm', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner', 'active', NOW())
ON DUPLICATE KEY UPDATE
  `role` = VALUES(`role`),
  `status` = VALUES(`status`);

-- 2. Insert Active Subscriptions for the 5 Owners
INSERT INTO `owner_upgrades` (
  `user_id`, `months`, `amount`, `payment_method`, `payment_ref`,
  `status`, `starts_at`, `expires_at`, `reviewed_at`, `created_at`
) VALUES
  (1, 3, 30000.00, 'KBZPay',  'KPAY-2026001', 'approved', NOW(), DATE_ADD(NOW(), INTERVAL 3 MONTH), NOW(), NOW()),
  (2, 3, 30000.00, 'WavePay', 'WAVE-2026002', 'approved', NOW(), DATE_ADD(NOW(), INTERVAL 3 MONTH), NOW(), NOW()),
  (3, 6, 55000.00, 'KBZPay',  'KPAY-2026003', 'approved', NOW(), DATE_ADD(NOW(), INTERVAL 6 MONTH), NOW(), NOW()),
  (4, 1, 12000.00, 'KBZPay',  'KPAY-2026004', 'approved', NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH), NOW(), NOW()),
  (5, 12, 100000.00, 'CBPay', 'CBPAY-2026005', 'approved', NOW(), DATE_ADD(NOW(), INTERVAL 12 MONTH), NOW(), NOW());

-- 3. Insert Places (ID 20 to 24) matching places.js exactly
INSERT INTO `places` (
  `id`, `category_id`, `owner_id`, `name`, `description`, `phone`, `open_hours`,
  `address`, `lat`, `lng`, `cover_photo`, `storefront_photo`, `status`, `created_at`
) VALUES
  (
    20, 1, 1,
    'Golden Bean Café',
    'Demo shop: a cosy café near Kandawgyi with iced coffee and snacks.',
    '09 5123 4567',
    '[{"day":"mon","open":"08:00","close":"21:00"},{"day":"tue","open":"08:00","close":"21:00"},{"day":"wed","open":"08:00","close":"21:00"},{"day":"thu","open":"08:00","close":"21:00"},{"day":"fri","open":"08:00","close":"21:00"},{"day":"sat","open":"08:00","close":"21:00"},{"day":"sun","open":"08:00","close":"21:00"}]',
    'Demo business — not a real shop',
    16.8001000, 96.1561000,
    NULL, NULL,
    'active', NOW()
  ),
  (
    21, 6, 2,
    'Lotus Nail Spa',
    'Demo shop: nails, massage and thanaka treatments.',
    '09 7788 1234',
    '[{"day":"mon","open":"10:00","close":"20:00"},{"day":"tue","open":"10:00","close":"20:00"},{"day":"wed","open":"10:00","close":"20:00"},{"day":"thu","open":"10:00","close":"20:00"},{"day":"fri","open":"10:00","close":"20:00"},{"day":"sat","open":"10:00","close":"20:00"}]',
    'Demo business — not a real shop',
    16.7855000, 96.1467000,
    NULL, NULL,
    'active', NOW()
  ),
  (
    22, 1, 3,
    'Shwe Mohinga Corner',
    'Demo shop: morning mohinga, ohn no khao swe and tea-leaf salad.',
    '09 4250 1188',
    '[{"day":"mon","open":"06:00","close":"14:00"},{"day":"tue","open":"06:00","close":"14:00"},{"day":"wed","open":"06:00","close":"14:00"},{"day":"thu","open":"06:00","close":"14:00"},{"day":"fri","open":"06:00","close":"14:00"},{"day":"sat","open":"06:00","close":"14:00"},{"day":"sun","open":"06:00","close":"14:00"}]',
    'Demo business — not a real shop',
    16.7812000, 96.1534000,
    NULL, NULL,
    'active', NOW()
  ),
  (
    23, 2, 4,
    'Kandaw Lake Guesthouse',
    'Demo shop: simple rooms with lake views, five minutes from Karaweik.',
    '09 9733 2201',
    '[{"day":"mon","open":"00:00","close":"24:00"},{"day":"tue","open":"00:00","close":"24:00"},{"day":"wed","open":"00:00","close":"24:00"},{"day":"thu","open":"00:00","close":"24:00"},{"day":"fri","open":"00:00","close":"24:00"},{"day":"sat","open":"00:00","close":"24:00"},{"day":"sun","open":"00:00","close":"24:00"}]',
    'Demo business — not a real shop',
    16.7969000, 96.1700000,
    NULL, NULL,
    'active', NOW()
  ),
  (
    24, 5, 5,
    'Pyay Road Pharmacy',
    'Demo shop: pharmacy with a pharmacist on duty and blood-pressure checks.',
    '09 2550 7766',
    '[{"day":"mon","open":"08:00","close":"22:00"},{"day":"tue","open":"08:00","close":"22:00"},{"day":"wed","open":"08:00","close":"22:00"},{"day":"thu","open":"08:00","close":"22:00"},{"day":"fri","open":"08:00","close":"22:00"},{"day":"sat","open":"08:00","close":"22:00"},{"day":"sun","open":"08:00","close":"22:00"}]',
    'Demo business — not a real shop',
    16.8213000, 96.1316000,
    NULL, NULL,
    'active', NOW()
  )
ON DUPLICATE KEY UPDATE
  `owner_id`    = VALUES(`owner_id`),
  `name`        = VALUES(`name`),
  `description` = VALUES(`description`),
  `phone`       = VALUES(`phone`),
  `open_hours`  = VALUES(`open_hours`),
  `address`     = VALUES(`address`),
  `lat`         = VALUES(`lat`),
  `lng`         = VALUES(`lng`),
  `status`      = VALUES(`status`);