/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: active_panels
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `active_panels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `phase` varchar(50) DEFAULT NULL,
  `channel_id` varchar(255) DEFAULT NULL,
  `message_id` varchar(255) DEFAULT NULL,
  `deadline` datetime DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `reminded` tinyint DEFAULT NULL,
  `closed` tinyint DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `stage` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_phase_stage_channel` (`phase`, `stage`, `channel_id`)
) ENGINE = InnoDB AUTO_INCREMENT = 386 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: admin_logs
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `admin_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `displayname` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phase` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stage` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: admin_users
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `discord_id` varchar(50) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `discord_id` (`discord_id`)
) ENGINE = InnoDB AUTO_INCREMENT = 2 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: doubleelim_predictions
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `doubleelim_predictions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(255) DEFAULT NULL,
  `upper_final_a` text,
  `lower_final_a` text,
  `upper_final_b` text,
  `lower_final_b` text,
  `user_id` varchar(30) DEFAULT NULL,
  `active` tinyint DEFAULT '0',
  `displayname` varchar(255) DEFAULT NULL,
  `submitted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user` (`user_id`),
  UNIQUE KEY `unique_user_id` (`user_id`),
  UNIQUE KEY `user_id` (`user_id`)
) ENGINE = InnoDB AUTO_INCREMENT = 106 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: doubleelim_results
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `doubleelim_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `upper_final_a` text,
  `lower_final_a` text,
  `upper_final_b` text,
  `lower_final_b` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 4 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: doubleelim_scores
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `doubleelim_scores` (
  `username` varchar(255) DEFAULT NULL,
  `points` int DEFAULT NULL,
  `user_id` varchar(32) DEFAULT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  `displayname` varchar(255) DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user` (`user_id`)
) ENGINE = InnoDB AUTO_INCREMENT = 7752 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: playin_predictions
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `playin_predictions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(255) DEFAULT NULL,
  `teams` text,
  `submitted_at` datetime DEFAULT NULL,
  `user_id` varchar(30) DEFAULT NULL,
  `active` tinyint DEFAULT '0',
  `displayname` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`)
) ENGINE = InnoDB AUTO_INCREMENT = 138 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: playin_results
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `playin_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `correct_teams` text,
  `active` tinyint DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 9 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: playin_scores
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `playin_scores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(255) DEFAULT NULL,
  `points` int DEFAULT NULL,
  `user_id` varchar(32) DEFAULT NULL,
  `displayname` varchar(255) DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_id` (`user_id`),
  UNIQUE KEY `uniq_user` (`user_id`)
) ENGINE = InnoDB AUTO_INCREMENT = 13763 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: playoffs_predictions
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `playoffs_predictions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `semifinalists` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `finalists` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `winner` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `third_place_winner` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `active` tinyint DEFAULT '0',
  `displayname` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `submitted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  UNIQUE KEY `user_id_2` (`user_id`)
) ENGINE = InnoDB AUTO_INCREMENT = 409 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: playoffs_results
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `playoffs_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `correct_semifinalists` text,
  `correct_finalists` text,
  `correct_winner` varchar(255) DEFAULT NULL,
  `correct_third_place_winner` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `active` tinyint DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 21 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: playoffs_scores
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `playoffs_scores` (
  `username` varchar(255) DEFAULT NULL,
  `points` int DEFAULT NULL,
  `score` int DEFAULT NULL,
  `user_id` varchar(32) DEFAULT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  `displayname` varchar(255) DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user` (`user_id`)
) ENGINE = InnoDB AUTO_INCREMENT = 1775 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: swiss_predictions
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `swiss_predictions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(255) DEFAULT NULL,
  `user_id` varchar(50) DEFAULT NULL,
  `pick_3_0` varchar(255) DEFAULT NULL,
  `pick_0_3` varchar(255) DEFAULT NULL,
  `advancing` text,
  `active` tinyint DEFAULT '0',
  `submitted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `stage` varchar(50) DEFAULT NULL,
  `displayname` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_stage_unique` (`user_id`, `stage`),
  UNIQUE KEY `unique_user_stage` (`user_id`, `stage`),
  UNIQUE KEY `user_id` (`user_id`, `stage`),
  UNIQUE KEY `uniq_user_stage` (`user_id`, `stage`)
) ENGINE = InnoDB AUTO_INCREMENT = 1019 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: swiss_results
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `swiss_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `correct_3_0` varchar(255) DEFAULT NULL,
  `correct_0_3` varchar(255) DEFAULT NULL,
  `correct_advancing` text,
  `created_at` timestamp NULL DEFAULT NULL,
  `stage` enum('stage1', 'stage2', 'stage3') DEFAULT NULL,
  `active` tinyint DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_stage` (`stage`)
) ENGINE = InnoDB AUTO_INCREMENT = 38 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: swiss_scores
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `swiss_scores` (
  `username` varchar(255) DEFAULT NULL,
  `points` int DEFAULT NULL,
  `user_id` varchar(32) DEFAULT NULL,
  `swiss_number` int DEFAULT NULL,
  `stage` enum('stage1', 'stage2', 'stage3') DEFAULT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  `displayname` varchar(100) DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_stage` (`user_id`, `stage`),
  UNIQUE KEY `user_stage_unique` (`user_id`, `stage`),
  UNIQUE KEY `unique_user_stage` (`user_id`, `stage`),
  UNIQUE KEY `user_id` (`user_id`, `stage`)
) ENGINE = InnoDB AUTO_INCREMENT = 18612 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: tournament_settings
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `tournament_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tournament_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hltv_event_id` int DEFAULT NULL,
  `hltv_urls` json DEFAULT NULL,
  `sync_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `sync_every_minutes` int NOT NULL DEFAULT '180',
  `last_synced_at` timestamp NULL DEFAULT NULL,
  `autolink_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `autolink_keywords` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_from` date DEFAULT NULL,
  `date_to` date DEFAULT NULL,
  `preferred_organizers` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `autolink_mode` enum('once', 'always') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'once',
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: active_panels
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: admin_logs
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: admin_users
# ------------------------------------------------------------

INSERT INTO
  `admin_users` (`id`, `discord_id`, `display_name`, `created_at`)
VALUES
  (
    1,
    '461851082570596352',
    'Ciepły',
    '2025-11-20 21:44:29'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: doubleelim_predictions
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: doubleelim_results
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: doubleelim_scores
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: playin_predictions
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: playin_results
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: playin_scores
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: playoffs_predictions
# ------------------------------------------------------------

INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    143,
    'cieplyhehe',
    'Furia, Spirit, Vitality, NAVI',
    'Furia, Spirit',
    'Furia',
    NULL,
    '461851082570596352',
    1,
    'Ciepły',
    '2025-12-07 22:11:27'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    144,
    'michazwon',
    'Falcons, Furia, Vitality, FaZe Clan',
    'Falcons, FaZe Clan',
    'FaZe Clan',
    NULL,
    '983748525798084628',
    1,
    '.michazwon',
    '2025-12-07 22:11:49'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    145,
    'janosik7.',
    'FaZe Clan, Falcons, Vitality, Furia',
    'Falcons, Furia',
    'Furia',
    'Vitality',
    '1296180581305942016',
    1,
    'z3fir',
    '2025-12-07 22:12:08'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    146,
    'anteg02',
    'Furia, Falcons, Vitality, FaZe Clan',
    'Furia, FaZe Clan',
    'FaZe Clan',
    'Falcons',
    '1310326288011231294',
    1,
    'Antek',
    '2025-12-07 22:12:11'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    147,
    'bili13',
    'Spirit, Vitality, FaZe Clan, NAVI',
    'Spirit, FaZe Clan',
    'FaZe Clan',
    NULL,
    '517441265575526400',
    1,
    'bili13',
    '2025-12-07 22:12:12'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    148,
    'mrmarty.pl_87228',
    'Spirit, Vitality, FaZe Clan, Furia',
    'Vitality, Furia',
    'Furia',
    NULL,
    '1145386101264109669',
    1,
    'Mr Marty',
    '2025-12-07 22:12:24'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    149,
    '.pikom',
    'Falcons, Vitality, Furia, FaZe Clan',
    'Furia, Falcons',
    'Furia',
    NULL,
    '710794795529928785',
    1,
    'PIKOM',
    '2025-12-07 22:12:34'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    150,
    'bartmacieja',
    'Furia, MOUZ, Vitality, Spirit',
    'Furia, MOUZ',
    'Furia',
    'Spirit',
    '808309868586467348',
    1,
    'bartmacieja',
    '2025-12-07 22:12:35'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    151,
    'sqiel',
    'Furia, FaZe Clan, Vitality, Falcons',
    'Vitality, Furia',
    'Furia',
    'Falcons',
    '420597124724555777',
    1,
    'sqiel',
    '2025-12-07 22:12:57'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    152,
    'emzet14',
    'Furia, Spirit, Vitality, MOUZ',
    'Furia, Vitality',
    'Furia',
    NULL,
    '451738220519096320',
    1,
    '.emzet',
    '2025-12-07 22:13:09'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    153,
    'crash5882',
    'Furia, Falcons, Vitality, FaZe Clan',
    'Furia, Falcons',
    'Furia',
    NULL,
    '1278670384358621225',
    1,
    'XeytoX',
    '2025-12-07 22:14:16'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    154,
    'audi_s6_fiexv',
    'Furia, Spirit, Vitality, MOUZ',
    'Spirit, MOUZ',
    'Spirit',
    NULL,
    '748264642509275196',
    1,
    '?? ⁷⁷⁷',
    '2025-12-07 22:14:42'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    155,
    'jacaplaca2115',
    'Furia, Vitality, MOUZ, Falcons',
    'Furia, Vitality',
    'Furia',
    NULL,
    '692431475139805305',
    1,
    'jxcxk',
    '2025-12-07 22:16:23'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    156,
    'kubaster222',
    'Spirit, FaZe Clan, The Mongolz, NAVI',
    'MOUZ, Vitality',
    'Furia',
    'Vitality',
    '1271521295674376204',
    1,
    'Simply_Kubus',
    '2025-12-07 22:16:38'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    157,
    'l1su_',
    'Furia, NAVI, Vitality, Falcons',
    'Falcons, NAVI',
    'NAVI',
    'Vitality',
    '553265023754043403',
    1,
    'lisu',
    '2025-12-07 22:16:45'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    158,
    'f0sti_',
    'Furia, Vitality, FaZe Clan, Falcons',
    'Vitality, Furia',
    'Furia',
    'FaZe Clan',
    '1097066576294977547',
    1,
    'F0STiii',
    '2025-12-07 22:19:25'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    159,
    'thearcadian95',
    'Furia, Spirit, MOUZ, Vitality',
    'Vitality, Furia',
    'Furia',
    'Spirit',
    '278065188169842688',
    1,
    'ArcadianPrime',
    '2025-12-07 22:19:28'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    160,
    'ales1433',
    'Furia, MOUZ, Vitality, Spirit',
    'Spirit, Furia',
    'Furia',
    NULL,
    '479245851722645535',
    1,
    'Ales',
    '2025-12-07 22:20:49'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    161,
    'piter8713',
    'Furia, Spirit, MOUZ, FaZe Clan',
    'FaZe Clan, Spirit',
    'FaZe Clan',
    NULL,
    '434439412256997377',
    1,
    'orzeł zps',
    '2025-12-07 22:21:08'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    162,
    'xkuba6969',
    'Furia, Spirit, Vitality, MOUZ',
    'Furia, Vitality',
    'Furia',
    NULL,
    '486957798207258635',
    1,
    'Kuba',
    '2025-12-07 22:21:33'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    163,
    'olo5137',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Spirit, Furia',
    'Furia',
    'FaZe Clan',
    '932271244345233439',
    1,
    'srajkez',
    '2025-12-07 22:21:55'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    164,
    'kot_wojownik',
    'Furia, Vitality, MOUZ, Falcons',
    'Furia, Falcons',
    'Furia',
    NULL,
    '927133165670260746',
    1,
    'OstropA',
    '2025-12-07 22:23:05'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    167,
    'gloogloo_',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Spirit',
    'Furia',
    NULL,
    '1000080089888862278',
    1,
    'fieliep',
    '2025-12-07 22:24:28'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    168,
    'tomson123456789.',
    'Furia, Vitality, FaZe Clan, Falcons',
    'Furia, Vitality',
    'Furia',
    NULL,
    '1356907806883713064',
    1,
    'Tomson',
    '2025-12-07 22:28:46'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    169,
    'mis1or',
    'Furia, Spirit, Vitality, MOUZ',
    'Furia, Spirit',
    'Spirit',
    NULL,
    '926626252985618432',
    1,
    'dombi',
    '2025-12-07 22:29:37'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    170,
    '_graba_',
    'Falcons, FaZe Clan, Furia, Vitality',
    'Vitality, FaZe Clan',
    'FaZe Clan',
    NULL,
    '376797769492594689',
    1,
    'Graba',
    '2025-12-07 22:29:50'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    171,
    'milly_yy',
    'FaZe Clan, Falcons, Vitality, Furia',
    'Furia, FaZe Clan',
    'FaZe Clan',
    'Vitality',
    '471399701976055818',
    1,
    'Milyy',
    '2025-12-07 22:31:53'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    172,
    '.metyl.',
    'Furia, Falcons, Vitality, MOUZ',
    'Vitality, Furia',
    'Furia',
    NULL,
    '801164867457253406',
    1,
    '☢?????☢',
    '2025-12-07 22:33:54'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    173,
    'm4sterek_',
    'Vitality, FaZe Clan, NAVI, Spirit',
    'Furia, Falcons',
    'Falcons',
    NULL,
    '1117505334869758144',
    1,
    'Maasterek',
    '2025-12-07 22:35:22'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    174,
    'pbialy123',
    'Furia, MOUZ, Vitality, Spirit',
    'Vitality, Furia',
    'Furia',
    NULL,
    '320224049760567296',
    1,
    'pbialy123',
    '2025-12-07 22:36:40'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    175,
    'questrianek',
    'Spirit, Furia, Vitality, MOUZ',
    'Furia, Spirit',
    'Furia',
    NULL,
    '759697317263310889',
    1,
    'questrian',
    '2025-12-07 22:38:10'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    176,
    'gecko8458',
    'Spirit, Furia, MOUZ, Vitality',
    'Spirit, Furia',
    'Furia',
    'Spirit',
    '566627818255941632',
    1,
    'gecko',
    '2025-12-07 22:39:04'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    177,
    'mista0swaggg',
    'Spirit, Furia, MOUZ, Vitality',
    'Spirit, Furia',
    'Furia',
    'Vitality',
    '231814174030823424',
    1,
    'Mista0swaggg',
    '2025-12-07 22:39:54'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    178,
    'botgat',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Spirit',
    'Furia',
    NULL,
    '415864755845070850',
    1,
    'BOTGAT',
    '2025-12-07 22:42:25'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    179,
    'zenekdb9',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Vitality',
    'Furia',
    NULL,
    '312633551466135553',
    1,
    'ZenSoul',
    '2025-12-07 22:44:51'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    181,
    '.turoczek',
    'Spirit, Vitality, Furia, FaZe Clan',
    'FaZe Clan, Vitality',
    'FaZe Clan',
    'Furia',
    '629686561562165249',
    1,
    'Turoczek',
    '2025-12-07 22:46:30'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    182,
    'baran_clip_you',
    'Furia, Spirit, Vitality, FaZe Clan',
    'FaZe Clan, Spirit',
    'FaZe Clan',
    NULL,
    '751675646979080212',
    1,
    'baran_clip_you',
    '2025-12-07 22:52:13'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    183,
    'nfixme',
    'Furia, Vitality, MOUZ, Falcons',
    'Furia, Vitality',
    'Vitality',
    'MOUZ',
    '788345818343669760',
    1,
    'youka ༉‧₊˚✧',
    '2025-12-07 22:56:32'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    185,
    'ejwejqe.',
    'Furia, The Mongolz, FaZe Clan, Spirit',
    'FaZe Clan, The Mongolz',
    'FaZe Clan',
    NULL,
    '1428965429635977299',
    1,
    'ejwejqe',
    '2025-12-07 22:59:19'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    186,
    '_zipi',
    'Falcons, Vitality, FaZe Clan, Furia',
    'Furia, Vitality',
    'Vitality',
    NULL,
    '319901756064792588',
    1,
    'ZIPI',
    '2025-12-07 23:03:19'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    187,
    't1mero',
    'Furia, Spirit, Vitality, MOUZ',
    'Furia, Vitality',
    'Furia',
    NULL,
    '340076455868235777',
    1,
    'T1mero',
    '2025-12-07 23:24:34'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    188,
    'borow1k',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Spirit',
    'Furia',
    NULL,
    '300273286489702402',
    1,
    'Borowik',
    '2025-12-07 23:31:22'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    189,
    'geeciu_es',
    'Furia, Vitality, MOUZ, Falcons',
    'Furia, Falcons',
    'Furia',
    'Vitality',
    '823526692189634580',
    1,
    'geeciu',
    '2025-12-07 23:50:53'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    190,
    'cnoccs',
    'Falcons, FaZe Clan, NAVI, Vitality',
    'Vitality, Furia',
    'Furia',
    'MOUZ',
    '1250835724169777277',
    1,
    'everyone',
    '2025-12-07 23:56:17'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    191,
    'gitsoneqq',
    'Furia, Vitality, Falcons, MOUZ',
    'Furia, Vitality',
    'Furia',
    'MOUZ',
    '1025367753588228128',
    1,
    'gitsoneqq',
    '2025-12-08 00:05:35'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    192,
    'xczaro0',
    'Falcons, Furia, MOUZ, Vitality',
    'Falcons, Furia',
    'Vitality',
    NULL,
    '723447196388819014',
    1,
    'XcZaRo',
    '2025-12-08 00:16:21'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    193,
    '4fire2alpaca0',
    'Furia, Vitality, FaZe Clan, Falcons',
    'Furia, Falcons',
    'Furia',
    NULL,
    '581860728240340992',
    1,
    'DAMN1ggy_',
    '2025-12-08 00:39:03'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    194,
    'sadz1k',
    'Spirit, Furia, MOUZ, The Mongolz',
    'Spirit, Furia',
    'Furia',
    NULL,
    '305737641763274752',
    1,
    'sadz1k',
    '2025-12-08 02:11:32'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    195,
    'undeadkarambol',
    'Spirit, Vitality, FaZe Clan, NAVI',
    'Spirit, FaZe Clan',
    'Spirit',
    NULL,
    '1225901047982329876',
    1,
    'Karambolowy zawrót głowy',
    '2025-12-08 02:51:30'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    196,
    'consaramgateun',
    'Furia, Vitality, FaZe Clan, Falcons',
    'Falcons, Furia',
    'Furia',
    NULL,
    '727134099231211571',
    1,
    '촌사람 같은',
    '2025-12-08 04:42:59'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    197,
    'plkp.1337',
    'Furia, Vitality, Falcons, FaZe Clan',
    'Falcons, FaZe Clan',
    'FaZe Clan',
    'Spirit',
    '862041274973552651',
    1,
    'BqMaJsTeR',
    '2025-12-08 04:57:57'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    198,
    'deter_alt',
    'Falcons, Vitality, FaZe Clan, Furia',
    'Falcons, Furia',
    'Falcons',
    'FaZe Clan',
    '1023203535971684425',
    1,
    'Deter',
    '2025-12-08 05:23:45'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    200,
    'mefistoo_00',
    'Spirit, Furia, Vitality, NAVI',
    'Furia, Spirit',
    'Furia',
    NULL,
    '303361405677993984',
    1,
    'Mefistofeles Z Efezu',
    '2025-12-08 05:33:09'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    201,
    '.j4k0b_',
    'Furia, Vitality, Falcons, FaZe Clan',
    'Furia, Falcons',
    'Furia',
    'FaZe Clan',
    '340841216507904001',
    1,
    'CwelulozaOwner',
    '2025-12-08 06:04:44'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    202,
    'bartus0858',
    'Furia, Vitality, MOUZ, Falcons',
    'Furia, Falcons',
    'Furia',
    NULL,
    '1275527297893531772',
    1,
    'Bartuss',
    '2025-12-08 06:13:21'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    203,
    'subweydear',
    'Falcons, The Mongolz, NAVI, MOUZ',
    'Spirit, Furia',
    'FaZe Clan',
    NULL,
    '789922633012609044',
    1,
    'Subwey',
    '2025-12-08 06:42:14'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    204,
    'kiwi___67',
    'Furia, Vitality, Falcons, MOUZ',
    'Furia, MOUZ',
    'Furia',
    NULL,
    '879476380562235392',
    1,
    'Kiwi',
    '2025-12-08 06:46:35'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    205,
    'balacl4vaa',
    'Furia, Falcons, FaZe Clan, Vitality',
    'Furia, FaZe Clan',
    'FaZe Clan',
    NULL,
    '1388519493361471569',
    1,
    'Balacl4va',
    '2025-12-08 07:07:52'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    206,
    '_prosik_5678_',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Vitality',
    'Furia',
    NULL,
    '779402540755976192',
    1,
    '_prosik_5678_',
    '2025-12-08 07:37:26'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    207,
    'muckar1999',
    'Vitality, Spirit, MOUZ, NAVI',
    'NAVI, Vitality',
    'Vitality',
    'Spirit',
    '688759630448689183',
    1,
    'Karolem',
    '2025-12-08 07:51:47'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    208,
    'tomciomurarz',
    'Falcons, Vitality, MOUZ, Furia',
    'Furia, Falcons',
    'Falcons',
    NULL,
    '506914119710932993',
    1,
    'fre3sh',
    '2025-12-08 08:27:54'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    209,
    'gajtan_bb',
    'Furia, Spirit, Vitality, MOUZ',
    'Furia, Vitality',
    'Furia',
    NULL,
    '668913702510002179',
    1,
    'Gajtan',
    '2025-12-08 08:39:46'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    210,
    'luxor_.',
    'Falcons, Vitality, Furia, MOUZ',
    'Falcons, Furia',
    'Falcons',
    NULL,
    '322812891956903937',
    1,
    'Luxor',
    '2025-12-08 08:44:43'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    211,
    'rogyoa',
    'Furia, Spirit, Vitality, Falcons',
    'Furia, Spirit',
    'Furia',
    NULL,
    '486499834384220170',
    1,
    'Rogyoa',
    '2025-12-08 08:50:42'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    212,
    'qbinho',
    'Furia, Spirit, Vitality, MOUZ',
    'Furia, Vitality',
    'Furia',
    NULL,
    '1034910520165285898',
    1,
    'Qbinho',
    '2025-12-08 08:56:13'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    213,
    'iggssk',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Spirit, FaZe Clan',
    'FaZe Clan',
    NULL,
    '463234527850921985',
    1,
    'Igssk',
    '2025-12-08 09:03:43'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    214,
    'd1oxie',
    'Furia, Spirit, MOUZ, Vitality',
    'Spirit, Furia',
    'Furia',
    'Vitality',
    '453811822320025603',
    1,
    'D1oxie',
    '2025-12-08 09:15:29'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    215,
    'strachowski2204',
    'Furia, Spirit, MOUZ, The Mongolz',
    'Furia, Spirit',
    'Furia',
    'The Mongolz',
    '410931873322369034',
    1,
    'Strachowski2204',
    '2025-12-08 10:00:02'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    216,
    'mochimoczi',
    'Furia, Spirit, Vitality, MOUZ',
    'Furia, Spirit',
    'Furia',
    NULL,
    '678610287640969233',
    1,
    '?????',
    '2025-12-08 10:09:43'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    217,
    'adleko29',
    'FaZe Clan, Spirit, Furia, Vitality',
    'Furia, Vitality',
    'Furia',
    NULL,
    '737688687227306075',
    1,
    'adleko',
    '2025-12-08 10:11:44'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    218,
    'pigo2450',
    'Vitality, Furia, Spirit, MOUZ',
    'Vitality, Furia',
    'Vitality',
    NULL,
    '919347146405339138',
    1,
    'POPROSTUFABIAN',
    '2025-12-08 10:50:43'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    219,
    'matux223',
    'Vitality, MOUZ, Spirit, NAVI',
    'Vitality, NAVI',
    'Vitality',
    NULL,
    '657270787711041546',
    1,
    'Assassin',
    '2025-12-08 11:05:50'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    221,
    'majkutini',
    'Vitality, NAVI, FaZe Clan, Falcons',
    'Falcons, FaZe Clan',
    'Falcons',
    NULL,
    '1219387685425254441',
    1,
    '! Мajkutini',
    '2025-12-08 12:19:14'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    222,
    'za.xx.xx',
    'Furia, Vitality, FaZe Clan, Falcons',
    'Furia, Falcons',
    'Falcons',
    NULL,
    '811601970506629150',
    1,
    'KebabikRHC',
    '2025-12-08 12:33:21'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    223,
    'ramirezkks',
    'Furia, Vitality, FaZe Clan, Falcons',
    'Furia, Falcons',
    'Furia',
    NULL,
    '406902151529627649',
    1,
    'RamirezKKS',
    '2025-12-08 13:10:59'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    224,
    'grubycoach',
    'Furia, Spirit, Vitality, MOUZ',
    'Furia, Spirit',
    'Furia',
    'Spirit',
    '435779589864816640',
    1,
    'Grubycoach',
    '2025-12-08 14:04:25'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    225,
    'js_0_0_',
    'Furia, Vitality, FaZe Clan, Falcons',
    'FaZe Clan, Vitality',
    'FaZe Clan',
    'Falcons',
    '874671251459833876',
    1,
    '--js',
    '2025-12-08 14:07:43'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    226,
    'cziki4406',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Vitality',
    'Furia',
    NULL,
    '361572745147842563',
    1,
    'CziKi',
    '2025-12-08 14:09:38'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    227,
    'jc0bs',
    'Spirit, The Mongolz, FaZe Clan, NAVI',
    'MOUZ, Falcons',
    'Furia',
    'Falcons',
    '1099627480911978526',
    1,
    'jc0bs',
    '2025-12-08 14:18:02'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    229,
    'bombix777',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Spirit',
    'Furia',
    NULL,
    '1145443406638751815',
    1,
    'bombix',
    '2025-12-08 14:34:52'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    230,
    '_ksys_',
    'FaZe Clan, Falcons, Furia, Vitality',
    'Furia, Falcons',
    'Furia',
    'Vitality',
    '284275389348446209',
    1,
    'Kszyś',
    '2025-12-08 14:44:11'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    231,
    'itslockz',
    'Furia, Vitality, FaZe Clan, Falcons',
    'Falcons, FaZe Clan',
    'Falcons',
    NULL,
    '773526091628412930',
    1,
    'itsLoCKz',
    '2025-12-08 15:14:07'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    232,
    'dekus7692',
    'Furia, Spirit, Vitality, MOUZ',
    'MOUZ, Vitality',
    'MOUZ',
    NULL,
    '472474920270561281',
    1,
    'Dekus',
    '2025-12-08 15:23:00'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    233,
    'spinkaa',
    'Vitality, FaZe Clan, Falcons, Furia',
    'Falcons, Furia',
    'Furia',
    NULL,
    '983477936810238052',
    1,
    '!Spinka',
    '2025-12-08 15:28:18'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    234,
    'xniko1',
    'Furia, Spirit, MOUZ, Vitality',
    'Furia, Spirit',
    'Furia',
    NULL,
    '529027111504314399',
    1,
    'xNiko',
    '2025-12-08 15:31:02'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    235,
    'panciovsky',
    'Furia, Spirit, Vitality, MOUZ',
    'Furia, Vitality',
    'Furia',
    NULL,
    '352823893003730945',
    1,
    'Pancio ツ',
    '2025-12-08 15:31:12'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    236,
    '_kml777',
    'FaZe Clan, The Mongolz, Spirit, NAVI',
    'FaZe Clan, The Mongolz',
    'FaZe Clan',
    NULL,
    '896147575093198958',
    1,
    'KmL',
    '2025-12-08 16:36:03'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    237,
    'bolotv',
    'Spirit, Vitality, Furia, MOUZ',
    'Spirit, Furia',
    'Spirit',
    NULL,
    '693547426212216892',
    1,
    'BoloTv',
    '2025-12-08 16:45:26'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    238,
    'kubi1133',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Spirit, Furia',
    'Spirit',
    NULL,
    '519586946176253952',
    1,
    'ҜuBi',
    '2025-12-08 17:02:50'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    239,
    'patryk27_',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Vitality, Furia',
    'Furia',
    NULL,
    '1077219449502965790',
    1,
    'JakoN-',
    '2025-12-08 17:16:03'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    240,
    'laki5068',
    'Spirit, Furia, Vitality, FaZe Clan',
    'Furia, Vitality',
    'Furia',
    NULL,
    '809885132101779456',
    1,
    'Laki',
    '2025-12-08 17:28:10'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    241,
    'lebszot',
    'Furia, Vitality, Spirit, MOUZ',
    'Spirit, MOUZ',
    'MOUZ',
    NULL,
    '359370791076364290',
    1,
    'ŁeB SzOt',
    '2025-12-08 17:33:17'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    242,
    'xseti_',
    'Furia, Spirit, Vitality, MOUZ',
    'Furia, Vitality',
    'Furia',
    NULL,
    '1078726241680633857',
    1,
    'xSetiツ_',
    '2025-12-08 18:18:33'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    243,
    'grubcio2851',
    'Furia, Vitality, MOUZ, Spirit',
    'Furia, Spirit',
    'Spirit',
    'MOUZ',
    '510573405569941515',
    1,
    'Grubcio',
    '2025-12-08 18:25:59'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    245,
    'tamski07',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Spirit, FaZe Clan',
    'FaZe Clan',
    NULL,
    '486577410037514250',
    1,
    'Tamski',
    '2025-12-08 18:52:37'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    246,
    'rysiek213',
    'MOUZ, Vitality, Spirit, Furia',
    'Furia, Vitality',
    'Furia',
    'Spirit',
    '931168369573503006',
    1,
    'Rysiu',
    '2025-12-08 19:31:04'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    247,
    'mcm_sniper71',
    'Furia, MOUZ, Vitality, Falcons',
    'Vitality, Furia',
    'Furia',
    NULL,
    '784508141580189766',
    1,
    'mcm_sniper71',
    '2025-12-08 19:35:12'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    248,
    'emeryt.muchson',
    'Furia, Spirit, Vitality, MOUZ',
    'Vitality, Furia',
    'Vitality',
    NULL,
    '471463411239092225',
    1,
    '-muchson-',
    '2025-12-08 20:00:09'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    249,
    'monczall',
    'Furia, Vitality, Falcons, MOUZ',
    'Falcons, Furia',
    'Falcons',
    'Vitality',
    '419278999991353374',
    1,
    'Monczall',
    '2025-12-08 20:39:48'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    250,
    'peper232',
    'Furia, Vitality, Falcons, FaZe Clan',
    'Furia, Falcons',
    'Furia',
    'Vitality',
    '1182053587774341170',
    1,
    'Pleple',
    '2025-12-08 20:58:51'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    251,
    'mobbyn_mlodyg',
    'Falcons, FaZe Clan, Furia, Vitality',
    'Furia, Falcons',
    'Furia',
    'FaZe Clan',
    '1204544158828597325',
    1,
    'arsiif',
    '2025-12-08 21:12:26'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    252,
    'ciapatyy',
    'FaZe Clan, Falcons, Vitality, Spirit',
    'Furia, Spirit',
    'Spirit',
    NULL,
    '1126999169966538874',
    1,
    'Ciapatyy',
    '2025-12-08 21:28:47'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    253,
    'kayesssss',
    'Furia, Vitality, FaZe Clan, Spirit',
    'Spirit, FaZe Clan',
    'FaZe Clan',
    NULL,
    '525034117105188865',
    1,
    'KayEss',
    '2025-12-08 22:38:15'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    254,
    'kacpereq__',
    'FaZe Clan, Spirit, Vitality, Furia',
    'Spirit, Furia',
    'Furia',
    NULL,
    '462870389316386817',
    1,
    'kacpereq__',
    '2025-12-08 22:40:30'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    255,
    'crestofek',
    'Vitality, Falcons, FaZe Clan, Furia',
    'Vitality, Falcons',
    'Vitality',
    'FaZe Clan',
    '1439298047946522686',
    1,
    'crestofek',
    '2025-12-08 23:11:29'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    256,
    'deyanek',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Vitality',
    'Furia',
    NULL,
    '350604331621548032',
    1,
    'Deyanek',
    '2025-12-08 23:32:32'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    258,
    'gemainda',
    'Spirit, Vitality, FaZe Clan, NAVI',
    'Vitality, FaZe Clan',
    'Spirit',
    NULL,
    '964187009520377856',
    1,
    'Gemainda',
    '2025-12-09 07:40:00'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    260,
    '_kubakoz',
    'Furia, FaZe Clan, The Mongolz, Falcons',
    'Furia, Falcons',
    'Furia',
    NULL,
    '1124240992380395550',
    1,
    'kuba koz',
    '2025-12-09 09:57:01'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    261,
    'kper_',
    'Furia, Vitality, MOUZ, Falcons',
    'Furia, Vitality',
    'Furia',
    NULL,
    '463001727310757888',
    1,
    'Kper',
    '2025-12-09 10:00:18'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    262,
    'monte_snack',
    'Furia, Spirit, Vitality, Falcons',
    'Falcons, Furia',
    'Furia',
    NULL,
    '723493354918379533',
    1,
    'Monte',
    '2025-12-09 10:01:07'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    264,
    'kubicarobcio',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Spirit',
    'Furia',
    NULL,
    '475741078675259392',
    1,
    'Robercik_Pepperoni',
    '2025-12-09 10:59:14'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    265,
    'haciolem',
    'Furia, FaZe Clan, The Mongolz, Spirit',
    'Furia, The Mongolz',
    'Furia',
    NULL,
    '351475146604675072',
    1,
    'haciolem',
    '2025-12-09 11:22:47'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    266,
    'lukasz_03',
    'Vitality, FaZe Clan, Furia, Falcons',
    'Falcons, FaZe Clan',
    'Falcons',
    NULL,
    '561623798596632588',
    1,
    'Lukasz_03',
    '2025-12-09 12:02:46'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    268,
    'xqbik',
    'Spirit, Vitality, FaZe Clan, Furia',
    'Furia, Vitality',
    'Furia',
    'Spirit',
    '532912683666898944',
    1,
    'xQBIK.wav',
    '2025-12-09 12:12:39'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    269,
    'nooscar6',
    'Spirit, Vitality, FaZe Clan, Furia',
    'Vitality, Furia',
    'Vitality',
    NULL,
    '451016732551675905',
    1,
    'nscr',
    '2025-12-09 12:15:54'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    271,
    'terapeutaaa',
    'Furia, Vitality, FaZe Clan, Falcons',
    'Furia, Vitality',
    'Furia',
    NULL,
    '864932529789206629',
    1,
    'Terapeutaaa',
    '2025-12-09 12:26:20'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    272,
    'foss.enjoyer',
    'Falcons, Vitality, Furia, MOUZ',
    'Furia, Falcons',
    'Falcons',
    NULL,
    '1246440698517913775',
    1,
    'Nixy',
    '2025-12-09 13:40:59'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    273,
    'buldogun_94238',
    'Furia, Vitality, Falcons, FaZe Clan',
    'Furia, Vitality',
    'Furia',
    NULL,
    '1284075325042724900',
    1,
    'Buldogun',
    '2025-12-09 13:55:46'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    274,
    'kqcus.',
    'Furia, FaZe Clan, Falcons, Vitality',
    'Falcons, FaZe Clan',
    'Falcons',
    NULL,
    '1236280013343424512',
    1,
    'kqcus.',
    '2025-12-09 14:37:30'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    275,
    'turb0s',
    'Furia, Vitality, Falcons, FaZe Clan',
    'Furia, Vitality',
    'Furia',
    NULL,
    '312232069289869322',
    1,
    'Turb0s',
    '2025-12-09 14:51:52'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    276,
    'sebaziomek',
    'Falcons, FaZe Clan, Vitality, Furia',
    'Falcons, FaZe Clan',
    'FaZe Clan',
    NULL,
    '555800660357021696',
    1,
    'Тотя ❤',
    '2025-12-09 15:21:07'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    277,
    'gekoniasty',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Vitality',
    'Furia',
    NULL,
    '318343577765806080',
    1,
    'Gekoniasty',
    '2025-12-09 15:51:49'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    278,
    'savi0x',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Vitality',
    'Furia',
    NULL,
    '627115371878416385',
    1,
    'Savi0X',
    '2025-12-09 16:01:14'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    279,
    'szymcr8',
    'Falcons, FaZe Clan, Furia, Vitality',
    'FaZe Clan, Vitality',
    'FaZe Clan',
    NULL,
    '649683931897135125',
    1,
    'szymcr8',
    '2025-12-09 16:05:52'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    280,
    '.egzekucja',
    'Vitality, Falcons, MOUZ, Furia',
    'Vitality, MOUZ',
    'Vitality',
    NULL,
    '451703866267009024',
    1,
    'Egzekucja',
    '2025-12-09 16:36:46'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    281,
    'maciek0357',
    'FaZe Clan, Furia, Falcons, Vitality',
    'Furia, Falcons',
    'Furia',
    'FaZe Clan',
    '691432428232900709',
    1,
    'macidk12',
    '2025-12-09 16:44:01'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    282,
    'xxkacperskyy',
    'Furia, Falcons, MOUZ, The Mongolz',
    'Falcons, Furia',
    'Falcons',
    NULL,
    '1183148710943797321',
    1,
    'XxKacperskyy',
    '2025-12-09 17:04:45'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    284,
    'skyshafiq',
    'Spirit, Vitality, FaZe Clan, Furia',
    'Furia, Spirit',
    'Furia',
    NULL,
    '882519104316137502',
    1,
    'Sky Shafiq',
    '2025-12-09 17:44:44'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    285,
    'kapi8797',
    'Vitality, Furia, Spirit, MOUZ',
    'Vitality, Furia',
    'Vitality',
    'Falcons',
    '872140778703556708',
    1,
    'Kapi',
    '2025-12-09 18:41:24'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    287,
    'sajmuraj',
    'Spirit, Vitality, NAVI, Furia',
    'Spirit, Furia',
    'Spirit',
    'NAVI',
    '519287591028391959',
    1,
    ',,Sajmuraj\'\'',
    '2025-12-09 18:55:44'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    289,
    'pumbarr',
    'Furia, Spirit, Vitality, MOUZ',
    'Furia, Spirit',
    'Furia',
    NULL,
    '733573014402236449',
    1,
    '?????',
    '2025-12-09 19:31:24'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    290,
    'lukasz9842',
    'Furia, Vitality, MOUZ, Falcons',
    'Furia, Vitality',
    'Vitality',
    NULL,
    '548248747977474048',
    1,
    'Łukasz',
    '2025-12-09 20:58:11'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    291,
    'thereaper1837',
    'Furia, Falcons, MOUZ, Vitality',
    'Furia, Falcons',
    'Furia',
    NULL,
    '672470404518117426',
    1,
    'TheReaper',
    '2025-12-09 21:01:27'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    292,
    'elchukapadra',
    'Furia, Spirit, FaZe Clan, Vitality',
    'Spirit, Furia',
    'Furia',
    'FaZe Clan',
    '868436437274599434',
    1,
    'Elczups',
    '2025-12-09 21:23:17'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    293,
    'shesaskurwol',
    'Falcons, Vitality, Furia, FaZe Clan',
    'Vitality, Furia',
    'Vitality',
    NULL,
    '905494286005583872',
    1,
    'shesaskurwol',
    '2025-12-09 21:32:21'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    294,
    'tusiactwo',
    'Furia, Spirit, FaZe Clan, Vitality',
    'Furia, Spirit',
    'Furia',
    NULL,
    '573574878918082560',
    1,
    'Tusiactwo',
    '2025-12-09 21:40:51'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    296,
    'thommyy5212',
    'Falcons, MOUZ, Furia, Vitality',
    'Falcons, Furia',
    'Furia',
    NULL,
    '535251994831618076',
    1,
    'Toomixx',
    '2025-12-09 22:06:01'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    297,
    '.marcineq',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Vitality',
    'Furia',
    NULL,
    '478486060943540225',
    1,
    'Marcineq',
    '2025-12-09 22:44:07'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    298,
    'mcgregor1_7',
    'Furia, Vitality, Spirit, FaZe Clan',
    'Furia, Spirit',
    'Furia',
    NULL,
    '594964029940957224',
    1,
    'McGregor17',
    '2025-12-09 22:46:13'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    299,
    'dorkej',
    'Furia, Vitality, MOUZ, Falcons',
    'Falcons, Furia',
    'Furia',
    NULL,
    '646804591853436946',
    1,
    'Dorkej',
    '2025-12-10 05:34:08'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    300,
    'b3nek',
    'Furia, Vitality, MOUZ, Falcons',
    'Furia, Vitality',
    'Furia',
    NULL,
    '131175559345602561',
    1,
    'B3neK',
    '2025-12-10 06:41:08'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    301,
    'banderas4200',
    'Furia, FaZe Clan, Spirit, The Mongolz',
    'FaZe Clan, Spirit',
    'FaZe Clan',
    NULL,
    '228173160355332097',
    1,
    'Banderas',
    '2025-12-10 08:23:59'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    302,
    'mamwolnewtorki',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Spirit',
    'Furia',
    'FaZe Clan',
    '402199933936992258',
    1,
    'Mam wolne wtorki',
    '2025-12-10 09:43:10'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    303,
    'kolo1237990',
    'Furia, FaZe Clan, Falcons, Vitality',
    'Furia, Falcons',
    'Furia',
    NULL,
    '690944257439301652',
    1,
    'Kowss50',
    '2025-12-10 11:00:01'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    305,
    'krowli1',
    'Spirit, Vitality, FaZe Clan, Furia',
    'Furia, Spirit',
    'Spirit',
    'Vitality',
    '655130175389958144',
    1,
    'Krowli',
    '2025-12-10 12:42:20'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    306,
    'kam8l',
    'Furia, Vitality, FaZe Clan, Falcons',
    'Falcons, FaZe Clan',
    'Falcons',
    NULL,
    '522446902147547157',
    1,
    'kam8l',
    '2025-12-10 12:50:35'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    307,
    'krisv2._68440',
    'Spirit, Vitality, Furia, MOUZ',
    'Furia, Vitality',
    'Vitality',
    NULL,
    '1153270538429542421',
    1,
    'gwd313g',
    '2025-12-10 13:03:43'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    308,
    'dr.macika',
    'Spirit, Vitality, Furia, MOUZ',
    'MOUZ, Spirit',
    'Spirit',
    NULL,
    '761587793893654549',
    1,
    'Dr.Macika',
    '2025-12-10 14:03:19'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    310,
    '.emten',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Spirit',
    'Furia',
    'FaZe Clan',
    '364402950057099266',
    1,
    'eMten',
    '2025-12-10 16:09:59'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    311,
    'smolobolo',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Vitality',
    'Furia',
    'Spirit',
    '419956536102617089',
    1,
    'ccccccccc',
    '2025-12-10 17:32:48'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    313,
    'gownowaucie_25462',
    'Furia, Spirit, MOUZ, The Mongolz',
    'Furia, Spirit',
    'Furia',
    NULL,
    '1270413622371422343',
    1,
    'happy',
    '2025-12-10 17:45:31'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    314,
    '._.iluminati._.',
    'Furia, Spirit, The Mongolz, FaZe Clan',
    'Spirit, FaZe Clan',
    'FaZe Clan',
    'Furia',
    '630820180901101600',
    1,
    'iluminati',
    '2025-12-10 18:19:47'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    315,
    'zzero2000',
    'Furia, Vitality, MOUZ, Falcons',
    'Furia, Vitality',
    'Furia',
    'Falcons',
    '462244738096037899',
    1,
    'Zzero',
    '2025-12-10 18:34:48'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    316,
    'yuuki_3333',
    'FaZe Clan, Furia, Spirit, The Mongolz',
    'Furia, The Mongolz',
    'Furia',
    NULL,
    '430770974481448960',
    1,
    'dafid',
    '2025-12-10 19:18:46'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    317,
    'blmateo710_72124',
    'Furia, Vitality, Falcons, FaZe Clan',
    'Furia, Falcons',
    'Falcons',
    NULL,
    '1396160636639117372',
    1,
    'BL Mateo710',
    '2025-12-10 19:23:16'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    318,
    'nikt_ciekawy1337',
    'Falcons, FaZe Clan, Vitality, Furia',
    'Furia, Falcons',
    'Furia',
    'Vitality',
    '1067108422652284968',
    1,
    'Nikt Ciekawy',
    '2025-12-10 19:25:14'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    319,
    'feranxd',
    'Spirit, Vitality, FaZe Clan, Furia',
    'FaZe Clan, Spirit',
    'FaZe Clan',
    'Furia',
    '1337893397721251894',
    1,
    'Feran',
    '2025-12-10 19:50:19'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    320,
    'kombajnista.',
    'Spirit, Furia, Vitality, FaZe Clan',
    'Vitality, Furia',
    'Furia',
    NULL,
    '378201105256939521',
    1,
    'kombajnista',
    '2025-12-10 21:18:24'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    321,
    'antonisss878',
    'Furia, Vitality, FaZe Clan, Falcons',
    'Furia, Vitality',
    'Furia',
    NULL,
    '1283815621829857341',
    1,
    'Antonisss878',
    '2025-12-10 22:17:45'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    322,
    '.fred1213',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Spirit, Furia',
    'Spirit',
    NULL,
    '488757200399892480',
    1,
    '✔ ???????? ✔',
    '2025-12-10 22:28:42'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    323,
    'neverxoid',
    'Spirit, Vitality, MOUZ, Furia',
    'Vitality, Furia',
    'Furia',
    NULL,
    '233330984395866112',
    1,
    'Neverxoid',
    '2025-12-10 22:29:34'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    324,
    'ponczczu_',
    'Falcons, FaZe Clan, Vitality, NAVI',
    'Vitality, FaZe Clan',
    'Vitality',
    'Falcons',
    '1351636790678654987',
    1,
    '3MPT!N3SSS',
    '2025-12-11 00:09:42'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    325,
    'gila.pl',
    'Vitality, NAVI, FaZe Clan, Falcons',
    'NAVI, Falcons',
    'NAVI',
    'Furia',
    '1181560396121907252',
    1,
    'Swiateczny gila',
    '2025-12-11 10:32:47'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    326,
    'biblethump2476',
    'Spirit, Vitality, NAVI, FaZe Clan',
    'Vitality, FaZe Clan',
    'Vitality',
    NULL,
    '291621406708465664',
    1,
    'angel',
    '2025-12-11 10:32:52'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    327,
    'nextcsgo',
    'Furia, Vitality, Falcons, FaZe Clan',
    'Furia, Falcons',
    'Falcons',
    NULL,
    '1133673169350307931',
    1,
    'PJ',
    '2025-12-11 10:32:52'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    328,
    'hubcio7480',
    'Furia, Vitality, MOUZ, Falcons',
    'Falcons, Furia',
    'Furia',
    'Vitality',
    '792063759521808394',
    1,
    'Hubcio',
    '2025-12-11 10:33:01'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    330,
    'cinek1320',
    'Furia, Spirit, The Mongolz, NAVI',
    'Spirit, Furia',
    'Spirit',
    'NAVI',
    '1297494645898612832',
    1,
    'Cinek',
    '2025-12-11 10:33:28'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    331,
    'shintowsky',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Vitality',
    'Furia',
    'FaZe Clan',
    '300683011102474251',
    1,
    'Shintowskyツ',
    '2025-12-11 10:33:39'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    332,
    'lemon3105',
    'Spirit, Vitality, Furia, FaZe Clan',
    'FaZe Clan, Vitality',
    'FaZe Clan',
    NULL,
    '421726542104625163',
    1,
    'Lemonziiko',
    '2025-12-11 10:33:49'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    333,
    'kurczacze',
    'Furia, Vitality, FaZe Clan, Falcons',
    'Furia, Falcons',
    'Furia',
    'Falcons',
    '936390831580008539',
    1,
    'kurczak',
    '2025-12-11 10:34:30'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    337,
    'kjnv3',
    'Furia, Vitality, MOUZ, Falcons',
    'Furia, Vitality',
    'Furia',
    'Falcons',
    '534065689947013122',
    1,
    'Konfi Cotton',
    '2025-12-11 10:42:01'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    338,
    'k1ksl',
    'Furia, Vitality, FaZe Clan, Falcons',
    'Furia, Vitality',
    'Furia',
    'Falcons',
    '386495286563962880',
    1,
    'KSL',
    '2025-12-11 10:42:31'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    339,
    '.adelay',
    'Furia, Spirit, FaZe Clan, Vitality',
    'Furia, Spirit',
    'Furia',
    'Vitality',
    '675411059091439626',
    1,
    'Adelay',
    '2025-12-11 10:42:38'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    340,
    'liquid1487',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Vitality',
    'Furia',
    'FaZe Clan',
    '757903126157328385',
    1,
    'Liquid4K',
    '2025-12-11 10:43:16'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    342,
    'chrytybob',
    'Furia, Spirit, FaZe Clan, The Mongolz',
    'Furia, Spirit',
    'Furia',
    'FaZe Clan',
    '1292388710121209858',
    1,
    'chryty',
    '2025-12-11 10:45:38'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    343,
    'hy4per',
    'Spirit, Vitality, MOUZ, Furia',
    'Spirit, Furia',
    'Furia',
    'MOUZ',
    '823202779971453048',
    1,
    '✝Hy4per✝',
    '2025-12-11 10:46:44'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    344,
    'hub1xx_',
    'FaZe Clan, Spirit, Vitality, Furia',
    'FaZe Clan, Vitality',
    'FaZe Clan',
    'Furia',
    '906231768712101919',
    1,
    'hub1x',
    '2025-12-11 10:52:13'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    345,
    'snajper703',
    'Furia, Vitality, Falcons, MOUZ',
    'Furia, Falcons',
    'Furia',
    'Vitality',
    '681166431567478790',
    1,
    'Timo',
    '2025-12-11 10:54:40'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    346,
    'matrixxxx_',
    'Furia, Vitality, FaZe Clan, Spirit',
    'Furia, Vitality',
    'Furia',
    'Vitality',
    '723525504384237620',
    1,
    'Matrix',
    '2025-12-11 10:56:21'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    347,
    'mjkaelo',
    'Spirit, Vitality, Furia, MOUZ',
    'Vitality, Furia',
    'Vitality',
    'Spirit',
    '498152549451563009',
    1,
    'mjkaelo',
    '2025-12-11 10:59:38'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    349,
    'xpatrykp19x_47265',
    'Furia, Spirit, Vitality, MOUZ',
    'Furia, Vitality',
    'Furia',
    'Spirit',
    '1356379694769111101',
    1,
    'xpatrykp19x',
    '2025-12-11 11:00:57'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    350,
    'ezsalty',
    'FaZe Clan, Falcons, Vitality, Furia',
    'Furia, Falcons',
    'Furia',
    NULL,
    '804729333276868609',
    1,
    'salty',
    '2025-12-11 11:01:24'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    356,
    '_sliqz',
    'Furia, Spirit, Vitality, MOUZ',
    'Furia, Vitality',
    'Vitality',
    'Furia',
    '1097190679773466764',
    1,
    'ˢᴸᴵǫᶻ',
    '2025-12-11 11:25:04'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    358,
    'wojtass._.',
    'Furia, Spirit, Vitality, Falcons',
    'Furia, Spirit',
    'Furia',
    'Falcons',
    '815342777918554122',
    1,
    'Wojtas.',
    '2025-12-11 11:34:06'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    359,
    'fazer85',
    'Furia, Spirit, Vitality, MOUZ',
    'Furia, Vitality',
    'Furia',
    'Vitality',
    '333906708336476170',
    1,
    'Fazer*',
    '2025-12-11 11:55:49'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    361,
    'nameles_212',
    'Furia, Vitality, NAVI, Spirit',
    'Furia, Vitality',
    'Furia',
    'Vitality',
    '1389201056159891557',
    1,
    'MOISER',
    '2025-12-11 12:26:00'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    365,
    'pawel567',
    'Spirit, Vitality, Furia, FaZe Clan',
    'Vitality, Furia',
    'Vitality',
    'Spirit',
    '232568423517913088',
    1,
    'Paweł567',
    '2025-12-11 13:01:08'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    367,
    'dominikg09',
    'Vitality, FaZe Clan, Furia, Spirit',
    'Spirit, Furia',
    'Spirit',
    NULL,
    '1281640108155469945',
    1,
    'Galazka',
    '2025-12-11 13:05:54'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    368,
    'ummopolaco_17150',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Spirit',
    'Furia',
    'FaZe Clan',
    '1288098809595039796',
    1,
    'Ummopolaco',
    '2025-12-11 13:21:24'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    370,
    'avatariroh1',
    'Furia, Vitality, Spirit, MOUZ',
    'Furia, Spirit',
    'Furia',
    NULL,
    '1245802397645934682',
    1,
    'lunargondolier22',
    '2025-12-11 13:28:26'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    371,
    'matiwk222',
    'Furia, Vitality, FaZe Clan, Falcons',
    'Furia, Vitality',
    'Furia',
    NULL,
    '1081626433266393198',
    1,
    'matiwk222',
    '2025-12-11 13:30:24'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    373,
    'stasiumadafak',
    'Furia, Spirit, Vitality, MOUZ',
    'Furia, Vitality',
    'Furia',
    NULL,
    '1077357796762337331',
    1,
    'StasiuMadaFak',
    '2025-12-11 13:55:30'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    374,
    'lukaserek',
    'Furia, Falcons, MOUZ, The Mongolz',
    'Furia, Falcons',
    'Furia',
    'Spirit',
    '678349800734851097',
    1,
    'Luka$er',
    '2025-12-11 13:58:08'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    375,
    'fabi_gs',
    'Spirit, Furia, MOUZ, Vitality',
    'Spirit, MOUZ',
    'MOUZ',
    'Furia',
    '589103946921148446',
    1,
    'FaBi',
    '2025-12-11 14:07:35'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    376,
    'quiq19',
    'Furia, Vitality, Spirit, FaZe Clan',
    'Furia, Vitality',
    'Furia',
    'Spirit',
    '542361412127686657',
    1,
    'Quiq',
    '2025-12-11 14:09:56'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    377,
    'tiro2137',
    'Furia, Vitality, MOUZ, Falcons',
    'Falcons, MOUZ',
    'Falcons',
    NULL,
    '755766085982093312',
    1,
    'Tiřõ²⅓⁷',
    '2025-12-11 14:14:36'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    379,
    'ortionv2',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Vitality, Furia',
    'Vitality',
    NULL,
    '1279804882445930609',
    1,
    '<O®T¡0n',
    '2025-12-11 14:22:38'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    380,
    'hypu_',
    'Furia, Vitality, Spirit, FaZe Clan',
    'Furia, Spirit',
    'Furia',
    NULL,
    '210125024672219136',
    1,
    'Hypu',
    '2025-12-11 14:25:04'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    384,
    'swampie000',
    'Spirit, NAVI, FaZe Clan, The Mongolz',
    'Spirit, NAVI',
    'NAVI',
    'Spirit',
    '1001546350636306513',
    1,
    'swmapie',
    '2025-12-11 14:43:13'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    386,
    'toniekarp',
    'Furia, Falcons, Vitality, FaZe Clan',
    'FaZe Clan, Vitality',
    'FaZe Clan',
    NULL,
    '928974823894429716',
    1,
    'Toniekarp',
    '2025-12-11 14:48:10'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    387,
    'makuwk1233',
    'Furia, Spirit, Vitality, MOUZ',
    'Furia, Spirit',
    'Furia',
    NULL,
    '627796290788392970',
    1,
    'makuwk1233',
    '2025-12-11 15:01:14'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    388,
    'pastor7393',
    'Furia, FaZe Clan, Spirit, The Mongolz',
    'FaZe Clan, Spirit',
    'FaZe Clan',
    'Furia',
    '518331730688475136',
    1,
    'Pastor',
    '2025-12-11 15:01:31'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    389,
    'hap3rr',
    'Spirit, Vitality, NAVI, Furia',
    'Vitality, Furia',
    'Vitality',
    'Falcons',
    '516697873497456655',
    1,
    'hap3r',
    '2025-12-11 15:01:36'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    390,
    'krzysik000_13670',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Vitality, Furia',
    'Furia',
    'Spirit',
    '1384832398432145493',
    1,
    'ksiek',
    '2025-12-11 15:01:49'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    391,
    '_maniusyofi',
    'Vitality, FaZe Clan, Spirit, Furia',
    'FaZe Clan, Furia',
    'FaZe Clan',
    NULL,
    '682588374934224913',
    1,
    '!!_Maniuś/YoFi',
    '2025-12-11 15:02:07'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    392,
    'grubci0',
    'Furia, Falcons, FaZe Clan, Vitality',
    'Falcons, Furia',
    'Falcons',
    'Vitality',
    '930434185422864414',
    1,
    'jurson',
    '2025-12-11 15:02:28'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    393,
    'hopper2137',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Spirit',
    'Furia',
    'FaZe Clan',
    '614884618272768038',
    1,
    'hopper',
    '2025-12-11 15:02:44'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    394,
    'kotlecik_',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Spirit, Vitality',
    'Falcons',
    'Furia',
    '443767806241275915',
    1,
    'kotlecik',
    '2025-12-11 15:03:22'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    395,
    'panmarudaa',
    'Furia, Spirit, FaZe Clan, Vitality',
    'Furia, FaZe Clan',
    'FaZe Clan',
    'Vitality',
    '1060965953954910279',
    1,
    'PanMaruda',
    '2025-12-11 15:04:12'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    396,
    '_skowron.',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Spirit',
    'Spirit',
    'FaZe Clan',
    '790973841257922561',
    1,
    '_skowron.',
    '2025-12-11 15:11:41'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    397,
    'nixon338',
    'Spirit, Vitality, Furia, FaZe Clan',
    'Furia, Vitality',
    'Furia',
    'Spirit',
    '1394045439782949104',
    1,
    'Nixon',
    '2025-12-11 15:13:30'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    398,
    'jug3n_',
    'Furia, Spirit, FaZe Clan, Vitality',
    'Spirit, FaZe Clan',
    'FaZe Clan',
    'Furia',
    '890220298861940767',
    1,
    'jug3n',
    '2025-12-11 15:15:26'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    399,
    'archegryf_',
    'FaZe Clan, Furia, Vitality, Spirit',
    'FaZe Clan, Furia',
    'FaZe Clan',
    'Furia',
    '418488021550235649',
    1,
    'Archegryf',
    '2025-12-11 15:15:30'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    400,
    'bamu5',
    'Spirit, Vitality, NAVI, FaZe Clan',
    'Vitality, NAVI',
    'Vitality',
    'FaZe Clan',
    '1272830126832226355',
    1,
    'Pympek',
    '2025-12-11 15:22:07'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    401,
    'thumeler',
    'Furia, Spirit, MOUZ, The Mongolz',
    'Furia, Spirit',
    'Furia',
    NULL,
    '705435701507784714',
    1,
    'nighty99',
    '2025-12-11 15:31:22'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    403,
    'czipsol',
    'Furia, Spirit, Vitality, FaZe Clan',
    'Furia, Spirit',
    'Furia',
    'Vitality',
    '383712116005404675',
    1,
    'czipsol',
    '2025-12-11 15:37:00'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    405,
    'stivma40ms',
    'Spirit, Vitality, NAVI, FaZe Clan',
    'FaZe Clan, Spirit',
    'FaZe Clan',
    'NAVI',
    '524257024146538507',
    1,
    'StivMa40MS',
    '2025-12-11 15:53:37'
  );
INSERT INTO
  `playoffs_predictions` (
    `id`,
    `username`,
    `semifinalists`,
    `finalists`,
    `winner`,
    `third_place_winner`,
    `user_id`,
    `active`,
    `displayname`,
    `submitted_at`
  )
VALUES
  (
    407,
    'bodzix_',
    'Furia, MOUZ, Vitality, Falcons',
    'Furia, Falcons',
    'Falcons',
    'Vitality',
    '499568655508570119',
    1,
    'bodzix',
    '2025-12-11 15:57:47'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: playoffs_results
# ------------------------------------------------------------

INSERT INTO
  `playoffs_results` (
    `id`,
    `correct_semifinalists`,
    `correct_finalists`,
    `correct_winner`,
    `correct_third_place_winner`,
    `created_at`,
    `active`
  )
VALUES
  (16, 'Spirit, Vitality', '', '', NULL, NULL, 0);
INSERT INTO
  `playoffs_results` (
    `id`,
    `correct_semifinalists`,
    `correct_finalists`,
    `correct_winner`,
    `correct_third_place_winner`,
    `created_at`,
    `active`
  )
VALUES
  (
    20,
    'Spirit, Vitality, FaZe Clan, NAVI',
    'FaZe Clan, Vitality',
    'Vitality',
    NULL,
    NULL,
    1
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: playoffs_scores
# ------------------------------------------------------------

INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '461851082570596352', 685, 'Ciepły', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '983748525798084628',
    686,
    '.michazwon',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '1296180581305942016', 687, 'z3fir', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '1310326288011231294', 688, 'Antek', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '517441265575526400', 689, 'bili13', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '1145386101264109669',
    690,
    'Mr Marty',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '710794795529928785', 691, 'PIKOM', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '808309868586467348',
    692,
    'bartmacieja',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '420597124724555777', 693, 'sqiel', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '451738220519096320', 694, '.emzet', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '1278670384358621225', 695, 'XeytoX', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '748264642509275196', 696, '?? ⁷⁷⁷', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '692431475139805305', 697, 'jxcxk', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '1271521295674376204',
    698,
    'Simply_Kubus',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '553265023754043403', 699, 'lisu', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '1097066576294977547',
    700,
    'F0STiii',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '278065188169842688',
    701,
    'ArcadianPrime',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '479245851722645535', 702, 'Ales', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '434439412256997377',
    703,
    'orzeł zps',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '486957798207258635', 704, 'Kuba', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '932271244345233439', 705, 'srajkez', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '927133165670260746', 706, 'OstropA', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '1000080089888862278',
    707,
    'fieliep',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '1356907806883713064', 708, 'Tomson', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '926626252985618432', 709, 'dombi', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '376797769492594689', 710, 'Graba', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '471399701976055818', 711, 'Milyy', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '801164867457253406', 712, '☢?????☢', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '1117505334869758144',
    713,
    'Maasterek',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '320224049760567296',
    714,
    'pbialy123',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '759697317263310889',
    715,
    'questrian',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '566627818255941632', 716, 'gecko', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '231814174030823424',
    717,
    'Mista0swaggg',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '415864755845070850', 718, 'BOTGAT', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '312633551466135553', 719, 'ZenSoul', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '629686561562165249',
    720,
    'Turoczek',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '751675646979080212',
    721,
    'baran_clip_you',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '788345818343669760',
    722,
    'youka ༉‧₊˚✧',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '1428965429635977299',
    723,
    'ejwejqe',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '319901756064792588', 724, 'ZIPI', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '340076455868235777', 725, 'T1mero', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '300273286489702402', 726, 'Borowik', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '823526692189634580', 727, 'geeciu', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '1250835724169777277',
    728,
    'everyone',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '1025367753588228128',
    729,
    'gitsoneqq',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '723447196388819014', 730, 'XcZaRo', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '581860728240340992',
    731,
    'DAMN1ggy_',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '305737641763274752', 732, 'sadz1k', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '1225901047982329876',
    733,
    'Karambolowy zawrót głowy',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '727134099231211571', 734, '촌사람 같은', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '862041274973552651',
    735,
    'BqMaJsTeR',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '1023203535971684425', 736, 'Deter', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '303361405677993984',
    737,
    'Mefistofeles Z Efezu',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '340841216507904001',
    738,
    'CwelulozaOwner',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '1275527297893531772',
    739,
    'Bartuss',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 0, NULL, '789922633012609044', 740, 'Subwey', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '879476380562235392', 741, 'Kiwi', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '1388519493361471569',
    742,
    'Balacl4va',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '779402540755976192',
    743,
    '_prosik_5678_',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '688759630448689183', 744, 'Karolem', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '506914119710932993', 745, 'fre3sh', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '668913702510002179', 746, 'Gajtan', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '322812891956903937', 747, 'Luxor', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '486499834384220170', 748, 'Rogyoa', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '1034910520165285898', 749, 'Qbinho', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '463234527850921985', 750, 'Igssk', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '453811822320025603', 751, 'D1oxie', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '410931873322369034',
    752,
    'Strachowski2204',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '678610287640969233', 753, '?????', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '737688687227306075', 754, 'adleko', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '919347146405339138',
    755,
    'POPROSTUFABIAN',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '657270787711041546',
    756,
    'Assassin',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '1219387685425254441',
    757,
    '! Мajkutini',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '811601970506629150',
    758,
    'KebabikRHC',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '406902151529627649',
    759,
    'RamirezKKS',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '435779589864816640',
    760,
    'Grubycoach',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '874671251459833876', 761, '--js', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '361572745147842563', 762, 'CziKi', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '1099627480911978526', 763, 'jc0bs', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '1145443406638751815', 764, 'bombix', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '284275389348446209', 765, 'Kszyś', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '773526091628412930',
    766,
    'itsLoCKz',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '472474920270561281', 767, 'Dekus', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '983477936810238052', 768, '!Spinka', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '529027111504314399', 769, 'xNiko', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '352823893003730945',
    770,
    'Pancio ツ',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '896147575093198958', 771, 'KmL', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '693547426212216892', 772, 'BoloTv', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '519586946176253952', 773, 'ҜuBi', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '1077219449502965790', 774, 'JakoN-', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '809885132101779456', 775, 'Laki', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '359370791076364290',
    776,
    'ŁeB SzOt',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '1078726241680633857',
    777,
    'xSetiツ_',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '510573405569941515', 778, 'Grubcio', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '486577410037514250', 779, 'Tamski', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '931168369573503006', 780, 'Rysiu', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '784508141580189766',
    781,
    'mcm_sniper71',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '471463411239092225',
    782,
    '-muchson-',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '419278999991353374',
    783,
    'Monczall',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '1182053587774341170', 784, 'Pleple', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '1204544158828597325', 785, 'arsiif', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '1126999169966538874',
    786,
    'Ciapatyy',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '525034117105188865', 787, 'KayEss', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '462870389316386817',
    788,
    'kacpereq__',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '1439298047946522686',
    789,
    'crestofek',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '350604331621548032', 790, 'Deyanek', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '964187009520377856',
    791,
    'Gemainda',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    0,
    NULL,
    '1124240992380395550',
    792,
    'kuba koz',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '463001727310757888', 793, 'Kper', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '723493354918379533', 794, 'Monte', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '475741078675259392',
    795,
    'Robercik_Pepperoni',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '351475146604675072',
    796,
    'haciolem',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '561623798596632588',
    797,
    'Lukasz_03',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '532912683666898944',
    798,
    'xQBIK.wav',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '451016732551675905', 799, 'nscr', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '864932529789206629',
    800,
    'Terapeutaaa',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '1246440698517913775', 801, 'Nixy', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '1284075325042724900',
    802,
    'Buldogun',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '1236280013343424512', 803, 'kqcus.', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '312232069289869322', 804, 'Turb0s', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '555800660357021696', 805, 'Тотя ❤', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '318343577765806080',
    806,
    'Gekoniasty',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '627115371878416385', 807, 'Savi0X', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '649683931897135125', 808, 'szymcr8', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '451703866267009024',
    809,
    'Egzekucja',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '691432428232900709',
    810,
    'macidk12',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    0,
    NULL,
    '1183148710943797321',
    811,
    'XxKacperskyy',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '882519104316137502',
    812,
    'Sky Shafiq',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '872140778703556708', 813, 'Kapi', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '519287591028391959',
    814,
    ',,Sajmuraj\'\'',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '733573014402236449', 815, '?????', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '548248747977474048', 816, 'Łukasz', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '672470404518117426',
    817,
    'TheReaper',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '868436437274599434', 818, 'Elczups', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '905494286005583872',
    819,
    'shesaskurwol',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '573574878918082560',
    820,
    'Tusiactwo',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '535251994831618076', 821, 'Toomixx', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '478486060943540225',
    822,
    'Marcineq',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '594964029940957224',
    823,
    'McGregor17',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '646804591853436946', 824, 'Dorkej', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '131175559345602561', 825, 'B3neK', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '228173160355332097',
    826,
    'Banderas',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '402199933936992258',
    827,
    'Mam wolne wtorki',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '690944257439301652', 828, 'Kowss50', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '655130175389958144', 829, 'Krowli', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '522446902147547157', 830, 'kam8l', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '1153270538429542421',
    831,
    'gwd313g',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '761587793893654549',
    832,
    'Dr.Macika',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '364402950057099266', 833, 'eMten', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '419956536102617089',
    834,
    'ccccccccc',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '1270413622371422343', 835, 'happy', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '630820180901101600',
    836,
    'iluminati',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '462244738096037899', 837, 'Zzero', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '430770974481448960', 838, 'dafid', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '1396160636639117372',
    839,
    'BL Mateo710',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '1067108422652284968',
    840,
    'Nikt Ciekawy',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '1337893397721251894', 841, 'Feran', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '378201105256939521',
    842,
    'kombajnista',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '1283815621829857341',
    843,
    'Antonisss878',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '488757200399892480',
    844,
    '✔ ???????? ✔',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '233330984395866112',
    845,
    'Neverxoid',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '1351636790678654987',
    846,
    '3MPT!N3SSS',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '1181560396121907252',
    847,
    'Swiateczny gila',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '291621406708465664', 848, 'angel', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '1133673169350307931', 849, 'PJ', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '792063759521808394', 850, 'Hubcio', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '1297494645898612832', 851, 'Cinek', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '300683011102474251',
    852,
    'Shintowskyツ',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '421726542104625163',
    853,
    'Lemonziiko',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '936390831580008539', 854, 'kurczak', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '534065689947013122',
    855,
    'Konfi Cotton',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '386495286563962880', 856, 'KSL', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '675411059091439626', 857, 'Adelay', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '757903126157328385',
    858,
    'Liquid4K',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '1292388710121209858', 859, 'chryty', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '823202779971453048',
    860,
    '✝Hy4per✝',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '906231768712101919', 861, 'hub1x', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '681166431567478790', 862, 'Timo', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '723525504384237620', 863, 'Matrix', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '498152549451563009', 864, 'mjkaelo', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '1356379694769111101',
    865,
    'xpatrykp19x',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '804729333276868609', 866, 'salty', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '1097190679773466764', 867, 'ˢᴸᴵǫᶻ', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '815342777918554122', 868, 'Wojtas.', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '333906708336476170', 869, 'Fazer*', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '1389201056159891557', 870, 'MOISER', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '232568423517913088',
    871,
    'Paweł567',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '1281640108155469945',
    872,
    'Galazka',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '1288098809595039796',
    873,
    'Ummopolaco',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '1245802397645934682',
    874,
    'lunargondolier22',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '1081626433266393198',
    875,
    'matiwk222',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '1077357796762337331',
    876,
    'StasiuMadaFak',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 0, NULL, '678349800734851097', 877, 'Luka$er', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '589103946921148446', 878, 'FaBi', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '542361412127686657', 879, 'Quiq', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '755766085982093312', 880, 'Tiřõ²⅓⁷', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '1279804882445930609',
    881,
    '<O®T¡0n',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '210125024672219136', 882, 'Hypu', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '1001546350636306513',
    883,
    'swmapie',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '928974823894429716',
    884,
    'Toniekarp',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '627796290788392970',
    885,
    'makuwk1233',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '518331730688475136', 886, 'Pastor', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '516697873497456655', 887, 'hap3r', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '1384832398432145493', 888, 'ksiek', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '682588374934224913',
    889,
    '!!_Maniuś/YoFi',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '930434185422864414', 890, 'jurson', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '614884618272768038', 891, 'hopper', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '443767806241275915',
    892,
    'kotlecik',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '1060965953954910279',
    893,
    'PanMaruda',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '790973841257922561',
    894,
    '_skowron.',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '1394045439782949104', 895, 'Nixon', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '890220298861940767', 896, 'jug3n', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '418488021550235649',
    897,
    'Archegryf',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '1272830126832226355', 898, 'Pympek', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    1,
    NULL,
    '705435701507784714',
    899,
    'nighty99',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 2, NULL, '383712116005404675', 900, 'czipsol', 1);
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    NULL,
    '524257024146538507',
    901,
    'StivMa40MS',
    1
  );
INSERT INTO
  `playoffs_scores` (
    `username`,
    `points`,
    `score`,
    `user_id`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (NULL, 1, NULL, '499568655508570119', 902, 'bodzix', 1);

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: swiss_predictions
# ------------------------------------------------------------

INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    38,
    'felipeelmanitas',
    '704078031567847595',
    'FaZe Clan, Legacy',
    'RED Canids, Rare Atom',
    'PARIVISION, B8, M80, Lynn Vision Gaming, Ninjas in Pyjamas, GamerLegion',
    0,
    '2025-11-11 15:01:24',
    'stage1',
    'Felipe El Manitas'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    39,
    'kapitron_',
    '1255616760179331148',
    'B8, Legacy',
    'The Huns Esports, Rare Atom',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Fnatic, M80, PARIVISION',
    0,
    '2025-11-11 15:01:25',
    'stage1',
    'kapitron_'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    40,
    'janosik7.',
    '1296180581305942016',
    'Legacy, GamerLegion',
    'The Huns Esports, RED Canids',
    'FaZe Clan, Ninjas in Pyjamas, B8, PARIVISION, Fnatic, Lynn Vision Gaming',
    0,
    '2025-11-11 15:01:31',
    'stage1',
    'z3fir'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    41,
    'aha5641',
    '1019347634198163556',
    'Ninjas in Pyjamas, GamerLegion',
    'The Huns Esports, Rare Atom',
    'FaZe Clan, B8, PARIVISION, Fnatic, M80, Fluxo',
    0,
    '2025-11-11 15:01:36',
    'stage1',
    'Kalmox'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    42,
    'averegz',
    '528766654247862273',
    'Ninjas in Pyjamas, GamerLegion',
    'The Huns Esports, RED Canids',
    'FaZe Clan, B8, PARIVISION, Fnatic, Legacy, Lynn Vision Gaming',
    0,
    '2025-11-11 15:01:37',
    'stage1',
    'Averegz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    43,
    'matheochudini',
    '456217671839645697',
    'GamerLegion, FaZe Clan',
    'Fnatic, RED Canids',
    'Legacy, Ninjas in Pyjamas, FlyQuest, M80, Imperial, Lynn Vision Gaming',
    0,
    '2025-11-11 15:02:49',
    'stage1',
    'S2AKAL'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    44,
    'gibonias7y',
    '558039958636462087',
    'FaZe Clan, Legacy',
    'Fluxo, RED Canids',
    'GamerLegion, B8, PARIVISION, Fnatic, Ninjas in Pyjamas, Imperial',
    0,
    '2025-11-11 15:03:43',
    'stage1',
    'gbn'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    45,
    '_kuriereq',
    '1215282198081437717',
    'GamerLegion, Legacy',
    'RED Canids, NRG',
    'FaZe Clan, Ninjas in Pyjamas, B8, M80, Lynn Vision Gaming, FlyQuest',
    0,
    '2025-11-11 15:03:58',
    'stage1',
    'kuriereq'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    46,
    'gitsoneqq',
    '1025367753588228128',
    'FaZe Clan, GamerLegion',
    'The Huns Esports, Rare Atom',
    'Ninjas in Pyjamas, B8, Fnatic, Legacy, Imperial, FlyQuest',
    0,
    '2025-11-11 15:04:09',
    'stage1',
    'gitsoneqq'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    47,
    'macmal',
    '604552227759063040',
    'Legacy, FaZe Clan',
    'Rare Atom, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, Fnatic, B8, PARIVISION, Lynn Vision Gaming',
    0,
    '2025-11-11 15:04:29',
    'stage1',
    'Macmal'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    48,
    'zakladpogrzebowykostrzyn',
    '1053050004387921930',
    'FaZe Clan, Legacy',
    'RED Canids, NRG',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, B8, Imperial, FlyQuest',
    0,
    '2025-11-11 15:04:56',
    'stage1',
    'Zakład Pogrzebowy Kostrzyn'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    49,
    'poncze_kk',
    '479915126489612310',
    'M80, Lynn Vision Gaming',
    'PARIVISION, Imperial',
    'FaZe Clan, GamerLegion, Fnatic, FlyQuest, Rare Atom, Ninjas in Pyjamas',
    0,
    '2025-11-11 15:05:06',
    'stage1',
    'poncze_kk'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    50,
    'get_x1zz',
    '1393656003307900948',
    'FaZe Clan, Ninjas in Pyjamas',
    'RED Canids, The Huns Esports',
    'GamerLegion, B8, PARIVISION, Legacy, Rare Atom, NRG',
    0,
    '2025-11-11 15:06:16',
    'stage1',
    'x1zz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    51,
    'bamu5',
    '1272830126832226355',
    'B8, Legacy',
    'NRG, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, PARIVISION, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-11 15:08:00',
    'stage1',
    'Ewok'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    52,
    'sharp431',
    '419289850118668328',
    'B8, Ninjas in Pyjamas',
    'NRG, The Huns Esports',
    'FaZe Clan, GamerLegion, Fnatic, Legacy, Lynn Vision Gaming, Rare Atom',
    0,
    '2025-11-11 15:09:12',
    'stage1',
    'Sharp'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    53,
    'koniqq.',
    '954840918391930901',
    'Ninjas in Pyjamas, FaZe Clan',
    'NRG, The Huns Esports',
    'FlyQuest, Imperial, Fnatic, PARIVISION, GamerLegion, Legacy',
    0,
    '2025-11-11 15:09:15',
    'stage1',
    'Mateuss'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    54,
    'tadeuszczota',
    '1148667641314164836',
    'Legacy, FaZe Clan',
    'NRG, FlyQuest',
    'GamerLegion, Lynn Vision Gaming, Ninjas in Pyjamas, B8, Fnatic, Imperial',
    0,
    '2025-11-11 15:09:53',
    'stage1',
    'leworensky'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    55,
    'k4r60',
    '261499368362868742',
    'B8, Ninjas in Pyjamas',
    'RED Canids, Fluxo',
    'FaZe Clan, GamerLegion, Legacy, M80, PARIVISION, FlyQuest',
    0,
    '2025-11-11 15:10:51',
    'stage1',
    'Kargo'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    56,
    'olo5137',
    '932271244345233439',
    'PARIVISION, FaZe Clan',
    'Rare Atom, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, B8, Fnatic, Lynn Vision Gaming, Legacy',
    0,
    '2025-11-11 15:11:21',
    'stage1',
    'srajkez'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    57,
    'klonx9',
    '569508807374536724',
    'PARIVISION, FaZe Clan',
    'Fluxo, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, B8, Lynn Vision Gaming, Legacy, Fnatic',
    1,
    '2025-11-11 15:11:47',
    'stage1',
    'klonx9'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    58,
    'bartus0858',
    '1275527297893531772',
    'FaZe Clan, Lynn Vision Gaming',
    'PARIVISION, The Huns Esports',
    'GamerLegion, Fnatic, M80, FlyQuest, Fluxo, Ninjas in Pyjamas',
    0,
    '2025-11-11 15:13:30',
    'stage1',
    'Bartuss'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    59,
    'kubaster222',
    '1271521295674376204',
    'PARIVISION, B8',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Legacy, Fnatic, NRG',
    1,
    '2025-11-11 15:15:11',
    'stage1',
    'Simply_Kubus'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    60,
    'kartoffelplatz',
    '411242187213242370',
    'Legacy, M80',
    'PARIVISION, RED Canids',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, B8, Lynn Vision Gaming, FlyQuest',
    0,
    '2025-11-11 15:16:00',
    'stage1',
    'm0ris'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    61,
    'worekit',
    '590180516716871683',
    'FaZe Clan, Legacy',
    'The Huns Esports, Rare Atom',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Fnatic, M80',
    0,
    '2025-11-11 15:17:23',
    'stage1',
    'Worekit'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    62,
    'kayesssss',
    '525034117105188865',
    'Legacy, FaZe Clan',
    'Rare Atom, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Lynn Vision Gaming, M80',
    0,
    '2025-11-11 15:20:51',
    'stage1',
    'KayEss'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    63,
    'panciovsky',
    '352823893003730945',
    'Legacy, GamerLegion',
    'Rare Atom, The Huns Esports',
    'FaZe Clan, Ninjas in Pyjamas, B8, PARIVISION, Imperial, M80',
    0,
    '2025-11-11 15:23:27',
    'stage1',
    'Pancio ツ'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    64,
    'pigo2450',
    '919347146405339138',
    'Legacy, FaZe Clan',
    'RED Canids, Rare Atom',
    'Ninjas in Pyjamas, B8, GamerLegion, PARIVISION, Fnatic, M80',
    0,
    '2025-11-11 15:29:30',
    'stage1',
    'POPROSTUFABIAN'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    65,
    'ninjatoja',
    '718134989236994129',
    'GamerLegion, Ninjas in Pyjamas',
    'FlyQuest, RED Canids',
    'FaZe Clan, B8, PARIVISION, Fnatic, Legacy, M80',
    0,
    '2025-11-11 15:32:13',
    'stage1',
    'N1njaa'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    66,
    'crash5882',
    '1278670384358621225',
    'FaZe Clan, Imperial',
    'RED Canids, The Huns Esports',
    'Ninjas in Pyjamas, GamerLegion, B8, PARIVISION, Legacy, M80',
    0,
    '2025-11-11 15:33:40',
    'stage1',
    'XeytoX'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    67,
    'dominez_2',
    '1104704544488837170',
    'FaZe Clan, Legacy',
    'Fluxo, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, Lynn Vision Gaming, Fnatic, M80',
    0,
    '2025-11-11 15:33:47',
    'stage1',
    'dominez_2'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    68,
    'shintowsky',
    '300683011102474251',
    'FaZe Clan, Legacy',
    'NRG, Rare Atom',
    'B8, GamerLegion, PARIVISION, Ninjas in Pyjamas, Fnatic, FlyQuest',
    0,
    '2025-11-11 15:36:59',
    'stage1',
    'Shintowskyツ'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    69,
    'dr.macika',
    '761587793893654549',
    'FaZe Clan, Legacy',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, B8, Fnatic, M80, Lynn Vision Gaming',
    0,
    '2025-11-11 15:38:41',
    'stage1',
    'Dr.Macika'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    70,
    'proksiu',
    '343117544934342656',
    'GamerLegion, Legacy',
    'Rare Atom, Imperial',
    'FaZe Clan, Ninjas in Pyjamas, B8, PARIVISION, Fnatic, Lynn Vision Gaming',
    0,
    '2025-11-11 15:42:27',
    'stage1',
    'Proksiu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    71,
    'cieplyhehe',
    '461851082570596352',
    'FaZe Clan, GamerLegion',
    'M80, Imperial',
    'Rare Atom, FlyQuest, The Huns Esports, Lynn Vision Gaming, RED Canids, Fluxo',
    1,
    '2025-11-11 15:45:45',
    'stage1',
    'Ciepły'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    72,
    'krisv2._68440',
    '1153270538429542421',
    'Ninjas in Pyjamas, M80',
    'RED Canids, Lynn Vision Gaming',
    'FaZe Clan, GamerLegion, Fnatic, Legacy, Imperial, B8',
    0,
    '2025-11-11 15:48:36',
    'stage1',
    'gwd313g'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    73,
    'mulcik',
    '498845748792786944',
    'FaZe Clan, PARIVISION',
    'RED Canids, The Huns Esports',
    'Ninjas in Pyjamas, B8, GamerLegion, Fnatic, Legacy, M80',
    1,
    '2025-11-11 15:55:13',
    'stage1',
    'Multi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    74,
    'wil4r',
    '294891812466720768',
    'Lynn Vision Gaming, PARIVISION',
    'Fluxo, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Fnatic, FlyQuest, Legacy',
    0,
    '2025-11-11 16:08:26',
    'stage1',
    'WilAR'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    75,
    'magiczny_stas',
    '840627386352926760',
    'Legacy, FaZe Clan',
    'RED Canids, Rare Atom',
    'GamerLegion, Ninjas in Pyjamas, B8, Fnatic, PARIVISION, Lynn Vision Gaming',
    0,
    '2025-11-11 16:18:21',
    'stage1',
    'Magiczny Staś'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    76,
    'patryk27_',
    '1077219449502965790',
    'B8, Legacy',
    'The Huns Esports, Rare Atom',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, PARIVISION, Fnatic, Lynn Vision Gaming',
    0,
    '2025-11-11 16:21:22',
    'stage1',
    'JakoN-'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    77,
    'mattis44',
    '302360723676463104',
    'Ninjas in Pyjamas, B8',
    'RED Canids, PARIVISION',
    'FlyQuest, FaZe Clan, GamerLegion, Fnatic, Fluxo, M80',
    0,
    '2025-11-11 16:23:18',
    'stage1',
    'MaTTiS?'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    78,
    'tamski07',
    '486577410037514250',
    'GamerLegion, Legacy',
    'The Huns Esports, RED Canids',
    'FaZe Clan, B8, M80, PARIVISION, Ninjas in Pyjamas, Lynn Vision Gaming',
    0,
    '2025-11-11 16:37:40',
    'stage1',
    'Tamski'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    79,
    'quiq19',
    '542361412127686657',
    'FaZe Clan, Legacy',
    'RED Canids, Fluxo',
    'GamerLegion, M80, Imperial, Ninjas in Pyjamas, FlyQuest, B8',
    0,
    '2025-11-11 16:42:52',
    'stage1',
    'Quiq'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    80,
    'rogyoa',
    '486499834384220170',
    'FaZe Clan, GamerLegion',
    'FlyQuest, Rare Atom',
    'Ninjas in Pyjamas, B8, Fnatic, Lynn Vision Gaming, M80, The Huns Esports',
    0,
    '2025-11-11 16:45:08',
    'stage1',
    'Rogyoa'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    81,
    'nixon338',
    '1394045439782949104',
    'Legacy, Ninjas in Pyjamas',
    'Rare Atom, RED Canids',
    'FaZe Clan, GamerLegion, Fnatic, M80, B8, Lynn Vision Gaming',
    0,
    '2025-11-11 17:06:55',
    'stage1',
    'Nixon'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    82,
    'kowec',
    '1099021777096671394',
    'FaZe Clan, Legacy',
    'Fluxo, Rare Atom',
    'GamerLegion, Ninjas in Pyjamas, B8, M80, Lynn Vision Gaming, Fnatic',
    0,
    '2025-11-11 17:25:53',
    'stage1',
    'KarolEGG'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    83,
    '.kopia',
    '883797922381189141',
    'FaZe Clan, M80',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, B8, Fnatic, Imperial, Rare Atom',
    0,
    '2025-11-11 17:50:05',
    'stage1',
    'Kopia'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    84,
    'gupis.',
    '710819865367150703',
    'Legacy, B8',
    'RED Canids, The Huns Esports',
    'FaZe Clan, Ninjas in Pyjamas, PARIVISION, M80, Lynn Vision Gaming, GamerLegion',
    1,
    '2025-11-11 17:55:32',
    'stage1',
    'Gupiś'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    85,
    'zajchuu',
    '656537113394937866',
    'Fnatic, GamerLegion',
    'RED Canids, The Huns Esports',
    'FaZe Clan, B8, PARIVISION, FlyQuest, M80, Ninjas in Pyjamas',
    0,
    '2025-11-11 18:01:13',
    'stage1',
    'zajchuu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    86,
    'emeryt.muchson',
    '471463411239092225',
    'GamerLegion, Legacy',
    'The Huns Esports, NRG',
    'FaZe Clan, Ninjas in Pyjamas, B8, Fnatic, M80, Lynn Vision Gaming',
    0,
    '2025-11-11 18:06:01',
    'stage1',
    '-muchson-'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    87,
    'olszovsky',
    '1032327878991425617',
    'FaZe Clan, Legacy',
    'The Huns Esports, NRG',
    'GamerLegion, M80, B8, Fnatic, Ninjas in Pyjamas, FlyQuest',
    0,
    '2025-11-11 18:09:18',
    'stage1',
    'OLSZOVSKY'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    88,
    'thearcadian95',
    '278065188169842688',
    'FaZe Clan, Legacy',
    'Fluxo, The Huns Esports',
    'Ninjas in Pyjamas, M80, GamerLegion, PARIVISION, Lynn Vision Gaming, FlyQuest',
    0,
    '2025-11-11 18:13:36',
    'stage1',
    'ArcadianPrime'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    89,
    'rvltn_alfa',
    '526514638867922964',
    'B8, Legacy',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Lynn Vision Gaming, PARIVISION, M80',
    1,
    '2025-11-11 18:24:33',
    'stage1',
    'QŃ'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    90,
    'bbfj_',
    '1183153359000195224',
    'FaZe Clan, GamerLegion',
    'PARIVISION, NRG',
    'Ninjas in Pyjamas, Legacy, Lynn Vision Gaming, FlyQuest, Fnatic, Imperial',
    0,
    '2025-11-11 19:13:00',
    'stage1',
    'Bbfj'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    91,
    't1mero',
    '340076455868235777',
    'GamerLegion, Imperial',
    'Rare Atom, Fnatic',
    'FaZe Clan, Ninjas in Pyjamas, B8, PARIVISION, Legacy, M80',
    0,
    '2025-11-11 19:20:26',
    'stage1',
    'T1mero'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    92,
    'hojrah13_78716',
    '1214977723190222919',
    'FaZe Clan, Fnatic',
    'The Huns Esports, M80',
    'PARIVISION, NRG, Lynn Vision Gaming, FlyQuest, GamerLegion, Ninjas in Pyjamas',
    0,
    '2025-11-11 20:09:47',
    'stage1',
    'hojrahhy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    93,
    'protectcos_jd',
    '311925801794797578',
    'FaZe Clan, Lynn Vision Gaming',
    'The Huns Esports, Rare Atom',
    'GamerLegion, Ninjas in Pyjamas, B8, Legacy, M80, NRG',
    0,
    '2025-11-11 20:20:20',
    'stage1',
    'protectcos'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    94,
    'kubafar',
    '722038338973859901',
    'FaZe Clan, GamerLegion',
    'The Huns Esports, RED Canids',
    'Ninjas in Pyjamas, B8, PARIVISION, Fnatic, Legacy, Rare Atom',
    0,
    '2025-11-11 20:21:55',
    'stage1',
    'Kubafar'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    95,
    '.mefisto.',
    '509413231219965955',
    'Legacy, B8',
    'The Huns Esports, RED Canids',
    'GamerLegion, Imperial, FlyQuest, FaZe Clan, Ninjas in Pyjamas, PARIVISION',
    0,
    '2025-11-11 20:26:24',
    'stage1',
    'Mefisto'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    96,
    'kqcus.',
    '1236280013343424512',
    'FaZe Clan, Legacy',
    'RED Canids, Rare Atom',
    'B8, Ninjas in Pyjamas, GamerLegion, PARIVISION, Imperial, Lynn Vision Gaming',
    1,
    '2025-11-11 20:48:52',
    'stage1',
    'kqcus.'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    97,
    'cnoccs',
    '1250835724169777277',
    'B8, Legacy',
    'Fluxo, RED Canids',
    'GamerLegion, FaZe Clan, Ninjas in Pyjamas, PARIVISION, Lynn Vision Gaming, FlyQuest',
    0,
    '2025-11-11 21:06:12',
    'stage1',
    'everyone'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    98,
    'maciaty.',
    '518713983231066123',
    'FaZe Clan, Legacy',
    'RED Canids, The Huns Esports',
    'Fnatic, B8, FlyQuest, Lynn Vision Gaming, Ninjas in Pyjamas, Fluxo',
    0,
    '2025-11-11 21:06:20',
    'stage1',
    'M4cias'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    99,
    'a.matys__',
    '313437726789730305',
    'FaZe Clan, PARIVISION',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, B8, Legacy, Fnatic, FlyQuest',
    1,
    '2025-11-11 21:42:52',
    'stage1',
    'MATYS'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    100,
    'js_0_0_',
    '874671251459833876',
    'Ninjas in Pyjamas, FaZe Clan',
    'The Huns Esports, Fluxo',
    'GamerLegion, Lynn Vision Gaming, Legacy, B8, Fnatic, M80',
    0,
    '2025-11-11 21:48:46',
    'stage1',
    '--js'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    101,
    'nekutv',
    '723588449151746050',
    'FaZe Clan, GamerLegion',
    'The Huns Esports, Fluxo',
    'B8, Ninjas in Pyjamas, Legacy, Lynn Vision Gaming, M80, PARIVISION',
    0,
    '2025-11-11 21:48:49',
    'stage1',
    'Neku'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    102,
    'nascior',
    '1125496542263001209',
    'Ninjas in Pyjamas, PARIVISION',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, B8, Fnatic, Legacy, FlyQuest',
    1,
    '2025-11-11 22:21:46',
    'stage1',
    'pierog'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    103,
    'danio0991',
    '1284104872358182964',
    'FaZe Clan, GamerLegion',
    'The Huns Esports, RED Canids',
    'B8, Legacy, M80, PARIVISION, Ninjas in Pyjamas, FlyQuest',
    0,
    '2025-11-11 23:20:16',
    'stage1',
    'Danio'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    104,
    'rzodkiew6590',
    '673482391322361888',
    'PARIVISION, Legacy',
    'RED Canids, Rare Atom',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, B8, Lynn Vision Gaming, FlyQuest',
    0,
    '2025-11-12 00:38:10',
    'stage1',
    'rzodkiew'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    106,
    'gila.pl',
    '1181560396121907252',
    'FaZe Clan, Ninjas in Pyjamas',
    'NRG, RED Canids',
    'GamerLegion, B8, Fnatic, Legacy, PARIVISION, Lynn Vision Gaming',
    0,
    '2025-11-12 09:04:17',
    'stage1',
    'świąteczny gila'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    107,
    'dorkej',
    '646804591853436946',
    'FaZe Clan, Ninjas in Pyjamas',
    'The Huns Esports, RED Canids',
    'GamerLegion, B8, Legacy, M80, Fluxo, Fnatic',
    0,
    '2025-11-12 09:22:08',
    'stage1',
    'Dorkej'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    108,
    'skyshafiq',
    '882519104316137502',
    'FaZe Clan, GamerLegion',
    'RED Canids, Fluxo',
    'B8, Legacy, Ninjas in Pyjamas, M80, Fnatic, Imperial',
    0,
    '2025-11-12 10:48:29',
    'stage1',
    'Sky Shafiq'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    109,
    'karbon88',
    '354595339069554688',
    'Fnatic, Legacy',
    'Fluxo, Rare Atom',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Lynn Vision Gaming',
    0,
    '2025-11-12 10:53:49',
    'stage1',
    'Karbon'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    110,
    'szaku000',
    '1432349282580566089',
    'PARIVISION, GamerLegion',
    'The Huns Esports, RED Canids',
    'Ninjas in Pyjamas, FaZe Clan, Lynn Vision Gaming, B8, FlyQuest, Legacy',
    1,
    '2025-11-12 13:21:30',
    'stage1',
    'Szaku'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    111,
    'thommyy5212',
    '535251994831618076',
    'Legacy, B8',
    'Rare Atom, RED Canids',
    'Ninjas in Pyjamas, GamerLegion, FaZe Clan, Fnatic, Lynn Vision Gaming, FlyQuest',
    0,
    '2025-11-12 14:39:09',
    'stage1',
    'Toomixx'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    112,
    'mrmarty.pl_87228',
    '1145386101264109669',
    'B8, Legacy',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, PARIVISION, Fnatic, Lynn Vision Gaming',
    0,
    '2025-11-12 15:00:05',
    'stage1',
    'Mr Marty'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    113,
    'xczaro0',
    '723447196388819014',
    'PARIVISION, Legacy',
    'The Huns Esports, Fluxo',
    'GamerLegion, Ninjas in Pyjamas, B8, FaZe Clan, Lynn Vision Gaming, M80',
    0,
    '2025-11-12 15:23:55',
    'stage1',
    'XcZaRo'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    115,
    '_kubakoz',
    '1124240992380395550',
    'Legacy, FaZe Clan',
    'Rare Atom, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Lynn Vision Gaming, Imperial',
    0,
    '2025-11-12 16:51:51',
    'stage1',
    'kuba koz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    116,
    'fluxis72',
    '531537178208239626',
    'FaZe Clan, Ninjas in Pyjamas',
    'Rare Atom, Imperial',
    'B8, Fnatic, Legacy, Fluxo, GamerLegion, FlyQuest',
    0,
    '2025-11-12 17:00:16',
    'stage1',
    'Fluxis72'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    117,
    'adin7973',
    '626490238914527263',
    'FaZe Clan, PARIVISION',
    'NRG, The Huns Esports',
    'GamerLegion, Imperial, Lynn Vision Gaming, Ninjas in Pyjamas, Fluxo, Fnatic',
    0,
    '2025-11-12 17:08:22',
    'stage1',
    'Adin'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    118,
    'ml1ody',
    '713930835396657242',
    'B8, Legacy',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Fnatic, M80, FlyQuest',
    0,
    '2025-11-12 17:11:11',
    'stage1',
    'zdradzam zone'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    119,
    'fabi_gs',
    '589103946921148446',
    'Legacy, B8',
    'Rare Atom, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Lynn Vision Gaming, FlyQuest, PARIVISION',
    0,
    '2025-11-12 17:15:04',
    'stage1',
    'FaBi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    120,
    'gargamel00950',
    '1105164852810502235',
    'Legacy, FaZe Clan',
    'Fluxo, The Huns Esports',
    'GamerLegion, B8, PARIVISION, Lynn Vision Gaming, FlyQuest, Ninjas in Pyjamas',
    0,
    '2025-11-12 17:16:44',
    'stage1',
    'swezyy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    121,
    'grubycoach',
    '435779589864816640',
    'PARIVISION, FaZe Clan',
    'Rare Atom, RED Canids',
    'Ninjas in Pyjamas, GamerLegion, B8, Lynn Vision Gaming, FlyQuest, Legacy',
    1,
    '2025-11-12 17:36:07',
    'stage1',
    'Grubycoach'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    122,
    'arcad1o',
    '709443415120543824',
    'FaZe Clan, Legacy',
    'The Huns Esports, RED Canids',
    'GamerLegion, FlyQuest, Ninjas in Pyjamas, M80, B8, Lynn Vision Gaming',
    1,
    '2025-11-12 18:35:23',
    'stage1',
    'arcad1o'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    123,
    'fnxxx1337',
    '460126239173378069',
    'Legacy, PARIVISION',
    'RED Canids, Rare Atom',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Fluxo, FlyQuest, Fnatic',
    0,
    '2025-11-12 21:39:13',
    'stage1',
    'FNXXX-'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    124,
    'geeciu_es',
    '823526692189634580',
    'GamerLegion, Legacy',
    'RED Canids, Fluxo',
    'B8, Ninjas in Pyjamas, FaZe Clan, Fnatic, Lynn Vision Gaming, M80',
    0,
    '2025-11-12 23:14:46',
    'stage1',
    'geeciu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    125,
    '.marcineq',
    '478486060943540225',
    'FaZe Clan, Legacy',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Fnatic, Lynn Vision Gaming',
    1,
    '2025-11-12 23:33:13',
    'stage1',
    'Marcineq'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    126,
    'plomerr',
    '660483416554209313',
    'B8, FaZe Clan',
    'Imperial, Rare Atom',
    'GamerLegion, Legacy, Lynn Vision Gaming, Fnatic, PARIVISION, M80',
    0,
    '2025-11-12 23:53:48',
    'stage1',
    'plomerr'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    127,
    'wojnowski_24',
    '672468108388073504',
    'PARIVISION, Legacy',
    'RED Canids, Fluxo',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, M80, Lynn Vision Gaming, B8',
    0,
    '2025-11-12 23:58:14',
    'stage1',
    'Kamień'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    128,
    '.metyl.',
    '801164867457253406',
    'Fnatic, M80',
    'Fluxo, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, Legacy, FaZe Clan, Lynn Vision Gaming, B8',
    0,
    '2025-11-13 05:27:07',
    'stage1',
    '☢?????☢'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    129,
    'zlamikos',
    '352080834934865920',
    'B8, Legacy',
    'The Huns Esports, RED Canids',
    'FlyQuest, Fnatic, PARIVISION, Ninjas in Pyjamas, GamerLegion, FaZe Clan',
    0,
    '2025-11-13 06:01:45',
    'stage1',
    'Zlamikos'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    130,
    'prezesinioo',
    '968919031283322931',
    'FaZe Clan, Legacy',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Lynn Vision Gaming, M80',
    0,
    '2025-11-13 08:48:57',
    'stage1',
    'Prezes'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    131,
    'radoz555_',
    '593779620558536740',
    'B8, Legacy',
    'Rare Atom, The Huns Esports',
    'Fnatic, Lynn Vision Gaming, Imperial, FaZe Clan, Ninjas in Pyjamas, GamerLegion',
    0,
    '2025-11-13 09:27:20',
    'stage1',
    'Radoz555'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    132,
    'stanleyek71',
    '1158820143397339146',
    'B8, Legacy',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, PARIVISION, Lynn Vision Gaming, FlyQuest',
    0,
    '2025-11-13 10:06:20',
    'stage1',
    'stan1eyek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    134,
    'olifasoli2014',
    '654314799840362498',
    'GamerLegion, Legacy',
    'RED Canids, The Huns Esports',
    'FaZe Clan, B8, Ninjas in Pyjamas, PARIVISION, NRG, FlyQuest',
    0,
    '2025-11-13 11:47:44',
    'stage1',
    'olifasoli2014'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    136,
    'smon_15',
    '1143283014634319994',
    'Ninjas in Pyjamas, Legacy',
    'Rare Atom, RED Canids',
    'FaZe Clan, GamerLegion, B8, Lynn Vision Gaming, FlyQuest, Imperial',
    0,
    '2025-11-13 14:20:33',
    'stage1',
    'Szymon McDonald’s'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    138,
    'monczall',
    '419278999991353374',
    'GamerLegion, B8',
    'Rare Atom, RED Canids',
    'Fnatic, Ninjas in Pyjamas, Lynn Vision Gaming, FaZe Clan, Fluxo, FlyQuest',
    0,
    '2025-11-13 16:10:52',
    'stage1',
    'Monczall'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    139,
    'krzyhus212',
    '749701801304916020',
    'GamerLegion, Legacy',
    'RED Canids, Fluxo',
    'FaZe Clan, Ninjas in Pyjamas, B8, Fnatic, FlyQuest, M80',
    0,
    '2025-11-13 16:18:28',
    'stage1',
    'Krzyhus212'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    140,
    'timing_3',
    '1176928936853254166',
    'Legacy, B8',
    'Fluxo, Rare Atom',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Fnatic, Imperial, FlyQuest',
    0,
    '2025-11-13 16:37:02',
    'stage1',
    'Uriel'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    141,
    'jotuu',
    '444578457309937664',
    'Ninjas in Pyjamas, Legacy',
    'The Huns Esports, Rare Atom',
    'FaZe Clan, B8, Fnatic, M80, Lynn Vision Gaming, GamerLegion',
    0,
    '2025-11-13 17:48:41',
    'stage1',
    'jotu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    142,
    'zysio',
    '762270778754203688',
    'PARIVISION, Legacy',
    'NRG, The Huns Esports',
    'GamerLegion, FaZe Clan, M80, Lynn Vision Gaming, FlyQuest, B8',
    1,
    '2025-11-13 18:05:02',
    'stage1',
    'zysio'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    143,
    'avatariroh1',
    '1245802397645934682',
    'FaZe Clan, Legacy',
    'The Huns Esports, RED Canids',
    'M80, PARIVISION, B8, Ninjas in Pyjamas, GamerLegion, Lynn Vision Gaming',
    0,
    '2025-11-13 18:05:31',
    'stage1',
    'lunargondolier22'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    145,
    'horizonhowl',
    '365908036381835266',
    'FaZe Clan, Lynn Vision Gaming',
    'PARIVISION, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, FlyQuest, Rare Atom, Fnatic, NRG',
    0,
    '2025-11-13 18:05:56',
    'stage1',
    'Horizon Howl'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    146,
    '.j4k0b_',
    '340841216507904001',
    'Legacy, FaZe Clan',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Lynn Vision Gaming, FlyQuest',
    0,
    '2025-11-13 18:11:47',
    'stage1',
    'CwelulozaOwner'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    147,
    'nix_6497',
    '779804152976375828',
    'FaZe Clan, GamerLegion',
    'Rare Atom, RED Canids',
    'Ninjas in Pyjamas, B8, Legacy, PARIVISION, M80, Lynn Vision Gaming',
    0,
    '2025-11-13 18:21:03',
    'stage1',
    'Nix_ℵ'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    148,
    'kurczacze',
    '936390831580008539',
    'FaZe Clan, Legacy',
    'Rare Atom, RED Canids',
    'Ninjas in Pyjamas, Fnatic, M80, GamerLegion, Lynn Vision Gaming, PARIVISION',
    0,
    '2025-11-13 18:21:19',
    'stage1',
    'kurczaczek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    149,
    'jajoglowy_',
    '423913069727580162',
    'Ninjas in Pyjamas, M80',
    'Rare Atom, Imperial',
    'GamerLegion, B8, Fnatic, Lynn Vision Gaming, Legacy, PARIVISION',
    0,
    '2025-11-13 18:29:59',
    'stage1',
    'Jajogłowy_'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    150,
    'swiera',
    '691707080234500157',
    'GamerLegion, FaZe Clan',
    'Rare Atom, Fluxo',
    'Ninjas in Pyjamas, B8, PARIVISION, The Huns Esports, Fnatic, Legacy',
    0,
    '2025-11-13 18:51:33',
    'stage1',
    'Swiera'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    151,
    'tiffanylfc',
    '428560867588833281',
    'FaZe Clan, FlyQuest',
    'NRG, Rare Atom',
    'Fnatic, Legacy, M80, GamerLegion, Ninjas in Pyjamas, Lynn Vision Gaming',
    0,
    '2025-11-13 20:17:46',
    'stage1',
    'TiffanyLFC'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    152,
    'didek0188',
    '419405937728684032',
    'FaZe Clan, Legacy',
    'RED Canids, Fluxo',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Imperial, Lynn Vision Gaming, FlyQuest',
    0,
    '2025-11-13 20:27:07',
    'stage1',
    'didek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    153,
    'burak1668',
    '836571369898115115',
    'FaZe Clan, Legacy',
    'RED Canids, The Huns Esports',
    'GamerLegion, M80, Ninjas in Pyjamas, Fnatic, PARIVISION, B8',
    0,
    '2025-11-13 20:59:12',
    'stage1',
    'Still Water'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    154,
    'ote1337',
    '512637204821049346',
    'B8, Legacy',
    'The Huns Esports, Rare Atom',
    'FaZe Clan, GamerLegion, FlyQuest, PARIVISION, Ninjas in Pyjamas, Lynn Vision Gaming',
    0,
    '2025-11-13 21:00:01',
    'stage1',
    'Ote'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    155,
    'sztawo17',
    '845924406436954152',
    'FaZe Clan, Fnatic',
    'NRG, Fluxo',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Legacy, Lynn Vision Gaming',
    0,
    '2025-11-13 22:34:18',
    'stage1',
    'sztawo17'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    156,
    'mjkaelo',
    '498152549451563009',
    'GamerLegion, PARIVISION',
    'RED Canids, The Huns Esports',
    'FaZe Clan, Ninjas in Pyjamas, Legacy, M80, Fnatic, B8',
    0,
    '2025-11-13 23:33:39',
    'stage1',
    'mjkaelo'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    157,
    'maciek0357',
    '691432428232900709',
    'PARIVISION, Legacy',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, B8, FlyQuest, Lynn Vision Gaming',
    0,
    '2025-11-13 23:42:17',
    'stage1',
    'macidk12'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    158,
    'pietruciu',
    '729313277410279455',
    'FaZe Clan, GamerLegion',
    'The Huns Esports, M80',
    'B8, Imperial, Legacy, FlyQuest, Ninjas in Pyjamas, PARIVISION',
    0,
    '2025-11-14 06:45:50',
    'stage1',
    'pietruciu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    159,
    'iggssk',
    '463234527850921985',
    'Ninjas in Pyjamas, Legacy',
    'The Huns Esports, Rare Atom',
    'FaZe Clan, GamerLegion, Fnatic, B8, M80, Lynn Vision Gaming',
    0,
    '2025-11-14 10:34:35',
    'stage1',
    'Igssk'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    160,
    'mrnaibaff',
    '1288929189465952280',
    'FaZe Clan, GamerLegion',
    'The Huns Esports, Rare Atom',
    'Ninjas in Pyjamas, B8, Fnatic, Legacy, Imperial, M80',
    0,
    '2025-11-14 12:38:35',
    'stage1',
    'MrNaibaff'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    162,
    'ggaluszka1337',
    '1379502507323162626',
    'FaZe Clan, Legacy',
    'Rare Atom, The Huns Esports',
    'B8, Ninjas in Pyjamas, GamerLegion, PARIVISION, Fnatic, Lynn Vision Gaming',
    0,
    '2025-11-14 13:28:21',
    'stage1',
    'Galuszka1337'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    164,
    'xseti_',
    '1078726241680633857',
    'Ninjas in Pyjamas, B8',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, PARIVISION, Fnatic, Legacy, Lynn Vision Gaming',
    0,
    '2025-11-14 15:18:02',
    'stage1',
    'xSetiツ_'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    165,
    'elwiewiur',
    '722027729158930435',
    'Legacy, B8',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, PARIVISION, Fnatic, Lynn Vision Gaming',
    1,
    '2025-11-14 16:21:41',
    'stage1',
    'szymonek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    168,
    'maj0rek0',
    '1054079373789110342',
    'FaZe Clan, Legacy',
    'Rare Atom, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, NRG, FlyQuest, PARIVISION, B8',
    0,
    '2025-11-15 03:18:20',
    'stage1',
    'maj0rek0'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    169,
    'savi0x',
    '627115371878416385',
    'GamerLegion, Legacy',
    'The Huns Esports, RED Canids',
    'FaZe Clan, Ninjas in Pyjamas, PARIVISION, Lynn Vision Gaming, Fnatic, B8',
    1,
    '2025-11-15 05:26:47',
    'stage1',
    'Savi0X'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    170,
    'majkutini',
    '1219387685425254441',
    'GamerLegion, Legacy',
    'Fluxo, The Huns Esports',
    'Ninjas in Pyjamas, B8, PARIVISION, FaZe Clan, Lynn Vision Gaming, M80',
    1,
    '2025-11-15 06:00:47',
    'stage1',
    '! Мajkutini'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    172,
    'tasmann.',
    '1024338511001821185',
    'FaZe Clan, Legacy',
    'RED Canids, Rare Atom',
    'GamerLegion, Ninjas in Pyjamas, B8, Fnatic, Imperial, Lynn Vision Gaming',
    0,
    '2025-11-15 12:26:07',
    'stage1',
    'Tasman'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    173,
    'mamwww',
    '696670794587177020',
    'FaZe Clan, PARIVISION',
    'The Huns Esports, Fluxo',
    'B8, Legacy, Imperial, NRG, FlyQuest, GamerLegion',
    0,
    '2025-11-15 12:36:15',
    'stage1',
    'm'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    174,
    'hap3rr',
    '516697873497456655',
    'FaZe Clan, GamerLegion',
    'The Huns Esports, RED Canids',
    'Ninjas in Pyjamas, B8, PARIVISION, Fnatic, Legacy, FlyQuest',
    0,
    '2025-11-15 14:44:58',
    'stage1',
    'hap3r'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    175,
    '082byd7u2vd72',
    '227190937409945601',
    'Legacy, GamerLegion',
    'Rare Atom, The Huns Esports',
    'FaZe Clan, Ninjas in Pyjamas, B8, PARIVISION, M80, Fnatic',
    0,
    '2025-11-15 15:40:37',
    'stage1',
    '082byd7u2'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    176,
    'monte_snack',
    '723493354918379533',
    'Legacy, GamerLegion',
    'RED Canids, Rare Atom',
    'FaZe Clan, Ninjas in Pyjamas, PARIVISION, Fnatic, FlyQuest, M80',
    0,
    '2025-11-15 16:03:39',
    'stage1',
    'Monte'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    177,
    'questrianek',
    '759697317263310889',
    'Legacy, GamerLegion',
    'RED Canids, Rare Atom',
    'FaZe Clan, Ninjas in Pyjamas, PARIVISION, M80, FlyQuest, Lynn Vision Gaming',
    0,
    '2025-11-15 16:34:09',
    'stage1',
    'questrian'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    178,
    'michu2326',
    '288364271153184768',
    'FaZe Clan, Fnatic',
    'RED Canids, Fluxo',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Legacy, Imperial',
    0,
    '2025-11-15 18:48:20',
    'stage1',
    'Michu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    179,
    'bolotv',
    '693547426212216892',
    'FaZe Clan, B8',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Fnatic, Legacy, M80',
    0,
    '2025-11-15 19:27:44',
    'stage1',
    'BoloTv'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    181,
    '4fire2alpaca0',
    '581860728240340992',
    'Legacy, M80',
    'The Huns Esports, Rare Atom',
    'FaZe Clan, GamerLegion, PARIVISION, Fnatic, B8, Fluxo',
    0,
    '2025-11-15 19:53:46',
    'stage1',
    'DAMN1ggy_'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    182,
    'banderas4200',
    '228173160355332097',
    'Legacy, B8',
    'NRG, RED Canids',
    'FaZe Clan, GamerLegion, Lynn Vision Gaming, Ninjas in Pyjamas, PARIVISION, Fluxo',
    0,
    '2025-11-15 21:00:18',
    'stage1',
    'Banderas'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    183,
    'ramirezkks',
    '406902151529627649',
    'FaZe Clan, Legacy',
    'NRG, RED Canids',
    'Lynn Vision Gaming, Fnatic, GamerLegion, Ninjas in Pyjamas, B8, PARIVISION',
    0,
    '2025-11-15 21:18:45',
    'stage1',
    'RamirezKKS'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    184,
    'chedzik',
    '522505047116873738',
    'Legacy, Imperial',
    'RED Canids, Rare Atom',
    'Ninjas in Pyjamas, GamerLegion, FaZe Clan, B8, PARIVISION, Lynn Vision Gaming',
    0,
    '2025-11-15 21:43:15',
    'stage1',
    'chedzik'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    185,
    'maseski',
    '968138010371694632',
    'FaZe Clan, GamerLegion',
    'Fnatic, B8',
    'Imperial, Legacy, Ninjas in Pyjamas, FlyQuest, Lynn Vision Gaming, Fluxo',
    0,
    '2025-11-15 21:48:36',
    'stage1',
    '꧁???????꧂'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    186,
    'skrxpczak',
    '642419697072996372',
    'Legacy, Ninjas in Pyjamas',
    'Fnatic, Imperial',
    'FaZe Clan, GamerLegion, B8, Lynn Vision Gaming, The Huns Esports, FlyQuest',
    0,
    '2025-11-16 01:19:23',
    'stage1',
    'riczi777'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    187,
    'slomczyn',
    '415969455412215818',
    'Ninjas in Pyjamas, B8',
    'RED Canids, Rare Atom',
    'FaZe Clan, GamerLegion, PARIVISION, Fnatic, Legacy, M80',
    0,
    '2025-11-16 07:45:48',
    'stage1',
    'Slomczyn'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    189,
    'tonypie_',
    '651126587621900289',
    'FaZe Clan, Legacy',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Fnatic, Imperial',
    0,
    '2025-11-16 10:24:22',
    'stage1',
    'tonypie'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    191,
    'zenekdb9',
    '312633551466135553',
    'FaZe Clan, Legacy',
    'RED Canids, Rare Atom',
    'GamerLegion, B8, PARIVISION, Fnatic, Lynn Vision Gaming, FlyQuest',
    0,
    '2025-11-16 11:09:02',
    'stage1',
    'ZenSoul'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    194,
    'fiejuu',
    '1172505884782497853',
    'B8, Legacy',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, NRG, PARIVISION, Lynn Vision Gaming, FlyQuest',
    0,
    '2025-11-16 11:51:36',
    'stage1',
    'fiejuu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    195,
    'xmrpandax',
    '351394837645492226',
    'FaZe Clan, PARIVISION',
    'RED Canids, The Huns Esports',
    'GamerLegion, B8, Lynn Vision Gaming, Ninjas in Pyjamas, Legacy, FlyQuest',
    0,
    '2025-11-16 12:00:02',
    'stage1',
    'MrPanda'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    196,
    'kubi1133',
    '519586946176253952',
    'FaZe Clan, B8',
    'Rare Atom, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Fnatic, Legacy, FlyQuest',
    0,
    '2025-11-16 12:12:07',
    'stage1',
    'ҜuBi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    198,
    'bombix777',
    '1145443406638751815',
    'M80, Legacy',
    'RED Canids, Rare Atom',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, B8, Fnatic, Lynn Vision Gaming',
    0,
    '2025-11-16 13:33:17',
    'stage1',
    'bombix'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    199,
    'k1ksl',
    '386495286563962880',
    'B8, Legacy',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Fnatic, PARIVISION, Lynn Vision Gaming',
    1,
    '2025-11-16 14:00:36',
    'stage1',
    'KSL'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    200,
    'bodzix_',
    '499568655508570119',
    'FaZe Clan, GamerLegion',
    'RED Canids, The Huns Esports',
    'Ninjas in Pyjamas, B8, PARIVISION, Fnatic, Legacy, FlyQuest',
    0,
    '2025-11-16 14:02:27',
    'stage1',
    'bodzix'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    201,
    'pieknyimlody',
    '456088997827969024',
    'FaZe Clan, GamerLegion',
    'The Huns Esports, RED Canids',
    'Ninjas in Pyjamas, B8, Fnatic, Imperial, FlyQuest, Lynn Vision Gaming',
    0,
    '2025-11-16 14:23:48',
    'stage1',
    'bezbożnik'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    203,
    'm1szolek',
    '583629902834827276',
    'FaZe Clan, PARIVISION',
    'Fluxo, Rare Atom',
    'M80, B8, GamerLegion, Legacy, Ninjas in Pyjamas, Imperial',
    0,
    '2025-11-16 14:38:49',
    'stage1',
    'Miszol'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    204,
    'sebaziomek',
    '555800660357021696',
    'GamerLegion, RED Canids',
    'PARIVISION, Imperial',
    'FaZe Clan, NRG, M80, Lynn Vision Gaming, FlyQuest, Legacy',
    0,
    '2025-11-16 16:09:32',
    'stage1',
    'Тотя ❤'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    205,
    'pbialy123',
    '320224049760567296',
    'PARIVISION, Legacy',
    'Rare Atom, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, B8, Lynn Vision Gaming, FlyQuest',
    0,
    '2025-11-16 16:30:45',
    'stage1',
    'pbialy123'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    206,
    'gajtan_bb',
    '668913702510002179',
    'FaZe Clan, B8',
    'RED Canids, Rare Atom',
    'GamerLegion, PARIVISION, Fnatic, Legacy, FlyQuest, Lynn Vision Gaming',
    0,
    '2025-11-16 17:10:04',
    'stage1',
    'Gajtan'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    207,
    'dawid_5085',
    '806479768366874664',
    'FaZe Clan, Legacy',
    'The Huns Esports, RED Canids',
    'B8, GamerLegion, PARIVISION, Fnatic, Lynn Vision Gaming, FlyQuest',
    0,
    '2025-11-16 17:36:44',
    'stage1',
    'Rogalツ'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    208,
    'poprostukoko',
    '924710423100522506',
    'FaZe Clan, Legacy',
    'RED Canids, The Huns Esports',
    'GamerLegion, B8, PARIVISION, Fnatic, FlyQuest, Lynn Vision Gaming',
    0,
    '2025-11-16 18:08:15',
    'stage1',
    'poprostu koko'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    210,
    'fazer85',
    '333906708336476170',
    'Legacy, B8',
    'Rare Atom, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, FlyQuest, Fnatic, PARIVISION',
    0,
    '2025-11-16 19:30:26',
    'stage1',
    'Fazer*'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    211,
    'feranxd',
    '1337893397721251894',
    'PARIVISION, Legacy',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, FlyQuest, Lynn Vision Gaming, B8',
    1,
    '2025-11-16 20:02:13',
    'stage1',
    'Feran'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    212,
    'w1xiuu',
    '1275474919848804506',
    'FaZe Clan, Legacy',
    'RED Canids, The Huns Esports',
    'Ninjas in Pyjamas, GamerLegion, B8, Fnatic, Imperial, FlyQuest',
    0,
    '2025-11-16 20:52:31',
    'stage1',
    'W1xiUu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    213,
    'ortionv2',
    '1279804882445930609',
    'FaZe Clan, PARIVISION',
    'The Huns Esports, Fluxo',
    'GamerLegion, Ninjas in Pyjamas, B8, Legacy, Fnatic, FlyQuest',
    0,
    '2025-11-16 23:11:35',
    'stage1',
    '<O®T¡0n'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    214,
    '_razyy',
    '1037766729775984680',
    'FaZe Clan, Legacy',
    'RED Canids, Rare Atom',
    'GamerLegion, B8, Fnatic, NRG, Lynn Vision Gaming, FlyQuest',
    0,
    '2025-11-17 00:32:37',
    'stage1',
    '_razyy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    215,
    'ub_0006',
    '1168565235817398431',
    'FaZe Clan, Legacy',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, B8, FlyQuest, Imperial',
    0,
    '2025-11-17 01:29:11',
    'stage1',
    'ahcyd'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    216,
    'k3l0x2',
    '1056295328007069727',
    'Legacy, FaZe Clan',
    'RED Canids, Fluxo',
    'Ninjas in Pyjamas, B8, GamerLegion, PARIVISION, M80, Imperial',
    0,
    '2025-11-17 02:24:50',
    'stage1',
    'Mr. Headshot'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    217,
    'cheems0757',
    '589923037449814052',
    'Legacy, B8',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Lynn Vision Gaming, M80, Fnatic',
    0,
    '2025-11-17 03:59:05',
    'stage1',
    'cheems'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    219,
    'buldogun_94238',
    '1284075325042724900',
    'B8, FaZe Clan',
    'The Huns Esports, RED Canids',
    'Ninjas in Pyjamas, PARIVISION, GamerLegion, Legacy, Fnatic, Lynn Vision Gaming',
    1,
    '2025-11-17 07:03:18',
    'stage1',
    'Buldogun'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    220,
    '_prosik_5678_',
    '779402540755976192',
    'Legacy, PARIVISION',
    'The Huns Esports, NRG',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, B8, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-17 07:56:25',
    'stage1',
    '_prosik_5678_'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    221,
    'lizu3',
    '484699137418199041',
    'B8, FaZe Clan',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, Fnatic, M80, FlyQuest, Legacy',
    0,
    '2025-11-17 10:24:28',
    'stage1',
    'Lizu<3'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    223,
    'unboxing_',
    '630393151038685186',
    'PARIVISION, B8',
    'RED Canids, Fluxo',
    'Ninjas in Pyjamas, GamerLegion, FaZe Clan, Fnatic, Legacy, FlyQuest',
    0,
    '2025-11-17 13:23:40',
    'stage1',
    'Unboxing'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    224,
    'xkuba6969',
    '486957798207258635',
    'FaZe Clan, B8',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Fnatic, Legacy, Lynn Vision Gaming',
    0,
    '2025-11-17 13:45:44',
    'stage1',
    'Kuba'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    226,
    'tyrekk',
    '414528693386608640',
    'Ninjas in Pyjamas, Legacy',
    'RED Canids, Rare Atom',
    'FaZe Clan, GamerLegion, Lynn Vision Gaming, FlyQuest, M80, B8',
    0,
    '2025-11-17 14:44:54',
    'stage1',
    'Tyrek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    227,
    'fas0lka_',
    '1344602384546140230',
    'FaZe Clan, Legacy',
    'RED Canids, The Huns Esports',
    'GamerLegion, B8, PARIVISION, Fnatic, Lynn Vision Gaming, Ninjas in Pyjamas',
    0,
    '2025-11-17 14:54:35',
    'stage1',
    'Brother Will'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    228,
    'stasiumadafak',
    '1077357796762337331',
    'FaZe Clan, Legacy',
    'PARIVISION, Rare Atom',
    'GamerLegion, B8, Lynn Vision Gaming, FlyQuest, M80, Ninjas in Pyjamas',
    0,
    '2025-11-17 15:23:55',
    'stage1',
    'StasiuMadaFak'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    230,
    '_bartek.',
    '358544128310509579',
    'FaZe Clan, Legacy',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Fnatic, Imperial',
    0,
    '2025-11-17 17:03:50',
    'stage1',
    'bartek.'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    232,
    'dmpb',
    '512348961080737804',
    'FaZe Clan, M80',
    'Rare Atom, The Huns Esports',
    'GamerLegion, B8, Ninjas in Pyjamas, PARIVISION, Legacy, FlyQuest',
    0,
    '2025-11-17 17:06:55',
    'stage1',
    'DMPB'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    233,
    'hunngry_',
    '590502881577402378',
    'GamerLegion, Legacy',
    'Rare Atom, RED Canids',
    'FaZe Clan, Ninjas in Pyjamas, PARIVISION, B8, Fnatic, FlyQuest',
    0,
    '2025-11-17 17:11:37',
    'stage1',
    'Hungry'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    236,
    'm9jkol',
    '1276633433166188544',
    'B8, Legacy',
    'Fluxo, NRG',
    'FaZe Clan, GamerLegion, Lynn Vision Gaming, Ninjas in Pyjamas, FlyQuest, Fnatic',
    0,
    '2025-11-17 17:19:00',
    'stage1',
    'M9JKOL'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    237,
    'czipsol',
    '383712116005404675',
    'B8, Legacy',
    'Rare Atom, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, PARIVISION, Fnatic, FlyQuest',
    0,
    '2025-11-17 17:27:57',
    'stage1',
    'czipsol'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    238,
    'dzoszula_the_duck',
    '726004253159587840',
    'FaZe Clan, Legacy',
    'RED Canids, Fluxo',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, FlyQuest, Lynn Vision Gaming',
    0,
    '2025-11-17 17:30:51',
    'stage1',
    'Józek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    239,
    'michazwon',
    '983748525798084628',
    'B8, Legacy',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Fnatic, FlyQuest, Lynn Vision Gaming',
    0,
    '2025-11-17 17:36:23',
    'stage1',
    '.michazwon'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    240,
    'sokul_',
    '577515635110576128',
    'FaZe Clan, PARIVISION',
    'NRG, The Huns Esports',
    'B8, Legacy, Ninjas in Pyjamas, GamerLegion, FlyQuest, M80',
    0,
    '2025-11-17 17:40:50',
    'stage1',
    'Sokul'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    241,
    'luxor_.',
    '322812891956903937',
    'FaZe Clan, Legacy',
    'Rare Atom, The Huns Esports',
    'GamerLegion, B8, Fnatic, M80, NRG, PARIVISION',
    0,
    '2025-11-17 17:44:59',
    'stage1',
    'Luxor'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    246,
    'powleye',
    '351509313438613504',
    'FaZe Clan, Fnatic',
    'The Huns Esports, RED Canids',
    'Legacy, FlyQuest, Lynn Vision Gaming, B8, GamerLegion, Ninjas in Pyjamas',
    1,
    '2025-11-17 18:55:57',
    'stage1',
    'powleye'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    247,
    'gerard110',
    '1237435641541951681',
    'B8, Legacy',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Fnatic, M80, Lynn Vision Gaming',
    1,
    '2025-11-17 19:25:45',
    'stage1',
    'Gerard'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    248,
    'antonisss878',
    '1283815621829857341',
    'FaZe Clan, GamerLegion',
    'RED Canids, The Huns Esports',
    'Ninjas in Pyjamas, PARIVISION, B8, Fnatic, Legacy, Lynn Vision Gaming',
    1,
    '2025-11-17 19:26:01',
    'stage1',
    'Antonisss878'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    249,
    '_kml777',
    '896147575093198958',
    'B8, Fnatic',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, PARIVISION, Legacy, M80, Lynn Vision Gaming',
    1,
    '2025-11-17 19:26:10',
    'stage1',
    'KmL'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    250,
    'pastor7393',
    '518331730688475136',
    'FaZe Clan, Ninjas in Pyjamas',
    'RED Canids, The Huns Esports',
    'GamerLegion, B8, PARIVISION, Lynn Vision Gaming, FlyQuest, Legacy',
    1,
    '2025-11-17 19:26:14',
    'stage1',
    'Pastor'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    251,
    'dudinov._06906',
    '1206571061471350805',
    'FaZe Clan, Legacy',
    'Fnatic, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, FlyQuest, PARIVISION, Lynn Vision Gaming',
    1,
    '2025-11-17 19:26:16',
    'stage1',
    'DUDI'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    252,
    'franix882',
    '913842521266868284',
    'Legacy, GamerLegion',
    'Fluxo, The Huns Esports',
    'FaZe Clan, B8, PARIVISION, Lynn Vision Gaming, Ninjas in Pyjamas, Imperial',
    1,
    '2025-11-17 19:26:18',
    'stage1',
    'franix'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    253,
    'odklejus_',
    '967798809738510366',
    'FaZe Clan, Legacy',
    'The Huns Esports, Fluxo',
    'Ninjas in Pyjamas, GamerLegion, B8, PARIVISION, Fnatic, Lynn Vision Gaming',
    1,
    '2025-11-17 19:26:33',
    'stage1',
    'Odklejus'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    254,
    'wosa1y',
    '963831255038828584',
    'FaZe Clan, PARIVISION',
    'The Huns Esports, RED Canids',
    'FlyQuest, GamerLegion, Ninjas in Pyjamas, B8, Legacy, M80',
    1,
    '2025-11-17 19:26:38',
    'stage1',
    'wosa1y'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    255,
    'hubbeert',
    '565093490472517632',
    'FaZe Clan, B8',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Legacy, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-17 19:26:57',
    'stage1',
    'Dziombekk'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    256,
    'tonka0111',
    '403141730335064075',
    'Legacy, B8',
    'RED Canids, Rare Atom',
    'FaZe Clan, GamerLegion, PARIVISION, Lynn Vision Gaming, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-17 19:28:37',
    'stage1',
    'Tonka'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    257,
    'venvigo_',
    '1364996865782972448',
    'Fnatic, PARIVISION',
    'NRG, B8',
    'FaZe Clan, Ninjas in Pyjamas, Lynn Vision Gaming, Legacy, GamerLegion, Imperial',
    1,
    '2025-11-17 19:29:21',
    'stage1',
    'Venvigo_'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    258,
    'wikimiki22',
    '423163600610394122',
    'PARIVISION, FaZe Clan',
    'RED Canids, M80',
    'Ninjas in Pyjamas, GamerLegion, Fnatic, FlyQuest, Legacy, B8',
    1,
    '2025-11-17 19:29:39',
    'stage1',
    'andrzej'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    259,
    'wiqus2301',
    '1239260951346286635',
    'Fnatic, Imperial',
    'NRG, Lynn Vision Gaming',
    'GamerLegion, FaZe Clan, Legacy, B8, M80, Fluxo',
    1,
    '2025-11-17 19:30:06',
    'stage1',
    'Wiqus'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    260,
    'bleyzzz',
    '387340409006850050',
    'FaZe Clan, B8',
    'RED Canids, The Huns Esports',
    'Ninjas in Pyjamas, PARIVISION, Legacy, Lynn Vision Gaming, FlyQuest, GamerLegion',
    1,
    '2025-11-17 19:30:55',
    'stage1',
    'bleyz__'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    261,
    '4fun_',
    '299223548495527947',
    'FaZe Clan, Legacy',
    'Fluxo, Rare Atom',
    'Lynn Vision Gaming, Fnatic, PARIVISION, B8, Ninjas in Pyjamas, GamerLegion',
    1,
    '2025-11-17 19:32:33',
    'stage1',
    '4Fun'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    263,
    'bar_dzik',
    '323905797207621663',
    'GamerLegion, Legacy',
    'RED Canids, Rare Atom',
    'FaZe Clan, Ninjas in Pyjamas, Fnatic, M80, Lynn Vision Gaming, B8',
    1,
    '2025-11-17 19:41:16',
    'stage1',
    'Skillek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    265,
    'endriugolarara',
    '402551682694905876',
    'GamerLegion, Lynn Vision Gaming',
    'The Huns Esports, PARIVISION',
    'FaZe Clan, Ninjas in Pyjamas, Legacy, NRG, M80, FlyQuest',
    1,
    '2025-11-17 20:03:04',
    'stage1',
    '????????????'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    266,
    'cysioo0',
    '598815429091393536',
    'FaZe Clan, Legacy',
    'The Huns Esports, RED Canids',
    'PARIVISION, B8, GamerLegion, Lynn Vision Gaming, FlyQuest, Fnatic',
    1,
    '2025-11-17 20:15:08',
    'stage1',
    'CYSIOO'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    267,
    'f0nteec',
    '473810651748499456',
    'Legacy, Ninjas in Pyjamas',
    'B8, NRG',
    'FaZe Clan, Fnatic, GamerLegion, Imperial, FlyQuest, RED Canids',
    1,
    '2025-11-17 20:27:02',
    'stage1',
    'f0nTeec'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    268,
    'owerlord1316',
    '274961378203140097',
    'Lynn Vision Gaming, PARIVISION',
    'M80, The Huns Esports',
    'B8, FaZe Clan, GamerLegion, Legacy, NRG, Ninjas in Pyjamas',
    1,
    '2025-11-17 21:24:45',
    'stage1',
    'Owerlord'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    269,
    'eizi3k',
    '352153616368533504',
    'FaZe Clan, B8',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, Fnatic, Legacy, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-18 11:38:29',
    'stage1',
    'Eizi3k'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    270,
    'kjnv3',
    '534065689947013122',
    'B8, PARIVISION',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Fnatic, Legacy, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-18 12:46:48',
    'stage1',
    'Konfi Cotton'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    271,
    'krasmen',
    '568419957369470987',
    'B8, Legacy',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, M80, FlyQuest, Lynn Vision Gaming',
    1,
    '2025-11-18 13:02:32',
    'stage1',
    'Krasmen'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    273,
    'undeadkarambol',
    '1225901047982329876',
    'FaZe Clan, B8',
    'RED Canids, Rare Atom',
    'GamerLegion, Ninjas in Pyjamas, Fnatic, Legacy, M80, FlyQuest',
    1,
    '2025-11-18 14:35:52',
    'stage1',
    'lekko pochylony ????????'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    275,
    '.emten',
    '364402950057099266',
    'Lynn Vision Gaming, Legacy',
    'RED Canids, Rare Atom',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, NRG',
    1,
    '2025-11-18 17:28:33',
    'stage1',
    'eMten'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    276,
    'https.tymon',
    '1353718624359022633',
    'FaZe Clan, B8',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Legacy, Fnatic, Lynn Vision Gaming',
    1,
    '2025-11-18 18:10:25',
    'stage1',
    'SroMasz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    278,
    '.fred1213',
    '488757200399892480',
    'B8, PARIVISION',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, Legacy, Ninjas in Pyjamas, Fnatic, FlyQuest',
    1,
    '2025-11-18 20:30:12',
    'stage1',
    '✔ ???????? ✔'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    279,
    'nfixme',
    '788345818343669760',
    'FaZe Clan, PARIVISION',
    'The Huns Esports, Rare Atom',
    'GamerLegion, Ninjas in Pyjamas, B8, Legacy, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-18 20:36:00',
    'stage1',
    'nfixme ੭* ‧₊°'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    280,
    'hopper2137',
    '614884618272768038',
    'B8, Legacy',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, M80, NRG, Lynn Vision Gaming',
    1,
    '2025-11-18 22:39:43',
    'stage1',
    'hopper'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    281,
    'dekus7692',
    '472474920270561281',
    'GamerLegion, PARIVISION',
    'The Huns Esports, Rare Atom',
    'FaZe Clan, Ninjas in Pyjamas, B8, Fnatic, Legacy, M80',
    1,
    '2025-11-19 09:21:36',
    'stage1',
    'Dekus'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    282,
    'sodz1ak.',
    '1303813587957059594',
    'FaZe Clan, Rare Atom',
    'GamerLegion, B8',
    'Fluxo, Lynn Vision Gaming, M80, NRG, The Huns Esports, FlyQuest',
    1,
    '2025-11-19 11:13:10',
    'stage1',
    'sodziak'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    283,
    'consaramgateun',
    '727134099231211571',
    'FlyQuest, Legacy',
    'Fluxo, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, PARIVISION, M80, B8',
    1,
    '2025-11-19 14:19:58',
    'stage1',
    '촌사람 같은'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    284,
    'nikt_ciekawy1337',
    '1067108422652284968',
    'FaZe Clan, PARIVISION',
    'NRG, Rare Atom',
    'GamerLegion, Ninjas in Pyjamas, B8, Legacy, Fnatic, Imperial',
    1,
    '2025-11-19 14:35:52',
    'stage1',
    'Nikt Ciekawy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    285,
    'poprostujas.',
    '426457936202563586',
    'B8, Legacy',
    'RED Canids, Rare Atom',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Fnatic, NRG, Lynn Vision Gaming',
    1,
    '2025-11-19 16:53:21',
    'stage1',
    'ｊａｎｅｅｋ'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    286,
    'jc0bs',
    '1099627480911978526',
    'B8, Legacy',
    'The Huns Esports, Rare Atom',
    'GamerLegion, Ninjas in Pyjamas, FaZe Clan, PARIVISION, Fnatic, M80',
    1,
    '2025-11-19 18:08:50',
    'stage1',
    'jc0bs'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    287,
    'matihaze13',
    '657258952320352291',
    'Legacy, B8',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, PARIVISION, Ninjas in Pyjamas, Fnatic, FlyQuest',
    1,
    '2025-11-19 18:53:46',
    'stage1',
    'strazz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    289,
    'borow1k',
    '300273286489702402',
    'Ninjas in Pyjamas, Lynn Vision Gaming',
    'The Huns Esports, Rare Atom',
    'FaZe Clan, GamerLegion, B8, PARIVISION, Fnatic, Legacy',
    1,
    '2025-11-20 12:51:06',
    'stage1',
    'Borowik'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    290,
    '_zipi',
    '319901756064792588',
    'B8, GamerLegion',
    'RED Canids, Fluxo',
    'FaZe Clan, Ninjas in Pyjamas, PARIVISION, Fnatic, Legacy, Lynn Vision Gaming',
    1,
    '2025-11-20 15:27:53',
    'stage1',
    'ZIPI'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    291,
    'szymcr8',
    '649683931897135125',
    'B8, Legacy',
    'The Huns Esports, RED Canids',
    'GamerLegion, FaZe Clan, Ninjas in Pyjamas, PARIVISION, M80, Lynn Vision Gaming',
    1,
    '2025-11-20 16:29:44',
    'stage1',
    'szymcr8'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    294,
    'sxdemon_',
    '685783545624789031',
    'FaZe Clan, B8',
    'RED Canids, The Huns Esports',
    'Ninjas in Pyjamas, PARIVISION, Fnatic, Legacy, M80, FlyQuest',
    1,
    '2025-11-20 21:38:18',
    'stage1',
    'sxdemon_'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    295,
    'p5tn',
    '1329387696669327371',
    'Legacy, Ninjas in Pyjamas',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, B8, FlyQuest, PARIVISION, Fnatic',
    1,
    '2025-11-20 22:37:56',
    'stage1',
    'PISTON'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    297,
    'chrytybob',
    '1292388710121209858',
    'FaZe Clan, PARIVISION',
    'Fluxo, Rare Atom',
    'GamerLegion, Ninjas in Pyjamas, RED Canids, Lynn Vision Gaming, FlyQuest, Imperial',
    1,
    '2025-11-21 09:45:43',
    'stage1',
    'chryty'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    299,
    'wlter',
    '717766200616288306',
    'FaZe Clan, Ninjas in Pyjamas',
    'RED Canids, The Huns Esports',
    'GamerLegion, B8, PARIVISION, Legacy, M80, FlyQuest',
    1,
    '2025-11-21 12:13:11',
    'stage1',
    'w1ter'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    300,
    'dominikg09',
    '1281640108155469945',
    'FaZe Clan, PARIVISION',
    'RED Canids, The Huns Esports',
    'GamerLegion, B8, Legacy, Imperial, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-21 13:30:05',
    'stage1',
    'Galazka'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    301,
    'kiwi___67',
    '879476380562235392',
    'B8, Legacy',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, PARIVISION, Ninjas in Pyjamas, FlyQuest, Fnatic',
    1,
    '2025-11-21 15:13:45',
    'stage1',
    'Kiwi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    302,
    'konopacki',
    '809741245148692480',
    'B8, Legacy',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, PARIVISION, Fnatic, M80',
    1,
    '2025-11-21 15:22:49',
    'stage1',
    'don pedalini'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    303,
    'mamwolnewtorki',
    '402199933936992258',
    'B8, Legacy',
    'Rare Atom, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, PARIVISION, M80, Fnatic',
    1,
    '2025-11-21 15:31:35',
    'stage1',
    'Mam wolne wtorki'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    304,
    'mck5237',
    '545609357073842178',
    'Ninjas in Pyjamas, PARIVISION',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, B8, M80, Legacy, Fnatic',
    1,
    '2025-11-21 15:32:48',
    'stage1',
    'mck5237'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    305,
    'afkmilik',
    '798586014212816906',
    'PARIVISION, Legacy',
    'The Huns Esports, Rare Atom',
    'FaZe Clan, GamerLegion, B8, Ninjas in Pyjamas, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-21 15:33:27',
    'stage1',
    'Zioms0n pl'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    306,
    'faudi77_81068',
    '1374820395718410323',
    'FaZe Clan, B8',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Fnatic, Legacy, Rare Atom',
    1,
    '2025-11-21 15:34:12',
    'stage1',
    'Fаuдi77?'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    307,
    'honest._1',
    '1166061791416176640',
    'B8, GamerLegion',
    'RED Canids, The Huns Esports',
    'FaZe Clan, Ninjas in Pyjamas, PARIVISION, Legacy, Lynn Vision Gaming, Fnatic',
    1,
    '2025-11-21 15:44:12',
    'stage1',
    'Hone$t'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    308,
    'terminator1212',
    '1090976552159821854',
    'PARIVISION, Legacy',
    'RED Canids, Rare Atom',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, B8, Fnatic, FlyQuest',
    1,
    '2025-11-21 15:52:05',
    'stage1',
    'Pabl0o'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    309,
    'piter8713',
    '434439412256997377',
    'Legacy, FaZe Clan',
    'The Huns Esports, NRG',
    'Ninjas in Pyjamas, GamerLegion, B8, PARIVISION, Fluxo, Lynn Vision Gaming',
    1,
    '2025-11-21 15:56:11',
    'stage1',
    'piter_zps'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    310,
    'adleko29',
    '737688687227306075',
    'B8, Legacy',
    'The Huns Esports, Rare Atom',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Fnatic, M80, Lynn Vision Gaming',
    1,
    '2025-11-21 16:01:04',
    'stage1',
    'adleko29'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    311,
    'suuushii21',
    '487655741168025620',
    'FaZe Clan, B8',
    'The Huns Esports, RED Canids',
    'GamerLegion, PARIVISION, Fnatic, Legacy, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-21 16:08:12',
    'stage1',
    'Suuushii'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    312,
    'filipeqo',
    '1284132286064758807',
    'PARIVISION, B8',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Lynn Vision Gaming, Imperial, Legacy, M80',
    1,
    '2025-11-21 16:12:07',
    'stage1',
    'Filipeqo'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    313,
    'phantom8931',
    '827865688646483978',
    'GamerLegion, Legacy',
    'The Huns Esports, RED Canids',
    'B8, PARIVISION, Fnatic, Lynn Vision Gaming, FaZe Clan, FlyQuest',
    1,
    '2025-11-21 16:22:22',
    'stage1',
    'Puchatek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    314,
    'tominho_',
    '661634446772142080',
    'Legacy, FaZe Clan',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, Lynn Vision Gaming, M80, PARIVISION, B8',
    1,
    '2025-11-21 16:24:07',
    'stage1',
    'tominho'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    315,
    'city7760',
    '962434980485672971',
    'FaZe Clan, B8',
    'RED Canids, Rare Atom',
    'GamerLegion, Fnatic, Legacy, Imperial, FlyQuest, Lynn Vision Gaming',
    1,
    '2025-11-21 16:30:14',
    'stage1',
    'Mikrofalówka'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    316,
    'kapinyga',
    '393511848617574400',
    'B8, PARIVISION',
    'Rare Atom, The Huns Esports',
    'FaZe Clan, Ninjas in Pyjamas, Legacy, Imperial, M80, Fluxo',
    1,
    '2025-11-21 16:36:19',
    'stage1',
    'KaPi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    317,
    'carefour',
    '976600282358218812',
    'B8, Legacy',
    'Fluxo, RED Canids',
    'FaZe Clan, GamerLegion, PARIVISION, Lynn Vision Gaming, FlyQuest, Rare Atom',
    1,
    '2025-11-21 16:38:49',
    'stage1',
    'Tony M'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    318,
    '.clancyyy',
    '405435591887552513',
    'FaZe Clan, Legacy',
    'The Huns Esports, Rare Atom',
    'Ninjas in Pyjamas, GamerLegion, B8, Fnatic, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-21 16:44:34',
    'stage1',
    'clancy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    319,
    'bartol12',
    '576141255336132609',
    'FaZe Clan, PARIVISION',
    'The Huns Esports, RED Canids',
    'GamerLegion, B8, Legacy, Ninjas in Pyjamas, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-21 16:55:35',
    'stage1',
    'Bartol'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    320,
    '.pikom',
    '710794795529928785',
    'FaZe Clan, Legacy',
    'Rare Atom, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Fnatic, M80',
    1,
    '2025-11-21 17:12:36',
    'stage1',
    'PIKOM'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    322,
    'xniko1',
    '529027111504314399',
    'B8, FaZe Clan',
    'The Huns Esports, Fluxo',
    'GamerLegion, PARIVISION, Legacy, Lynn Vision Gaming, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-21 17:20:08',
    'stage1',
    'xNiko'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    323,
    'chwiejoo',
    '707957198508261427',
    'PARIVISION, B8',
    'NRG, RED Canids',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Legacy, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-21 17:24:31',
    'stage1',
    '4D4M'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    324,
    'aimwarez',
    '640306498798485528',
    'GamerLegion, Legacy',
    'The Huns Esports, Imperial',
    'PARIVISION, B8, Ninjas in Pyjamas, FaZe Clan, NRG, FlyQuest',
    1,
    '2025-11-21 17:29:49',
    'stage1',
    'AIMWAREZ'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    325,
    'botgat',
    '415864755845070850',
    'Legacy, B8',
    'Rare Atom, RED Canids',
    'FaZe Clan, GamerLegion, PARIVISION, Fnatic, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-21 17:39:39',
    'stage1',
    'BOTGAT'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    326,
    'kper_',
    '463001727310757888',
    'B8, FaZe Clan',
    'RED Canids, The Huns Esports',
    'GamerLegion, PARIVISION, Fnatic, Imperial, FlyQuest, Legacy',
    1,
    '2025-11-21 17:39:48',
    'stage1',
    'Kper'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    327,
    'krysio175',
    '776835822103691294',
    'B8, PARIVISION',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Legacy, Rare Atom, Fnatic',
    1,
    '2025-11-21 17:55:16',
    'stage1',
    'krysio'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    328,
    'norce92',
    '1172057126240272385',
    'GamerLegion, Imperial',
    'Rare Atom, The Huns Esports',
    'FaZe Clan, Legacy, PARIVISION, B8, FlyQuest, M80',
    1,
    '2025-11-21 18:01:31',
    'stage1',
    'NOrce'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    329,
    '.habi777_29484',
    '1325796914582782037',
    'Legacy, B8',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, FaZe Clan, Fnatic, Lynn Vision Gaming',
    1,
    '2025-11-21 18:24:22',
    'stage1',
    'habi777'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    330,
    'tiro2137',
    '755766085982093312',
    'FaZe Clan, B8',
    'RED Canids, The Huns Esports',
    'GamerLegion, PARIVISION, Legacy, Lynn Vision Gaming, Ninjas in Pyjamas, FlyQuest',
    1,
    '2025-11-21 18:35:38',
    'stage1',
    'Tiřõ²⅓⁷'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    331,
    'adriano8k',
    '683388540591407108',
    'PARIVISION, Legacy',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, B8, Lynn Vision Gaming, FlyQuest, Fnatic',
    1,
    '2025-11-21 18:49:30',
    'stage1',
    'adriano8k'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    332,
    'koba8125',
    '676509627449606168',
    'FaZe Clan, B8',
    'The Huns Esports, Rare Atom',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Imperial, M80, Fnatic',
    1,
    '2025-11-21 18:50:38',
    'stage1',
    'Kóba'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    333,
    'asfalt125',
    '662608188922789908',
    'FaZe Clan, Fnatic',
    'Rare Atom, Lynn Vision Gaming',
    'Ninjas in Pyjamas, GamerLegion, FlyQuest, NRG, M80, Imperial',
    1,
    '2025-11-21 19:13:05',
    'stage1',
    'asfalt125'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    334,
    'm1siekk',
    '1041833033629700156',
    'B8, Legacy',
    'The Huns Esports, Rare Atom',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, PARIVISION, Fnatic, FlyQuest',
    1,
    '2025-11-21 19:55:17',
    'stage1',
    'm1siek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    336,
    'labiereestmavie',
    '724635076989681685',
    'Ninjas in Pyjamas, PARIVISION',
    'NRG, The Huns Esports',
    'FaZe Clan, GamerLegion, B8, Legacy, Imperial, M80',
    1,
    '2025-11-21 19:58:49',
    'stage1',
    'Labiereestmavie'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    339,
    'memik0858_08426',
    '1326677945867309076',
    'GamerLegion, Legacy',
    'The Huns Esports, RED Canids',
    'FaZe Clan, Ninjas in Pyjamas, PARIVISION, Lynn Vision Gaming, FlyQuest, B8',
    1,
    '2025-11-21 20:35:34',
    'stage1',
    'Dzyrosiarz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    340,
    'bolobolo8269',
    '891698235117293608',
    'FaZe Clan, B8',
    'The Huns Esports, NRG',
    'Ninjas in Pyjamas, PARIVISION, Fnatic, Legacy, Lynn Vision Gaming, GamerLegion',
    1,
    '2025-11-21 20:35:40',
    'stage1',
    'bolobolo'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    342,
    'galbarofficial',
    '308626397893754883',
    'B8, PARIVISION',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Fnatic, Legacy, FlyQuest, Lynn Vision Gaming',
    1,
    '2025-11-21 20:40:16',
    'stage1',
    'galbarOfficial'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    344,
    'd_a_n_y_o',
    '802937836319801355',
    'FaZe Clan, B8',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, Fnatic, Lynn Vision Gaming, FlyQuest, Legacy',
    1,
    '2025-11-21 20:43:26',
    'stage1',
    'd_a_n_y_o'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    345,
    'xvmil',
    '472692405506932758',
    'Legacy, B8',
    'Imperial, RED Canids',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Lynn Vision Gaming, Fnatic, PARIVISION',
    1,
    '2025-11-21 20:43:51',
    'stage1',
    'Limsooon'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    346,
    'haciolem',
    '351475146604675072',
    'B8, Ninjas in Pyjamas',
    'The Huns Esports, Rare Atom',
    'FaZe Clan, GamerLegion, Legacy, Lynn Vision Gaming, FlyQuest, Fnatic',
    1,
    '2025-11-21 20:53:30',
    'stage1',
    'haciolem'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    347,
    '_boberek._.',
    '781919531018616834',
    'GamerLegion, Legacy',
    'The Huns Esports, Fluxo',
    'FaZe Clan, Ninjas in Pyjamas, B8, PARIVISION, Fnatic, FlyQuest',
    1,
    '2025-11-21 21:29:49',
    'stage1',
    'boberek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    348,
    'diptu',
    '509429079464738840',
    'FaZe Clan, Legacy',
    'Rare Atom, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, FlyQuest, Lynn Vision Gaming',
    1,
    '2025-11-21 21:31:39',
    'stage1',
    'Diptu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    349,
    '_kamils_',
    '455039359628869643',
    'FaZe Clan, Legacy',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, M80, Lynn Vision Gaming',
    1,
    '2025-11-21 21:33:40',
    'stage1',
    'Kamils'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    350,
    'thehyzio',
    '365958740928626691',
    'PARIVISION, Imperial',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Legacy, Fnatic, B8',
    1,
    '2025-11-21 21:45:06',
    'stage1',
    'TheHyzio'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    351,
    'wikusia5735',
    '737996674584281199',
    'B8, Lynn Vision Gaming',
    'RED Canids, Rare Atom',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, PARIVISION, Fnatic, Legacy',
    1,
    '2025-11-21 21:46:35',
    'stage1',
    '???????♥'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    352,
    'wariacik6571',
    '967388170490613762',
    'FaZe Clan, Legacy',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Fnatic, Lynn Vision Gaming',
    1,
    '2025-11-21 22:03:46',
    'stage1',
    'wariacik'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    353,
    'pan_michal1',
    '693444338448990219',
    'FaZe Clan, B8',
    'The Huns Esports, RED Canids',
    'GamerLegion, PARIVISION, Legacy, Fnatic, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-21 22:58:38',
    'stage1',
    'Miszi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    354,
    'tomciomurarz',
    '506914119710932993',
    'FaZe Clan, Ninjas in Pyjamas',
    'RED Canids, Rare Atom',
    'GamerLegion, B8, Fnatic, PARIVISION, Legacy, Lynn Vision Gaming',
    1,
    '2025-11-21 23:00:56',
    'stage1',
    'fre3sh'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    355,
    'grubasekkk888',
    '1307078104652714055',
    'GamerLegion, B8',
    'Rare Atom, RED Canids',
    'PARIVISION, Ninjas in Pyjamas, Legacy, Fnatic, Lynn Vision Gaming, FaZe Clan',
    1,
    '2025-11-21 23:19:48',
    'stage1',
    'gruby'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    356,
    'aragogx',
    '367785987323199490',
    'FaZe Clan, B8',
    'The Huns Esports, RED Canids',
    'Ninjas in Pyjamas, GamerLegion, PARIVISION, Fnatic, Imperial, FlyQuest',
    1,
    '2025-11-21 23:29:49',
    'stage1',
    'ArAGoGx'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    357,
    'slayworldwarriorr',
    '1100403487646429255',
    'GamerLegion, B8',
    'The Huns Esports, RED Canids',
    'FaZe Clan, Ninjas in Pyjamas, PARIVISION, Fnatic, Legacy, FlyQuest',
    1,
    '2025-11-21 23:45:07',
    'stage1',
    'slayworldwarrior'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    359,
    'mobbyn_mlodyg',
    '1204544158828597325',
    'PARIVISION, B8',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Legacy, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-21 23:52:48',
    'stage1',
    'arsiif'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    360,
    'jacek2011111',
    '1439306550706569392',
    'Legacy, FaZe Clan',
    'RED Canids, The Huns Esports',
    'Ninjas in Pyjamas, GamerLegion, B8, Lynn Vision Gaming, FlyQuest, Fnatic',
    1,
    '2025-11-21 23:54:23',
    'stage1',
    'PAWCI00'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    361,
    'szakalinnho',
    '456170557961011231',
    'FaZe Clan, Legacy',
    'The Huns Esports, Rare Atom',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Fnatic, M80, Lynn Vision Gaming',
    1,
    '2025-11-22 00:13:50',
    'stage1',
    'Szakalele'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    362,
    'tocyk',
    '917148130456260719',
    'FaZe Clan, Legacy',
    'Imperial, Fluxo',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, NRG, B8, Lynn Vision Gaming',
    1,
    '2025-11-22 00:13:59',
    'stage1',
    'Tocyk'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    363,
    'scheydy205',
    '907022269140832286',
    'FaZe Clan, B8',
    'Fluxo, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Legacy, Imperial, Lynn Vision Gaming',
    1,
    '2025-11-22 00:43:58',
    'stage1',
    'scheydy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    364,
    'cross4176',
    '867161106493866006',
    'B8, PARIVISION',
    'The Huns Esports, Fnatic',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Legacy, FlyQuest, Imperial',
    1,
    '2025-11-22 00:47:58',
    'stage1',
    'cross'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    365,
    'terapeutaaa',
    '864932529789206629',
    'FaZe Clan, B8',
    'NRG, Rare Atom',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Legacy, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-22 07:11:26',
    'stage1',
    'Terapeutaaa'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    367,
    'mista0swaggg',
    '231814174030823424',
    'B8, Legacy',
    'RED Canids, Fluxo',
    'GamerLegion, FaZe Clan, PARIVISION, Fnatic, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-22 09:08:10',
    'stage1',
    'Mista0swaggg'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    368,
    'kr_xx',
    '379636872399552512',
    'FaZe Clan, PARIVISION',
    'The Huns Esports, RED Canids',
    'GamerLegion, Fnatic, Legacy, Lynn Vision Gaming, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-22 09:59:14',
    'stage1',
    'krxx'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    370,
    'elkapone0413',
    '1349665552855072820',
    'FaZe Clan, B8',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Legacy, Imperial, M80',
    1,
    '2025-11-22 10:12:07',
    'stage1',
    'Elkapone'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    371,
    'rybaczenk0',
    '513033714226167834',
    'GamerLegion, Legacy',
    'Fluxo, The Huns Esports',
    'FaZe Clan, Ninjas in Pyjamas, B8, PARIVISION, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-22 10:19:45',
    'stage1',
    'Rybaczenk0'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    372,
    'd1oxie',
    '453811822320025603',
    'Legacy, PARIVISION',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, B8, M80, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-22 10:24:14',
    'stage1',
    'D1oxie'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    373,
    'itslockz',
    '773526091628412930',
    'B8, GamerLegion',
    'RED Canids, The Huns Esports',
    'FaZe Clan, Ninjas in Pyjamas, PARIVISION, Legacy, Fnatic, Lynn Vision Gaming',
    1,
    '2025-11-22 10:45:10',
    'stage1',
    'itsLoCKz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    374,
    'shesaskurwol',
    '905494286005583872',
    'Legacy, FaZe Clan',
    'RED Canids, The Huns Esports',
    'B8, Fnatic, PARIVISION, NRG, FlyQuest, GamerLegion',
    1,
    '2025-11-22 11:13:21',
    'stage1',
    'shesaskurwol'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    375,
    'gloogloo_',
    '1000080089888862278',
    'FaZe Clan, Legacy',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, FlyQuest, Lynn Vision Gaming',
    1,
    '2025-11-22 11:37:00',
    'stage1',
    'fieliep'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    376,
    'maybetrylater1',
    '492713025116045312',
    'B8, Legacy',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, PARIVISION, Fnatic, Lynn Vision Gaming',
    1,
    '2025-11-22 11:39:32',
    'stage1',
    'MaybeTryLateR1'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    377,
    'marek_towarek.',
    '1122926867217920093',
    'FaZe Clan, B8',
    'PARIVISION, Legacy',
    'GamerLegion, Ninjas in Pyjamas, Fnatic, FlyQuest, Lynn Vision Gaming, Rare Atom',
    1,
    '2025-11-22 11:41:31',
    'stage1',
    'marek_towarek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    378,
    'bambusbgc',
    '467385808920248320',
    'Legacy, B8',
    'The Huns Esports, Rare Atom',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, PARIVISION, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-22 11:53:26',
    'stage1',
    'Bambus'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    379,
    'przemo91.',
    '812409482088415242',
    'FaZe Clan, Legacy',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Imperial, Fnatic',
    1,
    '2025-11-22 12:00:44',
    'stage1',
    'przemo91'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    380,
    'liquid1487',
    '757903126157328385',
    'PARIVISION, Legacy',
    'The Huns Esports, Rare Atom',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, B8, Fnatic, M80',
    1,
    '2025-11-22 12:01:12',
    'stage1',
    'Liquid4K'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    381,
    '0001_1000',
    '401493953469480961',
    'M80, PARIVISION',
    'Rare Atom, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, FaZe Clan, B8, Fnatic, Legacy',
    1,
    '2025-11-22 12:09:17',
    'stage1',
    '0001'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    382,
    'deyanek',
    '350604331621548032',
    'Legacy, GamerLegion',
    'RED Canids, The Huns Esports',
    'FaZe Clan, Ninjas in Pyjamas, B8, Imperial, PARIVISION, Fnatic',
    1,
    '2025-11-22 12:37:45',
    'stage1',
    'Deyanek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    383,
    'script.king',
    '1021096727199088711',
    'PARIVISION, Legacy',
    'The Huns Esports, RED Canids',
    'B8, FaZe Clan, Lynn Vision Gaming, Fnatic, NRG, M80',
    1,
    '2025-11-22 12:53:54',
    'stage1',
    '₪》??????.???? 亗6.6.6亗?'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    384,
    'ponczczu_',
    '1351636790678654987',
    'FaZe Clan, B8',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Legacy, Imperial, Lynn Vision Gaming',
    1,
    '2025-11-22 13:00:11',
    'stage1',
    '3MPT!N3SSS'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    385,
    '_jakubos',
    '761307590226739274',
    'FaZe Clan, Legacy',
    'RED Canids, The Huns Esports',
    'GamerLegion, B8, PARIVISION, Fnatic, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-22 13:20:26',
    'stage1',
    'jaKUBOŚ'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    386,
    'bubiks',
    '1139945488167219243',
    'Legacy, B8',
    'NRG, RED Canids',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, M80, Lynn Vision Gaming, PARIVISION',
    1,
    '2025-11-22 13:41:26',
    'stage1',
    'Bubiks'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    388,
    'dobrykumpel',
    '718408438622846986',
    'B8, Legacy',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, PARIVISION, Fnatic, Ninjas in Pyjamas, M80',
    1,
    '2025-11-22 13:52:45',
    'stage1',
    'RNB'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    389,
    '.egzekucja',
    '451703866267009024',
    'PARIVISION, FaZe Clan',
    'Fluxo, NRG',
    'Legacy, B8, GamerLegion, Ninjas in Pyjamas, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-22 13:59:00',
    'stage1',
    'Egzekucja'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    390,
    'kam07549',
    '259063959867359233',
    'FaZe Clan, GamerLegion',
    'The Huns Esports, RED Canids',
    'B8, PARIVISION, Legacy, Lynn Vision Gaming, FlyQuest, Fnatic',
    1,
    '2025-11-22 14:28:39',
    'stage1',
    'kam123k'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    391,
    'kacp3r6274',
    '1268868169586577420',
    'FaZe Clan, B8',
    'RED Canids, Fluxo',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Legacy, Imperial, Lynn Vision Gaming',
    1,
    '2025-11-22 14:50:29',
    'stage1',
    'Kacp3r6274'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    392,
    'lebszot',
    '359370791076364290',
    'FaZe Clan, B8',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Legacy, M80, NRG',
    1,
    '2025-11-22 15:10:58',
    'stage1',
    'ŁeB SzOt'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    394,
    '._.iluminati._.',
    '630820180901101600',
    'GamerLegion, Legacy',
    'RED Canids, The Huns Esports',
    'FaZe Clan, Ninjas in Pyjamas, PARIVISION, NRG, Lynn Vision Gaming, Rare Atom',
    1,
    '2025-11-22 15:41:16',
    'stage1',
    'iluminati'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    395,
    'szerszen777',
    '373072390919553027',
    'The Huns Esports, RED Canids',
    'B8, Legacy',
    'FaZe Clan, M80, GamerLegion, Ninjas in Pyjamas, PARIVISION, FlyQuest',
    1,
    '2025-11-22 16:02:07',
    'stage1',
    'Szerszen777'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    396,
    'lamulina',
    '941701213345435681',
    'Legacy, FaZe Clan',
    'The Huns Esports, RED Canids',
    'B8, Ninjas in Pyjamas, NRG, Lynn Vision Gaming, FlyQuest, M80',
    1,
    '2025-11-22 16:05:06',
    'stage1',
    'lamulina'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    399,
    'strachowski2204',
    '410931873322369034',
    'PARIVISION, Legacy',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, B8, M80, Lynn Vision Gaming',
    1,
    '2025-11-22 16:54:45',
    'stage1',
    'Strachowski2204'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    400,
    'turb0s',
    '312232069289869322',
    'FaZe Clan, Legacy',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-22 17:17:26',
    'stage1',
    'Turb0s'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    401,
    'kacpi1211v2',
    '945378797069434930',
    'FaZe Clan, PARIVISION',
    'RED Canids, NRG',
    'GamerLegion, Ninjas in Pyjamas, B8, Fnatic, Legacy, FlyQuest',
    1,
    '2025-11-22 17:17:31',
    'stage1',
    'Death'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    402,
    '_hadez_11',
    '1294947471234961411',
    'FaZe Clan, GamerLegion',
    'FlyQuest, NRG',
    'Ninjas in Pyjamas, B8, PARIVISION, Fnatic, M80, Legacy',
    1,
    '2025-11-22 17:55:58',
    'stage1',
    'Nypel99'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    403,
    'plkp.1337',
    '862041274973552651',
    'FaZe Clan, Legacy',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Fnatic, Lynn Vision Gaming',
    1,
    '2025-11-22 18:58:58',
    'stage1',
    'BqMaJsTeR'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    405,
    'kombajnista.',
    '378201105256939521',
    'Legacy, M80',
    'Rare Atom, The Huns Esports',
    'FaZe Clan, B8, PARIVISION, RED Canids, GamerLegion, Lynn Vision Gaming',
    1,
    '2025-11-22 20:09:07',
    'stage1',
    'kombajnista'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    406,
    'twardabania.',
    '419502602783293440',
    'FaZe Clan, PARIVISION',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, Legacy, Fnatic, NRG',
    1,
    '2025-11-22 20:30:27',
    'stage1',
    'twarda bania'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    408,
    'bimaks37',
    '1339256360088637502',
    'PARIVISION, Legacy',
    'NRG, The Huns Esports',
    'FaZe Clan, GamerLegion, B8, M80, Ninjas in Pyjamas, Lynn Vision Gaming',
    1,
    '2025-11-22 21:02:44',
    'stage1',
    'Gołdapi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    409,
    'kawiasty._',
    '1157952394873819168',
    'FaZe Clan, Legacy',
    'RED Canids, The Huns Esports',
    'Ninjas in Pyjamas, GamerLegion, B8, PARIVISION, M80, Fnatic',
    1,
    '2025-11-22 21:39:55',
    'stage1',
    'kawiasty._'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    410,
    'barqus',
    '727857027421831288',
    'FaZe Clan, Legacy',
    'Rare Atom, NRG',
    'GamerLegion, PARIVISION, B8, Imperial, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-22 22:08:17',
    'stage1',
    'Barqus'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    412,
    'emqo',
    '551465623922933810',
    'B8, Fnatic',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Legacy, M80, Lynn Vision Gaming',
    1,
    '2025-11-22 22:13:06',
    'stage1',
    'emqo_oficjalnie'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    413,
    'logan_82',
    '534117132745572353',
    'FaZe Clan, Legacy',
    'Rare Atom, RED Canids',
    'Ninjas in Pyjamas, PARIVISION, B8, Fnatic, Lynn Vision Gaming, GamerLegion',
    1,
    '2025-11-22 22:40:20',
    'stage1',
    'L0G4N'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    414,
    'piter2710',
    '506122849082277908',
    'FaZe Clan, Legacy',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Fnatic, M80',
    1,
    '2025-11-23 00:44:09',
    'stage1',
    'Pita'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    416,
    'blr4293',
    '328909487136309248',
    'Ninjas in Pyjamas, B8',
    'Imperial, RED Canids',
    'FaZe Clan, GamerLegion, PARIVISION, Legacy, Fnatic, NRG',
    1,
    '2025-11-23 06:48:05',
    'stage1',
    'esa'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    417,
    'franio1',
    '1104033819683737611',
    'FaZe Clan, B8',
    'RED Canids, The Huns Esports',
    'GamerLegion, PARIVISION, Legacy, Fnatic, FlyQuest, Lynn Vision Gaming',
    1,
    '2025-11-23 07:48:03',
    'stage1',
    'franio'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    418,
    'qba2',
    '614079406691975170',
    'Legacy, Imperial',
    'FlyQuest, The Huns Esports',
    'FaZe Clan, Fnatic, B8, M80, Lynn Vision Gaming, PARIVISION',
    1,
    '2025-11-23 07:50:18',
    'stage1',
    'QBA'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    419,
    'eriko_19',
    '518381048598364163',
    'B8, Legacy',
    'Rare Atom, RED Canids',
    'GamerLegion, FaZe Clan, PARIVISION, FlyQuest, Lynn Vision Gaming, Fnatic',
    1,
    '2025-11-23 10:15:04',
    'stage1',
    'Eriko_19'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    421,
    'f0sti_',
    '1097066576294977547',
    'FaZe Clan, Legacy',
    'Fluxo, NRG',
    'B8, PARIVISION, Ninjas in Pyjamas, GamerLegion, Lynn Vision Gaming, Fnatic',
    1,
    '2025-11-23 11:14:57',
    'stage1',
    'F0STiii'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    423,
    'xserrek',
    '503570853611700224',
    'FaZe Clan, PARIVISION',
    'Rare Atom, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, Legacy, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-23 11:45:11',
    'stage1',
    'xSerrek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    424,
    'ksantekss',
    '942399157405110342',
    'B8, Ninjas in Pyjamas',
    'RED Canids, The Huns Esports',
    'FaZe Clan, GamerLegion, Fnatic, Legacy, FlyQuest, PARIVISION',
    1,
    '2025-11-23 11:52:53',
    'stage1',
    'ksantekss'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    425,
    'bendixtsu',
    '440969502545543168',
    'FaZe Clan, Legacy',
    'The Huns Esports, NRG',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Fnatic, FlyQuest',
    1,
    '2025-11-23 12:17:33',
    'stage1',
    'Bendixツ'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    426,
    'neverxoid',
    '233330984395866112',
    'B8, Legacy',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, PARIVISION, FlyQuest, Fnatic, Ninjas in Pyjamas',
    1,
    '2025-11-23 12:29:26',
    'stage1',
    'Neverxoid'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    427,
    'sadz1k',
    '305737641763274752',
    'PARIVISION, Fnatic',
    'The Huns Esports, NRG',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, B8, M80, Legacy',
    1,
    '2025-11-23 12:36:37',
    'stage1',
    'sadz1k'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    428,
    'hy4per',
    '823202779971453048',
    'B8, PARIVISION',
    'NRG, Rare Atom',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Legacy, FlyQuest, Lynn Vision Gaming',
    1,
    '2025-11-23 12:46:03',
    'stage1',
    '✝Hy4per✝'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    429,
    'gavloo.',
    '348911633336238080',
    'B8, Legacy',
    'NRG, Rare Atom',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, FlyQuest, Imperial, FaZe Clan',
    1,
    '2025-11-23 13:13:27',
    'stage1',
    'Gavloo'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    430,
    'fa1rant',
    '906656431351169055',
    'FaZe Clan, Legacy',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, M80, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-23 13:38:42',
    'stage1',
    'Kacper'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    432,
    'sajmuraj',
    '519287591028391959',
    'FaZe Clan, GamerLegion',
    'RED Canids, The Huns Esports',
    'B8, Fnatic, FlyQuest, Legacy, Imperial, NRG',
    1,
    '2025-11-23 14:11:54',
    'stage1',
    ',,Sajmuraj\'\''
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    434,
    'moobsik',
    '714543991122821120',
    'PARIVISION, Legacy',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, B8, M80, FlyQuest',
    1,
    '2025-11-23 15:05:10',
    'stage1',
    'moobsik'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    435,
    'money.',
    '682207856153591888',
    'FaZe Clan, B8',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Fnatic, Legacy, Imperial',
    1,
    '2025-11-23 15:13:46',
    'stage1',
    '????????'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    436,
    'xqbik',
    '532912683666898944',
    'B8, Legacy',
    'Fluxo, The Huns Esports',
    'FaZe Clan, GamerLegion, PARIVISION, M80, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-23 15:15:18',
    'stage1',
    'xQBIK.wav'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    437,
    'uniq7565',
    '428666355965755396',
    'GamerLegion, B8',
    'The Huns Esports, RED Canids',
    'FaZe Clan, Ninjas in Pyjamas, PARIVISION, Fnatic, Legacy, FlyQuest',
    1,
    '2025-11-23 15:48:24',
    'stage1',
    'uniq7565'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    438,
    'kam8l',
    '522446902147547157',
    'Ninjas in Pyjamas, Legacy',
    'Rare Atom, Fluxo',
    'FaZe Clan, GamerLegion, Imperial, Fnatic, PARIVISION, B8',
    1,
    '2025-11-23 16:08:43',
    'stage1',
    'kam8l'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    439,
    'jerzyyyk',
    '302530317791657986',
    'GamerLegion, Legacy',
    'The Huns Esports, RED Canids',
    'FaZe Clan, B8, PARIVISION, Fnatic, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-23 16:42:43',
    'stage1',
    'jerzyk'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    440,
    'easyiwnl',
    '531485490575310879',
    'FaZe Clan, Legacy',
    'Rare Atom, NRG',
    'PARIVISION, B8, GamerLegion, Ninjas in Pyjamas, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-23 16:48:18',
    'stage1',
    'Le Prince'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    441,
    'panhd.',
    '1008765321861140611',
    'FaZe Clan, PARIVISION',
    'The Huns Esports, RED Canids',
    'Ninjas in Pyjamas, GamerLegion, B8, Legacy, Fnatic, Lynn Vision Gaming',
    1,
    '2025-11-23 16:54:01',
    'stage1',
    'panpiku'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    442,
    'tuptusonsigma',
    '699257871673852034',
    'FaZe Clan, B8',
    'Fluxo, RED Canids',
    'GamerLegion, Legacy, M80, NRG, FlyQuest, Rare Atom',
    1,
    '2025-11-23 16:56:26',
    'stage1',
    'skurwysyny haratajo'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    443,
    'inzu_.',
    '341248627852836876',
    'FaZe Clan, GamerLegion',
    'NRG, The Huns Esports',
    'B8, PARIVISION, Ninjas in Pyjamas, Legacy, M80, FlyQuest',
    1,
    '2025-11-23 17:02:11',
    'stage1',
    'INzu_'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    444,
    'mcgregor1_7',
    '594964029940957224',
    'GamerLegion, PARIVISION',
    'NRG, Fluxo',
    'FaZe Clan, Ninjas in Pyjamas, Legacy, FlyQuest, B8, RED Canids',
    1,
    '2025-11-23 17:20:21',
    'stage1',
    'McGregor17'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    445,
    'siemasiema1312',
    '447785515186520064',
    'FaZe Clan, B8',
    'NRG, Fluxo',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Legacy, Lynn Vision Gaming, Rare Atom',
    1,
    '2025-11-23 17:22:23',
    'stage1',
    'siemasiema1312'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    446,
    'pumbarr',
    '733573014402236449',
    'GamerLegion, Legacy',
    'NRG, The Huns Esports',
    'FaZe Clan, Ninjas in Pyjamas, B8, PARIVISION, M80, FlyQuest',
    1,
    '2025-11-23 17:33:15',
    'stage1',
    '?????'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    447,
    'za.xx.xx',
    '811601970506629150',
    'FaZe Clan, Legacy',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Fnatic, Lynn Vision Gaming',
    1,
    '2025-11-23 17:56:29',
    'stage1',
    'KebabikRHC'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    448,
    '_sliqz',
    '1097190679773466764',
    'Legacy, PARIVISION',
    'The Huns Esports, NRG',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, B8, FlyQuest, M80',
    1,
    '2025-11-23 17:58:16',
    'stage1',
    '?????'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    449,
    'waso.',
    '337966578798690304',
    'B8, Legacy',
    'The Huns Esports, Fnatic',
    'FaZe Clan, GamerLegion, Lynn Vision Gaming, Ninjas in Pyjamas, PARIVISION, Fluxo',
    1,
    '2025-11-23 18:52:58',
    'stage1',
    'waso'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    451,
    'banger4471',
    '414544887376248843',
    'FaZe Clan, PARIVISION',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, Legacy, M80, Fnatic',
    1,
    '2025-11-23 19:06:41',
    'stage1',
    'banger'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    452,
    'mati1493',
    '696087842308489237',
    'FaZe Clan, PARIVISION',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, Lynn Vision Gaming, Legacy, M80',
    1,
    '2025-11-23 19:18:48',
    'stage1',
    'Mati1493'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    453,
    'vulc4ng_50817',
    '1285604020819329181',
    'FaZe Clan, PARIVISION',
    'The Huns Esports, RED Canids',
    'GamerLegion, B8, Fnatic, Legacy, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-23 19:51:04',
    'stage1',
    'vulc4ng'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    456,
    'lemon3105',
    '421726542104625163',
    'FaZe Clan, Legacy',
    'Rare Atom, The Huns Esports',
    'PARIVISION, GamerLegion, Ninjas in Pyjamas, B8, Fnatic, M80',
    1,
    '2025-11-23 20:17:12',
    'stage1',
    'Lemonziiko'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    457,
    'lukasz9842',
    '548248747977474048',
    'FaZe Clan, PARIVISION',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, B8, M80, Legacy, FlyQuest',
    1,
    '2025-11-23 20:45:13',
    'stage1',
    'Łukasz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    459,
    'lucky00783',
    '435416566511697921',
    'Legacy, Fnatic',
    'NRG, The Huns Esports',
    'M80, B8, Ninjas in Pyjamas, GamerLegion, FaZe Clan, Lynn Vision Gaming',
    1,
    '2025-11-23 21:23:20',
    'stage1',
    '?LuCkY00783?'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    460,
    'rysiek213',
    '931168369573503006',
    'FaZe Clan, PARIVISION',
    'RED Canids, The Huns Esports',
    'Legacy, M80, Ninjas in Pyjamas, GamerLegion, B8, FlyQuest',
    1,
    '2025-11-23 21:23:24',
    'stage1',
    'Rysiu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    461,
    'asidesarpb',
    '1322673348924411944',
    'FaZe Clan, B8',
    'Fluxo, RED Canids',
    'Legacy, Lynn Vision Gaming, Fnatic, PARIVISION, Ninjas in Pyjamas, GamerLegion',
    1,
    '2025-11-23 21:32:19',
    'stage1',
    'Asidesar'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    462,
    'laki5068',
    '809885132101779456',
    'GamerLegion, PARIVISION',
    'The Huns Esports, RED Canids',
    'FaZe Clan, Ninjas in Pyjamas, Legacy, M80, Rare Atom, FlyQuest',
    1,
    '2025-11-23 21:33:33',
    'stage1',
    'Laki'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    463,
    '5iontal',
    '755461769987751987',
    'B8, Legacy',
    'NRG, Rare Atom',
    'FaZe Clan, GamerLegion, PARIVISION, M80, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-23 22:01:23',
    'stage1',
    '5iontal'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    464,
    'jerkofficer69420',
    '1328802155079012425',
    'Legacy, Lynn Vision Gaming',
    'The Huns Esports, RED Canids',
    'FaZe Clan, Ninjas in Pyjamas, B8, GamerLegion, PARIVISION, Fnatic',
    1,
    '2025-11-23 22:39:45',
    'stage1',
    'jan'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    465,
    'proxyxd',
    '395986508013895701',
    'PARIVISION, Ninjas in Pyjamas',
    'NRG, The Huns Esports',
    'Legacy, FaZe Clan, GamerLegion, B8, FlyQuest, Lynn Vision Gaming',
    1,
    '2025-11-23 22:42:25',
    'stage1',
    'proxy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    466,
    'alexi.7',
    '766301134956134440',
    'FaZe Clan, Ninjas in Pyjamas',
    'The Huns Esports, RED Canids',
    'GamerLegion, B8, PARIVISION, Fnatic, Legacy, FlyQuest',
    1,
    '2025-11-23 22:42:54',
    'stage1',
    'alexi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    467,
    'sikor5678',
    '401045306634141696',
    'FaZe Clan, Legacy',
    'RED Canids, The Huns Esports',
    'GamerLegion, B8, PARIVISION, M80, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-23 23:36:33',
    'stage1',
    'Sikor'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    468,
    'michalkaylan',
    '481456320546078730',
    'B8, M80',
    'The Huns Esports, Ninjas in Pyjamas',
    'FaZe Clan, GamerLegion, PARIVISION, Legacy, FlyQuest, Rare Atom',
    1,
    '2025-11-23 23:50:59',
    'stage1',
    'MichalKaylan'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    469,
    'matiwk222',
    '1081626433266393198',
    'FaZe Clan, Legacy',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Fnatic, FlyQuest',
    1,
    '2025-11-24 00:07:20',
    'stage1',
    'matiwk222'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    471,
    'bambosh420',
    '679076779872223434',
    'FaZe Clan, GamerLegion',
    'Fluxo, Rare Atom',
    'B8, PARIVISION, Legacy, Lynn Vision Gaming, FlyQuest, M80',
    1,
    '2025-11-24 00:27:30',
    'stage1',
    'Bambosh420'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    472,
    '.turoczek',
    '629686561562165249',
    'FaZe Clan, PARIVISION',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, Legacy, M80, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-24 00:32:41',
    'stage1',
    'Turoczek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    474,
    'ilyorange',
    '990401263889969193',
    'PARIVISION, Legacy',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, B8, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-24 02:50:30',
    'stage1',
    'ilyorange 么'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    475,
    's00chy',
    '623578079951978516',
    'FaZe Clan, PARIVISION',
    'NRG, The Huns Esports',
    'B8, Ninjas in Pyjamas, GamerLegion, Legacy, FlyQuest, Lynn Vision Gaming',
    1,
    '2025-11-24 03:50:07',
    'stage1',
    'S00chy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    477,
    'panmann8168',
    '747076003792158761',
    'FaZe Clan, Ninjas in Pyjamas',
    'M80, Fluxo',
    'Legacy, Lynn Vision Gaming, FlyQuest, Fnatic, GamerLegion, Imperial',
    1,
    '2025-11-24 06:52:41',
    'stage1',
    'PanMann'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    478,
    'zzero2000',
    '462244738096037899',
    'FaZe Clan, Legacy',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-24 07:35:44',
    'stage1',
    'Zzero'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    479,
    '.adelay',
    '675411059091439626',
    'B8, Legacy',
    'RED Canids, Rare Atom',
    'FaZe Clan, GamerLegion, PARIVISION, M80, FlyQuest, Fnatic',
    1,
    '2025-11-24 07:42:19',
    'stage1',
    'Adelay'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    480,
    '_k4cpe6ek_',
    '695544671929368577',
    'B8, Legacy',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, PARIVISION, FlyQuest, Lynn Vision Gaming, Imperial',
    1,
    '2025-11-24 07:48:14',
    'stage1',
    'k4cpe6ek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    481,
    'baran_clip_you',
    '751675646979080212',
    'FaZe Clan, Legacy',
    'RED Canids, The Huns Esports',
    'Ninjas in Pyjamas, GamerLegion, B8, PARIVISION, M80, Lynn Vision Gaming',
    1,
    '2025-11-24 08:50:38',
    'stage1',
    'baran_clip_you'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    482,
    'bartusjduwu',
    '228847064841191424',
    'B8, Legacy',
    'NRG, RED Canids',
    'PARIVISION, Fnatic, GamerLegion, FaZe Clan, Lynn Vision Gaming, FlyQuest',
    1,
    '2025-11-24 08:50:55',
    'stage1',
    'bartuśjduwu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    485,
    'qbinho',
    '1034910520165285898',
    'B8, Legacy',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, PARIVISION, Fnatic, Lynn Vision Gaming',
    1,
    '2025-11-24 10:01:36',
    'stage1',
    'Qbinho'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    486,
    'wojtass._.',
    '815342777918554122',
    'Fnatic, Legacy',
    'The Huns Esports, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, PARIVISION, Imperial, M80, FlyQuest',
    1,
    '2025-11-24 10:02:35',
    'stage1',
    'Wojtas.'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    488,
    '_sergioramos_',
    '895331618590441523',
    'GamerLegion, PARIVISION',
    'The Huns Esports, Rare Atom',
    'Ninjas in Pyjamas, B8, Fnatic, Lynn Vision Gaming, FlyQuest, Imperial',
    1,
    '2025-11-24 10:03:39',
    'stage1',
    'Asencio'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    489,
    'hub1xx_',
    '906231768712101919',
    'Ninjas in Pyjamas, PARIVISION',
    'Rare Atom, NRG',
    'FaZe Clan, GamerLegion, B8, Legacy, M80, FlyQuest',
    1,
    '2025-11-24 10:03:43',
    'stage1',
    'hub1x'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    491,
    'aleks2208',
    '340528426345693185',
    'FaZe Clan, Legacy',
    'RED Canids, The Huns Esports',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Imperial, FlyQuest',
    1,
    '2025-11-24 10:03:54',
    'stage1',
    'Aleks'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    493,
    'tusiactwo',
    '573574878918082560',
    'M80, FaZe Clan',
    'NRG, RED Canids',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Legacy, FlyQuest',
    1,
    '2025-11-24 10:04:16',
    'stage1',
    'Tusiactwo'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    494,
    'lukasz_03',
    '561623798596632588',
    'B8, Ninjas in Pyjamas',
    'RED Canids, The Huns Esports',
    'GamerLegion, FaZe Clan, PARIVISION, Fnatic, Legacy, FlyQuest',
    1,
    '2025-11-24 10:07:51',
    'stage1',
    'Lukasz_03'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    497,
    'subweydear',
    '789922633012609044',
    'PARIVISION, FaZe Clan',
    'Fluxo, RED Canids',
    'Lynn Vision Gaming, FlyQuest, Fnatic, GamerLegion, B8, Legacy',
    1,
    '2025-11-24 10:10:13',
    'stage1',
    'Subwey'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    498,
    'qdamix',
    '402837598592303114',
    'FaZe Clan, Legacy',
    'The Huns Esports, Rare Atom',
    'GamerLegion, Ninjas in Pyjamas, B8, PARIVISION, Fnatic, M80',
    1,
    '2025-11-24 10:15:08',
    'stage1',
    'qdamix'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    500,
    'qubidjo',
    '1057392520860012564',
    'RED Canids, The Huns Esports',
    'FaZe Clan, Legacy',
    'B8, GamerLegion, PARIVISION, Lynn Vision Gaming, M80, Fnatic',
    1,
    '2025-11-24 10:19:40',
    'stage1',
    'qubi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    502,
    'ales1433',
    '479245851722645535',
    'FaZe Clan, PARIVISION',
    'Rare Atom, NRG',
    'Ninjas in Pyjamas, GamerLegion, Fnatic, Fluxo, Legacy, M80',
    1,
    '2025-11-24 10:25:07',
    'stage1',
    'Ales'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    504,
    'matux223',
    '657270787711041546',
    'PARIVISION, FaZe Clan',
    'RED Canids, The Huns Esports',
    'GamerLegion, B8, Fnatic, Legacy, Ninjas in Pyjamas, FlyQuest',
    1,
    '2025-11-24 10:29:56',
    'stage1',
    'Assassin'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    505,
    'gbfn',
    '279928749670006786',
    'B8, Imperial',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, Lynn Vision Gaming, Fnatic, Ninjas in Pyjamas, FlyQuest',
    1,
    '2025-11-24 10:34:12',
    'stage1',
    'gbfn'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    509,
    'dawidee',
    '583924691073368069',
    'PARIVISION, B8',
    'The Huns Esports, RED Canids',
    'FaZe Clan, GamerLegion, Ninjas in Pyjamas, Lynn Vision Gaming, Legacy, Fnatic',
    1,
    '2025-11-24 10:53:21',
    'stage1',
    'Dawid'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    511,
    'gekoniasty',
    '318343577765806080',
    'FaZe Clan, Legacy',
    'RED Canids, The Huns Esports',
    'GamerLegion, Fnatic, M80, Ninjas in Pyjamas, FlyQuest, B8',
    1,
    '2025-11-24 10:58:09',
    'stage1',
    'Gekoniasty'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    512,
    'killua1051',
    '342566246123831316',
    'FaZe Clan, Legacy',
    'The Huns Esports, RED Canids',
    'GamerLegion, B8, PARIVISION, Fnatic, FlyQuest, Lynn Vision Gaming',
    1,
    '2025-11-24 10:59:14',
    'stage1',
    'essakessa'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    513,
    'pauderek',
    '330505053314220034',
    'Faze, Parivision',
    'The Huns Esports, Red Canids',
    'GamerLegion, Ninjas in Pyjamas, Lynn Vision Gaming, NRG, Legacy, B8',
    1,
    '2025-11-24 19:39:48',
    'stage1',
    'Pauder'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    514,
    'cieplyhehe',
    '461851082570596352',
    'Aurora, NAVI',
    'Astralis, 3DMAX',
    'Parivision, Imperial, MIBR, Ninjas in Pyjamas, FlyQuest, Fnatic',
    1,
    '2025-11-27 22:53:30',
    'stage2',
    'Ciepły'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    515,
    'janosik7.',
    '1296180581305942016',
    'Aurora, Astralis',
    'TYLOO, Parivision',
    'NAVI, FaZe Clan, 3DMAX, Passion UA, Ninjas in Pyjamas, Liquid',
    1,
    '2025-11-27 22:54:08',
    'stage2',
    'z3fir'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    516,
    'dawidee',
    '583924691073368069',
    'Aurora, Liquid',
    'Imperial, Fnatic',
    'NAVI, Astralis, 3DMAX, FaZe Clan, M80, FlyQuest',
    1,
    '2025-11-27 22:54:22',
    'stage2',
    'Dawid'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    517,
    'krisv2._68440',
    '1153270538429542421',
    'Aurora, 3DMAX',
    'Imperial, FlyQuest',
    'NAVI, Passion UA, Fnatic, Liquid, FaZe Clan, Astralis',
    1,
    '2025-11-27 22:55:03',
    'stage2',
    'gwd313g'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    518,
    'gloogloo_',
    '1000080089888862278',
    'Aurora, Liquid',
    'TYLOO, Imperial',
    'NAVI, 3DMAX, FaZe Clan, M80, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-27 22:55:26',
    'stage2',
    'fieliep'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    519,
    '_k4cpe6ek_',
    '695544671929368577',
    '3DMAX, FaZe Clan',
    'Astralis, MIBR',
    'Parivision, Ninjas in Pyjamas, FlyQuest, Liquid, NAVI, Aurora',
    1,
    '2025-11-27 22:55:46',
    'stage2',
    'k4cpe6ek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    520,
    'kqcus.',
    '1236280013343424512',
    'Aurora, Astralis',
    'Fnatic, Imperial',
    'NAVI, 3DMAX, M80, Parivision, FaZe Clan, Liquid',
    1,
    '2025-11-27 22:56:15',
    'stage2',
    'kqcus.'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    521,
    'jacaplaca2115',
    '692431475139805305',
    'Aurora, NAVI',
    'Parivision, Imperial',
    'FaZe Clan, Astralis, 3DMAX, Liquid, B8, Fnatic',
    1,
    '2025-11-27 22:56:49',
    'stage2',
    'jxcxk'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    522,
    'dr.macika',
    '761587793893654549',
    'Aurora, NAVI',
    'Imperial, Passion UA',
    'Astralis, 3DMAX, Liquid, FlyQuest, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-27 22:58:31',
    'stage2',
    'Dr.Macika'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    523,
    'czipsol',
    '383712116005404675',
    'NAVI, Liquid',
    '3DMAX, MIBR',
    'Astralis, Parivision, Aurora, FaZe Clan, B8, TYLOO',
    1,
    '2025-11-27 22:59:22',
    'stage2',
    'czipsol'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    524,
    'masno3233',
    '496024553609494539',
    'Astralis, Liquid',
    'Imperial, Ninjas in Pyjamas',
    'Aurora, NAVI, 3DMAX, B8, M80, Parivision',
    1,
    '2025-11-27 22:59:32',
    'stage2',
    'moREE'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    525,
    '.metyl.',
    '801164867457253406',
    'Astralis, Aurora',
    'Imperial, B8',
    'NAVI, FaZe Clan, Liquid, 3DMAX, M80, Ninjas in Pyjamas',
    1,
    '2025-11-27 22:59:37',
    'stage2',
    '☢?????☢'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    526,
    'cziki4406',
    '361572745147842563',
    'Aurora, NAVI',
    'B8, Imperial',
    'FaZe Clan, Liquid, Astralis, 3DMAX, Ninjas in Pyjamas, Fnatic',
    1,
    '2025-11-27 22:59:52',
    'stage2',
    'CziKi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    528,
    'xkuba6969',
    '486957798207258635',
    'Aurora, NAVI',
    'Imperial, MIBR',
    'Liquid, 3DMAX, Ninjas in Pyjamas, Passion UA, Astralis, FaZe Clan',
    1,
    '2025-11-27 23:00:44',
    'stage2',
    'Kuba'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    529,
    'monczall',
    '419278999991353374',
    'Aurora, 3DMAX',
    'Ninjas in Pyjamas, Fnatic',
    'NAVI, Astralis, Parivision, FlyQuest, MIBR, Passion UA',
    1,
    '2025-11-27 23:05:16',
    'stage2',
    'Monczall'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    530,
    'didek0188',
    '419405937728684032',
    'Aurora, 3DMAX',
    'MIBR, TYLOO',
    'Liquid, Parivision, Ninjas in Pyjamas, NAVI, FaZe Clan, Astralis',
    1,
    '2025-11-27 23:13:38',
    'stage2',
    'didek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    531,
    'bez4513',
    '150033391104950272',
    'Aurora, M80',
    'Imperial, Fnatic',
    'Astralis, Liquid, FlyQuest, Ninjas in Pyjamas, Parivision, Passion UA',
    1,
    '2025-11-27 23:15:28',
    'stage2',
    'Bez'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    532,
    'asidesarpb',
    '1322673348924411944',
    'Aurora, Liquid',
    'TYLOO, Imperial',
    '3DMAX, FaZe Clan, Astralis, NAVI, M80, Fnatic',
    1,
    '2025-11-27 23:16:37',
    'stage2',
    'Asidesar'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    533,
    'gila.pl',
    '1181560396121907252',
    'Aurora, Astralis',
    'FlyQuest, Parivision',
    'NAVI, 3DMAX, Liquid, B8, Ninjas in Pyjamas, TYLOO',
    1,
    '2025-11-27 23:18:37',
    'stage2',
    'świąteczny gila'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    534,
    'quiq19',
    '542361412127686657',
    'Aurora, Liquid',
    'Imperial, B8',
    'NAVI, Ninjas in Pyjamas, Parivision, MIBR, Astralis, FaZe Clan',
    1,
    '2025-11-27 23:19:50',
    'stage2',
    'Quiq'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    535,
    'jerkofficer69420',
    '1328802155079012425',
    'Aurora, NAVI',
    'Fnatic, Imperial',
    'Astralis, 3DMAX, FaZe Clan, Passion UA, Parivision, Ninjas in Pyjamas',
    1,
    '2025-11-27 23:21:00',
    'stage2',
    'jan'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    536,
    'grubycoach',
    '435779589864816640',
    'Ninjas in Pyjamas, B8',
    'TYLOO, Fnatic',
    'Aurora, NAVI, FaZe Clan, Liquid, FlyQuest, Parivision',
    1,
    '2025-11-27 23:23:03',
    'stage2',
    'Grubycoach'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    537,
    'piter8713',
    '434439412256997377',
    'FlyQuest, M80',
    'Passion UA, TYLOO',
    'Aurora, NAVI, Astralis, FaZe Clan, Liquid, Ninjas in Pyjamas',
    1,
    '2025-11-27 23:30:10',
    'stage2',
    'orzeł zps'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    538,
    'klimkoo_',
    '1128584353509818379',
    'Aurora, Astralis',
    'Imperial, FlyQuest',
    'NAVI, 3DMAX, FaZe Clan, Liquid, Ninjas in Pyjamas, M80',
    1,
    '2025-11-27 23:31:38',
    'stage2',
    'klimkoo_'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    539,
    'jc0bs',
    '1099627480911978526',
    'Aurora, MIBR',
    'Passion UA, Imperial',
    'NAVI, Astralis, 3DMAX, Liquid, B8, TYLOO',
    1,
    '2025-11-27 23:34:38',
    'stage2',
    'jc0bs'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    541,
    'ftwbooki2',
    '1337065983335993345',
    '3DMAX, Aurora',
    'MIBR, Passion UA',
    'NAVI, Ninjas in Pyjamas, TYLOO, FaZe Clan, FlyQuest, Liquid',
    1,
    '2025-11-27 23:43:54',
    'stage2',
    'Booki'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    542,
    'rekinek66__99378',
    '1254016863533531192',
    'Aurora, FlyQuest',
    'Fnatic, Imperial',
    'NAVI, 3DMAX, FaZe Clan, Liquid, M80, Ninjas in Pyjamas',
    1,
    '2025-11-27 23:46:59',
    'stage2',
    'Rekinek66'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    543,
    'yuuki_3333',
    '430770974481448960',
    'Parivision, Ninjas in Pyjamas',
    'MIBR, Astralis',
    'NAVI, FaZe Clan, Aurora, TYLOO, FlyQuest, Imperial',
    1,
    '2025-11-28 00:03:33',
    'stage2',
    'dafid'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    544,
    'xczaro0',
    '723447196388819014',
    'Aurora, 3DMAX',
    'Imperial, Passion UA',
    'NAVI, Astralis, FaZe Clan, Liquid, Ninjas in Pyjamas, TYLOO',
    1,
    '2025-11-28 00:13:12',
    'stage2',
    'XcZaRo'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    545,
    'majkutini',
    '1219387685425254441',
    'Aurora, Ninjas in Pyjamas',
    'Passion UA, Imperial',
    'NAVI, Astralis, FaZe Clan, Liquid, M80, Parivision',
    1,
    '2025-11-28 00:18:37',
    'stage2',
    '! Мajkutini'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    546,
    'mjkaelo',
    '498152549451563009',
    'Ninjas in Pyjamas, Liquid',
    'TYLOO, Imperial',
    'Aurora, FaZe Clan, M80, Parivision, Astralis, 3DMAX',
    1,
    '2025-11-28 00:26:01',
    'stage2',
    'mjkaelo'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    547,
    'kper_',
    '463001727310757888',
    '3DMAX, Ninjas in Pyjamas',
    'Fnatic, Imperial',
    'NAVI, Aurora, Astralis, Passion UA, Parivision, Liquid',
    1,
    '2025-11-28 00:39:12',
    'stage2',
    'Kper'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    548,
    'botgat',
    '415864755845070850',
    '3DMAX, NAVI',
    'Imperial, TYLOO',
    'Astralis, FaZe Clan, Ninjas in Pyjamas, Aurora, FlyQuest, Liquid',
    1,
    '2025-11-28 01:30:00',
    'stage2',
    'BOTGAT'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    549,
    'panciovsky',
    '352823893003730945',
    'Aurora, NAVI',
    'Imperial, FlyQuest',
    '3DMAX, Astralis, Liquid, Ninjas in Pyjamas, MIBR, TYLOO',
    1,
    '2025-11-28 02:05:59',
    'stage2',
    'Pancio ツ'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    550,
    'matiwk222',
    '1081626433266393198',
    'Ninjas in Pyjamas, Aurora',
    'B8, 3DMAX',
    'Astralis, Liquid, MIBR, NAVI, FlyQuest, M80',
    1,
    '2025-11-28 03:40:40',
    'stage2',
    'matiwk222'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    552,
    'bartus0858',
    '1275527297893531772',
    'NAVI, Aurora',
    'TYLOO, Passion UA',
    '3DMAX, FaZe Clan, Liquid, Ninjas in Pyjamas, MIBR, Astralis',
    1,
    '2025-11-28 05:10:58',
    'stage2',
    'Bartuss'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    553,
    'nixon338',
    '1394045439782949104',
    'Liquid, MIBR',
    'Imperial, TYLOO',
    '3DMAX, Aurora, NAVI, FlyQuest, Ninjas in Pyjamas, Astralis',
    1,
    '2025-11-28 05:20:03',
    'stage2',
    'Nixon'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    556,
    'zysio',
    '762270778754203688',
    'Aurora, M80',
    'Imperial, Ninjas in Pyjamas',
    'Parivision, FlyQuest, 3DMAX, NAVI, Astralis, TYLOO',
    1,
    '2025-11-28 06:37:20',
    'stage2',
    'zysio'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    557,
    'andreeas1887',
    '1141434928458911744',
    'MIBR, Astralis',
    '3DMAX, M80',
    'Imperial, Fnatic, Liquid, NAVI, TYLOO, Ninjas in Pyjamas',
    1,
    '2025-11-28 06:58:32',
    'stage2',
    'Андреас'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    558,
    '.adelay',
    '675411059091439626',
    '3DMAX, B8',
    'Imperial, TYLOO',
    'Aurora, NAVI, FaZe Clan, Liquid, M80, Parivision',
    1,
    '2025-11-28 07:01:32',
    'stage2',
    'Adelay'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    559,
    '082byd7u2vd72',
    '227190937409945601',
    'Aurora, 3DMAX',
    'Imperial, Passion UA',
    'NAVI, Astralis, FaZe Clan, M80, Ninjas in Pyjamas, Liquid',
    1,
    '2025-11-28 07:39:40',
    'stage2',
    'siergiejj'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    560,
    'dekus7692',
    '472474920270561281',
    'Aurora, NAVI',
    'Imperial, Fnatic',
    'Astralis, 3DMAX, Liquid, Ninjas in Pyjamas, M80, FlyQuest',
    1,
    '2025-11-28 08:12:45',
    'stage2',
    'Dekus'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    561,
    'gekoniasty',
    '318343577765806080',
    'M80, MIBR',
    'Imperial, Parivision',
    'Astralis, Aurora, NAVI, 3DMAX, Liquid, Ninjas in Pyjamas',
    1,
    '2025-11-28 08:16:08',
    'stage2',
    'Gekoniasty'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    562,
    'skyshafiq',
    '882519104316137502',
    'Astralis, NAVI',
    'Parivision, Imperial',
    'Aurora, FaZe Clan, Liquid, Ninjas in Pyjamas, 3DMAX, TYLOO',
    1,
    '2025-11-28 08:17:27',
    'stage2',
    'Sky Shafiq'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    563,
    'thearcadian95',
    '278065188169842688',
    'Astralis, Liquid',
    'Imperial, Fnatic',
    'Aurora, NAVI, FaZe Clan, Ninjas in Pyjamas, Parivision, 3DMAX',
    1,
    '2025-11-28 08:19:21',
    'stage2',
    'ArcadianPrime'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    565,
    'liquid1487',
    '757903126157328385',
    'NAVI, 3DMAX',
    'Passion UA, TYLOO',
    'Aurora, Astralis, FaZe Clan, Liquid, Ninjas in Pyjamas, MIBR',
    1,
    '2025-11-28 08:45:42',
    'stage2',
    'Liquid4K'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    566,
    'pigo2450',
    '919347146405339138',
    'Aurora, NAVI',
    'Imperial, TYLOO',
    'FaZe Clan, Liquid, M80, FlyQuest, MIBR, 3DMAX',
    1,
    '2025-11-28 09:03:07',
    'stage2',
    'POPROSTUFABIAN'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    567,
    'shintowsky',
    '300683011102474251',
    'MIBR, Liquid',
    'B8, Parivision',
    'Ninjas in Pyjamas, Aurora, Astralis, NAVI, FlyQuest, Passion UA',
    1,
    '2025-11-28 09:04:07',
    'stage2',
    'Shintowskyツ'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    568,
    'tomciomurarz',
    '506914119710932993',
    'NAVI, Astralis',
    'Imperial, Parivision',
    'Aurora, Liquid, Fnatic, FaZe Clan, 3DMAX, B8',
    1,
    '2025-11-28 09:12:19',
    'stage2',
    'fre3sh'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    569,
    '.mefisto.',
    '509413231219965955',
    'Aurora, Astralis',
    'Imperial, 3DMAX',
    'NAVI, Liquid, Passion UA, B8, M80, FlyQuest',
    1,
    '2025-11-28 09:13:52',
    'stage2',
    'Mefisto'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    570,
    'bombix777',
    '1145443406638751815',
    'Aurora, Liquid',
    'Astralis, MIBR',
    'NAVI, 3DMAX, Passion UA, M80, TYLOO, Ninjas in Pyjamas',
    1,
    '2025-11-28 09:47:04',
    'stage2',
    'bombix'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    571,
    'banderas4200',
    '228173160355332097',
    'Aurora, MIBR',
    'Passion UA, TYLOO',
    'Ninjas in Pyjamas, Parivision, 3DMAX, NAVI, Imperial, Astralis',
    1,
    '2025-11-28 09:57:09',
    'stage2',
    'Banderas'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    572,
    'crestofek',
    '1439298047946522686',
    'FlyQuest, MIBR',
    'Passion UA, Parivision',
    'Aurora, NAVI, 3DMAX, FaZe Clan, Liquid, B8',
    1,
    '2025-11-28 10:31:22',
    'stage2',
    'crestofek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    573,
    'w4lec_',
    '427430915963224064',
    'Aurora, NAVI',
    'Fnatic, TYLOO',
    'Astralis, 3DMAX, FaZe Clan, Liquid, Passion UA, MIBR',
    1,
    '2025-11-28 10:41:33',
    'stage2',
    '滚筒'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    574,
    'lukasz_03',
    '561623798596632588',
    'Aurora, NAVI',
    'B8, Imperial',
    'Astralis, Liquid, FaZe Clan, 3DMAX, Ninjas in Pyjamas, TYLOO',
    1,
    '2025-11-28 10:45:33',
    'stage2',
    'Lukasz_03'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    575,
    '.kopia',
    '883797922381189141',
    'MIBR, Liquid',
    'Parivision, M80',
    'Aurora, NAVI, FaZe Clan, B8, TYLOO, FlyQuest',
    1,
    '2025-11-28 10:49:32',
    'stage2',
    'Kopia???'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    576,
    'hub1xx_',
    '906231768712101919',
    'NAVI, FaZe Clan',
    'B8, TYLOO',
    'Aurora, Astralis, 3DMAX, Liquid, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-28 10:57:34',
    'stage2',
    'hub1x'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    577,
    'zenekdb9',
    '312633551466135553',
    'Aurora, NAVI',
    'TYLOO, MIBR',
    'Astralis, 3DMAX, Passion UA, Liquid, FaZe Clan, Parivision',
    1,
    '2025-11-28 11:06:30',
    'stage2',
    'ZenSoul'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    578,
    'tusiactwo',
    '573574878918082560',
    'FaZe Clan, FlyQuest',
    'MIBR, Parivision',
    'Aurora, NAVI, M80, Ninjas in Pyjamas, Liquid, Passion UA',
    1,
    '2025-11-28 11:10:21',
    'stage2',
    'Tusiactwo'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    579,
    'luxor_.',
    '322812891956903937',
    'Aurora, 3DMAX',
    'Imperial, FaZe Clan',
    'NAVI, Liquid, M80, FlyQuest, Astralis, Ninjas in Pyjamas',
    1,
    '2025-11-28 11:23:54',
    'stage2',
    'Luxor'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    580,
    'waso.',
    '337966578798690304',
    'Aurora, NAVI',
    'Fnatic, TYLOO',
    'Astralis, FaZe Clan, Liquid, MIBR, Parivision, M80',
    1,
    '2025-11-28 11:44:26',
    'stage2',
    'waso'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    582,
    'sajmuraj',
    '519287591028391959',
    'Aurora, NAVI',
    'MIBR, TYLOO',
    '3DMAX, Liquid, B8, M80, Fnatic, FlyQuest',
    1,
    '2025-11-28 12:21:33',
    'stage2',
    ',,Sajmuraj\'\''
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    583,
    'fazer85',
    '333906708336476170',
    'Aurora, Astralis',
    'Imperial, Passion UA',
    'NAVI, Liquid, B8, M80, Fnatic, FlyQuest',
    1,
    '2025-11-28 12:49:23',
    'stage2',
    'Fazer*'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    585,
    'buldogun_94238',
    '1284075325042724900',
    'Aurora, Liquid',
    'M80, FlyQuest',
    'NAVI, Astralis, Parivision, Ninjas in Pyjamas, 3DMAX, FaZe Clan',
    1,
    '2025-11-28 12:59:48',
    'stage2',
    'Buldogun'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    586,
    'mattis44',
    '302360723676463104',
    'NAVI, 3DMAX',
    'Passion UA, MIBR',
    'FaZe Clan, Astralis, Liquid, Fnatic, Ninjas in Pyjamas, Imperial',
    1,
    '2025-11-28 13:07:30',
    'stage2',
    'MaTTiS?'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    587,
    'pumbarr',
    '733573014402236449',
    'Aurora, NAVI',
    'FlyQuest, M80',
    '3DMAX, Astralis, Parivision, Ninjas in Pyjamas, Liquid, Passion UA',
    1,
    '2025-11-28 13:07:36',
    'stage2',
    '?????'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    588,
    'mrmarty.pl_87228',
    '1145386101264109669',
    'Aurora, 3DMAX',
    'TYLOO, MIBR',
    'NAVI, Astralis, FaZe Clan, Liquid, Fnatic, Ninjas in Pyjamas',
    1,
    '2025-11-28 13:08:56',
    'stage2',
    'Mr Marty'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    589,
    'ponczczu_',
    '1351636790678654987',
    '3DMAX, Aurora',
    'Imperial, Fnatic',
    'NAVI, FaZe Clan, Liquid, TYLOO, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-28 13:18:28',
    'stage2',
    '3MPT!N3SSS'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    590,
    'seidodb',
    '814412156555755540',
    '3DMAX, Aurora',
    'Passion UA, TYLOO',
    'FaZe Clan, Astralis, NAVI, M80, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-28 13:20:41',
    'stage2',
    'm3tiz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    591,
    'szymcr8',
    '649683931897135125',
    '3DMAX, Liquid',
    'B8, MIBR',
    'NAVI, Aurora, Astralis, FaZe Clan, M80, FlyQuest',
    1,
    '2025-11-28 13:26:16',
    'stage2',
    'szymcr8'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    593,
    'd1oxie',
    '453811822320025603',
    'Aurora, 3DMAX',
    'Fnatic, Imperial',
    'NAVI, Liquid, M80, MIBR, Passion UA, Astralis',
    1,
    '2025-11-28 13:36:42',
    'stage2',
    'D1oxie'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    595,
    '.pikom',
    '710794795529928785',
    'NAVI, Liquid',
    'TYLOO, Imperial',
    'Aurora, Parivision, Astralis, 3DMAX, Ninjas in Pyjamas, M80',
    1,
    '2025-11-28 13:39:17',
    'stage2',
    'PIKOM'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    596,
    'gemainda',
    '964187009520377856',
    'Aurora, FaZe Clan',
    'Parivision, Passion UA',
    'MIBR, Imperial, Ninjas in Pyjamas, FlyQuest, Fnatic, NAVI',
    1,
    '2025-11-28 13:43:41',
    'stage2',
    'Gemainda'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    597,
    'xseti_',
    '1078726241680633857',
    'Aurora, Ninjas in Pyjamas',
    'MIBR, Imperial',
    'NAVI, Astralis, 3DMAX, Liquid, FaZe Clan, Parivision',
    1,
    '2025-11-28 14:02:21',
    'stage2',
    'xSetiツ_'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    598,
    'ejwejqe.',
    '1428965429635977299',
    'Astralis, Aurora',
    'MIBR, TYLOO',
    'NAVI, FaZe Clan, Liquid, M80, Fnatic, Ninjas in Pyjamas',
    1,
    '2025-11-28 14:21:38',
    'stage2',
    'ejwejqe'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    599,
    'dorkej',
    '646804591853436946',
    '3DMAX, Aurora',
    'FlyQuest, MIBR',
    'NAVI, Liquid, Ninjas in Pyjamas, Parivision, M80, Astralis',
    1,
    '2025-11-28 14:27:34',
    'stage2',
    'Dorkej'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    600,
    'kam8l',
    '522446902147547157',
    'Passion UA, MIBR',
    'Parivision, Imperial',
    'Ninjas in Pyjamas, Liquid, FaZe Clan, NAVI, Aurora, Fnatic',
    1,
    '2025-11-28 14:30:22',
    'stage2',
    'kam8l'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    601,
    'poprostukoko',
    '924710423100522506',
    'Aurora, Astralis',
    'Imperial, Parivision',
    'Liquid, TYLOO, Ninjas in Pyjamas, MIBR, NAVI, 3DMAX',
    1,
    '2025-11-28 14:32:17',
    'stage2',
    'poprostu koko'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    602,
    'blr4293',
    '328909487136309248',
    'Ninjas in Pyjamas, Aurora',
    'Imperial, Parivision',
    'NAVI, Astralis, FaZe Clan, M80, FlyQuest, Liquid',
    1,
    '2025-11-28 14:33:57',
    'stage2',
    'esa'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    603,
    '_zipi',
    '319901756064792588',
    '3DMAX, MIBR',
    'Passion UA, Imperial',
    'NAVI, Aurora, Astralis, FlyQuest, FaZe Clan, Liquid',
    1,
    '2025-11-28 14:36:46',
    'stage2',
    'ZIPI'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    604,
    'grubcio2851',
    '510573405569941515',
    'NAVI, FaZe Clan',
    'MIBR, Passion UA',
    'Astralis, 3DMAX, Aurora, B8, TYLOO, FlyQuest',
    1,
    '2025-11-28 14:40:56',
    'stage2',
    'Grubcio'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    605,
    'xqbik',
    '532912683666898944',
    'NAVI, Ninjas in Pyjamas',
    'Fnatic, Imperial',
    'Aurora, Astralis, FaZe Clan, M80, FlyQuest, Parivision',
    1,
    '2025-11-28 14:58:34',
    'stage2',
    'xQBIK.wav'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    606,
    'strachowski2204',
    '410931873322369034',
    'Aurora, NAVI',
    'Imperial, Fnatic',
    '3DMAX, Passion UA, M80, TYLOO, FlyQuest, FaZe Clan',
    1,
    '2025-11-28 15:06:02',
    'stage2',
    'Strachowski2204'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    607,
    'terapeutaaa',
    '864932529789206629',
    'Astralis, Parivision',
    'Imperial, Passion UA',
    'Aurora, NAVI, FaZe Clan, Liquid, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-28 15:09:53',
    'stage2',
    'Terapeutaaa'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    608,
    'feranxd',
    '1337893397721251894',
    'Aurora, 3DMAX',
    'MIBR, Fnatic',
    'Astralis, NAVI, Liquid, FlyQuest, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-28 15:13:37',
    'stage2',
    'Feran'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    609,
    'ender444',
    '846392005692358666',
    'Aurora, Astralis',
    'TYLOO, Imperial',
    '3DMAX, NAVI, FaZe Clan, Liquid, B8, Ninjas in Pyjamas',
    1,
    '2025-11-28 15:15:48',
    'stage2',
    'Nice reposition for hunter'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    610,
    'bolotv',
    '693547426212216892',
    'FlyQuest, NAVI',
    'Fnatic, Passion UA',
    'Aurora, Astralis, 3DMAX, B8, Liquid, Ninjas in Pyjamas',
    1,
    '2025-11-28 15:36:38',
    'stage2',
    'BoloTv'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    611,
    'jayyykowski',
    '582996319216599071',
    'Astralis, M80',
    'TYLOO, B8',
    'NAVI, Aurora, 3DMAX, Ninjas in Pyjamas, MIBR, Parivision',
    1,
    '2025-11-28 15:37:16',
    'stage2',
    'ʻO JayKowski'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    612,
    'spinkaa',
    '983477936810238052',
    'Aurora, Parivision',
    '3DMAX, TYLOO',
    'NAVI, Astralis, FaZe Clan, Liquid, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-28 15:48:15',
    'stage2',
    '!Spinka'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    613,
    '_ksys_',
    '284275389348446209',
    'Aurora, NAVI',
    'Passion UA, TYLOO',
    'Astralis, 3DMAX, Liquid, M80, FaZe Clan, Ninjas in Pyjamas',
    1,
    '2025-11-28 15:51:27',
    'stage2',
    'Kszyś'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    614,
    '4fire2alpaca0',
    '581860728240340992',
    'NAVI, 3DMAX',
    'Imperial, Fnatic',
    'Aurora, Astralis, Liquid, M80, Ninjas in Pyjamas, TYLOO',
    1,
    '2025-11-28 15:54:47',
    'stage2',
    'DAMN1ggy_'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    615,
    'itslockz',
    '773526091628412930',
    'B8, Ninjas in Pyjamas',
    'Imperial, Fnatic',
    'Aurora, NAVI, FaZe Clan, Parivision, 3DMAX, Liquid',
    1,
    '2025-11-28 15:58:19',
    'stage2',
    'itsLoCKz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    616,
    'sebaziomek',
    '555800660357021696',
    'Liquid, FaZe Clan',
    'Passion UA, TYLOO',
    '3DMAX, Astralis, Aurora, FlyQuest, Ninjas in Pyjamas, NAVI',
    1,
    '2025-11-28 15:59:01',
    'stage2',
    'Тотя ❤'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    617,
    'kjnv3',
    '534065689947013122',
    'Aurora, Liquid',
    'Astralis, 3DMAX',
    'NAVI, TYLOO, Fnatic, Ninjas in Pyjamas, Parivision, FlyQuest',
    1,
    '2025-11-28 16:02:09',
    'stage2',
    'Konfi Cotton'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    618,
    'olofbust',
    '1063823269297393676',
    'Astralis, FaZe Clan',
    'Imperial, TYLOO',
    'Aurora, NAVI, Liquid, B8, Fnatic, Ninjas in Pyjamas',
    1,
    '2025-11-28 16:02:28',
    'stage2',
    'Barcus88'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    619,
    '__kezzy__',
    '802583654723092550',
    'Aurora, Parivision',
    'Imperial, Passion UA',
    'NAVI, Astralis, FaZe Clan, 3DMAX, Liquid, Ninjas in Pyjamas',
    1,
    '2025-11-28 16:09:42',
    'stage2',
    '♕Kezzy™♕'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    620,
    'filipeqo',
    '1284132286064758807',
    'Aurora, 3DMAX',
    'TYLOO, Passion UA',
    'NAVI, Liquid, B8, M80, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-28 16:15:43',
    'stage2',
    'Filipeqo'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    621,
    'mis1or',
    '926626252985618432',
    'Aurora, 3DMAX',
    'Imperial, Passion UA',
    'NAVI, Liquid, M80, Parivision, FaZe Clan, Astralis',
    1,
    '2025-11-28 16:24:16',
    'stage2',
    'dombi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    622,
    'mamwolnewtorki',
    '402199933936992258',
    'Aurora, NAVI',
    'TYLOO, Imperial',
    'Astralis, 3DMAX, FaZe Clan, Liquid, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-28 16:24:47',
    'stage2',
    'Mam wolne wtorki'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    623,
    'm1siekk',
    '1041833033629700156',
    '3DMAX, NAVI',
    'Imperial, TYLOO',
    'Aurora, Astralis, FaZe Clan, Liquid, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-28 16:26:48',
    'stage2',
    'm1siek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    624,
    'tocyk',
    '917148130456260719',
    'Liquid, 3DMAX',
    'FlyQuest, Imperial',
    'NAVI, Aurora, Ninjas in Pyjamas, Astralis, M80, Parivision',
    1,
    '2025-11-28 16:33:28',
    'stage2',
    'Tocyk'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    625,
    'cnoccs',
    '1250835724169777277',
    '3DMAX, NAVI',
    'Imperial, Fnatic',
    'Aurora, Astralis, Liquid, Ninjas in Pyjamas, FlyQuest, M80',
    1,
    '2025-11-28 16:34:13',
    'stage2',
    'everyone'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    627,
    'shesaskurwol',
    '905494286005583872',
    'NAVI, FlyQuest',
    'MIBR, Parivision',
    'Aurora, Astralis, FaZe Clan, Liquid, TYLOO, 3DMAX',
    1,
    '2025-11-28 16:45:24',
    'stage2',
    'shesaskurwol'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    628,
    'hypu_',
    '210125024672219136',
    'NAVI, Liquid',
    'Parivision, MIBR',
    'FaZe Clan, Ninjas in Pyjamas, 3DMAX, Astralis, Passion UA, Aurora',
    1,
    '2025-11-28 16:50:29',
    'stage2',
    'Hypu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    629,
    'stanleyek71',
    '1158820143397339146',
    'Aurora, FlyQuest',
    'TYLOO, Passion UA',
    'NAVI, Astralis, 3DMAX, FaZe Clan, Liquid, Ninjas in Pyjamas',
    1,
    '2025-11-28 16:53:17',
    'stage2',
    'stan1eyek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    630,
    'xniko1',
    '529027111504314399',
    'Aurora, 3DMAX',
    'Imperial, FlyQuest',
    'NAVI, Astralis, Passion UA, Liquid, M80, FaZe Clan',
    1,
    '2025-11-28 16:53:54',
    'stage2',
    'xNiko'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    631,
    '.emten',
    '364402950057099266',
    'Aurora, FaZe Clan',
    'Fnatic, Ninjas in Pyjamas',
    'NAVI, Astralis, 3DMAX, Liquid, M80, Parivision',
    1,
    '2025-11-28 16:56:27',
    'stage2',
    'eMten'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    632,
    'js_0_0_',
    '874671251459833876',
    'Aurora, NAVI',
    'Imperial, Passion UA',
    'Astralis, FaZe Clan, 3DMAX, Liquid, M80, Ninjas in Pyjamas',
    1,
    '2025-11-28 17:04:18',
    'stage2',
    '--js'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    633,
    'adleko29',
    '737688687227306075',
    'Liquid, Ninjas in Pyjamas',
    'TYLOO, MIBR',
    'Aurora, FaZe Clan, NAVI, FlyQuest, 3DMAX, M80',
    1,
    '2025-11-28 17:04:32',
    'stage2',
    'adleko'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    634,
    'siemasiema1312',
    '447785515186520064',
    'Astralis, 3DMAX',
    'FaZe Clan, Fnatic',
    'Aurora, NAVI, B8, Liquid, Ninjas in Pyjamas, MIBR',
    1,
    '2025-11-28 17:05:22',
    'stage2',
    'siemasiema1312'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    635,
    'piter2710',
    '506122849082277908',
    'Aurora, Astralis',
    'FaZe Clan, Imperial',
    '3DMAX, NAVI, Liquid, M80, TYLOO, Ninjas in Pyjamas',
    1,
    '2025-11-28 17:05:33',
    'stage2',
    'Pita'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    636,
    'emerytsnupi',
    '397131740600205313',
    'NAVI, Aurora',
    'MIBR, Imperial',
    'Astralis, 3DMAX, FaZe Clan, Liquid, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-28 17:07:24',
    'stage2',
    'Charles Leclerc'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    637,
    'slomczyn',
    '415969455412215818',
    'Aurora, Astralis',
    'TYLOO, Ninjas in Pyjamas',
    '3DMAX, FaZe Clan, NAVI, Parivision, Liquid, Passion UA',
    1,
    '2025-11-28 17:08:19',
    'stage2',
    'Slomczyn'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    638,
    'deyanek',
    '350604331621548032',
    'Liquid, Aurora',
    'Imperial, Passion UA',
    'FaZe Clan, NAVI, M80, Fnatic, Astralis, 3DMAX',
    1,
    '2025-11-28 17:09:45',
    'stage2',
    'Deyanek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    639,
    'subweydear',
    '789922633012609044',
    'Ninjas in Pyjamas, Astralis',
    'B8, Imperial',
    'FaZe Clan, 3DMAX, NAVI, Aurora, Liquid, M80',
    1,
    '2025-11-28 17:27:54',
    'stage2',
    'Subwey'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    640,
    'blmateo710_72124',
    '1396160636639117372',
    'Aurora, NAVI',
    'TYLOO, Imperial',
    'Astralis, Ninjas in Pyjamas, FlyQuest, Fnatic, M80, FaZe Clan',
    1,
    '2025-11-28 17:38:02',
    'stage2',
    'BL Mateo710'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    641,
    'pieknyimlody',
    '456088997827969024',
    'Aurora, FaZe Clan',
    'Imperial, Parivision',
    'Ninjas in Pyjamas, Astralis, NAVI, MIBR, Liquid, TYLOO',
    1,
    '2025-11-28 17:41:32',
    'stage2',
    'bezbożnik'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    642,
    '0rrek3112',
    '1168436698896683082',
    'Aurora, NAVI',
    'Passion UA, Imperial',
    'FaZe Clan, Astralis, 3DMAX, Ninjas in Pyjamas, Liquid, MIBR',
    1,
    '2025-11-28 17:42:17',
    'stage2',
    '0rrek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    643,
    'm1odyk4k4',
    '610040910301888542',
    'Aurora, Astralis',
    'Imperial, Fnatic',
    'NAVI, 3DMAX, FaZe Clan, Liquid, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-28 17:42:54',
    'stage2',
    'm1odyk4k4'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    644,
    '_kubakoz',
    '1124240992380395550',
    'Aurora, Liquid',
    'Fnatic, Imperial',
    'NAVI, 3DMAX, M80, TYLOO, Ninjas in Pyjamas, FaZe Clan',
    1,
    '2025-11-28 17:52:21',
    'stage2',
    'kuba koz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    646,
    'thommyy5212',
    '535251994831618076',
    'FaZe Clan, NAVI',
    'FlyQuest, TYLOO',
    'Aurora, Astralis, 3DMAX, Parivision, Liquid, M80',
    1,
    '2025-11-28 17:57:56',
    'stage2',
    'Toomixx'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    647,
    '.marcineq',
    '478486060943540225',
    'Aurora, Astralis',
    'Imperial, Fnatic',
    'NAVI, 3DMAX, Passion UA, Liquid, M80, Parivision',
    1,
    '2025-11-28 18:03:28',
    'stage2',
    'Marcineq'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    648,
    'haciolem',
    '351475146604675072',
    'Aurora, NAVI',
    '3DMAX, MIBR',
    'Astralis, Liquid, M80, TYLOO, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-28 18:20:24',
    'stage2',
    'haciolem'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    649,
    'olifasoli2014',
    '654314799840362498',
    'Aurora, Astralis',
    'TYLOO, Ninjas in Pyjamas',
    'NAVI, Liquid, FlyQuest, M80, MIBR, 3DMAX',
    1,
    '2025-11-28 18:25:59',
    'stage2',
    'olifasoli2014'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    650,
    'olo5137',
    '932271244345233439',
    'NAVI, 3DMAX',
    'TYLOO, Imperial',
    'Aurora, Astralis, FaZe Clan, Liquid, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-28 18:43:26',
    'stage2',
    'srajkez'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    651,
    'bartuzo',
    '493774952521269248',
    'Aurora, NAVI',
    'Passion UA, TYLOO',
    'Astralis, 3DMAX, FaZe Clan, Liquid, Ninjas in Pyjamas, B8',
    1,
    '2025-11-28 18:46:19',
    'stage2',
    '???????'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    652,
    'gitsoneqq',
    '1025367753588228128',
    'Aurora, Astralis',
    'Imperial, Passion UA',
    'NAVI, 3DMAX, FaZe Clan, Liquid, Fnatic, Parivision',
    1,
    '2025-11-28 18:57:43',
    'stage2',
    'gitsoneqq'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    653,
    'kayesssss',
    '525034117105188865',
    'NAVI, Ninjas in Pyjamas',
    'TYLOO, Fnatic',
    'Aurora, Astralis, FaZe Clan, Liquid, Parivision, FlyQuest',
    1,
    '2025-11-28 19:05:15',
    'stage2',
    'KayEss'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    654,
    'uniq7565',
    '428666355965755396',
    'NAVI, Astralis',
    'FaZe Clan, Imperial',
    'Aurora, 3DMAX, Liquid, M80, FlyQuest, Parivision',
    1,
    '2025-11-28 19:05:43',
    'stage2',
    'uniq7565'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    655,
    'za.xx.xx',
    '811601970506629150',
    'NAVI, Liquid',
    'TYLOO, Imperial',
    'Aurora, Astralis, 3DMAX, FaZe Clan, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-28 19:07:55',
    'stage2',
    'KebabikRHC'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    656,
    'muszkieter666',
    '1319319791571570754',
    'Aurora, Liquid',
    'Imperial, Passion UA',
    'NAVI, Astralis, 3DMAX, FaZe Clan, M80, Ninjas in Pyjamas',
    1,
    '2025-11-28 19:09:37',
    'stage2',
    'muszkieter666'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    659,
    'lukasz9842',
    '548248747977474048',
    'Aurora, Liquid',
    'TYLOO, Imperial',
    'NAVI, 3DMAX, M80, FlyQuest, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-28 19:31:25',
    'stage2',
    'Łukasz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    660,
    'gimbus12',
    '1094596210230317096',
    'Aurora, NAVI',
    'Parivision, TYLOO',
    'Astralis, FaZe Clan, Liquid, M80, Imperial, Ninjas in Pyjamas',
    1,
    '2025-11-28 19:39:18',
    'stage2',
    'g1mbus'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    661,
    'plkp.1337',
    '862041274973552651',
    'Aurora, NAVI',
    'TYLOO, Passion UA',
    '3DMAX, FaZe Clan, Liquid, M80, Ninjas in Pyjamas, Astralis',
    1,
    '2025-11-28 19:40:20',
    'stage2',
    'BqMaJsTeR'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    663,
    'fnxxx1337',
    '460126239173378069',
    'Aurora, Liquid',
    'Passion UA, TYLOO',
    'Astralis, FaZe Clan, M80, Ninjas in Pyjamas, NAVI, MIBR',
    1,
    '2025-11-28 19:46:31',
    'stage2',
    'FNXXX-'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    664,
    'amonra7258',
    '420910465384841217',
    'NAVI, TYLOO',
    'Imperial, B8',
    'Astralis, 3DMAX, FlyQuest, Ninjas in Pyjamas, MIBR, M80',
    1,
    '2025-11-28 19:56:28',
    'stage2',
    'Amonra'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    665,
    'barqus',
    '727857027421831288',
    'Liquid, Passion UA',
    'Imperial, Fnatic',
    'FlyQuest, MIBR, 3DMAX, Astralis, NAVI, Aurora',
    1,
    '2025-11-28 19:59:29',
    'stage2',
    'Barqus'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    666,
    'savi0x',
    '627115371878416385',
    'Aurora, NAVI',
    'Passion UA, Imperial',
    'Astralis, 3DMAX, FaZe Clan, Liquid, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-28 20:00:28',
    'stage2',
    'Savi0X'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    667,
    'nfixme',
    '788345818343669760',
    'Aurora, Astralis',
    'TYLOO, Imperial',
    'NAVI, 3DMAX, FaZe Clan, Liquid, Ninjas in Pyjamas, FlyQuest',
    1,
    '2025-11-28 20:07:44',
    'stage2',
    'nfixme ੭* ‧₊°'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    668,
    'memik0858_08426',
    '1326677945867309076',
    'Aurora, Liquid',
    'Passion UA, Imperial',
    'NAVI, 3DMAX, Astralis, FaZe Clan, FlyQuest, M80',
    1,
    '2025-11-28 20:18:12',
    'stage2',
    'Dzyrosiarz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    669,
    'asfalt125',
    '662608188922789908',
    'NAVI, 3DMAX',
    'B8, Passion UA',
    'FlyQuest, Astralis, Ninjas in Pyjamas, FaZe Clan, Aurora, M80',
    1,
    '2025-11-28 20:18:44',
    'stage2',
    'asfalt125'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    670,
    'kubi1133',
    '519586946176253952',
    'Aurora, Astralis',
    'Imperial, Fnatic',
    'NAVI, 3DMAX, FaZe Clan, Liquid, B8, Ninjas in Pyjamas',
    1,
    '2025-11-28 20:26:31',
    'stage2',
    'ҜuBi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    671,
    'bartmacieja',
    '808309868586467348',
    'Aurora, Astralis',
    'Imperial, Fnatic',
    'NAVI, 3DMAX, Liquid, Passion UA, M80, Parivision',
    1,
    '2025-11-28 20:35:03',
    'stage2',
    'bartmacieja'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    672,
    'neverxoid',
    '233330984395866112',
    'Aurora, Astralis',
    'Passion UA, Imperial',
    'FaZe Clan, NAVI, Liquid, B8, Ninjas in Pyjamas, FlyQuest',
    1,
    '2025-11-28 20:36:30',
    'stage2',
    'Neverxoid'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    673,
    'klops_14',
    '1145712428580098118',
    '3DMAX, Aurora',
    'TYLOO, Imperial',
    'NAVI, Astralis, M80, B8, Passion UA, Liquid',
    1,
    '2025-11-28 20:38:19',
    'stage2',
    'Klops'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    674,
    'kombajnista.',
    '378201105256939521',
    'Aurora, Liquid',
    'TYLOO, Imperial',
    '3DMAX, FaZe Clan, Astralis, NAVI, M80, Ninjas in Pyjamas',
    1,
    '2025-11-28 20:41:44',
    'stage2',
    'kombajnista'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    675,
    'rysiek213',
    '931168369573503006',
    'Aurora, Astralis',
    'Passion UA, Imperial',
    'M80, Liquid, FaZe Clan, 3DMAX, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-28 20:42:56',
    'stage2',
    'Rysiu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    676,
    'p5tn',
    '1329387696669327371',
    'Liquid, 3DMAX',
    'TYLOO, Imperial',
    'Aurora, NAVI, Astralis, FaZe Clan, Ninjas in Pyjamas, FlyQuest',
    1,
    '2025-11-28 20:43:45',
    'stage2',
    'PISTON'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    677,
    'zlamikos',
    '352080834934865920',
    'Aurora, Liquid',
    'Imperial, TYLOO',
    'Astralis, NAVI, FlyQuest, Ninjas in Pyjamas, 3DMAX, Parivision',
    1,
    '2025-11-28 20:49:56',
    'stage2',
    'Zlamikos'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    678,
    '.fred1213',
    '488757200399892480',
    'NAVI, 3DMAX',
    'TYLOO, Imperial',
    'Aurora, Astralis, FaZe Clan, Liquid, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-28 20:57:39',
    'stage2',
    '✔ ???????? ✔'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    680,
    '.egzekucja',
    '451703866267009024',
    'Aurora, Astralis',
    'Imperial, B8',
    'NAVI, 3DMAX, MIBR, Ninjas in Pyjamas, FlyQuest, Liquid',
    1,
    '2025-11-28 21:05:24',
    'stage2',
    'Egzekucja'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    681,
    'hap3rr',
    '516697873497456655',
    'Aurora, NAVI',
    'TYLOO, Passion UA',
    'Ninjas in Pyjamas, M80, Liquid, FaZe Clan, 3DMAX, Astralis',
    1,
    '2025-11-28 21:05:57',
    'stage2',
    'hap3r'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    682,
    'bamu5',
    '1272830126832226355',
    '3DMAX, Liquid',
    'Imperial, TYLOO',
    'Aurora, NAVI, FaZe Clan, Astralis, M80, Ninjas in Pyjamas',
    1,
    '2025-11-28 21:07:42',
    'stage2',
    'Ewok'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    683,
    'patryk27_',
    '1077219449502965790',
    'NAVI, Liquid',
    'TYLOO, Imperial',
    'Aurora, Astralis, 3DMAX, FaZe Clan, M80, FlyQuest',
    1,
    '2025-11-28 21:20:47',
    'stage2',
    'JakoN-'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    684,
    'grubasekkk888',
    '1307078104652714055',
    'Aurora, Passion UA',
    'FaZe Clan, Imperial',
    'NAVI, Astralis, TYLOO, 3DMAX, MIBR, FlyQuest',
    1,
    '2025-11-28 21:20:50',
    'stage2',
    'gruby'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    685,
    'nikt_ciekawy1337',
    '1067108422652284968',
    'Aurora, NAVI',
    'Imperial, Parivision',
    'Ninjas in Pyjamas, M80, Liquid, FaZe Clan, Astralis, 3DMAX',
    1,
    '2025-11-28 21:21:17',
    'stage2',
    'Nikt Ciekawy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    686,
    'scheydy205',
    '907022269140832286',
    '3DMAX, Aurora',
    'Imperial, Fnatic',
    'NAVI, Astralis, FaZe Clan, Liquid, M80, MIBR',
    1,
    '2025-11-28 21:21:44',
    'stage2',
    'scheydy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    687,
    'cross4176',
    '867161106493866006',
    'Aurora, 3DMAX',
    'Fnatic, Imperial',
    'NAVI, Astralis, FaZe Clan, Liquid, M80, MIBR',
    1,
    '2025-11-28 21:26:50',
    'stage2',
    'cross'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    688,
    'questrianek',
    '759697317263310889',
    'Liquid, Aurora',
    'Fnatic, Imperial',
    'NAVI, 3DMAX, FaZe Clan, Ninjas in Pyjamas, M80, FlyQuest',
    1,
    '2025-11-28 21:30:41',
    'stage2',
    'questrian'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    689,
    'stasiumadafak',
    '1077357796762337331',
    'Aurora, Astralis',
    'TYLOO, Imperial',
    'NAVI, 3DMAX, Liquid, B8, M80, Ninjas in Pyjamas',
    1,
    '2025-11-28 21:36:12',
    'stage2',
    'StasiuMadaFak'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    690,
    'bubiks',
    '1139945488167219243',
    'Aurora, Astralis',
    'Imperial, TYLOO',
    'NAVI, 3DMAX, Liquid, M80, Ninjas in Pyjamas, B8',
    1,
    '2025-11-28 21:38:38',
    'stage2',
    'Bubiks'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    691,
    'lebszot',
    '359370791076364290',
    'Aurora, NAVI',
    'Imperial, Fnatic',
    'Astralis, 3DMAX, Liquid, M80, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-28 21:50:26',
    'stage2',
    'ŁeB SzOt'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    692,
    'antonisss878',
    '1283815621829857341',
    'NAVI, Aurora',
    'Imperial, TYLOO',
    'Astralis, 3DMAX, FaZe Clan, Liquid, M80, Ninjas in Pyjamas',
    1,
    '2025-11-28 21:52:31',
    'stage2',
    'Antonisss878'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    694,
    'geeciu_es',
    '823526692189634580',
    'NAVI, Aurora',
    'Imperial, FlyQuest',
    'FaZe Clan, 3DMAX, Liquid, B8, M80, Ninjas in Pyjamas',
    1,
    '2025-11-28 22:38:31',
    'stage2',
    'geeciu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    695,
    'bodzix_',
    '499568655508570119',
    'NAVI, Liquid',
    'TYLOO, Imperial',
    'Aurora, FaZe Clan, 3DMAX, Astralis, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-28 22:47:30',
    'stage2',
    'bodzix'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    696,
    'norce92',
    '1172057126240272385',
    'Liquid, NAVI',
    'Fnatic, TYLOO',
    'Aurora, 3DMAX, M80, FlyQuest, Ninjas in Pyjamas, Passion UA',
    1,
    '2025-11-28 22:47:48',
    'stage2',
    'NOrce'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    697,
    'ortionv2',
    '1279804882445930609',
    'Aurora, Liquid',
    'Imperial, MIBR',
    'NAVI, 3DMAX, Passion UA, M80, TYLOO, FlyQuest',
    1,
    '2025-11-28 23:45:35',
    'stage2',
    '<O®T¡0n'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    698,
    'pbialy123',
    '320224049760567296',
    'FlyQuest, NAVI',
    'Imperial, Passion UA',
    'Aurora, FaZe Clan, Liquid, Ninjas in Pyjamas, B8, 3DMAX',
    1,
    '2025-11-28 23:45:43',
    'stage2',
    'pbialy123'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    699,
    'kam07549',
    '259063959867359233',
    'NAVI, 3DMAX',
    'Fnatic, MIBR',
    'Aurora, FaZe Clan, Liquid, Passion UA, M80, FlyQuest',
    1,
    '2025-11-28 23:47:23',
    'stage2',
    'kam123k'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    700,
    'maciek0357',
    '691432428232900709',
    'Aurora, NAVI',
    'Parivision, Fnatic',
    'Liquid, Ninjas in Pyjamas, M80, Astralis, FaZe Clan, 3DMAX',
    1,
    '2025-11-28 23:56:07',
    'stage2',
    'macidk12'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    701,
    'tonypie_',
    '651126587621900289',
    'Astralis, Aurora',
    'Passion UA, Fnatic',
    'NAVI, 3DMAX, FaZe Clan, Liquid, M80, Ninjas in Pyjamas',
    1,
    '2025-11-28 23:57:53',
    'stage2',
    'tonypie'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    702,
    'mcgregor1_7',
    '594964029940957224',
    'Aurora, Astralis',
    'TYLOO, Imperial',
    'NAVI, 3DMAX, Liquid, M80, Ninjas in Pyjamas, FaZe Clan',
    1,
    '2025-11-28 23:57:55',
    'stage2',
    'McGregor17'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    703,
    'consaramgateun',
    '727134099231211571',
    'Aurora, 3DMAX',
    'TYLOO, MIBR',
    'NAVI, Liquid, M80, FlyQuest, Ninjas in Pyjamas, Astralis',
    1,
    '2025-11-29 00:00:56',
    'stage2',
    '촌사람 같은'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    705,
    'easyiwnl',
    '531485490575310879',
    'NAVI, Astralis',
    'TYLOO, Imperial',
    'Aurora, 3DMAX, FaZe Clan, Liquid, B8, Ninjas in Pyjamas',
    1,
    '2025-11-29 00:28:04',
    'stage2',
    'Le Prince'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    706,
    'tamski07',
    '486577410037514250',
    'NAVI, Liquid',
    'Parivision, Fnatic',
    '3DMAX, FaZe Clan, Astralis, M80, FlyQuest, MIBR',
    1,
    '2025-11-29 00:39:59',
    'stage2',
    'Tamski'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    707,
    'fr4ik',
    '766662513604689955',
    'Ninjas in Pyjamas, FlyQuest',
    'Imperial, Fnatic',
    'Aurora, 3DMAX, Astralis, NAVI, FaZe Clan, Liquid',
    1,
    '2025-11-29 00:50:50',
    'stage2',
    'Fraik'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    708,
    'bartol12',
    '576141255336132609',
    '3DMAX, Astralis',
    'FaZe Clan, Imperial',
    'Aurora, NAVI, Liquid, Parivision, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-29 00:51:42',
    'stage2',
    'Bartol'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    709,
    'lemon3105',
    '421726542104625163',
    'Aurora, NAVI',
    'MIBR, Imperial',
    'Liquid, Astralis, 3DMAX, FaZe Clan, Parivision, B8',
    1,
    '2025-11-29 01:00:38',
    'stage2',
    'Lemonziiko'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    710,
    'borow1k',
    '300273286489702402',
    'Aurora, Liquid',
    'Fnatic, Imperial',
    'NAVI, FaZe Clan, M80, Ninjas in Pyjamas, Astralis, Parivision',
    1,
    '2025-11-29 01:06:57',
    'stage2',
    'Borowik'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    711,
    't1mero',
    '340076455868235777',
    'NAVI, Passion UA',
    'FlyQuest, MIBR',
    'Aurora, 3DMAX, Liquid, B8, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-29 01:15:21',
    'stage2',
    'T1mero'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    712,
    '.turoczek',
    '629686561562165249',
    'Aurora, Parivision',
    'Passion UA, B8',
    'Astralis, FaZe Clan, Liquid, TYLOO, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-29 01:25:42',
    'stage2',
    'Turoczek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    713,
    'sadz1k',
    '305737641763274752',
    'NAVI, Liquid',
    'Imperial, TYLOO',
    'Aurora, Astralis, 3DMAX, M80, Ninjas in Pyjamas, FaZe Clan',
    1,
    '2025-11-29 01:43:13',
    'stage2',
    'sadz1k'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    714,
    'gavloo.',
    '348911633336238080',
    'Aurora, NAVI',
    'Imperial, TYLOO',
    'Astralis, 3DMAX, FaZe Clan, Liquid, M80, Ninjas in Pyjamas',
    1,
    '2025-11-29 02:22:40',
    'stage2',
    'Gavloo'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    715,
    'krzyhus212',
    '749701801304916020',
    'Aurora, NAVI',
    'Passion UA, Imperial',
    'Astralis, 3DMAX, FaZe Clan, Liquid, Fnatic, Ninjas in Pyjamas',
    1,
    '2025-11-29 02:30:00',
    'stage2',
    'Krzyhus212'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    716,
    'emeryt.muchson',
    '471463411239092225',
    'Astralis, NAVI',
    'Passion UA, FlyQuest',
    'Aurora, 3DMAX, Liquid, B8, Ninjas in Pyjamas, FaZe Clan',
    1,
    '2025-11-29 02:48:50',
    'stage2',
    '-muchson-'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    717,
    'zzero2000',
    '462244738096037899',
    'Aurora, NAVI',
    'TYLOO, Passion UA',
    'Astralis, FaZe Clan, Liquid, M80, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-29 02:50:36',
    'stage2',
    'Zzero'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    718,
    'undeadkarambol',
    '1225901047982329876',
    'NAVI, Ninjas in Pyjamas',
    'Passion UA, Aurora',
    'Astralis, Liquid, 3DMAX, MIBR, FaZe Clan, TYLOO',
    1,
    '2025-11-29 03:28:24',
    'stage2',
    'Karambolowy zawrót głowy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    719,
    's00chy',
    '623578079951978516',
    'Liquid, Ninjas in Pyjamas',
    'Fnatic, MIBR',
    'NAVI, Aurora, FaZe Clan, TYLOO, M80, Parivision',
    1,
    '2025-11-29 03:40:06',
    'stage2',
    'S00chy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    720,
    'cysioo0',
    '598815429091393536',
    'Aurora, 3DMAX',
    'Passion UA, Imperial',
    'NAVI, Astralis, FaZe Clan, Liquid, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-29 05:08:42',
    'stage2',
    'CYSIOO'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    721,
    'avatariroh1',
    '1245802397645934682',
    'Aurora, Astralis',
    'Imperial, TYLOO',
    'NAVI, 3DMAX, Liquid, Ninjas in Pyjamas, MIBR, FlyQuest',
    1,
    '2025-11-29 05:51:50',
    'stage2',
    'lunargondolier22'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    722,
    'laki5068',
    '809885132101779456',
    'Liquid, Astralis',
    'Imperial, Fnatic',
    'Aurora, Passion UA, NAVI, 3DMAX, FlyQuest, TYLOO',
    1,
    '2025-11-29 08:27:49',
    'stage2',
    'Laki'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    723,
    '_prosik_5678_',
    '779402540755976192',
    'Liquid, Ninjas in Pyjamas',
    'TYLOO, Imperial',
    'Aurora, Astralis, 3DMAX, FlyQuest, Parivision, B8',
    1,
    '2025-11-29 08:41:55',
    'stage2',
    '_prosik_5678_'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    724,
    'tyrekk',
    '414528693386608640',
    'Ninjas in Pyjamas, Passion UA',
    'Fnatic, Imperial',
    'Aurora, NAVI, Astralis, 3DMAX, M80, FlyQuest',
    1,
    '2025-11-29 08:48:57',
    'stage2',
    'Tyrek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    725,
    'hy4per',
    '823202779971453048',
    'Ninjas in Pyjamas, M80',
    'Imperial, Fnatic',
    'Aurora, NAVI, Astralis, Parivision, TYLOO, Liquid',
    1,
    '2025-11-29 08:55:50',
    'stage2',
    '✝Hy4per✝'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    726,
    'gownowaucie_25462',
    '1270413622371422343',
    'NAVI, 3DMAX',
    'Imperial, Passion UA',
    'Aurora, Astralis, FaZe Clan, Liquid, Ninjas in Pyjamas, FlyQuest',
    1,
    '2025-11-29 09:08:08',
    'stage2',
    'happy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    728,
    'przemo91.',
    '812409482088415242',
    'Aurora, Astralis',
    '3DMAX, TYLOO',
    'NAVI, FaZe Clan, Liquid, M80, Ninjas in Pyjamas, MIBR',
    1,
    '2025-11-29 09:17:12',
    'stage2',
    'przemo91'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    729,
    'tiro2137',
    '755766085982093312',
    'NAVI, Aurora',
    'TYLOO, Imperial',
    'Astralis, 3DMAX, FaZe Clan, Liquid, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-29 09:30:07',
    'stage2',
    'Tiřõ²⅓⁷'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    731,
    'kiwi___67',
    '879476380562235392',
    'NAVI, Liquid',
    'Imperial, FlyQuest',
    'Aurora, Astralis, 3DMAX, FaZe Clan, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-29 09:49:57',
    'stage2',
    'Kiwi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    732,
    'monte_snack',
    '723493354918379533',
    'NAVI, 3DMAX',
    'Imperial, TYLOO',
    'FaZe Clan, Liquid, Aurora, Astralis, Ninjas in Pyjamas, Fnatic',
    1,
    '2025-11-29 09:59:36',
    'stage2',
    'Monte'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    733,
    'nix_6497',
    '779804152976375828',
    'Aurora, NAVI',
    'Parivision, Imperial',
    'Astralis, 3DMAX, FaZe Clan, Liquid, Fnatic, Ninjas in Pyjamas',
    1,
    '2025-11-29 10:06:29',
    'stage2',
    'Nix_ℵ'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    734,
    'killua1051',
    '342566246123831316',
    '3DMAX, Liquid',
    'TYLOO, Imperial',
    'Aurora, NAVI, Astralis, FaZe Clan, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-29 10:14:40',
    'stage2',
    'essakessa'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    735,
    'mista0swaggg',
    '231814174030823424',
    'NAVI, 3DMAX',
    'MIBR, Passion UA',
    'Liquid, Ninjas in Pyjamas, FaZe Clan, Astralis, Aurora, FlyQuest',
    1,
    '2025-11-29 10:23:42',
    'stage2',
    'Mista0swaggg'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    736,
    'matux223',
    '657270787711041546',
    'Aurora, Astralis',
    'TYLOO, MIBR',
    'NAVI, Liquid, FlyQuest, Ninjas in Pyjamas, 3DMAX, M80',
    1,
    '2025-11-29 10:24:30',
    'stage2',
    'Assassin'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    737,
    'fiejuu',
    '1172505884782497853',
    'Aurora, Liquid',
    'Passion UA, Imperial',
    'Astralis, 3DMAX, FaZe Clan, Ninjas in Pyjamas, NAVI, FlyQuest',
    1,
    '2025-11-29 10:26:51',
    'stage2',
    'fiejuu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    739,
    '_razyy',
    '1037766729775984680',
    'Aurora, Liquid',
    'TYLOO, MIBR',
    'NAVI, Astralis, M80, FlyQuest, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-29 10:57:49',
    'stage2',
    '_razyy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    740,
    '5iontal',
    '755461769987751987',
    '3DMAX, M80',
    'TYLOO, Imperial',
    'Aurora, NAVI, Astralis, FaZe Clan, Liquid, FlyQuest',
    1,
    '2025-11-29 11:00:22',
    'stage2',
    '5iontal'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    741,
    'crash5882',
    '1278670384358621225',
    'NAVI, Aurora',
    'Passion UA, TYLOO',
    'Astralis, FaZe Clan, Liquid, M80, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-29 11:01:35',
    'stage2',
    'XeytoX'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    742,
    'macmal',
    '604552227759063040',
    'Aurora, NAVI',
    'B8, TYLOO',
    'Astralis, 3DMAX, FaZe Clan, Passion UA, Liquid, Ninjas in Pyjamas',
    1,
    '2025-11-29 11:01:35',
    'stage2',
    'Macmal'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    743,
    'konopacki',
    '809741245148692480',
    'Aurora, 3DMAX',
    'Fnatic, Imperial',
    'NAVI, Astralis, Liquid, B8, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-29 11:01:38',
    'stage2',
    'k0n0p4ck1'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    744,
    '_piter0_',
    '724151346609127445',
    'Aurora, Astralis',
    'Passion UA, TYLOO',
    'NAVI, 3DMAX, FaZe Clan, Liquid, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-29 11:01:47',
    'stage2',
    'Piter'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    745,
    'felipeelmanitas',
    '704078031567847595',
    'Aurora, Liquid',
    'TYLOO, Fnatic',
    'Astralis, 3DMAX, Passion UA, M80, Parivision, FlyQuest',
    1,
    '2025-11-29 11:01:50',
    'stage2',
    'Felipe El Manitas'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    747,
    'fabi_gs',
    '589103946921148446',
    'Aurora, M80',
    'MIBR, TYLOO',
    'NAVI, Astralis, Liquid, FlyQuest, Parivision, Ninjas in Pyjamas',
    1,
    '2025-11-29 11:02:02',
    'stage2',
    'FaBi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    748,
    'cactusj4ck_',
    '958425938746544168',
    'Aurora, NAVI',
    'Passion UA, Fnatic',
    'Liquid, 3DMAX, TYLOO, M80, FaZe Clan, FlyQuest',
    1,
    '2025-11-29 11:02:20',
    'stage2',
    'Cactus ?'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    749,
    'pastor7393',
    '518331730688475136',
    'Liquid, Ninjas in Pyjamas',
    'Passion UA, Fnatic',
    'Aurora, NAVI, Astralis, 3DMAX, FaZe Clan, M80',
    1,
    '2025-11-29 11:02:39',
    'stage2',
    'Pastor'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    750,
    'sleepy8968',
    '954381292278014082',
    'Aurora, Liquid',
    'Passion UA, Imperial',
    'NAVI, FaZe Clan, 3DMAX, M80, Ninjas in Pyjamas, FlyQuest',
    1,
    '2025-11-29 11:02:44',
    'stage2',
    'sleepy8968'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    751,
    '_sliqz',
    '1097190679773466764',
    'Aurora, 3DMAX',
    'TYLOO, MIBR',
    'Liquid, Ninjas in Pyjamas, M80, Astralis, NAVI, FaZe Clan',
    1,
    '2025-11-29 11:02:56',
    'stage2',
    '?????'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    752,
    'lukaserek',
    '678349800734851097',
    'Aurora, 3DMAX',
    'Passion UA, TYLOO',
    'NAVI, Astralis, FaZe Clan, Liquid, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-29 11:03:00',
    'stage2',
    'Luka$er'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    753,
    'matrixxxx_',
    '723525504384237620',
    'Aurora, 3DMAX',
    'Passion UA, Imperial',
    'NAVI, FaZe Clan, Liquid, M80, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-29 11:03:10',
    'stage2',
    'Matrix'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    754,
    'dukasun_cmf',
    '1330273938856476845',
    'Aurora, Liquid',
    'Passion UA, TYLOO',
    'NAVI, Astralis, 3DMAX, Ninjas in Pyjamas, Parivision, FlyQuest',
    1,
    '2025-11-29 11:03:28',
    'stage2',
    'Dukasun'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    757,
    'rogyoa',
    '486499834384220170',
    'Aurora, NAVI',
    'Passion UA, TYLOO',
    'Astralis, 3DMAX, FaZe Clan, Liquid, Fnatic, Ninjas in Pyjamas',
    1,
    '2025-11-29 11:06:26',
    'stage2',
    'Rogyoa'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    758,
    'm4sterek_',
    '1117505334869758144',
    'NAVI, Liquid',
    'TYLOO, Passion UA',
    'Aurora, 3DMAX, Astralis, FaZe Clan, Ninjas in Pyjamas, Fnatic',
    1,
    '2025-11-29 11:06:28',
    'stage2',
    'Maasterek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    759,
    'worekit',
    '590180516716871683',
    'Aurora, NAVI',
    'Imperial, Passion UA',
    'Astralis, 3DMAX, FaZe Clan, Liquid, Ninjas in Pyjamas, FlyQuest',
    1,
    '2025-11-29 11:08:30',
    'stage2',
    'Worekit'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    760,
    'chrytybob',
    '1292388710121209858',
    'Aurora, Astralis',
    'TYLOO, MIBR',
    'FaZe Clan, NAVI, Liquid, Parivision, Imperial, Ninjas in Pyjamas',
    1,
    '2025-11-29 11:10:21',
    'stage2',
    'chryty'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    761,
    'keysini_',
    '575379448757747732',
    'Aurora, Ninjas in Pyjamas',
    'TYLOO, Passion UA',
    'NAVI, B8, Parivision, Liquid, M80, Astralis',
    1,
    '2025-11-29 11:11:00',
    'stage2',
    '???????'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    763,
    'panmarudaa',
    '1060965953954910279',
    'Liquid, Ninjas in Pyjamas',
    'Passion UA, Imperial',
    'NAVI, FaZe Clan, 3DMAX, FlyQuest, Aurora, Astralis',
    1,
    '2025-11-29 11:13:05',
    'stage2',
    'PanMaruda'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    764,
    'k1ksl',
    '386495286563962880',
    'Aurora, NAVI',
    'TYLOO, Imperial',
    '3DMAX, FaZe Clan, Liquid, B8, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-29 11:13:55',
    'stage2',
    'KSL'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    766,
    'gajtan_bb',
    '668913702510002179',
    'NAVI, 3DMAX',
    'Passion UA, B8',
    'Aurora, Astralis, FaZe Clan, Liquid, Ninjas in Pyjamas, FlyQuest',
    1,
    '2025-11-29 11:19:09',
    'stage2',
    'Gajtan'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    767,
    'mati1493',
    '696087842308489237',
    'Aurora, Astralis',
    'Fnatic, B8',
    'NAVI, 3DMAX, Liquid, FlyQuest, MIBR, Ninjas in Pyjamas',
    1,
    '2025-11-29 11:20:25',
    'stage2',
    'Mati1493'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    768,
    'hubcio7480',
    '792063759521808394',
    'NAVI, 3DMAX',
    'Imperial, TYLOO',
    'FaZe Clan, Liquid, M80, Ninjas in Pyjamas, Parivision, Astralis',
    1,
    '2025-11-29 11:23:38',
    'stage2',
    'Hubcio'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    770,
    'qbinho',
    '1034910520165285898',
    'Aurora, 3DMAX',
    'Fnatic, Imperial',
    'NAVI, Astralis, Liquid, M80, Ninjas in Pyjamas, MIBR',
    1,
    '2025-11-29 11:25:54',
    'stage2',
    'Qbinho'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    771,
    'f0sti_',
    '1097066576294977547',
    'NAVI, Aurora',
    'Imperial, MIBR',
    'Astralis, 3DMAX, FaZe Clan, Liquid, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-29 11:27:23',
    'stage2',
    'F0STiii'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    773,
    'dmpb',
    '512348961080737804',
    'Astralis, Liquid',
    'TYLOO, Fnatic',
    'Aurora, NAVI, 3DMAX, Ninjas in Pyjamas, Parivision, M80',
    1,
    '2025-11-29 11:28:34',
    'stage2',
    'Blank'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    774,
    '._.iluminati._.',
    '630820180901101600',
    'Aurora, Astralis',
    'B8, TYLOO',
    'NAVI, FaZe Clan, Liquid, M80, Ninjas in Pyjamas, MIBR',
    1,
    '2025-11-29 11:28:45',
    'stage2',
    'iluminati'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    775,
    'money.',
    '682207856153591888',
    'NAVI, Aurora',
    'M80, B8',
    'Ninjas in Pyjamas, Parivision, FaZe Clan, Astralis, Fnatic, TYLOO',
    1,
    '2025-11-29 11:33:09',
    'stage2',
    '????????'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    776,
    'turb0s',
    '312232069289869322',
    'FlyQuest, Liquid',
    'Imperial, TYLOO',
    'Aurora, NAVI, Astralis, M80, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-29 11:34:42',
    'stage2',
    'Turb0s'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    778,
    'pauderek',
    '330505053314220034',
    'NAVI, Aurora',
    'Fnatic, B8',
    'Astralis, FaZe Clan, M80, TYLOO, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-29 11:40:31',
    'stage2',
    'Pauder'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    779,
    '.j4k0b_',
    '340841216507904001',
    'Liquid, 3DMAX',
    'TYLOO, Imperial',
    'Aurora, NAVI, FlyQuest, M80, B8, Parivision',
    1,
    '2025-11-29 11:44:55',
    'stage2',
    'CwelulozaOwner'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    780,
    'moobsik',
    '714543991122821120',
    'Aurora, 3DMAX',
    'Imperial, MIBR',
    'NAVI, Astralis, Liquid, FlyQuest, Ninjas in Pyjamas, Passion UA',
    1,
    '2025-11-29 11:45:10',
    'stage2',
    'moobsik'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    781,
    'ramirezkks',
    '406902151529627649',
    'Aurora, Liquid',
    'MIBR, Passion UA',
    'NAVI, 3DMAX, FaZe Clan, M80, Ninjas in Pyjamas, Parivision',
    1,
    '2025-11-29 11:50:38',
    'stage2',
    'RamirezKKS'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    782,
    'dexver1294',
    '477195073419870220',
    'Astralis, Aurora',
    'Imperial, TYLOO',
    'NAVI, FaZe Clan, Liquid, M80, FlyQuest, Ninjas in Pyjamas',
    1,
    '2025-11-29 11:52:15',
    'stage2',
    'Dexver'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    783,
    'jug3n_',
    '890220298861940767',
    'NAVI, Liquid',
    'Imperial, MIBR',
    'Aurora, Astralis, FaZe Clan, Ninjas in Pyjamas, 3DMAX, FlyQuest',
    1,
    '2025-11-29 11:53:02',
    'stage2',
    'jug3n'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    785,
    'cieplyhehe',
    '461851082570596352',
    'FURIA, Vitality',
    'Falcons, MOUZ',
    '3DMAX, Imperial, PARIVISION, Passion UA, B8, Liquid',
    1,
    '2025-12-02 21:12:13',
    'stage3',
    'Ciepły'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    786,
    'makuwk1233',
    '627796290788392970',
    'FURIA, MOUZ',
    'Passion UA, Imperial',
    'The Mongolz, Falcons, Vitality, Spirit, NAVI, Faze Clan',
    1,
    '2025-12-02 21:17:04',
    'stage3',
    'makuwk1233'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    787,
    'nekutv',
    '723588449151746050',
    'FURIA, Faze Clan',
    'paIN, G2',
    'Falcons, Vitality, MOUZ, NAVI, Spirit, Liquid',
    1,
    '2025-12-02 21:17:05',
    'stage3',
    'Neku'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    788,
    'matux223',
    '657270787711041546',
    'MOUZ, Falcons',
    'Passion UA, G2',
    'FURIA, Vitality, NAVI, Spirit, The Mongolz, paIN',
    1,
    '2025-12-02 21:17:08',
    'stage3',
    'Assassin'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    789,
    'ezsalty',
    '804729333276868609',
    'FURIA, MOUZ',
    'Passion UA, B8',
    'Vitality, Falcons, The Mongolz, Spirit, NAVI, G2',
    1,
    '2025-12-02 21:17:15',
    'stage3',
    'salty'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    790,
    'gloogloo_',
    '1000080089888862278',
    'FURIA, Faze Clan',
    'Imperial, Passion UA',
    'Vitality, Falcons, MOUZ, Liquid, Spirit, NAVI',
    1,
    '2025-12-02 21:17:25',
    'stage3',
    'fieliep'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    791,
    'm9jkol',
    '1276633433166188544',
    'FURIA, Vitality',
    'PARIVISION, Imperial',
    'Falcons, Faze Clan, MOUZ, Spirit, G2, NAVI',
    1,
    '2025-12-02 21:17:29',
    'stage3',
    'M9JKOL'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    792,
    'wojtass._.',
    '815342777918554122',
    'FURIA, Spirit',
    'paIN, Passion UA',
    'Vitality, Falcons, MOUZ, G2, PARIVISION, NAVI',
    1,
    '2025-12-02 21:17:31',
    'stage3',
    'Wojtas.'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    793,
    'bili13',
    '517441265575526400',
    'Vitality, Spirit',
    'Liquid, Imperial',
    'FURIA, Falcons, MOUZ, NAVI, G2, Faze Clan',
    1,
    '2025-12-02 21:17:45',
    'stage3',
    'bili13'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    794,
    'm4sterek_',
    '1117505334869758144',
    'FURIA, Vitality',
    'Passion UA, Imperial',
    'Falcons, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-02 21:17:58',
    'stage3',
    'Maasterek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    795,
    'nextcsgo',
    '1133673169350307931',
    'FURIA, Vitality',
    'Passion UA, Imperial',
    'Falcons, The Mongolz, Faze Clan, Liquid, Spirit, NAVI',
    1,
    '2025-12-02 21:18:24',
    'stage3',
    'PJ'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    796,
    '_skowron.',
    '790973841257922561',
    'MOUZ, Falcons',
    'Imperial, B8',
    'Vitality, Spirit, NAVI, Faze Clan, FURIA, PARIVISION',
    1,
    '2025-12-02 21:18:32',
    'stage3',
    '_skowron.'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    797,
    'milly_yy',
    '471399701976055818',
    'Faze Clan, Vitality',
    'Passion UA, B8',
    'FURIA, Falcons, Spirit, NAVI, G2, Liquid',
    1,
    '2025-12-02 21:18:35',
    'stage3',
    'Milyy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    798,
    'crestofek',
    '1439298047946522686',
    'FURIA, The Mongolz',
    'Passion UA, 3DMAX',
    'Vitality, Falcons, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-02 21:20:17',
    'stage3',
    'crestofek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    799,
    'mulcik',
    '498845748792786944',
    'Vitality, Falcons',
    'Imperial, 3DMAX',
    'FURIA, MOUZ, Spirit, G2, Faze Clan, NAVI',
    1,
    '2025-12-02 21:20:42',
    'stage3',
    'Multi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    800,
    'statkowy12',
    '662546565251989515',
    'Vitality, Falcons',
    'Passion UA, Imperial',
    'G2, Faze Clan, NAVI, MOUZ, The Mongolz, Spirit',
    1,
    '2025-12-02 21:21:08',
    'stage3',
    'statkowy12'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    801,
    'mukiufi',
    '713422719957467187',
    'Vitality, FURIA',
    'Passion UA, paIN',
    'NAVI, Spirit, G2, Faze Clan, 3DMAX, Imperial',
    1,
    '2025-12-02 21:21:34',
    'stage3',
    'Muki'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    802,
    'olo5137',
    '932271244345233439',
    'FURIA, Falcons',
    'Passion UA, Imperial',
    'Vitality, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-02 21:23:58',
    'stage3',
    'srajkez'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    803,
    'chrytybob',
    '1292388710121209858',
    'MOUZ, G2',
    'Passion UA, Imperial',
    'FURIA, Vitality, Falcons, Spirit, NAVI, Faze Clan',
    1,
    '2025-12-02 21:24:17',
    'stage3',
    'chryty'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    804,
    'banderas4200',
    '228173160355332097',
    'Falcons, FURIA',
    'Passion UA, B8',
    'Vitality, The Mongolz, Faze Clan, 3DMAX, Spirit, G2',
    1,
    '2025-12-02 21:27:24',
    'stage3',
    'Banderas'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    805,
    'sqiel',
    '420597124724555777',
    'FURIA, Falcons',
    'Passion UA, Imperial',
    'Vitality, MOUZ, The Mongolz, Spirit, G2, Faze Clan',
    1,
    '2025-12-02 21:28:13',
    'stage3',
    'sqiel'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    806,
    'wentylek0g',
    '1284199463216349188',
    'Vitality, FURIA',
    'Passion UA, PARIVISION',
    'Falcons, The Mongolz, Spirit, Faze Clan, MOUZ, G2',
    1,
    '2025-12-02 21:29:17',
    'stage3',
    'jimmy czu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    807,
    'rekinek66__99378',
    '1254016863533531192',
    'Falcons, MOUZ',
    'Imperial, Passion UA',
    'Faze Clan, NAVI, Spirit, FURIA, paIN, Vitality',
    1,
    '2025-12-02 21:29:23',
    'stage3',
    'Rekinek66'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    809,
    'ramirezkks',
    '406902151529627649',
    'Falcons, FURIA',
    'paIN, Passion UA',
    'Vitality, MOUZ, Spirit, NAVI, Faze Clan, Liquid',
    1,
    '2025-12-02 21:32:33',
    'stage3',
    'RamirezKKS'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    810,
    '.pikom',
    '710794795529928785',
    'FURIA, Falcons',
    'Imperial, Passion UA',
    'Vitality, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-02 21:34:03',
    'stage3',
    'PIKOM'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    812,
    'shesaskurwol',
    '905494286005583872',
    'NAVI, Spirit',
    'Passion UA, Imperial',
    'Vitality, Falcons, MOUZ, G2, Faze Clan, Liquid',
    1,
    '2025-12-02 21:38:21',
    'stage3',
    'shesaskurwol'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    813,
    'xkuba6969',
    '486957798207258635',
    'Falcons, MOUZ',
    'Imperial, Passion UA',
    'FURIA, Vitality, Faze Clan, Spirit, NAVI, G2',
    1,
    '2025-12-02 21:40:20',
    'stage3',
    'Kuba'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    814,
    'pikaczu7247',
    '1049079069335101440',
    'FURIA, MOUZ',
    'B8, Imperial',
    'Vitality, Falcons, The Mongolz, Spirit, G2, PARIVISION',
    1,
    '2025-12-02 21:41:29',
    'stage3',
    'xnPiciuchny'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    815,
    'botgat',
    '415864755845070850',
    'MOUZ, Spirit',
    'B8, paIN',
    'FURIA, Vitality, Falcons, The Mongolz, NAVI, Faze Clan',
    1,
    '2025-12-02 21:43:48',
    'stage3',
    'BOTGAT'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    816,
    'rogyoa',
    '486499834384220170',
    'FURIA, Vitality',
    'B8, paIN',
    'Falcons, MOUZ, The Mongolz, G2, Faze Clan, Spirit',
    1,
    '2025-12-02 21:45:16',
    'stage3',
    'Rogyoa'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    817,
    'dmpb',
    '512348961080737804',
    'Falcons, MOUZ',
    'Passion UA, 3DMAX',
    'FURIA, Vitality, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-02 21:45:31',
    'stage3',
    'Blank'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    818,
    'gemainda',
    '964187009520377856',
    'Vitality, Falcons',
    'Passion UA, PARIVISION',
    'The Mongolz, Spirit, NAVI, Faze Clan, Liquid, FURIA',
    1,
    '2025-12-02 21:45:48',
    'stage3',
    'Gemainda'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    819,
    'tomciomurarz',
    '506914119710932993',
    'MOUZ, G2',
    'Imperial, Passion UA',
    'FURIA, Vitality, Falcons, Spirit, NAVI, Faze Clan',
    1,
    '2025-12-02 21:46:13',
    'stage3',
    'fre3sh'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    820,
    'luxor_.',
    '322812891956903937',
    'Falcons, Vitality',
    'Liquid, Passion UA',
    'FURIA, Spirit, NAVI, Faze Clan, MOUZ, The Mongolz',
    1,
    '2025-12-02 21:47:30',
    'stage3',
    'Luxor'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    821,
    '.metyl.',
    '801164867457253406',
    'Falcons, FURIA',
    'paIN, B8',
    'Spirit, NAVI, Faze Clan, PARIVISION, Vitality, The Mongolz',
    1,
    '2025-12-02 21:47:43',
    'stage3',
    '☢?????☢'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    823,
    'jacaplaca2115',
    '692431475139805305',
    'FURIA, Falcons',
    'Passion UA, Imperial',
    'Vitality, MOUZ, The Mongolz, Spirit, Faze Clan, G2',
    1,
    '2025-12-02 21:50:06',
    'stage3',
    'jxcxk'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    824,
    'cziki4406',
    '361572745147842563',
    'Vitality, Falcons',
    'PARIVISION, Imperial',
    'FURIA, MOUZ, The Mongolz, Spirit, Faze Clan, G2',
    1,
    '2025-12-02 21:51:24',
    'stage3',
    'CziKi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    825,
    'xczaro0',
    '723447196388819014',
    'MOUZ, Falcons',
    'Imperial, Passion UA',
    'Spirit, G2, Faze Clan, FURIA, Vitality, NAVI',
    1,
    '2025-12-02 21:52:34',
    'stage3',
    'XcZaRo'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    826,
    'peper232',
    '1182053587774341170',
    'FURIA, Falcons',
    'Imperial, Passion UA',
    'Vitality, MOUZ, G2, Faze Clan, PARIVISION, NAVI',
    1,
    '2025-12-02 21:55:31',
    'stage3',
    'Pleple'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    827,
    'consaramgateun',
    '727134099231211571',
    'Falcons, MOUZ',
    'B8, Imperial',
    'FURIA, Vitality, Spirit, NAVI, paIN, Faze Clan',
    1,
    '2025-12-02 21:55:41',
    'stage3',
    '촌사람 같은'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    828,
    'quiq19',
    '542361412127686657',
    'MOUZ, FURIA',
    'PARIVISION, Imperial',
    'Faze Clan, NAVI, Spirit, Falcons, Vitality, The Mongolz',
    1,
    '2025-12-02 21:57:47',
    'stage3',
    'Quiq'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    829,
    'zenekdb9',
    '312633551466135553',
    'Falcons, NAVI',
    'Imperial, Passion UA',
    'FURIA, Vitality, MOUZ, Spirit, G2, Faze Clan',
    1,
    '2025-12-02 21:58:21',
    'stage3',
    'ZenSoul'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    830,
    '.j4k0b_',
    '340841216507904001',
    'FURIA, MOUZ',
    'Passion UA, The Mongolz',
    'Vitality, Falcons, NAVI, G2, Faze Clan, Liquid',
    1,
    '2025-12-02 21:59:29',
    'stage3',
    'CwelulozaOwner'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    831,
    'crackduck32_',
    '1084250127084028015',
    'FURIA, Falcons',
    'PARIVISION, B8',
    'Faze Clan, Vitality, G2, MOUZ, The Mongolz, paIN',
    1,
    '2025-12-02 22:00:37',
    'stage3',
    'FFK Posh'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    832,
    '4fire2alpaca0',
    '581860728240340992',
    'Falcons, MOUZ',
    'Passion UA, Imperial',
    'FURIA, Vitality, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-02 22:00:44',
    'stage3',
    'DAMN1ggy_'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    833,
    'pumbarr',
    '733573014402236449',
    'FURIA, Falcons',
    'Imperial, 3DMAX',
    'Vitality, MOUZ, The Mongolz, NAVI, Spirit, G2',
    1,
    '2025-12-02 22:02:32',
    'stage3',
    '?????'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    835,
    'cnoccs',
    '1250835724169777277',
    'NAVI, FURIA',
    '3DMAX, Imperial',
    'Falcons, Vitality, Spirit, Liquid, Faze Clan, MOUZ',
    1,
    '2025-12-02 22:08:27',
    'stage3',
    'everyone'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    837,
    't1mero',
    '340076455868235777',
    'FURIA, Falcons',
    'Imperial, Passion UA',
    'Vitality, MOUZ, Spirit, paIN, Faze Clan, B8',
    1,
    '2025-12-02 22:15:08',
    'stage3',
    'T1mero'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    838,
    'deyanek',
    '350604331621548032',
    'FURIA, Falcons',
    'Imperial, 3DMAX',
    'Vitality, MOUZ, The Mongolz, Spirit, NAVI, Faze Clan',
    1,
    '2025-12-02 22:17:43',
    'stage3',
    'Deyanek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    839,
    'siemasiema1312',
    '447785515186520064',
    'Falcons, MOUZ',
    'Imperial, Liquid',
    'FURIA, Vitality, Spirit, NAVI, B8, PARIVISION',
    1,
    '2025-12-02 22:20:02',
    'stage3',
    'siemasiema1312'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    840,
    'smashix.',
    '662341682649366530',
    'FURIA, Falcons',
    'Passion UA, Imperial',
    'Vitality, The Mongolz, Spirit, NAVI, Faze Clan, PARIVISION',
    1,
    '2025-12-02 22:21:59',
    'stage3',
    'SmashiX'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    841,
    'topor7640',
    '815686164710162432',
    'Vitality, Falcons',
    'Passion UA, PARIVISION',
    'FURIA, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-02 22:22:00',
    'stage3',
    'Topór'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    842,
    'monczall',
    '419278999991353374',
    'Falcons, Vitality',
    'PARIVISION, paIN',
    'Faze Clan, Spirit, FURIA, 3DMAX, MOUZ, The Mongolz',
    1,
    '2025-12-02 22:25:03',
    'stage3',
    'Monczall'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    843,
    'fazer85',
    '333906708336476170',
    'FURIA, Falcons',
    '3DMAX, Liquid',
    'Vitality, MOUZ, NAVI, Spirit, G2, Faze Clan',
    1,
    '2025-12-02 22:25:28',
    'stage3',
    'Fazer*'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    844,
    'buldogun_94238',
    '1284075325042724900',
    'FURIA, Falcons',
    'B8, Imperial',
    'Vitality, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-02 22:28:32',
    'stage3',
    'Buldogun'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    845,
    'kiwi___67',
    '879476380562235392',
    'Falcons, FURIA',
    'Imperial, Passion UA',
    'Vitality, MOUZ, Faze Clan, NAVI, G2, The Mongolz',
    1,
    '2025-12-02 22:29:24',
    'stage3',
    'Kiwi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    846,
    'didek0188',
    '419405937728684032',
    'FURIA, Falcons',
    'Passion UA, Imperial',
    'Vitality, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-02 22:32:00',
    'stage3',
    'didek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    847,
    'majkutini',
    '1219387685425254441',
    'Falcons, NAVI',
    'The Mongolz, 3DMAX',
    'FURIA, Vitality, MOUZ, Spirit, Faze Clan, Liquid',
    1,
    '2025-12-02 22:40:15',
    'stage3',
    '! Мajkutini'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    848,
    'cross4176',
    '867161106493866006',
    'FURIA, Vitality',
    'PARIVISION, Passion UA',
    'MOUZ, The Mongolz, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-02 22:52:07',
    'stage3',
    'cross'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    849,
    'xniko1',
    '529027111504314399',
    'FURIA, NAVI',
    'Passion UA, Imperial',
    'Vitality, MOUZ, Spirit, The Mongolz, Faze Clan, Liquid',
    1,
    '2025-12-02 22:55:25',
    'stage3',
    'xNiko'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    850,
    'matiwk222',
    '1081626433266393198',
    'FURIA, Vitality',
    'B8, paIN',
    'Falcons, MOUZ, Spirit, NAVI, Faze Clan, The Mongolz',
    1,
    '2025-12-02 23:00:14',
    'stage3',
    'matiwk222'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    851,
    'mobbyn_mlodyg',
    '1204544158828597325',
    'G2, MOUZ',
    'Passion UA, Imperial',
    'Vitality, Faze Clan, NAVI, Falcons, FURIA, Spirit',
    1,
    '2025-12-02 23:09:09',
    'stage3',
    'arsiif'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    852,
    'subweydear',
    '789922633012609044',
    'Vitality, Falcons',
    'Imperial, Passion UA',
    'MOUZ, FURIA, Faze Clan, NAVI, Spirit, B8',
    1,
    '2025-12-02 23:10:07',
    'stage3',
    'Subwey'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    853,
    'zajchuu',
    '656537113394937866',
    'Falcons, FURIA',
    'Passion UA, B8',
    'Vitality, Spirit, NAVI, PARIVISION, Liquid, Faze Clan',
    1,
    '2025-12-02 23:14:42',
    'stage3',
    'zajchuu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    854,
    'bombix777',
    '1145443406638751815',
    'FURIA, Faze Clan',
    'Spirit, paIN',
    'Vitality, Falcons, MOUZ, G2, Liquid, NAVI',
    1,
    '2025-12-02 23:18:39',
    'stage3',
    'bombix'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    855,
    'anteg02',
    '1310326288011231294',
    'FURIA, Falcons',
    '3DMAX, Imperial',
    'NAVI, Spirit, G2, Faze Clan, Liquid, Vitality',
    1,
    '2025-12-02 23:46:11',
    'stage3',
    'Antek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    856,
    'jokermariusz',
    '409748306282151948',
    'Vitality, The Mongolz',
    '3DMAX, paIN',
    'FURIA, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-02 23:50:00',
    'stage3',
    'jokermariusz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    857,
    'mjkaelo',
    '498152549451563009',
    'Falcons, MOUZ',
    'Imperial, Passion UA',
    'FURIA, Vitality, Spirit, NAVI, Faze Clan, Liquid',
    1,
    '2025-12-03 00:03:28',
    'stage3',
    'mjkaelo'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    858,
    'savi0x',
    '627115371878416385',
    'FURIA, Vitality',
    'B8, Passion UA',
    'Falcons, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-03 00:41:37',
    'stage3',
    'Savi0X'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    860,
    'panciovsky',
    '352823893003730945',
    'FURIA, Vitality',
    'Imperial, Passion UA',
    'Falcons, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-03 01:02:46',
    'stage3',
    'Pancio ツ'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    861,
    'grubycoach',
    '435779589864816640',
    'FURIA, Falcons',
    'paIN, Imperial',
    'Vitality, MOUZ, The Mongolz, Spirit, NAVI, Faze Clan',
    1,
    '2025-12-03 01:27:04',
    'stage3',
    'Grubycoach'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    862,
    'mikekosa',
    '615538803687424011',
    'FURIA, Vitality',
    'Imperial, Passion UA',
    'Falcons, MOUZ, NAVI, Faze Clan, Spirit, The Mongolz',
    1,
    '2025-12-03 01:38:54',
    'stage3',
    'mikekosa'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    863,
    'terapeutaaa',
    '864932529789206629',
    'FURIA, Vitality',
    'Passion UA, Imperial',
    'Falcons, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-03 01:42:03',
    'stage3',
    'Terapeutaaa'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    864,
    'bartus0858',
    '1275527297893531772',
    'Vitality, The Mongolz',
    'Passion UA, B8',
    'FURIA, Falcons, MOUZ, Spirit, NAVI, paIN',
    1,
    '2025-12-03 03:58:41',
    'stage3',
    'Bartuss'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    865,
    'emeryt.muchson',
    '471463411239092225',
    'FURIA, Vitality',
    'B8, Imperial',
    'Falcons, MOUZ, Spirit, NAVI, paIN, Faze Clan',
    1,
    '2025-12-03 04:20:53',
    'stage3',
    '-muchson-'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    866,
    'dorkej',
    '646804591853436946',
    'Falcons, Vitality',
    'Imperial, Passion UA',
    'FURIA, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-03 04:51:52',
    'stage3',
    'Dorkej'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    867,
    'gajtan_bb',
    '668913702510002179',
    'FURIA, Vitality',
    'paIN, Passion UA',
    'Falcons, MOUZ, G2, Spirit, The Mongolz, Faze Clan',
    1,
    '2025-12-03 05:15:11',
    'stage3',
    'Gajtan'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    868,
    'zysio',
    '762270778754203688',
    'FURIA, Vitality',
    'Imperial, Passion UA',
    'Faze Clan, Spirit, NAVI, Falcons, MOUZ, The Mongolz',
    1,
    '2025-12-03 05:15:12',
    'stage3',
    'zysio'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    869,
    'deter_alt',
    '1023203535971684425',
    'Falcons, FURIA',
    'Passion UA, Imperial',
    'Vitality, MOUZ, Spirit, Faze Clan, G2, The Mongolz',
    1,
    '2025-12-03 05:39:39',
    'stage3',
    'Deter'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    870,
    'kper_',
    '463001727310757888',
    'FURIA, Falcons',
    'B8, Imperial',
    'Vitality, MOUZ, The Mongolz, Spirit, NAVI, G2',
    1,
    '2025-12-03 05:53:49',
    'stage3',
    'Kper'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    871,
    'kerajz',
    '929472369595146342',
    'FURIA, Falcons',
    'Imperial, paIN',
    'Vitality, MOUZ, The Mongolz, Spirit, NAVI, Faze Clan',
    1,
    '2025-12-03 06:01:33',
    'stage3',
    'kerajz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    873,
    'bamu5',
    '1272830126832226355',
    'FURIA, Vitality',
    'Imperial, Passion UA',
    'MOUZ, Spirit, NAVI, Faze Clan, Liquid, 3DMAX',
    1,
    '2025-12-03 06:15:25',
    'stage3',
    'Ewok'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    874,
    '_prosik_5678_',
    '779402540755976192',
    'Faze Clan, Liquid',
    'MOUZ, Imperial',
    'FURIA, Vitality, Falcons, NAVI, paIN, G2',
    1,
    '2025-12-03 07:03:15',
    'stage3',
    '_prosik_5678_'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    875,
    'd1oxie',
    '453811822320025603',
    'FURIA, Faze Clan',
    'PARIVISION, B8',
    'Vitality, Falcons, MOUZ, NAVI, G2, Liquid',
    1,
    '2025-12-03 07:51:01',
    'stage3',
    'D1oxie'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    876,
    'dekus7692',
    '472474920270561281',
    'Falcons, MOUZ',
    'PARIVISION, Imperial',
    'FURIA, Vitality, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-03 08:14:48',
    'stage3',
    'Dekus'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    877,
    'skyshafiq',
    '882519104316137502',
    'FURIA, Vitality',
    'PARIVISION, Passion UA',
    'The Mongolz, Falcons, Spirit, MOUZ, Faze Clan, NAVI',
    1,
    '2025-12-03 08:15:32',
    'stage3',
    'Sky Shafiq'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    878,
    'geeciu_es',
    '823526692189634580',
    'FURIA, Spirit',
    'Liquid, Imperial',
    'Vitality, Falcons, MOUZ, NAVI, G2, Faze Clan',
    1,
    '2025-12-03 08:24:23',
    'stage3',
    'geeciu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    879,
    '_kml777',
    '896147575093198958',
    'FURIA, Falcons',
    'Imperial, B8',
    'Vitality, MOUZ, Spirit, Faze Clan, NAVI, G2',
    1,
    '2025-12-03 08:29:49',
    'stage3',
    'KmL'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    880,
    'hopper2137',
    '614884618272768038',
    'Falcons, G2',
    'Liquid, Imperial',
    'Vitality, FURIA, MOUZ, NAVI, paIN, Faze Clan',
    1,
    '2025-12-03 09:00:08',
    'stage3',
    'hopper'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    881,
    'feranxd',
    '1337893397721251894',
    'FURIA, MOUZ',
    'Passion UA, Imperial',
    'Falcons, Vitality, Faze Clan, PARIVISION, NAVI, Spirit',
    1,
    '2025-12-03 09:00:24',
    'stage3',
    'Feran'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    882,
    'bartmacieja',
    '808309868586467348',
    'Vitality, Falcons',
    'Imperial, Passion UA',
    'FURIA, The Mongolz, Spirit, NAVI, MOUZ, Faze Clan',
    1,
    '2025-12-03 09:10:39',
    'stage3',
    'bartmacieja'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    883,
    'za.xx.xx',
    '811601970506629150',
    'FURIA, Vitality',
    'Liquid, Passion UA',
    'Falcons, MOUZ, Spirit, NAVI, Faze Clan, 3DMAX',
    1,
    '2025-12-03 09:25:00',
    'stage3',
    'KebabikRHC'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    884,
    'uniq7565',
    '428666355965755396',
    'FURIA, Falcons',
    'Passion UA, Imperial',
    'Vitality, MOUZ, The Mongolz, Spirit, NAVI, G2',
    1,
    '2025-12-03 09:32:24',
    'stage3',
    'uniq7565'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    885,
    'sebaziomek',
    '555800660357021696',
    'Vitality, paIN',
    'G2, 3DMAX',
    'FURIA, Spirit, Liquid, Faze Clan, Falcons, Passion UA',
    1,
    '2025-12-03 09:50:37',
    'stage3',
    'Тотя ❤'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    886,
    'gila.pl',
    '1181560396121907252',
    'FURIA, Vitality',
    'Passion UA, PARIVISION',
    'Falcons, MOUZ, Spirit, NAVI, Faze Clan, G2',
    1,
    '2025-12-03 10:07:13',
    'stage3',
    'świąteczny gila'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    888,
    'ixperi',
    '809314209971437598',
    'FURIA, Falcons',
    'Passion UA, Imperial',
    'Faze Clan, Spirit, 3DMAX, MOUZ, Vitality, NAVI',
    1,
    '2025-12-03 10:34:09',
    'stage3',
    'IxPeRI'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    889,
    'mista0swaggg',
    '231814174030823424',
    'FURIA, Vitality',
    'paIN, Passion UA',
    'Falcons, MOUZ, Spirit, Faze Clan, Liquid, B8',
    1,
    '2025-12-03 10:45:11',
    'stage3',
    'Mista0swaggg'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    892,
    'diptu',
    '509429079464738840',
    'FURIA, Vitality',
    'Imperial, Passion UA',
    'Falcons, MOUZ, Spirit, NAVI, G2, Liquid',
    1,
    '2025-12-03 11:25:26',
    'stage3',
    'Diptu'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    893,
    'pigo2450',
    '919347146405339138',
    'Spirit, FURIA',
    '3DMAX, B8',
    'Falcons, Vitality, MOUZ, The Mongolz, G2, PARIVISION',
    1,
    '2025-12-03 11:29:54',
    'stage3',
    'POPROSTUFABIAN'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    894,
    'k1ksl',
    '386495286563962880',
    'Vitality, NAVI',
    'Imperial, Liquid',
    'FURIA, Falcons, MOUZ, Spirit, paIN, Faze Clan',
    1,
    '2025-12-03 11:50:19',
    'stage3',
    'KSL'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    896,
    'biblethump2476',
    '291621406708465664',
    'MOUZ, Falcons',
    'Imperial, G2',
    'FURIA, Vitality, Faze Clan, Liquid, Spirit, PARIVISION',
    1,
    '2025-12-03 12:07:01',
    'stage3',
    'angel'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    897,
    'liquid1487',
    '757903126157328385',
    'FURIA, Vitality',
    'B8, Passion UA',
    'Falcons, MOUZ, Spirit, NAVI, Faze Clan, Liquid',
    1,
    '2025-12-03 12:07:11',
    'stage3',
    'Liquid4K'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    898,
    'dexver1294',
    '477195073419870220',
    'Faze Clan, G2',
    'Imperial, Passion UA',
    'FURIA, Vitality, Falcons, MOUZ, Spirit, NAVI',
    1,
    '2025-12-03 12:40:41',
    'stage3',
    'Dexver'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    899,
    '_sergioramos_',
    '895331618590441523',
    'FURIA, Vitality',
    'PARIVISION, B8',
    'Falcons, Spirit, paIN, Faze Clan, The Mongolz, MOUZ',
    1,
    '2025-12-03 12:42:53',
    'stage3',
    'Asencio'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    900,
    'mrmarty.pl_87228',
    '1145386101264109669',
    'NAVI, Faze Clan',
    'PARIVISION, B8',
    'FURIA, Imperial, Vitality, MOUZ, Liquid, Falcons',
    1,
    '2025-12-03 12:47:34',
    'stage3',
    'Mr Marty'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    901,
    'lebszot',
    '359370791076364290',
    'FURIA, Vitality',
    'Passion UA, Imperial',
    'Falcons, MOUZ, Spirit, NAVI, G2, Liquid',
    1,
    '2025-12-03 12:50:49',
    'stage3',
    'ŁeB SzOt'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    902,
    'lukasz9842',
    '548248747977474048',
    'Vitality, Falcons',
    'paIN, Passion UA',
    'FURIA, MOUZ, NAVI, G2, Faze Clan, Liquid',
    1,
    '2025-12-03 13:08:08',
    'stage3',
    'Łukasz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    903,
    'keysini_',
    '575379448757747732',
    'FURIA, Falcons',
    'Liquid, Imperial',
    'Vitality, MOUZ, NAVI, Faze Clan, G2, Spirit',
    1,
    '2025-12-03 13:11:18',
    'stage3',
    '???????'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    904,
    'nfixme',
    '788345818343669760',
    'The Mongolz, Falcons',
    'Imperial, Passion UA',
    'FURIA, Vitality, MOUZ, Spirit, NAVI, G2',
    1,
    '2025-12-03 13:19:47',
    'stage3',
    'nfixme ༉‧₊˚✧'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    905,
    'sleepy8968',
    '954381292278014082',
    'FURIA, MOUZ',
    'The Mongolz, Imperial',
    'Vitality, Falcons, Spirit, NAVI, paIN, Faze Clan',
    1,
    '2025-12-03 13:38:35',
    'stage3',
    'sleepy8968'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    907,
    'qbinho',
    '1034910520165285898',
    'FURIA, Vitality',
    'Passion UA, B8',
    'Falcons, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-03 13:46:31',
    'stage3',
    'Qbinho'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    908,
    'kayesssss',
    '525034117105188865',
    'Vitality, FURIA',
    'Imperial, Passion UA',
    'Spirit, NAVI, Faze Clan, MOUZ, Falcons, Liquid',
    1,
    '2025-12-03 13:47:47',
    'stage3',
    'KayEss'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    909,
    'iggssk',
    '463234527850921985',
    'MOUZ, Faze Clan',
    'Passion UA, B8',
    'FURIA, Vitality, Falcons, NAVI, PARIVISION, paIN',
    1,
    '2025-12-03 13:53:50',
    'stage3',
    'Igssk'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    911,
    'ummopolaco_17150',
    '1288098809595039796',
    'FURIA, Spirit',
    'The Mongolz, Passion UA',
    'Vitality, Falcons, MOUZ, NAVI, Faze Clan, Imperial',
    1,
    '2025-12-03 13:58:29',
    'stage3',
    'Ummopolaco'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    912,
    'nooscar6',
    '451016732551675905',
    'Vitality, NAVI',
    'Passion UA, Imperial',
    'FURIA, Falcons, MOUZ, G2, Faze Clan, The Mongolz',
    1,
    '2025-12-03 14:00:10',
    'stage3',
    'nscr'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    913,
    'sadz1k',
    '305737641763274752',
    'Vitality, FURIA',
    'B8, PARIVISION',
    'Falcons, MOUZ, NAVI, G2, Spirit, Faze Clan',
    1,
    '2025-12-03 14:02:19',
    'stage3',
    'sadz1k'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    914,
    'xseti_',
    '1078726241680633857',
    'Vitality, FURIA',
    'The Mongolz, Spirit',
    'MOUZ, NAVI, Faze Clan, Liquid, 3DMAX, PARIVISION',
    1,
    '2025-12-03 14:10:09',
    'stage3',
    'xSetiツ_'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    915,
    '_razyy',
    '1037766729775984680',
    'FURIA, Vitality',
    '3DMAX, B8',
    'Falcons, MOUZ, Spirit, NAVI, Faze Clan, Liquid',
    1,
    '2025-12-03 14:13:11',
    'stage3',
    '_razyy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    916,
    'blmateo710_72124',
    '1396160636639117372',
    'MOUZ, NAVI',
    'Imperial, Passion UA',
    'FURIA, Vitality, Falcons, Spirit, G2, Faze Clan',
    1,
    '2025-12-03 14:15:43',
    'stage3',
    'BL Mateo710'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    917,
    'turb0s',
    '312232069289869322',
    'FURIA, Vitality',
    'Imperial, Passion UA',
    'Falcons, MOUZ, Spirit, NAVI, Faze Clan, paIN',
    1,
    '2025-12-03 14:30:43',
    'stage3',
    'Turb0s'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    918,
    'grubcio2851',
    '510573405569941515',
    'G2, Vitality',
    'Liquid, Spirit',
    'FURIA, Falcons, NAVI, B8, Faze Clan, MOUZ',
    1,
    '2025-12-03 14:38:06',
    'stage3',
    'Grubcio'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    919,
    'jc0bs',
    '1099627480911978526',
    'FURIA, Vitality',
    'Passion UA, Imperial',
    'Falcons, MOUZ, The Mongolz, Spirit, NAVI, paIN',
    1,
    '2025-12-03 14:38:26',
    'stage3',
    'jc0bs'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    920,
    'adleko29',
    '737688687227306075',
    'FURIA, MOUZ',
    'Passion UA, B8',
    'Vitality, Falcons, NAVI, G2, Faze Clan, Liquid',
    1,
    '2025-12-03 14:40:34',
    'stage3',
    'adleko'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    922,
    'bolotv',
    '693547426212216892',
    'Falcons, Spirit',
    'Passion UA, Liquid',
    'FURIA, Vitality, MOUZ, NAVI, G2, paIN',
    1,
    '2025-12-03 15:16:03',
    'stage3',
    'BoloTv'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    924,
    'xan.1312',
    '1164627142533972029',
    'Faze Clan, Falcons',
    'Imperial, Passion UA',
    'MOUZ, Vitality, FURIA, G2, Spirit, NAVI',
    1,
    '2025-12-03 15:26:34',
    'stage3',
    'xan'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    925,
    'patryk27_',
    '1077219449502965790',
    'Falcons, MOUZ',
    'Imperial, Passion UA',
    'FURIA, Vitality, NAVI, G2, Faze Clan, Spirit',
    1,
    '2025-12-03 15:49:59',
    'stage3',
    'JakoN-'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    926,
    'plkp.1337',
    '862041274973552651',
    'FURIA, Falcons',
    'Passion UA, Imperial',
    'Vitality, MOUZ, Spirit, NAVI, Faze Clan, 3DMAX',
    1,
    '2025-12-03 15:51:32',
    'stage3',
    'BqMaJsTeR'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    927,
    'dr.macika',
    '761587793893654549',
    'Falcons, MOUZ',
    'Imperial, Passion UA',
    'FURIA, Vitality, Spirit, NAVI, Faze Clan, G2',
    1,
    '2025-12-03 15:57:04',
    'stage3',
    'Dr.Macika'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    928,
    '.marcineq',
    '478486060943540225',
    'FURIA, MOUZ',
    'Passion UA, Imperial',
    'Vitality, Falcons, Spirit, NAVI, Faze Clan, G2',
    1,
    '2025-12-03 16:14:15',
    'stage3',
    'Marcineq'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    929,
    'norce92',
    '1172057126240272385',
    'MOUZ, G2',
    'B8, paIN',
    'FURIA, Vitality, Falcons, Faze Clan, NAVI, Spirit',
    1,
    '2025-12-03 16:21:27',
    'stage3',
    'NOrce'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    930,
    '_lesiak',
    '846006823899103253',
    'Vitality, Falcons',
    'Passion UA, Imperial',
    'FURIA, MOUZ, NAVI, Faze Clan, Liquid, Spirit',
    1,
    '2025-12-03 16:25:44',
    'stage3',
    'les1ak-'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    931,
    'pbialy123',
    '320224049760567296',
    'Falcons, G2',
    'Passion UA, Imperial',
    'FURIA, Vitality, MOUZ, NAVI, Faze Clan, B8',
    1,
    '2025-12-03 16:28:28',
    'stage3',
    'pbialy123'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    932,
    'xqbik',
    '532912683666898944',
    'Falcons, MOUZ',
    'Passion UA, PARIVISION',
    'FURIA, Vitality, NAVI, G2, Faze Clan, Spirit',
    1,
    '2025-12-03 16:32:48',
    'stage3',
    'xQBIK.wav'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    933,
    'czipsol',
    '383712116005404675',
    'Falcons, FURIA',
    'Passion UA, Liquid',
    'Vitality, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-03 16:44:50',
    'stage3',
    'czipsol'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    934,
    'itslockz',
    '773526091628412930',
    'Faze Clan, MOUZ',
    'Liquid, Imperial',
    'FURIA, Vitality, Falcons, NAVI, Spirit, G2',
    1,
    '2025-12-03 16:45:17',
    'stage3',
    'itsLoCKz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    935,
    'lemon3105',
    '421726542104625163',
    'FURIA, Vitality',
    'Passion UA, Imperial',
    'Falcons, Spirit, MOUZ, G2, NAVI, The Mongolz',
    1,
    '2025-12-03 16:47:40',
    'stage3',
    'Lemonziiko'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    936,
    'barqus',
    '727857027421831288',
    'MOUZ, Falcons',
    'Passion UA, Imperial',
    'Vitality, FURIA, Spirit, G2, Faze Clan, Liquid',
    1,
    '2025-12-03 16:49:52',
    'stage3',
    'Barqus'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    937,
    'kam8l',
    '522446902147547157',
    'Falcons, MOUZ',
    'Passion UA, Imperial',
    'FURIA, Vitality, The Mongolz, Spirit, NAVI, Faze Clan',
    1,
    '2025-12-03 16:52:42',
    'stage3',
    'kam8l'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    938,
    'kolo1237990',
    '690944257439301652',
    'FURIA, MOUZ',
    'B8, Imperial',
    '3DMAX, The Mongolz, Falcons, Vitality, Spirit, Faze Clan',
    1,
    '2025-12-03 16:53:33',
    'stage3',
    'Kowss50'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    939,
    '.emten',
    '364402950057099266',
    'FURIA, Falcons',
    'B8, Imperial',
    'Vitality, MOUZ, The Mongolz, NAVI, Faze Clan, PARIVISION',
    1,
    '2025-12-03 16:54:57',
    'stage3',
    'eMten'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    940,
    'krisv2._68440',
    '1153270538429542421',
    'Falcons, Vitality',
    'Liquid, Passion UA',
    'NAVI, FURIA, Faze Clan, paIN, MOUZ, Spirit',
    1,
    '2025-12-03 17:17:26',
    'stage3',
    'gwd313g'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    941,
    'monte_snack',
    '723493354918379533',
    'Vitality, The Mongolz',
    'paIN, Imperial',
    'FURIA, Falcons, MOUZ, Spirit, Faze Clan, Liquid',
    1,
    '2025-12-03 17:27:06',
    'stage3',
    'Monte'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    942,
    'mcgregor1_7',
    '594964029940957224',
    'MOUZ, Falcons',
    'Imperial, Passion UA',
    'FURIA, Vitality, NAVI, G2, Faze Clan, paIN',
    1,
    '2025-12-03 17:38:44',
    'stage3',
    'McGregor17'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    943,
    'igicz',
    '348517152468369409',
    'Vitality, FURIA',
    'Imperial, 3DMAX',
    'G2, Spirit, Falcons, MOUZ, Faze Clan, NAVI',
    1,
    '2025-12-03 18:42:07',
    'stage3',
    'igicz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    944,
    'mati1493',
    '696087842308489237',
    'Vitality, Falcons',
    'Imperial, B8',
    'FURIA, MOUZ, The Mongolz, Spirit, NAVI, G2',
    1,
    '2025-12-03 18:58:10',
    'stage3',
    'Mati1493'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    945,
    'nikt_ciekawy1337',
    '1067108422652284968',
    'FURIA, Falcons',
    'Passion UA, PARIVISION',
    'The Mongolz, MOUZ, Vitality, G2, Spirit, paIN',
    1,
    '2025-12-03 19:09:25',
    'stage3',
    'Nikt Ciekawy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    946,
    'strachowski2204',
    '410931873322369034',
    'Falcons, MOUZ',
    'Passion UA, Imperial',
    'FURIA, Vitality, The Mongolz, NAVI, G2, Liquid',
    1,
    '2025-12-03 19:09:40',
    'stage3',
    'Strachowski2204'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    947,
    'questrianek',
    '759697317263310889',
    'Vitality, FURIA',
    'Passion UA, Imperial',
    'Spirit, NAVI, G2, 3DMAX, Falcons, MOUZ',
    1,
    '2025-12-03 19:17:46',
    'stage3',
    'questrian'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    948,
    '.egzekucja',
    '451703866267009024',
    'Vitality, Falcons',
    'B8, PARIVISION',
    'MOUZ, FURIA, Spirit, NAVI, Faze Clan, Liquid',
    1,
    '2025-12-03 19:28:00',
    'stage3',
    'Egzekucja'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    949,
    'kubi1133',
    '519586946176253952',
    'Falcons, MOUZ',
    'Imperial, Passion UA',
    'Vitality, FURIA, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-03 19:36:21',
    'stage3',
    'ҜuBi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    950,
    'amazingamepies',
    '323024700609658890',
    'Vitality, Falcons',
    'Passion UA, Imperial',
    'FURIA, MOUZ, NAVI, Spirit, G2, Faze Clan',
    1,
    '2025-12-03 19:46:26',
    'stage3',
    '☣☀Amazing Amepies☀☣'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    951,
    'borow1k',
    '300273286489702402',
    'FURIA, Vitality',
    '3DMAX, Imperial',
    'Falcons, MOUZ, Spirit, NAVI, Faze Clan, PARIVISION',
    1,
    '2025-12-03 20:06:40',
    'stage3',
    'Borowik'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    952,
    'szymcr8',
    '649683931897135125',
    'Falcons, Faze Clan',
    'B8, Passion UA',
    'Vitality, FURIA, MOUZ, Spirit, NAVI, Liquid',
    1,
    '2025-12-03 20:19:21',
    'stage3',
    'szymcr8'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    953,
    'kombajnista.',
    '378201105256939521',
    'paIN, Vitality',
    'G2, B8',
    'FURIA, Falcons, MOUZ, Spirit, NAVI, Faze Clan',
    1,
    '2025-12-03 20:28:01',
    'stage3',
    'kombajnista'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    954,
    '.adelay',
    '675411059091439626',
    'Falcons, MOUZ',
    'Imperial, Passion UA',
    'FURIA, Vitality, Spirit, NAVI, Faze Clan, 3DMAX',
    1,
    '2025-12-03 20:30:02',
    'stage3',
    'Adelay'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    955,
    'zzero2000',
    '462244738096037899',
    'Vitality, Falcons',
    'Imperial, Passion UA',
    'FURIA, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-03 20:36:36',
    'stage3',
    'Zzero'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    956,
    '5iontal',
    '755461769987751987',
    'MOUZ, Falcons',
    'Imperial, Passion UA',
    'Vitality, FURIA, Spirit, NAVI, G2, The Mongolz',
    1,
    '2025-12-03 20:37:29',
    'stage3',
    '5iontal'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    957,
    'bodzix_',
    '499568655508570119',
    'Falcons, MOUZ',
    'Imperial, Passion UA',
    'FURIA, Vitality, Spirit, NAVI, Faze Clan, paIN',
    1,
    '2025-12-03 20:53:01',
    'stage3',
    'bodzix'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    958,
    'tonypie_',
    '651126587621900289',
    'FURIA, Falcons',
    'Imperial, B8',
    'Vitality, MOUZ, The Mongolz, Spirit, NAVI, Faze Clan',
    1,
    '2025-12-03 20:58:05',
    'stage3',
    'tonypie'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    959,
    'olifasoli2014',
    '654314799840362498',
    'FURIA, Falcons',
    'Imperial, Passion UA',
    'Vitality, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-03 21:02:21',
    'stage3',
    'olifasoli2014'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    960,
    'gekoniasty',
    '318343577765806080',
    'MOUZ, Falcons',
    'Passion UA, Imperial',
    'FURIA, Vitality, NAVI, paIN, Faze Clan, PARIVISION',
    1,
    '2025-12-03 21:03:12',
    'stage3',
    'Gekoniasty'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    961,
    'scheydy205',
    '907022269140832286',
    'FURIA, Vitality',
    'Imperial, Passion UA',
    'The Mongolz, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-03 21:18:23',
    'stage3',
    'scheydy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    962,
    'hap3rr',
    '516697873497456655',
    'Vitality, Falcons',
    'Passion UA, PARIVISION',
    'FURIA, MOUZ, The Mongolz, Spirit, NAVI, Faze Clan',
    1,
    '2025-12-03 21:19:04',
    'stage3',
    'hap3r'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    963,
    'piter8713',
    '434439412256997377',
    'FURIA, MOUZ',
    '3DMAX, The Mongolz',
    'Vitality, Falcons, Spirit, Faze Clan, PARIVISION, NAVI',
    1,
    '2025-12-03 21:20:18',
    'stage3',
    'orzeł zps'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    964,
    'w4lec_',
    '427430915963224064',
    'MOUZ, Falcons',
    'Imperial, Passion UA',
    'Vitality, FURIA, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-03 21:27:55',
    'stage3',
    '滚筒'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    965,
    'undeadkarambol',
    '1225901047982329876',
    'Vitality, Spirit',
    'paIN, FURIA',
    'The Mongolz, NAVI, Faze Clan, MOUZ, Falcons, G2',
    1,
    '2025-12-03 21:28:08',
    'stage3',
    'Karambolowy zawrót głowy'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    966,
    'tusiactwo',
    '573574878918082560',
    'FURIA, Faze Clan',
    'Falcons, Passion UA',
    'Vitality, MOUZ, NAVI, Spirit, The Mongolz, B8',
    1,
    '2025-12-03 21:34:51',
    'stage3',
    'Tusiactwo'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    967,
    'maciek0357',
    '691432428232900709',
    'FURIA, Falcons',
    '3DMAX, Imperial',
    'Vitality, MOUZ, Spirit, NAVI, paIN, Faze Clan',
    1,
    '2025-12-03 21:36:28',
    'stage3',
    'macidk12'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    969,
    'thommyy5212',
    '535251994831618076',
    'FURIA, Falcons',
    '3DMAX, Imperial',
    'Vitality, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-03 22:14:03',
    'stage3',
    'Toomixx'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    970,
    'kotlecik_',
    '443767806241275915',
    'MOUZ, G2',
    'Passion UA, Imperial',
    'FURIA, Vitality, Falcons, Spirit, NAVI, PARIVISION',
    1,
    '2025-12-03 22:17:21',
    'stage3',
    'kotlecik'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    971,
    'money.',
    '682207856153591888',
    'Falcons, FURIA',
    'Passion UA, Imperial',
    'Vitality, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-03 22:20:20',
    'stage3',
    '????????'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    972,
    'laki5068',
    '809885132101779456',
    'G2, MOUZ',
    'B8, Imperial',
    'FURIA, Falcons, NAVI, Liquid, Faze Clan, paIN',
    1,
    '2025-12-03 22:53:57',
    'stage3',
    'Laki'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    973,
    'neverxoid',
    '233330984395866112',
    'FURIA, MOUZ',
    'Liquid, Imperial',
    'Vitality, Falcons, The Mongolz, NAVI, Faze Clan, B8',
    1,
    '2025-12-03 22:58:57',
    'stage3',
    'Neverxoid'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    974,
    'lukasz_03',
    '561623798596632588',
    'Falcons, FURIA',
    'The Mongolz, Passion UA',
    'Vitality, MOUZ, NAVI, G2, Faze Clan, Liquid',
    1,
    '2025-12-03 23:21:42',
    'stage3',
    'Lukasz_03'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    975,
    'tamski07',
    '486577410037514250',
    'paIN, MOUZ',
    'Liquid, Passion UA',
    'FURIA, Vitality, Falcons, Faze Clan, NAVI, G2',
    1,
    '2025-12-03 23:42:40',
    'stage3',
    'Tamski'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    976,
    'nixon338',
    '1394045439782949104',
    'FURIA, Falcons',
    'Imperial, Liquid',
    'Vitality, MOUZ, NAVI, paIN, Faze Clan, Spirit',
    1,
    '2025-12-03 23:48:28',
    'stage3',
    'Nixon'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    977,
    'yuuki_3333',
    '430770974481448960',
    'FURIA, Falcons',
    'Imperial, G2',
    'Spirit, Faze Clan, PARIVISION, 3DMAX, MOUZ, NAVI',
    1,
    '2025-12-04 01:11:39',
    'stage3',
    'dafid'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    980,
    'b3nek',
    '131175559345602561',
    'Falcons, MOUZ',
    'Passion UA, Imperial',
    'FURIA, Vitality, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-04 07:14:03',
    'stage3',
    'B3neK'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    983,
    '_kubakoz',
    '1124240992380395550',
    'Falcons, MOUZ',
    'paIN, Imperial',
    'FURIA, Vitality, NAVI, Spirit, Faze Clan, Liquid',
    1,
    '2025-12-04 08:22:21',
    'stage3',
    'kuba koz'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    984,
    'mamwolnewtorki',
    '402199933936992258',
    'FURIA, Falcons',
    '3DMAX, Imperial',
    'Vitality, MOUZ, Spirit, NAVI, Faze Clan, PARIVISION',
    1,
    '2025-12-04 09:06:32',
    'stage3',
    'Mam wolne wtorki'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    985,
    'moobsik',
    '714543991122821120',
    'Faze Clan, Liquid',
    'Passion UA, Imperial',
    'FURIA, Vitality, Falcons, MOUZ, Spirit, G2',
    1,
    '2025-12-04 09:14:39',
    'stage3',
    'moobsik'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    987,
    '._.iluminati._.',
    '630820180901101600',
    'MOUZ, Spirit',
    'B8, Passion UA',
    'FURIA, Vitality, Falcons, Faze Clan, Liquid, PARIVISION',
    1,
    '2025-12-04 09:30:23',
    'stage3',
    'iluminati'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    988,
    'hubcio7480',
    '792063759521808394',
    'Falcons, FURIA',
    'Imperial, Passion UA',
    'Vitality, MOUZ, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-04 09:35:59',
    'stage3',
    'Hubcio'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    989,
    'stasiumadafak',
    '1077357796762337331',
    'FURIA, Vitality',
    'Imperial, Passion UA',
    'Falcons, MOUZ, The Mongolz, Spirit, NAVI, Faze Clan',
    1,
    '2025-12-04 09:43:32',
    'stage3',
    'StasiuMadaFak'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    992,
    'gavloo.',
    '348911633336238080',
    'MOUZ, Falcons',
    'Imperial, 3DMAX',
    'FURIA, Vitality, The Mongolz, Spirit, NAVI, Faze Clan',
    1,
    '2025-12-04 10:41:20',
    'stage3',
    'Gavloo'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    994,
    'klonx9',
    '569508807374536724',
    'FURIA, Falcons',
    'Imperial, Passion UA',
    'Vitality, MOUZ, Spirit, NAVI, Faze Clan, Liquid',
    1,
    '2025-12-04 11:01:41',
    'stage3',
    'klonx9'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    995,
    'hub1xx_',
    '906231768712101919',
    'Faze Clan, FURIA',
    'Imperial, paIN',
    'Vitality, Falcons, MOUZ, The Mongolz, Spirit, Liquid',
    1,
    '2025-12-04 11:02:04',
    'stage3',
    'hub1x'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    996,
    'roxiecoal',
    '247084993971617793',
    'Falcons, MOUZ',
    'Liquid, Passion UA',
    'FURIA, Vitality, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-04 11:02:16',
    'stage3',
    'roxiecoal'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    997,
    'dziku',
    '326003414238756864',
    'Vitality, Falcons',
    'paIN, Passion UA',
    'FURIA, MOUZ, The Mongolz, Spirit, NAVI, Faze Clan',
    1,
    '2025-12-04 11:02:48',
    'stage3',
    'Dziku'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    999,
    'ales1433',
    '479245851722645535',
    'NAVI, MOUZ',
    'B8, Passion UA',
    'FURIA, Vitality, Falcons, Faze Clan, G2, Spirit',
    1,
    '2025-12-04 11:06:03',
    'stage3',
    'Ales'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    1000,
    '_piter0_',
    '724151346609127445',
    'FURIA, Falcons',
    'Passion UA, Imperial',
    'Vitality, MOUZ, The Mongolz, Spirit, NAVI, Faze Clan',
    1,
    '2025-12-04 11:06:49',
    'stage3',
    'Piter'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    1001,
    'spinkaa',
    '983477936810238052',
    'MOUZ, G2',
    'Passion UA, Imperial',
    'FURIA, Vitality, Falcons, Spirit, NAVI, Faze Clan',
    1,
    '2025-12-04 11:09:29',
    'stage3',
    '!Spinka'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    1003,
    'matrixxxx_',
    '723525504384237620',
    'Falcons, PARIVISION',
    'paIN, Imperial',
    'FURIA, Vitality, MOUZ, Spirit, NAVI, Faze Clan',
    1,
    '2025-12-04 11:11:34',
    'stage3',
    'Matrix'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    1006,
    'kjnv3',
    '534065689947013122',
    'MOUZ, Falcons',
    'G2, paIN',
    'FURIA, Vitality, NAVI, Liquid, Faze Clan, PARIVISION',
    1,
    '2025-12-04 11:25:32',
    'stage3',
    'Konfi Cotton'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    1008,
    'zlamikos',
    '352080834934865920',
    'NAVI, FURIA',
    'Passion UA, Imperial',
    'Faze Clan, G2, MOUZ, Vitality, Falcons, paIN',
    1,
    '2025-12-04 11:27:53',
    'stage3',
    'Zlamikos'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    1009,
    'xserrek',
    '503570853611700224',
    'Vitality, MOUZ',
    'Imperial, Passion UA',
    'FURIA, Falcons, The Mongolz, Spirit, NAVI, G2',
    1,
    '2025-12-04 11:28:39',
    'stage3',
    'xSerrek'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    1011,
    'kqcus.',
    '1236280013343424512',
    'Falcons, MOUZ',
    'Imperial, Passion UA',
    'Spirit, NAVI, G2, Faze Clan, Vitality, FURIA',
    1,
    '2025-12-04 11:31:08',
    'stage3',
    'kqcus.'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    1012,
    '.fred1213',
    '488757200399892480',
    'MOUZ, Falcons',
    'Passion UA, Imperial',
    'FURIA, Vitality, Spirit, NAVI, G2, Faze Clan',
    1,
    '2025-12-04 11:32:43',
    'stage3',
    '✔ ???????? ✔'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    1013,
    'ortionv2',
    '1279804882445930609',
    'MOUZ, Vitality',
    'Imperial, Passion UA',
    'FURIA, Falcons, The Mongolz, NAVI, G2, Faze Clan',
    1,
    '2025-12-04 11:38:16',
    'stage3',
    '<O®T¡0n'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    1014,
    'mis1or',
    '926626252985618432',
    'FURIA, MOUZ',
    'PARIVISION, Passion UA',
    'Vitality, Falcons, NAVI, G2, Faze Clan, Spirit',
    1,
    '2025-12-04 11:39:56',
    'stage3',
    'dombi'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    1015,
    'balacl4vaa',
    '1388519493361471569',
    'MOUZ, G2',
    'PARIVISION, 3DMAX',
    'Vitality, FURIA, Falcons, Faze Clan, NAVI, paIN',
    1,
    '2025-12-04 11:40:40',
    'stage3',
    'Balacl4va'
  );
INSERT INTO
  `swiss_predictions` (
    `id`,
    `username`,
    `user_id`,
    `pick_3_0`,
    `pick_0_3`,
    `advancing`,
    `active`,
    `submitted_at`,
    `stage`,
    `displayname`
  )
VALUES
  (
    1016,
    'f0sti_',
    '1097066576294977547',
    'Falcons, FURIA',
    'Passion UA, Imperial',
    'Vitality, Spirit, NAVI, Faze Clan, MOUZ, The Mongolz',
    1,
    '2025-12-04 11:52:50',
    'stage3',
    'F0STiii'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: swiss_results
# ------------------------------------------------------------

INSERT INTO
  `swiss_results` (
    `id`,
    `correct_3_0`,
    `correct_0_3`,
    `correct_advancing`,
    `created_at`,
    `stage`,
    `active`
  )
VALUES
  (
    30,
    '[\"M80\",\"FlyQuest\"]',
    '[\"Rare Atom\",\"Lynn Vision Gaming\"]',
    '[\"Ninjas in Pyjamas\",\"B8\",\"Fnatic\",\"FaZe Clan\",\"PARIVISION\",\"Imperial\"]',
    NULL,
    'stage1',
    1
  );
INSERT INTO
  `swiss_results` (
    `id`,
    `correct_3_0`,
    `correct_0_3`,
    `correct_advancing`,
    `created_at`,
    `stage`,
    `active`
  )
VALUES
  (
    33,
    '[\"FaZe Clan\",\"NAVI\"]',
    '[\"FlyQuest\",\"MIBR\"]',
    '[\"Parivision\",\"Passion UA\",\"Imperial\",\"Liquid\",\"B8\",\"3DMAX\"]',
    NULL,
    'stage2',
    1
  );
INSERT INTO
  `swiss_results` (
    `id`,
    `correct_3_0`,
    `correct_0_3`,
    `correct_advancing`,
    `created_at`,
    `stage`,
    `active`
  )
VALUES
  (
    35,
    '[\"FURIA\",\"Spirit\"]',
    '[\"Liquid\",\"PARIVISION\"]',
    '[\"Vitality\",\"MOUZ\",\"The Mongolz\",\"NAVI\",\"Falcons\",\"Faze Clan\"]',
    NULL,
    'stage3',
    1
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: swiss_scores
# ------------------------------------------------------------

INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '704078031567847595',
    NULL,
    'stage1',
    1131,
    'Felipe El Manitas',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1255616760179331148',
    NULL,
    'stage1',
    1132,
    'kapitron_',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '1296180581305942016',
    NULL,
    'stage1',
    1133,
    'z3fir',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1019347634198163556',
    NULL,
    'stage1',
    1134,
    'Kalmox',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '528766654247862273',
    NULL,
    'stage1',
    1135,
    'Averegz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '456217671839645697',
    NULL,
    'stage1',
    1136,
    'S2AKAL',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '558039958636462087',
    NULL,
    'stage1',
    1137,
    'gbn',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1215282198081437717',
    NULL,
    'stage1',
    1138,
    'kuriereq',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1025367753588228128',
    NULL,
    'stage1',
    1139,
    'gitsoneqq',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '604552227759063040',
    NULL,
    'stage1',
    1140,
    'Macmal',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1053050004387921930',
    NULL,
    'stage1',
    1141,
    'Zakład Pogrzebowy Kostrzyn',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '479915126489612310',
    NULL,
    'stage1',
    1142,
    'poncze_kk',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '1393656003307900948',
    NULL,
    'stage1',
    1143,
    'x1zz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1272830126832226355',
    NULL,
    'stage1',
    1144,
    'Ewok',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '419289850118668328',
    NULL,
    'stage1',
    1145,
    'Sharp',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '954840918391930901',
    NULL,
    'stage1',
    1146,
    'Mateuss',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1148667641314164836',
    NULL,
    'stage1',
    1147,
    'leworensky',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '261499368362868742',
    NULL,
    'stage1',
    1148,
    'Kargo',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '932271244345233439',
    NULL,
    'stage1',
    1149,
    'srajkez',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '569508807374536724',
    NULL,
    'stage1',
    1150,
    'klonx9',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '1275527297893531772',
    NULL,
    'stage1',
    1151,
    'Bartuss',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1271521295674376204',
    NULL,
    'stage1',
    1152,
    'Simply_Kubus',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '411242187213242370',
    NULL,
    'stage1',
    1153,
    'm0ris',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '590180516716871683',
    NULL,
    'stage1',
    1154,
    'Worekit',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '525034117105188865',
    NULL,
    'stage1',
    1155,
    'KayEss',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '352823893003730945',
    NULL,
    'stage1',
    1156,
    'Pancio ツ',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '919347146405339138',
    NULL,
    'stage1',
    1157,
    'POPROSTUFABIAN',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '718134989236994129',
    NULL,
    'stage1',
    1158,
    'N1njaa',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1278670384358621225',
    NULL,
    'stage1',
    1159,
    'XeytoX',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1104704544488837170',
    NULL,
    'stage1',
    1160,
    'dominez_2',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '300683011102474251',
    NULL,
    'stage1',
    1161,
    'Shintowskyツ',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '761587793893654549',
    NULL,
    'stage1',
    1162,
    'Dr.Macika',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '343117544934342656',
    NULL,
    'stage1',
    1163,
    'Proksiu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    0,
    '461851082570596352',
    NULL,
    'stage1',
    1164,
    'Ciepły',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '1153270538429542421',
    NULL,
    'stage1',
    1165,
    'gwd313g',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '498845748792786944',
    NULL,
    'stage1',
    1166,
    'Multi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '294891812466720768',
    NULL,
    'stage1',
    1167,
    'WilAR',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '840627386352926760',
    NULL,
    'stage1',
    1168,
    'Magiczny Staś',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1077219449502965790',
    NULL,
    'stage1',
    1169,
    'JakoN-',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '302360723676463104',
    NULL,
    'stage1',
    1170,
    'MaTTiS?',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '486577410037514250',
    NULL,
    'stage1',
    1171,
    'Tamski',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '542361412127686657',
    NULL,
    'stage1',
    1172,
    'Quiq',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '486499834384220170',
    NULL,
    'stage1',
    1173,
    'Rogyoa',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '1394045439782949104',
    NULL,
    'stage1',
    1174,
    'Nixon',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '1099021777096671394',
    NULL,
    'stage1',
    1175,
    'KarolEGG',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '883797922381189141',
    NULL,
    'stage1',
    1176,
    'Kopia',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '710819865367150703',
    NULL,
    'stage1',
    1177,
    'Gupiś',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '656537113394937866',
    NULL,
    'stage1',
    1178,
    'zajchuu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '471463411239092225',
    NULL,
    'stage1',
    1179,
    '-muchson-',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1032327878991425617',
    NULL,
    'stage1',
    1180,
    'OLSZOVSKY',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '278065188169842688',
    NULL,
    'stage1',
    1181,
    'ArcadianPrime',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '526514638867922964',
    NULL,
    'stage1',
    1182,
    'QŃ',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1183153359000195224',
    NULL,
    'stage1',
    1183,
    'Bbfj',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '340076455868235777',
    NULL,
    'stage1',
    1184,
    'T1mero',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '1214977723190222919',
    NULL,
    'stage1',
    1185,
    'hojrahhy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '311925801794797578',
    NULL,
    'stage1',
    1186,
    'protectcos',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '722038338973859901',
    NULL,
    'stage1',
    1187,
    'Kubafar',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '509413231219965955',
    NULL,
    'stage1',
    1188,
    'Mefisto',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1236280013343424512',
    NULL,
    'stage1',
    1189,
    'kqcus.',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1250835724169777277',
    NULL,
    'stage1',
    1190,
    'everyone',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '518713983231066123',
    NULL,
    'stage1',
    1191,
    'M4cias',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '313437726789730305',
    NULL,
    'stage1',
    1192,
    'MATYS',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '874671251459833876',
    NULL,
    'stage1',
    1193,
    '--js',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '723588449151746050',
    NULL,
    'stage1',
    1194,
    'Neku',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1125496542263001209',
    NULL,
    'stage1',
    1195,
    'pierog',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1284104872358182964',
    NULL,
    'stage1',
    1196,
    'Danio',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '673482391322361888',
    NULL,
    'stage1',
    1197,
    'rzodkiew',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1181560396121907252',
    NULL,
    'stage1',
    1198,
    'świąteczny gila',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '646804591853436946',
    NULL,
    'stage1',
    1199,
    'Dorkej',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '882519104316137502',
    NULL,
    'stage1',
    1200,
    'Sky Shafiq',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '354595339069554688',
    NULL,
    'stage1',
    1201,
    'Karbon',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1432349282580566089',
    NULL,
    'stage1',
    1202,
    'Szaku',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '535251994831618076',
    NULL,
    'stage1',
    1203,
    'Toomixx',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1145386101264109669',
    NULL,
    'stage1',
    1204,
    'Mr Marty',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '723447196388819014',
    NULL,
    'stage1',
    1205,
    'XcZaRo',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1124240992380395550',
    NULL,
    'stage1',
    1206,
    'kuba koz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '531537178208239626',
    NULL,
    'stage1',
    1207,
    'Fluxis72',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '626490238914527263',
    NULL,
    'stage1',
    1208,
    'Adin',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '713930835396657242',
    NULL,
    'stage1',
    1209,
    'zdradzam zone',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '589103946921148446',
    NULL,
    'stage1',
    1210,
    'FaBi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1105164852810502235',
    NULL,
    'stage1',
    1211,
    'swezyy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '435779589864816640',
    NULL,
    'stage1',
    1212,
    'Grubycoach',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '709443415120543824',
    NULL,
    'stage1',
    1213,
    'arcad1o',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '460126239173378069',
    NULL,
    'stage1',
    1214,
    'FNXXX-',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '823526692189634580',
    NULL,
    'stage1',
    1215,
    'geeciu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '478486060943540225',
    NULL,
    'stage1',
    1216,
    'Marcineq',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '660483416554209313',
    NULL,
    'stage1',
    1217,
    'plomerr',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '672468108388073504',
    NULL,
    'stage1',
    1218,
    'Kamień',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '801164867457253406',
    NULL,
    'stage1',
    1219,
    '☢?????☢',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '352080834934865920',
    NULL,
    'stage1',
    1220,
    'Zlamikos',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '968919031283322931',
    NULL,
    'stage1',
    1221,
    'Prezes',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '593779620558536740',
    NULL,
    'stage1',
    1222,
    'Radoz555',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1158820143397339146',
    NULL,
    'stage1',
    1223,
    'stan1eyek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '654314799840362498',
    NULL,
    'stage1',
    1224,
    'olifasoli2014',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '1143283014634319994',
    NULL,
    'stage1',
    1225,
    'Szymon McDonald’s',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '419278999991353374',
    NULL,
    'stage1',
    1226,
    'Monczall',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '749701801304916020',
    NULL,
    'stage1',
    1227,
    'Krzyhus212',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1176928936853254166',
    NULL,
    'stage1',
    1228,
    'Uriel',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '444578457309937664',
    NULL,
    'stage1',
    1229,
    'jotu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '762270778754203688',
    NULL,
    'stage1',
    1230,
    'zysio',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1245802397645934682',
    NULL,
    'stage1',
    1231,
    'lunargondolier22',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '365908036381835266',
    NULL,
    'stage1',
    1232,
    'Horizon Howl',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '340841216507904001',
    NULL,
    'stage1',
    1233,
    'CwelulozaOwner',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '779804152976375828',
    NULL,
    'stage1',
    1234,
    'Nix_ℵ',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '936390831580008539',
    NULL,
    'stage1',
    1235,
    'kurczaczek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '423913069727580162',
    NULL,
    'stage1',
    1236,
    'Jajogłowy_',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '691707080234500157',
    NULL,
    'stage1',
    1237,
    'Swiera',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '428560867588833281',
    NULL,
    'stage1',
    1238,
    'TiffanyLFC',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '419405937728684032',
    NULL,
    'stage1',
    1239,
    'didek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '836571369898115115',
    NULL,
    'stage1',
    1240,
    'Still Water',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '512637204821049346',
    NULL,
    'stage1',
    1241,
    'Ote',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '845924406436954152',
    NULL,
    'stage1',
    1242,
    'sztawo17',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '498152549451563009',
    NULL,
    'stage1',
    1243,
    'mjkaelo',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '691432428232900709',
    NULL,
    'stage1',
    1244,
    'macidk12',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '729313277410279455',
    NULL,
    'stage1',
    1245,
    'pietruciu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '463234527850921985',
    NULL,
    'stage1',
    1246,
    'Igssk',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1288929189465952280',
    NULL,
    'stage1',
    1247,
    'MrNaibaff',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1379502507323162626',
    NULL,
    'stage1',
    1248,
    'Galuszka1337',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1078726241680633857',
    NULL,
    'stage1',
    1249,
    'xSetiツ_',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '722027729158930435',
    NULL,
    'stage1',
    1250,
    'szymonek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '1054079373789110342',
    NULL,
    'stage1',
    1251,
    'maj0rek0',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '627115371878416385',
    NULL,
    'stage1',
    1252,
    'Savi0X',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1219387685425254441',
    NULL,
    'stage1',
    1253,
    '! Мajkutini',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1024338511001821185',
    NULL,
    'stage1',
    1254,
    'Tasman',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '696670794587177020',
    NULL,
    'stage1',
    1255,
    'm',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '516697873497456655',
    NULL,
    'stage1',
    1256,
    'hap3r',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '227190937409945601',
    NULL,
    'stage1',
    1257,
    '082byd7u2',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '723493354918379533',
    NULL,
    'stage1',
    1258,
    'Monte',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '759697317263310889',
    NULL,
    'stage1',
    1259,
    'questrian',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '288364271153184768',
    NULL,
    'stage1',
    1260,
    'Michu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '693547426212216892',
    NULL,
    'stage1',
    1261,
    'BoloTv',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '581860728240340992',
    NULL,
    'stage1',
    1262,
    'DAMN1ggy_',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '228173160355332097',
    NULL,
    'stage1',
    1263,
    'Banderas',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '406902151529627649',
    NULL,
    'stage1',
    1264,
    'RamirezKKS',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '522505047116873738',
    NULL,
    'stage1',
    1265,
    'chedzik',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '968138010371694632',
    NULL,
    'stage1',
    1266,
    '꧁???????꧂',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '642419697072996372',
    NULL,
    'stage1',
    1267,
    'riczi777',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '415969455412215818',
    NULL,
    'stage1',
    1268,
    'Slomczyn',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '651126587621900289',
    NULL,
    'stage1',
    1269,
    'tonypie',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '312633551466135553',
    NULL,
    'stage1',
    1270,
    'ZenSoul',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '1172505884782497853',
    NULL,
    'stage1',
    1271,
    'fiejuu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '351394837645492226',
    NULL,
    'stage1',
    1272,
    'MrPanda',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '519586946176253952',
    NULL,
    'stage1',
    1273,
    'ҜuBi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '1145443406638751815',
    NULL,
    'stage1',
    1274,
    'bombix',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '386495286563962880',
    NULL,
    'stage1',
    1275,
    'KSL',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '499568655508570119',
    NULL,
    'stage1',
    1276,
    'bodzix',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '456088997827969024',
    NULL,
    'stage1',
    1277,
    'bezbożnik',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '583629902834827276',
    NULL,
    'stage1',
    1278,
    'Miszol',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '555800660357021696',
    NULL,
    'stage1',
    1279,
    'Тотя ❤',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '320224049760567296',
    NULL,
    'stage1',
    1280,
    'pbialy123',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '668913702510002179',
    NULL,
    'stage1',
    1281,
    'Gajtan',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '806479768366874664',
    NULL,
    'stage1',
    1282,
    'Rogalツ',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '924710423100522506',
    NULL,
    'stage1',
    1283,
    'poprostu koko',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '333906708336476170',
    NULL,
    'stage1',
    1284,
    'Fazer*',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1337893397721251894',
    NULL,
    'stage1',
    1285,
    'Feran',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1275474919848804506',
    NULL,
    'stage1',
    1286,
    'W1xiUu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1279804882445930609',
    NULL,
    'stage1',
    1287,
    '<O®T¡0n',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1037766729775984680',
    NULL,
    'stage1',
    1288,
    '_razyy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1168565235817398431',
    NULL,
    'stage1',
    1289,
    'ahcyd',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1056295328007069727',
    NULL,
    'stage1',
    1290,
    'Mr. Headshot',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '589923037449814052',
    NULL,
    'stage1',
    1291,
    'cheems',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1284075325042724900',
    NULL,
    'stage1',
    1292,
    'Buldogun',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '779402540755976192',
    NULL,
    'stage1',
    1293,
    '_prosik_5678_',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '484699137418199041',
    NULL,
    'stage1',
    1294,
    'Lizu<3',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '630393151038685186',
    NULL,
    'stage1',
    1295,
    'Unboxing',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '486957798207258635',
    NULL,
    'stage1',
    1296,
    'Kuba',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '414528693386608640',
    NULL,
    'stage1',
    1297,
    'Tyrek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1344602384546140230',
    NULL,
    'stage1',
    1298,
    'Brother Will',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1077357796762337331',
    NULL,
    'stage1',
    1299,
    'StasiuMadaFak',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '358544128310509579',
    NULL,
    'stage1',
    1300,
    'bartek.',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '512348961080737804',
    NULL,
    'stage1',
    1301,
    'DMPB',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '590502881577402378',
    NULL,
    'stage1',
    1302,
    'Hungry',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1276633433166188544',
    NULL,
    'stage1',
    1303,
    'M9JKOL',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '383712116005404675',
    NULL,
    'stage1',
    1304,
    'czipsol',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '726004253159587840',
    NULL,
    'stage1',
    1305,
    'Józek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '983748525798084628',
    NULL,
    'stage1',
    1306,
    '.michazwon',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '577515635110576128',
    NULL,
    'stage1',
    1307,
    'Sokul',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '322812891956903937',
    NULL,
    'stage1',
    1308,
    'Luxor',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '351509313438613504',
    NULL,
    'stage1',
    1309,
    'powleye',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1237435641541951681',
    NULL,
    'stage1',
    1310,
    'Gerard',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1283815621829857341',
    NULL,
    'stage1',
    1311,
    'Antonisss878',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '896147575093198958',
    NULL,
    'stage1',
    1312,
    'KmL',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '518331730688475136',
    NULL,
    'stage1',
    1313,
    'Pastor',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1206571061471350805',
    NULL,
    'stage1',
    1314,
    'DUDI',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '913842521266868284',
    NULL,
    'stage1',
    1315,
    'franix',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '967798809738510366',
    NULL,
    'stage1',
    1316,
    'Odklejus',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '963831255038828584',
    NULL,
    'stage1',
    1317,
    'wosa1y',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '565093490472517632',
    NULL,
    'stage1',
    1318,
    'Dziombekk',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '403141730335064075',
    NULL,
    'stage1',
    1319,
    'Tonka',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1364996865782972448',
    NULL,
    'stage1',
    1320,
    'Venvigo_',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '423163600610394122',
    NULL,
    'stage1',
    1321,
    'andrzej',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1239260951346286635',
    NULL,
    'stage1',
    1322,
    'Wiqus',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '387340409006850050',
    NULL,
    'stage1',
    1323,
    'bleyz__',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '299223548495527947',
    NULL,
    'stage1',
    1324,
    '4Fun',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '323905797207621663',
    NULL,
    'stage1',
    1325,
    'Skillek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '402551682694905876',
    NULL,
    'stage1',
    1326,
    '????????????',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '598815429091393536',
    NULL,
    'stage1',
    1327,
    'CYSIOO',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '473810651748499456',
    NULL,
    'stage1',
    1328,
    'f0nTeec',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '274961378203140097',
    NULL,
    'stage1',
    1329,
    'Owerlord',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '352153616368533504',
    NULL,
    'stage1',
    1330,
    'Eizi3k',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '534065689947013122',
    NULL,
    'stage1',
    1331,
    'Konfi Cotton',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '568419957369470987',
    NULL,
    'stage1',
    1332,
    'Krasmen',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1225901047982329876',
    NULL,
    'stage1',
    1333,
    'lekko pochylony ????????',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '364402950057099266',
    NULL,
    'stage1',
    1334,
    'eMten',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1353718624359022633',
    NULL,
    'stage1',
    1335,
    'SroMasz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '488757200399892480',
    NULL,
    'stage1',
    1336,
    '✔ ???????? ✔',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '788345818343669760',
    NULL,
    'stage1',
    1337,
    'nfixme ੭* ‧₊°',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '614884618272768038',
    NULL,
    'stage1',
    1338,
    'hopper',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '472474920270561281',
    NULL,
    'stage1',
    1339,
    'Dekus',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    0,
    '1303813587957059594',
    NULL,
    'stage1',
    1340,
    'sodziak',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '727134099231211571',
    NULL,
    'stage1',
    1341,
    '촌사람 같은',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1067108422652284968',
    NULL,
    'stage1',
    1342,
    'Nikt Ciekawy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '426457936202563586',
    NULL,
    'stage1',
    1343,
    'ｊａｎｅｅｋ',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1099627480911978526',
    NULL,
    'stage1',
    1344,
    'jc0bs',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '657258952320352291',
    NULL,
    'stage1',
    1345,
    'strazz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '300273286489702402',
    NULL,
    'stage1',
    1346,
    'Borowik',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '319901756064792588',
    NULL,
    'stage1',
    1347,
    'ZIPI',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '649683931897135125',
    NULL,
    'stage1',
    1348,
    'szymcr8',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '685783545624789031',
    NULL,
    'stage1',
    1349,
    'sxdemon_',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1329387696669327371',
    NULL,
    'stage1',
    1350,
    'PISTON',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1292388710121209858',
    NULL,
    'stage1',
    1351,
    'chryty',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '717766200616288306',
    NULL,
    'stage1',
    1352,
    'w1ter',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1281640108155469945',
    NULL,
    'stage1',
    1353,
    'Galazka',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '879476380562235392',
    NULL,
    'stage1',
    1354,
    'Kiwi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '809741245148692480',
    NULL,
    'stage1',
    1355,
    'don pedalini',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '402199933936992258',
    NULL,
    'stage1',
    1356,
    'Mam wolne wtorki',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '545609357073842178',
    NULL,
    'stage1',
    1357,
    'mck5237',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '798586014212816906',
    NULL,
    'stage1',
    1358,
    'Zioms0n pl',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1374820395718410323',
    NULL,
    'stage1',
    1359,
    'Fаuдi77?',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1166061791416176640',
    NULL,
    'stage1',
    1360,
    'Hone$t',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1090976552159821854',
    NULL,
    'stage1',
    1361,
    'Pabl0o',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '434439412256997377',
    NULL,
    'stage1',
    1362,
    'piter_zps',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '737688687227306075',
    NULL,
    'stage1',
    1363,
    'adleko29',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '487655741168025620',
    NULL,
    'stage1',
    1364,
    'Suuushii',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '1284132286064758807',
    NULL,
    'stage1',
    1365,
    'Filipeqo',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '827865688646483978',
    NULL,
    'stage1',
    1366,
    'Puchatek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '661634446772142080',
    NULL,
    'stage1',
    1367,
    'tominho',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '962434980485672971',
    NULL,
    'stage1',
    1368,
    'Mikrofalówka',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '393511848617574400',
    NULL,
    'stage1',
    1369,
    'KaPi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '976600282358218812',
    NULL,
    'stage1',
    1370,
    'Tony M',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '405435591887552513',
    NULL,
    'stage1',
    1371,
    'clancy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '576141255336132609',
    NULL,
    'stage1',
    1372,
    'Bartol',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '710794795529928785',
    NULL,
    'stage1',
    1373,
    'PIKOM',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '529027111504314399',
    NULL,
    'stage1',
    1374,
    'xNiko',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '707957198508261427',
    NULL,
    'stage1',
    1375,
    '4D4M',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '640306498798485528',
    NULL,
    'stage1',
    1376,
    'AIMWAREZ',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '415864755845070850',
    NULL,
    'stage1',
    1377,
    'BOTGAT',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '463001727310757888',
    NULL,
    'stage1',
    1378,
    'Kper',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '776835822103691294',
    NULL,
    'stage1',
    1379,
    'krysio',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '1172057126240272385',
    NULL,
    'stage1',
    1380,
    'NOrce',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1325796914582782037',
    NULL,
    'stage1',
    1381,
    'habi777',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '755766085982093312',
    NULL,
    'stage1',
    1382,
    'Tiřõ²⅓⁷',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '683388540591407108',
    NULL,
    'stage1',
    1383,
    'adriano8k',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '676509627449606168',
    NULL,
    'stage1',
    1384,
    'Kóba',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '662608188922789908',
    NULL,
    'stage1',
    1385,
    'asfalt125',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1041833033629700156',
    NULL,
    'stage1',
    1386,
    'm1siek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '724635076989681685',
    NULL,
    'stage1',
    1387,
    'Labiereestmavie',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1326677945867309076',
    NULL,
    'stage1',
    1388,
    'Dzyrosiarz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '891698235117293608',
    NULL,
    'stage1',
    1389,
    'bolobolo',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '308626397893754883',
    NULL,
    'stage1',
    1390,
    'galbarOfficial',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '802937836319801355',
    NULL,
    'stage1',
    1391,
    'd_a_n_y_o',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '472692405506932758',
    NULL,
    'stage1',
    1392,
    'Limsooon',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '351475146604675072',
    NULL,
    'stage1',
    1393,
    'haciolem',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '781919531018616834',
    NULL,
    'stage1',
    1394,
    'boberek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '509429079464738840',
    NULL,
    'stage1',
    1395,
    'Diptu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '455039359628869643',
    NULL,
    'stage1',
    1396,
    'Kamils',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '365958740928626691',
    NULL,
    'stage1',
    1397,
    'TheHyzio',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '737996674584281199',
    NULL,
    'stage1',
    1398,
    '???????♥',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '967388170490613762',
    NULL,
    'stage1',
    1399,
    'wariacik',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '693444338448990219',
    NULL,
    'stage1',
    1400,
    'Miszi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '506914119710932993',
    NULL,
    'stage1',
    1401,
    'fre3sh',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1307078104652714055',
    NULL,
    'stage1',
    1402,
    'gruby',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '367785987323199490',
    NULL,
    'stage1',
    1403,
    'ArAGoGx',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1100403487646429255',
    NULL,
    'stage1',
    1404,
    'slayworldwarrior',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '1204544158828597325',
    NULL,
    'stage1',
    1405,
    'arsiif',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1439306550706569392',
    NULL,
    'stage1',
    1406,
    'PAWCI00',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '456170557961011231',
    NULL,
    'stage1',
    1407,
    'Szakalele',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '917148130456260719',
    NULL,
    'stage1',
    1408,
    'Tocyk',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '907022269140832286',
    NULL,
    'stage1',
    1409,
    'scheydy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '867161106493866006',
    NULL,
    'stage1',
    1410,
    'cross',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '864932529789206629',
    NULL,
    'stage1',
    1411,
    'Terapeutaaa',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '231814174030823424',
    NULL,
    'stage1',
    1412,
    'Mista0swaggg',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '379636872399552512',
    NULL,
    'stage1',
    1413,
    'krxx',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1349665552855072820',
    NULL,
    'stage1',
    1414,
    'Elkapone',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '513033714226167834',
    NULL,
    'stage1',
    1415,
    'Rybaczenk0',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '453811822320025603',
    NULL,
    'stage1',
    1416,
    'D1oxie',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '773526091628412930',
    NULL,
    'stage1',
    1417,
    'itsLoCKz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '905494286005583872',
    NULL,
    'stage1',
    1418,
    'shesaskurwol',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1000080089888862278',
    NULL,
    'stage1',
    1419,
    'fieliep',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '492713025116045312',
    NULL,
    'stage1',
    1420,
    'MaybeTryLateR1',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '1122926867217920093',
    NULL,
    'stage1',
    1421,
    'marek_towarek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '467385808920248320',
    NULL,
    'stage1',
    1422,
    'Bambus',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '812409482088415242',
    NULL,
    'stage1',
    1423,
    'przemo91',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '757903126157328385',
    NULL,
    'stage1',
    1424,
    'Liquid4K',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '401493953469480961',
    NULL,
    'stage1',
    1425,
    '0001',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '350604331621548032',
    NULL,
    'stage1',
    1426,
    'Deyanek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1021096727199088711',
    NULL,
    'stage1',
    1427,
    '₪》??????.???? 亗6.6.6亗?',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1351636790678654987',
    NULL,
    'stage1',
    1428,
    '3MPT!N3SSS',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '761307590226739274',
    NULL,
    'stage1',
    1429,
    'jaKUBOŚ',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1139945488167219243',
    NULL,
    'stage1',
    1430,
    'Bubiks',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '718408438622846986',
    NULL,
    'stage1',
    1431,
    'RNB',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '451703866267009024',
    NULL,
    'stage1',
    1432,
    'Egzekucja',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '259063959867359233',
    NULL,
    'stage1',
    1433,
    'kam123k',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1268868169586577420',
    NULL,
    'stage1',
    1434,
    'Kacp3r6274',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '359370791076364290',
    NULL,
    'stage1',
    1435,
    'ŁeB SzOt',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '630820180901101600',
    NULL,
    'stage1',
    1436,
    'iluminati',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '373072390919553027',
    NULL,
    'stage1',
    1437,
    'Szerszen777',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '941701213345435681',
    NULL,
    'stage1',
    1438,
    'lamulina',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '410931873322369034',
    NULL,
    'stage1',
    1439,
    'Strachowski2204',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '312232069289869322',
    NULL,
    'stage1',
    1440,
    'Turb0s',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '945378797069434930',
    NULL,
    'stage1',
    1441,
    'Death',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1294947471234961411',
    NULL,
    'stage1',
    1442,
    'Nypel99',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '862041274973552651',
    NULL,
    'stage1',
    1443,
    'BqMaJsTeR',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '378201105256939521',
    NULL,
    'stage1',
    1444,
    'kombajnista',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '419502602783293440',
    NULL,
    'stage1',
    1445,
    'twarda bania',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1339256360088637502',
    NULL,
    'stage1',
    1446,
    'Gołdapi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1157952394873819168',
    NULL,
    'stage1',
    1447,
    'kawiasty._',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '727857027421831288',
    NULL,
    'stage1',
    1448,
    'Barqus',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '551465623922933810',
    NULL,
    'stage1',
    1449,
    'emqo_oficjalnie',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '534117132745572353',
    NULL,
    'stage1',
    1450,
    'L0G4N',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '506122849082277908',
    NULL,
    'stage1',
    1451,
    'Pita',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '328909487136309248',
    NULL,
    'stage1',
    1452,
    'esa',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '1104033819683737611',
    NULL,
    'stage1',
    1453,
    'franio',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '614079406691975170',
    NULL,
    'stage1',
    1454,
    'QBA',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '518381048598364163',
    NULL,
    'stage1',
    1455,
    'Eriko_19',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1097066576294977547',
    NULL,
    'stage1',
    1456,
    'F0STiii',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '503570853611700224',
    NULL,
    'stage1',
    1457,
    'xSerrek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '942399157405110342',
    NULL,
    'stage1',
    1458,
    'ksantekss',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '440969502545543168',
    NULL,
    'stage1',
    1459,
    'Bendixツ',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '233330984395866112',
    NULL,
    'stage1',
    1460,
    'Neverxoid',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '305737641763274752',
    NULL,
    'stage1',
    1461,
    'sadz1k',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '823202779971453048',
    NULL,
    'stage1',
    1462,
    '✝Hy4per✝',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '348911633336238080',
    NULL,
    'stage1',
    1463,
    'Gavloo',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '906656431351169055',
    NULL,
    'stage1',
    1464,
    'Kacper',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '519287591028391959',
    NULL,
    'stage1',
    1465,
    ',,Sajmuraj\'\'',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '714543991122821120',
    NULL,
    'stage1',
    1466,
    'moobsik',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '682207856153591888',
    NULL,
    'stage1',
    1467,
    '????????',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '532912683666898944',
    NULL,
    'stage1',
    1468,
    'xQBIK.wav',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '428666355965755396',
    NULL,
    'stage1',
    1469,
    'uniq7565',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '522446902147547157',
    NULL,
    'stage1',
    1470,
    'kam8l',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '302530317791657986',
    NULL,
    'stage1',
    1471,
    'jerzyk',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '531485490575310879',
    NULL,
    'stage1',
    1472,
    'Le Prince',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1008765321861140611',
    NULL,
    'stage1',
    1473,
    'panpiku',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    0,
    '699257871673852034',
    NULL,
    'stage1',
    1474,
    'skurwysyny haratajo',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '341248627852836876',
    NULL,
    'stage1',
    1475,
    'INzu_',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '594964029940957224',
    NULL,
    'stage1',
    1476,
    'McGregor17',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '447785515186520064',
    NULL,
    'stage1',
    1477,
    'siemasiema1312',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '733573014402236449',
    NULL,
    'stage1',
    1478,
    '?????',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '811601970506629150',
    NULL,
    'stage1',
    1479,
    'KebabikRHC',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1097190679773466764',
    NULL,
    'stage1',
    1480,
    '?????',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '337966578798690304',
    NULL,
    'stage1',
    1481,
    'waso',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '414544887376248843',
    NULL,
    'stage1',
    1482,
    'banger',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '696087842308489237',
    NULL,
    'stage1',
    1483,
    'Mati1493',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '1285604020819329181',
    NULL,
    'stage1',
    1484,
    'vulc4ng',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '421726542104625163',
    NULL,
    'stage1',
    1485,
    'Lemonziiko',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '548248747977474048',
    NULL,
    'stage1',
    1486,
    'Łukasz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '435416566511697921',
    NULL,
    'stage1',
    1487,
    '?LuCkY00783?',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '931168369573503006',
    NULL,
    'stage1',
    1488,
    'Rysiu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1322673348924411944',
    NULL,
    'stage1',
    1489,
    'Asidesar',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '809885132101779456',
    NULL,
    'stage1',
    1490,
    'Laki',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '755461769987751987',
    NULL,
    'stage1',
    1491,
    '5iontal',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '1328802155079012425',
    NULL,
    'stage1',
    1492,
    'jan',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '395986508013895701',
    NULL,
    'stage1',
    1493,
    'proxy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '766301134956134440',
    NULL,
    'stage1',
    1494,
    'alexi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '401045306634141696',
    NULL,
    'stage1',
    1495,
    'Sikor',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '481456320546078730',
    NULL,
    'stage1',
    1496,
    'MichalKaylan',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1081626433266393198',
    NULL,
    'stage1',
    1497,
    'matiwk222',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '679076779872223434',
    NULL,
    'stage1',
    1498,
    'Bambosh420',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '629686561562165249',
    NULL,
    'stage1',
    1499,
    'Turoczek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '990401263889969193',
    NULL,
    'stage1',
    1500,
    'ilyorange 么',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '623578079951978516',
    NULL,
    'stage1',
    1501,
    'S00chy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '747076003792158761',
    NULL,
    'stage1',
    1502,
    'PanMann',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '462244738096037899',
    NULL,
    'stage1',
    1503,
    'Zzero',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '675411059091439626',
    NULL,
    'stage1',
    1504,
    'Adelay',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '695544671929368577',
    NULL,
    'stage1',
    1505,
    'k4cpe6ek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '751675646979080212',
    NULL,
    'stage1',
    1506,
    'baran_clip_you',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '228847064841191424',
    NULL,
    'stage1',
    1507,
    'bartuśjduwu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1034910520165285898',
    NULL,
    'stage1',
    1508,
    'Qbinho',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '815342777918554122',
    NULL,
    'stage1',
    1509,
    'Wojtas.',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '895331618590441523',
    NULL,
    'stage1',
    1510,
    'Asencio',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '906231768712101919',
    NULL,
    'stage1',
    1511,
    'hub1x',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '340528426345693185',
    NULL,
    'stage1',
    1512,
    'Aleks',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '573574878918082560',
    NULL,
    'stage1',
    1513,
    'Tusiactwo',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '561623798596632588',
    NULL,
    'stage1',
    1514,
    'Lukasz_03',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '789922633012609044',
    NULL,
    'stage1',
    1515,
    'Subwey',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '402837598592303114',
    NULL,
    'stage1',
    1516,
    'qdamix',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1057392520860012564',
    NULL,
    'stage1',
    1517,
    'qubi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '479245851722645535',
    NULL,
    'stage1',
    1518,
    'Ales',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '657270787711041546',
    NULL,
    'stage1',
    1519,
    'Assassin',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '279928749670006786',
    NULL,
    'stage1',
    1520,
    'gbfn',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '583924691073368069',
    NULL,
    'stage1',
    1521,
    'Dawid',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '318343577765806080',
    NULL,
    'stage1',
    1522,
    'Gekoniasty',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '342566246123831316',
    NULL,
    'stage1',
    1523,
    'essakessa',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '330505053314220034',
    NULL,
    'stage1',
    1524,
    'Pauder',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '461851082570596352',
    NULL,
    'stage2',
    7829,
    'Ciepły',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1296180581305942016',
    NULL,
    'stage2',
    7830,
    'z3fir',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '583924691073368069',
    NULL,
    'stage2',
    7831,
    'Dawid',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1153270538429542421',
    NULL,
    'stage2',
    7832,
    'gwd313g',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '1000080089888862278',
    NULL,
    'stage2',
    7833,
    'fieliep',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '695544671929368577',
    NULL,
    'stage2',
    7834,
    'k4cpe6ek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1236280013343424512',
    NULL,
    'stage2',
    7835,
    'kqcus.',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '692431475139805305',
    NULL,
    'stage2',
    7836,
    'jxcxk',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '761587793893654549',
    NULL,
    'stage2',
    7837,
    'Dr.Macika',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '383712116005404675',
    NULL,
    'stage2',
    7838,
    'czipsol',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '496024553609494539',
    NULL,
    'stage2',
    7839,
    'moREE',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '801164867457253406',
    NULL,
    'stage2',
    7840,
    '☢?????☢',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '361572745147842563',
    NULL,
    'stage2',
    7841,
    'CziKi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '486957798207258635',
    NULL,
    'stage2',
    7842,
    'Kuba',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '419278999991353374',
    NULL,
    'stage2',
    7843,
    'Monczall',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '419405937728684032',
    NULL,
    'stage2',
    7844,
    'didek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '150033391104950272',
    NULL,
    'stage2',
    7845,
    'Bez',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '1322673348924411944',
    NULL,
    'stage2',
    7846,
    'Asidesar',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '1181560396121907252',
    NULL,
    'stage2',
    7847,
    'świąteczny gila',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '542361412127686657',
    NULL,
    'stage2',
    7848,
    'Quiq',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '1328802155079012425',
    NULL,
    'stage2',
    7849,
    'jan',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '435779589864816640',
    NULL,
    'stage2',
    7850,
    'Grubycoach',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '434439412256997377',
    NULL,
    'stage2',
    7851,
    'orzeł zps',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1128584353509818379',
    NULL,
    'stage2',
    7852,
    'klimkoo_',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1099627480911978526',
    NULL,
    'stage2',
    7853,
    'jc0bs',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1337065983335993345',
    NULL,
    'stage2',
    7854,
    'Booki',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '1254016863533531192',
    NULL,
    'stage2',
    7855,
    'Rekinek66',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '430770974481448960',
    NULL,
    'stage2',
    7856,
    'dafid',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '723447196388819014',
    NULL,
    'stage2',
    7857,
    'XcZaRo',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '1219387685425254441',
    NULL,
    'stage2',
    7858,
    '! Мajkutini',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '498152549451563009',
    NULL,
    'stage2',
    7859,
    'mjkaelo',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '463001727310757888',
    NULL,
    'stage2',
    7860,
    'Kper',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '415864755845070850',
    NULL,
    'stage2',
    7861,
    'BOTGAT',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '352823893003730945',
    NULL,
    'stage2',
    7862,
    'Pancio ツ',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '1081626433266393198',
    NULL,
    'stage2',
    7863,
    'matiwk222',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1275527297893531772',
    NULL,
    'stage2',
    7864,
    'Bartuss',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '1394045439782949104',
    NULL,
    'stage2',
    7865,
    'Nixon',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '762270778754203688',
    NULL,
    'stage2',
    7866,
    'zysio',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '1141434928458911744',
    NULL,
    'stage2',
    7867,
    'Андреас',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '675411059091439626',
    NULL,
    'stage2',
    7868,
    'Adelay',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '227190937409945601',
    NULL,
    'stage2',
    7869,
    'siergiejj',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '472474920270561281',
    NULL,
    'stage2',
    7870,
    'Dekus',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '318343577765806080',
    NULL,
    'stage2',
    7871,
    'Gekoniasty',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '882519104316137502',
    NULL,
    'stage2',
    7872,
    'Sky Shafiq',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '278065188169842688',
    NULL,
    'stage2',
    7873,
    'ArcadianPrime',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '757903126157328385',
    NULL,
    'stage2',
    7874,
    'Liquid4K',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '919347146405339138',
    NULL,
    'stage2',
    7875,
    'POPROSTUFABIAN',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '300683011102474251',
    NULL,
    'stage2',
    7876,
    'Shintowskyツ',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '506914119710932993',
    NULL,
    'stage2',
    7877,
    'fre3sh',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '509413231219965955',
    NULL,
    'stage2',
    7878,
    'Mefisto',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1145443406638751815',
    NULL,
    'stage2',
    7879,
    'bombix',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '228173160355332097',
    NULL,
    'stage2',
    7880,
    'Banderas',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1439298047946522686',
    NULL,
    'stage2',
    7881,
    'crestofek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '427430915963224064',
    NULL,
    'stage2',
    7882,
    '滚筒',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '561623798596632588',
    NULL,
    'stage2',
    7883,
    'Lukasz_03',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '883797922381189141',
    NULL,
    'stage2',
    7884,
    'Kopia???',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '906231768712101919',
    NULL,
    'stage2',
    7885,
    'hub1x',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '312633551466135553',
    NULL,
    'stage2',
    7886,
    'ZenSoul',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '573574878918082560',
    NULL,
    'stage2',
    7887,
    'Tusiactwo',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '322812891956903937',
    NULL,
    'stage2',
    7888,
    'Luxor',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '337966578798690304',
    NULL,
    'stage2',
    7889,
    'waso',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '519287591028391959',
    NULL,
    'stage2',
    7890,
    ',,Sajmuraj\'\'',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '333906708336476170',
    NULL,
    'stage2',
    7891,
    'Fazer*',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1284075325042724900',
    NULL,
    'stage2',
    7892,
    'Buldogun',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '302360723676463104',
    NULL,
    'stage2',
    7893,
    'MaTTiS?',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '733573014402236449',
    NULL,
    'stage2',
    7894,
    '?????',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1145386101264109669',
    NULL,
    'stage2',
    7895,
    'Mr Marty',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '1351636790678654987',
    NULL,
    'stage2',
    7896,
    '3MPT!N3SSS',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '814412156555755540',
    NULL,
    'stage2',
    7897,
    'm3tiz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '649683931897135125',
    NULL,
    'stage2',
    7898,
    'szymcr8',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '453811822320025603',
    NULL,
    'stage2',
    7899,
    'D1oxie',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '710794795529928785',
    NULL,
    'stage2',
    7900,
    'PIKOM',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '964187009520377856',
    NULL,
    'stage2',
    7901,
    'Gemainda',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '1078726241680633857',
    NULL,
    'stage2',
    7902,
    'xSetiツ_',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1428965429635977299',
    NULL,
    'stage2',
    7903,
    'ejwejqe',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '646804591853436946',
    NULL,
    'stage2',
    7904,
    'Dorkej',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '522446902147547157',
    NULL,
    'stage2',
    7905,
    'kam8l',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '924710423100522506',
    NULL,
    'stage2',
    7906,
    'poprostu koko',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '328909487136309248',
    NULL,
    'stage2',
    7907,
    'esa',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '319901756064792588',
    NULL,
    'stage2',
    7908,
    'ZIPI',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '510573405569941515',
    NULL,
    'stage2',
    7909,
    'Grubcio',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '532912683666898944',
    NULL,
    'stage2',
    7910,
    'xQBIK.wav',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '410931873322369034',
    NULL,
    'stage2',
    7911,
    'Strachowski2204',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '864932529789206629',
    NULL,
    'stage2',
    7912,
    'Terapeutaaa',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1337893397721251894',
    NULL,
    'stage2',
    7913,
    'Feran',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '846392005692358666',
    NULL,
    'stage2',
    7914,
    'Nice reposition for hunter',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '693547426212216892',
    NULL,
    'stage2',
    7915,
    'BoloTv',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '582996319216599071',
    NULL,
    'stage2',
    7916,
    'ʻO JayKowski',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '983477936810238052',
    NULL,
    'stage2',
    7917,
    '!Spinka',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '284275389348446209',
    NULL,
    'stage2',
    7918,
    'Kszyś',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '581860728240340992',
    NULL,
    'stage2',
    7919,
    'DAMN1ggy_',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '773526091628412930',
    NULL,
    'stage2',
    7920,
    'itsLoCKz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '555800660357021696',
    NULL,
    'stage2',
    7921,
    'Тотя ❤',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '534065689947013122',
    NULL,
    'stage2',
    7922,
    'Konfi Cotton',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1063823269297393676',
    NULL,
    'stage2',
    7923,
    'Barcus88',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '802583654723092550',
    NULL,
    'stage2',
    7924,
    '♕Kezzy™♕',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1284132286064758807',
    NULL,
    'stage2',
    7925,
    'Filipeqo',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '926626252985618432',
    NULL,
    'stage2',
    7926,
    'dombi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '402199933936992258',
    NULL,
    'stage2',
    7927,
    'Mam wolne wtorki',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1041833033629700156',
    NULL,
    'stage2',
    7928,
    'm1siek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '917148130456260719',
    NULL,
    'stage2',
    7929,
    'Tocyk',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1250835724169777277',
    NULL,
    'stage2',
    7930,
    'everyone',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '905494286005583872',
    NULL,
    'stage2',
    7931,
    'shesaskurwol',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '210125024672219136',
    NULL,
    'stage2',
    7932,
    'Hypu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '1158820143397339146',
    NULL,
    'stage2',
    7933,
    'stan1eyek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '529027111504314399',
    NULL,
    'stage2',
    7934,
    'xNiko',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '364402950057099266',
    NULL,
    'stage2',
    7935,
    'eMten',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '874671251459833876',
    NULL,
    'stage2',
    7936,
    '--js',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '737688687227306075',
    NULL,
    'stage2',
    7937,
    'adleko',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '447785515186520064',
    NULL,
    'stage2',
    7938,
    'siemasiema1312',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '506122849082277908',
    NULL,
    'stage2',
    7939,
    'Pita',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '397131740600205313',
    NULL,
    'stage2',
    7940,
    'Charles Leclerc',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '415969455412215818',
    NULL,
    'stage2',
    7941,
    'Slomczyn',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '350604331621548032',
    NULL,
    'stage2',
    7942,
    'Deyanek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '789922633012609044',
    NULL,
    'stage2',
    7943,
    'Subwey',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '1396160636639117372',
    NULL,
    'stage2',
    7944,
    'BL Mateo710',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '456088997827969024',
    NULL,
    'stage2',
    7945,
    'bezbożnik',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1168436698896683082',
    NULL,
    'stage2',
    7946,
    '0rrek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '610040910301888542',
    NULL,
    'stage2',
    7947,
    'm1odyk4k4',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '1124240992380395550',
    NULL,
    'stage2',
    7948,
    'kuba koz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    18,
    '535251994831618076',
    NULL,
    'stage2',
    7949,
    'Toomixx',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '478486060943540225',
    NULL,
    'stage2',
    7950,
    'Marcineq',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '351475146604675072',
    NULL,
    'stage2',
    7951,
    'haciolem',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '654314799840362498',
    NULL,
    'stage2',
    7952,
    'olifasoli2014',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '932271244345233439',
    NULL,
    'stage2',
    7953,
    'srajkez',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '493774952521269248',
    NULL,
    'stage2',
    7954,
    '???????',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1025367753588228128',
    NULL,
    'stage2',
    7955,
    'gitsoneqq',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '525034117105188865',
    NULL,
    'stage2',
    7956,
    'KayEss',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '428666355965755396',
    NULL,
    'stage2',
    7957,
    'uniq7565',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '811601970506629150',
    NULL,
    'stage2',
    7958,
    'KebabikRHC',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '1319319791571570754',
    NULL,
    'stage2',
    7959,
    'muszkieter666',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '548248747977474048',
    NULL,
    'stage2',
    7960,
    'Łukasz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1094596210230317096',
    NULL,
    'stage2',
    7961,
    'g1mbus',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '862041274973552651',
    NULL,
    'stage2',
    7962,
    'BqMaJsTeR',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    0,
    '460126239173378069',
    NULL,
    'stage2',
    7963,
    'FNXXX-',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '420910465384841217',
    NULL,
    'stage2',
    7964,
    'Amonra',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '727857027421831288',
    NULL,
    'stage2',
    7965,
    'Barqus',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '627115371878416385',
    NULL,
    'stage2',
    7966,
    'Savi0X',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '788345818343669760',
    NULL,
    'stage2',
    7967,
    'nfixme ੭* ‧₊°',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '1326677945867309076',
    NULL,
    'stage2',
    7968,
    'Dzyrosiarz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '662608188922789908',
    NULL,
    'stage2',
    7969,
    'asfalt125',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '519586946176253952',
    NULL,
    'stage2',
    7970,
    'ҜuBi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '808309868586467348',
    NULL,
    'stage2',
    7971,
    'bartmacieja',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '233330984395866112',
    NULL,
    'stage2',
    7972,
    'Neverxoid',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1145712428580098118',
    NULL,
    'stage2',
    7973,
    'Klops',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '378201105256939521',
    NULL,
    'stage2',
    7974,
    'kombajnista',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '931168369573503006',
    NULL,
    'stage2',
    7975,
    'Rysiu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    0,
    '1329387696669327371',
    NULL,
    'stage2',
    7976,
    'PISTON',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '352080834934865920',
    NULL,
    'stage2',
    7977,
    'Zlamikos',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '488757200399892480',
    NULL,
    'stage2',
    7978,
    '✔ ???????? ✔',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '451703866267009024',
    NULL,
    'stage2',
    7979,
    'Egzekucja',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '516697873497456655',
    NULL,
    'stage2',
    7980,
    'hap3r',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    0,
    '1272830126832226355',
    NULL,
    'stage2',
    7981,
    'Ewok',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1077219449502965790',
    NULL,
    'stage2',
    7982,
    'JakoN-',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '1307078104652714055',
    NULL,
    'stage2',
    7983,
    'gruby',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1067108422652284968',
    NULL,
    'stage2',
    7984,
    'Nikt Ciekawy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '907022269140832286',
    NULL,
    'stage2',
    7985,
    'scheydy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '867161106493866006',
    NULL,
    'stage2',
    7986,
    'cross',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '759697317263310889',
    NULL,
    'stage2',
    7987,
    'questrian',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1077357796762337331',
    NULL,
    'stage2',
    7988,
    'StasiuMadaFak',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1139945488167219243',
    NULL,
    'stage2',
    7989,
    'Bubiks',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '359370791076364290',
    NULL,
    'stage2',
    7990,
    'ŁeB SzOt',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1283815621829857341',
    NULL,
    'stage2',
    7991,
    'Antonisss878',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '823526692189634580',
    NULL,
    'stage2',
    7992,
    'geeciu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '499568655508570119',
    NULL,
    'stage2',
    7993,
    'bodzix',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1172057126240272385',
    NULL,
    'stage2',
    7994,
    'NOrce',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1279804882445930609',
    NULL,
    'stage2',
    7995,
    '<O®T¡0n',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '320224049760567296',
    NULL,
    'stage2',
    7996,
    'pbialy123',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '259063959867359233',
    NULL,
    'stage2',
    7997,
    'kam123k',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '691432428232900709',
    NULL,
    'stage2',
    7998,
    'macidk12',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '651126587621900289',
    NULL,
    'stage2',
    7999,
    'tonypie',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '594964029940957224',
    NULL,
    'stage2',
    8000,
    'McGregor17',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '727134099231211571',
    NULL,
    'stage2',
    8001,
    '촌사람 같은',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '531485490575310879',
    NULL,
    'stage2',
    8002,
    'Le Prince',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '486577410037514250',
    NULL,
    'stage2',
    8003,
    'Tamski',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '766662513604689955',
    NULL,
    'stage2',
    8004,
    'Fraik',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '576141255336132609',
    NULL,
    'stage2',
    8005,
    'Bartol',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '421726542104625163',
    NULL,
    'stage2',
    8006,
    'Lemonziiko',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '300273286489702402',
    NULL,
    'stage2',
    8007,
    'Borowik',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    20,
    '340076455868235777',
    NULL,
    'stage2',
    8008,
    'T1mero',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '629686561562165249',
    NULL,
    'stage2',
    8009,
    'Turoczek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '305737641763274752',
    NULL,
    'stage2',
    8010,
    'sadz1k',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '348911633336238080',
    NULL,
    'stage2',
    8011,
    'Gavloo',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '749701801304916020',
    NULL,
    'stage2',
    8012,
    'Krzyhus212',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '471463411239092225',
    NULL,
    'stage2',
    8013,
    '-muchson-',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '462244738096037899',
    NULL,
    'stage2',
    8014,
    'Zzero',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1225901047982329876',
    NULL,
    'stage2',
    8015,
    'Karambolowy zawrót głowy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '623578079951978516',
    NULL,
    'stage2',
    8016,
    'S00chy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '598815429091393536',
    NULL,
    'stage2',
    8017,
    'CYSIOO',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '1245802397645934682',
    NULL,
    'stage2',
    8018,
    'lunargondolier22',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '809885132101779456',
    NULL,
    'stage2',
    8019,
    'Laki',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '779402540755976192',
    NULL,
    'stage2',
    8020,
    '_prosik_5678_',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '414528693386608640',
    NULL,
    'stage2',
    8021,
    'Tyrek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '823202779971453048',
    NULL,
    'stage2',
    8022,
    '✝Hy4per✝',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1270413622371422343',
    NULL,
    'stage2',
    8023,
    'happy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '812409482088415242',
    NULL,
    'stage2',
    8024,
    'przemo91',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '755766085982093312',
    NULL,
    'stage2',
    8025,
    'Tiřõ²⅓⁷',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '879476380562235392',
    NULL,
    'stage2',
    8026,
    'Kiwi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '723493354918379533',
    NULL,
    'stage2',
    8027,
    'Monte',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '779804152976375828',
    NULL,
    'stage2',
    8028,
    'Nix_ℵ',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    0,
    '342566246123831316',
    NULL,
    'stage2',
    8029,
    'essakessa',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '231814174030823424',
    NULL,
    'stage2',
    8030,
    'Mista0swaggg',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '657270787711041546',
    NULL,
    'stage2',
    8031,
    'Assassin',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '1172505884782497853',
    NULL,
    'stage2',
    8032,
    'fiejuu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1037766729775984680',
    NULL,
    'stage2',
    8033,
    '_razyy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '755461769987751987',
    NULL,
    'stage2',
    8034,
    '5iontal',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1278670384358621225',
    NULL,
    'stage2',
    8035,
    'XeytoX',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '604552227759063040',
    NULL,
    'stage2',
    8036,
    'Macmal',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '809741245148692480',
    NULL,
    'stage2',
    8037,
    'k0n0p4ck1',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '724151346609127445',
    NULL,
    'stage2',
    8038,
    'Piter',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '704078031567847595',
    NULL,
    'stage2',
    8039,
    'Felipe El Manitas',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '589103946921148446',
    NULL,
    'stage2',
    8040,
    'FaBi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '958425938746544168',
    NULL,
    'stage2',
    8041,
    'Cactus ?',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '518331730688475136',
    NULL,
    'stage2',
    8042,
    'Pastor',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '954381292278014082',
    NULL,
    'stage2',
    8043,
    'sleepy8968',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1097190679773466764',
    NULL,
    'stage2',
    8044,
    '?????',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '678349800734851097',
    NULL,
    'stage2',
    8045,
    'Luka$er',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '723525504384237620',
    NULL,
    'stage2',
    8046,
    'Matrix',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '1330273938856476845',
    NULL,
    'stage2',
    8047,
    'Dukasun',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '486499834384220170',
    NULL,
    'stage2',
    8048,
    'Rogyoa',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1117505334869758144',
    NULL,
    'stage2',
    8049,
    'Maasterek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '590180516716871683',
    NULL,
    'stage2',
    8050,
    'Worekit',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '1292388710121209858',
    NULL,
    'stage2',
    8051,
    'chryty',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '575379448757747732',
    NULL,
    'stage2',
    8052,
    '???????',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '1060965953954910279',
    NULL,
    'stage2',
    8053,
    'PanMaruda',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '386495286563962880',
    NULL,
    'stage2',
    8054,
    'KSL',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '668913702510002179',
    NULL,
    'stage2',
    8055,
    'Gajtan',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '696087842308489237',
    NULL,
    'stage2',
    8056,
    'Mati1493',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '792063759521808394',
    NULL,
    'stage2',
    8057,
    'Hubcio',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '1034910520165285898',
    NULL,
    'stage2',
    8058,
    'Qbinho',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '1097066576294977547',
    NULL,
    'stage2',
    8059,
    'F0STiii',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '512348961080737804',
    NULL,
    'stage2',
    8060,
    'Blank',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '630820180901101600',
    NULL,
    'stage2',
    8061,
    'iluminati',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '682207856153591888',
    NULL,
    'stage2',
    8062,
    '????????',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '312232069289869322',
    NULL,
    'stage2',
    8063,
    'Turb0s',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '330505053314220034',
    NULL,
    'stage2',
    8064,
    'Pauder',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '340841216507904001',
    NULL,
    'stage2',
    8065,
    'CwelulozaOwner',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '714543991122821120',
    NULL,
    'stage2',
    8066,
    'moobsik',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '406902151529627649',
    NULL,
    'stage2',
    8067,
    'RamirezKKS',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    2,
    '477195073419870220',
    NULL,
    'stage2',
    8068,
    'Dexver',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '890220298861940767',
    NULL,
    'stage2',
    8069,
    'jug3n',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '461851082570596352',
    NULL,
    'stage3',
    12515,
    'Ciepły',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '627796290788392970',
    NULL,
    'stage3',
    12516,
    'makuwk1233',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '723588449151746050',
    NULL,
    'stage3',
    12517,
    'Neku',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '657270787711041546',
    NULL,
    'stage3',
    12518,
    'Assassin',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '804729333276868609',
    NULL,
    'stage3',
    12519,
    'salty',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1000080089888862278',
    NULL,
    'stage3',
    12520,
    'fieliep',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '1276633433166188544',
    NULL,
    'stage3',
    12521,
    'M9JKOL',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '815342777918554122',
    NULL,
    'stage3',
    12522,
    'Wojtas.',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '517441265575526400',
    NULL,
    'stage3',
    12523,
    'bili13',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1117505334869758144',
    NULL,
    'stage3',
    12524,
    'Maasterek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1133673169350307931',
    NULL,
    'stage3',
    12525,
    'PJ',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '790973841257922561',
    NULL,
    'stage3',
    12526,
    '_skowron.',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '471399701976055818',
    NULL,
    'stage3',
    12527,
    'Milyy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1439298047946522686',
    NULL,
    'stage3',
    12528,
    'crestofek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '498845748792786944',
    NULL,
    'stage3',
    12529,
    'Multi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '662546565251989515',
    NULL,
    'stage3',
    12530,
    'statkowy12',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '713422719957467187',
    NULL,
    'stage3',
    12531,
    'Muki',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '932271244345233439',
    NULL,
    'stage3',
    12532,
    'srajkez',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1292388710121209858',
    NULL,
    'stage3',
    12533,
    'chryty',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '228173160355332097',
    NULL,
    'stage3',
    12534,
    'Banderas',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '420597124724555777',
    NULL,
    'stage3',
    12535,
    'sqiel',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '1284199463216349188',
    NULL,
    'stage3',
    12536,
    'jimmy czu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1254016863533531192',
    NULL,
    'stage3',
    12537,
    'Rekinek66',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '406902151529627649',
    NULL,
    'stage3',
    12538,
    'RamirezKKS',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '710794795529928785',
    NULL,
    'stage3',
    12539,
    'PIKOM',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '905494286005583872',
    NULL,
    'stage3',
    12540,
    'shesaskurwol',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '486957798207258635',
    NULL,
    'stage3',
    12541,
    'Kuba',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '1049079069335101440',
    NULL,
    'stage3',
    12542,
    'xnPiciuchny',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '415864755845070850',
    NULL,
    'stage3',
    12543,
    'BOTGAT',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '486499834384220170',
    NULL,
    'stage3',
    12544,
    'Rogyoa',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '512348961080737804',
    NULL,
    'stage3',
    12545,
    'Blank',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '964187009520377856',
    NULL,
    'stage3',
    12546,
    'Gemainda',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '506914119710932993',
    NULL,
    'stage3',
    12547,
    'fre3sh',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '322812891956903937',
    NULL,
    'stage3',
    12548,
    'Luxor',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '801164867457253406',
    NULL,
    'stage3',
    12549,
    '☢?????☢',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '692431475139805305',
    NULL,
    'stage3',
    12550,
    'jxcxk',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '361572745147842563',
    NULL,
    'stage3',
    12551,
    'CziKi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '723447196388819014',
    NULL,
    'stage3',
    12552,
    'XcZaRo',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1182053587774341170',
    NULL,
    'stage3',
    12553,
    'Pleple',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '727134099231211571',
    NULL,
    'stage3',
    12554,
    '촌사람 같은',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    18,
    '542361412127686657',
    NULL,
    'stage3',
    12555,
    'Quiq',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '312633551466135553',
    NULL,
    'stage3',
    12556,
    'ZenSoul',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '340841216507904001',
    NULL,
    'stage3',
    12557,
    'CwelulozaOwner',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '1084250127084028015',
    NULL,
    'stage3',
    12558,
    'FFK Posh',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '581860728240340992',
    NULL,
    'stage3',
    12559,
    'DAMN1ggy_',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '733573014402236449',
    NULL,
    'stage3',
    12560,
    '?????',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1250835724169777277',
    NULL,
    'stage3',
    12561,
    'everyone',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '340076455868235777',
    NULL,
    'stage3',
    12562,
    'T1mero',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '350604331621548032',
    NULL,
    'stage3',
    12563,
    'Deyanek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '447785515186520064',
    NULL,
    'stage3',
    12564,
    'siemasiema1312',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '662341682649366530',
    NULL,
    'stage3',
    12565,
    'SmashiX',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '815686164710162432',
    NULL,
    'stage3',
    12566,
    'Topór',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '419278999991353374',
    NULL,
    'stage3',
    12567,
    'Monczall',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '333906708336476170',
    NULL,
    'stage3',
    12568,
    'Fazer*',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1284075325042724900',
    NULL,
    'stage3',
    12569,
    'Buldogun',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '879476380562235392',
    NULL,
    'stage3',
    12570,
    'Kiwi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '419405937728684032',
    NULL,
    'stage3',
    12571,
    'didek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1219387685425254441',
    NULL,
    'stage3',
    12572,
    '! Мajkutini',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '867161106493866006',
    NULL,
    'stage3',
    12573,
    'cross',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '529027111504314399',
    NULL,
    'stage3',
    12574,
    'xNiko',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '1081626433266393198',
    NULL,
    'stage3',
    12575,
    'matiwk222',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1204544158828597325',
    NULL,
    'stage3',
    12576,
    'arsiif',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '789922633012609044',
    NULL,
    'stage3',
    12577,
    'Subwey',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '656537113394937866',
    NULL,
    'stage3',
    12578,
    'zajchuu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1145443406638751815',
    NULL,
    'stage3',
    12579,
    'bombix',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '1310326288011231294',
    NULL,
    'stage3',
    12580,
    'Antek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '409748306282151948',
    NULL,
    'stage3',
    12581,
    'jokermariusz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '498152549451563009',
    NULL,
    'stage3',
    12582,
    'mjkaelo',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '627115371878416385',
    NULL,
    'stage3',
    12583,
    'Savi0X',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '352823893003730945',
    NULL,
    'stage3',
    12584,
    'Pancio ツ',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '435779589864816640',
    NULL,
    'stage3',
    12585,
    'Grubycoach',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '615538803687424011',
    NULL,
    'stage3',
    12586,
    'mikekosa',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '864932529789206629',
    NULL,
    'stage3',
    12587,
    'Terapeutaaa',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1275527297893531772',
    NULL,
    'stage3',
    12588,
    'Bartuss',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '471463411239092225',
    NULL,
    'stage3',
    12589,
    '-muchson-',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '646804591853436946',
    NULL,
    'stage3',
    12590,
    'Dorkej',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '668913702510002179',
    NULL,
    'stage3',
    12591,
    'Gajtan',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '762270778754203688',
    NULL,
    'stage3',
    12592,
    'zysio',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1023203535971684425',
    NULL,
    'stage3',
    12593,
    'Deter',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '463001727310757888',
    NULL,
    'stage3',
    12594,
    'Kper',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '929472369595146342',
    NULL,
    'stage3',
    12595,
    'kerajz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '1272830126832226355',
    NULL,
    'stage3',
    12596,
    'Ewok',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '779402540755976192',
    NULL,
    'stage3',
    12597,
    '_prosik_5678_',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '453811822320025603',
    NULL,
    'stage3',
    12598,
    'D1oxie',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '472474920270561281',
    NULL,
    'stage3',
    12599,
    'Dekus',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    18,
    '882519104316137502',
    NULL,
    'stage3',
    12600,
    'Sky Shafiq',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    22,
    '823526692189634580',
    NULL,
    'stage3',
    12601,
    'geeciu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '896147575093198958',
    NULL,
    'stage3',
    12602,
    'KmL',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '614884618272768038',
    NULL,
    'stage3',
    12603,
    'hopper',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1337893397721251894',
    NULL,
    'stage3',
    12604,
    'Feran',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '808309868586467348',
    NULL,
    'stage3',
    12605,
    'bartmacieja',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '811601970506629150',
    NULL,
    'stage3',
    12606,
    'KebabikRHC',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '428666355965755396',
    NULL,
    'stage3',
    12607,
    'uniq7565',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '555800660357021696',
    NULL,
    'stage3',
    12608,
    'Тотя ❤',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '1181560396121907252',
    NULL,
    'stage3',
    12609,
    'świąteczny gila',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '809314209971437598',
    NULL,
    'stage3',
    12610,
    'IxPeRI',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '231814174030823424',
    NULL,
    'stage3',
    12611,
    'Mista0swaggg',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '509429079464738840',
    NULL,
    'stage3',
    12612,
    'Diptu',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '919347146405339138',
    NULL,
    'stage3',
    12613,
    'POPROSTUFABIAN',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '386495286563962880',
    NULL,
    'stage3',
    12614,
    'KSL',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '291621406708465664',
    NULL,
    'stage3',
    12615,
    'angel',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '757903126157328385',
    NULL,
    'stage3',
    12616,
    'Liquid4K',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '477195073419870220',
    NULL,
    'stage3',
    12617,
    'Dexver',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '895331618590441523',
    NULL,
    'stage3',
    12618,
    'Asencio',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '1145386101264109669',
    NULL,
    'stage3',
    12619,
    'Mr Marty',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '359370791076364290',
    NULL,
    'stage3',
    12620,
    'ŁeB SzOt',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '548248747977474048',
    NULL,
    'stage3',
    12621,
    'Łukasz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '575379448757747732',
    NULL,
    'stage3',
    12622,
    '???????',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '788345818343669760',
    NULL,
    'stage3',
    12623,
    'nfixme ༉‧₊˚✧',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '954381292278014082',
    NULL,
    'stage3',
    12624,
    'sleepy8968',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1034910520165285898',
    NULL,
    'stage3',
    12625,
    'Qbinho',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '525034117105188865',
    NULL,
    'stage3',
    12626,
    'KayEss',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '463234527850921985',
    NULL,
    'stage3',
    12627,
    'Igssk',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    18,
    '1288098809595039796',
    NULL,
    'stage3',
    12628,
    'Ummopolaco',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '451016732551675905',
    NULL,
    'stage3',
    12629,
    'nscr',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '305737641763274752',
    NULL,
    'stage3',
    12630,
    'sadz1k',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '1078726241680633857',
    NULL,
    'stage3',
    12631,
    'xSetiツ_',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1037766729775984680',
    NULL,
    'stage3',
    12632,
    '_razyy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1396160636639117372',
    NULL,
    'stage3',
    12633,
    'BL Mateo710',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '312232069289869322',
    NULL,
    'stage3',
    12634,
    'Turb0s',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '510573405569941515',
    NULL,
    'stage3',
    12635,
    'Grubcio',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1099627480911978526',
    NULL,
    'stage3',
    12636,
    'jc0bs',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '737688687227306075',
    NULL,
    'stage3',
    12637,
    'adleko',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '693547426212216892',
    NULL,
    'stage3',
    12638,
    'BoloTv',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1164627142533972029',
    NULL,
    'stage3',
    12639,
    'xan',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1077219449502965790',
    NULL,
    'stage3',
    12640,
    'JakoN-',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '862041274973552651',
    NULL,
    'stage3',
    12641,
    'BqMaJsTeR',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '761587793893654549',
    NULL,
    'stage3',
    12642,
    'Dr.Macika',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '478486060943540225',
    NULL,
    'stage3',
    12643,
    'Marcineq',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1172057126240272385',
    NULL,
    'stage3',
    12644,
    'NOrce',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '846006823899103253',
    NULL,
    'stage3',
    12645,
    'les1ak-',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '320224049760567296',
    NULL,
    'stage3',
    12646,
    'pbialy123',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '532912683666898944',
    NULL,
    'stage3',
    12647,
    'xQBIK.wav',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '383712116005404675',
    NULL,
    'stage3',
    12648,
    'czipsol',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '773526091628412930',
    NULL,
    'stage3',
    12649,
    'itsLoCKz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '421726542104625163',
    NULL,
    'stage3',
    12650,
    'Lemonziiko',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    4,
    '727857027421831288',
    NULL,
    'stage3',
    12651,
    'Barqus',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '522446902147547157',
    NULL,
    'stage3',
    12652,
    'kam8l',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '690944257439301652',
    NULL,
    'stage3',
    12653,
    'Kowss50',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '364402950057099266',
    NULL,
    'stage3',
    12654,
    'eMten',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '1153270538429542421',
    NULL,
    'stage3',
    12655,
    'gwd313g',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '723493354918379533',
    NULL,
    'stage3',
    12656,
    'Monte',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '594964029940957224',
    NULL,
    'stage3',
    12657,
    'McGregor17',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '348517152468369409',
    NULL,
    'stage3',
    12658,
    'igicz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '696087842308489237',
    NULL,
    'stage3',
    12659,
    'Mati1493',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '1067108422652284968',
    NULL,
    'stage3',
    12660,
    'Nikt Ciekawy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '410931873322369034',
    NULL,
    'stage3',
    12661,
    'Strachowski2204',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '759697317263310889',
    NULL,
    'stage3',
    12662,
    'questrian',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '451703866267009024',
    NULL,
    'stage3',
    12663,
    'Egzekucja',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '519586946176253952',
    NULL,
    'stage3',
    12664,
    'ҜuBi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '323024700609658890',
    NULL,
    'stage3',
    12665,
    '☣☀Amazing Amepies☀☣',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '300273286489702402',
    NULL,
    'stage3',
    12666,
    'Borowik',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '649683931897135125',
    NULL,
    'stage3',
    12667,
    'szymcr8',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '378201105256939521',
    NULL,
    'stage3',
    12668,
    'kombajnista',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '675411059091439626',
    NULL,
    'stage3',
    12669,
    'Adelay',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '462244738096037899',
    NULL,
    'stage3',
    12670,
    'Zzero',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '755461769987751987',
    NULL,
    'stage3',
    12671,
    '5iontal',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '499568655508570119',
    NULL,
    'stage3',
    12672,
    'bodzix',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '651126587621900289',
    NULL,
    'stage3',
    12673,
    'tonypie',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '654314799840362498',
    NULL,
    'stage3',
    12674,
    'olifasoli2014',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '318343577765806080',
    NULL,
    'stage3',
    12675,
    'Gekoniasty',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '907022269140832286',
    NULL,
    'stage3',
    12676,
    'scheydy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '516697873497456655',
    NULL,
    'stage3',
    12677,
    'hap3r',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '434439412256997377',
    NULL,
    'stage3',
    12678,
    'orzeł zps',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '427430915963224064',
    NULL,
    'stage3',
    12679,
    '滚筒',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '1225901047982329876',
    NULL,
    'stage3',
    12680,
    'Karambolowy zawrót głowy',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '573574878918082560',
    NULL,
    'stage3',
    12681,
    'Tusiactwo',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '691432428232900709',
    NULL,
    'stage3',
    12682,
    'macidk12',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '535251994831618076',
    NULL,
    'stage3',
    12683,
    'Toomixx',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '443767806241275915',
    NULL,
    'stage3',
    12684,
    'kotlecik',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '682207856153591888',
    NULL,
    'stage3',
    12685,
    '????????',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '809885132101779456',
    NULL,
    'stage3',
    12686,
    'Laki',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    18,
    '233330984395866112',
    NULL,
    'stage3',
    12687,
    'Neverxoid',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '561623798596632588',
    NULL,
    'stage3',
    12688,
    'Lukasz_03',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '486577410037514250',
    NULL,
    'stage3',
    12689,
    'Tamski',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '1394045439782949104',
    NULL,
    'stage3',
    12690,
    'Nixon',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '430770974481448960',
    NULL,
    'stage3',
    12691,
    'dafid',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '131175559345602561',
    NULL,
    'stage3',
    12692,
    'B3neK',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1124240992380395550',
    NULL,
    'stage3',
    12693,
    'kuba koz',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '402199933936992258',
    NULL,
    'stage3',
    12694,
    'Mam wolne wtorki',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '714543991122821120',
    NULL,
    'stage3',
    12695,
    'moobsik',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '630820180901101600',
    NULL,
    'stage3',
    12696,
    'iluminati',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '792063759521808394',
    NULL,
    'stage3',
    12697,
    'Hubcio',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '1077357796762337331',
    NULL,
    'stage3',
    12698,
    'StasiuMadaFak',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '348911633336238080',
    NULL,
    'stage3',
    12699,
    'Gavloo',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '569508807374536724',
    NULL,
    'stage3',
    12700,
    'klonx9',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '906231768712101919',
    NULL,
    'stage3',
    12701,
    'hub1x',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    10,
    '247084993971617793',
    NULL,
    'stage3',
    12702,
    'roxiecoal',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '326003414238756864',
    NULL,
    'stage3',
    12703,
    'Dziku',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '479245851722645535',
    NULL,
    'stage3',
    12704,
    'Ales',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '724151346609127445',
    NULL,
    'stage3',
    12705,
    'Piter',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '983477936810238052',
    NULL,
    'stage3',
    12706,
    '!Spinka',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '723525504384237620',
    NULL,
    'stage3',
    12707,
    'Matrix',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '534065689947013122',
    NULL,
    'stage3',
    12708,
    'Konfi Cotton',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '352080834934865920',
    NULL,
    'stage3',
    12709,
    'Zlamikos',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '503570853611700224',
    NULL,
    'stage3',
    12710,
    'xSerrek',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '1236280013343424512',
    NULL,
    'stage3',
    12711,
    'kqcus.',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    6,
    '488757200399892480',
    NULL,
    'stage3',
    12712,
    '✔ ???????? ✔',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    8,
    '1279804882445930609',
    NULL,
    'stage3',
    12713,
    '<O®T¡0n',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    16,
    '926626252985618432',
    NULL,
    'stage3',
    12714,
    'dombi',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    12,
    '1388519493361471569',
    NULL,
    'stage3',
    12715,
    'Balacl4va',
    1
  );
INSERT INTO
  `swiss_scores` (
    `username`,
    `points`,
    `user_id`,
    `swiss_number`,
    `stage`,
    `id`,
    `displayname`,
    `active`
  )
VALUES
  (
    NULL,
    14,
    '1097066576294977547',
    NULL,
    'stage3',
    12716,
    'F0STiii',
    1
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: tournament_settings
# ------------------------------------------------------------


/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
