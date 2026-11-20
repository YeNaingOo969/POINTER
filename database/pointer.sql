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

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `pointer_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ ;
USE `pointer_db`;

--
-- Table structure and data for table `users`
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
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `status`, `created_at`) VALUES
  (1,'Ye Naing Oo','yno@gmail.com','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','owner','active','2026-11-15 19:58:25'),
  (2,'Lotus Spa Owner','owner2@pointer.mm','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','owner','active','2026-11-16 23:04:17'),
  (3,'Mohinga Corner Owner','owner3@pointer.mm','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','owner','active','2026-11-16 23:04:17'),
  (4,'Guesthouse Owner','owner4@pointer.mm','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','owner','active','2026-11-16 23:04:17'),
  (5,'Pharmacy Owner','owner5@pointer.mm','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','owner','active','2026-11-16 23:04:17'),
  (6,'Demo User','demo@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','user','active','2026-11-17 11:31:12'),
  (7,'Mya Aung','owner@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','owner','active','2026-11-17 11:31:12'),
  (8,'Ko Zaw','pending@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','user','active','2026-11-17 11:31:12'),
  (9,'Thiri Swe','thiri@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','user','active','2026-11-17 12:00:00'),
  (10,'Min Khant','minkhant@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','user','active','2026-11-17 12:15:00'),
  (11,'Sophie Martin','sophie@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','user','active','2026-11-17 12:30:00'),
  (12,'Aung Paing','aungpaing@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','user','active','2026-11-17 13:00:00'),
  (13,'Hnin Nu Wai','hnin@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','user','active','2026-11-17 13:30:00'),
  (14,'Kyaw Zin Oo','kyawzin@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','user','active','2026-11-17 14:00:00'),
  (15,'Su Myat Noe','sumyat@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','user','active','2026-11-17 14:30:00'),
  (16,'Ei Phyu Thin','eiphyu@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','user','active','2026-11-17 15:00:00'),
  (17,'Zaw Min Tun','zawmin@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','owner','active','2026-11-17 15:30:00'),
  (18,'Admin U Min Thant','admin@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','admin','active','2026-11-10 09:00:00'),
  (19,'Daw Khin Marlar','marlar@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','owner','active','2026-11-12 10:00:00'),
  (20,'U Thet Naing','thetnaing@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','owner','active','2026-11-13 11:30:00'),
  (21,'Ko Phyo Min','phyomin@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','user','active','2026-11-18 14:00:00'),
  (22,'Ma Sandar Win','sandar@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','user','active','2026-11-18 15:30:00'),
  (23,'Chit Thu Wai','chitthuwai@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','user','active','2026-11-18 16:00:00'),
  (24,'Myo Min Htet','myomin@pointer.app','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','user','active','2026-11-18 16:30:00'),
  (25,'Kyaw Spam Bot','spambot@fake.com','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','user','suspended','2026-11-14 08:00:00'),
  (26,'Fake Casino Vendor','casino@gambling.biz','$2y$12$Ff0SiThVnoSzkgWdthk3VOL.f.Tq2pd97RDV8x51oK6J42SmZbaSe','user','suspended','2026-11-15 13:00:00');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure and data for table `categories`
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

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` (`id`, `name_en`, `name_my`, `group_name`) VALUES
  (1,'Food & drink','စားသောက်ဆိုင်','food'),
  (2,'Stay','တည်းခိုရန်','stay'),
  (3,'Places to visit','လည်ပတ်စရာ','visit'),
  (4,'Shopping','စျေးဝယ်ရန်','shop'),
  (5,'Health','ကျန်းမာရေး','health'),
  (6,'Beauty & wellness','အလှအပ','beauty'),
  (7,'Other','အခြား','other');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure and data for table `places`
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
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

LOCK TABLES `places` WRITE;
/*!40000 ALTER TABLE `places` DISABLE KEYS */;
INSERT INTO `places` (`id`, `category_id`, `owner_id`, `name`, `description`, `phone`, `open_hours`, `address`, `lat`, `lng`, `cover_photo`, `storefront_photo`, `status`, `created_at`) VALUES
  (1,3,NULL,'Shwedagon Pagoda','Yangon’s great golden stupa on Singuttara Hill, the most sacred Buddhist site in Myanmar. Come at dusk, when the gold glows.',NULL,'[{"day":"mon","open":"04:00","close":"22:00"},{"day":"tue","open":"04:00","close":"22:00"},{"day":"wed","open":"04:00","close":"22:00"},{"day":"thu","open":"04:00","close":"22:00"},{"day":"fri","open":"04:00","close":"22:00"},{"day":"sat","open":"04:00","close":"22:00"},{"day":"sun","open":"04:00","close":"22:00"}]','Singuttara Hill, Dagon',16.79906,96.14942,'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=800&q=80',NULL,'active','2026-11-15 15:49:30'),
  (2,3,NULL,'Sule Pagoda','A golden pagoda in the middle of a downtown roundabout — the old centre point of the city.',NULL,'[{"day":"mon","open":"05:00","close":"21:00"},{"day":"tue","open":"05:00","close":"21:00"},{"day":"wed","open":"05:00","close":"21:00"},{"day":"thu","open":"05:00","close":"21:00"},{"day":"fri","open":"05:00","close":"21:00"},{"day":"sat","open":"05:00","close":"21:00"},{"day":"sun","open":"05:00","close":"21:00"}]','Sule Pagoda Road, Kyauktada',16.77441,96.15877,'https://images.unsplash.com/photo-1582650625119-3a31f841839d?auto=format&fit=crop&w=800&q=80',NULL,'active','2026-11-15 15:49:30'),
  (3,3,NULL,'Botataung Pagoda','A riverside pagoda with a hollow stupa you can walk through, past cases of old relics.',NULL,'[{"day":"mon","open":"06:00","close":"21:00"},{"day":"tue","open":"06:00","close":"21:00"},{"day":"wed","open":"06:00","close":"21:00"},{"day":"thu","open":"06:00","close":"21:00"},{"day":"fri","open":"06:00","close":"21:00"},{"day":"sat","open":"06:00","close":"21:00"},{"day":"sun","open":"06:00","close":"21:00"}]','Strand Road, Botataung',16.76783,96.17184,NULL,NULL,'active','2026-11-15 15:49:30'),
  (4,3,NULL,'Chaukhtatgyi Buddha','Home to a huge reclining Buddha with glass eyes and finely painted soles.',NULL,'[{"day":"mon","open":"06:00","close":"20:00"},{"day":"tue","open":"06:00","close":"20:00"},{"day":"wed","open":"06:00","close":"20:00"},{"day":"thu","open":"06:00","close":"20:00"},{"day":"fri","open":"06:00","close":"20:00"},{"day":"sat","open":"06:00","close":"20:00"},{"day":"sun","open":"06:00","close":"20:00"}]','Shwegondaing Road, Bahan',16.8044,96.1491,NULL,NULL,'active','2026-11-15 15:49:30'),
  (5,3,NULL,'Yangon City Hall','A grand 1930s civic building that mixes colonial and Burmese design, facing Maha Bandula Park.',NULL,'[]','Maha Bandula Road, Kyauktada',16.7751,96.15921,NULL,NULL,'active','2026-11-15 15:49:30'),
  (6,3,NULL,'Maha Bandula Park','A green square in downtown around the Independence Monument — a good break between sights.',NULL,'[{"day":"mon","open":"05:00","close":"21:00"},{"day":"tue","open":"05:00","close":"21:00"},{"day":"wed","open":"05:00","close":"21:00"},{"day":"thu","open":"05:00","close":"21:00"},{"day":"fri","open":"05:00","close":"21:00"},{"day":"sat","open":"05:00","close":"21:00"},{"day":"sun","open":"05:00","close":"21:00"}]','Maha Bandula Park Street, Kyauktada',16.77253,96.15945,NULL,NULL,'active','2026-11-15 15:49:30'),
  (7,3,NULL,'Kandawgyi Lake & Karaweik','A wide lake with a wooden boardwalk and views of the Karaweik barge and the Shwedagon.',NULL,'[{"day":"mon","open":"04:00","close":"22:00"},{"day":"tue","open":"04:00","close":"22:00"},{"day":"wed","open":"04:00","close":"22:00"},{"day":"thu","open":"04:00","close":"22:00"},{"day":"fri","open":"04:00","close":"22:00"},{"day":"sat","open":"04:00","close":"22:00"},{"day":"sun","open":"04:00","close":"22:00"}]','Kan Yeik Thar Road, Bahan',16.79523,96.16799,'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80',NULL,'active','2026-11-15 15:49:30'),
  (8,3,NULL,'Inya Lake','Yangon’s biggest lake, loved for sunset walks along the shore.',NULL,'[]','Pyay Road / Inya Road, Kamayut',16.83863,96.13801,NULL,NULL,'active','2026-11-15 15:49:30'),
  (9,3,NULL,'People’s Park','Lawns, shady paths and fountains right next to the Shwedagon.',NULL,'[{"day":"mon","open":"06:00","close":"18:00"},{"day":"tue","open":"06:00","close":"18:00"},{"day":"wed","open":"06:00","close":"18:00"},{"day":"thu","open":"06:00","close":"18:00"},{"day":"fri","open":"06:00","close":"18:00"},{"day":"sat","open":"06:00","close":"18:00"},{"day":"sun","open":"06:00","close":"18:00"}]','Ar Zar Ni Road, Dagon',16.79894,96.14209,NULL,NULL,'active','2026-11-15 15:49:30'),
  (10,3,NULL,'National Museum','Myanmar’s history and art, including the royal Lion Throne.',NULL,'[{"day":"tue","open":"09:30","close":"16:30"},{"day":"wed","open":"09:30","close":"16:30"},{"day":"thu","open":"09:30","close":"16:30"},{"day":"fri","open":"09:30","close":"16:30"},{"day":"sat","open":"09:30","close":"16:30"},{"day":"sun","open":"09:30","close":"16:30"}]','66-74 Pyay Road, Dagon',16.78866,96.14229,NULL,NULL,'active','2026-11-15 15:49:30'),
  (11,3,NULL,'The Secretariat','The vast red-brick government offices of colonial times, now restored and open for visits.',NULL,'[{"day":"tue","open":"09:30","close":"16:30"},{"day":"wed","open":"09:30","close":"16:30"},{"day":"thu","open":"09:30","close":"16:30"},{"day":"fri","open":"09:30","close":"16:30"},{"day":"sat","open":"09:30","close":"16:30"},{"day":"sun","open":"09:30","close":"16:30"}]','Maha Bandula Road, Botataung',16.77547,96.16529,NULL,NULL,'active','2026-11-15 15:49:30'),
  (12,4,NULL,'Bogyoke Aung San Market','A covered colonial-era market full of longyi, jade, lacquerware and souvenirs.',NULL,'[{"day":"tue","open":"10:00","close":"17:00"},{"day":"wed","open":"10:00","close":"17:00"},{"day":"thu","open":"10:00","close":"17:00"},{"day":"fri","open":"10:00","close":"17:00"},{"day":"sat","open":"10:00","close":"17:00"},{"day":"sun","open":"10:00","close":"17:00"}]','Bogyoke Aung San Road, Pabedan',16.78026,96.15559,'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=800&q=80',NULL,'active','2026-11-15 15:49:30'),
  (13,4,NULL,'Theingyi Zei','Downtown’s busy wholesale market for spices, fabrics and everyday goods.',NULL,'[{"day":"mon","open":"07:00","close":"17:00"},{"day":"tue","open":"07:00","close":"17:00"},{"day":"wed","open":"07:00","close":"17:00"},{"day":"thu","open":"07:00","close":"17:00"},{"day":"fri","open":"07:00","close":"17:00"},{"day":"sat","open":"07:00","close":"17:00"},{"day":"sun","open":"07:00","close":"17:00"}]','25th Street, Pabedan',16.77478,96.15346,NULL,NULL,'active','2026-11-15 15:49:30'),
  (14,1,NULL,'19th Street (Chinatown)','A lane of barbecue stalls and street tables that comes alive every evening.',NULL,'[{"day":"mon","open":"17:00","close":"23:30"},{"day":"tue","open":"17:00","close":"23:30"},{"day":"wed","open":"17:00","close":"23:30"},{"day":"thu","open":"17:00","close":"23:30"},{"day":"fri","open":"17:00","close":"23:30"},{"day":"sat","open":"17:00","close":"23:30"},{"day":"sun","open":"17:00","close":"23:30"}]','19th Street, Latha',16.77593,96.14949,NULL,NULL,'active','2026-11-15 15:49:30'),
  (15,2,NULL,'The Strand Hotel','A classic colonial hotel from 1901 on the riverside Strand Road.',NULL,'[{"day":"mon","open":"00:00","close":"24:00"},{"day":"tue","open":"00:00","close":"24:00"},{"day":"wed","open":"00:00","close":"24:00"},{"day":"thu","open":"00:00","close":"24:00"},{"day":"fri","open":"00:00","close":"24:00"},{"day":"sat","open":"00:00","close":"24:00"},{"day":"sun","open":"00:00","close":"24:00"}]','92 Strand Road, Kyauktada',16.76959,96.16259,NULL,NULL,'active','2026-11-15 15:49:30'),
  (16,2,NULL,'Sule Shangri-La','A modern hotel in the heart of downtown, a few steps from Sule Pagoda.',NULL,'[{"day":"mon","open":"00:00","close":"24:00"},{"day":"tue","open":"00:00","close":"24:00"},{"day":"wed","open":"00:00","close":"24:00"},{"day":"thu","open":"00:00","close":"24:00"},{"day":"fri","open":"00:00","close":"24:00"},{"day":"sat","open":"00:00","close":"24:00"},{"day":"sun","open":"00:00","close":"24:00"}]','223 Sule Pagoda Road, Kyauktada',16.77855,96.15853,NULL,NULL,'active','2026-11-15 15:49:30'),
  (17,1,NULL,'Rangoon Tea House','Tea shop classics — milk tea, mohinga, samosas — in a stylish downtown room.',NULL,'[{"day":"mon","open":"07:00","close":"22:00"},{"day":"tue","open":"07:00","close":"22:00"},{"day":"wed","open":"07:00","close":"22:00"},{"day":"thu","open":"07:00","close":"22:00"},{"day":"fri","open":"07:00","close":"22:00"},{"day":"sat","open":"07:00","close":"22:00"},{"day":"sun","open":"07:00","close":"22:00"}]','77-79 Pansodan Street, Kyauktada',16.77226,96.16141,'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80',NULL,'active','2026-11-15 15:49:30'),
  (18,1,NULL,'Feel Myanmar Food','A popular place to try many Myanmar curries and salads in one meal.',NULL,'[{"day":"mon","open":"06:30","close":"21:30"},{"day":"tue","open":"06:30","close":"21:30"},{"day":"wed","open":"06:30","close":"21:30"},{"day":"thu","open":"06:30","close":"21:30"},{"day":"fri","open":"06:30","close":"21:30"},{"day":"sat","open":"06:30","close":"21:30"},{"day":"sun","open":"06:30","close":"21:30"}]','Pyidaungsu Yeiktha Road, Dagon',16.79074,96.14364,NULL,NULL,'active','2026-11-15 15:49:30'),
  (19,5,NULL,'Yangon General Hospital','The city’s large public hospital, in a landmark red-brick building.',NULL,'[{"day":"mon","open":"00:00","close":"24:00"},{"day":"tue","open":"00:00","close":"24:00"},{"day":"wed","open":"00:00","close":"24:00"},{"day":"thu","open":"00:00","close":"24:00"},{"day":"fri","open":"00:00","close":"24:00"},{"day":"sat","open":"00:00","close":"24:00"},{"day":"sun","open":"00:00","close":"24:00"}]','Bogyoke Aung San Road, Lanmadaw',16.77914,96.14898,NULL,NULL,'active','2026-11-15 15:49:30'),
  (20,1,1,'Golden Bean Café','Demo shop: a cosy café near Kandawgyi with iced coffee and snacks.','09 5123 4567','[{"day":"mon","open":"08:00","close":"21:00"},{"day":"tue","open":"08:00","close":"21:00"},{"day":"wed","open":"08:00","close":"21:00"},{"day":"thu","open":"08:00","close":"21:00"},{"day":"fri","open":"08:00","close":"21:00"},{"day":"sat","open":"08:00","close":"21:00"},{"day":"sun","open":"08:00","close":"21:00"}]','Demo business — not a real shop',16.8001,96.1561,'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80',NULL,'active','2026-11-16 23:15:03'),
  (21,6,2,'Lotus Nail Spa','Demo shop: nails, massage and thanaka treatments.','09 7788 1234','[{"day":"mon","open":"10:00","close":"20:00"},{"day":"tue","open":"10:00","close":"20:00"},{"day":"wed","open":"10:00","close":"20:00"},{"day":"thu","open":"10:00","close":"20:00"},{"day":"fri","open":"10:00","close":"20:00"},{"day":"sat","open":"10:00","close":"20:00"}]','Demo business — not a real shop',16.7855,96.1467,'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80',NULL,'active','2026-11-16 23:15:03'),
  (22,1,3,'Shwe Mohinga Corner','Demo shop: morning mohinga, ohn no khao swe and tea-leaf salad.','09 4250 1188','[{"day":"mon","open":"06:00","close":"14:00"},{"day":"tue","open":"06:00","close":"14:00"},{"day":"wed","open":"06:00","close":"14:00"},{"day":"thu","open":"06:00","close":"14:00"},{"day":"fri","open":"06:00","close":"14:00"},{"day":"sat","open":"06:00","close":"14:00"},{"day":"sun","open":"06:00","close":"14:00"}]','Demo business — not a real shop',16.7812,96.1534,'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',NULL,'active','2026-11-16 23:15:03'),
  (23,2,4,'Kandaw Lake Guesthouse','Demo shop: simple rooms with lake views, five minutes from Karaweik.','09 9733 2201','[{"day":"mon","open":"00:00","close":"24:00"},{"day":"tue","open":"00:00","close":"24:00"},{"day":"wed","open":"00:00","close":"24:00"},{"day":"thu","open":"00:00","close":"24:00"},{"day":"fri","open":"00:00","close":"24:00"},{"day":"sat","open":"00:00","close":"24:00"},{"day":"sun","open":"00:00","close":"24:00"}]','Demo business — not a real shop',16.7969,96.17,'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',NULL,'active','2026-11-16 23:15:03'),
  (24,5,5,'Pyay Road Pharmacy','Demo shop: pharmacy with a pharmacist on duty and blood-pressure checks.','09 2550 7766','[{"day":"mon","open":"08:00","close":"22:00"},{"day":"tue","open":"08:00","close":"22:00"},{"day":"wed","open":"08:00","close":"22:00"},{"day":"thu","open":"08:00","close":"22:00"},{"day":"fri","open":"08:00","close":"22:00"},{"day":"sat","open":"08:00","close":"22:00"},{"day":"sun","open":"08:00","close":"22:00"}]','Demo business — not a real shop',16.8213,96.1316,'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?auto=format&fit=crop&w=800&q=80',NULL,'active','2026-11-16 23:15:03'),
  (25,1,7,'Mya Tea House','Family tea shop: mohinga, samosas and milk tea, a short walk from Sule Pagoda.','09 450 123 456','[{"day":"mon","open":"06:30","close":"18:00"},{"day":"tue","open":"06:30","close":"18:00"},{"day":"wed","open":"06:30","close":"18:00"},{"day":"thu","open":"06:30","close":"18:00"},{"day":"fri","open":"06:30","close":"18:00"},{"day":"sat","open":"06:30","close":"18:00"},{"day":"sun","open":"06:30","close":"13:00"}]','No. 12, 31st Street, Kyauktada, Yangon',16.7794,96.1598,'https://images.unsplash.com/photo-1578474846511-04ba529f0b88?auto=format&fit=crop&w=800&q=80',NULL,'active','2026-11-17 11:31:12'),
  (26,4,7,'Mya Grocery','Neighbourhood grocery: rice, cooking oil, snacks and cold drinks. Open every day.','09 450 123 457','[{"day":"mon","open":"08:00","close":"20:00"},{"day":"tue","open":"08:00","close":"20:00"},{"day":"wed","open":"08:00","close":"20:00"},{"day":"thu","open":"08:00","close":"20:00"},{"day":"fri","open":"08:00","close":"20:00"},{"day":"sat","open":"08:00","close":"20:00"},{"day":"sun","open":"08:00","close":"20:00"}]','No. 48, Anawrahta Road, Latha, Yangon',16.7749,96.1486,'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=800&q=80',NULL,'active','2026-11-17 11:31:12'),
  (27,1,8,'Pending Noodle Shop','Shan noodles and sticky rice, opening soon near the market.','09 770 123 456','[{"day":"mon","open":"09:00","close":"18:00"},{"day":"tue","open":"09:00","close":"18:00"},{"day":"wed","open":"09:00","close":"18:00"},{"day":"thu","open":"09:00","close":"18:00"},{"day":"fri","open":"09:00","close":"18:00"},{"day":"sat","open":"09:00","close":"18:00"}]','No. 5, Anawrahta Road, Latha, Yangon',16.7726,96.1512,NULL,NULL,'pending','2026-11-17 11:31:12'),
  (28,7,17,'Yangon Heritage Books & Crafts','Vintage books, Yangon historic maps, antique postcards, and local artisanal handicraft souvenirs.','09 780 112 233','[{"day":"mon","open":"09:00","close":"19:00"},{"day":"tue","open":"09:00","close":"19:00"},{"day":"wed","open":"09:00","close":"19:00"},{"day":"thu","open":"09:00","close":"19:00"},{"day":"fri","open":"09:00","close":"19:00"},{"day":"sat","open":"09:00","close":"19:00"},{"day":"sun","open":"09:00","close":"17:00"}]','No. 114, Pansodan Street (Middle Block), Kyauktada, Yangon',16.7735,96.161,'https://images.unsplash.com/photo-1507842229452-972f10b75482?auto=format&fit=crop&w=800&q=80',NULL,'active','2026-11-16 10:00:00'),
  (29,3,NULL,'Musmeah Yeshua Synagogue','Historical 1890s Jewish house of worship nestled between bustling downtown shopfronts.',NULL,'[{"day":"mon","open":"09:00","close":"14:00"},{"day":"tue","open":"09:00","close":"14:00"},{"day":"wed","open":"09:00","close":"14:00"},{"day":"thu","open":"09:00","close":"14:00"},{"day":"fri","open":"09:00","close":"14:00"}]','No. 85, 26th Street, Pabedan, Yangon',16.7761,96.1542,NULL,NULL,'active','2026-11-16 11:00:00'),
  (30,3,NULL,'St. Mary’s Cathedral','Striking neo-gothic red brick cathedral with magnificent twin spires and stained glass.',NULL,'[{"day":"mon","open":"08:00","close":"17:00"},{"day":"tue","open":"08:00","close":"17:00"},{"day":"wed","open":"08:00","close":"17:00"},{"day":"thu","open":"08:00","close":"17:00"},{"day":"fri","open":"08:00","close":"17:00"},{"day":"sat","open":"08:00","close":"17:00"},{"day":"sun","open":"08:00","close":"18:00"}]','No. 372, Bo Aung Kyaw Street, Botahtaung, Yangon',16.7779,96.1672,NULL,NULL,'active','2026-11-16 11:30:00'),
  (31,4,NULL,'Junction City Shopping Centre','Modern multi-level shopping complex with cinema, international fashion brands and food hall.',NULL,'[{"day":"mon","open":"09:30","close":"20:00"},{"day":"tue","open":"09:30","close":"20:00"},{"day":"wed","open":"09:30","close":"20:00"},{"day":"thu","open":"09:30","close":"20:00"},{"day":"fri","open":"09:30","close":"20:00"},{"day":"sat","open":"09:30","close":"20:00"},{"day":"sun","open":"09:30","close":"20:00"}]','Corner of Bogyoke Aung San Road & Shwedagon Pagoda Road, Pabedan',16.7788,96.1539,NULL,NULL,'active','2026-11-16 12:00:00'),
  (32,1,19,'Inya View Fine Dining','Upscale lakeside restaurant serving modern Myanmar fusion gastronomy and fine wine.','09 881 223 344','[{"day":"mon","open":"11:00","close":"22:30"},{"day":"tue","open":"11:00","close":"22:30"},{"day":"wed","open":"11:00","close":"22:30"},{"day":"thu","open":"11:00","close":"22:30"},{"day":"fri","open":"11:00","close":"23:00"},{"day":"sat","open":"11:00","close":"23:00"},{"day":"sun","open":"11:00","close":"22:30"}]','No. 63, Inya Road, Kamayut, Yangon',16.8321,96.1412,'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',NULL,'active','2026-11-12 10:00:00'),
  (33,4,20,'Bahan Heritage Gems & Crafts','Certified natural jade, ruby, sapphire jewelry and authentic Shan lacquerware crafts.','09 970 334 455','[{"day":"mon","open":"10:00","close":"19:00"},{"day":"tue","open":"10:00","close":"19:00"},{"day":"wed","open":"10:00","close":"19:00"},{"day":"thu","open":"10:00","close":"19:00"},{"day":"fri","open":"10:00","close":"19:00"},{"day":"sat","open":"10:00","close":"19:00"}]','No. 20, Kaba Aye Pagoda Road, Bahan, Yangon',16.8125,96.1558,'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80',NULL,'active','2026-11-13 11:30:00'),
  (34,1,21,'Golden Tea Room & Bakery','New artisan patisserie and premium organic whole-leaf green tea room in Yankin.','09 660 778 899','[{"day":"mon","open":"08:00","close":"20:00"},{"day":"tue","open":"08:00","close":"20:00"},{"day":"wed","open":"08:00","close":"20:00"},{"day":"thu","open":"08:00","close":"20:00"},{"day":"fri","open":"08:00","close":"20:00"},{"day":"sat","open":"08:00","close":"20:00"},{"day":"sun","open":"08:00","close":"20:00"}]','No. 8, Kanbe Road, Yankin, Yangon',16.8285,96.1685,NULL,NULL,'pending','2026-11-18 14:00:00'),
  (35,6,22,'Orchid Thai Wellness & Spa','Relaxing authentic Thai massage, herbal steam compresses, and body scrub treatments.','09 550 443 322','[{"day":"mon","open":"10:00","close":"21:00"},{"day":"tue","open":"10:00","close":"21:00"},{"day":"wed","open":"10:00","close":"21:00"},{"day":"thu","open":"10:00","close":"21:00"},{"day":"fri","open":"10:00","close":"21:00"},{"day":"sat","open":"10:00","close":"21:00"},{"day":"sun","open":"10:00","close":"21:00"}]','No. 77, Sanchaung Street, Sanchaung, Yangon',16.8045,96.1345,NULL,NULL,'pending','2026-11-18 15:30:00'),
  (36,7,12,'Old Downtown Barber Club','Classic gentleman’s haircuts, hot towel shaves, and beard grooming in colonial heritage building.','09 330 221 144','[{"day":"mon","open":"09:00","close":"19:00"},{"day":"tue","open":"09:00","close":"19:00"},{"day":"wed","open":"09:00","close":"19:00"},{"day":"thu","open":"09:00","close":"19:00"},{"day":"fri","open":"09:00","close":"19:00"},{"day":"sat","open":"09:00","close":"19:00"}]','No. 180, Mahabandoola Road, Kyauktada, Yangon',16.7745,96.1605,NULL,NULL,'hidden','2026-11-14 09:00:00');
/*!40000 ALTER TABLE `places` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure and data for table `place_photos`
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

LOCK TABLES `place_photos` WRITE;
/*!40000 ALTER TABLE `place_photos` DISABLE KEYS */;
INSERT INTO `place_photos` (`id`, `place_id`, `url`) VALUES
  (1,1,'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1000&q=80'),
  (2,1,'https://images.unsplash.com/photo-1598971861713-54ad16a7e72e?auto=format&fit=crop&w=1000&q=80'),
  (3,2,'https://images.unsplash.com/photo-1582650625119-3a31f841839d?auto=format&fit=crop&w=1000&q=80'),
  (4,7,'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1000&q=80'),
  (5,12,'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=1000&q=80'),
  (6,17,'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1000&q=80'),
  (7,20,'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1000&q=80'),
  (8,20,'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1000&q=80'),
  (9,21,'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1000&q=80'),
  (10,22,'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1000&q=80'),
  (11,23,'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80'),
  (12,24,'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?auto=format&fit=crop&w=1000&q=80'),
  (13,25,'https://images.unsplash.com/photo-1578474846511-04ba529f0b88?auto=format&fit=crop&w=1000&q=80'),
  (14,25,'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=80'),
  (15,26,'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1000&q=80'),
  (16,28,'https://images.unsplash.com/photo-1507842229452-972f10b75482?auto=format&fit=crop&w=1000&q=80'),
  (17,32,'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=80'),
  (18,33,'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1000&q=80'),
  (19,34,'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1000&q=80'),
  (20,35,'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1000&q=80');
/*!40000 ALTER TABLE `place_photos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure and data for table `owner_upgrades`
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
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

LOCK TABLES `owner_upgrades` WRITE;
/*!40000 ALTER TABLE `owner_upgrades` DISABLE KEYS */;
INSERT INTO `owner_upgrades` (`id`, `user_id`, `months`, `amount`, `payment_method`, `payment_ref`, `payment_proof`, `status`, `starts_at`, `expires_at`, `admin_id`, `reviewed_at`, `created_at`) VALUES
  (1,1,3,30000.0,'KBZPay','KPAY-2026001',NULL,'approved','2026-11-15 09:00:00','2027-05-15 23:59:59',18,'2026-11-15 10:00:00','2026-11-15 09:00:00'),
  (2,2,3,30000.0,'WavePay','WAVE-2026002',NULL,'approved','2026-11-15 09:00:00','2027-05-15 23:59:59',18,'2026-11-15 10:00:00','2026-11-15 09:00:00'),
  (3,3,6,55000.0,'KBZPay','KPAY-2026003',NULL,'approved','2026-11-15 09:00:00','2027-08-15 23:59:59',18,'2026-11-15 10:00:00','2026-11-15 09:00:00'),
  (4,4,12,100000.0,'KBZPay','KPAY-2026004',NULL,'approved','2026-11-15 09:00:00','2027-11-15 23:59:59',18,'2026-11-15 10:00:00','2026-11-15 09:00:00'),
  (5,5,12,100000.0,'CBPay','CBPAY-2026005',NULL,'approved','2026-11-15 09:00:00','2027-11-15 23:59:59',18,'2026-11-15 10:00:00','2026-11-15 09:00:00'),
  (6,7,12,150000.0,'Wave Pay','SEED-OWNER-001',NULL,'approved','2026-11-07 11:31:12','2027-11-07 23:59:59',18,'2026-11-07 12:00:00','2026-11-07 11:31:12'),
  (7,8,3,40000.0,'KBZPay','SEED-PENDING-001',NULL,'pending',NULL,NULL,NULL,NULL,'2026-11-17 11:31:12'),
  (8,17,6,55000.0,'KBZPay','KPAY-2026008',NULL,'approved','2026-11-10 10:00:00','2027-05-10 23:59:59',18,'2026-11-10 11:00:00','2026-11-10 10:00:00'),
  (9,19,12,120000.0,'KBZPay','KPAY-2026009',NULL,'approved','2026-11-12 10:00:00','2027-11-12 23:59:59',18,'2026-11-12 11:00:00','2026-11-12 10:00:00'),
  (10,20,6,60000.0,'AYA Pay','AYAPAY-2026010',NULL,'approved','2026-11-13 11:30:00','2027-05-13 23:59:59',18,'2026-11-13 12:00:00','2026-11-13 11:30:00'),
  (11,21,3,35000.0,'KBZPay','KPAY-2026011',NULL,'pending',NULL,NULL,NULL,NULL,'2026-11-18 14:00:00'),
  (12,22,12,110000.0,'Wave Pay','WAVE-2026012',NULL,'pending',NULL,NULL,NULL,NULL,'2026-11-18 15:30:00'),
  (13,1,3,30000.0,'KBZPay','KPAY-2026013',NULL,'pending',NULL,NULL,NULL,NULL,'2026-11-18 16:45:00'),
  (14,26,1,15000.0,'KBZPay','INVALID-REF-99',NULL,'rejected',NULL,NULL,18,'2026-11-15 14:00:00','2026-11-15 13:00:00');
/*!40000 ALTER TABLE `owner_upgrades` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure and data for table `posts`
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

LOCK TABLES `posts` WRITE;
/*!40000 ALTER TABLE `posts` DISABLE KEYS */;
INSERT INTO `posts` (`id`, `place_id`, `type`, `content`, `image_url`, `discount_text`, `ticket_limit`, `expires_at`, `is_pinned`, `created_at`) VALUES
  (1,25,'discount','Hot afternoons call for iced milk tea. Show your POINTER ticket for 20% off any iced drink.',NULL,'20% off every iced drink',50,'2026-12-05 23:59:59',1,'2026-11-16 10:00:00'),
  (2,25,'discount','Thingyan week special: A free crispy samosa with every bowl of mohinga before 10 AM.',NULL,'Free samosa with mohinga before 10 AM',25,'2026-11-18 22:00:00',0,'2026-11-16 12:00:00'),
  (3,25,'normal','New menu item: Warm steamed Shan tofu with chili oil and crispy shallots available every weekend!',NULL,NULL,NULL,NULL,0,'2026-11-17 08:30:00'),
  (4,20,'discount','Specialty cold brew season: 25% discount on all cold brew and pour-over single origins.',NULL,'25% off all cold brew & pour-over',40,'2026-11-28 23:59:59',1,'2026-11-16 09:00:00'),
  (5,20,'discount','Morning combo deal: Order any coffee and get 50% off our freshly baked homemade croissants.',NULL,'50% off croissants with coffee',30,'2026-11-19 12:00:00',0,'2026-11-16 14:00:00'),
  (6,20,'normal','Our quiet second-floor co-working space now has high-speed fiber Wi-Fi and power outlets at every table.',NULL,NULL,NULL,NULL,1,'2026-11-17 09:00:00'),
  (7,22,'discount','Our signature Danubyu Mohinga with crispy chickpea fritter: 1,000 Ks discount per bowl!',NULL,'1,000 Ks off Danubyu Mohinga',50,'2026-11-25 23:59:59',1,'2026-11-16 07:00:00'),
  (8,22,'normal','Open early from 6:00 AM every single morning. Best hot breakfast in downtown Yangon!',NULL,NULL,NULL,NULL,0,'2026-11-17 06:00:00'),
  (9,21,'discount','Weekday pampering: 20% discount on organic gel manicure and herbal foot spa pedicure combo.',NULL,'20% off Gel Mani & Pedi Combo',25,'2026-12-02 23:59:59',1,'2026-11-16 11:00:00'),
  (10,21,'discount','Traditional Thanaka & herbal facial treatment: 15% off Monday to Thursday.',NULL,'15% off Thanaka Herbal Facial',15,'2026-11-22 23:59:59',0,'2026-11-16 15:00:00'),
  (11,21,'normal','Imported OPI non-toxic nail polishes in 40+ new seasonal pastel shades have arrived.',NULL,NULL,NULL,NULL,0,'2026-11-17 11:00:00'),
  (12,23,'discount','Lake view staycation: 15,000 Ks discount per night when booking 2 consecutive nights.',NULL,'15,000 Ks off 2+ nights stay',12,'2026-12-10 23:59:59',1,'2026-11-15 16:00:00'),
  (13,23,'discount','Complimentary breakfast overlooking Kandawgyi Lake on night two of your reservation.',NULL,'Free lake-view breakfast on day 2',15,'2026-11-24 23:59:59',0,'2026-11-16 16:00:00'),
  (14,24,'discount','Health week: Free blood-pressure & glucose check + 10% off multivitamins with ticket.',NULL,'Free health check + 10% off vitamins',45,'2026-11-30 23:59:59',1,'2026-11-16 08:00:00'),
  (15,24,'normal','Registered senior pharmacist is on-site daily from 8:00 AM to 10:00 PM for medical advice.',NULL,NULL,NULL,NULL,0,'2026-11-17 08:00:00'),
  (16,26,'discount','Family pantry deal: 1,500 Ks off a 5 kg premium Shwebo Pawsan rice bag.',NULL,'1,500 Ks off 5 kg Shwebo Pawsan',30,'2026-11-26 23:59:59',1,'2026-11-16 13:00:00'),
  (17,26,'discount','Buy 2 large bottles of cooking oil, receive 1 packet of premium rice noodles free.',NULL,'Free rice noodles with 2 cooking oils',20,'2026-11-21 23:59:59',0,'2026-11-16 17:00:00'),
  (18,26,'normal','Cold beverages, fresh drinking water bottles, and dairy items restocked every morning at 8:00 AM.',NULL,NULL,NULL,NULL,0,'2026-11-17 07:30:00'),
  (19,28,'discount','Book lovers discount: 15% off all vintage Myanmar history books and hand-drawn city maps.',NULL,'15% off vintage books & maps',25,'2026-11-29 23:59:59',1,'2026-11-16 10:30:00'),
  (20,28,'normal','Rare colonial-era postcards and restored Yangon architectural prints now on display in our gallery corner.',NULL,NULL,NULL,NULL,0,'2026-11-17 10:00:00'),
  (21,20,'discount','Past promotional offer: Free mini-cookie with any espresso.',NULL,'Free cookie with espresso',20,'2026-11-10 18:00:00',0,'2026-11-05 09:00:00');
/*!40000 ALTER TABLE `posts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure and data for table `tickets`
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

LOCK TABLES `tickets` WRITE;
/*!40000 ALTER TABLE `tickets` DISABLE KEYS */;
INSERT INTO `tickets` (`id`, `user_id`, `post_id`, `ticket_code`, `status`, `used_at`, `created_at`) VALUES
  (1,6,1,'MT-7Q4K','unused',NULL,'2026-11-18 09:45:00'),
  (2,6,4,'GB-8X2M','unused',NULL,'2026-11-18 09:30:00'),
  (3,6,7,'SM-4K9P','used','2026-11-17 13:15:00','2026-11-17 12:00:00'),
  (4,6,16,'MG-3PX8','expired',NULL,'2026-11-16 10:00:00'),
  (5,8,16,'MG-H2NM','used','2026-11-17 15:30:00','2026-11-17 14:00:00'),
  (6,8,7,'SM-6R1T','unused',NULL,'2026-11-18 08:30:00'),
  (7,9,1,'MT-9A1B','unused',NULL,'2026-11-17 10:00:00'),
  (8,10,1,'MT-2C3D','used','2026-11-17 16:00:00','2026-11-17 15:00:00'),
  (9,11,1,'MT-4E5F','unused',NULL,'2026-11-17 16:30:00'),
  (10,12,1,'MT-6G7H','used','2026-11-18 08:30:00','2026-11-18 07:30:00'),
  (11,13,1,'MT-8J9K','unused',NULL,'2026-11-18 09:00:00'),
  (12,14,1,'MT-1L2M','unused',NULL,'2026-11-18 09:15:00'),
  (13,9,2,'MT-3N4P','used','2026-11-17 09:00:00','2026-11-17 08:00:00'),
  (14,10,2,'MT-5Q6R','used','2026-11-17 09:15:00','2026-11-17 08:30:00'),
  (15,15,2,'MT-7S8T','unused',NULL,'2026-11-18 07:45:00'),
  (16,16,2,'MT-9U0V','unused',NULL,'2026-11-18 08:15:00'),
  (17,9,4,'GB-2W3X','unused',NULL,'2026-11-17 11:00:00'),
  (18,11,4,'GB-4Y5Z','used','2026-11-17 15:45:00','2026-11-17 14:30:00'),
  (19,13,4,'GB-6A7B','unused',NULL,'2026-11-18 09:00:00'),
  (20,14,4,'GB-8C9D','unused',NULL,'2026-11-18 09:30:00'),
  (21,15,4,'GB-1E2F','used','2026-11-17 17:00:00','2026-11-17 16:00:00'),
  (22,10,5,'GB-3G4H','used','2026-11-17 10:30:00','2026-11-17 09:30:00'),
  (23,12,5,'GB-5J6K','unused',NULL,'2026-11-18 08:00:00'),
  (24,16,5,'GB-7L8M','unused',NULL,'2026-11-18 08:45:00'),
  (25,10,7,'SM-9N0P','used','2026-11-17 08:45:00','2026-11-17 07:30:00'),
  (26,12,7,'SM-2Q3R','used','2026-11-17 09:00:00','2026-11-17 08:00:00'),
  (27,13,7,'SM-4S5T','unused',NULL,'2026-11-18 07:15:00'),
  (28,14,7,'SM-6U7V','unused',NULL,'2026-11-18 07:45:00'),
  (29,15,7,'SM-8W9X','unused',NULL,'2026-11-18 08:15:00'),
  (30,9,9,'LN-1Y2Z','unused',NULL,'2026-11-17 14:00:00'),
  (31,13,9,'LN-3A4B','used','2026-11-17 17:30:00','2026-11-17 16:00:00'),
  (32,15,9,'LN-5C6D','unused',NULL,'2026-11-18 09:00:00'),
  (33,16,9,'LN-7E8F','unused',NULL,'2026-11-18 09:30:00'),
  (34,11,10,'LN-9G0H','unused',NULL,'2026-11-17 13:00:00'),
  (35,13,10,'LN-2J3K','unused',NULL,'2026-11-18 08:30:00'),
  (36,11,12,'KG-4L5M','unused',NULL,'2026-11-16 18:00:00'),
  (37,14,12,'KG-6N7P','used','2026-11-17 11:00:00','2026-11-16 20:00:00'),
  (38,10,14,'PR-8Q9R','used','2026-11-17 14:00:00','2026-11-17 12:30:00'),
  (39,12,14,'PR-1S2T','unused',NULL,'2026-11-18 08:45:00'),
  (40,16,14,'PR-3U4V','unused',NULL,'2026-11-18 09:15:00'),
  (41,12,16,'MG-5W6X','used','2026-11-17 16:45:00','2026-11-17 15:30:00'),
  (42,14,16,'MG-7Y8Z','unused',NULL,'2026-11-18 08:15:00'),
  (43,15,16,'MG-9A0B','unused',NULL,'2026-11-18 09:00:00'),
  (44,9,17,'MG-2C3D','used','2026-11-17 17:15:00','2026-11-17 16:30:00'),
  (45,13,17,'MG-4E5F','unused',NULL,'2026-11-18 08:30:00'),
  (46,11,19,'HB-6G7H','unused',NULL,'2026-11-17 15:00:00'),
  (47,10,19,'HB-8J9K','unused',NULL,'2026-11-18 09:00:00'),
  (48,14,19,'HB-1L2M','used','2026-11-18 09:45:00','2026-11-18 08:45:00');
/*!40000 ALTER TABLE `tickets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure and data for table `reviews`
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

LOCK TABLES `reviews` WRITE;
/*!40000 ALTER TABLE `reviews` DISABLE KEYS */;
INSERT INTO `reviews` (`id`, `place_id`, `user_id`, `rating`, `comment`, `owner_reply`, `created_at`, `updated_at`) VALUES
  (1,1,9,5,'Came at sunset — the stupa really glows. Bring socks, the marble gets hot in the afternoon.',NULL,'2026-10-28 18:20:00',NULL),
  (2,1,10,5,'Came with my family in the evening — so peaceful. Even more beautiful on a festival night.',NULL,'2026-10-21 19:05:00',NULL),
  (3,1,11,4,'Beautiful, but the south stairs were crowded. The east entrance was quieter.',NULL,'2026-10-12 16:40:00',NULL),
  (4,1,12,5,'ရင်ပြင်တော်ပေါ်မှာ လေအေးအေးလေးနဲ့ စိတ်အေးချမ်းမှု အပြည့်ရပါတယ်။ ညနေ ၅ နာရီလောက် သွားရင် အကောင်းဆုံးပါပဲ။',NULL,'2026-11-01 17:30:00',NULL),
  (5,1,8,5,'Went at sunset; the pagoda is beautiful and easy to reach.',NULL,'2026-11-17 11:31:12',NULL),
  (6,2,12,4,'Right in the middle of downtown — easy to combine with City Hall and the park.',NULL,'2026-10-30 11:10:00',NULL),
  (7,2,13,5,'Stopped by after work and felt calm right away. Beautiful night lighting.',NULL,'2026-10-18 17:45:00',NULL),
  (8,7,16,5,'Kandawgyi boardwalk at golden hour with Karaweik in view — my favourite walk.',NULL,'2026-10-27 17:50:00',NULL),
  (9,7,10,4,'Great place for morning jogging. Fresh cool air right in the city.',NULL,'2026-11-03 07:15:00',NULL),
  (10,12,14,4,'Great for jade and longyi. Closed on Mondays, so plan ahead.',NULL,'2026-10-25 13:30:00',NULL),
  (11,12,11,4,'Vibrant historical market with amazing traditional handicrafts and lacquerware.',NULL,'2026-11-02 14:20:00',NULL),
  (12,12,6,4,'Good place for thanaka and souvenirs. Go early to avoid the crowd.',NULL,'2026-11-17 11:31:12',NULL),
  (13,17,6,5,'Best tea leaf salad in downtown. The staff remembered our order.',NULL,'2026-11-17 11:31:12',NULL),
  (14,17,13,5,'လက်ဖက်ရည် ချိုဆိမ့် နဲ့ ပလာတာ အရမ်းကောင်းတယ်။ ဆိုင်အပြင်အဆင်လည်း သပ်ရပ်ပါတယ်။',NULL,'2026-11-05 18:30:00',NULL),
  (15,17,15,4,'Very cozy atmosphere, friendly service and delicious mutton samosa soup.',NULL,'2026-11-08 12:15:00',NULL),
  (16,18,9,5,'Authentic Myanmar curry spread with lots of fresh vegetables and dipping paste.',NULL,'2026-11-06 13:00:00',NULL),
  (17,18,14,4,'ဟင်းစုံပြီး အရသာကောင်းပါတယ်။ နေ့လယ်ဘက်ဆို လူတော့ နည်းနည်းများတတ်တယ်။',NULL,'2026-11-09 13:45:00',NULL),
  (18,20,15,4,'Good coffee and quiet in the morning. The Wi-Fi was fast and comfortable for laptop work.','Thank you Su Myat! We recently upgraded our fiber connection. Hope to see you again soon!','2026-11-08 09:40:00',NULL),
  (19,20,6,5,'The iced cold brew is top notch! Perfect place to unwind in the afternoon.','Thanks for visiting! Show your POINTER app on your next visit for free coffee beans sample.','2026-11-17 14:10:00','2026-11-17 15:00:00'),
  (20,20,10,5,'ကော်ဖီအရသာ ကောင်းမွန်ပြီး Barista တွေရဲ့ ဝန်ဆောင်မှု သဘောကျပါတယ်။','အားပေးမှုကို ကျေးဇူးတင်ရှိပါသည်ခင်ဗျာ။ နောက်လည်း ကြွလှမ်းခဲ့ပါဦးနော်။','2026-11-12 11:20:00',NULL),
  (21,21,9,5,'Very gentle and skilled nail technicians. The organic scrub was so relaxing!','Thank you Thiri! Delighted you enjoyed the organic scrub treatment.','2026-11-10 15:30:00',NULL),
  (22,21,13,5,'သန့်ရှင်းသပ်ရပ်ပြီး ဝန်ထမ်းတွေ ဖော်ရွေပါတယ်။ ခြေသည်းလက်သည်း အလှပြင်တာ သေသပ်တယ်။','ကျေးဇူးတင်ပါတယ် မနှင်းရေ။ အမြဲ အကောင်းဆုံး ဝန်ဆောင်မှုပေးသွားပါမယ်နော်။','2026-11-14 16:45:00',NULL),
  (23,22,12,5,'ငါးဖယ်အပြည့်နဲ့ မုန့်ဟင်းခါး အရသာ အရမ်းကြိုက်တယ်။ မနက်တိုင်း လူကျပါတယ်။','အားပေးမှုကို ကျေးဇူးတင်ပါတယ်ခင်ဗျာ။ လက်ဆတ်တဲ့ ငါးဖယ်ပဲ အမြဲသုံးထားပါတယ်။','2026-11-11 08:30:00',NULL),
  (24,22,6,4,'Rich and fragrant fish broth with crispy fritters. Great breakfast spot!','Thank you! Come try our crispy gourd fritters next time.','2026-11-16 08:00:00',NULL),
  (25,23,11,5,'Lovely peaceful room right near Kandawgyi. The host was exceptionally helpful with city advice.','Thank you Sophie! Glad you had a wonderful time in Yangon.','2026-11-04 10:15:00',NULL),
  (26,23,14,4,'အခန်းတွေ သန့်ရှင်းပြီး ညဘက် အေးအေးချမ်းချမ်း အိပ်လို့ရပါတယ်။','ကျေးဇူးတင်ပါတယ်ခင်ဗျာ။ သာယာအေးချမ်းစွာ အနားယူနိုင်တဲ့အတွက် ဝမ်းသာပါတယ်။','2026-11-07 11:30:00',NULL),
  (27,24,10,5,'ဆေးဝါးစုံလင်ပြီး ဆရာဝန်/ဆေးဝါးကျွမ်းကျင်သူရဲ့ အကြံဉာဏ်ပေးမှု အလွန်ကောင်းမွန်ပါတယ်။','ကျေးဇူးတင်ရှိပါသည်ခင်ဗျာ။ ကျန်းမာရေးအတွက် လိုအပ်သည့်အခါ အမြဲကြိုဆိုလျက်ပါ။','2026-11-13 14:20:00',NULL),
  (28,25,6,5,'The mohinga is rich and the tea is strong. Cheap, clean and quick.','Thank you! Tell the counter you came from POINTER and the refill is on us.','2026-11-17 11:31:12',NULL),
  (29,25,9,5,'ချိုဆိမ့် လက်ဖက်ရည်နဲ့ စမူဆာ အရမ်းလိုက်ဖက်ပါတယ်။ အမြဲလာသောက်ဖြစ်တယ်။','ကျေးဇူးတင်ပါတယ် မသီရိရေ။ စေတနာအပြည့်နဲ့ အမြဲဖျော်စပ်ပေးနေပါတယ်။','2026-11-15 09:15:00',NULL),
  (30,26,8,4,'Good prices and the staff helped me carry the rice to the car.','You are welcome! Glad to assist anytime.','2026-11-17 11:31:12',NULL),
  (31,26,12,5,'ကုန်စုံပြီး ဈေးနှုန်းမှန်ကန်ပါတယ်။ ရပ်ကွက်ထဲမှာ အားကိုးရတဲ့ဆိုင်ပါ။','ကျေးဇူးတင်ပါတယ်ခင်ဗျာ။ လူကြီးမင်းတို့ အဆင်ပြေစေဖို့ အမြဲကြိုးစားနေပါတယ်။','2026-11-16 17:00:00',NULL),
  (32,28,11,5,'Found incredible vintage books and antique postcards of Old Rangoon. A hidden gem!','Thank you! We love sharing Yangon\'s living heritage with our guests.','2026-11-15 15:45:00',NULL),
  (33,28,16,5,'စာအုပ်ကောင်းတွေ အများကြီးတွေ့ရပါတယ်။ ဆိုင်လေးကလည်း အေးအေးဆေးဆေး ရှိတယ်။','အားပေးမှုကို အထူးကျေးဇူးတင်ပါတယ်ခင်ဗျာ။','2026-11-16 11:15:00',NULL);
/*!40000 ALTER TABLE `reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure and data for table `favorites`
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

LOCK TABLES `favorites` WRITE;
/*!40000 ALTER TABLE `favorites` DISABLE KEYS */;
INSERT INTO `favorites` (`user_id`, `place_id`, `created_at`) VALUES
  (6,1,'2026-11-17 11:31:12'),
  (6,7,'2026-11-17 11:35:00'),
  (6,12,'2026-11-17 11:31:12'),
  (6,17,'2026-11-17 11:31:12'),
  (6,20,'2026-11-17 12:00:00'),
  (6,25,'2026-11-17 12:15:00'),
  (9,1,'2026-11-17 12:05:00'),
  (9,17,'2026-11-17 12:10:00'),
  (9,21,'2026-11-17 12:20:00'),
  (9,25,'2026-11-17 12:30:00'),
  (10,1,'2026-11-17 12:25:00'),
  (10,7,'2026-11-17 12:35:00'),
  (10,20,'2026-11-17 12:45:00'),
  (10,22,'2026-11-17 12:55:00'),
  (11,1,'2026-11-17 13:00:00'),
  (11,11,'2026-11-17 13:10:00'),
  (11,12,'2026-11-17 13:20:00'),
  (11,23,'2026-11-17 13:30:00'),
  (11,28,'2026-11-17 13:40:00'),
  (12,1,'2026-11-17 13:15:00'),
  (12,2,'2026-11-17 13:25:00'),
  (12,22,'2026-11-17 13:35:00'),
  (12,26,'2026-11-17 13:45:00'),
  (13,2,'2026-11-17 13:40:00'),
  (13,17,'2026-11-17 13:50:00'),
  (13,21,'2026-11-17 14:00:00');
/*!40000 ALTER TABLE `favorites` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure and data for table `messages`
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

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `body`, `status`, `is_read`, `created_at`) VALUES
  (1,7,6,'Hi! Thanks for saving Mya Tea House. Ask us anything about the menu.','accepted',1,'2026-11-17 18:00:00'),
  (2,6,7,'Thanks! Do you still have the palm-sugar latte?','accepted',1,'2026-11-17 19:00:00'),
  (3,7,6,'Yes, every day until 6 pm. Show your ticket for 20% off.','accepted',1,'2026-11-17 20:00:00'),
  (4,1,6,'Hello! Welcome to Golden Bean Café. Feel free to ask about our beans or reservations.','accepted',1,'2026-11-18 08:00:00'),
  (5,6,1,'Hi! Is the second-floor seating suitable for working with laptops?','accepted',1,'2026-11-18 08:30:00'),
  (6,1,6,'Yes, absolutely! We have power sockets and high-speed fiber Wi-Fi on every desk.','accepted',1,'2026-11-18 08:45:00'),
  (7,6,2,'Hi! Do I need to book in advance for the gel manicure deal on Saturday?','accepted',1,'2026-11-18 09:10:00'),
  (8,2,6,'Hello! Saturdays get quite busy, so booking 1 day ahead is recommended. What time works best for you?','accepted',0,'2026-11-18 09:30:00'),
  (9,3,6,'မင်္ဂလာပါ! ရွှေမုန့်ဟင်းခါးဆိုင်မှ ကြိုဆိုပါတယ်။ မနက် ၆ နာရီကနေ နေ့လယ် ၁ နာရီအထိ ဖွင့်ပါတယ်ခင်ဗျာ။','accepted',1,'2026-11-18 07:00:00'),
  (10,6,3,'ဟုတ်ကဲ့ပါ အကို။ ငါးဖယ် မုန့်ဟင်းခါး သီးသန့် ပါဆယ်မှာလို့ရပါသလားခင်ဗျ?','accepted',1,'2026-11-18 07:20:00'),
  (11,3,6,'ရပါတယ်ခင်ဗျာ။ ဘယ်အချိန်ယူယူ အဆင်သင့်ရအောင် ကြိုချိုင့်ထည့်ထားပေးပါမယ်။','accepted',1,'2026-11-18 07:35:00'),
  (12,11,6,'Hi! I noticed your review on Rangoon Tea House. Any specific curry you would recommend for visitors?','sent',0,'2026-11-18 10:15:00'),
  (13,9,2,'Can I get nail art with the gel manicure promo?','accepted',1,'2026-11-17 14:00:00'),
  (14,2,9,'Yes, custom nail art can be added for just 3,000 Ks extra.','accepted',1,'2026-11-17 14:15:00'),
  (15,11,4,'Hello, do you offer airport pickup service from Mingaladon?','accepted',1,'2026-11-16 19:00:00'),
  (16,4,11,'Yes Sophie! We can arrange a private taxi pickup for 25,000 Ks directly to our guesthouse.','accepted',1,'2026-11-16 19:25:00');
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure and data for table `notifications`
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

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` (`id`, `user_id`, `type`, `ref_id`, `is_read`, `created_at`) VALUES
  (1,6,'new_deal',4,0,'2026-11-18 09:00:00'),
  (2,6,'message',8,0,'2026-11-18 09:30:00'),
  (3,6,'review_reply',28,1,'2026-11-17 12:00:00'),
  (4,6,'new_deal',1,1,'2026-11-16 10:00:00'),
  (5,6,'message',12,0,'2026-11-18 10:15:00'),
  (6,7,'request_approved',6,1,'2026-11-07 12:00:00'),
  (7,7,'message',2,1,'2026-11-17 19:00:00'),
  (8,8,'message',1,0,'2026-11-17 18:30:00'),
  (9,9,'new_deal',9,0,'2026-11-16 11:00:00'),
  (10,9,'review_reply',21,1,'2026-11-10 16:00:00'),
  (11,11,'new_deal',12,1,'2026-11-15 16:30:00'),
  (12,11,'review_reply',25,1,'2026-11-04 11:00:00');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure and data for table `blocks`
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

LOCK TABLES `blocks` WRITE;
/*!40000 ALTER TABLE `blocks` DISABLE KEYS */;
INSERT INTO `blocks` (`blocker_id`, `blocked_id`) VALUES
  (6,8),
  (10,8);
/*!40000 ALTER TABLE `blocks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure and data for table `reports`
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

LOCK TABLES `reports` WRITE;
/*!40000 ALTER TABLE `reports` DISABLE KEYS */;
INSERT INTO `reports` (`id`, `reporter_id`, `target_type`, `target_id`, `reason`, `status`, `created_at`) VALUES
  (1,6,'review',5,'The review appears copied from an external travel blog.','open','2026-11-18 08:00:00'),
  (2,9,'place',19,'Phone number for general inquiry needs updating.','resolved','2026-11-15 11:00:00'),
  (3,10,'post',2,'Question about promo hours expiry during festival.','open','2026-11-17 14:00:00'),
  (4,12,'review',3,'Contains promotional link inside review comment.','dismissed','2026-11-14 09:30:00'),
  (5,13,'review',23,'Suspected promotional spam with external Telegram channel link.','open','2026-11-18 10:30:00'),
  (6,14,'place',27,'Shop address coordinates appear 150m off actual entrance alley.','open','2026-11-18 11:15:00'),
  (7,15,'post',1,'Customer inquiries if discount applies to weekend afternoon hours.','resolved','2026-11-16 15:45:00'),
  (8,16,'review',18,'Reviewer used inappropriate and abusive language against waitstaff.','open','2026-11-18 13:00:00'),
  (9,17,'place',28,'Merchant appeal: Requesting review of secondary category tags.','open','2026-11-18 14:20:00'),
  (10,11,'place',33,'Incorrect holiday schedule listed on map.','dismissed','2026-11-17 16:00:00');
/*!40000 ALTER TABLE `reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure and data for table `search_history`
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

LOCK TABLES `search_history` WRITE;
/*!40000 ALTER TABLE `search_history` DISABLE KEYS */;
INSERT INTO `search_history` (`id`, `user_id`, `keyword`, `category_id`, `place_id`, `created_at`) VALUES
  (1,6,'mohinga',1,25,'2026-11-18 09:10:00'),
  (2,6,'cold brew coffee',1,20,'2026-11-18 09:20:00'),
  (3,6,'shwedagon',3,1,'2026-11-17 10:15:00'),
  (4,6,'nail spa',6,21,'2026-11-18 09:05:00'),
  (5,9,'traditional tea',1,17,'2026-11-17 11:00:00'),
  (6,10,'lake jog',3,7,'2026-11-17 06:45:00'),
  (7,11,'vintage books',7,28,'2026-11-17 14:30:00'),
  (8,11,'market crafts',4,12,'2026-11-16 12:00:00'),
  (9,12,'pharmacy 24 hours',5,24,'2026-11-17 18:20:00'),
  (10,13,'spa downtown',6,21,'2026-11-17 15:40:00'),
  (11,14,'danubyu mohinga',1,22,'2026-11-18 07:10:00'),
  (12,15,'pawsan rice bag',4,26,'2026-11-17 16:15:00');
/*!40000 ALTER TABLE `search_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure and data for table `audit_log`
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

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
INSERT INTO `audit_log` (`id`, `admin_id`, `action`, `target_type`, `target_id`, `created_at`) VALUES
  (1,18,'approve_place','place',25,'2026-11-07 11:55:00'),
  (2,18,'approve_upgrade','owner_upgrades',6,'2026-11-07 12:00:00'),
  (3,18,'approve_place','place',26,'2026-11-07 12:10:00'),
  (4,18,'approve_upgrade','owner_upgrades',1,'2026-11-15 10:00:00'),
  (5,18,'approve_upgrade','owner_upgrades',2,'2026-11-15 10:00:00'),
  (6,18,'approve_upgrade','owner_upgrades',8,'2026-11-10 11:00:00'),
  (7,18,'resolve_report','reports',2,'2026-11-15 14:00:00'),
  (8,18,'update_place','place',1,'2026-11-16 10:00:00'),
  (9,18,'approve_upgrade','owner_upgrades',9,'2026-11-12 11:00:00'),
  (10,18,'approve_upgrade','owner_upgrades',10,'2026-11-13 12:00:00'),
  (11,18,'ban_user','users',25,'2026-11-14 09:30:00'),
  (12,18,'reject_upgrade','owner_upgrades',14,'2026-11-15 14:00:00'),
  (13,18,'ban_user','users',26,'2026-11-15 14:05:00'),
  (14,18,'add_public_place','place',29,'2026-11-16 11:00:00'),
  (15,18,'add_public_place','place',30,'2026-11-16 11:30:00'),
  (16,18,'add_public_place','place',31,'2026-11-16 12:00:00'),
  (17,18,'update_category','categories',1,'2026-11-17 09:00:00'),
  (18,18,'update_category','categories',4,'2026-11-17 09:15:00'),
  (19,18,'dismiss_report','reports',4,'2026-11-17 15:30:00'),
  (20,18,'resolve_report','reports',7,'2026-11-18 10:00:00');
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-18 10:30:00
