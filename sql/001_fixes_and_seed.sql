-- Run once on pointer_db AFTER importing pointer.sql.
SET NAMES utf8mb4;
USE pointer_db;

-- 1. Public places the admin adds (pagodas, parks) have no owner.
ALTER TABLE places DROP FOREIGN KEY fk_places_owner;
ALTER TABLE places MODIFY owner_id INT NULL;
ALTER TABLE places ADD CONSTRAINT fk_places_owner
  FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE;

-- 2. The 7 category groups (HANDOFF.md).
INSERT INTO categories (id, name_en, name_my, group_name) VALUES
  (1, 'Food & drink',      'စားသောက်ဆိုင်', 'food'),
  (2, 'Stay',              'တည်းခိုရန်',    'stay'),
  (3, 'Places to visit',   'လည်ပတ်စရာ',    'visit'),
  (4, 'Shopping',          'စျေးဝယ်ရန်',    'shop'),
  (5, 'Health',            'ကျန်းမာရေး',    'health'),
  (6, 'Beauty & wellness', 'အလှအပ',        'beauty'),
  (7, 'Other',             'အခြား',         'other')
ON DUPLICATE KEY UPDATE name_en = VALUES(name_en), name_my = VALUES(name_my), group_name = VALUES(group_name);
