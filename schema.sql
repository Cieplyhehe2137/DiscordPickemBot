-- schema.sql
-- Snapshot rzeczywistego schematu produkcyjnej bazy (s25345_pickemdb).
-- Wygenerowane read-only przez SHOW CREATE TABLE, 2026-07-02.
-- Wszystkie 3 gildie (hyperland, luffastream, testserwer) dziela te sama baze.
-- To jest DOKUMENTACJA, nie plik do wykonania - nie ma tu zadnych zmian wzgledem stanu produkcji.
-- Konwencja dla przyszlych zmian: migrations/NNNN_opis.sql (patrz migrations/README.md).

-- ============================================================
-- active_panels
-- ============================================================
CREATE TABLE `active_panels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phase` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channel_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deadline` datetime DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `reminded` tinyint DEFAULT NULL,
  `closed` tinyint DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `stage` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stage_key` varchar(50) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (ifnull(`stage`,_utf8mb4'')) STORED,
  `match_deadline` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_phase_stagekey_channel` (`phase`,`stage_key`,`channel_id`),
  KEY `idx_active_panels_lookup` (`guild_id`,`phase`,`stage`,`active`,`closed`,`deadline`)
) ENGINE=InnoDB AUTO_INCREMENT=577 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- admin_logs
-- ============================================================
CREATE TABLE `admin_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_id` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `displayname` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phase` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stage` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `details` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- admin_users
-- ============================================================
CREATE TABLE `admin_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `discord_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `discord_id` (`discord_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- archive_files
-- ============================================================
CREATE TABLE `archive_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(32) NOT NULL,
  `filename` varchar(255) NOT NULL,
  `path` varchar(512) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_guild` (`guild_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- community_stats_posts
-- ============================================================
CREATE TABLE `community_stats_posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(64) NOT NULL,
  `match_id` int NOT NULL,
  `stats_type` varchar(64) NOT NULL,
  `posted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_stats_post` (`guild_id`,`match_id`,`stats_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- doubleelim_predictions
-- ============================================================
CREATE TABLE `doubleelim_predictions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `upper_final_a` text COLLATE utf8mb4_unicode_ci,
  `lower_final_a` text COLLATE utf8mb4_unicode_ci,
  `upper_final_b` text COLLATE utf8mb4_unicode_ci,
  `lower_final_b` text COLLATE utf8mb4_unicode_ci,
  `user_id` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint DEFAULT '0',
  `displayname` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `submitted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_doubleelim_prediction` (`guild_id`,`event_id`,`user_id`),
  KEY `idx_doubleelim_predictions_user_time` (`user_id`,`submitted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=83 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- doubleelim_results
-- ============================================================
CREATE TABLE `doubleelim_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_id` int NOT NULL,
  `upper_final_a` text COLLATE utf8mb4_unicode_ci,
  `lower_final_a` text COLLATE utf8mb4_unicode_ci,
  `upper_final_b` text COLLATE utf8mb4_unicode_ci,
  `lower_final_b` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_doubleelim_results_event` (`guild_id`,`event_id`),
  KEY `idx_doubleelim_results_active_id` (`active`,`id`),
  KEY `idx_doubleelim_results_event_active` (`guild_id`,`event_id`,`active`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- doubleelim_scores
-- ============================================================
CREATE TABLE `doubleelim_scores` (
  `username` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `points` int DEFAULT NULL,
  `user_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  `displayname` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  `event_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_doubleelim_scores_scope` (`guild_id`,`event_id`,`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1475 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- events
-- ============================================================
CREATE TABLE `events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(32) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `status` enum('UPCOMING','OPEN','CLOSED','FINISHED') DEFAULT 'UPCOMING',
  `is_archived` tinyint(1) DEFAULT '0',
  `deadline` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `phase` varchar(50) DEFAULT 'SWISS_STAGE_1',
  `is_open` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `external_tournament_id` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_guild_slug` (`guild_id`,`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- leaderboard
-- ============================================================
CREATE TABLE `leaderboard` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(32) NOT NULL,
  `event_id` int NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `total_points` int NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_entry` (`guild_id`,`event_id`,`user_id`),
  KEY `idx_event` (`event_id`),
  KEY `idx_guild` (`guild_id`)
) ENGINE=InnoDB AUTO_INCREMENT=49876 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- live_match_scores
-- ============================================================
CREATE TABLE `live_match_scores` (
  `match_id` int NOT NULL,
  `score_a` int NOT NULL DEFAULT '0',
  `score_b` int NOT NULL DEFAULT '0',
  `current_map` int DEFAULT '1',
  `status` varchar(32) DEFAULT 'LIVE',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`match_id`),
  CONSTRAINT `fk_live_match_scores_match` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- match_map_predictions
-- ============================================================
CREATE TABLE `match_map_predictions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `match_id` int NOT NULL,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_id` int DEFAULT NULL,
  `user_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `map_no` tinyint NOT NULL,
  `pred_exact_a` int DEFAULT NULL,
  `pred_exact_b` int DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pred_map` (`match_id`,`user_id`,`map_no`)
) ENGINE=InnoDB AUTO_INCREMENT=20326 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- match_map_results
-- ============================================================
CREATE TABLE `match_map_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `match_id` int NOT NULL,
  `map_no` tinyint NOT NULL,
  `exact_a` int DEFAULT NULL,
  `exact_b` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_match_map` (`match_id`,`map_no`)
) ENGINE=InnoDB AUTO_INCREMENT=333 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- match_points
-- ============================================================
CREATE TABLE `match_points` (
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `match_id` int NOT NULL,
  `user_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `points` tinyint NOT NULL,
  `computed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `source` enum('series','map') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'series',
  `event_id` int NOT NULL,
  PRIMARY KEY (`match_id`,`user_id`,`source`),
  UNIQUE KEY `uniq_match_points_src` (`guild_id`,`match_id`,`user_id`,`source`),
  CONSTRAINT `fk_pts_match` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- match_predictions
-- ============================================================
CREATE TABLE `match_predictions` (
  `match_id` int NOT NULL,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_id` int NOT NULL,
  `user_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pred_a` tinyint NOT NULL,
  `pred_b` tinyint NOT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `pred_exact_a` int DEFAULT NULL,
  `pred_exact_b` int DEFAULT NULL,
  PRIMARY KEY (`match_id`,`user_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_match_predictions_match` (`match_id`),
  CONSTRAINT `fk_pred_match` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- match_results
-- ============================================================
CREATE TABLE `match_results` (
  `match_id` int NOT NULL,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_id` int DEFAULT NULL,
  `res_a` int DEFAULT NULL,
  `res_b` int DEFAULT NULL,
  `finished_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `exact_a` int DEFAULT NULL,
  `exact_b` int DEFAULT NULL,
  PRIMARY KEY (`match_id`),
  UNIQUE KEY `uniq_match_results_match` (`match_id`),
  CONSTRAINT `fk_res_match` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- matches
-- ============================================================
CREATE TABLE `matches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phase` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `match_no` int DEFAULT NULL,
  `team_a` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `team_b` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `best_of` tinyint NOT NULL DEFAULT '3',
  `start_time_utc` datetime DEFAULT NULL,
  `is_locked` tinyint(1) NOT NULL DEFAULT '0',
  `panel_channel_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `panel_message_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `event_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_matches_scope` (`guild_id`,`event_id`,`phase`,`match_no`),
  KEY `idx_matches_lockwatch` (`is_locked`,`start_time_utc`),
  KEY `idx_matches_panel` (`panel_channel_id`,`panel_message_id`),
  KEY `fk_matches_event` (`event_id`),
  CONSTRAINT `fk_matches_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=446 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- mvp_candidates
-- ============================================================
CREATE TABLE `mvp_candidates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(64) NOT NULL,
  `event_id` int NOT NULL,
  `nickname` varchar(100) NOT NULL,
  `team_name` varchar(100) DEFAULT NULL,
  `image_url` text,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mvp_candidates_active` (`guild_id`,`is_active`),
  KEY `idx_mvp_candidates_event` (`guild_id`,`event_id`)
) ENGINE=InnoDB AUTO_INCREMENT=113 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- mvp_predictions
-- ============================================================
CREATE TABLE `mvp_predictions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(64) NOT NULL,
  `event_id` int NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `username` varchar(100) NOT NULL,
  `candidate_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_mvp_prediction_event` (`guild_id`,`event_id`,`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=225 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- mvp_results
-- ============================================================
CREATE TABLE `mvp_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(64) NOT NULL,
  `event_id` int NOT NULL,
  `candidate_id` int NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_mvp_result_event` (`guild_id`,`event_id`),
  KEY `idx_mvp_results_event` (`guild_id`,`event_id`),
  KEY `idx_mvp_results_active` (`guild_id`,`event_id`,`active`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- mvp_scores
-- ============================================================
CREATE TABLE `mvp_scores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(64) NOT NULL,
  `event_id` int NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `displayname` varchar(100) NOT NULL,
  `points` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mvp_scores_user` (`guild_id`,`event_id`,`user_id`),
  KEY `idx_mvp_scores_event` (`guild_id`,`event_id`)
) ENGINE=InnoDB AUTO_INCREMENT=300 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- phase_schedule_state
-- ============================================================
CREATE TABLE `phase_schedule_state` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(64) NOT NULL,
  `event_id` int DEFAULT NULL,
  `phase` varchar(64) NOT NULL,
  `schedule_complete` tinyint(1) NOT NULL DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_phase_schedule` (`guild_id`,`event_id`,`phase`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- playin_predictions
-- ============================================================
CREATE TABLE `playin_predictions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_id` int NOT NULL,
  `username` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `teams` text COLLATE utf8mb4_unicode_ci,
  `submitted_at` datetime DEFAULT NULL,
  `user_id` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint DEFAULT '0',
  `displayname` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_playin_prediction` (`guild_id`,`event_id`,`user_id`),
  KEY `idx_playin_predictions_active` (`active`)
) ENGINE=InnoDB AUTO_INCREMENT=446 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- playin_results
-- ============================================================
CREATE TABLE `playin_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_id` int NOT NULL,
  `correct_teams` text COLLATE utf8mb4_unicode_ci,
  `active` tinyint DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_guild_result` (`guild_id`),
  KEY `idx_playin_results_active` (`active`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- playin_scores
-- ============================================================
CREATE TABLE `playin_scores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `points` int DEFAULT NULL,
  `user_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `displayname` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  `event_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_playin_scores_scope` (`guild_id`,`event_id`,`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=13482 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- playoffs_predictions
-- ============================================================
CREATE TABLE `playoffs_predictions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(32) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `event_id` int NOT NULL,
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `semifinalists` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `finalists` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `winner` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `third_place_winner` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint DEFAULT '0',
  `displayname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `submitted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_playoffs_prediction` (`guild_id`,`event_id`,`user_id`),
  KEY `idx_playoffs_predictions_active` (`active`)
) ENGINE=InnoDB AUTO_INCREMENT=589 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- playoffs_results
-- ============================================================
CREATE TABLE `playoffs_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_id` int NOT NULL,
  `correct_semifinalists` text COLLATE utf8mb4_unicode_ci,
  `correct_finalists` text COLLATE utf8mb4_unicode_ci,
  `correct_winner` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `correct_third_place_winner` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `active` tinyint DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_playoffs_results_event` (`guild_id`,`event_id`),
  KEY `idx_playoffs_results_active_id` (`active`,`id`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- playoffs_scores
-- ============================================================
CREATE TABLE `playoffs_scores` (
  `username` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `points` int DEFAULT NULL,
  `score` int DEFAULT NULL,
  `user_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  `displayname` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  `event_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_playoffs_scores_scope` (`guild_id`,`event_id`,`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3425 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- swiss_predictions
-- ============================================================
CREATE TABLE `swiss_predictions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `username` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pick_3_0` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pick_0_3` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `advancing` text COLLATE utf8mb4_unicode_ci,
  `active` tinyint DEFAULT '0',
  `submitted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `stage` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `displayname` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_swiss_prediction` (`guild_id`,`event_id`,`user_id`,`stage`),
  KEY `idx_swiss_predictions_stage` (`stage`),
  KEY `idx_swiss_event` (`event_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1739 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- swiss_results
-- ============================================================
CREATE TABLE `swiss_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_id` int NOT NULL,
  `correct_3_0` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `correct_0_3` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `correct_advancing` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `stage` enum('stage1','stage2','stage3') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_swiss_results_event_stage` (`guild_id`,`event_id`,`stage`),
  KEY `idx_swiss_results_active` (`active`)
) ENGINE=InnoDB AUTO_INCREMENT=76 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- swiss_scores
-- ============================================================
CREATE TABLE `swiss_scores` (
  `username` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `points` int DEFAULT NULL,
  `user_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `swiss_number` int DEFAULT NULL,
  `stage` enum('stage1','stage2','stage3') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  `displayname` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  `event_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_swiss_scores_scope` (`guild_id`,`event_id`,`user_id`,`stage`)
) ENGINE=InnoDB AUTO_INCREMENT=58972 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- teams
-- ============================================================
CREATE TABLE `teams` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `short_name` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logo_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `external_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_guild_name` (`guild_id`,`name`),
  KEY `idx_guild_active` (`guild_id`,`active`),
  KEY `idx_guild_sort` (`guild_id`,`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=191 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- tournament_audit_log
-- ============================================================
CREATE TABLE `tournament_audit_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(32) NOT NULL,
  `actor_discord_id` varchar(32) NOT NULL,
  `action` varchar(32) NOT NULL,
  `old_value` varchar(64) DEFAULT NULL,
  `new_value` varchar(64) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- tournament_settings
-- ============================================================
CREATE TABLE `tournament_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tournament_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `hltv_event_id` int DEFAULT NULL,
  `hltv_urls` json DEFAULT NULL,
  `sync_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `sync_every_minutes` int NOT NULL DEFAULT '180',
  `last_synced_at` timestamp NULL DEFAULT NULL,
  `autolink_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `autolink_keywords` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_from` date DEFAULT NULL,
  `date_to` date DEFAULT NULL,
  `preferred_organizers` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `autolink_mode` enum('once','always') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'once',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- tournament_state
-- ============================================================
CREATE TABLE `tournament_state` (
  `id` int NOT NULL DEFAULT '1',
  `phase` varchar(50) NOT NULL DEFAULT 'UNKNOWN',
  `is_open` tinyint(1) NOT NULL DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `event_id` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_event_state` (`event_id`),
  CONSTRAINT `fk_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `single_row` CHECK ((`id` = 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- user_total_scores
-- ============================================================
CREATE TABLE `user_total_scores` (
  `guild_id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `displayname` varchar(255) DEFAULT NULL,
  `total_points` int NOT NULL DEFAULT '0',
  `swiss_points` int NOT NULL DEFAULT '0',
  `playoffs_points` int NOT NULL DEFAULT '0',
  `playin_points` int NOT NULL DEFAULT '0',
  `doubleelim_points` int NOT NULL DEFAULT '0',
  `match_points` int NOT NULL DEFAULT '0',
  `correct_series` int NOT NULL DEFAULT '0',
  `correct_maps` int NOT NULL DEFAULT '0',
  `exact_maps` int NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`guild_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- sessions (migrations/0001_add_sessions_table.sql)
-- ============================================================
CREATE TABLE `sessions` (
  `session_id` varchar(128) COLLATE utf8mb4_bin NOT NULL,
  `expires` int unsigned NOT NULL,
  `data` mediumtext COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- match_result_proposals
-- Propozycje wynikow z zewnetrznego dostawcy (migracja 0002).
-- Wynik NIE trafia stad wprost do match_results - admin zatwierdza.
-- ============================================================
CREATE TABLE `match_result_proposals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_id` int NOT NULL,
  `match_id` int NOT NULL,
  `source` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `external_match_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `res_a` tinyint NOT NULL,
  `res_b` tinyint NOT NULL,
  `payload` json DEFAULT NULL,
  `status` enum('PENDING','ACCEPTED','REJECTED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `resolved_by` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_proposal_match_source` (`guild_id`,`match_id`,`source`),
  KEY `idx_proposals_pending` (`guild_id`,`event_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
