-- Migration: Email OTP verification + Google Sign-In support on users.
-- Run once on pointer_db AFTER pointer.sql:
--   mysql -h 127.0.0.1 -P 3307 -u root pointer_db < sql/005_auth_otp_google.sql

SET NAMES utf8mb4;
USE pointer_db;

-- Make password_hash nullable so Google-only accounts do not require a local password.
ALTER TABLE `users`
  MODIFY COLUMN `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL;

DROP PROCEDURE IF EXISTS `pointer_migrate_005`;
DELIMITER $$
CREATE PROCEDURE `pointer_migrate_005`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'google_id'
  ) THEN
    ALTER TABLE `users`
      ADD COLUMN `google_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL AFTER `password_hash`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'auth_provider'
  ) THEN
    ALTER TABLE `users`
      ADD COLUMN `auth_provider` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'local' AFTER `google_id`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verified_at'
  ) THEN
    ALTER TABLE `users`
      ADD COLUMN `email_verified_at` datetime NULL DEFAULT NULL AFTER `auth_provider`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_url'
  ) THEN
    ALTER TABLE `users`
      ADD COLUMN `avatar_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL AFTER `email_verified_at`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uq_users_google_id'
  ) THEN
    ALTER TABLE `users`
      ADD UNIQUE KEY `uq_users_google_id` (`google_id`);
  END IF;
END$$
DELIMITER ;

CALL `pointer_migrate_005`();
DROP PROCEDURE IF EXISTS `pointer_migrate_005`;

-- Treat pre-existing seeded accounts as verified.
UPDATE `users` SET `email_verified_at` = COALESCE(`created_at`, NOW()) WHERE `email_verified_at` IS NULL;

-- Pending email registrations verified via 6-digit OTP code.
CREATE TABLE IF NOT EXISTS `email_verifications` (
  `id`           int NOT NULL AUTO_INCREMENT,
  `email`        varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name`         varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `otp_hash`     varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts`     int NOT NULL DEFAULT 0,
  `resend_count` int NOT NULL DEFAULT 0,
  `expires_at`   datetime NOT NULL,
  `last_sent_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at`   datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ev_email` (`email`),
  KEY `idx_ev_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
