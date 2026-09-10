-- Konfiguracja typowania drużyn per event.
--
-- Do tej pory zasady były zaszyte w kodzie w ~20 miejscach (Swiss 2/2/6,
-- Play-In 8, Playoffs 4/2/1/1, Double Elim 2x4) - w handlerach Discorda,
-- w endpointach API i na czterech stronach frontu. Nie dało się prowadzić
-- turnieju o innym formacie, bo liczby były wspólne dla wszystkiego.
--
-- Ta tabela wiąże fazy typowania drużyn z KONKRETNYM eventem, tak samo jak
-- matches.event_id wiąże z nim mecze. Brak wiersza = zachowanie dotychczasowe
-- (domyślne liczby z utils/eventPickemConfig.js), więc istniejące turnieje
-- działają bez zmian i bez backfillu.
--
-- `config` trzyma limity per grupa, kształt zależny od fazy:
--   stage1|stage2|stage3 -> {"x3_0":2,"x0_3":2,"advancing":6}
--   playin               -> {"teams":8}
--   playoffs             -> {"semifinalists":4,"finalists":2,"winner":1,"third":1}
--   doubleelim           -> {"upperFinalA":2,"lowerFinalA":2,"upperFinalB":2,"lowerFinalB":2}

CREATE TABLE IF NOT EXISTS event_pickem_phases (
  id INT NOT NULL AUTO_INCREMENT,
  guild_id VARCHAR(32) NOT NULL,
  event_id INT NOT NULL,
  phase VARCHAR(20) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  config JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_event_phase (event_id, phase),
  KEY idx_epp_guild_event (guild_id, event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
