-- 0005_add_foreign_keys_to_event_tables.sql
--
-- Baza miala 6 kluczy obcych na 42 tabele. Skutek: skasowanie eventu nie
-- ruszalo niczego poza `matches` i `active_panels`, a cala reszta - typy,
-- punkty, wyniki faz, ranking - zostawala jako wiersze wskazujace na event,
-- ktorego juz nie ma. Dzis takich sierot jest ~550.
--
-- Zadna sciezka w kodzie nie kasuje eventow (nie ma ani jednego
-- `DELETE FROM events`; archiwizacja to wylacznie flaga is_archived).
-- CASCADE nie ma wiec jak wystrzelic z normalnego dzialania aplikacji -
-- dziala dopiero przy recznym czyszczeniu bazy, czyli dokladnie tam, gdzie
-- te sieroty powstaly.
--
-- Ta migracja obejmuje wylacznie relacje, w ktorych JUZ TERAZ nie ma ani
-- jednej sieroty - nie kasuje i nie modyfikuje zadnego wiersza danych.
-- Pozostale 10 relacji czeka na osobna migracje, bo wymagaja wczesniejszego
-- sprzatania.
--
-- Regula ON DELETE CASCADE jest zgodna ze wszystkimi 6 istniejacymi kluczami.

-- Typ musi byc identyczny jak w kolumnie nadrzednej (events.id / matches.id
-- sa `int`). Obie tabele sa puste, wiec zwezenie typu nie moze niczego
-- stracic.
ALTER TABLE match_maps
  MODIFY COLUMN event_id INT NOT NULL,
  MODIFY COLUMN match_id INT NOT NULL;

ALTER TABLE pending_match_edits
  MODIFY COLUMN match_id INT NOT NULL;

-- event_id -> events
ALTER TABLE doubleelim_predictions
  ADD CONSTRAINT fk_doubleelim_predictions_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE doubleelim_results
  ADD CONSTRAINT fk_doubleelim_results_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE doubleelim_scores
  ADD CONSTRAINT fk_doubleelim_scores_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE event_pickem_phases
  ADD CONSTRAINT fk_event_pickem_phases_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE match_points
  ADD CONSTRAINT fk_match_points_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE match_predictions
  ADD CONSTRAINT fk_match_predictions_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE match_results
  ADD CONSTRAINT fk_match_results_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE phase_schedule_state
  ADD CONSTRAINT fk_phase_schedule_state_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE playin_predictions
  ADD CONSTRAINT fk_playin_predictions_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE playin_results
  ADD CONSTRAINT fk_playin_results_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE playin_scores
  ADD CONSTRAINT fk_playin_scores_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE playoffs_predictions
  ADD CONSTRAINT fk_playoffs_predictions_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE playoffs_results
  ADD CONSTRAINT fk_playoffs_results_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE playoffs_scores
  ADD CONSTRAINT fk_playoffs_scores_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE swiss_predictions
  ADD CONSTRAINT fk_swiss_predictions_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE swiss_results
  ADD CONSTRAINT fk_swiss_results_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

ALTER TABLE swiss_scores
  ADD CONSTRAINT fk_swiss_scores_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;

-- match_id -> matches
ALTER TABLE community_stats_posts
  ADD CONSTRAINT fk_community_stats_posts_match
    FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE;

-- Tabele z obiema relacjami naraz.
ALTER TABLE match_maps
  ADD CONSTRAINT fk_match_maps_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_match_maps_match
    FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE;

ALTER TABLE match_result_proposals
  ADD CONSTRAINT fk_match_result_proposals_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_match_result_proposals_match
    FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE;

ALTER TABLE pending_match_edits
  ADD CONSTRAINT fk_pending_match_edits_match
    FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE;
