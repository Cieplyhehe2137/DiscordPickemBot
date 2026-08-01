-- Propozycje wyników meczów pobrane z zewnętrznego dostawcy danych
-- (PandaScore itp.). Świadomie NIE zapisujemy wyniku wprost do match_results:
-- zapis przelicza punkty wszystkim graczom, więc błędna albo częściowa
-- odpowiedź API rozjechałaby ranking bez śladu. Wiersz tutaj to propozycja,
-- którą admin zatwierdza lub odrzuca w panelu.
--
-- collation utf8mb4_unicode_ci celowo - takie mają matches i match_results,
-- z którymi ta tabela się łączy. events ma utf8mb4_0900_ai_ci, więc join po
-- guild_id z tamtą tabelą wymaga porównania z parametrem, nie kolumna-do-
-- kolumny (ER_CANT_AGGREGATE_2COLLATIONS - już raz nas to ugryzło).
CREATE TABLE IF NOT EXISTS `match_result_proposals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guild_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_id` int NOT NULL,
  `match_id` int NOT NULL,

  -- nazwa dostawcy, np. 'pandascore'; trzymana wprost, żeby dało się
  -- rozróżnić źródła i podmienić dostawcę bez czyszczenia historii
  `source` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `external_match_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `res_a` tinyint NOT NULL,
  `res_b` tinyint NOT NULL,

  -- surowa odpowiedź dostawcy - do audytu, gdyby propozycja okazała się zła
  `payload` json DEFAULT NULL,

  `status` enum('PENDING','ACCEPTED','REJECTED') COLLATE utf8mb4_unicode_ci
      NOT NULL DEFAULT 'PENDING',

  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `resolved_by` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  PRIMARY KEY (`id`),

  -- jedna propozycja na (mecz, dostawca): ponowna synchronizacja aktualizuje
  -- istniejący wiersz zamiast mnożyć duplikaty w kolejce admina
  UNIQUE KEY `uniq_proposal_match_source` (`guild_id`, `match_id`, `source`),
  KEY `idx_proposals_pending` (`guild_id`, `event_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Powiązanie lokalnych bytów z bytami dostawcy. Bez tego nie da się
-- rozstrzygnąć, że "NAVI" u nas to "Natus Vincere" u dostawcy - a to jest
-- realne miejsce, w którym takie integracje się wykładają.
ALTER TABLE `events`
  ADD COLUMN `external_tournament_id` varchar(64) DEFAULT NULL;

ALTER TABLE `teams`
  ADD COLUMN `external_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL;
