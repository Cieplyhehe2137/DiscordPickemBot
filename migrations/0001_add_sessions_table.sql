-- Persistent express-session store (server/index.js) via express-mysql-session,
-- replacing the default in-memory MemoryStore. Schema is the package's own
-- default (server/node_modules/express-mysql-session/schema.sql) - not
-- guild-scoped, shared table for all sessions.
CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` varchar(128) COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` mediumtext COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB;
