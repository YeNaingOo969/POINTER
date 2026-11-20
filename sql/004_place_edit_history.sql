-- Migration: add place_edit_history table for owner shop edits.
-- Run once on pointer_db AFTER pointer.sql:
--   mysql -u root -p pointer_db < sql/004_place_edit_history.sql

USE pointer_db;

CREATE TABLE IF NOT EXISTS `place_edit_history` (
  `id`         int NOT NULL AUTO_INCREMENT,
  `place_id`   int NOT NULL,
  `owner_id`   int NOT NULL,
  `field`      varchar(50)  COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'which column changed',
  `old_value`  text         COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_value`  text         COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_peh_place`  (`place_id`),
  KEY `idx_peh_owner`  (`owner_id`),
  CONSTRAINT `fk_peh_place`  FOREIGN KEY (`place_id`)  REFERENCES `places` (`id`)  ON DELETE CASCADE,
  CONSTRAINT `fk_peh_owner`  FOREIGN KEY (`owner_id`)  REFERENCES `users`  (`id`)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
