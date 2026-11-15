-- MySQL dump 10.13  Distrib 8.0.46, for macos15 (arm64)
--
-- Host: 127.0.0.1    Database: pointer_db
-- ------------------------------------------------------
-- Server version	9.7.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `pointer_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `pointer_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ ;

USE `pointer_db`;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `admin_id` int NOT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_type` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_id` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_audit_admin` (`admin_id`),
  CONSTRAINT `fk_audit_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log`
--

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `blocks`
--

DROP TABLE IF EXISTS `blocks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blocks` (
  `blocker_id` int NOT NULL,
  `blocked_id` int NOT NULL,
  PRIMARY KEY (`blocker_id`,`blocked_id`),
  KEY `fk_blocks_blocked` (`blocked_id`),
  CONSTRAINT `fk_blocks_blocked` FOREIGN KEY (`blocked_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_blocks_blocker` FOREIGN KEY (`blocker_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blocks`
--

LOCK TABLES `blocks` WRITE;
/*!40000 ALTER TABLE `blocks` DISABLE KEYS */;
/*!40000 ALTER TABLE `blocks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name_en` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Sub-category name in English (e.g. Cafe)',
  `name_my` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Sub-category name in Myanmar (e.g. ကော်ဖီဆိုင်)',
  `group_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'One of the 7 main category groups',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES (1,'Food & drink','စားသောက်ဆိုင်','food'),(2,'Stay','တည်းခိုရန်','stay'),(3,'Places to visit','လည်ပတ်စရာ','visit'),(4,'Shopping','စျေးဝယ်ရန်','shop'),(5,'Health','ကျန်းမာရေး','health'),(6,'Beauty & wellness','အလှအပ','beauty'),(7,'Other','အခြား','other');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `favorites`
--

DROP TABLE IF EXISTS `favorites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `favorites` (
  `user_id` int NOT NULL,
  `place_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`place_id`),
  KEY `fk_favorites_place` (`place_id`),
  CONSTRAINT `fk_favorites_place` FOREIGN KEY (`place_id`) REFERENCES `places` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_favorites_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `favorites`
--

LOCK TABLES `favorites` WRITE;
/*!40000 ALTER TABLE `favorites` DISABLE KEYS */;
/*!40000 ALTER TABLE `favorites` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sender_id` int NOT NULL,
  `receiver_id` int NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'sent',
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_messages_sender` (`sender_id`),
  KEY `fk_messages_receiver` (`receiver_id`),
  CONSTRAINT `fk_messages_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ref_id` int DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_notifications_user` (`user_id`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `owner_upgrades`
--

DROP TABLE IF EXISTS `owner_upgrades`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `owner_upgrades` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `months` int NOT NULL DEFAULT '1' COMMENT '1, 3, or 12 months',
  `amount` decimal(10,2) NOT NULL,
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_ref` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_proof` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT 'pending, approved, rejected, expired',
  `starts_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `admin_id` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_status` (`user_id`,`status`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `fk_upgrades_admin` (`admin_id`),
  CONSTRAINT `fk_upgrades_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_upgrades_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `owner_upgrades`
--

LOCK TABLES `owner_upgrades` WRITE;
/*!40000 ALTER TABLE `owner_upgrades` DISABLE KEYS */;
/*!40000 ALTER TABLE `owner_upgrades` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `place_photos`
--

DROP TABLE IF EXISTS `place_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `place_photos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `place_id` int NOT NULL,
  `url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_photos_place` (`place_id`),
  CONSTRAINT `fk_photos_place` FOREIGN KEY (`place_id`) REFERENCES `places` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `place_photos`
--

LOCK TABLES `place_photos` WRITE;
/*!40000 ALTER TABLE `place_photos` DISABLE KEYS */;
/*!40000 ALTER TABLE `place_photos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `places`
--

DROP TABLE IF EXISTS `places`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `places` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_id` int NOT NULL,
  `owner_id` int DEFAULT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `open_hours` text COLLATE utf8mb4_unicode_ci COMMENT 'Structured string or JSON for Map Open/Closed ring',
  `address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lat` decimal(10,7) NOT NULL,
  `lng` decimal(10,7) NOT NULL,
  `cover_photo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `storefront_photo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT 'pending, active, hidden',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_places_category` (`category_id`),
  KEY `fk_places_owner` (`owner_id`),
  CONSTRAINT `fk_places_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_places_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `places`
--

LOCK TABLES `places` WRITE;
/*!40000 ALTER TABLE `places` DISABLE KEYS */;
INSERT INTO `places` VALUES (1,3,NULL,'Shwedagon Pagoda','Yangon’s great golden stupa on Singuttara Hill, the most sacred Buddhist site in Myanmar. Come at dusk, when the gold glows.',NULL,'[{\"day\":\"mon\",\"open\":\"04:00\",\"close\":\"22:00\"},{\"day\":\"tue\",\"open\":\"04:00\",\"close\":\"22:00\"},{\"day\":\"wed\",\"open\":\"04:00\",\"close\":\"22:00\"},{\"day\":\"thu\",\"open\":\"04:00\",\"close\":\"22:00\"},{\"day\":\"fri\",\"open\":\"04:00\",\"close\":\"22:00\"},{\"day\":\"sat\",\"open\":\"04:00\",\"close\":\"22:00\"},{\"day\":\"sun\",\"open\":\"04:00\",\"close\":\"22:00\"}]','Singuttara Hill, Dagon',16.7990600,96.1494200,NULL,NULL,'active','2026-11-15 15:49:30'),(2,3,NULL,'Sule Pagoda','A golden pagoda in the middle of a downtown roundabout — the old centre point of the city.',NULL,'[{\"day\":\"mon\",\"open\":\"05:00\",\"close\":\"21:00\"},{\"day\":\"tue\",\"open\":\"05:00\",\"close\":\"21:00\"},{\"day\":\"wed\",\"open\":\"05:00\",\"close\":\"21:00\"},{\"day\":\"thu\",\"open\":\"05:00\",\"close\":\"21:00\"},{\"day\":\"fri\",\"open\":\"05:00\",\"close\":\"21:00\"},{\"day\":\"sat\",\"open\":\"05:00\",\"close\":\"21:00\"},{\"day\":\"sun\",\"open\":\"05:00\",\"close\":\"21:00\"}]','Sule Pagoda Road, Kyauktada',16.7744100,96.1587700,NULL,NULL,'active','2026-11-15 15:49:30'),(3,3,NULL,'Botataung Pagoda','A riverside pagoda with a hollow stupa you can walk through, past cases of old relics.',NULL,'[{\"day\":\"mon\",\"open\":\"06:00\",\"close\":\"21:00\"},{\"day\":\"tue\",\"open\":\"06:00\",\"close\":\"21:00\"},{\"day\":\"wed\",\"open\":\"06:00\",\"close\":\"21:00\"},{\"day\":\"thu\",\"open\":\"06:00\",\"close\":\"21:00\"},{\"day\":\"fri\",\"open\":\"06:00\",\"close\":\"21:00\"},{\"day\":\"sat\",\"open\":\"06:00\",\"close\":\"21:00\"},{\"day\":\"sun\",\"open\":\"06:00\",\"close\":\"21:00\"}]','Strand Road, Botataung',16.7678300,96.1718400,NULL,NULL,'active','2026-11-15 15:49:30'),(4,3,NULL,'Chaukhtatgyi Buddha','Home to a huge reclining Buddha with glass eyes and finely painted soles.',NULL,'[{\"day\":\"mon\",\"open\":\"06:00\",\"close\":\"20:00\"},{\"day\":\"tue\",\"open\":\"06:00\",\"close\":\"20:00\"},{\"day\":\"wed\",\"open\":\"06:00\",\"close\":\"20:00\"},{\"day\":\"thu\",\"open\":\"06:00\",\"close\":\"20:00\"},{\"day\":\"fri\",\"open\":\"06:00\",\"close\":\"20:00\"},{\"day\":\"sat\",\"open\":\"06:00\",\"close\":\"20:00\"},{\"day\":\"sun\",\"open\":\"06:00\",\"close\":\"20:00\"}]','Shwegondaing Road, Bahan',16.8044000,96.1491000,NULL,NULL,'active','2026-11-15 15:49:30'),(5,3,NULL,'Yangon City Hall','A grand 1930s civic building that mixes colonial and Burmese design, facing Maha Bandula Park.',NULL,'[]','Maha Bandula Road, Kyauktada',16.7751000,96.1592100,NULL,NULL,'active','2026-11-15 15:49:30'),(6,3,NULL,'Maha Bandula Park','A green square in downtown around the Independence Monument — a good break between sights.',NULL,'[{\"day\":\"mon\",\"open\":\"05:00\",\"close\":\"21:00\"},{\"day\":\"tue\",\"open\":\"05:00\",\"close\":\"21:00\"},{\"day\":\"wed\",\"open\":\"05:00\",\"close\":\"21:00\"},{\"day\":\"thu\",\"open\":\"05:00\",\"close\":\"21:00\"},{\"day\":\"fri\",\"open\":\"05:00\",\"close\":\"21:00\"},{\"day\":\"sat\",\"open\":\"05:00\",\"close\":\"21:00\"},{\"day\":\"sun\",\"open\":\"05:00\",\"close\":\"21:00\"}]','Maha Bandula Park Street, Kyauktada',16.7725300,96.1594500,NULL,NULL,'active','2026-11-15 15:49:30'),(7,3,NULL,'Kandawgyi Lake & Karaweik','A wide lake with a wooden boardwalk and views of the Karaweik barge and the Shwedagon.',NULL,'[{\"day\":\"mon\",\"open\":\"04:00\",\"close\":\"22:00\"},{\"day\":\"tue\",\"open\":\"04:00\",\"close\":\"22:00\"},{\"day\":\"wed\",\"open\":\"04:00\",\"close\":\"22:00\"},{\"day\":\"thu\",\"open\":\"04:00\",\"close\":\"22:00\"},{\"day\":\"fri\",\"open\":\"04:00\",\"close\":\"22:00\"},{\"day\":\"sat\",\"open\":\"04:00\",\"close\":\"22:00\"},{\"day\":\"sun\",\"open\":\"04:00\",\"close\":\"22:00\"}]','Kan Yeik Thar Road, Bahan',16.7952300,96.1679900,NULL,NULL,'active','2026-11-15 15:49:30'),(8,3,NULL,'Inya Lake','Yangon’s biggest lake, loved for sunset walks along the shore.',NULL,'[]','Pyay Road / Inya Road, Kamayut',16.8386300,96.1380100,NULL,NULL,'active','2026-11-15 15:49:30'),(9,3,NULL,'People’s Park','Lawns, shady paths and fountains right next to the Shwedagon.',NULL,'[{\"day\":\"mon\",\"open\":\"06:00\",\"close\":\"18:00\"},{\"day\":\"tue\",\"open\":\"06:00\",\"close\":\"18:00\"},{\"day\":\"wed\",\"open\":\"06:00\",\"close\":\"18:00\"},{\"day\":\"thu\",\"open\":\"06:00\",\"close\":\"18:00\"},{\"day\":\"fri\",\"open\":\"06:00\",\"close\":\"18:00\"},{\"day\":\"sat\",\"open\":\"06:00\",\"close\":\"18:00\"},{\"day\":\"sun\",\"open\":\"06:00\",\"close\":\"18:00\"}]','Ar Zar Ni Road, Dagon',16.7989400,96.1420900,NULL,NULL,'active','2026-11-15 15:49:30'),(10,3,NULL,'National Museum','Myanmar’s history and art, including the royal Lion Throne.',NULL,'[{\"day\":\"tue\",\"open\":\"09:30\",\"close\":\"16:30\"},{\"day\":\"wed\",\"open\":\"09:30\",\"close\":\"16:30\"},{\"day\":\"thu\",\"open\":\"09:30\",\"close\":\"16:30\"},{\"day\":\"fri\",\"open\":\"09:30\",\"close\":\"16:30\"},{\"day\":\"sat\",\"open\":\"09:30\",\"close\":\"16:30\"},{\"day\":\"sun\",\"open\":\"09:30\",\"close\":\"16:30\"}]','66-74 Pyay Road, Dagon',16.7886600,96.1422900,NULL,NULL,'active','2026-11-15 15:49:30'),(11,3,NULL,'The Secretariat','The vast red-brick government offices of colonial times, now restored and open for visits.',NULL,'[{\"day\":\"tue\",\"open\":\"09:30\",\"close\":\"16:30\"},{\"day\":\"wed\",\"open\":\"09:30\",\"close\":\"16:30\"},{\"day\":\"thu\",\"open\":\"09:30\",\"close\":\"16:30\"},{\"day\":\"fri\",\"open\":\"09:30\",\"close\":\"16:30\"},{\"day\":\"sat\",\"open\":\"09:30\",\"close\":\"16:30\"},{\"day\":\"sun\",\"open\":\"09:30\",\"close\":\"16:30\"}]','Maha Bandula Road, Botataung',16.7754700,96.1652900,NULL,NULL,'active','2026-11-15 15:49:30'),(12,4,NULL,'Bogyoke Aung San Market','A covered colonial-era market full of longyi, jade, lacquerware and souvenirs.',NULL,'[{\"day\":\"tue\",\"open\":\"10:00\",\"close\":\"17:00\"},{\"day\":\"wed\",\"open\":\"10:00\",\"close\":\"17:00\"},{\"day\":\"thu\",\"open\":\"10:00\",\"close\":\"17:00\"},{\"day\":\"fri\",\"open\":\"10:00\",\"close\":\"17:00\"},{\"day\":\"sat\",\"open\":\"10:00\",\"close\":\"17:00\"},{\"day\":\"sun\",\"open\":\"10:00\",\"close\":\"17:00\"}]','Bogyoke Aung San Road, Pabedan',16.7802600,96.1555900,NULL,NULL,'active','2026-11-15 15:49:30'),(13,4,NULL,'Theingyi Zei','Downtown’s busy wholesale market for spices, fabrics and everyday goods.',NULL,'[{\"day\":\"mon\",\"open\":\"07:00\",\"close\":\"17:00\"},{\"day\":\"tue\",\"open\":\"07:00\",\"close\":\"17:00\"},{\"day\":\"wed\",\"open\":\"07:00\",\"close\":\"17:00\"},{\"day\":\"thu\",\"open\":\"07:00\",\"close\":\"17:00\"},{\"day\":\"fri\",\"open\":\"07:00\",\"close\":\"17:00\"},{\"day\":\"sat\",\"open\":\"07:00\",\"close\":\"17:00\"},{\"day\":\"sun\",\"open\":\"07:00\",\"close\":\"17:00\"}]','25th Street, Pabedan',16.7747800,96.1534600,NULL,NULL,'active','2026-11-15 15:49:30'),(14,1,NULL,'19th Street (Chinatown)','A lane of barbecue stalls and street tables that comes alive every evening.',NULL,'[{\"day\":\"mon\",\"open\":\"17:00\",\"close\":\"23:30\"},{\"day\":\"tue\",\"open\":\"17:00\",\"close\":\"23:30\"},{\"day\":\"wed\",\"open\":\"17:00\",\"close\":\"23:30\"},{\"day\":\"thu\",\"open\":\"17:00\",\"close\":\"23:30\"},{\"day\":\"fri\",\"open\":\"17:00\",\"close\":\"23:30\"},{\"day\":\"sat\",\"open\":\"17:00\",\"close\":\"23:30\"},{\"day\":\"sun\",\"open\":\"17:00\",\"close\":\"23:30\"}]','19th Street, Latha',16.7759300,96.1494900,NULL,NULL,'active','2026-11-15 15:49:30'),(15,2,NULL,'The Strand Hotel','A classic colonial hotel from 1901 on the riverside Strand Road.',NULL,'[{\"day\":\"mon\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"tue\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"wed\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"thu\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"fri\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"sat\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"sun\",\"open\":\"00:00\",\"close\":\"24:00\"}]','92 Strand Road, Kyauktada',16.7695900,96.1625900,NULL,NULL,'active','2026-11-15 15:49:30'),(16,2,NULL,'Sule Shangri-La','A modern hotel in the heart of downtown, a few steps from Sule Pagoda.',NULL,'[{\"day\":\"mon\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"tue\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"wed\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"thu\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"fri\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"sat\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"sun\",\"open\":\"00:00\",\"close\":\"24:00\"}]','223 Sule Pagoda Road, Kyauktada',16.7785500,96.1585300,NULL,NULL,'active','2026-11-15 15:49:30'),(17,1,NULL,'Rangoon Tea House','Tea shop classics — milk tea, mohinga, samosas — in a stylish downtown room.',NULL,'[{\"day\":\"mon\",\"open\":\"07:00\",\"close\":\"22:00\"},{\"day\":\"tue\",\"open\":\"07:00\",\"close\":\"22:00\"},{\"day\":\"wed\",\"open\":\"07:00\",\"close\":\"22:00\"},{\"day\":\"thu\",\"open\":\"07:00\",\"close\":\"22:00\"},{\"day\":\"fri\",\"open\":\"07:00\",\"close\":\"22:00\"},{\"day\":\"sat\",\"open\":\"07:00\",\"close\":\"22:00\"},{\"day\":\"sun\",\"open\":\"07:00\",\"close\":\"22:00\"}]','77-79 Pansodan Street, Kyauktada',16.7722600,96.1614100,NULL,NULL,'active','2026-11-15 15:49:30'),(18,1,NULL,'Feel Myanmar Food','A popular place to try many Myanmar curries and salads in one meal.',NULL,'[{\"day\":\"mon\",\"open\":\"06:30\",\"close\":\"21:30\"},{\"day\":\"tue\",\"open\":\"06:30\",\"close\":\"21:30\"},{\"day\":\"wed\",\"open\":\"06:30\",\"close\":\"21:30\"},{\"day\":\"thu\",\"open\":\"06:30\",\"close\":\"21:30\"},{\"day\":\"fri\",\"open\":\"06:30\",\"close\":\"21:30\"},{\"day\":\"sat\",\"open\":\"06:30\",\"close\":\"21:30\"},{\"day\":\"sun\",\"open\":\"06:30\",\"close\":\"21:30\"}]','Pyidaungsu Yeiktha Road, Dagon',16.7907400,96.1436400,NULL,NULL,'active','2026-11-15 15:49:30'),(19,5,NULL,'Yangon General Hospital','The city’s large public hospital, in a landmark red-brick building.',NULL,'[{\"day\":\"mon\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"tue\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"wed\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"thu\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"fri\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"sat\",\"open\":\"00:00\",\"close\":\"24:00\"},{\"day\":\"sun\",\"open\":\"00:00\",\"close\":\"24:00\"}]','Bogyoke Aung San Road, Lanmadaw',16.7791400,96.1489800,NULL,NULL,'active','2026-11-15 15:49:30');
/*!40000 ALTER TABLE `places` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `posts`
--

DROP TABLE IF EXISTS `posts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `place_id` int NOT NULL,
  `type` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal' COMMENT 'normal, discount',
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `image_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `discount_text` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ticket_limit` int DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `is_pinned` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_posts_place` (`place_id`),
  CONSTRAINT `fk_posts_place` FOREIGN KEY (`place_id`) REFERENCES `places` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `posts`
--

LOCK TABLES `posts` WRITE;
/*!40000 ALTER TABLE `posts` DISABLE KEYS */;
/*!40000 ALTER TABLE `posts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reports`
--

DROP TABLE IF EXISTS `reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `reporter_id` int NOT NULL,
  `target_type` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'post, review, place',
  `target_id` int NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_reports_reporter` (`reporter_id`),
  CONSTRAINT `fk_reports_reporter` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reports`
--

LOCK TABLES `reports` WRITE;
/*!40000 ALTER TABLE `reports` DISABLE KEYS */;
/*!40000 ALTER TABLE `reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reviews`
--

DROP TABLE IF EXISTS `reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `place_id` int NOT NULL,
  `user_id` int NOT NULL,
  `rating` int NOT NULL COMMENT '1 to 5',
  `comment` text COLLATE utf8mb4_unicode_ci,
  `owner_reply` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL COMMENT 'If not NULL, show (edited) badge',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_place_review` (`user_id`,`place_id`),
  KEY `fk_reviews_place` (`place_id`),
  CONSTRAINT `fk_reviews_place` FOREIGN KEY (`place_id`) REFERENCES `places` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reviews`
--

LOCK TABLES `reviews` WRITE;
/*!40000 ALTER TABLE `reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `search_history`
--

DROP TABLE IF EXISTS `search_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `search_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `keyword` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category_id` int DEFAULT NULL,
  `place_id` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_search_user` (`user_id`),
  KEY `fk_search_category` (`category_id`),
  KEY `fk_search_place` (`place_id`),
  CONSTRAINT `fk_search_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_search_place` FOREIGN KEY (`place_id`) REFERENCES `places` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_search_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `search_history`
--

LOCK TABLES `search_history` WRITE;
/*!40000 ALTER TABLE `search_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `search_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tickets`
--

DROP TABLE IF EXISTS `tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tickets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `post_id` int NOT NULL,
  `ticket_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unused' COMMENT 'unused, used, expired',
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticket_code` (`ticket_code`),
  UNIQUE KEY `uq_user_post_ticket` (`user_id`,`post_id`),
  KEY `fk_tickets_post` (`post_id`),
  CONSTRAINT `fk_tickets_post` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tickets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tickets`
--

LOCK TABLES `tickets` WRITE;
/*!40000 ALTER TABLE `tickets` DISABLE KEYS */;
/*!40000 ALTER TABLE `tickets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user' COMMENT 'user, owner, admin',
  `status` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT 'active, suspended',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-15 18:51:19
