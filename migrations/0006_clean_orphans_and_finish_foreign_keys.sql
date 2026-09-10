-- 0006_clean_orphans_and_finish_foreign_keys.sql
--
-- Domyka to, co zostawila 0005: 10 relacji, ktorych nie dalo sie wtedy objac
-- kluczem obcym, bo wskazywaly na nieistniejace eventy i mecze.
--
-- Co dokladnie jest kasowane (stan sprawdzony przed napisaniem tego pliku):
--
--   leaderboard              515  event_id 2 (509) + 1, 28, 31, 40, 57, 70
--   match_map_results         12  event_id 41, 57 / match_id 447, 467-469
--   match_map_predictions     12  event_id 57 / match_id 331, 467-469
--   mvp_candidates             2  event_id 41
--   mvp_scores                 2  event_id 1, 70
--   mvp_results                2  event_id 41, 70
--   mvp_predictions            1  event_id 70
--   player_event_history       1  event_id 71
--
-- Zadne z tych id nie istnieje w `events` ani `matches` - w bazie zyja
-- wylacznie eventy 37, 84, 88 i 90. Wiersze sa nieosiagalne dla kodu:
-- kazda sciezka odczytu idzie przez slug -> events -> event_id.
--
-- Te 509 wierszy z event_id = 2 to co do wiersza duplikat rankingu
-- StarLadder Budapest Major 2025, ktory zyje jako event 84: 509 wspolnych
-- graczy, 509 z identycznym user_id I identyczna liczba punktow, zero
-- roznic. Kopia z 2026-07-28, event 84 ma te sama tresc i dzialajaca strone
-- archiwum. Skasowanie nie usuwa historii zadnego turnieju.
--
-- Pozostale 6 wierszy w leaderboard to jeden i ten sam uzytkownik, resztki
-- po skasowanych eventach testowych.

DELETE lb FROM leaderboard lb
  LEFT JOIN events e ON e.id = lb.event_id
  WHERE e.id IS NULL;

DELETE d FROM match_map_predictions d
  LEFT JOIN events e ON e.id = d.event_id
  LEFT JOIN matches m ON m.id = d.match_id
  WHERE (d.event_id IS NOT NULL AND e.id IS NULL)
     OR (d.match_id IS NOT NULL AND m.id IS NULL);

DELETE d FROM match_map_results d
  LEFT JOIN events e ON e.id = d.event_id
  LEFT JOIN matches m ON m.id = d.match_id
  WHERE (d.event_id IS NOT NULL AND e.id IS NULL)
     OR (d.match_id IS NOT NULL AND m.id IS NULL);

DELETE d FROM mvp_candidates d
  LEFT JOIN events e ON e.id = d.event_id
  WHERE e.id IS NULL;

DELETE d FROM mvp_predictions d
  LEFT JOIN events e ON e.id = d.event_id
  WHERE e.id IS NULL;

DELETE d FROM mvp_results d
  LEFT JOIN events e ON e.id = d.event_id
  WHERE e.id IS NULL;

DELETE d FROM mvp_scores d
  LEFT JOIN events e ON e.id = d.event_id
  WHERE e.id IS NULL;

DELETE d FROM player_event_history d
  LEFT JOIN events e ON e.id = d.event_id
  WHERE e.id IS NULL;

-- Typ musi sie zgadzac z events.id (`int`). Po powyzszym DELETE tabela jest
-- pusta - jej jedyny wiersz byl wlasnie sierota - wiec zwezenie typu nie ma
-- czego stracic.
ALTER TABLE player_event_history
  MODIFY COLUMN event_id INT NOT NULL;

ALTER TABLE leaderboard
  ADD CONSTRAINT fk_leaderboard_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE match_map_predictions
  ADD CONSTRAINT fk_match_map_predictions_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_match_map_predictions_match
    FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE;

ALTER TABLE match_map_results
  ADD CONSTRAINT fk_match_map_results_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_match_map_results_match
    FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE;

ALTER TABLE mvp_candidates
  ADD CONSTRAINT fk_mvp_candidates_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE mvp_predictions
  ADD CONSTRAINT fk_mvp_predictions_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE mvp_results
  ADD CONSTRAINT fk_mvp_results_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE mvp_scores
  ADD CONSTRAINT fk_mvp_scores_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE player_event_history
  ADD CONSTRAINT fk_player_event_history_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;
