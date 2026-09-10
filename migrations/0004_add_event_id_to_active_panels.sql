-- 0004_add_event_id_to_active_panels.sql
--
-- Panel nie wiedział, do którego eventu należy.
--
-- Wiersz był identyfikowany przez UNIQUE (phase, stage_key, channel_id) -
-- bez event_id, a nawet bez guild_id (działało tylko dlatego, że kanał
-- należy do jednej gildii). Kolejne eventy w tej samej gildii publikują tę
-- samą fazę na ten sam kanał, więc nowy event NIE zakładał własnego wiersza,
-- tylko nadpisywał wiersz poprzedniego przez ON DUPLICATE KEY UPDATE -
-- kasując mu message_id, deadline i closed_at.
--
-- Skutki, obie realne przy eventach idących po kolei:
--   1. Historia paneli poprzedniego turnieju znikała bez śladu.
--   2. Odczyt deadline'u dla zakończonego eventu zwracał termin eventu
--      bieżącego, bo zapytania biorą najnowszy wiersz dla (guild, phase).
--
-- Po zmianie każdy event ma własne wiersze, a skasowanie eventu sprząta je
-- kaskadą, zamiast zostawiać sieroty.

ALTER TABLE active_panels
  ADD COLUMN event_id INT NULL AFTER guild_id;

-- W tabeli są wyłącznie dwa zamknięte wiersze po testowym evencie, którego
-- już nie ma - nie da się im przypisać eventu. Zostawione z NULL-em nadal
-- fałszowałyby odczyty swojej gildii, bo isPickDeadlinePassed celowo nie
-- filtruje po `active`.
DELETE FROM active_panels WHERE event_id IS NULL;

-- Dopiero teraz NOT NULL: obie ścieżki INSERT-u (utils/pickemPanelPublisher.js)
-- mają eventId zwalidowany na wejściu, więc wiersz bez eventu nie ma prawa
-- powstać. To jedyne miejsca w kodzie, które wstawiają do tej tabeli.
ALTER TABLE active_panels
  MODIFY COLUMN event_id INT NOT NULL,
  DROP INDEX unique_phase_stagekey_channel,
  ADD UNIQUE KEY uniq_panel_event_phase_stage_channel
    (event_id, phase, stage_key, channel_id),
  ADD CONSTRAINT fk_active_panels_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;
